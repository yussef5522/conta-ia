/**
 * ⭐⭐⭐ A CESTA / MODO COMBO (14/10/2026) — *"2 ou mais itens → MODO COMBO"*.
 *
 * ⛔⛔ **A SOMA MORA NA LIB, NUNCA NA TELA** (ordem do dono: *"combo = soma na LIB, não na
 * tela"*). O motor do veredito é o MESMO do produto único — `montarBlocoDoVeredito`, com
 * `custo` = Σ das linhas e o teto ponderado. Uma soma no JSX seria a 2ª conta do mesmo
 * dinheiro **no mesmo cartão**, e divergiria no primeiro item que entrasse sem ficha.
 *
 * ⛔ **ZERO ESCRITA.** Cesta, quantidade, alvo e preço são simulação: este arquivo não conhece
 * `prisma` nem `react`, e há guard de grep exigindo isso.
 *
 * ⚠️ **O CUSTO NÃO É RECALCULADO AQUI.** Cada linha traz `custo` do `ProdutoDoVeredito`, que
 * traz do `LinhaCardapio.custoUnitario` — a MESMA explosão que a baixa de venda executa. A
 * cesta só multiplica por quantidade e soma.
 *
 * ⛔⛔ **E PIZZA NÃO SE MONTA AQUI** (ordem do dono): este cartão não conhece sabor nem fatia.
 * Produto-pizza na cesta entra como UM produto do PDV, com o custo da ficha dele, e a tela
 * aponta o montador ao lado. O montador fica intocado.
 */
import type { ProdutoDoVeredito } from './produto-do-veredito'
import {
  montarBlocoDoVeredito,
  reguaPonderada,
  fraseDoCombo,
  type BlocoDoVeredito,
  type CanalDoVeredito,
  type ReguaDaCategoria,
} from './veredito-de-preco'
import { pctBR } from '@/lib/format/percentual'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** o que o dono escolheu — ⚠️ `qtd` **mínimo 1**: cesta com zero de um item é a cesta sem ele */
export interface ItemDaCesta {
  chave: string
  qtd: number
}

export interface LinhaDaCesta {
  chave: string
  nome: string
  qtd: number
  /** ⛔ `null` = SEM FICHA. Nunca 0 — zero afirmaria que o produto é de graça */
  custoUn: number | null
  custoTotal: number | null
  /** média real do PDV · `null` = sem venda no período */
  precoUn: number | null
  avulsoTotal: number | null
  temFicha: boolean
  /** o toque abre a ficha — cartão que cobra sem dar caminho é cobrança */
  href: string | null
  tetoPct: number
  porque: string | null
}

export interface CestaDoVeredito {
  linhas: LinhaDaCesta[]
  /** quantos produtos distintos (não a soma das quantidades) */
  itens: number
  /** ⛔ `null` quando QUALQUER item não tem ficha — número inventado NUNCA */
  custoDoCombo: number | null
  /** ⛔ `null` quando QUALQUER item não tem venda no período (a linha vira "a apurar") */
  avulsos: number | null
  itensSemFicha: number
  itensSemVenda: number
  /** o teto ponderado pelo custo + os alvos derivados dele */
  regua: ReguaDaCategoria
  /** o que falta pro combo fechar, pra a tela DIZER em vez de calar */
  porque: string | null
}

/**
 * ⭐ MONTA A CESTA a partir das escolhas — tradução e soma, zero régua nova.
 *
 * ⚠️ A ordem das linhas é a ORDEM EM QUE O DONO ESCOLHEU, não por volume: ele acabou de
 * montar aquilo e espera ver na sequência em que tocou. (A lista de chips continua ordenada
 * por volume — lá a pergunta é outra: *"em qual eu toco primeiro?"*.)
 */
