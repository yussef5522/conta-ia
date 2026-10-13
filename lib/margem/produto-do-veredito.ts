/**
 * ⭐⭐⭐ "ESCOLHA UM PRODUTO" — o irmão do montador (FRENTE C da v4, 13/10/2026).
 *
 * ⛔⛔ **TRADUÇÃO, NUNCA MOTOR NOVO.** Tudo que este cartão mostra já está decidido:
 *
 * | o que a tela mostra        | de onde vem (e nunca é recalculado)                         |
 * |----------------------------|-------------------------------------------------------------|
 * | custo do produto           | `LinhaCardapio.custoUnitario` — a ficha, pela MESMA explosão |
 * |                            | que a baixa de venda executa (`explodir`, qtd=1)            |
 * | "vendendo hoje a"          | `LinhaCardapio.precoPraticado` = `vendasValor ÷ vendasQtd`   |
 * |                            | do próprio relatório do PDV — **a mesma fonte da liga**      |
 * | a seção (categoria)        | `secaoDaLinha` — o dono do vocabulário do cardápio          |
 * | teto e alvos               | `reguaDaSecao` — o mapa único do veredito                    |
 * | farol, preço ideal, frase  | `veredito-de-preco.ts` — a porta única, a MESMA do montador  |
 *
 * Uma segunda conta de custo aqui faria a tela prometer um número que a baixa não executa —
 * e um segundo preço médio faria este cartão e a liga discordarem sobre o mesmo produto, a
 * dez centímetros um do outro na mesma página.
 *
 * ⛔ **ZERO ESCRITA.** O preço é editável **só pra simular**: nada grava. É a mesma disciplina
 * do montador (*"nada grava, nada baixa"*) — e por isso este arquivo não conhece `prisma`.
 */
import { filtrarPorBusca } from '@/lib/busca-texto'
import type { LinhaCardapio } from '@/lib/stock/cardapio/hub'
import { secaoDaLinha, type SecaoDoNome } from '@/lib/stock/cardapio/secoes-db'
import { reguaDaSecao, type ReguaDaCategoria } from './veredito-de-preco'

export interface ProdutoDoVeredito {
  chave: string
  nome: string
  /** ⚠️ os apelidos do PDV — entram na BUSCA: o nome que o dono lembra é o do cardápio dele */
  apelidos: string[]
  /**
   * ⭐ A seção do cardápio. **Nunca `null`**: `secaoDaLinha` cai na régua de palavra quando
   * nada foi gravado, e o que não casa em regra nenhuma vira `OUTROS` à vista — nunca palpite.
   */
  secao: string
  /** ⚠️ sugestão da régua ainda não confirmada pelo dono — a tela marca */
  secaoSugerida: boolean
  regua: ReguaDaCategoria
  /** ⛔ `null` = SEM FICHA. Nunca 0: zero afirmaria que o produto é de graça */
  custo: number | null
  /** ⭐ o que JÁ tem custo quando falta componente — o piso, nunca o total */
  custoParcial: number
  componentesSemCusto: number
  /** ⛔ `null` = sem venda no período. Nunca 0: zero afirmaria preço de graça */
  preco: number | null
  precoOrigem: 'praticado' | 'cardapio' | null
  unidades: number
  temFicha: boolean
  /** ⭐ o toque abre a ficha — sem isso o cartão cobra sem dar o caminho */
  href: string | null
  /** o porquê do estado incompleto, pra a tela DIZER em vez de calar */
  porque: string | null
}

/**
 * ⭐ A LISTA — ordenada pelo que mais vendeu.
 *
 * ⚠️ Pelo VOLUME e não pelo alfabeto: o produto que mais sai é o que mais move o bolso, e
 * é nele que o dono vai tocar primeiro. É a mesma régua de *"a ordem é do trabalho"* da
 * prateleira de vendas (08/09) e do ranking por dinheiro do Radar.
 */
export function montarProdutosDoVeredito(
  linhas: readonly LinhaCardapio[],
  secoes: Map<string, SecaoDoNome>,
  empresaId: string,
): ProdutoDoVeredito[] {
  const produtos = linhas.map((l) => {
    const s = secaoDaLinha(l.nomesSuitable, secoes, l.nome)
    const semFicha = l.custoUnitario == null
    const semVenda = l.precoUsado == null

    return {
      chave: l.chave,
      nome: l.nome,
      apelidos: [...l.nomesSuitable],
      secao: s.secao,
      secaoSugerida: s.sugerida,
      regua: reguaDaSecao(s.secao),
      custo: l.custoUnitario,
      custoParcial: l.custoParcial,
      componentesSemCusto: l.componentesSemCusto,
      // ⚠️ `precoUsado` é o dono de "qual preço vale" no hub (praticado > cardápio); usar
      // `precoPraticado` cru aqui faria o produto com preço de cardápio e sem venda no
      // período aparecer sem preço nenhum, que é outra coisa.
      preco: l.precoUsado,
      precoOrigem: l.precoOrigem,
      unidades: l.vendasQtd,
      temFicha: !semFicha,
      href: l.fichaId ? `/empresas/${empresaId}/estoque/fichas/${l.fichaId}` : null,
      porque: semFicha
        ? l.componentesSemCusto > 0
          ? `${l.componentesSemCusto} componente(s) da ficha sem custo`
          : 'sem ficha'
        : semVenda
          ? 'sem venda no período'
          : null,
    }
  })

  return produtos.sort((a, b) => b.unidades - a.unidades)
}

/**
 * ⭐ A BUSCA — pela `casaBusca` da casa, nunca `includes`/`toLowerCase` cru.
 *
 * ⛔ A régua crua é o bug de 08/09: `contains` é case-SENSITIVE no Postgres, e o `includes`
 * no cliente não trata ACENTO. Medido naquele dia: digitar `"porcao"` achava ZERO onde o
 * nome real é `"porçao"`. Aqui o dono digita `xis`, `coxao`, `porcao` — e tem que achar.
 *
 * ⚠️ Filtra a MESMA lista que a tela desenha (filtro e lista não podem discordar) e busca
 * nos APELIDOS do PDV também: o nome que ele lembra é o do cardápio dele, não o nosso.
 */
export function filtrarProdutosDoVeredito(
  produtos: readonly ProdutoDoVeredito[],
  termo: string,
): ProdutoDoVeredito[] {
  return filtrarPorBusca([...produtos], termo, (p) => [p.nome, ...p.apelidos].join(' '))
}
