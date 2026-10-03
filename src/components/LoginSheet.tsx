"use client";

import { useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth, functions } from "../lib/firebase-client";
import { codigoErro, comRetentativa, ehErroTransitorio, estaOffline } from "../lib/rede";

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
  // O envio do código pode ter chegado ao WhatsApp mesmo quando a resposta
  // se perdeu numa rede lenta — nesse caso deixa seguir para digitar o código
  // em vez de obrigar a pedir outro (que invalidaria o primeiro).
  const [envioIncerto, setEnvioIncerto] = useState(false);
  // Trava contra toque duplo antes do React desabilitar o botão.
  const emAndamento = useRef(false);
  // Token já validado: se só o signInWithCustomToken falhar por rede, tenta
  // de novo com ele sem validar o código outra vez (o código pode já ter
  // sido consumido no servidor).
  const tokenValidado = useRef<{ chave: string; token: string } | null>(null);

  // Aceita o número colado com +55 (ex.: do contato do WhatsApp).
  const digitosTelefone = telefone.replace(/\D/g, "");
  const numeroLimpo =
    digitosTelefone.length >= 12 && digitosTelefone.startsWith("55") ? digitosTelefone.slice(2) : digitosTelefone;

  const handleSolicitarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emAndamento.current) return;
    setErro("");
    setEnvioIncerto(false);
    if (numeroLimpo.length < 10 || numeroLimpo.length > 11) {
      setErro("Telefone inválido. Informe DDD + número.");
      return;
    }
    if (estaOffline()) {
      setErro("Você está sem internet. Conecte-se e tente de novo.");
      return;
    }
    emAndamento.current = true;
    setCarregando(true);
    try {
      // Sem retentativa automática: cada envio gera um código novo no
      // WhatsApp e o cliente ficaria sem saber qual digitar.
      const solicitarLoginWhatsApp = httpsCallable(functions, "solicitarLoginWhatsApp", { timeout: 25000 });
      await solicitarLoginWhatsApp({ telefone: `55${numeroLimpo}` });
      tokenValidado.current = null;
      setCodigo("");
      setEtapa(2);
    } catch (err) {
      const cod = codigoErro(err);
      if (cod === "resource-exhausted") {
        setErro("Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.");
      } else if (ehErroTransitorio(err) || estaOffline()) {
        setEnvioIncerto(true);
        setErro("A conexão está lenta e não conseguimos confirmar o envio. Se o código chegar no seu WhatsApp, toque em \"Já recebi o código\". Se não chegar, tente de novo.");
      } else if (cod === "invalid-argument") {
        setErro("Telefone inválido. Confira o número e tente de novo.");
      } else {
        setErro("Erro ao enviar código. Tente novamente.");
      }
    } finally {
      emAndamento.current = false;
      setCarregando(false);
    }
  };

  const handleValidarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emAndamento.current) return;
    setErro("");
    if (estaOffline()) {
      setErro("Você está sem internet. Conecte-se e toque em Entrar de novo.");
      return;
    }
    emAndamento.current = true;
    setCarregando(true);
    const codigoLimpo = codigo.replace(/\D/g, "");
    const chave = `${numeroLimpo}|${codigoLimpo}`;
    try {
      let token = tokenValidado.current?.chave === chave ? tokenValidado.current.token : null;
      if (!token) {
        const validarLoginWhatsApp = httpsCallable(functions, "validarLoginWhatsApp", { timeout: 20000 });
        const resultado = await comRetentativa(() =>
          validarLoginWhatsApp({ telefone: `55${numeroLimpo}`, codigo: codigoLimpo })
        );
        token = (resultado.data as { token: string }).token;
        tokenValidado.current = { chave, token };
      }
      const tokenFinal = token;
      await comRetentativa(() => signInWithCustomToken(auth, tokenFinal));
      tokenValidado.current = null;
      onSuccess?.();
      onClose();
    } catch (err) {
      const cod = codigoErro(err);
      if (cod === "auth/invalid-custom-token" || cod === "auth/custom-token-mismatch") {
        // Token velho (ex.: a pessoa demorou muito): valida o código de novo.
        tokenValidado.current = null;
        setErro("Sua verificação expirou. Peça um novo código.");
      } else if (cod === "resource-exhausted") {
        setErro("Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.");
      } else if (ehErroTransitorio(err) || estaOffline()) {
        setErro("Conexão instável. Não conseguimos confirmar o código. Toque em Entrar de novo.");
      } else {
        setErro("Código incorreto ou expirado.");
      }
    } finally {
      emAndamento.current = false;
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
          <div role="alert" className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center mb-4">{erro}</div>
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
              disabled={carregando || numeroLimpo.length < 10}
              className="w-full bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {carregando ? "Enviando..." : "Receber código"}
            </button>
            {envioIncerto && !carregando && (
              <button
                type="button"
                onClick={() => {
                  setErro("");
                  setEnvioIncerto(false);
                  setCodigo("");
                  setEtapa(2);
                }}
                className="text-sm text-blue-600 font-semibold text-center mt-1 hover:underline"
              >
                Já recebi o código
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={handleValidarCodigo} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
              onClick={() => {
                setErro("");
                setEtapa(1);
              }}
              disabled={carregando}
              className="text-sm text-blue-600 font-semibold text-center mt-1 hover:underline disabled:opacity-50"
            >
              Corrigir número ou pedir novo código
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
