"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCarrinho } from "../contexts/CarrinhoContext";

function formatarReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Barra flutuante estilo "mini player" (Apple Music) — pill escura com
// blur, badge circular com a contagem, e o valor total em destaque. Tocar
// nela abre um resumo dos itens ali mesmo (sem sair do cardápio); só
// "Finalizar pedido" leva pro checkout de verdade.
export default function CarrinhoResumo() {
  const router = useRouter();
  // Só o subtotal dos itens aqui — taxa de entrega/cartão só aparece
  // discriminada no Resumo (Passo 3), não misturada de cara no cardápio.
  const { totalItens, subtotal, itens, adicionar, remover, observacoes, definirObservacoes, faltaParaValorMinimo } =
    useCarrinho();
  const [aberto, setAberto] = useState(false);

  if (totalItens === 0) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 flex justify-center px-4 pb-5 pointer-events-none z-40">
        <button
          onClick={() => setAberto(true)}
          className="w-full max-w-2xl bg-color-primary backdrop-blur-xl text-white rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] pl-2 pr-5 py-2 flex items-center gap-3 pointer-events-auto active:scale-[0.98] transition"
        >
          <span className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm shrink-0">
            {totalItens}
          </span>
          <span className="flex-1 font-semibold text-[15px] tracking-tight text-left">Ver carrinho</span>
          <span className="font-bold text-[15px]">{formatarReal(subtotal)}</span>
        </button>
      </div>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setAberto(false)}
        >
          <div
            className="w-full sm:max-w-2xl bg-white rounded-t-3xl p-5 max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-black">Seu carrinho</h2>
              <button onClick={() => setAberto(false)} className="text-neutral-400 text-sm font-semibold">
                Fechar
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              {itens.map(({ produto, quantidade }) => (
                <div key={produto.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-black truncate">
                    {produto.nome}
                    {produto.esgotado && <span className="ml-1.5 text-xs font-semibold text-red-600">Esgotado</span>}
                  </span>
                  <div className="flex items-center gap-2 bg-blue-50 rounded-full px-1.5 py-1 shrink-0">
                    <button
                      onClick={() => remover(produto.id)}
                      aria-label={`Remover uma unidade de ${produto.nome}`}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold text-xs shadow-sm"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-xs font-bold text-black">{quantidade}</span>
                    <button
                      onClick={() => adicionar(produto.id)}
                      disabled={produto.esgotado}
                      aria-label={`Adicionar uma unidade de ${produto.nome}`}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold text-xs shadow-sm disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 text-right text-sm font-semibold text-black shrink-0">
                    {formatarReal(produto.preco * quantidade)}
                  </span>
                </div>
              ))}
            </div>

            {faltaParaValorMinimo > 0 && (
              <p className="text-xs text-amber-700 font-medium bg-amber-50 rounded-lg px-3 py-2 mb-4">
                Falta {formatarReal(faltaParaValorMinimo)} para o valor mínimo de entrega.
              </p>
            )}

            <label htmlFor="observacoes-mini" className="block text-xs font-medium text-neutral-500 mb-1">
              Observações
            </label>
            <textarea
              id="observacoes-mini"
              rows={2}
              value={observacoes}
              onChange={(e) => definirObservacoes(e.target.value)}
              placeholder="Ex: sem cebola, tocar a campainha..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none mb-4"
            />

            <button
              onClick={() => router.push("/carrinho?passo=2")}
              className="w-full bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 transition"
            >
              Finalizar pedido — {formatarReal(subtotal)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
