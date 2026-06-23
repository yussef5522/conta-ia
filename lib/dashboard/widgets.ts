// Sprint 8 — 3 agregações novas pra widgets do dashboard.
//
// FONTE ÚNICA: reusa os mesmos filtros do motor Sprint 4
// (lifecycle=EFFECTED + reconciledWithId=null + EXPENSE_DRE_GROUPS/RECEITA_BRUTA
// + regime caixa/competência + NON_DRE excluído).
//
// 1. getCashflowMensal — últimos 6 meses (entrou, saiu, resultado, cobertura)
// 2. getTopFornecedores — top N DEBIT por supplierId
// 3. getReceitaPorForma — PIX / Cartão+antecipação / Dinheiro / iFood / Outras

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import type { Regime } from './engine'

const EXPENSE_DRE_GROUPS = [
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
]

const NON_DRE_GROUPS = [
  'TRANSFERENCIA',
  'DISTRIBUICAO_LUCROS',
  'INVESTIMENTOS',
  'AJUSTE_SALDO',
]

const CACHE_TTL = 60

function whereByRegime(start: Date, end: Date, regime: Regime) {
  if (regime === 'caixa') {
    return {
      OR: [
        { paymentDate: { gte: start, lte: end } },
        { paymentDate: null, date: { gte: start, lte: end } },
      ],
    }
  }
  return {
    OR: [
      { competenceDate: { gte: start, lte: end } },
      { competenceDate: null, date: { gte: start, lte: end } },
    ],
  }
}

// ============================================================
// 1. FLUXO DE CAIXA MENSAL (últimos 6 meses)
// ============================================================

export interface CashflowMonthItem {
  year: number
  month: number // 0-11
  mesLabel: string // "Jun 2026"
  entrou: number // CREDIT EFFECTED non-NON_DRE
  saiu: number // DEBIT EFFECTED non-NON_DRE
  resultado: number
  qtdTx: number
  cobertura: 'completo' | 'parcial' | 'sem_dados'
  isMTD: boolean
}

export interface CashflowMensalResult {
  companyId: string
  regime: Regime
  meses: CashflowMonthItem[]
  computedAt: string
}

const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** Decide cobertura comparando qtdTx vs maior mês do conjunto. < 20% = parcial. */
function decideCobertura(qtd: number, maiorQtd: number): 'completo' | 'parcial' | 'sem_dados' {
  if (qtd === 0) return 'sem_dados'
  if (maiorQtd === 0) return 'completo'
  if (qtd / maiorQtd < 0.2) return 'parcial'
  return 'completo'
}

export async function getCashflowMensal(
  companyId: string,
  refDate: Date,
  regime: Regime,
  monthsBack: number = 6,
): Promise<CashflowMensalResult> {
  if (!companyId) throw new Error('companyId obrigatório')
  const dayKey = refDate.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadCashflowMensal(companyId, refDate, regime, monthsBack),
    [`dashboard:widgets:cashflow:${companyId}:${regime}:${dayKey}:${monthsBack}`],
    { revalidate: CACHE_TTL, tags: [`dashboard:${companyId}`] },
  )
  return cached()
}

export async function loadCashflowMensal(
  companyId: string,
  refDate: Date,
  regime: Regime,
  monthsBack: number = 6,
): Promise<CashflowMensalResult> {
  // Define o range total (do 1º dia do mês mais antigo até refDate)
  const refY = refDate.getUTCFullYear()
  const refM = refDate.getUTCMonth()
  const oldestStart = new Date(Date.UTC(refY, refM - (monthsBack - 1), 1))

  // Busca todas as tx no range total, agrupa por mês na JS land
  const dateField = regime === 'caixa' ? 'paymentDate' : 'competenceDate'
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: { not: 'TRANSFER' },
      categoryId: { not: null },
      category: {
        dreGroup: {
          notIn: NON_DRE_GROUPS,
        },
      },
      ...whereByRegime(oldestStart, refDate, regime),
    },
    select: {
      type: true,
      amount: true,
      date: true,
      paymentDate: true,
      competenceDate: true,
    },
  })

  // Bucket por mês
  type Bucket = { entrou: number; saiu: number; qtdTx: number }
  const buckets = new Map<string, Bucket>() // "YYYY-MM"
  for (let i = 0; i < monthsBack; i++) {
    const m = (refM - (monthsBack - 1 - i) + 12) % 12
    const y = refY + Math.floor((refM - (monthsBack - 1 - i)) / 12)
    buckets.set(`${y}-${String(m).padStart(2, '0')}`, { entrou: 0, saiu: 0, qtdTx: 0 })
  }

  for (const tx of transactions) {
    const dateUsed = (tx as Record<string, unknown>)[dateField] as Date | null
    const d = dateUsed ?? tx.date
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const key = `${y}-${String(m).padStart(2, '0')}`
    const b = buckets.get(key)
    if (!b) continue
    b.qtdTx++
    if (tx.type === 'CREDIT') b.entrou += tx.amount
    else if (tx.type === 'DEBIT') b.saiu += tx.amount
  }

  const maiorQtd = Math.max(...Array.from(buckets.values()).map((b) => b.qtdTx), 0)

  const meses: CashflowMonthItem[] = []
  for (let i = 0; i < monthsBack; i++) {
    const m = (refM - (monthsBack - 1 - i) + 12) % 12
    const y = refY + Math.floor((refM - (monthsBack - 1 - i)) / 12)
    const key = `${y}-${String(m).padStart(2, '0')}`
    const b = buckets.get(key)!
    const isMTD = y === refY && m === refM
    meses.push({
      year: y,
      month: m,
      mesLabel: `${MES_LABELS[m]} ${String(y).slice(-2)}`,
      entrou: b.entrou,
      saiu: b.saiu,
      resultado: b.entrou - b.saiu,
      qtdTx: b.qtdTx,
      cobertura: isMTD ? 'parcial' : decideCobertura(b.qtdTx, maiorQtd),
      isMTD,
    })
  }

  return { companyId, regime, meses, computedAt: new Date().toISOString() }
}

