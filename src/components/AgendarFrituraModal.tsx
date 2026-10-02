"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase-client";
import type { Produto } from "../types/produto";

interface AgendarFrituraModalProps {
  produto: Produto;
  autenticado: boolean;
  onRequestLogin: () => void;
  onClose: () => void;
}

interface ResultadoSolicitacao {
  solicitacaoId: string;
  data: string;
  status: "solicitado";
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function dataParaISO(data: Date) {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatarDataLonga(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function AgendarFrituraModal({
  produto,
  autenticado,
  onRequestLogin,
  onClose,
}: AgendarFrituraModalProps) {
  const hoje = useMemo(() => {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }, []);
  const hojeISO = useMemo(() => dataParaISO(hoje), [hoje]);
  const limite = useMemo(
    () => new Date(hoje.getFullYear(), hoje.getMonth() + 12, hoje.getDate()),
    [hoje],
  );

  const [mesVisivel, setMesVisivel] = useState(
    () => new Date(hoje.getFullYear(), hoje.getMonth(), 1),
  );
  const [dataSelecionada, setDataSelecionada] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState<ResultadoSolicitacao | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !enviando) onClose();
    };
    document.addEventListener("keydown", fecharComEscape);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", fecharComEscape);
      document.body.style.overflow = overflowAnterior;
    };
  }, [enviando, onClose]);

  const diasDoCalendario = useMemo(() => {
    const ano = mesVisivel.getFullYear();
    const mes = mesVisivel.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const quantidadeDias = new Date(ano, mes + 1, 0).getDate();
    const celulas: Array<Date | null> = Array.from({ length: primeiroDia }, () => null);
    for (let dia = 1; dia <= quantidadeDias; dia += 1) {
      celulas.push(new Date(ano, mes, dia));
    }
    while (celulas.length % 7 !== 0) celulas.push(null);
    return celulas;
  }, [mesVisivel]);

  const podeVoltarMes =
    mesVisivel.getFullYear() > hoje.getFullYear() ||
    mesVisivel.getMonth() > hoje.getMonth();
  const podeAvancarMes =
    mesVisivel.getFullYear() < limite.getFullYear() ||
    mesVisivel.getMonth() < limite.getMonth();

  const mudarMes = (quantidade: number) => {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + quantidade, 1));
  };

  const enviarSolicitacao = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro("");

    if (!dataSelecionada) {
      setErro("Escolha um dia no calendário.");
      return;
    }
    if (!autenticado) {
      onRequestLogin();
      return;
    }

    setEnviando(true);
    try {
      const solicitar = httpsCallable<
        { data: string; observacoes: string; idempotencyKey: string },
        ResultadoSolicitacao
      >(functions, "solicitarAgendamentoFritura");
      const resposta = await solicitar({
        data: dataSelecionada,
        observacoes: observacoes.trim(),
        idempotencyKey: idempotencyKey.current,
      });
      setSucesso(resposta.data);
    } catch (error) {
      const codigo = typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
      if (codigo.includes("unauthenticated")) {
        onRequestLogin();
      } else if (codigo.includes("failed-precondition")) {
        setErro("Esta data ou o agendamento não está disponível. Escolha outro dia e tente novamente.");
      } else {
        setErro("Não foi possível enviar agora. Confira sua conexão e tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !enviando) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="agendar-fritura-titulo"
        className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:max-w-md sm:rounded-[30px]"
      >
        {sucesso ? (
          <div className="agendar-fritura-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-9 text-center">
            <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
              ✓
            </div>
            <span className="mt-5 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.13em] text-emerald-700">
              Solicitação enviada
            </span>
            <h2 id="agendar-fritura-titulo" className="mt-3 text-2xl font-bold tracking-tight text-black">
              Recebemos seu pedido de data
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-500">
              Você escolheu <strong className="text-neutral-800">{formatarDataLonga(sucesso.data)}</strong>.
              Nossa equipe vai revisar e confirmar horário e local pelo WhatsApp.
            </p>
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left text-[13px] text-blue-800">
              <strong className="block">Sem cobrança agora</strong>
              Esta solicitação não foi adicionada ao carrinho e não gera pagamento.
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-blue-600 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.98]"
            >
              Entendi
            </button>
          </div>
        ) : (
          <>
            <div className="relative shrink-0 overflow-hidden rounded-t-[30px] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 pb-6 pt-5 text-white sm:rounded-t-[30px]">
              <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                aria-label="Fechar agendamento"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl font-light transition hover:bg-white/25 disabled:opacity-50"
              >
                ×
              </button>
              <span className="relative text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-100">
                Solicitação de fritura
              </span>
              <h2 id="agendar-fritura-titulo" className="relative mt-2 pr-10 text-2xl font-bold tracking-tight">
                {produto.nome}
              </h2>
              <p className="relative mt-1 max-w-sm text-[13px] leading-relaxed text-blue-100">
                Escolha o melhor dia. Depois, nossa equipe confirma os detalhes com você.
              </p>
            </div>

            <form
              onSubmit={enviarSolicitacao}
              className="agendar-fritura-scroll min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 pb-7 pt-5"
            >
              <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-3 shadow-inner">
                <div className="flex items-center justify-between px-1 pb-3">
                  <button
                    type="button"
                    onClick={() => mudarMes(-1)}
                    disabled={!podeVoltarMes}
                    aria-label="Mês anterior"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    ‹
                  </button>
                  <div className="text-center">
                    <strong className="block text-[15px] font-bold text-black">{MESES[mesVisivel.getMonth()]}</strong>
                    <span className="text-[11px] font-semibold text-neutral-400">{mesVisivel.getFullYear()}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => mudarMes(1)}
                    disabled={!podeAvancarMes}
                    aria-label="Próximo mês"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl text-neutral-700 shadow-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1" aria-label="Calendário para escolher a data">
                  {DIAS_SEMANA.map((dia, index) => (
                    <span
                      key={`${dia}-${index}`}
                      className="flex h-8 items-center justify-center text-[10px] font-extrabold uppercase text-neutral-400"
                    >
                      {dia}
                    </span>
                  ))}
                  {diasDoCalendario.map((data, index) => {
                    if (!data) return <span key={`vazio-${index}`} className="h-10" aria-hidden="true" />;
                    const dataISO = dataParaISO(data);
                    const passado = dataISO < hojeISO;
                    const selecionado = dataISO === dataSelecionada;
                    const ehHoje = dataISO === hojeISO;
                    return (
                      <button
                        key={dataISO}
                        type="button"
                        disabled={passado}
                        aria-pressed={selecionado}
                        aria-label={data.toLocaleDateString("pt-BR", {
                          weekday: "long", day: "2-digit", month: "long",
                        })}
                        onClick={() => {
                          setDataSelecionada(dataISO);
                          setErro("");
                        }}
                        className={[
                          "relative flex h-10 items-center justify-center rounded-xl text-[13px] font-bold transition",
                          selecionado
                            ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-[1.04]"
                            : passado
                              ? "cursor-not-allowed text-neutral-300"
                              : "bg-white text-neutral-700 hover:bg-blue-50 hover:text-blue-700 active:scale-95",
                          ehHoje && !selecionado ? "ring-1 ring-blue-300 text-blue-700" : "",
                        ].join(" ")}
                      >
                        {data.getDate()}
                        {ehHoje && (
                          <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selecionado ? "bg-white" : "bg-blue-500"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {dataSelecionada && (
                <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-900">
                  <span className="text-lg" aria-hidden="true">✓</span>
                  <div>
                    <strong className="block text-[12px] uppercase tracking-wide text-blue-700">Dia escolhido</strong>
                    <span className="text-[13px] font-semibold capitalize">{formatarDataLonga(dataSelecionada)}</span>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="flex items-center justify-between text-[13px] font-bold text-neutral-800">
                  Observações <small className="font-medium text-neutral-400">Opcional</small>
                </span>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  placeholder="Ex.: quantidade aproximada, tipo de evento ou alguma informação importante"
                  className="mt-2 w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-[14px] leading-relaxed text-black placeholder:text-neutral-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <span className="mt-1 block text-right text-[10px] font-medium text-neutral-400">
                  {observacoes.length}/500
                </span>
              </label>

              {erro && (
                <div role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-center text-[13px] font-semibold text-red-600">
                  {erro}
                </div>
              )}

              <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-[12px] leading-relaxed text-neutral-500">
                <strong className="text-neutral-700">Como funciona:</strong> você envia a data desejada e a equipe entra em contato pelo WhatsApp para confirmar horário e local.
              </div>

              <button
                type="submit"
                disabled={enviando || !dataSelecionada}
                className="w-full rounded-full bg-blue-600 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {enviando ? "Enviando solicitação..." : autenticado ? "Enviar solicitação" : "Entrar e continuar"}
              </button>
              <p className="text-center text-[11px] text-neutral-400" aria-live="polite">
                Não adiciona ao carrinho e não gera cobrança.
              </p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
