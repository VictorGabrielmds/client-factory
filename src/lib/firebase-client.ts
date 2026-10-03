import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Evita inicializar o Firebase duas vezes no Next.js
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// App Check só existe no browser (usa reCAPTCHA) e só faz sentido com a site
// key configurada — sem ela as functions com enforceAppCheck vão rejeitar
// as chamadas, mas isso é melhor do que inicializar com uma key vazia.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  // reCAPTCHA v3 não funciona de forma confiável em localhost (depende de
  // sinais de tráfego real). Em dev, isso ativa o modo de debug token do
  // App Check. Sem NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN definido, a SDK gera um
  // token ALEATÓRIO NOVO a cada reload (só serve pra descobrir o primeiro
  // token, nunca fica válido de fato). Depois de cadastrar um token em
  // Console → App Check → Apps → Manage debug tokens, cole esse mesmo valor
  // em NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN para fixá-lo.
  // `process.env.NODE_ENV` é embutido pelo Next.js no build — nunca é
  // "development" num build de produção, então isso não vaza pra prod.
  if (process.env.NODE_ENV !== "production") {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN || true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Cache persistente (IndexedDB) no navegador: com internet ruim ou caindo,
// cardápio e acompanhamento do pedido (incluindo o QR/copia-e-cola do PIX)
// continuam aparecendo a partir da última versão recebida, inclusive depois
// de recarregar a página. O servidor continua validando tudo em criarPedido.
// No SSR, ou se o navegador não deixar usar IndexedDB, cai no cache em memória.
function criarFirestore(): Firestore {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Já inicializado (hot reload) ou IndexedDB indisponível.
    return getFirestore(app);
  }
}

const db = criarFirestore();
const auth = getAuth(app);
const functions = getFunctions(app, "southamerica-east1");

export { app, db, auth, functions };