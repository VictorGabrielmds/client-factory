"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { functions, db } from "../lib/firebase-client";
import { useAuth } from "../hooks/useAuth";
import { useProdutos } from "../hooks/useProdutos";
import type { Produto } from "../types/produto";
import { useFreteCheckout } from "../hooks/useFreteCheckout";
import { mensagemFalhaCheckout } from "../lib/checkoutFeedback";
import { carregarComInsistencia, comRetentativa } from "../lib/rede";

const CHAVE_STORAGE = "fabrica_carrinho";
const CHAVE_CHECKOUT_PENDENTE = "fabrica_checkout_pendente_v2";
const VALIDADE_CHECKOUT_PENDENTE_MS = 48 * 60 * 60 * 1000;

// Timeouts das chamadas do checkout. O padrão do SDK é 70s por chamada: numa
// rede ruim, 3 tentativas deixavam o botão em "Finalizando..." por mais de
// 3 minutos. Como criarPedido é idempotente (mesma chave em toda tentativa),
// cortar antes e tentar de novo nunca cria pedido duplicado.
const TIMEOUT_CRIAR_PEDIDO_MS = 35000;
const TIMEOUT_CONSULTA_MS = 15000;

const MENSAGEM_PEDIDO_ANTERIOR =
  "Seu pedido anterior, feito antes de você mudar o carrinho, foi confirmado. Confira esse pedido (link no topo) antes de finalizar outro.";

// Colchão de tempo entre escolher um horário e apertar "Finalizar" — sem
// isso, o primeiro horário da lista pode deixar de valer só pelo tempo que
// o cliente leva preenchendo o resto do checkout (o servidor valida contra o
// relógio NA HORA de finalizar, não contra o momento em que o horário foi
// escolhido). Mesmo valor usado em functions/src/cliente/pedidos.js.
const MARGEM_PREENCHIMENTO_MINUTOS = 5;

// Até essa quantidade do MESMO item, a cozinha prepara em paralelo (não
// multiplica o tempo); acima disso, cada lote adicional de até 90 unidades
// soma mais um tempo de preparo inteiro. Mesmo valor usado no servidor
// (functions/src/cliente/pedidos.js, calcularTempoPreparoMinutos) — os dois
// precisam concordar, senão um horário mostrado aqui como disponível pode
// ser rejeitado na hora de finalizar.
const TAMANHO_LOTE_PREPARO = 90;

// CPF é salvo em clientes/{uid} só com dígitos — reformata pra exibir no
// campo mascarado (mesma máscara usada no formulário do carrinho).
export function formatarCpf(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

// Campo "CPF ou CNPJ na nota" (PassoResumo) aceita os dois formatos — decide
// pela quantidade de dígitos já digitados: até 11 é máscara de CPF, a partir
// do 12º dígito vira máscara de CNPJ. Sempre grava só dígitos no estado.
export function formatarCpfCnpj(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 14);
  if (digitos.length <= 11) return formatarCpf(digitos);
  return digitos
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

interface CupomAplicado {
  codigo: string;
  tipo: "fixo" | "percentual";
  valor: number;
}

export type FormaPagamento = "pix" | "debito" | "credito";
export type TipoEntrega = "retirada" | "delivery";

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  referencia: string;
}

const ENDERECO_VAZIO: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  referencia: "",
};

// Espelha functions/src/services/horario.js — todo pedido é agendado dentro
// de um horário onde o tipo de entrega escolhido está habilitado.
const DIAS_SEMANA_ORDEM: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export type DiaSemana = "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado";

// Um dia é uma lista de turnos (ex.: almoço e jantar) — cada turno tem seu
// próprio horário e liga delivery/retirada de forma independente. Mesmo
// schema de functions/src/services/horario.js e types/Horario.ts no painel.
export interface Turno {
  abre: string; // "HH:MM"
  fecha: string; // "HH:MM"
  deliveryAtivo: boolean;
  retiradaAtivo: boolean;
}

export interface DiaHorario {
  ativo: boolean;
  turnos: Turno[];
}

export type HorarioFuncionamento = Record<DiaSemana, DiaHorario>;

// Doc configuracoes/horario completo — os 7 dias + até quantos dias à frente
// dá pra agendar e o intervalo entre os horários mostrados no checkout (ex.:
// 9:00/9:30/10:00 vs. 9:00/9:20/9:40). Mesmo shape de types/Horario.ts no
// painel e de buscarHorarioFuncionamento em functions/src/services/horario.js.
export interface ConfiguracaoHorario {
  diasAntecedencia: number;
  intervaloMinutos: number;
  dias: HorarioFuncionamento;
}

export interface SlotAgendamento {
  data: string; // "AAAA-MM-DD"
  hora: string; // "HH:MM"
  label: string; // "Hoje às 19:30" / "Amanhã às 19:30" / "qui., 16/07 às 19:30"
}

// Status de pedidos/{doc}.status — espelha PedidoStatus em src/types/Pedido.ts
// no painel (InstaDelivery também usa esses mesmos números).
// Exportado — a página /pedido/[orderId] também usa pra decidir se mostra
// o botão "Solicitar alteração" ali (não só no card do cardápio).
export const STATUS_PEDIDO_NAO_ENTREGUE = new Set([1, 2]); // Recebido, Aceito — ainda dá pra pedir alteração

export interface UltimoPedido {
  orderId: string;
  status: number | null;
  tipoEntrega: TipoEntrega | null;
  agendamentoTexto: string | null;
  descricaoItem: string[];
  quantidadeItem: number[];
  // Só existe em pedidos criados depois desta feature — pedidos antigos
  // ficam sem essa lista, e "repetir pedido" não tem como remontar o
  // carrinho por ID nesse caso (só descricaoItem/quantidadeItem, pra exibir).
  produtoIdItem: string[];
}

// Endereço nomeado ("Casa", "Trabalho"...) — lista em clientes/{uid}.enderecos,
// separada do enderecoSalvo singular (a "preferência atual" da barra
// "Entregar em" / checkout rápido, que continua existindo do jeito que já era).
export interface EnderecoSalvo extends Endereco {
  id: string;
  rotulo: string;
}

// Resumo de um pedido antigo pra tela de histórico — não precisa dos itens
// completos (só o card de acompanhamento em /pedido/[id] usa isso).
export interface HistoricoPedidoResumo {
  orderId: string;
  status: number | null;
  dataVenda: string | null;
  tipoEntrega: TipoEntrega | null;
  valorVenda: number;
  totalItensTexto: string;
}

