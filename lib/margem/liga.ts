/**
 * ⭐⭐ A LIGA — o ranking com a ciência em SELOS (07/10/2026).
 *
 * A matriz de menu engineering (estrela/burro-de-carga/enigma/cão) **virou etiqueta** em vez
 * de quadrante: *"a matriz é bonita e ninguém lê eixo; o selo diz o que fazer"*. Três abas
 * sobre a MESMA lista — encheu o caixa (sobra total) · melhor margem (%) · mais vendidos (un).
 *
 * ⛔⛔ **OS CORTES SÃO PELA MEDIANA, NUNCA PELA MÉDIA** — a mesma régua do M2 (02/10), da
 * sugestão de mínimo (06/10) e do prazo típico de compra. Medido em prod: a PIZZA GRANDE
 * PRECINHO sozinha faz **R$ 45.297,68** de sobra (21% do total); com média, ela levantaria a
 * referência acima de quase todo o cardápio e **o selo ⭐ nunca acenderia pra mais ninguém**.
 * As medianas reais de 07/10: sobra **R$ 723,84** · **51 unidades**.
 *
 * ⚠️ Função PURA, e os 4 selos são EXAUSTIVOS por construção (os dois eixos × acima/abaixo) —
 * produto novo não cai num "sem selo" silencioso.
 */
import type { ProdutoComSobra } from './sobra'
import { medianaDe } from './sobra'
import { caraDaReceita } from '@/lib/stock/producao/cara-da-receita'

export type SeloDoVeredito = 'ESTRELA' | 'BURRO_DE_CARGA' | 'JOIA_ESCONDIDA' | 'REPENSAR'

/** ⭐ a língua de BALCÃO — o dono não lê "star/plowhorse", lê o que fazer */
export const FRASE_DO_SELO: Record<SeloDoVeredito, string> = {
  ESTRELA: 'vende e sobra — é a tua estrela',
  BURRO_DE_CARGA: 'vende muito, sobra pouco',
  JOIA_ESCONDIDA: 'joia escondida — divulgar',
  REPENSAR: 'pra repensar',
}

export const EMOJI_DO_SELO: Record<SeloDoVeredito, string> = {
  ESTRELA: '⭐',
  BURRO_DE_CARGA: '🐴',
  JOIA_ESCONDIDA: '🧩',
  REPENSAR: '',
}

export type AbaDaLiga = 'CAIXA' | 'MARGEM' | 'VENDIDOS'

export interface LinhaDaLiga {
  chave: string
  nome: string
  familia: string
  icone: string
  posicao: number
  /** 🥇🥈🥉 — só no top 3 */
  medalha: 1 | 2 | 3 | null
  selo: SeloDoVeredito
  frase: string
  sobraTotal: number
  sobraUn: number
  margemPct: number
  unidades: number
  /** o número DESTA aba (é ele que a barra desenha) */
  valor: number
  /** 0..1 — proporcional ao 1º colocado da aba */
  barra: number
}

export interface Liga {
  aba: AbaDaLiga
  linhas: LinhaDaLiga[]
  cortes: { sobra: number | null; unidades: number | null }
  /** ⛔ tem que reproduzir o `sobraTotal` das sobras — o guard do dono */
  somaDaAba: number
}

/**
 * ⭐ O SELO: dois eixos, os dois pela mediana do PRÓPRIO período.
 *
 * ⚠️ **"Sobra" aqui é a sobra TOTAL, não a margem %** — e isso é deliberado: um produto de
 * 90% de margem que vendeu 3 unidades não enche caixa nenhum. O eixo do dinheiro é o que
 * pagou a casa; a margem % tem aba própria.
 */
export function seloDoProduto(
  p: { sobraTotal: number; unidades: number },
  cortes: { sobra: number | null; unidades: number | null },
): SeloDoVeredito {
  // ⛔ sem corte (período com 1 produto só) não existe comparação — e coroar sem disputa é
  // dar um prêmio que ninguém disputou (a trava da coroa de 06/09). Cai em REPENSAR? Não:
  // cai em ESTRELA só se houver população. Sem população, o neutro honesto é JOIA? Também
  // não — o honesto é não julgar, e quem não julga é o REPENSAR cinza... que JULGA.
  // ⭐ Resolvido: sem corte, o selo é o neutro da tela e a liga NÃO desenha selo (ver abaixo).
  if (cortes.sobra == null || cortes.unidades == null) return 'REPENSAR'
  const vende = p.unidades >= cortes.unidades
  const sobra = p.sobraTotal >= cortes.sobra
  if (vende && sobra) return 'ESTRELA'
  if (vende && !sobra) return 'BURRO_DE_CARGA'
  if (!vende && sobra) return 'JOIA_ESCONDIDA'
  return 'REPENSAR'
}

/**
 * ⚠️ **O SELO SÓ APARECE COM POPULAÇÃO SUFICIENTE.** Com menos de 4 produtos a mediana é
 * ela própria metade da amostra, e o selo viraria sorteio — *alarme (ou prêmio) falso é como
 * a tela perde a confiança*. É a mesma trava do "3+ componentes" do M2.
 */
export const MINIMO_PRA_SELO = 4

export function montarLiga(dentro: readonly ProdutoComSobra[], aba: AbaDaLiga): Liga {
  const temSelo = dentro.length >= MINIMO_PRA_SELO
  const cortes = temSelo
    ? {
        sobra: medianaDe(dentro.map((p) => p.sobraTotal)),
        unidades: medianaDe(dentro.map((p) => p.unidades)),
      }
    : { sobra: null, unidades: null }

  const valorDe = (p: ProdutoComSobra) =>
    aba === 'CAIXA' ? p.sobraTotal : aba === 'MARGEM' ? p.margemPct : p.unidades

  const ordenado = [...dentro].sort((a, b) => valorDe(b) - valorDe(a))
  const topo = ordenado.length > 0 ? valorDe(ordenado[0]) : 0

  const linhas: LinhaDaLiga[] = ordenado.map((p, i) => {
    const cara = caraDaReceita(p.nome)
    const selo = seloDoProduto(p, cortes)
    return {
      chave: p.chave,
      nome: p.nome,
      familia: cara.familia,
      icone: cara.icone,
      posicao: i + 1,
      medalha: i < 3 ? ((i + 1) as 1 | 2 | 3) : null,
      selo,
      // ⛔ sem população, a frase do selo NÃO vai pra tela (seria prêmio sem disputa)
      frase: temSelo ? FRASE_DO_SELO[selo] : 'ainda apurando — poucos produtos no período',
      sobraTotal: p.sobraTotal,
      sobraUn: p.sobraUn,
      margemPct: p.margemPct,
      unidades: p.unidades,
      valor: valorDe(p),
      barra: topo > 0 ? valorDe(p) / topo : 0,
    }
  })

  return {
    aba,
    linhas,
    cortes,
    // ⛔ o guard do dono: a aba CAIXA tem que somar exatamente a sobra do período
    somaDaAba: Math.round((linhas.reduce((s, l) => s + l.sobraTotal, 0) + 1e-9) * 100) / 100,
  }
}
