"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useCarrinho } from "../contexts/CarrinhoContext";
import { useAuth } from "../hooks/useAuth";
import AgendarFrituraModal from "./AgendarFrituraModal";
import CarrinhoResumo from "./CarrinhoResumo";
import HorarioFuncionamentoCard from "./HorarioFuncionamentoCard";
import LoginSheet from "./LoginSheet";
import UltimoPedidoCard from "./UltimoPedidoCard";
import QuantidadeInput from "./QuantidadeInput";
import type { Produto } from "../types/produto";

function formatarReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const IMAGENS_CATEGORIAS: Record<string, string> = {
  "Salgados Tradicionais": "/categorias/salgados-tradicionais-cropped.png",
  "Salgados de Forno": "/categorias/salgados-forno.png",
  "Salgados Especiais": "/categorias/salgados-especiais.png",
};

interface ItemCardapioRowProps {
  produto: Produto;
  quantidade: number;
  adicionar: (produtoId: string) => void;
  remover: (produtoId: string) => void;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  onAgendarFritura: (produto: Produto) => void;
}

// Extraído + memoizado: sem isso, mudar a quantidade de UM item re-renderiza
// a lista inteira do cardápio (o componente pai reage a qualquer mudança no
// contexto do carrinho) — com catálogos maiores isso vira um trabalho de
// reconciliação proporcional ao número de produtos a cada toque no +/-.
// Só re-renderiza quando o PRÓPRIO produto ou a PRÓPRIA quantidade mudam.
const ItemCardapioRow = memo(function ItemCardapioRow({
  produto,
  quantidade,
  adicionar,
  remover,
  definirQuantidade,
  onAgendarFritura,
}: ItemCardapioRowProps) {
  if (produto.tipoSistema === "agendamento_fritura") {
    return (
      <div className={`relative overflow-hidden px-4 py-4 ${produto.esgotado ? "opacity-55" : ""}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.16),transparent_52%)] pointer-events-none" />
        <div className="relative flex items-center gap-3.5">
          <div className="w-20 h-20 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-[0_12px_28px_-12px_rgba(37,99,235,0.8)] flex flex-col items-center justify-center">
            <span className="text-2xl leading-none" aria-hidden="true">📅</span>
            <span className="mt-1 text-[9px] font-extrabold tracking-[0.16em] uppercase">Agendar</span>
          </div>

          <div className="flex-1 min-w-0">
            <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-700">
              Solicitação de data
            </span>
            <h3 className="mt-1.5 font-bold text-black text-[16px] leading-tight">{produto.nome}</h3>
            <p className="text-[12px] text-neutral-500 line-clamp-2 mt-0.5">
              {produto.descricao || "Escolha o melhor dia e conte os detalhes para nossa equipe."}
            </p>
          </div>

          {produto.esgotado ? (
            <span className="shrink-0 text-[11px] font-bold text-neutral-400 uppercase tracking-wide px-2">
              Indisponível
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onAgendarFritura(produto)}
              className="shrink-0 rounded-full bg-blue-600 px-4 py-2 text-[12px] font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
            >
              Escolher data
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3.5 items-center px-4 py-3.5 ${produto.esgotado ? "opacity-50" : ""}`}>
      <div className="relative w-20 h-20 shrink-0 rounded-2xl bg-neutral-100 overflow-hidden ring-1 ring-black/[0.04] shadow-[0_6px_14px_-4px_rgba(0,0,0,0.18)] flex items-center justify-center text-neutral-300">
        {produto.imagemUrl ? (
          <Image src={produto.imagemUrl} alt={produto.nome} fill sizes="80px" quality={90} className="object-cover" />
        ) : (
          <span className="text-2xl">🥟</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-black text-[15px] leading-snug truncate">{produto.nome}</h3>
        {produto.descricao && <p className="text-[13px] text-neutral-400 line-clamp-1 mt-0.5">{produto.descricao}</p>}
        <span className="text-[13px] text-neutral-500 font-medium mt-0.5 block">{formatarReal(produto.preco)}</span>
      </div>

      {produto.esgotado ? (
        <span className="shrink-0 text-[11px] font-bold text-neutral-400 uppercase tracking-wide px-2">
          Esgotado
        </span>
      ) : quantidade === 0 ? (
        <button
          onClick={() => adicionar(produto.id)}
          className="shrink-0 bg-neutral-100 text-neutral-900 font-bold text-[13px] tracking-wide px-5 py-[7px] rounded-full hover:bg-neutral-200 active:scale-95 transition"
        >
          Adicionar
        </button>
      ) : (
        <div className="shrink-0 flex items-center gap-1.5 bg-blue-50 rounded-2xl px-1.5 py-1">
          <button
            onClick={() => remover(produto.id)}
            aria-label={`Remover uma unidade de ${produto.nome}`}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold shadow-sm active:scale-90 transition"
          >
            −
          </button>
          {/* O número do meio é editável (não só +/- de 1 em 1) — o selinho
              de lápis é o que deixa isso óbvio sem precisar de texto extra
              num espaço tão apertado; some enquanto o campo está em foco
              (via group-focus-within) pra não competir com o cursor. */}
          <div className="relative shrink-0 group">
            <QuantidadeInput
              produtoId={produto.id}
              produtoNome={produto.nome}
              quantidade={quantidade}
              definirQuantidade={definirQuantidade}
              className="w-11 h-8 text-center bg-white border border-blue-300 rounded-lg font-bold text-black text-sm shadow-inner cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shadow-sm pointer-events-none transition-opacity group-focus-within:opacity-0"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </span>
          </div>
          <button
            onClick={() => adicionar(produto.id)}
            aria-label={`Adicionar uma unidade de ${produto.nome}`}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold shadow-sm active:scale-90 transition"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
});

export default function Cardapio() {
  const carrinho = useCarrinho();
  const { produtos, produtosLoading: loading, ordemCategorias, descricoesCategorias } = carrinho;
  const { user } = useAuth();

  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [produtoAgendamento, setProdutoAgendamento] = useState<Produto | null>(null);
  const [mostrarLoginAgendamento, setMostrarLoginAgendamento] = useState(false);

  const abrirAgendamentoFritura = useCallback((produto: Produto) => {
    setProdutoAgendamento(produto);
  }, []);

  const categoriasDisponiveis = useMemo(() => {
    const nomes = [...new Set(produtos.map((p) => p.categoria || "Outros"))];
    return nomes.sort((a, b) => {
      const idxA = ordemCategorias.indexOf(a);
      const idxB = ordemCategorias.indexOf(b);
      if (idxA === -1 && idxB === -1) return a.localeCompare(b);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [produtos, ordemCategorias]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const bateBusca =
        !termo || p.nome.toLowerCase().includes(termo) || p.descricao?.toLowerCase().includes(termo);
      const bateCategoria = !categoriaFiltro || (p.categoria || "Outros") === categoriaFiltro;
      return bateBusca && bateCategoria;
    });
  }, [produtos, busca, categoriaFiltro]);

  const porCategoria = useMemo(() => {
    const grupos = new Map<string, Produto[]>();
    for (const produto of produtosFiltrados) {
      const categoria = produto.categoria || "Outros";
      if (!grupos.has(categoria)) grupos.set(categoria, []);
      grupos.get(categoria)!.push(produto);
    }
    for (const lista of grupos.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome));
    return categoriasDisponiveis
      .filter((categoria) => grupos.has(categoria))
      .map((categoria) => [categoria, grupos.get(categoria)!] as [string, Produto[]]);
  }, [produtosFiltrados, categoriasDisponiveis]);

  // Map em vez de itens.find(...) por linha: O(1) por produto em vez de
  // O(n) — antes, renderizar a lista inteira era O(n²) no total de produtos.
  const quantidadesPorProduto = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of carrinho.itens) mapa.set(item.produto.id, item.quantidade);
    return mapa;
  }, [carrinho.itens]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-24 text-neutral-400 text-[15px] font-medium">
        A carregar cardápio...
      </div>
    );
  }

  if (produtos.length === 0) {
    return (
      <div className="w-full text-center py-24 text-neutral-400 text-[15px] font-medium">
        Nenhum produto disponível no momento.
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto pb-32">
      <UltimoPedidoCard />

      <div className="px-5 pt-5 pb-1">
        <h1 className="text-[34px] leading-tight font-bold text-black tracking-tight">Cardápio</h1>
        <p className="text-neutral-400 text-[15px] mt-0.5">Feito na hora, do jeitinho que você gosta</p>
      </div>

      <div className="px-5 mt-4">
        <div className="relative">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio"
            className="w-full pl-10 pr-4 py-3 bg-neutral-100 rounded-2xl text-[15px] text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {categoriasDisponiveis.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-5 no-scrollbar">
          <button
            onClick={() => setCategoriaFiltro(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${
              categoriaFiltro === null ? "bg-black text-white" : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Todos
          </button>
          {categoriasDisponiveis.map((categoria) => (
            <button
              key={categoria}
              onClick={() => setCategoriaFiltro(categoria)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${
                categoriaFiltro === categoria ? "bg-black text-white" : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {categoria}
            </button>
          ))}
        </div>
      )}

      <div className="px-5 mt-4">
        <HorarioFuncionamentoCard />
      </div>

      {porCategoria.length === 0 && (
        <p className="text-center text-neutral-400 text-sm mt-10">Nenhum produto encontrado.</p>
      )}

      {porCategoria.map(([categoria, itens]) => {
        const imagemCategoria = IMAGENS_CATEGORIAS[categoria];

        return (
          <section key={categoria} className="mt-12">
            {imagemCategoria ? (
              <div className="flex items-end justify-between gap-4 px-5">
                <div className="min-w-0">
                  <h2 className="text-[26px] font-bold text-black tracking-tight leading-none">
                    {categoria}
                  </h2>
                  {descricoesCategorias[categoria] && (
                    <p className="text-[13px] text-neutral-400 mt-1.5">
                      {descricoesCategorias[categoria]}
                    </p>
                  )}
                </div>

                <div
                  className="relative shrink-0 w-28 h-28 sm:w-36 sm:h-36 drop-shadow-[-3px_6px_4px_rgba(0,0,0,0.16)] select-none pointer-events-none"
                  style={{ transform: "rotate(-4deg)" }}
                >
                  <Image
                    src={imagemCategoria}
                    alt=""
                    aria-hidden="true"
                    fill
                    unoptimized
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            ) : (
              <div className="px-5">
                <h2 className="text-[22px] font-bold text-black tracking-tight">{categoria}</h2>
                {descricoesCategorias[categoria] && (
                  <p className="text-[13px] text-neutral-400 mt-0.5 mb-0">{descricoesCategorias[categoria]}</p>
                )}
              </div>
            )}

            <div className="mx-4 flex flex-col divide-y divide-neutral-100 bg-white rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-neutral-100/80 overflow-hidden mt-4">
              {itens.map((produto) => (
                <ItemCardapioRow
                  key={produto.id}
                  produto={produto}
                  quantidade={quantidadesPorProduto.get(produto.id) ?? 0}
                  adicionar={carrinho.adicionar}
                  remover={carrinho.remover}
                  definirQuantidade={carrinho.definirQuantidade}
                  onAgendarFritura={abrirAgendamentoFritura}
                />
              ))}
            </div>
          </section>
        );
      })}

      <CarrinhoResumo />

      {produtoAgendamento && (
        <AgendarFrituraModal
          produto={produtoAgendamento}
          autenticado={!!user}
          onRequestLogin={() => setMostrarLoginAgendamento(true)}
          onClose={() => setProdutoAgendamento(null)}
        />
      )}

      {mostrarLoginAgendamento && (
        <LoginSheet
          titulo="Entre para solicitar"
          subtitulo="Confirme seu WhatsApp para enviarmos o retorno do agendamento."
          onClose={() => setMostrarLoginAgendamento(false)}
          onSuccess={() => setMostrarLoginAgendamento(false)}
        />
      )}
    </div>
  );
}
