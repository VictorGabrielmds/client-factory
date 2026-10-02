"use client";

type Passo = 1 | 2 | 3;

const ROTULOS: Record<Passo, string> = {
  1: "Itens",
  2: "Entrega",
  3: "Resumo",
};

const PASSOS: Passo[] = [1, 2, 3];

interface StepIndicatorProps {
  passoAtual: Passo;
  onIrParaPasso: (passo: Passo) => void;
}

// Indicador de progresso do checkout — só permite voltar pra um passo já
// concluído (clique em passo futuro não faz nada, já que ele depende de
// validação do anterior).
export default function StepIndicator({ passoAtual, onIrParaPasso }: StepIndicatorProps) {
  return (
    <ol className="flex items-start w-full max-w-md mx-auto px-2" aria-label="Etapas do pedido">
      {PASSOS.map((passo, index) => {
        const concluido = passo < passoAtual;
        const ativo = passo === passoAtual;
        const clicavel = concluido;

        return (
          <li key={passo} className="flex-1 flex flex-col items-center relative">
            {index > 0 && (
              <div
                className={`absolute top-4 right-1/2 w-full h-px transition-colors duration-300 ${
                  passo <= passoAtual ? "bg-blue-500" : "bg-white/20"
                }`}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => clicavel && onIrParaPasso(passo)}
              disabled={!clicavel}
              aria-current={ativo ? "step" : undefined}
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold transition-all duration-300 ${
                ativo
                  ? "bg-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.25)]"
                  : concluido
                    ? "bg-white/90 text-black cursor-pointer hover:bg-white"
                    : "bg-white/10 text-white/50 cursor-default"
              }`}
            >
              {concluido ? "✓" : passo}
            </button>
            <span
              className={`mt-2 text-[11px] tracking-wide uppercase transition-colors ${
                ativo ? "text-white font-semibold" : concluido ? "text-white/80" : "text-white/40"
              }`}
            >
              {ROTULOS[passo]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
