"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Wrapper leve pra animação de entrada ao rolar a página — sem lib externa
// (framer-motion etc. não estão instalados), só IntersectionObserver +
// a keyframe "fade-up-in" já definida em globals.css. Dispara uma vez só
// (unobserve depois de visível) pra não re-animar toda vez que rola pra
// cima e pra baixo.
export default function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true);
          observer.unobserve(elemento);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${visivel ? "fade-up-in" : "opacity-0"} ${className}`}
      style={visivel ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
