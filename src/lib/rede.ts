"use client";

import { useSyncExternalStore } from "react";
import { FunctionsError } from "firebase/functions";

// Códigos de erro de Cloud Functions / Firestore que indicam falha de rede ou
// sobrecarga momentânea — vale tentar de novo. Erros de negócio
// (invalid-argument, failed-precondition...) nunca entram aqui.
const CODIGOS_TRANSITORIOS = new Set([
  "aborted",
  "deadline-exceeded",
  "internal",
  "resource-exhausted",
  "unavailable",
  "unknown",
]);

export function codigoErro(erro: unknown): string {
  if (erro instanceof FunctionsError) return String(erro.code || "").replace(/^functions\//, "");
  const codigo = (erro as { code?: unknown } | null)?.code;
  return typeof codigo === "string" ? codigo.replace(/^(functions|firestore)\//, "") : "";
}

export function ehErroTransitorio(erro: unknown): boolean {
  const codigo = codigoErro(erro);
  if (CODIGOS_TRANSITORIOS.has(codigo)) return true;
  // signInWithCustomToken e afins (Firebase Auth) usam outro formato.
  return codigo === "auth/network-request-failed" || codigo === "auth/timeout";
}

export function estaOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Resolve quando o navegador voltar a ficar online (ou após `limiteMs`, para
// não ficar preso se o evento "online" nunca disparar — alguns navegadores
// mobile não disparam ao trocar de 4G para Wi-Fi).
export function esperarOnline(limiteMs: number): Promise<void> {
  if (!estaOffline()) return Promise.resolve();
  return new Promise((resolve) => {
    const terminar = () => {
      window.removeEventListener("online", terminar);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(terminar, limiteMs);
    window.addEventListener("online", terminar);
  });
}

// Executa `fn` com retentativas só para erros transitórios. Seguro apenas
// para chamadas de leitura ou idempotentes (mesma chave a cada tentativa).
export async function comRetentativa<T>(
  fn: () => Promise<T>,
  esperas: number[] = [0, 1500, 4000]
): Promise<T> {
  let ultimoErro: unknown = null;
  for (const espera of esperas) {
    if (espera > 0) {
      await esperar(espera);
      await esperarOnline(15000);
    }
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      if (!ehErroTransitorio(erro)) break;
    }
  }
  throw ultimoErro;
}

function assinarConexao(aoMudar: () => void) {
  window.addEventListener("online", aoMudar);
  window.addEventListener("offline", aoMudar);
  return () => {
    window.removeEventListener("online", aoMudar);
    window.removeEventListener("offline", aoMudar);
  };
}

// true enquanto o navegador diz estar sem conexão. No SSR assume online.
export function useOffline(): boolean {
  return useSyncExternalStore(assinarConexao, estaOffline, () => false);
}

// Mantém um listener do Firestore (onSnapshot) vivo. O Firestore já
// reconecta sozinho quando a internet cai e volta, mas se o listener
// terminar com ERRO (ex.: App Check falhou numa rede ruim, token expirado)
// ele morre de vez. Aqui ele é assinado de novo com espera crescente, ou
// assim que o navegador voltar a ficar online. Retorna a função de cancelar.
// Erros definitivos (permissão negada) não são repetidos.
export function ouvirComReconexao(
  assinar: (aoErro: (erro: unknown) => void) => () => void,
  aoErroFinal?: (erro: unknown, vaiTentarDeNovo: boolean) => void
): () => void {
  let cancelarListener: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let tentativas = 0;
  let ativo = true;

  const iniciar = () => {
    if (!ativo) return;
    timer = null;
    cancelarListener = assinar((erro) => {
      cancelarListener = null;
      const definitivo = codigoErro(erro) === "permission-denied" && tentativas >= 1;
      aoErroFinal?.(erro, !definitivo);
      if (definitivo || !ativo) return;
      tentativas += 1;
      const espera = Math.min(30000, 2000 * 2 ** Math.min(tentativas - 1, 4));
      timer = setTimeout(iniciar, espera);
    });
  };

  const aoVoltarOnline = () => {
    if (cancelarListener || !ativo) return; // listener vivo: o próprio Firestore reconecta.
    if (timer) clearTimeout(timer);
    tentativas = 0;
    iniciar();
  };

  iniciar();
  window.addEventListener("online", aoVoltarOnline);
  return () => {
    ativo = false;
    cancelarListener?.();
    if (timer) clearTimeout(timer);
    window.removeEventListener("online", aoVoltarOnline);
  };
}

// Mesma ideia do comRetentativa, para quando algo PRECISA carregar (ex.:
// horário de funcionamento): tenta de novo para sempre, com espera crescente
// até 30s, e na hora quando a internet volta. Retorna a função de cancelar.
export function carregarComInsistencia<T>(
  fn: () => Promise<T>,
  aoSucesso: (valor: T) => void,
  aoFalhar?: (erro: unknown) => void
): () => void {
  let ativo = true;
  let tentativas = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tentar = () => {
    if (!ativo) return;
    timer = null;
    fn().then(
      (valor) => {
        if (ativo) aoSucesso(valor);
      },
      (erro) => {
        if (!ativo) return;
        aoFalhar?.(erro);
        tentativas += 1;
        // Erro de negócio/configuração (não de rede): insiste pouco.
        if (!ehErroTransitorio(erro) && tentativas >= 3) return;
        timer = setTimeout(tentar, Math.min(30000, 2000 * 2 ** Math.min(tentativas - 1, 4)));
      }
    );
  };

  const aoVoltarOnline = () => {
    if (!timer || !ativo) return; // nada pendente ou já em voo.
    clearTimeout(timer);
    tentar();
  };

  tentar();
  window.addEventListener("online", aoVoltarOnline);
  return () => {
    ativo = false;
    if (timer) clearTimeout(timer);
    window.removeEventListener("online", aoVoltarOnline);
  };
}