// ============================================================
// 2. TOP FORNECEDORES (DEBIT non-NON_DRE)
// ============================================================

export interface FornecedorItem {
  supplierId: string
  razaoSocial: string
  cnpj: string | null
  total: number
  qtdTx: number
  pct: number
}

export interface TopFornecedoresResult {
  companyId: string
  regime: Regime
  periodStart: string
  periodEnd: string
  fornecedores: FornecedorItem[]
  totalGeral: number // soma dos top N (pra calcular pct)
  totalDespesas: number // total geral de despesas (referência)
  computedAt: string
}

export async function getTopFornecedores(input: {
  companyId: string
  periodStart: Date
  periodEnd: Date
  regime: Regime
  limit?: number
}): Promise<TopFornecedoresResult> {
  if (!input.companyId) throw new Error('companyId obrigatório')
  const sk = input.periodStart.toISOString().slice(0, 10)
  const ek = input.periodEnd.toISOString().slice(0, 10)
  const lim = input.limit ?? 5
  const cached = unstable_cache(
    async () => loadTopFornecedores(input),
    [`dashboard:widgets:fornecedores:${input.companyId}:${input.regime}:${sk}:${ek}:${lim}`],
    { revalidate: CACHE_TTL, tags: [`dashboard:${input.companyId}`] },
  )
  return cached()
}

export async function loadTopFornecedores(input: {
  companyId: string
  periodStart: Date
  periodEnd: Date
  regime: Regime
  limit?: number
}): Promise<TopFornecedoresResult> {
  const limit = input.limit ?? 5

  // groupBy supplierId
  const grouped = await prisma.transaction.groupBy({
    by: ['supplierId'],
    where: {
      bankAccount: { companyId: input.companyId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      categoryId: { not: null },
      supplierId: { not: null },
      category: { dreGroup: { in: EXPENSE_DRE_GROUPS } },
      ...whereByRegime(input.periodStart, input.periodEnd, input.regime),
    },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })

  const supplierIds = grouped
    .map((g) => g.supplierId)
    .filter((id): id is string => Boolean(id))

  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true },
  })
  const byId = new Map(suppliers.map((s) => [s.id, s]))

  const flat = grouped
    .map((g) => {
      const s = byId.get(g.supplierId!)
      if (!s) return null
      return {
        supplierId: s.id,
        razaoSocial: s.nomeFantasia ?? s.razaoSocial,
        cnpj: s.cnpj,
        total: g._sum.amount ?? 0,
        qtdTx: g._count._all,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const totalGeral = flat.reduce((s, f) => s + f.total, 0)

  // Pra ter pct meaningful, calculamos também o total geral de despesas
  const totalDespesasAgg = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: input.companyId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      categoryId: { not: null },
      category: { dreGroup: { in: EXPENSE_DRE_GROUPS } },
      ...whereByRegime(input.periodStart, input.periodEnd, input.regime),
    },
    _sum: { amount: true },
  })
  const totalDespesas = totalDespesasAgg._sum.amount ?? 0

  const fornecedores: FornecedorItem[] = flat.map((f) => ({
    ...f,
    pct: totalDespesas > 0 ? (f.total / totalDespesas) * 100 : 0,
  }))

  return {
    companyId: input.companyId,
    regime: input.regime,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    fornecedores,
    totalGeral,
    totalDespesas,
    computedAt: new Date().toISOString(),
  }
}

