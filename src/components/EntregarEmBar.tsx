"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, MapPin, Store, Truck, X } from "lucide-react";
import { useCarrinho, type Endereco, type TipoEntrega } from "../contexts/CarrinhoContext";
import BairroAutocomplete from "./BairroAutocomplete";

function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.replace(/(\d{5})(\d)/, "$1-$2");
}

// Barra fixa no topo do cardápio, no estilo iFood/Rappi: mostra onde o
// pedido vai ser recebido e deixa trocar isso (tipo de entrega + endereço)
// num modal rápido, sem precisar entrar no checkout pra só ajustar isso.
export default function EntregarEmBar() {
  const { tipoEntrega, endereco, bairrosEntrega, salvarEnderecoPerfil, salvandoEndereco, enderecosSalvos } = useCarrinho();

  const [aberto, setAberto] = useState(false);
  const [rascunhoTipo, setRascunhoTipo] = useState<TipoEntrega>(tipoEntrega);
  const [rascunhoEndereco, setRascunhoEndereco] = useState<Endereco>(endereco);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Trava o scroll do body enquanto o modal está aberto
  useEffect(() => {
    if (aberto) {
      const overflowOriginal = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = overflowOriginal;
      };
    }
  }, [aberto]);

  const abrir = () => {
    setRascunhoTipo(tipoEntrega);
    setRascunhoEndereco(endereco);
    setErroSalvar(null);
    setCepErro(null);
    setAberto(true);
  };

  const definirRascunho = (campo: keyof Endereco, valor: string) => {
    setRascunhoEndereco((atual) => ({ ...atual, [campo]: valor }));
  };

  const escolherEnderecoSalvo = (salvo: (typeof enderecosSalvos)[number]) => {
    setRascunhoEndereco({
      cep: salvo.cep,
      logradouro: salvo.logradouro,
      numero: salvo.numero,
      complemento: salvo.complemento,
      bairro: salvo.bairro,
      referencia: salvo.referencia,
    });
  };

  const handleCepChange = async (valor: string) => {
    const formatado = formatarCep(valor);
    definirRascunho("cep", formatado);
    setCepErro(null);
    const digitos = formatado.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setCepErro("CEP não encontrado — preencha manualmente.");
      } else {
        definirRascunho("logradouro", dados.logradouro || "");
        definirRascunho("bairro", dados.bairro || "");
      }
    } catch {
      setCepErro("Não foi possível buscar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const enderecoValido =
    rascunhoTipo !== "delivery" ||
    (!!rascunhoEndereco.logradouro.trim() && !!rascunhoEndereco.numero.trim() && !!rascunhoEndereco.bairro.trim());

  const handleSalvar = async () => {
    if (!enderecoValido) {
      setErroSalvar("Preencha rua, número e bairro.");
      return;
    }
    const ok = await salvarEnderecoPerfil(rascunhoTipo, rascunhoEndereco);
    if (ok) setAberto(false);
    else setErroSalvar("Não foi possível salvar. Tente novamente.");
  };

  const resumo =
    tipoEntrega === "delivery"
      ? [endereco.bairro, endereco.logradouro.replace(/^Rua\s+/i, "R. ")]
          .filter(Boolean)
          .join(", ") || "Escolha seu endereço"
      : "Retirada no balcão";

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={() => !salvandoEndereco && setAberto(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="entregar-em-titulo"
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <MapPin size={19} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">
                Entrega
              </p>
              <h2 id="entregar-em-titulo" className="truncate text-lg font-bold tracking-[-0.02em] text-black">
                Onde você quer receber?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAberto(false)}
            disabled={salvandoEndereco}
            aria-label="Fechar seleção de entrega"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
          >
            <X size={17} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setRascunhoTipo("retirada")}
            className={`rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              rascunhoTipo === "retirada" ? "border-blue-200 bg-blue-50/70 ring-1 ring-blue-100" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${
              rascunhoTipo === "retirada" ? "bg-blue-600 text-white" : "bg-white text-neutral-600 shadow-sm"
            }`}>
              <Store size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="block text-sm font-semibold text-black">Retirada</span>
            <span className="mt-0.5 block text-[11px] text-neutral-500">Retirar no balcão</span>
          </button>
          <button
            type="button"
            onClick={() => setRascunhoTipo("delivery")}
            className={`rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              rascunhoTipo === "delivery" ? "border-blue-200 bg-blue-50/70 ring-1 ring-blue-100" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <span className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl ${
              rascunhoTipo === "delivery" ? "bg-blue-600 text-white" : "bg-white text-neutral-600 shadow-sm"
            }`}>
              <Truck size={16} strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="block text-sm font-semibold text-black">Delivery</span>
            <span className="mt-0.5 block text-[11px] text-neutral-500">Receber no endereço</span>
          </button>
        </div>

        {rascunhoTipo === "delivery" && enderecosSalvos.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-neutral-500 mb-2">Endereços salvos</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {enderecosSalvos.map((salvo) => (
                <button
                  key={salvo.id}
                  type="button"
                  onClick={() => escolherEnderecoSalvo(salvo)}
                  className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:border-neutral-300 transition"
                >
                  <span className="block font-semibold text-xs text-black">{salvo.rotulo}</span>
                  <span className="block text-[11px] text-neutral-500 max-w-[160px] truncate">{salvo.bairro}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {rascunhoTipo === "delivery" && (
          <div className="flex flex-col gap-3 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="entregarem-cep" className="block text-xs font-medium text-neutral-500 mb-1">CEP</label>
                <input
                  id="entregarem-cep"
                  type="text"
                  inputMode="numeric"
                  value={rascunhoEndereco.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                {buscandoCep && <p className="text-xs text-neutral-400 mt-1">Buscando...</p>}
                {cepErro && <p className="text-xs text-amber-600 mt-1">{cepErro}</p>}
              </div>
              <div>
                <label htmlFor="entregarem-numero" className="block text-xs font-medium text-neutral-500 mb-1">Número</label>
                <input
                  id="entregarem-numero"
                  type="text"
                  value={rascunhoEndereco.numero}
                  onChange={(e) => definirRascunho("numero", e.target.value)}
                  placeholder="123"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
            <div>
              <label htmlFor="entregarem-rua" className="block text-xs font-medium text-neutral-500 mb-1">Rua</label>
              <input
                id="entregarem-rua"
                type="text"
                value={rascunhoEndereco.logradouro}
                onChange={(e) => definirRascunho("logradouro", e.target.value)}
                placeholder="Nome da rua"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div>
              <label htmlFor="entregarem-bairro" className="block text-xs font-medium text-neutral-500 mb-1">Bairro</label>
              <BairroAutocomplete
                id="entregarem-bairro"
                value={rascunhoEndereco.bairro}
                bairros={bairrosEntrega}
                onChange={(valor) => definirRascunho("bairro", valor)}
              />
            </div>
          </div>
        )}

        {erroSalvar && <p className="text-sm text-red-600 mb-3">{erroSalvar}</p>}

        <div className="flex gap-3">
          <button
            onClick={() => setAberto(false)}
            disabled={salvandoEndereco}
            className="flex-1 bg-white border border-neutral-200 text-black font-semibold text-sm py-3 rounded-xl disabled:opacity-40 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvandoEndereco}
            className="flex-[2] bg-color-primary text-white font-bold text-sm py-3 rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {salvandoEndereco ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={`Alterar forma de entrega. ${resumo}`}
        title={resumo}
        className="group flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 text-left text-black transition hover:bg-neutral-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          tipoEntrega === "delivery"
            ? "bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
            : "bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200"
        }`}>
          {tipoEntrega === "delivery"
            ? <MapPin size={15} strokeWidth={2} aria-hidden="true" />
            : <Store size={15} strokeWidth={1.9} aria-hidden="true" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="mb-0.5 text-[11px] font-medium tracking-[-0.005em] text-neutral-500">
            {tipoEntrega === "delivery" ? "Entregar em" : "Modalidade"}
          </span>
          <span className="truncate text-[13px] font-semibold tracking-[-0.015em] text-neutral-950">
            {resumo}
          </span>
        </span>
        <ChevronRight
          size={15}
          strokeWidth={1.9}
          aria-hidden="true"
          className="shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-600"
        />
      </button>

      {aberto && typeof document !== "undefined" && createPortal(modal, document.body)}
    </>
  );
}
