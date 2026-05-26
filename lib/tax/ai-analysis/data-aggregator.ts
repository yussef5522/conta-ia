// Sprint 5.0.2.d — Aggregação de dados reais de transações para análise tributária.
//
// Lê transactions com lifecycle='EFFECTED' dos últimos N meses e agrega:
//   - Receita (CREDIT, exceto TRANSFER)
//   - Despesa (DEBIT, exceto TRANSFER)
//   - Despesas por categoria
//   - Folha identificada (via category.dreGroup)
//   - Top fornecedores (counterparty)
//   - Impostos detectados (DAS, DARF, INSS, etc nas descrições/categorias)
//
// Função pura assintótica: recebe arrays de Prisma, retorna estrutura
// CompanyTaxAnalysisData. DB call separada em `loadCompanyTaxData`.

import { prisma } from '@/lib/db'
import { findCNAE, expertiseForCNAE, type Ramo } from '@/lib/tax/expertise'
import { detectComprasFromTransactions } from '@/lib/tax/detect-compras'

export interface CompanyTaxAnalysisData {
  companyId: string
  companyName: string
  cnpj: string

  cnae?: {
    code: string
    name: string
    ramo: Ramo | 'OUTRO'
    anexoSimples?: string
  }

  taxProfile: {
    regime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL'
    simplesAnexo?: string
    folha12m: number
    proLabore: number
    estado: string
    hasICMS: boolean
    hasISS: boolean
    margemReal: number
  }

  financial: {
    periodStart: Date
    periodEnd: Date

    receitaTotal: number
    receitaMensalMedia: number
    receitaPorMes: Array<{ mes: string; valor: number }>

    despesaTotal: number
    despesaMensalMedia: number
    despesasPorCategoria: Array<{ category: string; valor: number; pct: number }>

    folhaIdentificada: number
    proLaboreIdentificado: number

    fornecedoresTop: Array<{
      nome: string
      categoria: string
      valor12m: number
      transacoes: number
    }>

    margemBruta: number
    margemLiquidaEstimada: number
  }

  impostosAtual: {
    detectados: Array<{
      tipo: string
      valor12m: number
      fonte: 'TRANSACAO_DIRETA' | 'ESTIMATIVA_REGIME'
    }>
    totalPagoEstimado: number
    aliquotaEfetivaAtual: number
  }

  // Sprint 5.0.2.f — compras detectadas (geram créditos PIS/COFINS no Real)
  compras: {
    total12m: number
    mensalMedia: number
    percentSobreReceita: number
    fornecedoresDetectados: number
  }
}

export interface TxLite {
  amount: number
  type: string
  paymentDate: Date | null
  date: Date
  description: string | null
  competenceDate: Date | null
  category: {
    name: string
    dreGroup: string | null
  } | null
  supplier: { razaoSocial: string | null } | null
}

const FOLHA_DREGROUPS = new Set([
  'DESPESAS_PESSOAL',
  'CUSTO_PESSOAL',
  'PRO_LABORE',
])

const FOLHA_NAME_KEYWORDS = ['folha', 'salário', 'salario', 'pró-labore', 'pro labore', 'inss', 'fgts']

const IMPOSTO_DETECTORS: Array<{ tipo: string; regex: RegExp }> = [
  { tipo: 'DAS Simples', regex: /\b(das|simples\s*nacional)\b/i },
  { tipo: 'IRPJ', regex: /\b(irpj|darf.*irpj)\b/i },
  { tipo: 'CSLL', regex: /\bcsll\b/i },
  { tipo: 'PIS', regex: /\b(pis|pis\/pasep)\b/i },
  { tipo: 'COFINS', regex: /\bcofins\b/i },
  { tipo: 'ICMS', regex: /\bicms\b/i },
  { tipo: 'ISS', regex: /\biss\b/i },
  { tipo: 'INSS', regex: /\binss\b/i },
  { tipo: 'FGTS', regex: /\bfgts\b/i },
]

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function isFolha(tx: TxLite): boolean {
  if (tx.category?.dreGroup && FOLHA_DREGROUPS.has(tx.category.dreGroup)) return true
  const name = (tx.category?.name ?? '').toLowerCase()
  return FOLHA_NAME_KEYWORDS.some((k) => name.includes(k))
}

