// ESTOQUE FASE 3 — REAL vs TEÓRICO: o motor que paga o módulo.
//
// ⭐ A SACADA: a variância JÁ ESTÁ NO LEDGER. Quando a contagem confirma uma linha, o
// `AJUSTE_CONTAGEM` gravado é, por construção, `real − teórico` naquele instante — o
// teórico era o saldo derivado dos movimentos, o real é o que o dono contou. Então o
// relatório NÃO recalcula a variância por uma segunda fórmula: ele LÊ os ajustes e
// EXPLICA o que aconteceu no meio (entradas, vendas, perdas, consumo de produção).
//
// Por que isso importa: uma segunda fórmula seria uma segunda fonte de verdade, e as duas
// iriam divergir no primeiro caso de borda (estorno, devolução de produção, item novo).
// É a mesma lição do motor de transferência (7 cópias discordando) e do dedup vs saldo
// (mesma tx, dois caminhos, sinais opostos). Uma decisão = uma função.
//
// ⚠️ HONESTIDADE DO NÚMERO: "real" só existe onde houve CONTAGEM. Item não contado no
// período tem variância `null` — "sem contagem", NUNCA zero. Zero afirmaria que bateu.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const EPS = 0.0001

/** ⭐ PISO DOS DADOS (regra dura do dono): 12/08/2026 pra frente é 100%; antes tem erro
 *  conhecido e não se mexe. O Real vs Teórico NUNCA olha antes disso — um relatório de
 *  variância sobre dado sabidamente torto é pior que nenhum: aponta furo que não existe. */
export const PISO_DADOS = '2026-08-12'

export const TIPOS = {
  ENTRADA: ['ENTRADA_NF', 'ENTRADA_MANUAL'],
  GERACAO: ['PRODUCAO_GERACAO'],
  VENDA: ['BAIXA_VENDA'],
  PERDA: ['PERDA', 'USO_INTERNO'],
  // SEPARACAO_SAIDA sai da prateleira; DEVOLUCAO_PRODUCAO volta. O líquido é o consumo.
  // PRODUCAO_CONSUMO é transferência interna (já saiu na separação) — NÃO entra aqui,
  // senão a baixa contaria 2× (mesma exclusão do saldo, fonte única).
  SEPARACAO: ['SEPARACAO_SAIDA'],
  DEVOLUCAO: ['DEVOLUCAO_PRODUCAO'],
  ESTORNO: ['ESTORNO'],
  AJUSTE: ['AJUSTE_CONTAGEM'],
} as const

const NAO_PRATELEIRA = 'PRODUCAO_CONSUMO'

export interface LinhaRvT {
  itemId: string
  nome: string
  categoria: string
  unidadeControle: string
  custoMedio: number | null
  saldoInicial: number
  entradas: number
  producaoGerada: number
  vendas: number
  perdas: number
  consumoProducao: number
  estornos: number
  /** saldo que os movimentos (sem ajuste) explicam ao fim do período */
  saldoTeorico: number
  saldoFinal: number
  /** null = item NÃO foi contado no período ("sem contagem", nunca zero) */
  variancia: number | null
  varianciaValor: number | null
  /** |variância| sobre o que ROTACIONOU (venda+perda+consumo) — denominador que significa algo */
  varianciaPct: number | null
  contagensNoPeriodo: number
  ultimaContagemEm: string | null
}

export interface ResumoRvT {
  de: string
  ate: string
  /** avisos honestos sobre o que o número NÃO cobre */
  avisos: string[]
  itens: number
  itensContados: number
  itensSemContagem: number
  /** perda não explicada (variância negativa) em R$ — o número que paga o módulo */
  varianciaNegativaValor: number
  varianciaPositivaValor: number
  varianciaLiquidaValor: number
  consumoValor: number
  /** variância líquida sobre o consumo do período */
  varianciaPctGeral: number | null
}

export interface RealVsTeorico { resumo: ResumoRvT; linhas: LinhaRvT[] }

function soma(movs: { tipo: string; quantidade: number; custoTotal: number }[], tipos: readonly string[]) {
  return movs.filter((m) => tipos.includes(m.tipo)).reduce((s, m) => s + m.quantidade, 0)
}