// ============================================================
// 3. RECEITA POR FORMA (PIX / Cartão / Dinheiro / iFood / Outras)
// ============================================================

export type FormaPagamento = 'PIX' | 'CARTAO' | 'DINHEIRO' | 'IFOOD' | 'OUTRAS'

export interface ReceitaFormaItem {
  forma: FormaPagamento
  label: string
  total: number
  qtdTx: number
  pct: number
  color: string
}

export interface ReceitaPorFormaResult {
  companyId: string
  regime: Regime
  periodStart: string
  periodEnd: string
  formas: ReceitaFormaItem[]
  totalReceita: number
  computedAt: string
}

const FORMA_META: Record<FormaPagamento, { label: string; color: string }> = {
  PIX: { label: 'PIX', color: '#1D9E75' },
  CARTAO: { label: 'Cartão', color: '#185FA5' },
  DINHEIRO: { label: 'Dinheiro', color: '#EF9F27' },
  IFOOD: { label: 'iFood / Delivery', color: '#E24B4A' },
  OUTRAS: { label: 'Outras', color: '#6B7280' },
}

/** Classifica uma tx de RECEITA_BRUTA por forma de pagamento usando
 * categoria primeiro, descrição em fallback. */
export function classificarFormaReceita(
  categoryName: string,
  description: string,
): FormaPagamento {
  const cat = categoryName.toLowerCase()
  if (cat.includes('pix')) return 'PIX'
  if (cat.includes('cart')) return 'CARTAO'
  if (cat.includes('delivery') || cat.includes('ifood')) return 'IFOOD'

  // categoria = "Receita de Vendas" mistura: regex de descrição
  const desc = description.toUpperCase()
  if (
    /OP\.?\s*CREDITO|BANRI A VISTA|ANTECIPACAO BANRI|VERO ANTECIPACAO|ANTECIP STONE|DEBITO STONE|BANRICARD/.test(desc)
  ) {
    return 'CARTAO'
  }
  if (/DINHEIRO|CAIXA|RECEITA DA VENDA|RECEITA DE VENDA EM DINHEIRO|RECEITA DE VENDA DINHEIRO/.test(desc)) {
    return 'DINHEIRO'
  }
  if (/PIX/.test(desc)) return 'PIX'
  if (/IFOOD|DELIVERY/.test(desc)) return 'IFOOD'
  return 'OUTRAS'
}

export async function getReceitaPorForma(input: {
  companyId: string
  periodStart: Date
  periodEnd: Date
  regime: Regime
}): Promise<ReceitaPorFormaResult> {
  if (!input.companyId) throw new Error('companyId obrigatório')
  const sk = input.periodStart.toISOString().slice(0, 10)
  const ek = input.periodEnd.toISOString().slice(0, 10)
  const cached = unstable_cache(
    async () => loadReceitaPorForma(input),
    [`dashboard:widgets:receita-forma:${input.companyId}:${input.regime}:${sk}:${ek}`],
    { revalidate: CACHE_TTL, tags: [`dashboard:${input.companyId}`] },
  )
  return cached()
}

export async function loadReceitaPorForma(input: {
  companyId: string
  periodStart: Date
  periodEnd: Date
  regime: Regime
}): Promise<ReceitaPorFormaResult> {
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: input.companyId },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'CREDIT',
      categoryId: { not: null },
      category: { dreGroup: 'RECEITA_BRUTA' },
      ...whereByRegime(input.periodStart, input.periodEnd, input.regime),
    },
    select: {
      amount: true,
      description: true,
      category: { select: { name: true } },
    },
  })

  const buckets = new Map<FormaPagamento, { total: number; qtdTx: number }>()
  for (const f of ['PIX', 'CARTAO', 'DINHEIRO', 'IFOOD', 'OUTRAS'] as FormaPagamento[]) {
    buckets.set(f, { total: 0, qtdTx: 0 })
  }

  for (const tx of transactions) {
    const forma = classificarFormaReceita(tx.category?.name ?? '', tx.description)
    const b = buckets.get(forma)!
    b.total += tx.amount
    b.qtdTx++
  }

  const totalReceita = transactions.reduce((s, t) => s + t.amount, 0)

  const formas: ReceitaFormaItem[] = Array.from(buckets.entries())
    .map(([forma, b]) => ({
      forma,
      label: FORMA_META[forma].label,
      color: FORMA_META[forma].color,
      total: b.total,
      qtdTx: b.qtdTx,
      pct: totalReceita > 0 ? (b.total / totalReceita) * 100 : 0,
    }))
    .filter((f) => f.qtdTx > 0)
    .sort((a, b) => b.total - a.total)

  return {
    companyId: input.companyId,
    regime: input.regime,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    formas,
    totalReceita,
    computedAt: new Date().toISOString(),
  }
}
