// Sprint 5.0.2.f — Detecta compras (geram créditos PIS/COFINS) nas Transactions.
//
// Heurística por nome de categoria + dreGroup. Roda nos últimos 12 meses,
// soma DEBIT em categorias típicas de compras de mercadorias/insumos.
//
// IMPORTANTE: pra crédito PIS/COFINS não-cumulativo (Lei 10.637/02 + 10.833/03),
// compra tem que ser de PJ tributada pelos mesmos. Aqui assumimos que 100% das
// compras detectadas qualificam — usuário pode override no UI.

import { prisma } from '@/lib/db'

/** dreGroups que tipicamente representam compras de insumos/mercadorias */
const COMPRAS_DREGROUPS = new Set([
  'CUSTO_MERCADORIA',
  'CUSTO_INSUMO',
  'CUSTO_PRODUCAO',
  'CUSTOS_OPERACIONAIS',
  'DESPESAS_INSUMOS',
])

/** Keywords no nome da categoria pra compras (case-insensitive, sem acento) */
const COMPRAS_KEYWORDS = [
  'fornecedor',
  'fornecedores',
  'material',
  'materia-prima',
  'materia prima',
  'insumo',
  'insumos',
  'embalagem',
  'embalagens',
  'compras',
  'compra',
  'mercadoria',
  'mercadorias',
  'estoque',
  'alimentos',
  'bebidas',
  'carnes',
  'hortifruti',
  'hortifruti',
  'matéria-prima',
  'matéria prima',
]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export interface ComprasDetectadas {
  totalCompras12m: number
  totalDespesas12m: number
  comprasMensalMedia: number
  percentSobreReceita: number
  fornecedoresDetectados: number
  /** Detalhamento por categoria (top 10) */
  topCategorias: Array<{ category: string; valor: number; pct: number }>
}

interface TxLite {
  amount: number
  type: string
  category: { name: string; dreGroup: string | null } | null
  supplier: { razaoSocial: string | null } | null
  description: string | null
}

/**
 * Função PURA — testável sem DB. Aggregate puro dos arrays.
 */
export function detectComprasFromTransactions(transactions: TxLite[]): {
  totalCompras: number
  totalDespesas: number
  receitaTotal: number
  fornecedoresUnicos: number
  topCategorias: Array<{ category: string; valor: number; pct: number }>
} {
  let totalCompras = 0
  let totalDespesas = 0
  let receitaTotal = 0
  const fornecedoresUnicos = new Set<string>()
  const byCategoria = new Map<string, number>()

  for (const tx of transactions) {
    if (tx.type === 'TRANSFER') continue

    if (tx.type === 'CREDIT') {
      receitaTotal += tx.amount
      continue
    }
    if (tx.type !== 'DEBIT') continue

    totalDespesas += tx.amount

    const cat = tx.category
    if (!cat) continue

    const dreMatch = cat.dreGroup && COMPRAS_DREGROUPS.has(cat.dreGroup)
    const catNameNorm = normalize(cat.name)
    const keywordMatch = COMPRAS_KEYWORDS.some((k) => catNameNorm.includes(normalize(k)))

    if (dreMatch || keywordMatch) {
      totalCompras += tx.amount
      byCategoria.set(cat.name, (byCategoria.get(cat.name) ?? 0) + tx.amount)
      const vendor = tx.supplier?.razaoSocial?.trim() || tx.description?.trim()
      if (vendor) fornecedoresUnicos.add(vendor.slice(0, 80))
    }
  }

  const topCategorias = Array.from(byCategoria.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, valor]) => ({
      category,
      valor,
      pct: totalCompras > 0 ? (valor / totalCompras) * 100 : 0,
    }))

  return {
    totalCompras,
    totalDespesas,
    receitaTotal,
    fornecedoresUnicos: fornecedoresUnicos.size,
    topCategorias,
  }
}

/**
 * Loader DB: busca Transactions últimos 12m e roda agregação.
 */
export async function detectComprasUltimos12m(companyId: string): Promise<ComprasDetectadas> {
  const fim = new Date()
  const inicio = new Date()
  inicio.setMonth(inicio.getMonth() - 12)

  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      lifecycle: 'EFFECTED',
      OR: [
        { paymentDate: { gte: inicio, lte: fim } },
        { date: { gte: inicio, lte: fim } },
      ],
    },
    select: {
      amount: true,
      type: true,
      description: true,
      category: { select: { name: true, dreGroup: true } },
      supplier: { select: { razaoSocial: true } },
    },
    take: 10_000,
  })

  const r = detectComprasFromTransactions(transactions as unknown as TxLite[])

  return {
    totalCompras12m: r.totalCompras,
    totalDespesas12m: r.totalDespesas,
    comprasMensalMedia: r.totalCompras / 12,
    percentSobreReceita: r.receitaTotal > 0 ? r.totalCompras / r.receitaTotal : 0,
    fornecedoresDetectados: r.fornecedoresUnicos,
    topCategorias: r.topCategorias,
  }
}
