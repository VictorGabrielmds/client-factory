export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  imagemUrl: string;
  disponivel: boolean;
  // Ainda aparece no cardápio (diferente de disponivel=false, que esconde
  // de vez), só sem poder comprar — cliente vê que a loja tem, só não agora.
  esgotado?: boolean;
  // Minutos médios pra preparar este item — soma na antecedência mínima de
  // agendamento (ver CarrinhoContext.tsx). Sem valor = usa o padrão geral.
  tempoPreparoMinutos?: number;
  tipoSistema?: "agendamento_fritura";
  itemSistema?: boolean;
}
