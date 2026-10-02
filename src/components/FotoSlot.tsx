"use client";

import Image from "next/image";
import { useState } from "react";

// Espaço reservado pra foto que ainda não existe no repositório —
// public/fotos/{arquivo}. Enquanto o arquivo não chega, mostra um placeholder
// tracejado com o nome esperado; assim que alguém colocar o arquivo com esse
// nome exato em public/fotos/, a foto aparece sozinha, sem mexer em código.
export default function FotoSlot({
  arquivo,
  alt,
  legenda,
  className = "",
  priority = false,
}: {
  arquivo: string;
  alt: string;
  legenda: string;
  className?: string;
  priority?: boolean;
}) {
  const [erro, setErro] = useState(false);
  const src = `/fotos/${arquivo}`;

  if (erro) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-300 bg-neutral-100 text-center p-4 ${className}`}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-300" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <p className="text-neutral-400 text-[12px] font-semibold leading-snug">{legenda}</p>
        <p className="text-neutral-300 text-[10px] font-mono">public/fotos/{arquivo}</p>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      unoptimized
      priority={priority}
      className={`object-cover ${className}`}
      onError={() => setErro(true)}
    />
  );
}
