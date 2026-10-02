"use client";

import { useState } from "react";
import Link from "next/link";
import { useCarrinho } from "../contexts/CarrinhoContext";
import SolicitarAlteracaoModal from "./SolicitarAlteracaoModal";

export default function UltimoPedidoCard() {
  const { ultimoPedido, ultimoPedidoNaoEntregue, repetirUltimoPedido } = useCarrinho();
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  if (!ultimoPedido || ultimoPedido.descricaoItem.length === 0) return null;

  const resumoItens = ultimoPedido.descricaoItem
    .map((nome, i) => `${ultimoPedido.quantidadeItem[i]}x ${nome}`)
    .join(", ");

  const handleRepetir = () => {
    const { adicionados, indisponiveis } = repetirUltimoPedido();
    if (adicionados === 0) {
      setMensagem("Nenhum item desse pedido está disponível no momento.");
    } else if (indisponiveis > 0) {
      setMensagem(
        `${adicionados} ${adicionados === 1 ? "item adicionado" : "itens adicionados"} — ${indisponiveis} ${
          indisponiveis === 1 ? "não está" : "não estão"
        } mais disponível.`
      );
    } else {
      setMensagem("Itens adicionados ao carrinho!");
    }
    setTimeout(() => setMensagem(null), 3500);
  };

  return (
    <div className="mx-5 mt-4 bg-white rounded-2xl shadow-sm border border-neutral-100/80 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-bold tracking-wide text-neutral-400 uppercase">Seu último pedido</p>
        <Link href={`/pedido/${ultimoPedido.orderId}`} className="text-[12px] font-semibold text-blue-600 hover:underline shrink-0">
          Ver pedido →
        </Link>
      </div>
      <p className="text-[13px] text-neutral-600 line-clamp-2 mb-3">{resumoItens}</p>
      <div className="flex gap-2">
        <button
          onClick={handleRepetir}
          disabled={ultimoPedido.produtoIdItem.length === 0}
          className="flex-1 bg-color-primary text-white font-bold text-[13px] py-2 rounded-full hover:bg-neutral-800 disabled:opacity-40 transition"
        >
          Repetir pedido
        </button>
        {ultimoPedidoNaoEntregue && (
          <button
            onClick={() => setMostrarModal(true)}
            className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-bold text-[13px] py-2 rounded-full hover:bg-neutral-50 transition"
          >
            Solicitar alteração
          </button>
        )}
      </div>
      {mensagem && <p className="text-[12px] text-green-600 font-medium mt-2">{mensagem}</p>}

      {mostrarModal && <SolicitarAlteracaoModal pedido={ultimoPedido} onClose={() => setMostrarModal(false)} />}
    </div>
  );
}
