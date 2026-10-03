"use client";

import { useMemo, useRef, useState } from "react";
import type {
  Endereco,
  FormaPagamento,
  ItemCarrinho,
  SlotAgendamento,
  TipoEntrega,
} from "../../contexts/CarrinhoContext";
import { formatarCpfCnpj } from "../../contexts/CarrinhoContext";
import { formatarReal } from "./format";
import { useAuth } from "../../hooks/useAuth";
import LoginSheet from "../LoginSheet";
import QuantidadeInput from "../QuantidadeInput";

function montarOpcoesPagamento(
  taxaDebitoPercentual: number,
  taxaCreditoPercentual: number
): { id: FormaPagamento; label: string; descricao: string }[] {
  return [
    { id: "pix", label: "PIX", descricao: "Pagamento imediato, confirmação automática" },
    {
      id: "debito",
      label: "Débito",
      descricao:
        "Na maquininha, na retirada" + (taxaDebitoPercentual > 0 ? ` · +${taxaDebitoPercentual}%` : ""),
    },
    {
      id: "credito",
      label: "Crédito",
      descricao:
        "Na maquininha, na retirada" + (taxaCreditoPercentual > 0 ? ` · +${taxaCreditoPercentual}%` : ""),
    },
  ];
}

interface PassoResumoProps {
  itens: ItemCarrinho[];
  adicionar: (produtoId: string) => void;
  remover: (produtoId: string) => void;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  observacoes: string;
  definirObservacoes: (texto: string) => void;

  tipoEntrega: TipoEntrega;
  endereco: Endereco;
  onEditarEntrega: () => void;

  subtotal: number;
  desconto: number;
  taxaEntrega: number;
  taxaEntregaCarregando: boolean;
  taxaEntregaErro: string | null;
  recalcularTaxaEntrega: () => void;
  faltaParaValorMinimo: number;
  taxaCartao: number;
  taxaDebitoPercentual: number;
  taxaCreditoPercentual: number;
  total: number;

  cupomCodigo: string;
  definirCupomCodigo: (texto: string) => void;
  cupomAplicado: { codigo: string } | null;
  cupomValidando: boolean;
  cupomErro: string | null;
  aplicarCupom: () => void;
  removerCupom: () => void;

  horarioCarregando: boolean;
  horarioErro: boolean;
  slotsDisponiveis: SlotAgendamento[];
  agendamento: SlotAgendamento | null;
  definirAgendamento: (slot: SlotAgendamento) => void;
  horarioExpirou: boolean;
  antecedenciaMinutos: number;

  nome: string;
  definirNome: (texto: string) => void;
  cpf: string;
  definirCpf: (texto: string) => void;
  formaPagamento: FormaPagamento | null;
  definirFormaPagamento: (forma: FormaPagamento) => void;

  finalizando: boolean;
  erroFinalizar: string | null;
  onFinalizar: () => void;
  onVoltar: () => void;
}