function detectImposto(desc: string): string | null {
  for (const d of IMPOSTO_DETECTORS) {
    if (d.regex.test(desc)) return d.tipo
  }
  return null
}

/**
 * Agregação pura dos arrays. Exposta separadamente pra testes sem DB.
 */
export function aggregateFromTransactions(
  transactions: TxLite[],
  monthsBack: number,
  periodStart: Date,
  periodEnd: Date,
): CompanyTaxAnalysisData['financial'] & {
  impostosDetectados: CompanyTaxAnalysisData['impostosAtual']['detectados']
} {
  const nonTransfer = transactions.filter((t) => t.type !== 'TRANSFER')

  const receitas = nonTransfer.filter((t) => t.type === 'CREDIT')
  const despesas = nonTransfer.filter((t) => t.type === 'DEBIT')

  const receitaTotal = receitas.reduce((s, t) => s + t.amount, 0)
  const despesaTotal = despesas.reduce((s, t) => s + t.amount, 0)

  // Por mês (usa paymentDate; fallback competenceDate; fallback date)
  const byMonth = new Map<string, number>()
  for (const t of receitas) {
    const d = t.paymentDate ?? t.competenceDate ?? t.date
    const k = monthKey(d)
    byMonth.set(k, (byMonth.get(k) ?? 0) + t.amount)
  }
  const receitaPorMes = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ mes, valor }))

  // Por categoria
  const byCat = new Map<string, number>()
  for (const t of despesas) {
    const cat = t.category?.name ?? 'Sem categoria'
    byCat.set(cat, (byCat.get(cat) ?? 0) + t.amount)
  }
  const despesasPorCategoria = Array.from(byCat.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([category, valor]) => ({
      category,
      valor,
      pct: despesaTotal > 0 ? (valor / despesaTotal) * 100 : 0,
    }))

  // Folha
  const folhaIdentificada = despesas.filter(isFolha).reduce((s, t) => s + t.amount, 0)

  // Top fornecedores
  const byVendor = new Map<string, { valor: number; transacoes: number; categoria: string }>()
  for (const t of despesas) {
    const nome = t.supplier?.razaoSocial?.trim() || extractCounterpartyFromDescription(t.description)
    if (!nome) continue
    const existing = byVendor.get(nome) ?? {
      valor: 0,
      transacoes: 0,
      categoria: t.category?.name ?? 'Sem categoria',
    }
    existing.valor += t.amount
    existing.transacoes += 1
    byVendor.set(nome, existing)
  }
  const fornecedoresTop = Array.from(byVendor.entries())
    .sort(([, a], [, b]) => b.valor - a.valor)
    .slice(0, 10)
    .map(([nome, v]) => ({
      nome,
      categoria: v.categoria,
      valor12m: v.valor,
      transacoes: v.transacoes,
    }))

  // Impostos detectados
  const byImposto = new Map<string, number>()
  for (const t of despesas) {
    const desc = t.description ?? ''
    const tipo = detectImposto(desc) ?? detectImposto(t.category?.name ?? '')
    if (!tipo) continue
    byImposto.set(tipo, (byImposto.get(tipo) ?? 0) + t.amount)
  }
  const impostosDetectados = Array.from(byImposto.entries()).map(([tipo, valor12m]) => ({
    tipo,
    valor12m,
    fonte: 'TRANSACAO_DIRETA' as const,
  }))

  const margemBruta = receitaTotal > 0 ? (receitaTotal - despesaTotal) / receitaTotal : 0

  return {
    periodStart,
    periodEnd,
    receitaTotal,
    receitaMensalMedia: receitaTotal / monthsBack,
    receitaPorMes,
    despesaTotal,
    despesaMensalMedia: despesaTotal / monthsBack,
    despesasPorCategoria,
    folhaIdentificada,
    proLaboreIdentificado: 0, // pró-labore vem de taxProfile, não detectado em tx
    fornecedoresTop,
    margemBruta,
    margemLiquidaEstimada: margemBruta * 0.7, // estimativa conservadora (custos não-folha)
    impostosDetectados,
  }
}

