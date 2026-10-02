"use client";

import { useRef, useState } from "react";
import { useCarrinho, type Endereco, type EnderecoSalvo, type TipoEntrega } from "../../contexts/CarrinhoContext";
import BairroAutocomplete from "../BairroAutocomplete";
import { formatarCep } from "./format";

interface PassoEntregaProps {
  tipoEntrega: TipoEntrega;
  definirTipoEntrega: (tipo: TipoEntrega) => void;
  endereco: Endereco;
  definirEndereco: (campo: keyof Endereco, valor: string) => void;
  bairrosEntrega: string[];
  onVoltar: () => void;
  onContinuar: () => void;
}

export default function PassoEntrega({
  tipoEntrega,
  definirTipoEntrega,
  endereco,
  definirEndereco,
  bairrosEntrega,
  onVoltar,
  onContinuar,
}: PassoEntregaProps) {
  const { enderecosSalvos } = useCarrinho();
  const [tentouContinuar, setTentouContinuar] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);
  const [enderecoSalvoSelecionadoId, setEnderecoSalvoSelecionadoId] = useState<string | null>(null);

  const escolherEnderecoSalvo = (salvo: EnderecoSalvo) => {
    setEnderecoSalvoSelecionadoId(salvo.id);
    definirEndereco("cep", salvo.cep);
    definirEndereco("logradouro", salvo.logradouro);
    definirEndereco("numero", salvo.numero);
    definirEndereco("complemento", salvo.complemento);
    definirEndereco("bairro", salvo.bairro);
    definirEndereco("referencia", salvo.referencia);
  };

  const logradouroRef = useRef<HTMLDivElement>(null);
  const numeroRef = useRef<HTMLDivElement>(null);
  const bairroRef = useRef<HTMLDivElement>(null);

  const bairroValido = bairrosEntrega.some(
    (b) => b.toLowerCase() === endereco.bairro.trim().toLowerCase()
  );
  const logradouroValido = !!endereco.logradouro.trim();
  const numeroValido = !!endereco.numero.trim();
  const enderecoValido = tipoEntrega !== "delivery" || (logradouroValido && numeroValido && bairroValido);

  const handleCepChange = async (valor: string) => {
    const formatado = formatarCep(valor);
    definirEndereco("cep", formatado);
    setCepErro(null);

    const digitos = formatado.replace(/\D/g, "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setCepErro("CEP não encontrado — preencha o endereço manualmente.");
      } else {
        definirEndereco("logradouro", dados.logradouro || "");
        definirEndereco("bairro", dados.bairro || "");
      }
    } catch {
      setCepErro("Não foi possível buscar o CEP — preencha manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleContinuar = () => {
    setTentouContinuar(true);
    if (!enderecoValido) {
      const primeiroErro = !logradouroValido ? logradouroRef : !numeroValido ? numeroRef : bairroRef;
      primeiroErro.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onContinuar();
  };

  const logradouroInvalido = tentouContinuar && !logradouroValido;
  const numeroInvalido = tentouContinuar && !numeroValido;
  const bairroInvalido = tentouContinuar && !bairroValido;

  const inputClasse = (invalido: boolean) =>
    `w-full rounded-xl border px-4 py-2.5 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
      invalido ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-bold tracking-[0.18em] text-blue-600 uppercase mb-1">Passo 2</p>
        <h2 className="text-2xl font-extrabold tracking-tight text-black">Como você quer receber?</h2>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
        <div className="grid grid-cols-2 gap-2">
          {(["retirada", "delivery"] as const).map((opcao) => {
            const selecionado = tipoEntrega === opcao;
            return (
              <button
                key={opcao}
                type="button"
                onClick={() => definirTipoEntrega(opcao)}
                className={`relative rounded-xl border p-4 text-left transition ${
                  selecionado
                    ? "border-black bg-neutral-50 ring-1 ring-black"
                    : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
                }`}
              >
                {selecionado && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
                <span className="block font-semibold text-sm text-black">
                  {opcao === "retirada" ? "Retirada" : "Delivery"}
                </span>
                <span className="block text-[11px] text-neutral-500 mt-0.5">
                  {opcao === "retirada" ? "Retirar no balcão" : "Receber no endereço"}
                </span>
              </button>
            );
          })}
        </div>

        {tipoEntrega === "delivery" && enderecosSalvos.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs font-medium text-neutral-500 mb-2">Endereços salvos</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {enderecosSalvos.map((salvo) => (
                <button
                  key={salvo.id}
                  type="button"
                  onClick={() => escolherEnderecoSalvo(salvo)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                    enderecoSalvoSelecionadoId === salvo.id
                      ? "border-black bg-neutral-50 ring-1 ring-black"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <span className="block font-semibold text-xs text-black">{salvo.rotulo}</span>
                  <span className="block text-[11px] text-neutral-500 max-w-[160px] truncate">{salvo.bairro}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {tipoEntrega === "delivery" && (
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-neutral-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="cep" className="block text-xs font-medium text-neutral-500 mb-1">
                  CEP
                </label>
                <input
                  id="cep"
                  type="text"
                  inputMode="numeric"
                  value={endereco.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  className={inputClasse(false)}
                />
                {buscandoCep && <p className="text-xs text-neutral-400 mt-1">Buscando endereço...</p>}
                {cepErro && <p className="text-xs text-amber-600 mt-1">{cepErro}</p>}
              </div>
              <div ref={numeroRef}>
                <label htmlFor="numero" className="block text-xs font-medium text-neutral-500 mb-1">
                  Número
                </label>
                <input
                  id="numero"
                  type="text"
                  value={endereco.numero}
                  onChange={(e) => definirEndereco("numero", e.target.value)}
                  placeholder="123"
                  className={inputClasse(numeroInvalido)}
                />
                {numeroInvalido && <p className="text-xs text-red-600 font-medium mt-1.5">Informe o número.</p>}
              </div>
            </div>

            <div ref={logradouroRef}>
              <label htmlFor="logradouro" className="block text-xs font-medium text-neutral-500 mb-1">
                Rua
              </label>
              <input
                id="logradouro"
                type="text"
                value={endereco.logradouro}
                onChange={(e) => definirEndereco("logradouro", e.target.value)}
                placeholder="Nome da rua"
                className={inputClasse(logradouroInvalido)}
              />
              {logradouroInvalido && <p className="text-xs text-red-600 font-medium mt-1.5">Informe a rua.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div ref={bairroRef}>
                <label htmlFor="bairro" className="block text-xs font-medium text-neutral-500 mb-1">
                  Bairro
                </label>
                <BairroAutocomplete
                  id="bairro"
                  value={endereco.bairro}
                  bairros={bairrosEntrega}
                  onChange={(valor) => definirEndereco("bairro", valor)}
                />
                {bairroInvalido && (
                  <p className="text-xs text-red-600 font-medium mt-1.5">Selecione um bairro da lista.</p>
                )}
              </div>
              <div>
                <label htmlFor="complemento" className="block text-xs font-medium text-neutral-500 mb-1">
                  Complemento <span className="italic">(opcional)</span>
                </label>
                <input
                  id="complemento"
                  type="text"
                  value={endereco.complemento}
                  onChange={(e) => definirEndereco("complemento", e.target.value)}
                  placeholder="Apto, bloco..."
                  className={inputClasse(false)}
                />
              </div>
            </div>

            <div>
              <label htmlFor="referencia" className="block text-xs font-medium text-neutral-500 mb-1">
                Ponto de referência <span className="italic">(opcional)</span>
              </label>
              <input
                id="referencia"
                type="text"
                value={endereco.referencia}
                onChange={(e) => definirEndereco("referencia", e.target.value)}
                placeholder="Ex: perto da praça"
                className={inputClasse(false)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Barra de ação fixa — Voltar/Continuar sempre à mão. */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-neutral-100 px-4 py-3 pointer-events-none">
        <div className="max-w-2xl mx-auto flex gap-3 pointer-events-auto">
          <button
            onClick={onVoltar}
            className="flex-1 bg-white border border-neutral-200 text-neutral-700 font-semibold text-base py-3.5 rounded-full hover:bg-neutral-50 transition active:scale-[0.98]"
          >
            Voltar
          </button>
          <button
            onClick={handleContinuar}
            className="flex-[2] bg-color-primary text-white font-bold text-base py-3.5 rounded-full shadow-lg hover:bg-neutral-800 transition active:scale-[0.98]"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
