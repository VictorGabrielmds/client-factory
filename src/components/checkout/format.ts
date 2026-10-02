// Formatação compartilhada entre os passos do checkout.

export function formatarReal(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.replace(/(\d{5})(\d)/, "$1-$2");
}
