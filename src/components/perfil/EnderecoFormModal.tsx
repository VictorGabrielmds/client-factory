"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Endereco, EnderecoSalvo } from "../../contexts/CarrinhoContext";
import BairroAutocomplete from "../BairroAutocomplete";
import { formatarCep } from "../checkout/format";

interface EnderecoFormModalProps {
  enderecoInicial: EnderecoSalvo | null; // null = criando um novo
  bairrosEntrega: string[];
  salvando: boolean;
  onSalvar: (dados: Omit<EnderecoSalvo, "id"> & { id?: string }) => Promise<boolean>;
  onFechar: () => void;
}

const ENDERECO_VAZIO: Endereco = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  referencia: "",
};

export default function EnderecoFormModal({
  enderecoInicial,
  bairrosEntrega,
  salvando,
  onSalvar,
  onFechar,
}: EnderecoFormModalProps) {
  const [rotulo, setRotulo] = useState(enderecoInicial?.rotulo ?? "");
  const [endereco, setEndereco] = useState<Endereco>(enderecoInicial ?? ENDERECO_VAZIO);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  useEffect(() => {
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, []);

  const definirCampo = (campo: keyof Endereco, valor: string) => {
    setEndereco((atual) => ({ ...atual, [campo]: valor }));
  };

  const handleCepChange = async (valor: string) => {
    const formatado = formatarCep(valor);
    definirCampo("cep", formatado);
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
        definirCampo("logradouro", dados.logradouro || "");
        definirCampo("bairro", dados.bairro || "");
      }
    } catch {
      setCepErro("Não foi possível buscar o CEP.");
    } finally {
      setBuscandoCep(false);
    }
  };

  const bairroValido = bairrosEntrega.length === 0 || bairrosEntrega.some((b) => b.toLowerCase() === endereco.bairro.trim().toLowerCase());
  const valido = !!rotulo.trim() && !!endereco.logradouro.trim() && !!endereco.numero.trim() && !!endereco.bairro.trim() && bairroValido;

  const handleSalvar = async () => {
    setTentouSalvar(true);
    if (!valido) {
      setErro("Preencha apelido, rua, número e um bairro válido.");
      return;
    }
    setErro(null);
    const ok = await onSalvar({ id: enderecoInicial?.id, rotulo: rotulo.trim(), ...endereco });
    if (ok) onFechar();
    else setErro("Não foi possível salvar. Tente novamente.");
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => !salvando && onFechar()}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-black mb-4">
          {enderecoInicial ? "Editar endereço" : "Novo endereço"}
        </h2>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label htmlFor="perfil-rotulo" className="block text-xs font-medium text-neutral-500 mb-1">Apelido</label>
            <input
              id="perfil-rotulo"
              type="text"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Casa, Trabalho..."
              maxLength={40}
              className={`w-full rounded-xl border px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                tentouSalvar && !rotulo.trim() ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="perfil-cep" className="block text-xs font-medium text-neutral-500 mb-1">CEP</label>
              <input
                id="perfil-cep"
                type="text"
                inputMode="numeric"
                value={endereco.cep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              {buscandoCep && <p className="text-xs text-neutral-400 mt-1">Buscando...</p>}
              {cepErro && <p className="text-xs text-amber-600 mt-1">{cepErro}</p>}
            </div>
            <div>
              <label htmlFor="perfil-numero" className="block text-xs font-medium text-neutral-500 mb-1">Número</label>
              <input
                id="perfil-numero"
                type="text"
                value={endereco.numero}
                onChange={(e) => definirCampo("numero", e.target.value)}
                placeholder="123"
                className={`w-full rounded-xl border px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  tentouSalvar && !endereco.numero.trim() ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
                }`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="perfil-rua" className="block text-xs font-medium text-neutral-500 mb-1">Rua</label>
            <input
              id="perfil-rua"
              type="text"
              value={endereco.logradouro}
              onChange={(e) => definirCampo("logradouro", e.target.value)}
              placeholder="Nome da rua"
              className={`w-full rounded-xl border px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                tentouSalvar && !endereco.logradouro.trim() ? "border-red-300 bg-red-50" : "border-neutral-200 bg-neutral-50"
              }`}
            />
          </div>

          <div>
            <label htmlFor="perfil-bairro" className="block text-xs font-medium text-neutral-500 mb-1">Bairro</label>
            <BairroAutocomplete
              id="perfil-bairro"
              value={endereco.bairro}
              bairros={bairrosEntrega}
              onChange={(valor) => definirCampo("bairro", valor)}
            />
            {tentouSalvar && !bairroValido && (
              <p className="text-xs text-red-600 font-medium mt-1.5">Selecione um bairro da lista.</p>
            )}
          </div>

          <div>
            <label htmlFor="perfil-complemento" className="block text-xs font-medium text-neutral-500 mb-1">
              Complemento <span className="italic">(opcional)</span>
            </label>
            <input
              id="perfil-complemento"
              type="text"
              value={endereco.complemento}
              onChange={(e) => definirCampo("complemento", e.target.value)}
              placeholder="Apto, bloco..."
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          <div>
            <label htmlFor="perfil-referencia" className="block text-xs font-medium text-neutral-500 mb-1">
              Ponto de referência <span className="italic">(opcional)</span>
            </label>
            <input
              id="perfil-referencia"
              type="text"
              value={endereco.referencia}
              onChange={(e) => definirCampo("referencia", e.target.value)}
              placeholder="Ex: perto da praça"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}

        <div className="flex gap-3">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="flex-1 bg-white border border-neutral-200 text-black font-semibold text-sm py-3 rounded-xl disabled:opacity-40 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando}
            className="flex-[2] bg-color-primary text-white font-bold text-sm py-3 rounded-xl hover:bg-neutral-800 disabled:opacity-50 transition"
          >
            {salvando ? "Salvando..." : "Salvar endereço"}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