export default function PassoResumo({
  itens,
  adicionar,
  remover,
  definirQuantidade,
  observacoes,
  definirObservacoes,
  tipoEntrega,
  endereco,
  onEditarEntrega,
  subtotal,
  desconto,
  taxaEntrega,
  taxaEntregaCarregando,
  taxaEntregaErro,
  recalcularTaxaEntrega,
  faltaParaValorMinimo,
  taxaCartao,
  taxaDebitoPercentual,
  taxaCreditoPercentual,
  total,
  cupomCodigo,
  definirCupomCodigo,
  cupomAplicado,
  cupomValidando,
  cupomErro,
  aplicarCupom,
  removerCupom,
  horarioCarregando,
  horarioErro,
  slotsDisponiveis,
  agendamento,
  definirAgendamento,
  horarioExpirou,
  antecedenciaMinutos,
  nome,
  definirNome,
  cpf,
  definirCpf,
  formaPagamento,
  definirFormaPagamento,
  finalizando,
  erroFinalizar,
  onFinalizar,
  onVoltar,
}: PassoResumoProps) {
  const { user } = useAuth();
  const opcoesPagamento = useMemo(
    () => montarOpcoesPagamento(taxaDebitoPercentual, taxaCreditoPercentual),
    [taxaDebitoPercentual, taxaCreditoPercentual]
  );
  const [tentouFinalizar, setTentouFinalizar] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mostrarLogin, setMostrarLogin] = useState(false);

  const agendamentoRef = useRef<HTMLDivElement>(null);
  const entregaRef = useRef<HTMLDivElement>(null);
  const nomeRef = useRef<HTMLDivElement>(null);
  const cpfRef = useRef<HTMLDivElement>(null);
  const pagamentoRef = useRef<HTMLDivElement>(null);

  const cpfCnpjDigitos = cpf.replace(/\D/g, "");
  const cpfPreenchido = cpfCnpjDigitos.length > 0;
  const cpfValido = cpfCnpjDigitos.length === 11 || cpfCnpjDigitos.length === 14;
  const freteBloqueando = tipoEntrega === "delivery" && (taxaEntregaCarregando || !!taxaEntregaErro);
  const podeFinalizar =
    !!nome.trim() &&
    !!formaPagamento &&
    (formaPagamento !== "pix" || cpfValido) &&
    (!cpfPreenchido || cpfValido) &&
    faltaParaValorMinimo <= 0 &&
    !!agendamento &&
    !freteBloqueando &&
    !finalizando;

  const localEntrega = useMemo(() => {
    if (tipoEntrega !== "delivery") return "Retirada no balcão";
    const partes = [
      [endereco.logradouro, endereco.numero].filter(Boolean).join(", "),
      endereco.complemento,
      endereco.bairro,
    ].filter(Boolean);
    return partes.join(" — ") || "Endereço não informado";
  }, [tipoEntrega, endereco]);

  const handleSelecionarSlot = (valor: string) => {
    const [data, hora] = valor.split("|");
    const slot = slotsDisponiveis.find((s) => s.data === data && s.hora === hora);
    if (slot) definirAgendamento(slot);
  };

  // Rola até o PRIMEIRO campo inválido (na ordem em que aparecem na tela) e
  // dá um instante pro usuário ver exatamente o que falta, em vez de só um
  // texto vermelho que pode estar fora da área visível.
  const handleFinalizar = () => {
    setTentouFinalizar(true);
    if (!podeFinalizar) {
      const cpfBloqueando = !cpfValido && (formaPagamento === "pix" || cpfPreenchido);
      // O valor mínimo entra aqui junto com o resto: sem isso, um carrinho
      // abaixo do mínimo com todo o resto preenchido travava o botão SEM
      // nenhum feedback — clicar em "Finalizar" não fazia absolutamente nada,
      // porque não havia pra onde rolar.
      const primeiroErro = faltaParaValorMinimo > 0 || freteBloqueando
        ? entregaRef
        : !agendamento
          ? agendamentoRef
          : !nome.trim()
            ? nomeRef
            : cpfBloqueando
              ? cpfRef
              : !formaPagamento
                ? pagamentoRef
                : null;
      primeiroErro?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    // Visitante monta o pedido inteiro sem conta — login só é pedido aqui,
    // no momento de finalizar de verdade (ver page.tsx e LoginSheet.tsx).
    if (!user) {
      setMostrarLogin(true);
      return;
    }
    setConfirmando(true);
  };

  const handleConfirmarPedido = () => {
    if (!podeFinalizar) return;
    setConfirmando(false);
    onFinalizar();
  };

  const agendamentoInvalido = tentouFinalizar && !agendamento && slotsDisponiveis.length > 0;
  const nomeInvalido = tentouFinalizar && !nome.trim();
  const cpfInvalido = tentouFinalizar && !cpfValido && (formaPagamento === "pix" || cpfPreenchido);
  const pagamentoInvalido = tentouFinalizar && !formaPagamento;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-blue-600 uppercase mb-1">Passo 3</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-black">Resumo do pedido</h2>
      </div>

      {/* ITENS — editável direto aqui */}
      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
        <h3 className="text-sm font-semibold text-black mb-3">Itens</h3>
        <div className="flex flex-col gap-3">
          {itens.map(({ produto, quantidade }) => (
            <div key={produto.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm text-neutral-700 truncate">{produto.nome}</span>
              <div className="flex items-center gap-2 bg-neutral-100 rounded-full px-1.5 py-1 shrink-0">
                <button
                  onClick={() => remover(produto.id)}
                  aria-label={`Remover uma unidade de ${produto.nome}`}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-neutral-700 font-bold text-xs shadow-sm hover:bg-neutral-200 transition"
                >
                  −
                </button>
                <QuantidadeInput
                  produtoId={produto.id}
                  produtoNome={produto.nome}
                  quantidade={quantidade}
                  definirQuantidade={definirQuantidade}
                  className="w-10 h-7 text-center text-xs bg-white border border-blue-300 rounded-md font-bold text-black shadow-inner cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => adicionar(produto.id)}
                  aria-label={`Adicionar uma unidade de ${produto.nome}`}
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold text-xs shadow-sm hover:bg-blue-50 transition"
                >
                  +
                </button>
              </div>
              <span className="w-20 text-right text-sm font-semibold text-black shrink-0">
                {formatarReal(produto.preco * quantidade)}
              </span>
            </div>
          ))}
        </div>

        <label htmlFor="observacoes-resumo" className="block text-xs font-medium text-neutral-500 mt-4 mb-1">
          Observações
        </label>
        <textarea
          id="observacoes-resumo"
          rows={2}
          value={observacoes}
          onChange={(e) => definirObservacoes(e.target.value)}
          placeholder="Ex: sem cebola, tocar a campainha..."
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
        />
      </section>

      {/* ENTREGA — resumo com link pra voltar e editar de verdade */}
      <section
        ref={entregaRef}
        className={`bg-white rounded-2xl shadow-sm border p-4 transition-colors ${
          tentouFinalizar && faltaParaValorMinimo > 0 ? "border-amber-300 ring-1 ring-amber-100" : "border-neutral-100"
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-sm font-semibold text-black">
            {tipoEntrega === "delivery" ? "Delivery" : "Retirada"}
          </h3>
          <button
            onClick={onEditarEntrega}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Alterar
          </button>
        </div>
        <p className="text-sm text-neutral-600">{localEntrega}</p>
        {faltaParaValorMinimo > 0 && (
          <p className="text-xs text-amber-700 font-medium bg-amber-50 rounded-lg px-3 py-2 mt-3">
            Falta {formatarReal(faltaParaValorMinimo)} para o valor mínimo de entrega — adicione mais itens ou
            escolha retirada.
          </p>
        )}
      </section>

      {/* AGENDAMENTO */}
      <section
        ref={agendamentoRef}
        className={`bg-white rounded-2xl shadow-sm border p-4 transition-colors ${
          agendamentoInvalido ? "border-red-300 ring-1 ring-red-100" : "border-neutral-100"
        }`}
      >
        <h3 className="text-sm font-semibold text-black mb-3">Quando você quer receber?</h3>
        {horarioExpirou && !agendamento && (
          <p className="text-xs text-amber-700 font-medium bg-amber-50 rounded-lg px-3 py-2 mb-3">
            O horário que você tinha escolhido não vale mais (o tempo passou) — escolha outro.
          </p>
        )}
        {horarioCarregando ? (
          <p className="text-xs text-neutral-400">Carregando horários disponíveis...</p>
        ) : horarioErro && slotsDisponiveis.length === 0 ? (
          <p className="text-xs text-amber-700">
            Não conseguimos carregar os horários (conexão instável). Estamos tentando de novo automaticamente.
          </p>
        ) : slotsDisponiveis.length === 0 ? (
          <p className="text-xs text-amber-600">
            Nenhum horário disponível pra {tipoEntrega === "delivery" ? "delivery" : "retirada"} no momento.
          </p>
        ) : (
          <select
            id="agendamento"
            value={agendamento ? `${agendamento.data}|${agendamento.hora}` : ""}
            onChange={(e) => handleSelecionarSlot(e.target.value)}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              agendamentoInvalido ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <option value="" disabled>
              Selecione um horário
            </option>
            {slotsDisponiveis.map((slot) => (
              <option key={`${slot.data}|${slot.hora}`} value={`${slot.data}|${slot.hora}`}>
                {slot.label}
              </option>
            ))}
          </select>
        )}
        {agendamentoInvalido && (
          <p className="text-xs text-red-600 font-medium mt-1.5">Escolha um horário para o pedido.</p>
        )}
        {antecedenciaMinutos > 0 && (
          <p className="text-xs text-neutral-400 mt-1.5">
            Seu pedido leva cerca de {antecedenciaMinutos} min pra ficar pronto
            {tipoEntrega === "delivery" ? " e chegar até você" : ""} — os horários mais próximos já
            consideram esse tempo.
          </p>
        )}
      </section>

      {/* CUPOM */}
      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
        <h3 className="text-sm font-semibold text-black mb-2">Cupom de desconto</h3>
        {cupomAplicado ? (
          <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-2.5">
            <span className="text-sm font-semibold text-green-700">Cupom {cupomAplicado.codigo} aplicado</span>
            <button onClick={removerCupom} className="text-xs font-semibold text-green-700 hover:underline">
              Remover
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              aplicarCupom();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={cupomCodigo}
              onChange={(e) => definirCupomCodigo(e.target.value.toUpperCase())}
              placeholder="Ex: BEMVINDO10"
              className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-black uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              type="submit"
              disabled={cupomValidando || !cupomCodigo.trim()}
              className="bg-color-primary text-white font-semibold text-sm px-5 rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition"
            >
              {cupomValidando ? "..." : "Aplicar"}
            </button>
          </form>
        )}
        {cupomErro && <p className="text-xs text-red-600 font-medium mt-2">{cupomErro}</p>}
      </section>

      {/* VALORES */}
      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <span>Subtotal</span>
          <span>{formatarReal(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="flex items-center justify-between text-sm text-green-600 font-medium">
            <span>Desconto</span>
            <span>− {formatarReal(desconto)}</span>
          </div>
        )}
        {tipoEntrega === "delivery" && (
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <span>Valor de entrega</span>
            <span>{taxaEntregaCarregando ? "calculando..." : taxaEntregaErro ? "—" : formatarReal(taxaEntrega)}</span>
          </div>
        )}
        {taxaEntregaErro && tipoEntrega === "delivery" && (
          <div role="alert" className="text-xs text-red-600">
            <p>{taxaEntregaErro}</p>
            <button type="button" onClick={recalcularTaxaEntrega} className="mt-2 font-semibold underline underline-offset-2">Calcular frete novamente</button>
          </div>
        )}
        {taxaCartao > 0 && (
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <span>Taxa de {formaPagamento === "credito" ? "crédito" : "débito"}</span>
            <span>{formatarReal(taxaCartao)}</span>
          </div>
        )}
        <div className="flex items-end justify-between pt-3 mt-1 border-t border-neutral-100">
          <span className="text-sm font-medium text-neutral-500">Total</span>
          <span aria-live="polite" className={freteBloqueando ? "text-sm font-medium text-neutral-500" : "text-3xl font-extrabold tracking-tight text-blue-600"}>
            {freteBloqueando ? "Aguardando frete" : formatarReal(total)}
          </span>
        </div>
      </section>

      {/* DADOS + PAGAMENTO */}
      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold text-black mb-3">Seus dados</h3>
          <div className="flex flex-col gap-3">
            <div ref={nomeRef}>
              <label htmlFor="nome" className="block text-xs font-medium text-neutral-500 mb-1">
                Seu nome
              </label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => definirNome(e.target.value)}
                placeholder="Como podemos te chamar?"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  nomeInvalido ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
                }`}
              />
              {nomeInvalido && <p className="text-xs text-red-600 font-medium mt-1.5">Informe seu nome.</p>}
            </div>

            <div ref={cpfRef}>
              <label htmlFor="cpf" className="block text-xs font-medium text-neutral-500 mb-1">
                CPF ou CNPJ na nota {formaPagamento === "pix" ? "(obrigatório para PIX)" : "(opcional)"}
              </label>
              <input
                id="cpf"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => definirCpf(formatarCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  cpfInvalido ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
                }`}
              />
              {cpfInvalido && <p className="text-xs text-red-600 font-medium mt-1.5">CPF ou CNPJ inválido.</p>}
            </div>
          </div>
        </div>

        <div ref={pagamentoRef}>
          <h3 className="text-sm font-semibold text-black mb-3">Forma de pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {opcoesPagamento.map((opcao) => {
              const selecionada = formaPagamento === opcao.id;
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => definirFormaPagamento(opcao.id)}
                  className={`relative rounded-xl border p-3 text-left transition ${
                    selecionada
                      ? "border-black bg-neutral-50 ring-1 ring-black"
                      : pagamentoInvalido
                        ? "border-red-300 bg-red-50"
                        : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
                  }`}
                >
                  {selecionada && (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                  <span className="block font-semibold text-sm text-black">{opcao.label}</span>
                  <span className="block text-[11px] text-neutral-500 mt-0.5 leading-tight">{opcao.descricao}</span>
                </button>
              );
            })}
          </div>
          {pagamentoInvalido && (
            <p className="text-xs text-red-600 font-medium mt-2">Escolha uma forma de pagamento.</p>
          )}
        </div>

        {erroFinalizar && (
          <p role="alert" className="text-sm text-red-600 font-medium bg-red-50 rounded-xl px-4 py-3">{erroFinalizar}</p>
        )}
      </section>

      {/* Barra de ação fixa — Voltar/Finalizar sempre à mão, com o valor
          total bem visível pra reforçar a decisão de compra. */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-neutral-100 px-4 py-3 pointer-events-none">
        <div className="max-w-2xl mx-auto flex gap-3 pointer-events-auto">
          <button
            onClick={onVoltar}
            disabled={finalizando}
            className="shrink-0 bg-white border border-neutral-200 text-neutral-700 font-semibold text-base px-5 py-3.5 rounded-full hover:bg-neutral-50 disabled:opacity-40 transition active:scale-[0.98]"
          >
            Voltar
          </button>
          <button
            onClick={handleFinalizar}
            disabled={finalizando || freteBloqueando}
            aria-busy={finalizando || taxaEntregaCarregando}
            className="flex-1 bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition active:scale-[0.98]"
          >
            {finalizando ? "Finalizando..." : freteBloqueando ? (taxaEntregaCarregando ? "Calculando frete..." : "Frete indisponível") : `Finalizar — ${formatarReal(total)}`}
          </button>
        </div>
      </div>

      {/* Confirmação final — sobe do fundo da tela (mesmo padrão do resumo
          rápido do carrinho) em vez de um alert() nativo do navegador. */}
      {confirmando && agendamento && !freteBloqueando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setConfirmando(false)}
        >
          <div
            className="w-full sm:max-w-2xl bg-white rounded-t-3xl p-6 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-black mb-1">Confirmar pedido</h2>
            <p className="text-sm text-neutral-600 mb-5">
              Você confirma esse pedido para{" "}
              <strong className="text-black">{agendamento.label}</strong>?
            </p>

            <div className="flex items-center justify-between pb-5 mb-5 border-b border-neutral-100">
              <span className="text-sm font-medium text-neutral-500">Total</span>
              <span className="text-2xl font-extrabold tracking-tight text-blue-600">
                {formatarReal(total)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(false)}
                disabled={finalizando}
                className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-semibold text-base py-3.5 rounded-full hover:bg-neutral-50 disabled:opacity-40 transition active:scale-[0.98]"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmarPedido}
                disabled={!podeFinalizar}
                className="flex-[2] bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition active:scale-[0.98]"
              >
                Confirmar pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarLogin && (
        <LoginSheet
          titulo="Quase lá!"
          subtitulo="Informe seu WhatsApp pra confirmar o pedido."
          onClose={() => setMostrarLogin(false)}
          onSuccess={() => setConfirmando(true)}
        />
      )}
    </div>
  );
}
