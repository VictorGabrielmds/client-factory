"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase-client";
import { useAuth } from "../../../hooks/useAuth";
import { STATUS_PEDIDO_NAO_ENTREGUE } from "../../../contexts/CarrinhoContext";
import SolicitarAlteracaoModal from "../../../components/SolicitarAlteracaoModal";
import BotaoLocalizacao from "../../../components/BotaoLocalizacao";

interface PedidoStatus {
  status: number;
  tipo_entrega?: "delivery" | "retirada";
  nome_destinatario: string;
  valor_itens: number;
  valor_desconto: number;
  valor_taxa: number;
  valor_venda: number;
  descricao_item: string[];
  quantidade_item: number[];
  valor_total_item: number[];
  produto_id_item?: string[];
  forma_pagamento: string[];
  agendamento?: string | null;
  observacoes?: string;
  pix_confirmado?: boolean;
  pix_status?: string;
  pix_qrcode_base64?: string;
  pix_copia_cola?: string;
  cep_destinatario?: string;
  logradouro_destinatario?: string;
  numero_destinatario?: string;
  complemento_destinatario?: string;
  bairro_destinatario?: string;
  referencia?: string;
}

function formatarReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ehDelivery(p: PedidoStatus) {
  if (p.tipo_entrega === "delivery") return true;
  if (p.tipo_entrega === "retirada") return false;
  return !!p.bairro_destinatario || !!p.cep_destinatario || (p.valor_taxa || 0) > 0;
}

// Mesmo formato "Dia DD/MM - HH:MM" gravado por criarPedido (ver
// formatarAgendamento em factory-dashboard/functions/src/services/horario.js).
// O navegador do cliente já roda no fuso dele (Brasil), então não precisa da
// mesma ginástica de fuso horário que o lado servidor faz.
function horarioAgendadoAindaNoFuturo(agendamentoTexto?: string | null): string | null {
  if (!agendamentoTexto) return null;
  const match = agendamentoTexto.match(/Dia (\d{2})\/(\d{2}) - (\d{2}):(\d{2})/);
  if (!match) return null;

  const [, diaStr, mesStr, horaStr, minStr] = match;
  const agora = new Date();
  let ano = agora.getFullYear();
  const mes = parseInt(mesStr, 10) - 1;
  if (agora.getMonth() === 11 && mes === 0) ano += 1;

  const alvo = new Date(ano, mes, parseInt(diaStr, 10), parseInt(horaStr, 10), parseInt(minStr, 10));
  return alvo.getTime() > agora.getTime() ? `${horaStr}:${minStr}` : null;
}

// Mesmos rótulos de STATUS_LABELS em factory-dashboard/functions/src/services/pedidos.js
// — texto igual ao que a pessoa já recebe no WhatsApp, só que também aqui.
function passosStatus(delivery: boolean) {
  return delivery
    ? [
        { status: 1, label: "Recebido" },
        { status: 2, label: "Em preparo" },
        { status: 3, label: "Saiu para entrega" },
        { status: 5, label: "Em rota de entrega" },
      ]
    : [
        { status: 1, label: "Recebido" },
        { status: 2, label: "Em preparo" },
        { status: 3, label: "Pronto para retirada" },
      ];
}

