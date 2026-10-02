"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "../lib/firebase-client";

interface LoginSheetProps {
  titulo?: string;
  subtitulo?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// Sobe do fundo da tela (mesmo padrão dos outros bottom sheets do app) em
// vez de ocupar a página inteira — pode ser chamado tanto de um link "Entrar"
// no topo do cardápio quanto do meio do checkout, sem o cliente perder o que
// já estava fazendo (carrinho/endereço/agendamento continuam intactos atrás).
export default function LoginSheet({ titulo, subtitulo, onClose, onSuccess }: LoginSheetProps) {
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSolicitarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const numeroLimpo = telefone.replace(/\D/g, "");
      if (numeroLimpo.length < 10) throw new Error("Telefone inválido.");

      const solicitarLoginWhatsApp = httpsCallable(functions, "solicitarLoginWhatsApp");
      await solicitarLoginWhatsApp({ telefone: `55${numeroLimpo}` });
      setEtapa(2);
    } catch (err) {
      if (err instanceof Error) {
        setErro(err.message === "Telefone inválido." ? err.message : "Erro ao enviar código. Tente novamente.");
      } else {
        setErro("Erro desconhecido ao enviar código.");
      }
    } finally {
      setCarregando(false);
    }
  };

  const handleValidarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const numeroLimpo = telefone.replace(/\D/g, "");
      const validarLoginWhatsApp = httpsCallable(functions, "validarLoginWhatsApp");
      const resultado = await validarLoginWhatsApp({
        telefone: `55${numeroLimpo}`,
        codigo: codigo.trim(),
      });

      const tokenMagico = (resultado.data as { token: string }).token;
      await signInWithCustomToken(auth, tokenMagico);
      onSuccess?.();
      onClose();
    } catch {
      setErro("Código incorreto ou expirado.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl p-6 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-black mb-1">
          {etapa === 1 ? (titulo ?? "Entrar") : "Digite o código"}
        </h2>
        <p className="text-sm text-neutral-500 mb-5">
          {etapa === 1
            ? (subtitulo ?? "Qual o seu WhatsApp?")
            : (
              <>
                Enviamos um código de 6 dígitos para{" "}
                <strong className="text-neutral-800">{telefone}</strong>
              </>
            )}
        </p>

        {erro && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center mb-4">{erro}</div>
        )}

        {etapa === 1 ? (
          <form onSubmit={handleSolicitarCodigo} className="flex flex-col gap-3">
            <input
              type="tel"
              placeholder="(11) 99999-9999"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-base font-medium text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
            />
            <button
              type="submit"
              disabled={carregando || telefone.length < 10}
              className="w-full bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {carregando ? "Enviando..." : "Receber código"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleValidarCodigo} className="flex flex-col gap-3">
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-2xl tracking-[0.5em] text-center font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
            />
            <button
              type="submit"
              disabled={carregando || codigo.length < 6}
              className="w-full bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {carregando ? "Validando..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => setEtapa(1)}
              className="text-sm text-blue-600 font-semibold text-center mt-1 hover:underline"
            >
              Corrigir número
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