function extractCounterpartyFromDescription(desc: string | null): string | null {
  if (!desc) return null
  // Heurística simples: pega primeiro nome relevante (>3 chars não-numérico)
  const clean = desc.replace(/[*\-]/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length < 4) return null
  return clean.substring(0, 60)
}

/**
 * Carrega dados reais do banco e agrega. Loader principal pra endpoint.
 */
export async function loadCompanyTaxData(
  companyId: string,
  monthsBack = 12,
): Promise<CompanyTaxAnalysisData> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      taxProfile: {
        include: { cnaeActivity: true },
      },
    },
  })

  if (!company) throw new Error('Empresa não encontrada')

  const periodEnd = new Date()
  const periodStart = new Date()
  periodStart.setMonth(periodStart.getMonth() - monthsBack)

  // Buscar transações efetivadas no período
  const transactions = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId },
      lifecycle: 'EFFECTED',
      OR: [
        { paymentDate: { gte: periodStart, lte: periodEnd } },
        { date: { gte: periodStart, lte: periodEnd } },
      ],
    },
    select: {
      amount: true,
      type: true,
      paymentDate: true,
      date: true,
      description: true,
      competenceDate: true,
      category: { select: { name: true, dreGroup: true } },
      supplier: { select: { razaoSocial: true } },
    },
    take: 5000,
  })

  const aggregated = aggregateFromTransactions(
    transactions as unknown as TxLite[],
    monthsBack,
    periodStart,
    periodEnd,
  )
  const { impostosDetectados, ...financial } = aggregated

  // Sprint 5.0.2.f — detecta compras (créditos PIS/COFINS no Lucro Real)
  const comprasDetect = detectComprasFromTransactions(
    transactions as unknown as Parameters<typeof detectComprasFromTransactions>[0],
  )

  const totalPagoEstimado = impostosDetectados.reduce((s, i) => s + i.valor12m, 0)
  const aliquotaEfetivaAtual =
    financial.receitaTotal > 0 ? (totalPagoEstimado / financial.receitaTotal) * 100 : 0

  // CNAE expert (catálogo Sprint 5.0.2.b)
  const cnaeStr = company.taxProfile?.cnae
  const cnaeEntry = cnaeStr ? findCNAE(cnaeStr) : null

  return {
    companyId,
    companyName: company.name,
    cnpj: company.cnpj,
    cnae: cnaeEntry
      ? {
          code: cnaeEntry.code,
          name: cnaeEntry.name,
          ramo: cnaeEntry.ramo,
          anexoSimples: company.taxProfile?.cnaeActivity?.anexoSimples ?? undefined,
        }
      : undefined,
    taxProfile: company.taxProfile
      ? {
          regime: company.taxProfile.regime as CompanyTaxAnalysisData['taxProfile']['regime'],
          simplesAnexo: company.taxProfile.simplesAnexo ?? undefined,
          folha12m: company.taxProfile.folha12m,
          proLabore: company.taxProfile.proLabore,
          estado: company.taxProfile.estado ?? 'RS',
          hasICMS: company.taxProfile.hasICMS,
          hasISS: company.taxProfile.hasISS,
          margemReal: company.taxProfile.margemReal,
        }
      : {
          regime: 'SIMPLES_NACIONAL',
          folha12m: 0,
          proLabore: 0,
          estado: 'RS',
          hasICMS: false,
          hasISS: true,
          margemReal: 15,
        },
    financial,
    impostosAtual: {
      detectados: impostosDetectados,
      totalPagoEstimado,
      aliquotaEfetivaAtual,
    },
    compras: {
      total12m: comprasDetect.totalCompras,
      mensalMedia: comprasDetect.totalCompras / monthsBack,
      percentSobreReceita:
        comprasDetect.receitaTotal > 0
          ? comprasDetect.totalCompras / comprasDetect.receitaTotal
          : 0,
      fornecedoresDetectados: comprasDetect.fornecedoresUnicos,
    },
  }
}
