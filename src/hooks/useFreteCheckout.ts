"use client";

import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase-client";

type Consulta = { chave: string; taxa: number; tempo: number; estado: "pendente" | "pronto" | "erro"; erro: string | null };

export function useFreteCheckout(tipoEntrega: string, bairro: string) {
  const [revisao, setRevisao] = useState(0);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const bairroAtual = bairro.trim();
  const delivery = tipoEntrega === "delivery";
  // A taxa depende do bairro; qualquer alteração invalida a prévia no próprio
  // render, antes do efeito/debounce, sem mostrar o frete do bairro anterior.
  const chave = JSON.stringify([tipoEntrega, bairroAtual, revisao]);
  const atual = consulta?.chave === chave ? consulta : null;
  const recalcularTaxaEntrega = useCallback(() => setRevisao(valor => valor + 1), []);

  useEffect(() => {
    if (!delivery || !bairroAtual) return;
    let ativa = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia consulta externa; a chave derivada já bloqueia prévia antiga antes deste efeito.
    setConsulta({ chave, estado: "pendente", taxa: 0, tempo: 0, erro: null });
    const timeout = window.setTimeout(async () => {
      try {
        const consultar = httpsCallable<{ bairro: string }, { taxa: number; tempoMinutos: number }>(
          functions, "consultarTaxaEntrega", { timeout: 15000 },
        );
        const { data } = await consultar({ bairro: bairroAtual });
        if (!Number.isFinite(data.taxa) || data.taxa < 0 || !Number.isFinite(data.tempoMinutos) || data.tempoMinutos < 0) {
          throw new Error("Prévia de entrega inválida");
        }
        if (ativa) setConsulta({ chave, estado: "pronto", taxa: data.taxa, tempo: data.tempoMinutos, erro: null });
      } catch {
        if (ativa) setConsulta({ chave, estado: "erro", taxa: 0, tempo: 0,
          erro: "Não foi possível calcular o frete. Verifique sua conexão e tente calcular novamente antes de confirmar.",
        });
      }
    }, 600);
    // Uma resposta lenta do bairro anterior nunca substitui a consulta atual.
    return () => { ativa = false; window.clearTimeout(timeout); };
  }, [delivery, bairroAtual, chave]);

  useEffect(() => {
    if (!delivery) return;
    window.addEventListener("online", recalcularTaxaEntrega);
    return () => window.removeEventListener("online", recalcularTaxaEntrega);
  }, [delivery, recalcularTaxaEntrega]);

  const pronto = !delivery || atual?.estado === "pronto";
  return {
    taxaEntrega: delivery && pronto ? atual?.taxa ?? 0 : 0,
    tempoEntregaMinutos: delivery && pronto ? atual?.tempo ?? 0 : 0,
    taxaEntregaCarregando: delivery && !!bairroAtual && !pronto && atual?.estado !== "erro",
    taxaEntregaErro: !delivery ? null : !bairroAtual ? "Selecione um bairro para calcular o frete." : atual?.erro ?? null,
    recalcularTaxaEntrega,
  };
}
