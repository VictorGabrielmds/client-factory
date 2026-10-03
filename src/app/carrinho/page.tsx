"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCarrinho } from "../../contexts/CarrinhoContext";
import StepIndicator from "../../components/checkout/StepIndicator";
import PassoItens from "../../components/checkout/PassoItens";
import PassoEntrega from "../../components/checkout/PassoEntrega";
import PassoResumo from "../../components/checkout/PassoResumo";

type Passo = 1 | 2 | 3;

export default function CarrinhoPage() {
  const router = useRouter();
  const carrinho = useCarrinho();
  const {
    itens,
    totalItens,
    limparCarrinho,
    finalizarPedido,
    carrinhoRestaurado,
    quantidadeItensSalvos,
    produtosLoading,
    produtosErro,
    pedidoRecuperado,
    descartarPedidoRecuperado,
  } = carrinho;
  // Itens salvos neste aparelho cujos produtos ainda não chegaram (cardápio
  // carregando numa rede lenta): mostrar "carrinho vazio" aqui fazia parecer
  // que o carrinho tinha se perdido.
  const aguardandoCarrinho =
    itens.length === 0 && (!carrinhoRestaurado || (quantidadeItensSalvos > 0 && (produtosLoading || produtosErro)));

  const [passo, setPasso] = useState<Passo>(1);

  // "Ver carrinho" no cardápio já mostra os itens e as observações — chegando
  // por lá (?passo=2), pula direto pro passo de entrega. Lido só depois do
  // mount (window não existe no SSR, e ler antes causaria mismatch de hidratação).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("passo") === "2") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação única de um valor externo (query string), sem API de assinatura pra "subscrever" essa leitura.
      setPasso(2);
    }
  }, []);

  const handleEsvaziar = () => {
    if (window.confirm("Tem certeza que quer esvaziar o carrinho?")) {
      limparCarrinho();
    }
  };

  const handleFinalizar = async () => {
    const resultado = await finalizarPedido();
    if (resultado) router.push(`/pedido/${resultado.orderId}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-color-primary px-6 pt-6 pb-5 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Link
            href="/cardapio"
            aria-label="Voltar ao cardápio"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Seu pedido</h1>
            <p className="text-neutral-400 text-xs font-medium">
              {totalItens === 0 ? "Nenhum item ainda" : `${totalItens} ${totalItens === 1 ? "item" : "itens"}`}
            </p>
          </div>
        </div>

        {itens.length > 0 && (
          <StepIndicator passoAtual={passo} onIrParaPasso={setPasso} />
        )}
      </header>

      <main className="w-full max-w-2xl mx-auto px-4 pt-6 pb-28">
        {pedidoRecuperado && (
          <div role="status" className="mb-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-green-900">
            <p className="font-bold">Seu pedido anterior foi confirmado</p>
            <p className="mt-1 text-sm opacity-80">
              A internet caiu antes de a confirmação chegar, mas o pedido foi recebido pela loja. Não precisa pedir de novo.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href={`/pedido/${pedidoRecuperado}`}
                onClick={descartarPedidoRecuperado}
                className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              >
                Ver pedido
              </Link>
              <button type="button" onClick={descartarPedidoRecuperado} className="text-sm font-semibold underline">
                Fechar
              </button>
            </div>
          </div>
        )}
        {aguardandoCarrinho ? (
          <div className="text-center py-16 text-neutral-500" role="status">
            {produtosErro ? (
              <>
                <p className="font-semibold text-neutral-700">Não conseguimos carregar o cardápio agora.</p>
                <p className="mt-1 text-sm">Seus itens continuam salvos. Estamos tentando de novo, confira sua internet.</p>
              </>
            ) : (
              <p>Carregando seu carrinho...</p>
            )}
          </div>
        ) : itens.length === 0 ? (
          <div className="text-center py-16 text-neutral-500">
            <p className="mb-4">Seu carrinho está vazio.</p>
            <Link href="/cardapio" className="text-blue-600 font-semibold hover:underline">
              Ver cardápio
            </Link>
          </div>
        ) : passo === 1 ? (
          <PassoItens
            itens={itens}
            subtotal={carrinho.subtotal}
            observacoes={carrinho.observacoes}
            definirObservacoes={carrinho.definirObservacoes}
            adicionar={carrinho.adicionar}
            remover={carrinho.remover}
            definirQuantidade={carrinho.definirQuantidade}
            onEsvaziar={handleEsvaziar}
            onContinuar={() => setPasso(2)}
          />
        ) : passo === 2 ? (
          <PassoEntrega
            tipoEntrega={carrinho.tipoEntrega}
            definirTipoEntrega={carrinho.definirTipoEntrega}
            endereco={carrinho.endereco}
            definirEndereco={carrinho.definirEndereco}
            bairrosEntrega={carrinho.bairrosEntrega}
            onVoltar={() => setPasso(1)}
            onContinuar={() => setPasso(3)}
          />
        ) : (
          <PassoResumo
            itens={itens}
            adicionar={carrinho.adicionar}
            remover={carrinho.remover}
            definirQuantidade={carrinho.definirQuantidade}
            observacoes={carrinho.observacoes}
            definirObservacoes={carrinho.definirObservacoes}
            tipoEntrega={carrinho.tipoEntrega}
            endereco={carrinho.endereco}
            onEditarEntrega={() => setPasso(2)}
            subtotal={carrinho.subtotal}
            desconto={carrinho.desconto}
            taxaEntrega={carrinho.taxaEntrega}
            taxaEntregaCarregando={carrinho.taxaEntregaCarregando}
            taxaEntregaErro={carrinho.taxaEntregaErro}
            recalcularTaxaEntrega={carrinho.recalcularTaxaEntrega}
            faltaParaValorMinimo={carrinho.faltaParaValorMinimo}
            taxaCartao={carrinho.taxaCartao}
            taxaDebitoPercentual={carrinho.taxaDebitoPercentual}
            taxaCreditoPercentual={carrinho.taxaCreditoPercentual}
            total={carrinho.total}
            cupomCodigo={carrinho.cupomCodigo}
            definirCupomCodigo={carrinho.definirCupomCodigo}
            cupomAplicado={carrinho.cupomAplicado}
            cupomValidando={carrinho.cupomValidando}
            cupomErro={carrinho.cupomErro}
            aplicarCupom={carrinho.aplicarCupom}
            removerCupom={carrinho.removerCupom}
            horarioCarregando={carrinho.horarioCarregando}
            horarioErro={carrinho.horarioErro}
            slotsDisponiveis={carrinho.slotsDisponiveis}
            agendamento={carrinho.agendamento}
            definirAgendamento={carrinho.definirAgendamento}
            horarioExpirou={carrinho.horarioExpirou}
            antecedenciaMinutos={carrinho.antecedenciaMinutos}
            nome={carrinho.nome}
            definirNome={carrinho.definirNome}
            cpf={carrinho.cpf}
            definirCpf={carrinho.definirCpf}
            formaPagamento={carrinho.formaPagamento}
            definirFormaPagamento={carrinho.definirFormaPagamento}
            finalizando={carrinho.finalizando}
            erroFinalizar={carrinho.erroFinalizar}
            onFinalizar={handleFinalizar}
            onVoltar={() => setPasso(2)}
          />
        )}
      </main>
    </div>
  );
}