export default function PedidoPage() {
  const params = useParams<{ orderId: string }>();
  const { user, loading: authLoading } = useAuth();

  const [pedido, setPedido] = useState<PedidoStatus | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mostrarAlteracao, setMostrarAlteracao] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    const unsubscribe = onSnapshot(
      doc(db, "pedidos", params.orderId),
      (snap) => {
        if (!snap.exists()) {
          setNaoEncontrado(true);
        } else {
          setPedido(snap.data() as PedidoStatus);
        }
        setCarregando(false);
      },
      () => {
        setNaoEncontrado(true);
        setCarregando(false);
      }
    );
    return () => unsubscribe();
  }, [authLoading, user, params.orderId]);

  const copiarCodigo = async () => {
    if (!pedido?.pix_copia_cola) return;
    await navigator.clipboard.writeText(pedido.pix_copia_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const ehPix = pedido?.forma_pagamento?.[0] === "17";
  const pixStatus = String(
    pedido?.pix_status || (pedido?.pix_confirmado ? "RECEIVED" : "PENDING")
  ).toUpperCase();
  const pixEstornado = pixStatus === "REFUNDED";
  const pixEstornoParcial = pixStatus === "PARTIALLY_REFUNDED";
  const pixEstornoEmAndamento = pixStatus === "REFUND_IN_PROGRESS";
  const pixTemEstorno = pixEstornado || pixEstornoParcial || pixEstornoEmAndamento;
  // Viagem com várias paradas: o motoboy pode ter saído bem antes do horário
  // marcado pra esta entrega específica, se tiver parada(s) antes na rota.
  // Nesse caso, avisar a chegada no horário combinado em vez de deixar "em
  // rota de entrega" sozinho parecer "chegando a qualquer momento".
  const horarioAgendado =
    pedido && pedido.status === 5 && ehDelivery(pedido)
      ? horarioAgendadoAindaNoFuturo(pedido.agendamento)
      : null;
  const podeAlterar = !!pedido && STATUS_PEDIDO_NAO_ENTREGUE.has(pedido.status);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-color-primary px-6 py-6 flex items-center gap-4">
        <Link
          href="/cardapio"
          aria-label="Voltar ao cardápio"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        >
          ←
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold tracking-tight text-white">Seu pedido</h1>
          <p className="text-neutral-400 text-xs">#{params.orderId}</p>
        </div>
        {pedido && !ehDelivery(pedido) && <BotaoLocalizacao />}
      </header>

      <main className="w-full max-w-md mx-auto px-4 pt-6 pb-16 flex flex-col gap-6">
        {carregando || authLoading ? (
          <p className="text-blue-600 font-semibold text-center py-16">A carregar...</p>
        ) : naoEncontrado || !pedido ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">Não encontramos esse pedido.</p>
            <Link href="/cardapio" className="text-blue-600 font-semibold hover:underline">
              Voltar ao cardápio
            </Link>
          </div>
        ) : (
          <>
            {ehPix && pixTemEstorno && (
              <div
                className={`rounded-2xl border p-5 ${
                  pixEstornado
                    ? "border-red-100 bg-red-50 text-red-900"
                    : "border-amber-100 bg-amber-50 text-amber-900"
                }`}
                role="status"
              >
                <p className="font-bold">
                  {pixEstornado
                    ? "Pagamento PIX estornado"
                    : pixEstornoParcial
                      ? "Pagamento parcialmente estornado"
                      : "Estorno do PIX em andamento"}
                </p>
                <p className="mt-1 text-sm leading-relaxed opacity-75">
                  {pixEstornado
                    ? "O valor foi devolvido. Você não precisa pagar novamente por este QR Code."
                    : "A equipe já recebeu essa atualização e acompanhará o pedido com você."}
                </p>
              </div>
            )}

            {ehPix && !pedido.pix_confirmado && !pixTemEstorno && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 text-center">
                  <h2 className="font-bold text-black mb-1">Pague com PIX</h2>
                  <p className="text-sm text-neutral-500 mb-4">
                    Escaneie o QR code ou copie o código abaixo no app do seu banco.
                  </p>

                  {pedido.pix_qrcode_base64 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${pedido.pix_qrcode_base64}`}
                      alt="QR code PIX"
                      className="w-48 h-48 mx-auto rounded-xl border border-neutral-100"
                    />
                  )}

                  {pedido.pix_copia_cola && (
                    <button
                      onClick={copiarCodigo}
                      className="mt-4 w-full bg-blue-50 text-blue-700 font-semibold text-sm py-3 rounded-xl hover:bg-blue-100 transition break-all"
                    >
                      {copiado ? "Código copiado!" : "Copiar código PIX"}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-neutral-500">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Aguardando confirmação do pagamento...
                </div>
              </>
            )}

            {pedido.status === 4 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-3xl">
                  ×
                </div>
                <h2 className="font-bold text-black text-lg mb-1">Pedido cancelado</h2>
                <p className="text-sm text-neutral-500">Qualquer dúvida, fale com a gente pelo WhatsApp.</p>
              </div>
            ) : (
              !ehPix || pedido.pix_confirmado || pixTemEstorno ? (
                <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
                  <h2 className="text-sm font-semibold text-black mb-4">Status do pedido</h2>
                  <ol className="flex flex-col gap-4">
                    {passosStatus(ehDelivery(pedido)).map((passo, i, arr) => {
                      const indiceAtual = arr.findIndex((p) => p.status === pedido.status);
                      const feito = i < indiceAtual;
                      const atual = i === indiceAtual;
                      return (
                        <li key={passo.status} className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              feito || atual
                                ? "bg-blue-600 text-white"
                                : "bg-neutral-100 text-neutral-400"
                            }`}
                          >
                            {feito ? "✓" : i + 1}
                          </span>
                          <span className={`text-sm ${atual ? "font-bold text-black" : feito ? "text-neutral-700" : "text-neutral-400"}`}>
                            {passo.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  {horarioAgendado && (
                    <p className="mt-4 text-xs text-blue-700 font-medium bg-blue-50 rounded-lg px-3 py-2">
                      🛵 Seu pedido já saiu da fábrica! Ele está numa rota e chegará no horário agendado:{" "}
                      {horarioAgendado}.
                    </p>
                  )}
                </section>
              ) : null
            )}

            <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
              <h2 className="text-sm font-semibold text-black mb-3">Resumo do pedido</h2>
              <ul className="flex flex-col gap-2 mb-3">
                {pedido.descricao_item.map((descricao, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">
                      {pedido.quantidade_item[i]}x {descricao}
                    </span>
                    <span className="text-black font-medium">{formatarReal(pedido.valor_total_item[i])}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1 pt-3 border-t border-neutral-100 text-sm">
                <div className="flex items-center justify-between text-neutral-600">
                  <span>Subtotal</span>
                  <span>{formatarReal(pedido.valor_itens)}</span>
                </div>
                {pedido.valor_desconto > 0 && (
                  <div className="flex items-center justify-between text-green-600 font-medium">
                    <span>Desconto</span>
                    <span>− {formatarReal(pedido.valor_desconto)}</span>
                  </div>
                )}
                {ehDelivery(pedido) && (
                  <div className="flex items-center justify-between text-neutral-600">
                    <span>Taxa de entrega</span>
                    <span>{formatarReal(pedido.valor_taxa)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-lg font-extrabold text-blue-600 pt-2 mt-1 border-t border-neutral-100">
                  <span className="text-sm font-medium text-neutral-500">Total</span>
                  <span>{formatarReal(pedido.valor_venda)}</span>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
              <h2 className="text-sm font-semibold text-black mb-2">
                {ehDelivery(pedido) ? "Endereço de entrega" : "Retirada"}
              </h2>
              {ehDelivery(pedido) ? (
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {pedido.logradouro_destinatario}, {pedido.numero_destinatario}
                  {pedido.complemento_destinatario ? ` — ${pedido.complemento_destinatario}` : ""}
                  <br />
                  {pedido.bairro_destinatario}
                  {pedido.referencia ? ` (${pedido.referencia})` : ""}
                </p>
              ) : (
                <p className="text-sm text-neutral-600">Retirada no balcão.</p>
              )}
              {pedido.observacoes && (
                <p className="text-sm text-neutral-500 mt-3 pt-3 border-t border-neutral-100">
                  <span className="font-medium text-neutral-700">Observações: </span>
                  {pedido.observacoes}
                </p>
              )}
            </section>

            {podeAlterar && (
              <button
                onClick={() => setMostrarAlteracao(true)}
                className="w-full bg-white border border-neutral-200 text-neutral-700 font-bold text-sm py-3 rounded-xl hover:bg-neutral-50 transition"
              >
                Solicitar alteração
              </button>
            )}
          </>
        )}
      </main>

      {podeAlterar && mostrarAlteracao && pedido && (
        <SolicitarAlteracaoModal
          pedido={{
            orderId: params.orderId,
            status: pedido.status,
            tipoEntrega: pedido.tipo_entrega === "delivery" ? "delivery" : "retirada",
            agendamentoTexto: pedido.agendamento ?? null,
            descricaoItem: pedido.descricao_item,
            quantidadeItem: pedido.quantidade_item,
            produtoIdItem: pedido.produto_id_item ?? [],
          }}
          onClose={() => setMostrarAlteracao(false)}
        />
      )}
    </div>
  );
}
