import type { Metadata } from "next";
import { Geist, Geist_Mono, Caveat } from "next/font/google";
import "./globals.css";
import { CarrinhoProvider } from "../contexts/CarrinhoContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fonte "caneta" — usada só em detalhes pontuais da landing (/) pra dar um
// toque humano/artesanal, nunca em texto longo ou informação séria.
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fábrica dos Salgados",
  description: "Peça seus salgados favoritos da Fábrica dos Salgados — cardápio, entrega e retirada.",
  openGraph: {
    title: "Fábrica dos Salgados",
    description: "Peça seus salgados favoritos da Fábrica dos Salgados — cardápio, entrega e retirada.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CarrinhoProvider>{children}</CarrinhoProvider>
      </body>
    </html>
  );
}
