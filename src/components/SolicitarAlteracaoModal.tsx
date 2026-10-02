"use client";

import { useMemo, useState } from "react";
import { httpsCallable, FunctionsError } from "firebase/functions";
import { functions } from "../lib/firebase-client";
import { useCarrinho } from "../contexts/CarrinhoContext";
import type { Endereco, UltimoPedido } from "../contexts/CarrinhoContext";
import BairroAutocomplete from "./BairroAutocomplete";

interface SolicitarAlteracaoModalProps {
  pedido: UltimoPedido;
  onClose: () => void;
}

const ENDERECO_VAZIO: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  referencia: "",
};

interface OpcaoToggleProps {
  marcado: boolean;
  onToggle: (marcado: boolean) => void;
  titulo: string;
  children?: React.ReactNode;
}

// Linha "checkbox" clicável em qualquer lugar — só abre o preenchimento
// detalhado (children) depois de marcada, pra não jogar formulário inteiro
// na cara do cliente antes dele escolher o que realmente quer mudar.
function OpcaoToggle({ marcado, onToggle, titulo, children }: OpcaoToggleProps) {
  return (
    <div className={`rounded-xl border transition ${marcado ? "border-black bg-neutral-50" : "border-neutral-200"}`}>
      <label className="flex items-center gap-3 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4 h-4 accent-blue-600 shrink-0"
        />
        <span className="text-sm font-semibold text-black">{titulo}</span>
      </label>
      {marcado && children && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Envia a solicitação pra Cloud Function solicitarAlteracao, que injeta a
// mensagem direto na conversa do painel como se fosse recebida de verdade
// pelo WhatsApp — o cliente nunca precisa abrir o próprio WhatsApp.
export default function SolicitarAlteracaoModal({ pedido, onClose }: SolicitarAlteracaoModalProps) {
  const { produtos, bairrosEntrega } = useCarrinho();

  const [secaoAdicionar, setSecaoAdicionar] = useState(false);
  const [itensAdicionar, setItensAdicionar] = useState<Record<string, number>>({});
  const [buscaAdicionar, setBuscaAdicionar] = useState("");

  const [secaoRemover, setSecaoRemover] = useState(false);
  const [itensRemover, setItensRemover] = useState<Set<number>>(new Set());

  const [trocarEntrega, setTrocarEntrega] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState<Endereco>(ENDERECO_VAZIO);

  const [secaoObs, setSecaoObs] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const tipoEntregaOposto = pedido.tipoEntrega === "delivery" ? "retirada" : "delivery";

  const produtosFiltrados = useMemo(() => {
    const termo = buscaAdicionar.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [produtos, buscaAdicionar]);

  const toggleSecaoAdicionar = (marcado: boolean) => {
    setSecaoAdicionar(marcado);
    if (!marcado) setItensAdicionar({});
  };

  const toggleSecaoRemover = (marcado: boolean) => {
    setSecaoRemover(marcado);
    if (!marcado) setItensRemover(new Set());
  };

  const toggleTrocarEntrega = (marcado: boolean) => {
    setTrocarEntrega(marcado);
    if (!marcado) setNovoEndereco(ENDERECO_VAZIO);
  };

  const toggleSecaoObs = (marcado: boolean) => {
    setSecaoObs(marcado);
    if (!marcado) setObservacoes("");
  };

  const toggleRemoverItem = (index: number) => {
    setItensRemover((atual) => {
      const copia = new Set(atual);
      if (copia.has(index)) copia.delete(index);
      else copia.add(index);
      return copia;
    });
  };

  const definirQuantidadeAdicionar = (produtoId: string, quantidade: number) => {
    setItensAdicionar((atual) => {
      if (quantidade <= 0) {
        const copia = { ...atual };
        delete copia[produtoId];
        return copia;
      }
      return { ...atual, [produtoId]: quantidade };
    });
  };

  const podeEnviar =
    Object.keys(itensAdicionar).length > 0 || itensRemover.size > 0 || trocarEntrega || observacoes.trim() !== "";

  const [enviando, setEnviando] = useState(false);
  const [erroEnviar, setErroEnviar] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const handleEnviar = async () => {
    if (enviando) return;
    setEnviando(true);
    setErroEnviar(null);
    try {
      const chamar = httpsCallable<
        {
          orderId: string;
          idempotencyKey: string;
          itensAdicionar: { produtoId: string; quantidade: number }[];
          itensRemoverIndices: number[];
          trocarEntrega: boolean;
          novoEndereco: Endereco | null;
          observacoes: string;
        },
        { sucesso: boolean }
      >(functions, "solicitarAlteracao");

      await chamar({
        orderId: pedido.orderId,
        idempotencyKey: crypto.randomUUID(),
        itensAdicionar: Object.entries(itensAdicionar).map(([produtoId, quantidade]) => ({ produtoId, quantidade })),
        itensRemoverIndices: [...itensRemover],
        trocarEntrega,
        novoEndereco: trocarEntrega && tipoEntregaOposto === "delivery" ? novoEndereco : null,
        observacoes: observacoes.trim(),
      });

      setEnviado(true);
    } catch (err) {
      setErroEnviar(
        err instanceof FunctionsError ? err.message : "Não foi possível enviar sua solicitação. Tente novamente."
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl p-6 pb-8 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {enviado ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl">
              ✓
            </div>
            <h2 className="text-lg font-bold text-black">Enviado!</h2>
            <p className="text-sm text-neutral-500">A loja já recebeu sua solicitação de alteração.</p>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-2 bg-color-primary text-white font-bold text-base py-3.5 rounded-full hover:bg-neutral-800 transition active:scale-[0.98]"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
        <h2 className="text-lg font-bold text-black mb-1">Solicitar alteração</h2>
        <p className="text-sm text-neutral-500 mb-5">
          Pedido #{pedido.orderId} — marque o que quer mudar:
        </p>

        <div className="flex flex-col gap-2 mb-6">
          <OpcaoToggle marcado={secaoAdicionar} onToggle={toggleSecaoAdicionar} titulo="Adicionar itens">
            <input
              type="search"
              value={buscaAdicionar}
              onChange={(e) => setBuscaAdicionar(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full mb-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
              {produtosFiltrados.map((produto) => {
                const quantidade = itensAdicionar[produto.id] ?? 0;
                return (
                  <div key={produto.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-neutral-700 truncate">{produto.nome}</span>
                    <div className="flex items-center gap-2 bg-blue-50 rounded-full px-1.5 py-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => definirQuantidadeAdicionar(produto.id, Math.max(0, quantidade - 1))}
                        aria-label={`Remover uma unidade de ${produto.nome}`}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold text-xs shadow-sm"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-black">{quantidade}</span>
                      <button
                        type="button"
                        onClick={() => definirQuantidadeAdicionar(produto.id, quantidade + 1)}
                        aria-label={`Adicionar uma unidade de ${produto.nome}`}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-blue-600 font-bold text-xs shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </OpcaoToggle>

          {pedido.descricaoItem.length > 0 && (
            <OpcaoToggle marcado={secaoRemover} onToggle={toggleSecaoRemover} titulo="Remover itens do pedido">
              <div className="flex flex-col gap-2">
                {pedido.descricaoItem.map((nome, index) => (
                  <label key={index} className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={itensRemover.has(index)}
                      onChange={() => toggleRemoverItem(index)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    {pedido.quantidadeItem[index]}x {nome}
                  </label>
                ))}
              </div>
            </OpcaoToggle>
          )}

          <OpcaoToggle
            marcado={trocarEntrega}
            onToggle={toggleTrocarEntrega}
            titulo={`Mudar para ${tipoEntregaOposto === "delivery" ? "delivery" : "retirada"}`}
          >
            {tipoEntregaOposto === "delivery" && (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={novoEndereco.logradouro}
                    onChange={(e) => setNovoEndereco((a) => ({ ...a, logradouro: e.target.value }))}
                    placeholder="Rua"
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={novoEndereco.numero}
                    onChange={(e) => setNovoEndereco((a) => ({ ...a, numero: e.target.value }))}
                    placeholder="Número"
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <BairroAutocomplete
                  value={novoEndereco.bairro}
                  bairros={bairrosEntrega}
                  onChange={(valor) => setNovoEndereco((a) => ({ ...a, bairro: valor }))}
                />
              </div>
            )}
          </OpcaoToggle>

          <OpcaoToggle marcado={secaoObs} onToggle={toggleSecaoObs} titulo="Adicionar observações">
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Outros detalhes..."
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
            />
          </OpcaoToggle>
        </div>

        {erroEnviar && (
          <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-3 py-2 mb-3">{erroEnviar}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-semibold text-base py-3.5 rounded-full hover:bg-neutral-50 transition active:scale-[0.98] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!podeEnviar || enviando}
            className="flex-[2] bg-green-600 text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-green-700 disabled:opacity-50 transition active:scale-[0.98]"
          >
            {enviando ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
