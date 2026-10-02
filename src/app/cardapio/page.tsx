"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import Cardapio from "../../components/Cardapio";
import LoginSheet from "../../components/LoginSheet";
import EntregarEmBar from "../../components/EntregarEmBar";
import BotaoLocalizacao from "../../components/BotaoLocalizacao";
import BotaoWhatsapp from "../../components/BotaoWhatsapp";
import { useCarrinho } from "../../contexts/CarrinhoContext";

// Visitante vê o cardápio inteiro sem precisar de conta — login só é pedido
// na hora de "Finalizar pedido" (ver PassoResumo.tsx). O link "Entrar" aqui
// é só um atalho pra quem já quer logar antes disso.
export default function CardapioPage() {
  const { user, loading } = useAuth();
  const { tipoEntrega } = useCarrinho();
  const [mostrarLogin, setMostrarLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-blue-600 font-semibold">
        A carregar...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 relative">
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/92 px-2 py-1.5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/82 sm:px-4">
        <div className="mx-auto flex min-h-12 w-full max-w-2xl items-center gap-1.5">
          {user ? (
            <>
              <EntregarEmBar />
              <span aria-hidden="true" className="mx-1 h-7 w-px shrink-0 bg-neutral-200/90" />
              <div className="flex shrink-0 items-center gap-2">
                {tipoEntrega === "retirada" && <BotaoLocalizacao />}
                <Link
                  href="/perfil"
                  aria-label="Abrir perfil"
                  title="Perfil"
                  className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 sm:w-auto sm:gap-2 sm:px-3"
                >
                  <UserRound size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span className="hidden text-[12px] font-medium sm:inline">Perfil</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/"
                className="min-w-0 flex-1 truncate px-2 text-[13px] font-semibold tracking-[-0.015em] text-neutral-900"
              >
                Fábrica dos Salgados
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                {tipoEntrega === "retirada" && <BotaoLocalizacao />}
                <button
                  type="button"
                  onClick={() => setMostrarLogin(true)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-neutral-900 px-3 text-[12px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
                >
                  <LogIn size={15} strokeWidth={1.9} aria-hidden="true" />
                  Entrar
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main>
        <Cardapio />
      </main>

      <BotaoWhatsapp />

      {mostrarLogin && <LoginSheet onClose={() => setMostrarLogin(false)} />}
    </div>
  );
}
