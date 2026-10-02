"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-8 text-center flex flex-col items-center gap-3">
        <span className="text-5xl">😕</span>
        <h1 className="text-xl font-extrabold tracking-tight text-black">Algo deu errado</h1>
        <p className="text-sm text-neutral-500">
          Tivemos um problema ao carregar essa página. Tente de novo — se continuar, fale com a gente pelo WhatsApp.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-3 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 transition"
        >
          Tentar de novo
        </button>
        <Link
          href="/cardapio"
          className="w-full rounded-xl border border-neutral-200 text-neutral-600 font-semibold text-sm py-3 hover:bg-neutral-50 transition"
        >
          Voltar para o cardápio
        </Link>
      </div>
    </div>
  );
}
