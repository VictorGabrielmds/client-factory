"use client";

import { useState, type KeyboardEvent } from "react";

const QUANTIDADE_MAXIMA = 100;

interface QuantidadeInputProps {
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  definirQuantidade: (produtoId: string, quantidade: number) => void;
  className?: string;
}

/**
 * Mantém o texto digitado separado da quantidade confirmada no carrinho.
 * Assim o cliente pode apagar "1" e escrever "20" sem o item ser removido
 * e sem o campo desmontar/perder o foco enquanto fica vazio por um instante.
 */
export default function QuantidadeInput({
  produtoId,
  produtoNome,
  quantidade,
  definirQuantidade,
  className = "",
}: QuantidadeInputProps) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const valorExibido = rascunho ?? String(quantidade);

  const confirmar = () => {
    if (rascunho === null) return;

    const numero = Number(rascunho);
    if (rascunho !== "" && Number.isInteger(numero) && numero >= 1) {
      definirQuantidade(produtoId, Math.min(numero, QUANTIDADE_MAXIMA));
    }

    // Vazio ou inválido volta à quantidade anterior. Para excluir o item,
    // o cliente usa os controles explícitos "−" ou "Remover".
    setRascunho(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmar();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setRascunho(null);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={valorExibido}
      onFocus={(event) => {
        setRascunho(String(quantidade));
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const somenteDigitos = event.target.value.replace(/\D/g, "").slice(0, 3);
        setRascunho(somenteDigitos);
      }}
      onBlur={confirmar}
      onKeyDown={handleKeyDown}
      aria-label={`Quantidade de ${produtoNome}. Digite de 1 a ${QUANTIDADE_MAXIMA}.`}
      title="Clique para digitar a quantidade"
      className={className}
    />
  );
}
