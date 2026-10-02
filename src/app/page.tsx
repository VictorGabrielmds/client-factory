"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useCarrinho } from "../contexts/CarrinhoContext";
import HorarioFuncionamentoCard from "../components/HorarioFuncionamentoCard";
import Reveal from "../components/Reveal";

const CATEGORIAS_VITRINE = [
  {
    nome: "Salgados Tradicionais",
    linha: "Coxinha, croquete, rissole, quibe",
    imagem: "/categorias/salgados-tradicionais-cropped.png",
    rotacao: "-rotate-2",
  },
  {
    nome: "Salgados de Forno",
    linha: "Esfirra, quiche, pastel húngaro",
    imagem: "/categorias/salgados-forno.png",
    rotacao: "rotate-2",
  },
  {
    nome: "Salgados Especiais",
    linha: "Camarão empanado, mini pizza, pão de queijo",
    imagem: "/categorias/salgados-especiais.png",
    rotacao: "-rotate-1",
  },
];

function RabiscoLinha({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 14" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 9C42 2 78 12 101 6C132 -1 162 11 198 5"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Adesivo circular tipo etiqueta de embalagem — personalidade sem depender
// de cor fora da paleta (preto/azul/branco), só rotação + contraste.
function Adesivo({ texto, className = "" }: { texto: string; className?: string }) {
  return (
    <span
      className={`absolute z-10 flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white text-[11px] font-bold text-center leading-tight px-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.25)] border-2 border-white ${className}`}
    >
      {texto}
    </span>
  );
}

// Linhas concêntricas — textura gráfica atrás do prato de destaque, no
// espírito do "grooves" retrô, só que em preto/azul translúcido em vez de
// laranja, pra ficar de acordo com as cores da casa.
function OndasCirculares({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 440" fill="none" className={className} aria-hidden="true">
      {[36, 66, 96, 126, 156, 186, 216].map((r) => (
        <circle key={r} cx="220" cy="220" r={r} stroke="currentColor" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

function Selo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 8c-1-2.5 0-5.5 2.5-6C10 1.6 11 3 12 3s2-1.4 3.5-1c2.5.5 3.5 3.5 2.5 6 2.5 1 3.5 4 2 6-1.5 2-.5 5-3 6-2.5 1-3.5-1-5-1s-2.5 2-5 1c-2.5-1-1.5-4-3-6-1.5-2-.5-5 2-6Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="m8.5 12.5 2.3 2.3L16 9.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home() {
  const { produtos, whatsappLoja, enderecoLojaTexto, enderecoLojaLink } = useCarrinho();

  // Letreiro com nomes de verdade do cardápio — cai pra um texto genérico
  // enquanto os produtos ainda não chegaram do Firestore (primeiros
  // segundos de carga), nunca fica em branco.
  const letreiro = useMemo(() => {
    const nomes = Array.from(
      new Set(
        produtos
          .map((p) =>
            p.nome
              .replace(/\s*\([^)]*\)/g, "")
              .split("-")[0]
              .replace(/\s+/g, " ")
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );
    return nomes.length > 0
      ? nomes
      : ["FEITO NA HORA", "TODOS OS DIAS", "SEM PRESSA DE SOBRAR SABOR"];
  }, [produtos]);
  const letreiroTexto = `${letreiro.join("  ·  ")}  ·  `;

  const linkMapa = enderecoLojaTexto
    ? `https://www.google.com/maps?q=${encodeURIComponent(enderecoLojaTexto)}&output=embed`
    : null;
  const linkRota =
    enderecoLojaLink ||
    (enderecoLojaTexto
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoLojaTexto)}`
      : "");

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* ─── HERO — foto real da equipe e dos clientes como cenário ─── */}
      <header className="relative isolate min-h-[680px] h-[92svh] max-h-[920px] overflow-hidden bg-neutral-950 px-5 sm:px-8 text-white">
        <Image
          src="/fotos/pessoas-hero-quiches.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center md:object-[center_30%]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.42)_32%,rgba(0,0,0,0.58)_68%,rgba(0,0,0,0.86)_100%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.16)_55%,rgba(0,0,0,0.44)_100%)]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 grain-overlay opacity-[0.055] pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 flex h-full max-w-6xl mx-auto flex-col">
          <nav className="flex items-center justify-between pt-6 sm:pt-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/25 text-[12px] font-extrabold backdrop-blur-sm">
                FS
              </span>
              <span className="hidden text-[12px] font-bold tracking-[0.18em] uppercase text-white sm:block">
                Fábrica dos Salgados
              </span>
            </div>
            <Link
              href="/cardapio"
              className="rounded-full border border-white/30 bg-black/20 px-4 py-2 text-[12px] font-semibold text-white backdrop-blur-sm transition hover:border-white/60 hover:bg-black/35"
            >
              Ver cardápio
            </Link>
          </nav>

          <div className="flex flex-1 items-center justify-center py-12 text-center">
            <div className="flex max-w-4xl flex-col items-center">
              <span className="fade-up-in inline-flex items-center rounded-full border border-white/30 bg-black/25 px-4 py-2 text-[10px] font-bold tracking-[0.18em] text-white/90 uppercase backdrop-blur-sm sm:text-[11px]">
                São Luís · Maranhão · Desde 2013
              </span>

              <h1
                className="fade-up-in mt-6 text-[52px] leading-[0.9] font-black tracking-[-0.055em] text-white uppercase drop-shadow-[0_4px_22px_rgba(0,0,0,0.55)] sm:text-[76px] lg:text-[100px]"
                style={{ animationDelay: "80ms" }}
              >
                Salgado bom
                <br />
                tem{" "}
                <span className="relative inline-block text-blue-400">
                  alma
                  <RabiscoLinha className="absolute -bottom-3 left-0 h-4 w-full text-blue-400" />
                </span>
              </h1>

              <p
                className="fade-up-in mt-7 max-w-xl text-[15px] leading-relaxed text-white/82 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)] sm:text-[18px]"
                style={{ animationDelay: "160ms" }}
              >
                Recheio de verdade, massa feita com cuidado e aquele sabor que
                transforma qualquer encontro em festa.
              </p>

              <div
                className="fade-up-in mt-9 flex flex-col items-center gap-4 sm:flex-row"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href="/cardapio"
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-blue-600 px-8 text-[15px] font-bold text-white shadow-[0_14px_35px_rgba(0,0,0,0.38)] transition hover:bg-blue-500 active:scale-[0.98]"
                >
                  Quero pedir agora
                </Link>
                {whatsappLoja && (
                  <a
                    href={`https://wa.me/${whatsappLoja}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/30 bg-black/20 px-6 text-[14px] font-semibold text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-black/35"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>

          <p className="pb-6 text-center text-[10px] font-semibold tracking-[0.18em] text-white/55 uppercase sm:pb-8">
            Role para conhecer
          </p>
        </div>
      </header>

      {/* ─── LETREIRO — bloco de cor cheio e tipografia grande, tipo rótulo
          de embalagem, não uma tarjinha fina de ticker ─── */}
      <div className="overflow-hidden border-y-2 border-black bg-blue-600 py-3 sm:py-4 select-none" aria-hidden="true">
        <div className="flex w-max marquee-track items-center">
          <span className="px-3 text-[16px] font-extrabold uppercase tracking-[0.01em] text-white whitespace-nowrap sm:text-[22px]">
            {letreiroTexto}
          </span>
          <span className="px-3 text-[16px] font-extrabold uppercase tracking-[0.01em] text-white whitespace-nowrap sm:text-[22px]">
            {letreiroTexto}
          </span>
        </div>
      </div>

      {/* ─── MACRO — close-up de tirar o fôlego ─── */}
      <section className="pt-20 sm:pt-28 max-w-6xl mx-auto px-5 sm:px-8">
        <Reveal>
          <p className="text-[13px] font-bold tracking-[0.2em] text-blue-600 uppercase mb-2">Feitos por nós</p>
          <h2 className="max-w-xl text-[30px] leading-[1.02] font-extrabold tracking-[-0.03em] text-black sm:text-[42px]">
            De perto dá para ver o cuidado em cada detalhe.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:gap-4 md:grid-cols-5">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-neutral-100 md:col-span-3 md:aspect-auto md:min-h-[560px]">
            <Image
              src="/fotos/salgados1.jpg"
              alt="Salgados dourados preparados pela Fábrica dos Salgados"
              fill
              sizes="(max-width: 768px) 100vw, 60vw"
              className="object-cover transition-transform duration-700 hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" aria-hidden="true" />
            <Adesivo texto="que cheiro!" className="top-3 right-3 -rotate-6" />
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:col-span-2 md:grid-cols-1">
            <Reveal delayMs={80} className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-neutral-100 md:aspect-auto">
              <Image
                src="/fotos/salgados2.jpg"
                alt="Variedade de salgados frescos da Fábrica dos Salgados"
                fill
                sizes="(max-width: 768px) 50vw, 40vw"
                className="object-cover transition-transform duration-700 hover:scale-[1.025]"
              />
            </Reveal>
            <Reveal delayMs={150} className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-neutral-100 md:aspect-auto">
              <Image
                src="/fotos/salgados3.jpg"
                alt="Bandeja de salgados prontos para servir"
                fill
                sizes="(max-width: 768px) 50vw, 40vw"
                className="object-cover transition-transform duration-700 hover:scale-[1.025]"
              />
              <Adesivo texto="fresquinho" className="bottom-3 left-3 rotate-3" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── VITRINE — as três linhas do cardápio ─── */}
      <section className="px-5 sm:px-8 pt-20 sm:pt-28 pb-4 max-w-6xl mx-auto">
        <Reveal>
          <p className="text-[13px] font-bold tracking-[0.2em] text-blue-600 uppercase mb-2">O cardápio</p>
          <h2 className="text-[30px] sm:text-[42px] font-extrabold text-black tracking-[-0.03em] leading-[1.02] max-w-lg">
            Três linhas de produção. Um padrão só: absurdamente bom.
          </h2>
        </Reveal>

        <div className="mt-10 sm:mt-14 grid md:grid-cols-3 gap-10 md:gap-6">
          {CATEGORIAS_VITRINE.map((categoria, index) => (
            <Reveal key={categoria.nome} delayMs={index * 90}>
              <Link href="/cardapio" className="group flex flex-col items-center text-center">
                <div className={`relative w-full max-w-[260px] aspect-square ${categoria.rotacao} transition-transform duration-500 group-hover:rotate-0 group-active:scale-95`}>
                  <div className="absolute inset-0 rounded-[28%] bg-neutral-100" aria-hidden="true" />
                  <Image
                    src={categoria.imagem}
                    alt={categoria.nome}
                    fill
                    unoptimized
                    className="object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.18)]"
                  />
                </div>
                <h3 className="text-[22px] sm:text-[25px] font-extrabold text-black tracking-[-0.02em] leading-[1.05] mt-5">
                  {categoria.nome}
                </h3>
                <p className="text-neutral-400 text-[14px] mt-1.5">{categoria.linha}</p>
                <span className="inline-flex items-center gap-1.5 text-blue-600 font-bold text-[13px] mt-3 group-hover:gap-2.5 transition-all">
                  Ver no cardápio
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── NOSSA HISTÓRIA — o momento "prato em destaque" ─── */}
      <section className="mt-24 sm:mt-32 px-5 sm:px-8 max-w-6xl mx-auto text-center">
        <Reveal>
          <p className="text-[13px] font-bold tracking-[0.2em] text-blue-600 uppercase mb-2">Desde 2013</p>
          <h2 className="text-[42px] sm:text-[64px] lg:text-[80px] leading-[0.92] font-extrabold text-black tracking-[-0.04em]">
            NOSSA
            <br />
            HISTÓRIA
          </h2>
        </Reveal>

        <Reveal delayMs={120} className="relative w-56 h-56 sm:w-72 sm:h-72 mx-auto mt-8">
          <OndasCirculares className="absolute -inset-16 sm:-inset-24 text-blue-600/10 pointer-events-none" />
          <div className="relative w-full h-full rounded-full overflow-hidden rotate-2 shadow-[0_24px_48px_rgba(0,0,0,0.22)] ring-8 ring-white">
            <Image
              src="/fotos/fabrica.png"
              alt="Fachada da Fábrica dos Salgados em São Luís"
              fill
              sizes="(max-width: 640px) 224px, 288px"
              className="object-cover object-center"
            />
          </div>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="text-[19px] sm:text-[23px] font-bold text-black tracking-[-0.01em] leading-[1.4] max-w-lg mx-auto mt-10">
            Começou numa cozinha pequena em São Luís, com a ideia mais simples do
            mundo: fazer salgado que lembra festa de família.
          </p>
          <p className="text-neutral-500 text-[15px] leading-relaxed max-w-lg mx-auto mt-4">
            A gente cresceu — hoje tem equipamento, produção em escala, uma equipe de
            verdade. Mas a receita não mudou de dono: cada lote ainda é conferido por
            quem entende do assunto, com os mesmos ingredientes de sempre. Crescer não
            virou desculpa pra facilitar.
          </p>
        </Reveal>
      </section>

      {/* ─── VISITE OU PEÇA — horário ao vivo + localização ─── */}
      <section className="mx-auto mt-24 max-w-6xl px-5 sm:mt-32 sm:px-8">
        <Reveal>
          <div className="overflow-hidden rounded-[36px] border border-neutral-200 bg-neutral-950 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
            <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
              <div className="relative flex flex-col p-7 text-white sm:p-10 lg:p-12">
                <Selo className="absolute right-7 top-7 h-10 w-10 text-blue-400 sm:right-10 sm:top-10" />
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-blue-400">
                  Localização
                </p>
                <h2 className="mt-4 max-w-sm text-[36px] font-extrabold leading-[0.98] tracking-[-0.04em] sm:text-[48px]">
                  VENHA BUSCAR QUENTINHO.
                </h2>
                <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
                  Consulte o horário de hoje e abra a melhor rota até a nossa loja.
                </p>

                <div className="mt-8">
                  <HorarioFuncionamentoCard />
                </div>

                {enderecoLojaTexto && (
                  <div className="mt-3 rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                      Endereço
                    </p>
                    <p className="mt-1.5 text-[14px] font-semibold leading-snug text-white">
                      {enderecoLojaTexto}
                    </p>
                    {linkRota && (
                      <a
                        href={linkRota}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-[12px] font-bold text-neutral-950 transition hover:bg-blue-50 active:scale-[0.98]"
                      >
                        Traçar rota ↗
                      </a>
                    )}
                  </div>
                )}

                <Link
                  href="/cardapio"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-blue-600 px-5 text-[14px] font-bold text-white transition hover:bg-blue-500 active:scale-[0.98]"
                >
                  Fazer meu pedido
                </Link>
              </div>

              <div className="relative min-h-[360px] overflow-hidden bg-neutral-100 lg:min-h-full">
                {linkMapa ? (
                  <iframe
                    src={linkMapa}
                    title="Localização da Fábrica dos Salgados no mapa"
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <Image
                    src="/fotos/fabrica.png"
                    alt="Fachada da Fábrica dos Salgados"
                    fill
                    sizes="(max-width: 1024px) 100vw, 56vw"
                    className="object-cover object-center"
                  />
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── RODAPÉ ─── */}
      <footer className="px-5 py-14 mt-20 text-center border-t border-neutral-100">
        <p className="text-[13px] font-bold tracking-[0.15em] text-black uppercase">Fábrica dos Salgados</p>
        <p className="text-neutral-400 text-[12px] mt-1">Feito com carinho, todos os dias, em São Luís — MA</p>
      </footer>
    </div>
  );
}
