import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-8 text-center flex flex-col items-center gap-3">
        <span className="text-5xl">🥟</span>
        <h1 className="text-xl font-extrabold tracking-tight text-black">Página não encontrada</h1>
        <p className="text-sm text-neutral-500">
          Esse link não existe ou não está mais disponível.
        </p>
        <Link
          href="/cardapio"
          className="mt-3 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 transition"
        >
          Voltar para o cardápio
        </Link>
      </div>
    </div>
  );
}
