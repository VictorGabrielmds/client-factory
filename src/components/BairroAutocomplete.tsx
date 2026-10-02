"use client";

import { useEffect, useRef, useState } from "react";

interface BairroAutocompleteProps {
  id?: string;
  value: string;
  bairros: string[];
  onChange: (valor: string) => void;
}

export default function BairroAutocomplete({ id, value, bairros, onChange }: BairroAutocompleteProps) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const termo = value.trim().toLowerCase();
  const sugestoes = termo ? bairros.filter((b) => b.toLowerCase().includes(termo)) : bairros;

  // Só aceita um bairro que exista de verdade na lista — ao perder o foco,
  // qualquer texto digitado que não bata exatamente com um item é descartado
  // (evita taxa de entrega/agendamento calculados em cima de um bairro inventado).
  const handleBlur = () => {
    const encontrado = bairros.find((b) => b.toLowerCase() === value.trim().toLowerCase());
    if (encontrado) {
      if (encontrado !== value) onChange(encontrado);
    } else if (value !== "") {
      onChange("");
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={handleBlur}
        placeholder="Bairro"
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white rounded-xl shadow-lg border border-neutral-100 max-h-48 overflow-y-auto p-1.5">
          {sugestoes.map((bairro) => (
            // onMouseDown (não onClick) dispara antes do input perder o foco —
            // com onClick, o onBlur fecharia a lista antes do clique registrar.
            <li
              key={bairro}
              onMouseDown={() => {
                onChange(bairro);
                setAberto(false);
              }}
              className="px-3 py-2 rounded-lg text-sm text-neutral-700 hover:bg-blue-50 cursor-pointer transition"
            >
              {bairro}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