function paraDataISO(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function horaParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rotularSlot(data: Date, offsetDias: number, hora: string): string {
  const diaLabel =
    offsetDias === 0
      ? "Hoje"
      : offsetDias === 1
        ? "Amanhã"
        : data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `${diaLabel} às ${hora}`;
}

// Gera os horários agendáveis pros próximos dias, filtrados pelo tipo de
// entrega escolhido — só uma PRÉVIA pro cliente ver/escolher: criarPedido
// valida de novo no servidor com a mesma regra (ver validarAgendamento em
// functions/src/services/horario.js), então nunca precisa ficar 100%
// sincronizado até o milissegundo com o relógio do servidor.
//
// `antecedenciaMinutos` é o tempo mínimo entre agora e o horário escolhido —
// 0 pra retirada, ou o tempo estimado de moto até o bairro pra delivery (ver
// tempoEntregaMinutos, vindo de consultarTaxaEntrega). Sem isso, um bairro a
// 40min de moto apareceria disponível pra daqui 10min.
function gerarSlotsAgendamento(
  config: ConfiguracaoHorario,
  tipoEntrega: TipoEntrega,
  antecedenciaMinutos: number
): SlotAgendamento[] {
  const slots: SlotAgendamento[] = [];
  const agora = new Date();
  const minimoPermitido = new Date(agora.getTime() + antecedenciaMinutos * 60000);

  for (let offset = 0; offset <= config.diasAntecedencia; offset++) {
    const data = new Date(agora);
    data.setDate(data.getDate() + offset);
    const diaSemana = DIAS_SEMANA_ORDEM[data.getDay()];
    const diaConfig = config.dias[diaSemana];
    if (!diaConfig?.ativo || diaConfig.turnos.length === 0) continue;

    const dataISO = paraDataISO(data);

    for (const turno of diaConfig.turnos) {
      const habilitado = tipoEntrega === "delivery" ? turno.deliveryAtivo : turno.retiradaAtivo;
      if (!habilitado) continue;

      const abre = horaParaMinutos(turno.abre);
      const fecha = horaParaMinutos(turno.fecha);

      for (let minutos = abre; minutos <= fecha; minutos += config.intervaloMinutos) {
        const hora = minutosParaHora(minutos);
        const instanteSlot = new Date(data);
        instanteSlot.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
        if (instanteSlot < minimoPermitido) continue;
        slots.push({ data: dataISO, hora, label: rotularSlot(data, offset, hora) });
      }
    }
  }

  // Turnos podem se sobrepor (dois turnos cobrindo o mesmo minuto) ou não
  // vir em ordem — ordena por dia+hora e remove duplicatas pro dropdown do
  // checkout ficar sempre cronológico e sem repetição.
  const vistos = new Set<string>();
  return slots
    .filter((slot) => {
      const chave = `${slot.data}|${slot.hora}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    })
    .sort((a, b) => (a.data === b.data ? a.hora.localeCompare(b.hora) : a.data.localeCompare(b.data)));
}

interface EstadoPersistido {
  quantidades: Record<string, number>;
  observacoes: string;
  cupomCodigo: string;
  tipoEntrega: TipoEntrega;
  endereco: Endereco;
}

interface PayloadCheckout {
  itens: { produtoId: string; quantidade: number }[];
  observacoes: string;
  cupomCodigo: string | null;
  formaPagamento: FormaPagamento;
  nome: string;
  cpf: string;
  tipoEntrega: TipoEntrega;
  endereco: Endereco | null;
  agendamento: { data: string; hora: string };
}

interface CheckoutPendentePersistido {
  idempotencyKey: string;
  uid: string;
  criadoEm: number;
  payload: PayloadCheckout;
}

interface ResultadoCheckout {
  orderId: string;
}

function lerCheckoutPendente(uid: string): CheckoutPendentePersistido | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CHECKOUT_PENDENTE);
    if (!bruto) return null;
    const tentativa = JSON.parse(bruto) as CheckoutPendentePersistido;
    const valida =
      tentativa?.uid === uid &&
      typeof tentativa.idempotencyKey === "string" &&
      tentativa.idempotencyKey.length >= 10 &&
      tentativa.payload &&
      Date.now() - Number(tentativa.criadoEm || 0) <= VALIDADE_CHECKOUT_PENDENTE_MS;
    if (valida) return tentativa;
    window.localStorage.removeItem(CHAVE_CHECKOUT_PENDENTE);
  } catch {
    // Storage bloqueado ou corrompido: o fallback em memória ainda protege
    // duplo clique dentro desta aba.
  }
  return null;
}

function salvarCheckoutPendente(tentativa: CheckoutPendentePersistido) {
  try {
    window.localStorage.setItem(CHAVE_CHECKOUT_PENDENTE, JSON.stringify(tentativa));
  } catch {
    // O servidor continua idempotente mesmo se o navegador bloquear storage.
  }
}

function limparCheckoutPendente() {
  try {
    window.localStorage.removeItem(CHAVE_CHECKOUT_PENDENTE);
  } catch {
    // Sem ação: storage indisponível.
  }
}

function codigoFunctions(erro: unknown) {
  if (!(erro instanceof FunctionsError)) return "";
  return String(erro.code || "").replace(/^functions\//, "");
}

const CODIGOS_TRANSITORIOS = new Set([
  "aborted",
  "already-exists",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

const esperar = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

interface CarrinhoContextValue {
  produtos: Produto[];
  produtosLoading: boolean;
  produtosErro: boolean;
  // false até o carrinho salvo neste aparelho ser lido — evita mostrar
  // "carrinho vazio" por um instante (ou enquanto o cardápio carrega numa
  // rede lenta) para quem tem itens salvos.
  carrinhoRestaurado: boolean;
  quantidadeItensSalvos: number;
  // Pedido que foi criado numa tentativa anterior cuja resposta se perdeu
  // (internet caiu, página recarregada). Descoberto ao abrir o app.
  pedidoRecuperado: string | null;
  descartarPedidoRecuperado: () => void;

  itens: ItemCarrinho[];
  // Itens do carrinho que ficaram esgotados depois de adicionados — o
  // checkout fica travado até eles saírem (o servidor não recusa sozinho).
  itensEsgotados: ItemCarrinho[];
  removerEsgotados: () => void;
  totalItens: number;
  subtotal: number;
  desconto: number;
  total: number;
  taxaCartao: number;
  taxaDebitoPercentual: number;
  taxaCreditoPercentual: number;
  whatsappLoja: string;
  valorMinimoEntrega: number;
  faltaParaValorMinimo: number;
  enderecoLojaTexto: string;
  enderecoLojaLink: string;

  tipoEntrega: TipoEntrega;
  definirTipoEntrega: (tipo: TipoEntrega) => void;
  endereco: Endereco;
  definirEndereco: (campo: keyof Endereco, valor: string) => void;
  taxaEntrega: number;
  taxaEntregaCarregando: boolean;
  taxaEntregaErro: string | null;
  recalcularTaxaEntrega: () => void;
  bairrosEntrega: string[];

  horarioFuncionamento: ConfiguracaoHorario | null;
  horarioCarregando: boolean;
  horarioErro: boolean;
  slotsDisponiveis: SlotAgendamento[];
  agendamento: SlotAgendamento | null;
  definirAgendamento: (slot: SlotAgendamento) => void;
  horarioExpirou: boolean;
  antecedenciaMinutos: number;

  ordemCategorias: string[];
  descricoesCategorias: Record<string, string>;

  ultimoPedido: UltimoPedido | null;
  ultimoPedidoCarregando: boolean;
  ultimoPedidoNaoEntregue: boolean;
  repetirUltimoPedido: () => { adicionados: number; indisponiveis: number };

  salvandoEndereco: boolean;
  salvarEnderecoPerfil: (tipoEntrega: TipoEntrega, endereco: Endereco) => Promise<boolean>;

  enderecosSalvos: EnderecoSalvo[];
  salvandoEnderecoNomeado: boolean;
  salvarEnderecoNomeado: (dados: Omit<EnderecoSalvo, "id"> & { id?: string }) => Promise<boolean>;
  removerEnderecoNomeado: (id: string) => Promise<boolean>;

  historicoPedidos: HistoricoPedidoResumo[];
  historicoPedidosCarregando: boolean;
  historicoPedidosErro: boolean;
  carregarHistoricoPedidos: () => Promise<void>;

  adicionar: (produtoId: string) => void;
  remover: (produtoId: string) => void;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  limparCarrinho: () => void;

  observacoes: string;
  definirObservacoes: (texto: string) => void;

  cupomCodigo: string;
  definirCupomCodigo: (texto: string) => void;
  cupomAplicado: CupomAplicado | null;
  cupomValidando: boolean;
  cupomErro: string | null;
  aplicarCupom: () => Promise<void>;
  removerCupom: () => void;

  nome: string;
  definirNome: (texto: string) => void;
  cpf: string;
  definirCpf: (texto: string) => void;
  formaPagamento: FormaPagamento | null;
  definirFormaPagamento: (forma: FormaPagamento) => void;
  finalizando: boolean;
  erroFinalizar: string | null;
  finalizarPedido: () => Promise<{ orderId: string } | null>;
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null);

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const { produtos, loading: produtosLoading, erro: produtosErro } = useProdutos();
  const { user } = useAuth();

  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = useState("");
  const [cupomCodigo, setCupomCodigo] = useState("");

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>("retirada");
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  const { taxaEntrega, taxaEntregaCarregando, taxaEntregaErro, tempoEntregaMinutos, recalcularTaxaEntrega } = useFreteCheckout(tipoEntrega, endereco.bairro);
  const [bairrosEntrega, setBairrosEntrega] = useState<string[]>([]);
  const bairrosCarregados = useRef(false);

  // Tempo estimado de moto até o bairro escolhido (0 = sem info/retirada) —
  // vem junto da taxa (mesma zona), usado só pra calcular a antecedência
  // mínima de agendamento pra delivery. Nunca decide nada sozinho: quem
  // valida de verdade é o servidor em criarPedido.

  const [horarioFuncionamento, setHorarioFuncionamento] = useState<ConfiguracaoHorario | null>(null);
  const [horarioCarregando, setHorarioCarregando] = useState(true);
  const [horarioErro, setHorarioErro] = useState(false);
  const [agendamento, setAgendamento] = useState<SlotAgendamento | null>(null);
  const [ordemCategorias, setOrdemCategorias] = useState<string[]>([]);
  const [descricoesCategorias, setDescricoesCategorias] = useState<Record<string, string>>({});

  const [taxaDebitoPercentual, setTaxaDebitoPercentual] = useState(0);
  const [taxaCreditoPercentual, setTaxaCreditoPercentual] = useState(0);
  const [whatsappLoja, setWhatsappLoja] = useState("");
  const [valorMinimoEntrega, setValorMinimoEntrega] = useState(0);
  const [enderecoLojaTexto, setEnderecoLojaTexto] = useState("");
  const [enderecoLojaLink, setEnderecoLojaLink] = useState("");
  const [tempoPreparoPadraoMinutos, setTempoPreparoPadraoMinutos] = useState(0);

  const [ultimoPedido, setUltimoPedido] = useState<UltimoPedido | null>(null);
  const [ultimoPedidoCarregando, setUltimoPedidoCarregando] = useState(false);

  const [enderecosSalvos, setEnderecosSalvos] = useState<EnderecoSalvo[]>([]);
  const [salvandoEnderecoNomeado, setSalvandoEnderecoNomeado] = useState(false);

  const [historicoPedidos, setHistoricoPedidos] = useState<HistoricoPedidoResumo[]>([]);
  const [historicoPedidosCarregando, setHistoricoPedidosCarregando] = useState(false);
  const [historicoPedidosErro, setHistoricoPedidosErro] = useState(false);
  // uid cujo histórico já está carregado — trocar de conta no mesmo aparelho
  // não pode continuar mostrando os pedidos da conta anterior.
  const historicoPedidosCarregado = useRef<string | null>(null);

  const [cupomAplicado, setCupomAplicado] = useState<CupomAplicado | null>(null);
  const [cupomValidando, setCupomValidando] = useState(false);
  const [cupomErro, setCupomErro] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
  const [pedidoRecuperado, setPedidoRecuperado] = useState<string | null>(null);
  const [carrinhoRestaurado, setCarrinhoRestaurado] = useState(false);

  // Fallback em memória para navegadores que bloqueiam localStorage. No fluxo
  // normal a tentativa completa também fica persistida, então fechar/reabrir
  // a página não perde a chave nem cria outro pedido após uma resposta perdida.
  const checkoutPendenteRef = useRef<CheckoutPendentePersistido | null>(null);
  // Trava de reentrância: bloqueia uma 2ª chamada a finalizarPedido() que
  // chegue antes do React re-renderizar o botão como disabled.
  const finalizandoRef = useRef(false);

  const revalidacaoAutomaticaFeita = useRef(false);
  // O visitante pode preencher o nome antes de informar o WhatsApp. Quando
  // ele entra, o perfil daquele número é carregado; esse carregamento é só
  // uma sugestão e não pode trocar o nome que acabou de ser digitado para o
  // pedido atual.
  const perfilCarregadoParaUidRef = useRef<string | null>(null);
  const nomeDigitadoNoCheckoutRef = useRef(false);

  // Marcados pelo efeito de restaurar o carrinho (abaixo) quando já existe
  // endereço/tipo de entrega salvos NESTE dispositivo — nesse caso, o perfil
  // do servidor (enderecoSalvo/tipoEntregaPreferida) não deve sobrescrever o
  // que já está na tela; ele só serve de fallback num dispositivo novo.
  const enderecoRestauradoLocalRef = useRef(false);
  const tipoEntregaRestauradoLocalRef = useRef(false);

  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  const definirNome = useCallback((texto: string) => {
    nomeDigitadoNoCheckoutRef.current = true;
    setNome(texto);
  }, []);

  // Pré-preenche nome, CPF e (se este dispositivo ainda não tiver nada
  // salvo localmente) endereço/tipo de entrega do último pedido —
  // clientes/{uid} é owner-scoped nas regras, só o próprio cliente lê.
  // O nome salvo só preenche um campo ainda intacto: o que foi digitado no
  // checkout sempre é a fonte de verdade do pedido atual.
  useEffect(() => {
    if (!user) {
      perfilCarregadoParaUidRef.current = null;
      return;
    }
    if (perfilCarregadoParaUidRef.current === user.uid) return;
    perfilCarregadoParaUidRef.current = user.uid;
    comRetentativa(() => getDoc(doc(db, "clientes", user.uid)))
      .then((snap) => {
        const dados = snap.data();
        if (dados?.nome && !nomeDigitadoNoCheckoutRef.current) setNome(dados.nome);
        if (dados?.cpf) setCpf(formatarCpf(dados.cpf));
        if (!tipoEntregaRestauradoLocalRef.current && dados?.tipoEntregaPreferida) {
          setTipoEntrega(dados.tipoEntregaPreferida);
        }
        if (!enderecoRestauradoLocalRef.current && dados?.enderecoSalvo?.bairro) {
          const salvo = dados.enderecoSalvo;
          setEndereco({
            cep: salvo.cep ?? "",
            logradouro: salvo.logradouro ?? "",
            numero: salvo.numero ?? "",
            complemento: salvo.complemento ?? "",
            bairro: salvo.bairro ?? "",
            referencia: salvo.referencia ?? "",
          });
        }
        if (Array.isArray(dados?.enderecos)) setEnderecosSalvos(dados.enderecos);
      })
      .catch(() => {
        // Sem perfil salvo ou leitura falhou — os campos só ficam vazios, sem
        // quebrar a página. Libera para tentar de novo na próxima troca de user.
        if (perfilCarregadoParaUidRef.current === user.uid) perfilCarregadoParaUidRef.current = null;
      });
  }, [user]);

  // Último pedido do cliente — base de "repetir último pedido" e "solicitar
  // alteração" (ver Cardapio.tsx). Regras já permitem essa consulta direta
  // (pedidos/{id}: allow read se resource.data.clienteUid == uid), sem
  // precisar de uma Cloud Function só pra isso.
  const ultimoPedidoCarregado = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      if (ultimoPedidoCarregado.current) {
        // Saiu da conta: não deixa o último pedido/histórico da conta
        // anterior aparecendo para quem entrar depois neste aparelho.
        ultimoPedidoCarregado.current = null;
        historicoPedidosCarregado.current = null;
        setUltimoPedido(null);
        setHistoricoPedidos([]);
      }
      return;
    }
    if (ultimoPedidoCarregado.current === user.uid) return;
    ultimoPedidoCarregado.current = user.uid;
    setUltimoPedidoCarregando(true);
    const q = query(
      collection(db, "pedidos"),
      where("clienteUid", "==", user.uid),
      orderBy("criadoEmTimestamp", "desc"),
      limit(1)
    );
    comRetentativa(() => getDocs(q))
      .then((snap) => {
        if (snap.empty) return;
        const pedidoDoc = snap.docs[0];
        const dados = pedidoDoc.data();
        setUltimoPedido({
          orderId: pedidoDoc.id,
          status: typeof dados.status === "number" ? dados.status : null,
          tipoEntrega: dados.tipo_entrega === "delivery" ? "delivery" : dados.tipo_entrega === "retirada" ? "retirada" : null,
          agendamentoTexto: dados.agendamento ?? null,
          descricaoItem: Array.isArray(dados.descricao_item) ? dados.descricao_item : [],
          quantidadeItem: Array.isArray(dados.quantidade_item) ? dados.quantidade_item : [],
          produtoIdItem: Array.isArray(dados.produto_id_item) ? dados.produto_id_item : [],
        });
      })
      .catch((err) => {
        // Sem pedido anterior/erro de rede — "repetir" e "solicitar alteração" só ficam sem aparecer.
        console.error("Erro ao buscar último pedido:", err);
        if (ultimoPedidoCarregado.current === user.uid) ultimoPedidoCarregado.current = null;
      })
      .finally(() => setUltimoPedidoCarregando(false));
  }, [user]);

  // Horário de funcionamento (delivery/retirada por dia da semana) — buscado
  // uma vez já no carregamento (mesmo sem login: visitante navega o cardápio
  // inteiro, incluindo "aberto agora", antes de se cadastrar — login só é
  // pedido no "Finalizar pedido"). É só a base pra montar os horários
  // agendáveis no carrinho; criarPedido confere tudo de novo no servidor.
  //
  // Numa rede ruim essa busca falhava UMA vez e o checkout ficava para
  // sempre em "Nenhum horário disponível" até recarregar a página — agora
  // tenta de novo sozinho (e na hora em que a internet volta).
  useEffect(() => {
    const consultar = httpsCallable<Record<string, never>, { horario: ConfiguracaoHorario }>(
      functions,
      "consultarHorarioFuncionamento",
      { timeout: TIMEOUT_CONSULTA_MS }
    );
    return carregarComInsistencia(
      () => consultar({}),
      (resultado) => {
        setHorarioFuncionamento(resultado.data.horario);
        setHorarioErro(false);
        setHorarioCarregando(false);
      },
      (err) => {
        // Logado (não silencioso) porque uma falha aqui é sistêmica, não
        // "esperada" como cupom inválido — ex.: App Check mal configurado.
        console.error("consultarHorarioFuncionamento falhou:", err);
        setHorarioErro(true);
        setHorarioCarregando(false);
      }
    );
  }, []);

  // Ordem das categorias definida no painel (configuracoes/categorias) —
  // categoria fora da lista cai no fim, em ordem alfabética entre si (ver
  // uso em Cardapio.tsx). Mesma lógica de "sem login" do horário acima.
  useEffect(() => {
    const consultar = httpsCallable<Record<string, never>, { ordem: string[]; descricoes: Record<string, string> }>(
      functions,
      "consultarOrdemCategorias",
      { timeout: TIMEOUT_CONSULTA_MS }
    );
    return carregarComInsistencia(
      () => consultar({}),
      (resultado) => {
        setOrdemCategorias(resultado.data.ordem);
        setDescricoesCategorias(resultado.data.descricoes ?? {});
      },
      (err) => {
        // Enquanto não carrega, Cardapio.tsx usa ordem alfabética e sem textos de seção.
        console.error("consultarOrdemCategorias falhou:", err);
      }
    );
  }, []);

  // Taxa de cartão (débito/crédito), tempo de preparo padrão e WhatsApp da
  // loja (configuracoes/geral) — buscados uma vez, mesma lógica "sem login"
  // de horário/categorias acima.
  useEffect(() => {
    const consultar = httpsCallable<
      Record<string, never>,
      {
        taxaDebitoPercentual: number;
        taxaCreditoPercentual: number;
        whatsappLoja: string;
        tempoPreparoPadraoMinutos: number;
        valorMinimoEntrega: number;
        enderecoLojaTexto: string;
        enderecoLojaLink: string;
      }
    >(functions, "consultarConfiguracoesGerais", { timeout: TIMEOUT_CONSULTA_MS });
    return carregarComInsistencia(
      () => consultar({}),
      (resultado) => {
        setTaxaDebitoPercentual(resultado.data.taxaDebitoPercentual);
        setTaxaCreditoPercentual(resultado.data.taxaCreditoPercentual);
        setWhatsappLoja(resultado.data.whatsappLoja);
        setTempoPreparoPadraoMinutos(resultado.data.tempoPreparoPadraoMinutos);
        setValorMinimoEntrega(resultado.data.valorMinimoEntrega);
        setEnderecoLojaTexto(resultado.data.enderecoLojaTexto);
        setEnderecoLojaLink(resultado.data.enderecoLojaLink);
      },
      (err) => {
        // Enquanto não carrega, checkout segue sem taxa de cartão/tempo de
        // preparo (o servidor recalcula tudo) e sem link de WhatsApp.
        console.error("consultarConfiguracoesGerais falhou:", err);
      }
    );
  }, []);

  // Salva endereço/tipo de entrega no perfil ANTES de qualquer pedido (ex.:
  // pela barra "Entregar em" do cardápio) — usada pela mesma Cloud Function
  // que criarPedido chama automaticamente depois de cada pedido concluído.
  // Atualiza o estado local na hora (não espera o próximo login) e marca os
  // refs de "já restaurado localmente" pra essa escolha não ser sobrescrita
  // por uma leitura de perfil que ainda esteja em voo.
  const salvarEnderecoPerfil = useCallback(
    async (novoTipoEntrega: TipoEntrega, novoEndereco: Endereco): Promise<boolean> => {
      // Sem login ainda: não existe perfil no servidor pra sincronizar —
      // fica só no localStorage deste dispositivo (mesmo efeito prático).
      // Assim que o cliente logar, o perfil passa a ser salvo de verdade
      // (aqui mesmo ou automaticamente ao concluir um pedido, em criarPedido).
      if (!user) {
        tipoEntregaRestauradoLocalRef.current = true;
        enderecoRestauradoLocalRef.current = true;
        setTipoEntrega(novoTipoEntrega);
        setEndereco(novoEndereco);
        return true;
      }

      setSalvandoEndereco(true);
      try {
        const salvar = httpsCallable<
          { tipoEntrega: TipoEntrega; endereco: Endereco | null },
          { ok: true }
        >(functions, "salvarEnderecoCliente");
        await salvar({
          tipoEntrega: novoTipoEntrega,
          endereco: novoTipoEntrega === "delivery" ? novoEndereco : null,
        });
        tipoEntregaRestauradoLocalRef.current = true;
        enderecoRestauradoLocalRef.current = true;
        setTipoEntrega(novoTipoEntrega);
        setEndereco(novoEndereco);
        return true;
      } catch {
        return false;
      } finally {
        setSalvandoEndereco(false);
      }
    },
    [user]
  );

  // Endereços nomeados da tela de perfil — lista independente do
  // enderecoSalvo singular acima (ver comentário em EnderecoSalvo).
  const salvarEnderecoNomeado = useCallback(
    async (dados: Omit<EnderecoSalvo, "id"> & { id?: string }): Promise<boolean> => {
      if (!user) return false;
      setSalvandoEnderecoNomeado(true);
      try {
        const salvar = httpsCallable<typeof dados, { ok: true; endereco: EnderecoSalvo }>(
          functions,
          "salvarEndereco"
        );
        const resultado = await salvar(dados);
        setEnderecosSalvos((atuais) => {
          const idx = atuais.findIndex((e) => e.id === resultado.data.endereco.id);
          if (idx >= 0) {
            const copia = [...atuais];
            copia[idx] = resultado.data.endereco;
            return copia;
          }
          return [...atuais, resultado.data.endereco];
        });
        return true;
      } catch (err) {
        console.error("Erro ao salvar endereço:", err);
        return false;
      } finally {
        setSalvandoEnderecoNomeado(false);
      }
    },
    [user]
  );

  const removerEnderecoNomeado = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;
      setSalvandoEnderecoNomeado(true);
      try {
        const remover = httpsCallable<{ id: string }, { ok: true }>(functions, "removerEndereco");
        await remover({ id });
        setEnderecosSalvos((atuais) => atuais.filter((e) => e.id !== id));
        return true;
      } catch (err) {
        console.error("Erro ao remover endereço:", err);
        return false;
      } finally {
        setSalvandoEnderecoNomeado(false);
      }
    },
    [user]
  );

  // Histórico de pedidos — carregado sob demanda (tela /pedidos), não junto
  // do "último pedido" (que já é eager pro card do cardápio). Mesma regra de
  // leitura (clienteUid == uid) já usada ali, só que sem limit(1).
  const carregarHistoricoPedidos = useCallback(async () => {
    if (!user || historicoPedidosCarregado.current === user.uid) return;
    historicoPedidosCarregado.current = user.uid;
    setHistoricoPedidosCarregando(true);
    setHistoricoPedidosErro(false);
    try {
      const q = query(
        collection(db, "pedidos"),
        where("clienteUid", "==", user.uid),
        orderBy("criadoEmTimestamp", "desc"),
        limit(20)
      );
      const snap = await comRetentativa(() => getDocs(q));
      setHistoricoPedidos(
        snap.docs.map((d) => {
          const dados = d.data();
          const totalItens = Array.isArray(dados.quantidade_item)
            ? dados.quantidade_item.reduce((soma: number, q: number) => soma + (Number(q) || 0), 0)
            : 0;
          return {
            orderId: d.id,
            status: typeof dados.status === "number" ? dados.status : null,
            dataVenda: dados.data_venda ?? null,
            tipoEntrega: dados.tipo_entrega === "delivery" ? "delivery" : dados.tipo_entrega === "retirada" ? "retirada" : null,
            valorVenda: Number(dados.valor_venda) || 0,
            totalItensTexto: totalItens === 1 ? "1 item" : `${totalItens} itens`,
          };
        })
      );
    } catch (err) {
      console.error("Erro ao carregar histórico de pedidos:", err);
      historicoPedidosCarregado.current = null; // permite tentar de novo
      // Sem isso a tela mostrava "Nenhum pedido ainda" quando na verdade
      // só a internet tinha falhado.
      setHistoricoPedidosErro(true);
    } finally {
      setHistoricoPedidosCarregando(false);
    }
  }, [user]);

  // Tempo médio de preparo do pedido — soma o tempo de CADA item distinto no
  // carrinho (não multiplica pela quantidade: a cozinha prepara em paralelo,
  // não item por item), usando o tempo próprio do produto ou o padrão geral
  // quando ele não tem um definido. Item removido do cardápio não conta mais.
  const tempoPreparoTotal = useMemo(() => {
    return Object.entries(quantidades).reduce((soma, [produtoId, quantidade]) => {
      const produto = produtos.find((p) => p.id === produtoId);
      if (!produto) return soma;
      const tempo = produto.tempoPreparoMinutos ?? tempoPreparoPadraoMinutos;
      // Até TAMANHO_LOTE_PREPARO unidades do mesmo item = um lote só, sem
      // somar tempo extra (mesma regra de functions/src/cliente/pedidos.js,
      // calcularTempoPreparoMinutos — os dois precisam concordar, senão o
      // horário que aparece disponível aqui pode ser rejeitado no servidor
      // na hora de finalizar).
      const lotes = Math.max(1, Math.ceil(quantidade / TAMANHO_LOTE_PREPARO));
      return soma + tempo * lotes;
    }, 0);
  }, [quantidades, produtos, tempoPreparoPadraoMinutos]);

  // Antecedência mínima de agendamento: tempo de preparo sempre conta (vale
  // pra retirada também — a comida precisa estar pronta), mais o tempo de
  // moto até o bairro quando é delivery com bairro já escolhido. Ex.: 30min
  // de entrega + 10min de preparo = primeiro horário só daqui 40min.
  const antecedenciaMinutos =
    tempoPreparoTotal +
    (tipoEntrega === "delivery" && endereco.bairro.trim() ? tempoEntregaMinutos : 0) +
    MARGEM_PREENCHIMENTO_MINUTOS;

  // "Agora" que só existe pra forçar o recálculo dos slots de tempos em
  // tempos (ver useEffect abaixo) — sem isso, a lista é calculada UMA vez
  // quando o cliente chega nessa tela e nunca mais, então o primeiro horário
  // (que era válido há 10min) pode ter deixado de valer só pelo tempo que
  // ele levou preenchendo o resto do checkout, e isso só apareceria como um
  // erro do servidor na hora de finalizar — feio e tarde demais.
  const [agoraTick, setAgoraTick] = useState(0);
  useEffect(() => {
    const intervalo = setInterval(() => setAgoraTick((t) => t + 1), 60000);
    return () => clearInterval(intervalo);
  }, []);

  // Slots agendáveis pro tipo de entrega atual — só uma prévia (ver
  // gerarSlotsAgendamento acima); recalcula quando o horário carrega, o
  // cliente troca entre delivery/retirada, a antecedência do bairro muda, ou
  // 1x por minuto só pelo tempo real ter passado (agoraTick).
  const slotsDisponiveis = useMemo(() => {
    if (!horarioFuncionamento) return [];
    return gerarSlotsAgendamento(horarioFuncionamento, tipoEntrega, antecedenciaMinutos);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- agoraTick não é lido aqui dentro, só força recalcular com o relógio atual (gerarSlotsAgendamento sempre lê "new Date()" na hora que roda)
  }, [horarioFuncionamento, tipoEntrega, antecedenciaMinutos, agoraTick]);

  // Se o horário escolhido saiu da lista (cliente mudou delivery/retirada, OU
  // o tempo passou e ele deixou de ter antecedência suficiente), avisa e
  // limpa a seleção — melhor descobrir aqui, ainda na tela, do que só no
  // erro do servidor ao tentar finalizar.
  const [horarioExpirou, setHorarioExpirou] = useState(false);
  useEffect(() => {
    if (agendamento === null) return;
    const aindaValido = slotsDisponiveis.some(
      (s) => s.data === agendamento.data && s.hora === agendamento.hora
    );
    if (!aindaValido) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset legítimo em resposta à lista de slots (entrada externa vinda do horário carregado/tipoEntrega/relógio), não um cálculo derivável no render.
      setAgendamento(null);
      setHorarioExpirou(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à lista de slots, não à identidade do agendamento já escolhido
  }, [slotsDisponiveis]);

  const definirAgendamento = useCallback((slot: SlotAgendamento) => {
    setHorarioExpirou(false);
    setAgendamento(slot);
  }, []);

  // Restaura o carrinho salvo só no cliente, depois do mount (localStorage
  // não existe no SSR, e ler antes do mount causaria mismatch de hidratação
  // entre o HTML renderizado no servidor e o estado restaurado no cliente).
  // Importante: só o CÓDIGO do cupom é restaurado — nunca o resultado da
  // validação. O desconto é sempre revalidado contra o servidor a seguir.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_STORAGE);
      if (salvo) {
        const estado = JSON.parse(salvo) as Partial<EstadoPersistido>;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação única de um storage externo (localStorage), sem API de assinatura pra "subscrever" essa leitura.
        setQuantidades(estado.quantidades ?? {});
        setObservacoes(estado.observacoes ?? "");
        setCupomCodigo(estado.cupomCodigo ?? "");
        setTipoEntrega(estado.tipoEntrega ?? "retirada");
        setEndereco(estado.endereco ?? ENDERECO_VAZIO);
        if (estado.tipoEntrega) tipoEntregaRestauradoLocalRef.current = true;
        if (estado.endereco?.bairro) enderecoRestauradoLocalRef.current = true;
      }
    } catch {
      // localStorage indisponível/corrompido — carrinho começa vazio, sem quebrar a página.
    }
    setCarrinhoRestaurado(true);
  }, []);

  // Só grava depois de restaurar: antes, o primeiro render (ainda vazio)
  // sobrescrevia o carrinho salvo, e no modo estrito do React (efeitos rodam
  // duas vezes) a segunda leitura já encontrava o carrinho vazio.
  // try/catch: Safari em aba privada / armazenamento cheio lança exceção no
  // setItem, o que antes derrubava a página inteira.
  useEffect(() => {
    if (!carrinhoRestaurado) return;
    const estado: EstadoPersistido = { quantidades, observacoes, cupomCodigo, tipoEntrega, endereco };
    try {
      window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado));
    } catch {
      // Sem storage: o carrinho continua funcionando em memória nesta aba.
    }
  }, [carrinhoRestaurado, quantidades, observacoes, cupomCodigo, tipoEntrega, endereco]);

  const definirQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setQuantidades((atual) => {
      if (quantidade <= 0) {
        const copia = { ...atual };
        delete copia[produtoId];
        return copia;
      }
      return { ...atual, [produtoId]: Math.min(Math.trunc(quantidade), 100) };
    });
  }, []);

  // Recarrega no carrinho os mesmos itens do último pedido (por produtoId,
  // já que nome/preço podem ter mudado) — pula quem não existe mais ou saiu
  // do cardápio (useProdutos já só traz produtos com disponivel==true).
  const repetirUltimoPedido = useCallback((): { adicionados: number; indisponiveis: number } => {
    if (!ultimoPedido) return { adicionados: 0, indisponiveis: 0 };
    let adicionados = 0;
    let indisponiveis = 0;
    ultimoPedido.produtoIdItem.forEach((produtoId, i) => {
      const produto = produtos.find((p) => p.id === produtoId);
      const quantidade = ultimoPedido.quantidadeItem[i] ?? 1;
      if (produto && !produto.esgotado && !produto.itemSistema && quantidade > 0) {
        definirQuantidade(produtoId, quantidade);
        adicionados++;
      } else {
        indisponiveis++;
      }
    });
    return { adicionados, indisponiveis };
  }, [ultimoPedido, produtos, definirQuantidade]);

  const ultimoPedidoNaoEntregue =
    ultimoPedido?.status != null && STATUS_PEDIDO_NAO_ENTREGUE.has(ultimoPedido.status);

  const adicionar = useCallback((produtoId: string) => {
    // Esgotado não entra no carrinho por nenhum caminho (cardápio, botão +
    // no carrinho), não só pela ausência do botão na tela.
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto?.esgotado || produto?.itemSistema) return;
    setQuantidades((atual) => ({
      ...atual,
      [produtoId]: Math.min((atual[produtoId] ?? 0) + 1, 100),
    }));
  }, [produtos]);

  const remover = useCallback((produtoId: string) => {
    setQuantidades((atual) => {
      const quantidadeAtual = atual[produtoId] ?? 0;
      if (quantidadeAtual <= 1) {
        const copia = { ...atual };
        delete copia[produtoId];
        return copia;
      }
      return { ...atual, [produtoId]: quantidadeAtual - 1 };
    });
  }, []);

  const limparCarrinho = useCallback(() => {
    setQuantidades({});
    setObservacoes("");
    setCupomCodigo("");
    setCupomAplicado(null);
    setCupomErro(null);
  }, []);

  const definirEndereco = useCallback((campo: keyof Endereco, valor: string) => {
    setEndereco((atual) => ({ ...atual, [campo]: valor }));
  }, []);

  const itens = useMemo<ItemCarrinho[]>(() => {
    return Object.entries(quantidades)
      .map(([produtoId, quantidade]) => {
        const produto = produtos.find((p) => p.id === produtoId);
        // Item de sistema (ex.: "Agendar fritura", preço 0) tem fluxo
        // próprio e nunca é vendido pelo carrinho.
        return produto && !produto.itemSistema ? { produto, quantidade } : null;
      })
      .filter((item): item is ItemCarrinho => item !== null);
  }, [quantidades, produtos]);

  const itensEsgotados = useMemo(() => itens.filter((item) => item.produto.esgotado), [itens]);

  const removerEsgotados = useCallback(() => {
    setQuantidades((atual) => {
      const copia = { ...atual };
      for (const item of itensEsgotados) delete copia[item.produto.id];
      return copia;
    });
  }, [itensEsgotados]);

  const totalItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
  const subtotal = itens.reduce((soma, item) => soma + item.quantidade * item.produto.preco, 0);

  // O desconto exibido é sempre recalculado a partir de tipo/valor que
  // vieram do servidor (nunca inventado no cliente) — só a MULTIPLICAÇÃO
  // pelo subtotal atual acontece aqui, o que é seguro porque tipo/valor já
  // foram validados. Limitado ao subtotal pra nunca dar total negativo.
  const desconto = cupomAplicado
    ? Math.min(
        cupomAplicado.tipo === "fixo" ? cupomAplicado.valor : (subtotal * cupomAplicado.valor) / 100,
        subtotal
      )
    : 0;
  // Taxa de entrega exibida é sempre uma PRÉVIA vinda de consultarTaxaEntrega
  // (nunca calculada no cliente) — o valor que realmente vale é o que
  // criarPedido recalcula e grava no pedido.
  const totalAntesTaxaCartao = subtotal - desconto + (tipoEntrega === "delivery" ? taxaEntrega : 0);
  // Mesma fórmula de criarPedido (services/pagamento.js) — PIX nunca tem
  // taxa; débito/crédito somam um % configurado no painel (Geral).
  const percentualTaxaCartao =
    formaPagamento === "debito" ? taxaDebitoPercentual : formaPagamento === "credito" ? taxaCreditoPercentual : 0;
  const taxaCartao = percentualTaxaCartao > 0 ? Math.round(totalAntesTaxaCartao * percentualTaxaCartao) / 100 : 0;
  const total = totalAntesTaxaCartao + taxaCartao;

  // Mesma regra do servidor (cliente/pedidos.js) — mínimo incide só sobre
  // itens com desconto, sem contar a taxa de entrega. Usado pra avisar o
  // cliente ANTES de tentar finalizar (o servidor sempre valida de novo).
  const faltaParaValorMinimo =
    tipoEntrega === "delivery" && valorMinimoEntrega > 0
      ? Math.max(0, valorMinimoEntrega - (subtotal - desconto))
      : 0;

  const aplicarCupom = useCallback(async () => {
    const codigo = cupomCodigo.trim().toUpperCase();
    if (!codigo) return;

    setCupomValidando(true);
    setCupomErro(null);
    try {
      const validar = httpsCallable<{ codigo: string; subtotal: number }, { tipo: "fixo" | "percentual"; valor: number }>(
        functions,
        "validarCupom"
      );
      const resultado = await validar({ codigo, subtotal });
      setCupomAplicado({ codigo, tipo: resultado.data.tipo, valor: resultado.data.valor });
    } catch (err) {
      setCupomAplicado(null);
      const mensagem =
        err instanceof FunctionsError ? err.message : "Não foi possível validar o cupom. Tente novamente.";
      setCupomErro(mensagem);
    } finally {
      setCupomValidando(false);
    }
  }, [cupomCodigo, subtotal]);

  const removerCupom = useCallback(() => {
    setCupomAplicado(null);
    setCupomErro(null);
    setCupomCodigo("");
  }, []);

  // Revalida automaticamente um código restaurado do localStorage, uma vez,
  // assim que os produtos (e o subtotal que depende deles) estiverem prontos.
  useEffect(() => {
    if (revalidacaoAutomaticaFeita.current) return;
    if (produtosLoading) return;
    if (!cupomCodigo || itens.length === 0) return;
    revalidacaoAutomaticaFeita.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- revalida (assíncrono) um cupom restaurado do localStorage; o setState real acontece dentro do .then/catch de aplicarCupom, não sincronamente aqui.
    aplicarCupom();
    // aplicarCupom muda a cada render (depende de subtotal) — só quer disparar
    // quando os produtos terminam de carregar, não a cada recomputo dela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosLoading, cupomCodigo, itens.length]);

  const definirCupomCodigo = useCallback((texto: string) => {
    setCupomCodigo(texto);
    setCupomErro(null);
  }, []);

  // Busca a lista de bairros cadastrados uma vez, só quando o cliente
  // realmente escolhe delivery — alimenta o autocomplete do campo de
  // bairro. Não é dado sensível (diferente de cupom), só nomes.
  const precisaBairros = tipoEntrega === "delivery";
  useEffect(() => {
    if (!precisaBairros || bairrosCarregados.current) return;
    const listar = httpsCallable<Record<string, never>, { bairros: string[] }>(functions, "listarBairrosEntrega", {
      timeout: TIMEOUT_CONSULTA_MS,
    });
    return carregarComInsistencia(
      () => listar({}),
      (resultado) => {
        bairrosCarregados.current = true;
        setBairrosEntrega(resultado.data.bairros);
      },
      (err) => {
        // Falha ao listar não impede o checkout — o campo só fica sem sugestões.
        console.error("listarBairrosEntrega falhou:", err);
      }
    );
  }, [precisaBairros]);

  // Depois que um pedido é confirmado (agora ou recuperado de uma tentativa
  // anterior), a próxima finalização é uma compra nova: troca a chave e limpa
  // o carrinho (mas não nome/cpf/endereço, úteis pro próximo pedido). O
  // horário escolhido também não é levado pro próximo pedido.
  const concluirCheckout = useCallback(() => {
    limparCheckoutPendente();
    checkoutPendenteRef.current = null;
    setQuantidades({});
    setObservacoes("");
    setCupomCodigo("");
    setCupomAplicado(null);
    setAgendamento(null);
    setHorarioExpirou(false);
  }, []);

  const consultarCheckout = useCallback(async (idempotencyKey: string) => {
    const consultar = httpsCallable<
      { idempotencyKey: string },
      { estado: string; resultado?: ResultadoCheckout; pedidoId?: string | null }
    >(functions, "consultarCheckoutPedido", { timeout: TIMEOUT_CONSULTA_MS });
    const status = await comRetentativa(() => consultar({ idempotencyKey }));
    return status.data;
  }, []);

  // Ao abrir o app (ou entrar na conta), confere se ficou alguma tentativa
  // de pedido sem resposta — ex.: a internet caiu bem na hora de finalizar e
  // a pessoa recarregou a página. Se o pedido chegou a ser criado, avisa e
  // leva pra ele, em vez de deixar o carrinho cheio e a pessoa pedir de novo.
  const recuperacaoFeitaParaUid = useRef<string | null>(null);
  const quantidadesRef = useRef(quantidades);
  useEffect(() => {
    quantidadesRef.current = quantidades;
  }, [quantidades]);
  useEffect(() => {
    if (!user || !carrinhoRestaurado) return;
    if (recuperacaoFeitaParaUid.current === user.uid) return;
    recuperacaoFeitaParaUid.current = user.uid;
    const tentativa = lerCheckoutPendente(user.uid);
    if (!tentativa) return;
    consultarCheckout(tentativa.idempotencyKey)
      .then((dados) => {
        // Uma finalização em andamento cuida da própria tentativa.
        if (finalizandoRef.current) return;
        // "recuperando_pix": o pedido já existe, só o QR ainda está sendo
        // gerado pelo servidor — também conta como pedido feito.
        const orderIdRecuperado =
          dados.estado === "concluido"
            ? dados.resultado?.orderId
            : dados.estado === "recuperando_pix"
              ? dados.pedidoId
              : null;
        if (orderIdRecuperado) {
          // Só esvazia o carrinho se ele ainda for o mesmo do pedido criado
          // — se a pessoa já mexeu nos itens, mantém o que ela montou.
          const itensPendentes = tentativa.payload.itens;
          const atuais = quantidadesRef.current;
          const mesmoCarrinho =
            itensPendentes.length === Object.keys(atuais).length &&
            itensPendentes.every((item) => atuais[item.produtoId] === item.quantidade);
          if (mesmoCarrinho) {
            concluirCheckout();
          } else {
            limparCheckoutPendente();
            checkoutPendenteRef.current = null;
          }
          setPedidoRecuperado(orderIdRecuperado);
        } else if (dados.estado === "falhou" || dados.estado === "nao_encontrado") {
          limparCheckoutPendente();
          checkoutPendenteRef.current = null;
        }
        // Outro estado (ainda processando): mantém a tentativa — o próximo
        // "Finalizar" reenvia com a mesma chave e recebe o mesmo pedido.
      })
      .catch(() => {
        // Sem rede agora: a tentativa continua salva e é conferida no próximo
        // "Finalizar" (ou na próxima vez que o app abrir).
        if (recuperacaoFeitaParaUid.current === user.uid) recuperacaoFeitaParaUid.current = null;
      });
  }, [user, carrinhoRestaurado, consultarCheckout, concluirCheckout]);

  const descartarPedidoRecuperado = useCallback(() => setPedidoRecuperado(null), []);

  const finalizarPedido = useCallback(async () => {
    if (!user || !formaPagamento || itens.length === 0 || !agendamento) return null;
    if (itensEsgotados.length > 0) {
      setErroFinalizar(
        `${itensEsgotados.map((item) => item.produto.nome).join(", ")} ${
          itensEsgotados.length === 1 ? "esgotou" : "esgotaram"
        }. Remova do carrinho para finalizar.`
      );
      return null;
    }
    if (tipoEntrega === "delivery" && (taxaEntregaCarregando || taxaEntregaErro || !endereco.bairro.trim())) {
      setErroFinalizar(taxaEntregaErro || "Aguarde o cálculo do frete antes de confirmar o pedido.");
      return null;
    }
    // Trava de reentrância: se uma chamada anterior ainda está em voo (ex.:
    // duplo toque mais rápido que o React re-renderizar o botão disabled),
    // essa segunda chamada nem sai do lugar — sem isso, a única proteção
    // seria o atributo `disabled` na UI, que é fácil de escapar.
    if (finalizandoRef.current) return null;
    finalizandoRef.current = true;

    setFinalizando(true);
    setErroFinalizar(null);
    try {
      const payloadAtual: PayloadCheckout = {
        itens: itens.map((item) => ({ produtoId: item.produto.id, quantidade: item.quantidade })),
        observacoes,
        cupomCodigo: cupomAplicado?.codigo ?? null,
        formaPagamento,
        nome,
        cpf,
        tipoEntrega,
        endereco: tipoEntrega === "delivery" ? endereco : null,
        agendamento: { data: agendamento.data, hora: agendamento.hora },
      };

      // Antes de iniciar outra venda, resolve qualquer envio anterior cuja
      // resposta possa ter se perdido. A tentativa persistida guarda a mesma
      // chave e o mesmo conteúdo mesmo após fechar ou recarregar o navegador.
      let tentativa =
        checkoutPendenteRef.current ??
        lerCheckoutPendente(user.uid);

      // true quando a tentativa pendente tem outro conteúdo (a pessoa mexeu
      // no carrinho depois de uma falha). Ela ainda é reenviada como está —
      // é o que o servidor tem registrado e é o único jeito de resolvê-la —,
      // mas o resultado não é tratado como o pedido do carrinho atual.
      let tentativaAntiga = false;

      if (tentativa) {
        const status = await consultarCheckout(tentativa.idempotencyKey);
        if (status.estado === "concluido" && status.resultado?.orderId) {
          concluirCheckout();
          return { orderId: status.resultado.orderId };
        }
        if (status.estado === "recuperando_pix" && status.pedidoId) {
          // Pedido já criado, só o QR do PIX ainda está sendo gerado pelo
          // servidor: leva pra tela do pedido, que mostra "Gerando o código
          // PIX..." e atualiza sozinha. Se o carrinho mudou desde então, só
          // avisa e mantém o carrinho atual.
          if (JSON.stringify(tentativa.payload) !== JSON.stringify(payloadAtual)) {
            limparCheckoutPendente();
            checkoutPendenteRef.current = null;
            setPedidoRecuperado(status.pedidoId);
            setErroFinalizar(MENSAGEM_PEDIDO_ANTERIOR);
            return null;
          }
          concluirCheckout();
          return { orderId: status.pedidoId };
        }
        if (status.estado === "falhou" || status.estado === "nao_encontrado") {
          limparCheckoutPendente();
          checkoutPendenteRef.current = null;
          tentativa = null;
        } else {
          tentativaAntiga = JSON.stringify(tentativa.payload) !== JSON.stringify(payloadAtual);
        }
      }

      if (!tentativa) {
        tentativa = {
          idempotencyKey: crypto.randomUUID(),
          uid: user.uid,
          criadoEm: Date.now(),
          payload: payloadAtual,
        };
        checkoutPendenteRef.current = tentativa;
        salvarCheckoutPendente(tentativa);
      }

      const chamar = httpsCallable<
        PayloadCheckout & { idempotencyKey: string },
        ResultadoCheckout
      >(functions, "criarPedido", { timeout: TIMEOUT_CRIAR_PEDIDO_MS });

      let resultado: Awaited<ReturnType<typeof chamar>> | null = null;
      let ultimoErro: unknown = null;
      const esperas = [0, 1500, 3500];
      for (let indice = 0; indice < esperas.length; indice += 1) {
        if (esperas[indice] > 0) await esperar(esperas[indice]);
        try {
          resultado = await chamar({
            ...tentativa.payload,
            idempotencyKey: tentativa.idempotencyKey,
          });
          break;
        } catch (erroEnvio) {
          ultimoErro = erroEnvio;
          const codigo = codigoFunctions(erroEnvio);
          if (!CODIGOS_TRANSITORIOS.has(codigo)) break;
        }
      }
      if (!resultado) {
        // O pedido pode já existir com o PIX ainda sendo gerado (o servidor
        // responde "unavailable" nesse caso). Em vez de só mostrar erro e
        // deixar o carrinho cheio, confere e leva pro pedido.
        try {
          const status = await consultarCheckout(tentativa.idempotencyKey);
          if (status.estado === "recuperando_pix" && status.pedidoId && !tentativaAntiga) {
            concluirCheckout();
            return { orderId: status.pedidoId };
          }
        } catch {
          // Sem resposta: segue com o erro original abaixo.
        }
        throw ultimoErro;
      }

      if (tentativaAntiga) {
        // Confirmou o pedido da tentativa anterior (com os itens de antes):
        // avisa e deixa o carrinho atual intacto para a pessoa decidir.
        limparCheckoutPendente();
        checkoutPendenteRef.current = null;
        setPedidoRecuperado(resultado.data.orderId);
        setErroFinalizar(MENSAGEM_PEDIDO_ANTERIOR);
        return null;
      }

      concluirCheckout();
      return { orderId: resultado.data.orderId };
    } catch (err) {
      setErroFinalizar(mensagemFalhaCheckout(err, !navigator.onLine));
      return null;
    } finally {
      setFinalizando(false);
      finalizandoRef.current = false;
    }
  }, [user, formaPagamento, itens, observacoes, cupomAplicado, nome, cpf, tipoEntrega, endereco, agendamento, taxaEntregaCarregando, taxaEntregaErro, itensEsgotados, consultarCheckout, concluirCheckout]);

  const quantidadeItensSalvos = Object.keys(quantidades).length;

  // Memoizado: sem isso, o objeto era recriado em TODO render do provider
  // (que envolve o app inteiro em layout.tsx) — qualquer estado mudando em
  // QUALQUER lugar (ex.: digitar em observações, o debounce do CEP, o
  // agendamento expirando) re-renderizava todo mundo que usa useCarrinho(),
  // desde a lista de produtos do cardápio até os botões de WhatsApp/localização.
  const value: CarrinhoContextValue = useMemo(
    () => ({
      produtos,
      produtosLoading,
      produtosErro,
      carrinhoRestaurado,
      quantidadeItensSalvos,
      pedidoRecuperado,
      descartarPedidoRecuperado,
      itens,
      itensEsgotados,
      removerEsgotados,
      totalItens,
      subtotal,
      desconto,
      total,
      taxaCartao,
      taxaDebitoPercentual,
      taxaCreditoPercentual,
      whatsappLoja,
      valorMinimoEntrega,
      faltaParaValorMinimo,
      enderecoLojaTexto,
      enderecoLojaLink,
      tipoEntrega,
      definirTipoEntrega: setTipoEntrega,
      endereco,
      definirEndereco,
      taxaEntrega,
      taxaEntregaCarregando,
      taxaEntregaErro,
      recalcularTaxaEntrega,
      bairrosEntrega,
      horarioFuncionamento,
      horarioCarregando,
      horarioErro,
      slotsDisponiveis,
      agendamento,
      definirAgendamento,
      horarioExpirou,
      antecedenciaMinutos,
      ordemCategorias,
      descricoesCategorias,
      ultimoPedido,
      ultimoPedidoCarregando,
      ultimoPedidoNaoEntregue,
      repetirUltimoPedido,
      salvandoEndereco,
      salvarEnderecoPerfil,
      enderecosSalvos,
      salvandoEnderecoNomeado,
      salvarEnderecoNomeado,
      removerEnderecoNomeado,
      historicoPedidos,
      historicoPedidosCarregando,
      historicoPedidosErro,
      carregarHistoricoPedidos,
      adicionar,
      remover,
      definirQuantidade,
      limparCarrinho,
      observacoes,
      definirObservacoes: setObservacoes,
      cupomCodigo,
      definirCupomCodigo,
      cupomAplicado,
      cupomValidando,
      cupomErro,
      aplicarCupom,
      removerCupom,
      nome,
      definirNome,
      cpf,
      definirCpf: setCpf,
      formaPagamento,
      definirFormaPagamento: setFormaPagamento,
      finalizando,
      erroFinalizar,
      finalizarPedido,
    }),
    [
      produtos,
      produtosLoading,
      produtosErro,
      carrinhoRestaurado,
      quantidadeItensSalvos,
      pedidoRecuperado,
      descartarPedidoRecuperado,
      itens,
      itensEsgotados,
      removerEsgotados,
      totalItens,
      subtotal,
      desconto,
      total,
      taxaCartao,
      taxaDebitoPercentual,
      taxaCreditoPercentual,
      whatsappLoja,
      valorMinimoEntrega,
      faltaParaValorMinimo,
      enderecoLojaTexto,
      enderecoLojaLink,
      tipoEntrega,
      endereco,
      definirEndereco,
      taxaEntrega,
      taxaEntregaCarregando,
      taxaEntregaErro,
      recalcularTaxaEntrega,
      bairrosEntrega,
      horarioFuncionamento,
      horarioCarregando,
      horarioErro,
      slotsDisponiveis,
      agendamento,
      definirAgendamento,
      horarioExpirou,
      antecedenciaMinutos,
      ordemCategorias,
      descricoesCategorias,
      ultimoPedido,
      ultimoPedidoCarregando,
      ultimoPedidoNaoEntregue,
      repetirUltimoPedido,
      salvandoEndereco,
      salvarEnderecoPerfil,
      enderecosSalvos,
      salvandoEnderecoNomeado,
      salvarEnderecoNomeado,
      removerEnderecoNomeado,
      historicoPedidos,
      historicoPedidosCarregando,
      historicoPedidosErro,
      carregarHistoricoPedidos,
      adicionar,
      remover,
      definirQuantidade,
      limparCarrinho,
      observacoes,
      cupomCodigo,
      definirCupomCodigo,
      cupomAplicado,
      cupomValidando,
      cupomErro,
      aplicarCupom,
      removerCupom,
      nome,
      definirNome,
      cpf,
      formaPagamento,
      finalizando,
      erroFinalizar,
      finalizarPedido,
    ]
  );

  return <CarrinhoContext.Provider value={value}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const contexto = useContext(CarrinhoContext);
  if (!contexto) {
    throw new Error("useCarrinho precisa ser usado dentro de <CarrinhoProvider>.");
  }
  return contexto;
}
