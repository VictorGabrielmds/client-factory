export function mensagemFalhaCheckout(erro: unknown, offline: boolean): string {
  const detalhes = erro as { code?: string; message?: string } | null;
  const codigo = String(detalhes?.code || "").replace(/^functions\//, "");
  if (offline) {
    return "Você está sem conexão. Ainda não foi possível confirmar o pedido. Quando a internet voltar, toque em Finalizar novamente para recuperar esta tentativa, sem criar outro pedido.";
  }
  if (["internal", "unknown", "unavailable", "deadline-exceeded", "aborted", "already-exists", "resource-exhausted"].includes(codigo)) {
    return "A confirmação do pedido ainda não chegou. Aguarde um momento e toque em Finalizar novamente: vamos verificar esta mesma tentativa antes de criar qualquer outro pedido.";
  }
  if (codigo === "unauthenticated") return "Sua sessão expirou. Entre novamente para verificar e continuar esta tentativa de pedido.";
  // Preserva validações de negócio já destinadas ao cliente, sem expor erros técnicos.
  if (["invalid-argument", "failed-precondition", "permission-denied", "not-found", "out-of-range"].includes(codigo) && detalhes?.message) return detalhes.message;
  return "Não foi possível obter a confirmação. Tente novamente para verificar esta mesma tentativa de pedido.";
}
