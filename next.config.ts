import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // unoptimized: o proxy de otimização do Next (/_next/image) roda numa
    // Cloud Function via Firebase Hosting (frameworksBackend) e, com o Next
    // 16.2.10 atual, esse endpoint responde 400 "url parameter is not
    // allowed" pra QUALQUER imagem remota em produção — confirmado direto na
    // function (bypassando o Hosting) e mesmo após um deploy 100% limpo (sem
    // cache local nenhum), com o remotePatterns certinho no
    // required-server-files.json gerado. Ou seja: não é config errada nem
    // cache — é o adapter do Firebase pra essa versão do Next que não expõe
    // o otimizador corretamente. Como as fotos (Storage e CDN do
    // InstaDelivery) já chegam pré-redimensionadas em 500x500, servir o
    // arquivo original direto (sem WebP/AVIF automático) é um trade-off
    // aceitável pra manter as imagens funcionando. Revisar se atualizar
    // firebase-tools/Next resolver o otimizador de verdade.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      {
        // Produtos sincronizados do InstaDelivery têm foto nesse CDN, não
        // no Firebase Storage.
        protocol: "https",
        hostname: "instadelivery-public.nyc3.cdn.digitaloceanspaces.com",
      },
    ],
  },
};

export default nextConfig;
