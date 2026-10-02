import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "../lib/firebase-client";
import type { Produto } from "../types/produto";

const PRODUTO_AGENDAMENTO_FRITURA_ID = "agendamento_fritura";
const PRODUTO_AGENDAMENTO_FRITURA_PADRAO = {
  nome: "Agendar fritura",
  descricao: "Escolha uma data e envie sua solicitação de fritura para nossa equipe.",
  preco: 0,
  categoria: "Serviços",
  imagemUrl: "",
  disponivel: true,
  esgotado: false,
  tempoPreparoMinutos: null,
  friturasNoLocal: false,
  dataHoraFritura: null,
  localFritura: null,
  tipoSistema: "agendamento_fritura",
  itemSistema: true,
};

export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const garantirProdutoAgendamento = async () => {
      const produtoRef = doc(db, "produtos", PRODUTO_AGENDAMENTO_FRITURA_ID);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(produtoRef);
          if (!snap.exists()) tx.set(produtoRef, PRODUTO_AGENDAMENTO_FRITURA_PADRAO);
        });
      } catch (error) {
        // O cardápio continua utilizável mesmo se a criação automática falhar;
        // o painel administrativo faz a mesma garantia ao ser aberto.
        console.warn("Não foi possível preparar o item Agendar fritura.", error);
      }
    };

    void garantirProdutoAgendamento();

    const q = query(collection(db, "produtos"), where("disponivel", "==", true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const dados = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produto);
      setProdutos(dados);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { produtos, loading };
}
