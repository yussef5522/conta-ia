// ESTOQUE — VALORES INICIAIS da ficha aberta pelo hub (28/08).
//
// ⚠️ POR QUE ISTO SAIU DE DENTRO DO COMPONENTE: o prefill (nome + preço do PDV) vivia como
// valor inicial de `useState` dentro do editor e **abria vazio** no fluxo real
// (/estoque/cardapio → produto → "Montar a receita"), duas vezes seguidas, mesmo com os
// dados corretos chegando por prop — confirmado contra o servidor: `nomeInicial: "XIS
// COMPLETO"`, `precoInicial: 23.37`.
//
// Decisão: a DECISÃO de prefill vira função PURA, alimentada pela linha do hub. Assim ela é
// testável pelo caminho de verdade (hub → linha → valores) sem depender de DOM — o projeto
// não tem jsdom/RTL — e o componente vira casca fina que só ecoa o que ela devolve. Enquanto
// a regra morava dentro do `useState`, "abre vazio" não tinha como virar teste vermelho.
//
// ⭐ E o CONCEITO por modo (padrão dos líderes — MarketMan):
//   PRODUTO FINAL = **plate cost**: 1 ficha = 1 PORÇÃO VENDIDA. Não tem "rende N", não tem
//   validade — isso é do mundo de quem produz em lote.
//   INTERMEDIÁRIO = sub-receita: rende em lote, tem validade, rendimento é MEDIDO.

// ⭐ SABOR entra aqui como irmão do PRODUTO_FINAL (03/09): os dois MONTAM no pedido, então
// os dois têm plate cost e nenhum dos dois tem "rende N" nem validade de lote.
export type ModoFicha = 'PRODUTO_FINAL' | 'INTERMEDIARIO' | 'SABOR'

/** O recorte da linha do hub que a ficha precisa (nada além disto). */
export interface LinhaParaFicha {
  nome: string
  nomesSuitable: string[]
  precoPraticado: number | null
  precoCardapio: number | null
  fichaId: string | null
}

export interface ValoresIniciais {
  nome: string
  /** string pro input (vazio = "a definir"); vem do PDV quando existe */
  preco: string
  /** de onde veio o preço — a tela DIZ, pra o dono saber que pode confiar/editar */
  precoOrigem: 'praticado' | 'cardapio' | null
  loteBase: string
  unidadeLoteBase: 'KG' | 'UN' | 'LT'
  /** campos do mundo da produção que NÃO aparecem no produto final */
  mostraRendimento: boolean
  mostraValidade: boolean
}

/** Número pro input em pt-BR: 23.37 → "23,37" (o dono digita com vírgula). */
import { montaNaVenda } from '@/lib/stock/tipos-ficha'

export function paraCampo(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/**
 * O que o editor mostra ao ABRIR. `linha` só existe quando veio do hub (produto do PDV);
 * ficha nova pelo mundo da produção abre sem ela.
 */
export function valoresIniciaisDaFicha(modo: ModoFicha, linha?: LinhaParaFicha | null): ValoresIniciais {
  // ⭐ DUAS perguntas, não uma (a mesma armadilha que fez o `tipoProduto` acumular papel):
  //   montaNaVenda → plate cost: lote 1 UN, sem rendimento e sem validade (final E sabor)
  //   temPrecoProprio → só o PRODUTO FINAL. **Sabor não tem preço**: quem tem é a pizza.
  const monta = montaNaVenda(modo)
  const temPrecoProprio = modo === 'PRODUTO_FINAL'

  // ⭐ o nome que o PDV usa vem primeiro: é por ele que a venda vai casar com a ficha.
  const nome = linha ? (linha.nomesSuitable[0] ?? linha.nome) : ''

  // preço PRATICADO manda sobre o cadastrado (quando o arquivo traz o dado, usa o dado)
  const praticado = linha?.precoPraticado ?? null
  const cardapio = linha?.precoCardapio ?? null
  const preco = temPrecoProprio ? paraCampo(praticado ?? cardapio) : ''
  const precoOrigem: ValoresIniciais['precoOrigem'] =
    !temPrecoProprio ? null : praticado != null ? 'praticado' : cardapio != null ? 'cardapio' : null

  return {
    nome,
    preco,
    precoOrigem,
    // ⚠️ produto final é SEMPRE 1 porção vendida — não se pergunta o que a tela já sabe.
    loteBase: '1',
    unidadeLoteBase: monta ? 'UN' : 'KG',
    mostraRendimento: !monta,
    mostraValidade: !monta,
  }
}

/** Faixa da margem — a MESMA régua da tela do cardápio (uma decisão, um lugar). */
export function faixaMargem(margem: number | null): 'ruim' | 'atencao' | 'boa' | 'indefinida' {
  if (margem == null) return 'indefinida'
  if (margem < 0.15) return 'ruim'
  if (margem < 0.3) return 'atencao'
  return 'boa'
}
