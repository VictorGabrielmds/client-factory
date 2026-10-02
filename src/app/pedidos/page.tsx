"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";
import { useCarrinho } from "../../contexts/CarrinhoContext";

function formatarReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mesmos rótulos de STATUS_LABELS em factory-dashboard/functions/src/services/pedidos.js
function statusTexto(status: number | null, tipoEntrega: "delivery" | "retirada" | null) {
  switch (status) {
    case 1: return { texto: "Recebido", cor: "text-neutral-500 bg-neutral-100" };
    case 2: return { texto: "Em preparo", cor: "text-amber-700 bg-amber-50" };
    case 3: return { texto: tipoEntrega === "delivery" ? "Saiu para entrega" : "Pronto para retirada", cor: "text-blue-700 bg-blue-50" };
    case 4: return { texto: "Cancelado", cor: "text-red-700 bg-red-50" };
    case 5: return { texto: "Em rota de entrega", cor: "text-blue-700 bg-blue-50" };
    default: return { texto: "—", cor: "text-neutral-500 bg-neutral-100" };
  }
}

export default function PedidosPage() {
  const { user, loading } = useAuth();
  const { historicoPedidos, historicoPedidosCarregando, carregarHistoricoPedidos } = useCarrinho();

  useEffect(() => {
    if (user) carregarHistoricoPedidos();
  }, [user, carregarHistoricoPedidos]);

  return (
    <div className="min-h-screen bg-neutral-50 pb-16">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/perfil" className="text-neutral-500 hover:text-black transition" aria-label="Voltar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-extrabold tracking-tight text-black">Meus pedidos</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-4">
        {loading || historicoPedidosCarregando ? (
          <p className="text-sm text-neutral-400 text-center mt-10">Carregando pedidos...</p>
        ) : !user ? (
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 text-center flex flex-col items-center gap-3 mt-4">
            <span className="text-5xl">🔒</span>
            <h2 className="text-lg font-bold text-black">Faça login para ver seus pedidos</h2>
            <Link href="/cardapio" className="mt-2 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 transition">
              Voltar para o cardápio
            </Link>
          </div>
        ) : historicoPedidos.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-8 text-center flex flex-col items-center gap-3 mt-4">
            <span className="text-5xl">🥟</span>
            <h2 className="text-lg font-bold text-black">Nenhum pedido ainda</h2>
            <p className="text-sm text-neutral-500">Seus pedidos aparecem aqui depois que você fizer o primeiro.</p>
            <Link href="/cardapio" className="mt-2 w-full rounded-xl bg-blue-600 text-white font-semibold text-sm py-3 hover:bg-blue-700 transition">
              Ver cardápio
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mt-2">
            {historicoPedidos.map((pedido) => {
              const status = statusTexto(pedido.status, pedido.tipoEntrega);
              return (
                <Link
                  key={pedido.orderId}
                  href={`/pedido/${pedido.orderId}`}
                  className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex items-center justify-between gap-3 hover:border-neutral-200 transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-black">Pedido #{pedido.orderId}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {pedido.dataVenda ?? "—"} · {pedido.totalItensTexto}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-bold text-sm text-black">{formatarReal(pedido.valorVenda)}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cor}`}>
                      {status.texto}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
