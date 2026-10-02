"use client";

import { useState } from "react";
import { useCarrinho, type DiaSemana } from "../contexts/CarrinhoContext";

const DIAS_ORDEM: DiaSemana[] = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

const DIA_NOME: Record<DiaSemana, string> = {
  domingo: "Domingo",
  segunda: "Segunda",
  terca: "Terça",
  quarta: "Quarta",
  quinta: "Quinta",
  sexta: "Sexta",
  sabado: "Sábado",
};

function horaParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Card enxuto: só o status de HOJE numa linha (aberto/fechado + horário),
// com um botão pra expandir e ver a semana toda — também resumida, sem os
// badges de delivery/retirada por turno que o card antigo mostrava.
export default function HorarioFuncionamentoCard() {
  const { horarioFuncionamento, horarioCarregando } = useCarrinho();
  const [expandido, setExpandido] = useState(false);

  if (horarioCarregando || !horarioFuncionamento) return null;

  const agora = new Date();
  const hojeIndex = agora.getDay(); // 0=domingo...6=sábado — mesma ordem de DIAS_ORDEM
  const diaHoje = DIAS_ORDEM[hojeIndex];
  const configHoje = horarioFuncionamento.dias[diaHoje];
  const turnosHoje = configHoje.ativo ? configHoje.turnos : [];
  const minutoAgora = agora.getHours() * 60 + agora.getMinutes();

  const turnoAtual = turnosHoje.find(
    (t) => minutoAgora >= horaParaMinutos(t.abre) && minutoAgora <= horaParaMinutos(t.fecha),
  );
  const proximoTurno = turnosHoje
    .filter((t) => horaParaMinutos(t.abre) > minutoAgora)
    .sort((a, b) => horaParaMinutos(a.abre) - horaParaMinutos(b.abre))[0];

  let status: string;
  const aberto = !!turnoAtual;
  if (turnoAtual) {
    // Se tem outro turno mais tarde hoje (ex.: almoço e jantar), o turno
    // atual não está "fechando" de vez — é só um intervalo até o próximo.
    status = proximoTurno
      ? `Aberto agora · intervalo às ${turnoAtual.fecha}`
      : `Aberto agora · fecha às ${turnoAtual.fecha}`;
  } else if (proximoTurno) {
    status = `Fechado agora · abre às ${proximoTurno.abre}`;
  } else if (turnosHoje.length > 0) {
    status = `Voltamos amanhã às ${turnosHoje[0].abre}`;
  } else {
    status = "Fechado hoje";
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100/80 overflow-hidden">
      <button
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        aria-expanded={expandido}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${aberto ? "bg-green-500" : "bg-neutral-300"}`} aria-hidden="true" />
        <span className="flex-1 text-[13px] font-medium text-neutral-700">{status}</span>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${expandido ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expandido && (
        <div className="px-4 pb-3 pt-1.5 border-t border-neutral-100 flex flex-col gap-1.5">
          {DIAS_ORDEM.map((dia, index) => {
            const config = horarioFuncionamento.dias[dia];
            const turnos = config.ativo ? config.turnos : [];
            const ehHoje = index === hojeIndex;
            return (
              <div key={dia} className="flex items-center justify-between text-[12.5px]">
                <span className={ehHoje ? "font-semibold text-neutral-900" : "text-neutral-500"}>{DIA_NOME[dia]}</span>
                <span className={ehHoje ? "font-semibold text-neutral-900" : "text-neutral-500"}>
                  {turnos.length === 0 ? "Fechado" : turnos.map((t) => `${t.abre}–${t.fecha}`).join(" · ")}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