export function montarCesta(
  produtos: readonly ProdutoDoVeredito[],
  escolhas: readonly ItemDaCesta[],
): CestaDoVeredito {
  const linhas: LinhaDaCesta[] = []
  for (const e of escolhas) {
    const p = produtos.find((x) => x.chave === e.chave)
    if (!p) continue
    const qtd = Math.max(1, Math.floor(e.qtd))
    linhas.push({
      chave: p.chave,
      nome: p.nome,
      qtd,
      custoUn: p.custo,
      custoTotal: p.custo == null ? null : round2(p.custo * qtd),
      precoUn: p.preco,
      avulsoTotal: p.preco == null ? null : round2(p.preco * qtd),
      temFicha: p.temFicha,
      href: p.href,
      tetoPct: p.regua.tetoPct,
      porque: p.porque,
    })
  }

  const semFicha = linhas.filter((l) => l.custoTotal == null)
  const semVenda = linhas.filter((l) => l.avulsoTotal == null)

  /**
   * ⛔⛔ UM item sem ficha derruba o combo INTEIRO pra *"a apurar"* — e isso é de propósito:
   * somar só os que têm custo daria um número **menor que o real, saindo plausível**, e num
   * cartão de preço o palpite é OBEDECIDO (o dono remarca o cardápio em cima dele). É a mesma
   * régua do `custoUnitario` do hub (*"null se QUALQUER folha não tem custo"*).
   */
  const custoDoCombo = semFicha.length > 0 ? null : round2(linhas.reduce((a, l) => a + (l.custoTotal ?? 0), 0))
  const avulsos = semVenda.length > 0 ? null : round2(linhas.reduce((a, l) => a + (l.avulsoTotal ?? 0), 0))

  return {
    linhas,
    itens: linhas.length,
    custoDoCombo,
    avulsos,
    itensSemFicha: semFicha.length,
    itensSemVenda: semVenda.length,
    regua: reguaPonderada(linhas.map((l) => ({ tetoPct: l.tetoPct, peso: l.custoTotal }))),
    porque:
      semFicha.length > 0
        ? `${semFicha.length} item(ns) da cesta sem ficha`
        : semVenda.length > 0
          ? `${semVenda.length} item(ns) sem venda no período`
          : null,
  }
}

export type TomDaVantagem = 'verde' | 'coral' | 'neutro'

export interface VantagemDoCombo {
  tom: TomDaVantagem
  /** pronto pra tela · `null` = ainda não dá pra dizer (sem preço ou sem avulsos) */
  frase: string | null
  /** R$ que o cliente economiza · negativo = o combo é mais CARO que avulso */
  valor: number | null
  /** FRAÇÃO (0.18 = 18%) */
  pct: number | null
}

/**
 * ⭐⭐ A LINHA DA VANTAGEM — *"o cliente ganha quanto levando junto?"*
 *
 * ⛔⛔ **E o estado SEM VANTAGEM é VERMELHO, com a frase dura** (*"combo SEM vantagem — ninguém
 * leva"*): um combo que custa igual ou mais que os itens separados não é promoção, é uma
 * linha morta no cardápio. Pintar isso de cinza deixaria o dono lançar um combo que ninguém
 * compra — e ele só descobriria no fim do mês.
 *
 * ⚠️ Sem preço digitado ou sem avulsos a linha **não aparece** (`frase: null`) — inventar
 * vantagem sobre preço que ninguém disse é o palpite que este cartão todo evita.
 */
export function vantagemDoCombo(preco: number | null, avulsos: number | null): VantagemDoCombo {
  if (preco == null || preco <= 0 || avulsos == null || avulsos <= 0) {
    return { tom: 'neutro', frase: null, valor: null, pct: null }
  }
  const valor = round2(avulsos - preco)
  const pct = valor / avulsos
  if (valor > 0.005) {
    return {
      tom: 'verde',
      frase: `vantagem pro cliente: ${brl(valor)} (${pctBR(pct)} mais barato que avulso)`,
      valor,
      pct,
    }
  }
  return { tom: 'coral', frase: 'combo SEM vantagem — ninguém leva', valor, pct }
}

/** ⚠️ formatação local SÓ da frase da vantagem — a tela usa o `formatBRL` da casa nos números */
function brl(n: number): string {
  return `R$ ${n.toFixed(2).replace('.', ',')}`
}

