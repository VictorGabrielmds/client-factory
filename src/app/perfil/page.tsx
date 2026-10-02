"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { useCarrinho } from "../../contexts/CarrinhoContext";
import type { EnderecoSalvo } from "../../contexts/CarrinhoContext";
import EnderecoFormModal from "../../components/perfil/EnderecoFormModal";

function formatarTelefoneExibicao(uid: string): string {
  const digitos = uid.replace(/^cliente_/, "").replace(/\D/g, "");
  const semPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (semPais.length < 10) return semPais || "—";
  const ddd = semPais.slice(0, 2);
  const resto = semPais.slice(2);
  const meio = resto.length === 9 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim = resto.length === 9 ? resto.slice(5) : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const {
    nome,
    cpf,
    enderecosSalvos,
    salvandoEnderecoNomeado,
    salvarEnderecoNomeado,
    removerEnderecoNomeado,
    bairrosEntrega,
  } = useCarrinho();

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<EnderecoSalvo | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);

  const abrirNovo = () => {
    setEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (endereco: EnderecoSalvo) => {
    setEditando(endereco);
    setModalAberto(true);
  };

  const handleRemover = async (id: string) => {
    setRemovendoId(id);
    await removerEnderecoNomeado(id);
    setRemovendoId(null);
  };

  const handleSair = async () => {
    await logout();
    router.push("/cardapio");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 text-center flex flex-col items-center gap-3">
          <span className="text-5xl">🔒</span>
          <h1 className="text-lg font-bold text-black">Faça login para ver seu perfil</h1>
          <Link href="/cardapio" className="mt-2 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 transition">
            Voltar para o cardápio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/cardapio" className="text-neutral-500 hover:text-black transition" aria-label="Voltar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight text-black">Meu perfil</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4 flex flex-col gap-4">
        <section className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-5">
          <p className="text-[11px] font-bold tracking-[0.18em] text-blue-600 uppercase mb-3">Meus dados</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Nome</span>
              <span className="font-semibold text-black">{nome || "Ainda não informado"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Telefone</span>
              <span className="font-semibold text-black">{formatarTelefoneExibicao(user.uid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">CPF</span>
              <span className="font-semibold text-black">{cpf || "Ainda não informado"}</span>
            </div>
          </div>
          <p className="text-xs text-neutral-400 mt-3">
            Nome e CPF são preenchidos automaticamente no seu próximo pedido.
          </p>
        </section>

        <section className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold tracking-[0.18em] text-blue-600 uppercase">Meus endereços</p>
            <button
              type="button"
              onClick={abrirNovo}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
            >
              + Adicionar
            </button>
          </div>

          {enderecosSalvos.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum endereço salvo ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {enderecosSalvos.map((end) => (
                <div key={end.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-black">{end.rotulo}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {end.logradouro}, {end.numero} — {end.bairro}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(end)}
                      className="text-xs font-semibold text-neutral-500 hover:text-black transition px-2 py-1"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemover(end.id)}
                      disabled={removendoId === end.id}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 transition px-2 py-1 disabled:opacity-40"
                    >
                      {removendoId === end.id ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Link
          href="/pedidos"
          className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-5 flex items-center justify-between hover:bg-neutral-50 transition"
        >
          <span className="font-semibold text-sm text-black">Meus pedidos</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>

        <button
          type="button"
          onClick={handleSair}
          className="bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 p-5 text-left font-semibold text-sm text-red-500 hover:bg-red-50 transition"
        >
          Sair da conta
        </button>
      </main>

      {modalAberto && (
        <EnderecoFormModal
          enderecoInicial={editando}
          bairrosEntrega={bairrosEntrega}
          salvando={salvandoEnderecoNomeado}
          onSalvar={salvarEnderecoNomeado}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
