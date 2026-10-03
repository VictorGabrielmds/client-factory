"use client";

import { useOffline } from "../lib/rede";

// Faixa fixa no topo enquanto o aparelho está sem internet — antes, numa
// queda de conexão, os botões só "não faziam nada" ou ficavam carregando,
// sem o cliente entender o porquê.
export default function AvisoConexao() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[70] bg-amber-500 text-black text-center text-xs font-semibold px-4 py-1.5 shadow"
    >
      Sem internet. Seu carrinho fica salvo e tudo volta a atualizar quando a conexão voltar.
    </div>
  );
}