export async function calcularRealVsTeorico(
  input: { companyId: string; de: string; ate: string },
  db: PrismaClient = defaultPrisma,
): Promise<RealVsTeorico> {
  const avisos: string[] = []
  let de = input.de
  if (de < PISO_DADOS) {
    avisos.push(`O período foi ajustado para começar em ${PISO_DADOS.split('-').reverse().join('/')}: antes disso o estoque tem erro conhecido e um relatório de variância ali aponta furo que não existe.`)
    de = PISO_DADOS
  }
  const ate = input.ate
  const inicio = new Date(`${de}T00:00:00`)
  const fim = new Date(`${ate}T23:59:59`)

  const [itens, movsAntes, movsPeriodo, contagensItens] = await Promise.all([
    db.stockItem.findMany({ where: { companyId: input.companyId, ativo: true }, select: { id: true, nome: true, categoria: true, unidadeControle: true }, orderBy: { nome: 'asc' } }),
    db.stockMovement.findMany({ where: { companyId: input.companyId, dataMovimento: { lt: inicio }, tipo: { not: NAO_PRATELEIRA } }, select: { itemId: true, quantidade: true } }),
    db.stockMovement.findMany({ where: { companyId: input.companyId, dataMovimento: { gte: inicio, lte: fim }, tipo: { not: NAO_PRATELEIRA } }, select: { itemId: true, tipo: true, quantidade: true, custoTotal: true } }),
    db.stockContagemItem.findMany({ where: { companyId: input.companyId, contadoEm: { gte: inicio, lte: fim } }, select: { itemId: true, contadoEm: true } }),
  ])

  // saldo inicial por item (Σ movimentos de prateleira antes do período)
  const inicialPorItem = new Map<string, number>()
  for (const m of movsAntes) inicialPorItem.set(m.itemId, (inicialPorItem.get(m.itemId) ?? 0) + m.quantidade)

  const movsPorItem = new Map<string, typeof movsPeriodo>()
  for (const m of movsPeriodo) movsPorItem.set(m.itemId, [...(movsPorItem.get(m.itemId) ?? []), m])

  const contPorItem = new Map<string, { n: number; ultima: Date }>()
  for (const c of contagensItens) {
    const cur = contPorItem.get(c.itemId)
    contPorItem.set(c.itemId, { n: (cur?.n ?? 0) + 1, ultima: !cur || c.contadoEm > cur.ultima ? c.contadoEm : cur.ultima })
  }

  const linhas: LinhaRvT[] = []
  for (const it of itens) {
    const ms = movsPorItem.get(it.id) ?? []
    const cont = contPorItem.get(it.id)
    const saldoInicial = round3(inicialPorItem.get(it.id) ?? 0)

    const entradas = round3(soma(ms, TIPOS.ENTRADA))
    const producaoGerada = round3(soma(ms, TIPOS.GERACAO))
    const vendas = round3(-soma(ms, TIPOS.VENDA)) // guardado negativo no ledger
    const perdas = round3(-soma(ms, TIPOS.PERDA))
    const consumoProducao = round3(-soma(ms, TIPOS.SEPARACAO) - soma(ms, TIPOS.DEVOLUCAO))
    const estornos = round3(soma(ms, TIPOS.ESTORNO))
    const ajustes = round3(soma(ms, TIPOS.AJUSTE))
    const ajustesValor = round2(ms.filter((m) => TIPOS.AJUSTE.includes(m.tipo as never)).reduce((s, m) => s + m.custoTotal, 0))

    const saldoTeorico = round3(saldoInicial + entradas + producaoGerada + estornos - vendas - perdas - consumoProducao)
    const saldoFinal = round3(saldoTeorico + ajustes)

    // custoMedio entra depois, numa query única (fonte a MESMA da Posição — REGRA 4)
    const custoMedio: number | null = null

    const rotacao = round3(vendas + perdas + consumoProducao)
    const contado = !!cont
    linhas.push({
      itemId: it.id, nome: it.nome, categoria: it.categoria, unidadeControle: it.unidadeControle,
      custoMedio,
      saldoInicial, entradas, producaoGerada, vendas, perdas, consumoProducao, estornos,
      saldoTeorico, saldoFinal,
      // ⭐ a variância É o ajuste da contagem — não uma segunda conta
      variancia: contado ? ajustes : null,
      varianciaValor: contado ? ajustesValor : null,
      varianciaPct: contado && rotacao > EPS ? round3(Math.abs(ajustes) / rotacao) : null,
      contagensNoPeriodo: cont?.n ?? 0,
      ultimaContagemEm: cont ? cont.ultima.toISOString() : null,
    })
  }

  // custo médio real (derivado de TODO o histórico, igual à Posição) — preenchido aqui
  // com uma query só, em vez de por item.
  const saldos = await db.stockMovement.groupBy({
    by: ['itemId'], where: { companyId: input.companyId, tipo: { not: NAO_PRATELEIRA } },
    _sum: { quantidade: true, custoTotal: true },
  })
  const cmPorItem = new Map(saldos.map((s) => {
    const q = s._sum.quantidade ?? 0
    const v = s._sum.custoTotal ?? 0
    return [s.itemId, q > EPS ? round2(v / q) : null]
  }))
  for (const l of linhas) l.custoMedio = cmPorItem.get(l.itemId) ?? null

  const comContagem = linhas.filter((l) => l.variancia != null)
  const comVariancia = comContagem.filter((l) => Math.abs(l.variancia!) > EPS)
  const negativa = round2(comVariancia.filter((l) => l.varianciaValor! < 0).reduce((s, l) => s + l.varianciaValor!, 0))
  const positiva = round2(comVariancia.filter((l) => l.varianciaValor! > 0).reduce((s, l) => s + l.varianciaValor!, 0))
  const consumoValor = round2(linhas.reduce((s, l) => s + (l.custoMedio ?? 0) * (l.vendas + l.perdas + l.consumoProducao), 0))

  if (comContagem.length === 0) {
    avisos.push('Nenhum item foi contado neste período — sem contagem não existe "real", então não há variância a mostrar. A primeira contagem é o marco zero do Real vs Teórico.')
  } else if (linhas.length - comContagem.length > 0) {
    avisos.push(`${linhas.length - comContagem.length} item(ns) não foram contados no período e ficam de fora da variância — o furo deles, se houver, está invisível aqui.`)
  }

  return {
    resumo: {
      de, ate, avisos,
      itens: linhas.length,
      itensContados: comContagem.length,
      itensSemContagem: linhas.length - comContagem.length,
      varianciaNegativaValor: negativa,
      varianciaPositivaValor: positiva,
      varianciaLiquidaValor: round2(negativa + positiva),
      consumoValor,
      varianciaPctGeral: consumoValor > EPS ? round3(Math.abs(negativa + positiva) / consumoValor) : null,
    },
    linhas,
  }
}

/** Leitura do sinal — o dono não deve ter que decorar o que + e − significam. */
export function interpretar(l: LinhaRvT): string | null {
  if (l.variancia == null || Math.abs(l.variancia) <= EPS) return null
  return l.variancia < 0
    ? 'faltou estoque: perda não registrada, porção maior que a ficha, ou saída sem lançamento'
    : 'sobrou estoque: venda lançada que não saiu, porção menor que a ficha, ou entrada a mais do que a nota dizia'
}
