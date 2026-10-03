"use client";

import { useCarrinho } from "../../contexts/CarrinhoContext";

// Aviso mostrado no carrinho quando algum item esgotou depois de ser
// adicionado — o checkout fica travado até ele sair do carrinho.
export default function AvisoEsgotados() {
  const { itensEsgotados, removerEsgotados } = useCarrinho();
  if (itensEsgotados.length === 0) return null;

  const nomes = itensEsgotados.map((item) => item.produto.nome).join(", ");
  const um = itensEsgotados.length === 1;

  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="text-sm font-bold">{um ? "Um item do seu carrinho esgotou" : "Alguns itens do seu carrinho esgotaram"}</p>
      <p className="mt-1 text-sm">
        {nomes} {um ? "não está mais disponível" : "não estão mais disponíveis"} no momento. Remova para continuar o pedido.
      </p>
      <button
        type="button"
        onClick={removerEsgotados}
        className="mt-3 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
      >
        {um ? "Remover item esgotado" : "Remover itens esgotados"}
      </button>
    </div>
  );
}
