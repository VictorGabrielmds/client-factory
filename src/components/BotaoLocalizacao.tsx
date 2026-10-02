"use client";

import { MapPin } from "lucide-react";
import { useCarrinho } from "../contexts/CarrinhoContext";

// Botão "Como chegar" — só aparece se a loja tiver um link cadastrado no
// painel (configuracoes/geral, aba Configurações gerais). Quem decide ONDE
// mostrar (cardápio, tela de pedido) é o componente que usa este aqui,
// sempre condicionado a ser retirada — pra delivery não faz sentido.
export default function BotaoLocalizacao() {
  const { enderecoLojaLink, enderecoLojaTexto } = useCarrinho();

  if (!enderecoLojaLink) return null;

  return (
    <a
      href={enderecoLojaLink}
      target="_blank"
      rel="noopener noreferrer"
      title={enderecoLojaTexto || "Ver localização da loja"}
      aria-label="Como chegar à loja"
      className="flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 sm:w-auto sm:px-3 sm:text-[12px] sm:font-medium"
    >
      <MapPin size={15} strokeWidth={1.9} aria-hidden="true" />
      <span className="hidden sm:inline">Como chegar</span>
    </a>
  );
}
