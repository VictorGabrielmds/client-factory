"use client";

import Image from "next/image";
import type { ItemCarrinho } from "../../contexts/CarrinhoContext";
import { formatarReal } from "./format";
import QuantidadeInput from "../QuantidadeInput";

interface PassoItensProps {
  itens: ItemCarrinho[];
  subtotal: number;
  observacoes: string;
  definirObservacoes: (texto: string) => void;
  adicionar: (produtoId: string) => void;
  remover: (produtoId: string) => void;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  onEsvaziar: () => void;
  onContinuar: () => void;
}

export default function PassoItens({
  itens,
  subtotal,
  observacoes,
  definirObservacoes,
  adicionar,
  remover,
  definirQuantidade,
  onEsvaziar,
  onContinuar,
}: PassoItensProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-[0.18em] text-blue-600 uppercase mb-1">Passo 1</p>
          <h2 className="text-2xl font-extrabold tracking-tight text-black">Seus itens</h2>
        </div>
        <button
          onClick={onEsvaziar}
          className="text-xs font-semibold text-neutral-400 hover:text-red-500 transition"
        >
          Esvaziar carrinho
        </button>
      </div>

      <section className="flex flex-col gap-3">
        {itens.map(({ produto, quantidade }) => (
          <div
            key={produto.id}
            className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex gap-4 items-center transition hover:shadow-md"
          >
            <div className="relative w-16 h-16 shrink-0 rounded-xl bg-neutral-100 overflow-hidden ring-1 ring-black/[0.04] shadow-[0_4px_10px_-3px_rgba(0,0,0,0.16)] flex items-center justify-center text-neutral-400">
              {produto.imagemUrl ? (
                <Image
                  src={produto.imagemUrl}
                  alt={produto.nome}
                  fill
                  sizes="64px"
                  quality={90}
                  className="object-cover"
                />
              ) : (
                <span className="text-xl">🥟</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-black truncate">{produto.nome}</h3>
              <span className="text-sm text-neutral-500">{formatarReal(produto.preco)} cada</span>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2">
              <span className="font-extrabold text-black text-base">
                {formatarReal(produto.preco * quantidade)}
              </span>
              <div className="flex items-center gap-3 bg-blue-50 rounded-full px-2 py-1">
                <button
                  onClick={() => remover(produto.id)}
                  aria-label={`Remover uma unidade de ${produto.nome}`}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold shadow-sm hover:bg-blue-100 transition"
                >
                  −
                </button>
                <QuantidadeInput
                  produtoId={produto.id}
                  produtoNome={produto.nome}
                  quantidade={quantidade}
                  definirQuantidade={definirQuantidade}
                  className="w-11 h-8 text-center bg-white border border-blue-300 rounded-lg font-bold text-black shadow-inner cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => adicionar(produto.id)}
                  aria-label={`Adicionar uma unidade de ${produto.nome}`}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold shadow-sm hover:bg-blue-100 transition"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => definirQuantidade(produto.id, 0)}
                className="text-xs text-neutral-400 hover:text-red-500 transition"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5">
        <label htmlFor="observacoes" className="block text-sm font-semibold text-black mb-2">
          Observações
        </label>
        <textarea
          id="observacoes"
          rows={3}
          value={observacoes}
          onChange={(e) => definirObservacoes(e.target.value)}
          placeholder="Ex: sem cebola, tocar a campainha, ponto de referência..."
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
        />
      </section>

      {/* Barra de ação fixa — total sempre visível, sem precisar rolar até
          o fim pra saber quanto já está gastando ou pra seguir em frente. */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-neutral-100 px-4 py-3 pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-4 pointer-events-auto">
          <div className="shrink-0">
            <span className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Subtotal</span>
            <span className="block text-lg font-extrabold text-black leading-tight">{formatarReal(subtotal)}</span>
          </div>
          <button
            onClick={onContinuar}
            disabled={itens.length === 0}
            className="flex-1 bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
