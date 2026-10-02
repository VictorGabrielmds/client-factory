"use client";

import { useCarrinho } from "../contexts/CarrinhoContext";

// Bolha flutuante padrão de storefront — some se a loja não tiver WhatsApp
// cadastrado (configuracoes/geral). Fica acima da CarrinhoResumo (mesmo
// canto), mas com z-index menor pra não competir com o carrinho quando os
// dois aparecem juntos.
export default function BotaoWhatsapp() {
  const { whatsappLoja } = useCarrinho();

  if (!whatsappLoja) return null;

  return (
    <a
      href={`https://wa.me/${whatsappLoja}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
      className="fixed bottom-24 right-4 z-30 w-11 h-11 flex items-center justify-center rounded-full bg-white text-[#25D366] border border-neutral-100/80 shadow-sm hover:bg-neutral-50 active:scale-95 transition"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2c-5.5 0-10 4.49-10 10.02 0 1.77.46 3.5 1.34 5.02L2 22l5.09-1.34a10 10 0 0 0 4.95 1.3h.01c5.5 0 10-4.49 10-10.02C22.05 6.49 17.55 2 12.04 2Zm0 18.3c-1.56 0-3.08-.42-4.4-1.2l-.32-.19-3.02.8.81-2.95-.2-.3a8.26 8.26 0 0 1-1.27-4.44c0-4.58 3.73-8.3 8.32-8.3 2.22 0 4.31.87 5.88 2.44a8.24 8.24 0 0 1 2.43 5.87c0 4.58-3.73 8.27-8.23 8.27Zm4.55-6.2c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.24-.64.8-.79.97-.14.17-.29.18-.54.06-.25-.12-1.04-.38-1.98-1.22a7.4 7.4 0 0 1-1.37-1.7c-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.42.06-.65.31-.22.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.17 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.19.21-.58.21-1.08.15-1.19-.06-.11-.23-.17-.48-.29Z" />
      </svg>
    </a>
  );
}