export interface VereditoDaCesta {
  cesta: CestaDoVeredito
  bloco: BlocoDoVeredito
  vantagem: VantagemDoCombo
  /** a frase do especialista do COMBO — já com os estados do mock */
  frase: string
}

/**
 * ⭐⭐⭐ O VEREDITO DA CESTA — **a MESMA porta do produto único**, com a soma por baixo.
 *
 * ⚠️ `montarBlocoDoVeredito` recebe `custo` = custo do combo e o teto PONDERADO; o resto
 * (farol, charme, gross-up por canal) é idêntico — é isso que faz o combo e o produto único
 * não poderem divergir. ⛔ A `frase` do bloco é SUBSTITUÍDA pela do combo: os estados do
 * combo dependem de `avulsos`, que a porta do produto não conhece (e passar `avulsos` pra lá
 * poria um parâmetro sem significado no produto único).
 */
export function vereditoDaCesta(opts: {
  produtos: readonly ProdutoDoVeredito[]
  escolhas: readonly ItemDaCesta[]
  /** o preço que o dono digitou pro combo · `null` = ainda não digitou */
  preco: number | null
  /** o chip de alvo ligado · `null` = o teto da cesta */
  alvoPct: number | null
  canais: readonly CanalDoVeredito[]
}): VereditoDaCesta {
  const cesta = montarCesta(opts.produtos, opts.escolhas)
  const alvoPct = opts.alvoPct ?? cesta.regua.tetoPct

  const bloco = montarBlocoDoVeredito({
    custo: cesta.custoDoCombo,
    preco: opts.preco,
    tetoPct: cesta.regua.tetoPct,
    alvosPct: cesta.regua.alvosPct,
    alvoPct,
    canais: opts.canais,
    tipo: 'combo',
    motivoNeutro: '—',
  })

  const vantagem = vantagemDoCombo(opts.preco, cesta.avulsos)

  return {
    cesta,
    bloco,
    vantagem,
    frase: fraseDoCombo({
      custoDoCombo: cesta.custoDoCombo,
      avulsos: cesta.avulsos,
      preco: opts.preco,
      // ⚠️ o ideal do canal PRINCIPAL (o 1º, o balcão): comparar o preço do iFood com o
      //    avulso do balcão misturaria duas réguas de canal na mesma frase.
      ideal: bloco.canais[0]?.preco ?? null,
      tetoPct: cesta.regua.tetoPct,
      vantagemPct: vantagem.pct,
    }),
  }
}

// ────────────────────────────────────────────────────────────────
// OS GESTOS DA CESTA (puros — a tela só chama)
// ────────────────────────────────────────────────────────────────

/** ⭐ o toque LIGA/DESLIGA: item na cesta sai, item fora entra com qtd 1 */
export function alternarNaCesta(
  escolhas: readonly ItemDaCesta[],
  chave: string,
): ItemDaCesta[] {
  const i = escolhas.findIndex((e) => e.chave === chave)
  if (i >= 0) return escolhas.filter((e) => e.chave !== chave)
  return [...escolhas, { chave, qtd: 1 }]
}

/**
 * ⭐ O −/+ DA QUANTIDADE — **mínimo 1**.
 *
 * ⛔ Não deixa chegar a 0: zero não é uma quantidade, é a ausência do item — e quem quer tirar
 * usa o toque no chip (que é reversível e visível). Um item com qtd 0 na cesta seria uma
 * linha que soma nada e ocupa espaço, e o custo do combo passaria a depender de um item
 * invisível.
 */
export function mudarQtd(
  escolhas: readonly ItemDaCesta[],
  chave: string,
  delta: number,
): ItemDaCesta[] {
  return escolhas.map((e) =>
    e.chave === chave ? { ...e, qtd: Math.max(1, Math.floor(e.qtd + delta)) } : e,
  )
}

export function estaNaCesta(escolhas: readonly ItemDaCesta[], chave: string): boolean {
  return escolhas.some((e) => e.chave === chave)
}
