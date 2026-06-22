// Sprint 4 FASE 6 — Validação cruzada: motor único bate widgets?
// READ-ONLY. Compara motor único vs SQL direto (mesma semântica dos widgets).
// Em runtime Next.js os widgets vão buscar via unstable_cache; aqui validamos
// que a base SQL ainda é a mesma fonte da verdade.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

const EXPENSE_DRE_GROUPS = [
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_PESSOAL',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
]

const NON_DRE_GROUPS = ['DISTRIBUICAO_LUCROS', 'INVESTIMENTOS', 'TRANSFERENCIA', 'AJUSTE_SALDO']

async function main() {
  console.log('━'.repeat(80))
  console.log('SPRINT 4 FASE 6 — Validação cruzada (motor único vs SQL direto)')
  console.log('━'.repeat(80))

  const refDate = new Date()

  console.log('\n━━ getDashboardData() — fonte ÚNICA ━━')
  const data = await loadDashboardData(CACULA, refDate, 'caixa')
  console.log(`  saldoAtual:           R$ ${data.saldoAtual.toFixed(2)}`)
  console.log(`  receitaBruta:         R$ ${data.receitaBruta.toFixed(2)}`)
  console.log(`  totalDeducoes:        R$ ${data.totalDeducoes.toFixed(2)}`)
  console.log(`  lucroBruto:           R$ ${data.lucroBruto.toFixed(2)}`)
  console.log(`  despesaOperacional:   R$ ${data.despesaOperacional.toFixed(2)}`)
  console.log(`  resultadoOperacional: R$ ${data.resultadoOperacional.toFixed(2)}`)
  console.log(`  lucroLiquido:         R$ ${data.lucroLiquido.toFixed(2)}`)
  console.log(`  margemLiquida:        ${data.margemLiquida.toFixed(1)}%`)
  console.log(`  pendentes:            ${data.pendentes.total}`)
  console.log(`  top5Despesas (${data.top5Despesas.items.length}):`)
  for (const it of data.top5Despesas.items) {
    console.log(`    · ${it.name.padEnd(35)} R$ ${it.amount.toFixed(2).padStart(11)} (${it.percent.toFixed(1)}%)`)
  }
  console.log(`  mom: comparable=${data.mom.comparable} motivo=${data.mom.motivo ?? '-'}  txCurrent=${data.mom.txCurrent ?? '-'} txPrevious=${data.mom.txPrevious ?? '-'}`)

  // ───────────────────────────────────────────────
  // SQL direto pra cruzar
  // ───────────────────────────────────────────────
  console.log('\n━━ SQL direto (sanidade) ━━')

  // mês corrente (refDate.UTC month)
  const y = refDate.getUTCFullYear(), m = refDate.getUTCMonth()
  const inicioMes = new Date(Date.UTC(y, m, 1))
  const fimMes = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999))

  // Pendentes — MESMA def do badge / tela
  const pendBadge = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      status: 'PENDING',
      categoryId: null,
      reconciledWithId: null,
      reconciledFrom: { none: {} },
      transferGroupId: null,
      type: { not: 'TRANSFER' },
    },
  })
  console.log(`  pendentes (badge/tela def): ${pendBadge}`)

  // Saldos vs LEDGERBAL
  const ledgers = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  console.log(`  contas com LEDGERBAL: ${ledgers.length}`)
  for (const c of ledgers) {
    const delta = Math.abs(c.balance - (c.ledgerBal ?? 0))
    const flag = delta < 0.01 ? '✅' : '🚨'
    console.log(`    ${flag} ${c.name.padEnd(20)} balance=R$ ${c.balance.toFixed(2).padStart(12)} ledger=R$ ${(c.ledgerBal ?? 0).toFixed(2).padStart(12)} Δ=${delta.toFixed(2)}`)
  }

  // Receita Bruta SQL direto (caixa, paymentDate fallback date)
  const receitaSql = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
      OR: [
        { paymentDate: { gte: inicioMes, lte: fimMes } },
        { paymentDate: null, date: { gte: inicioMes, lte: fimMes } },
      ],
    },
    _sum: { amount: true },
  })
  const receitaSqlVal = receitaSql._sum.amount ?? 0
  console.log(`  Receita Bruta SQL direto: R$ ${receitaSqlVal.toFixed(2)}`)

  // Despesa Operacional SQL direto
  const despesaSql = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      type: 'DEBIT',
      category: { dreGroup: { in: EXPENSE_DRE_GROUPS } },
      OR: [
        { paymentDate: { gte: inicioMes, lte: fimMes } },
        { paymentDate: null, date: { gte: inicioMes, lte: fimMes } },
      ],
    },
    _sum: { amount: true },
    _count: true,
  })
  const despesaSqlVal = despesaSql._sum.amount ?? 0
  console.log(`  Despesa Operacional SQL direto: R$ ${despesaSqlVal.toFixed(2)} (${despesaSql._count} tx)`)

  // ───────────────────────────────────────────────
  // CONFRONTOS
  // ───────────────────────────────────────────────
  console.log('\n' + '━'.repeat(80))
  console.log('CONFRONTOS')
  console.log('━'.repeat(80))

  const checks: Array<{ rotulo: string; ok: boolean; detalhe: string }> = []

  // 1) Pendentes = badge/tela
  checks.push({
    rotulo: 'Pendentes IGUAL entre Motor e Badge/Tela',
    ok: data.pendentes.total === pendBadge,
    detalhe: `Motor=${data.pendentes.total} Badge/Tela=${pendBadge}`,
  })

  // 2) Receita Bruta motor vs SQL
  const dRec = Math.abs(data.receitaBruta - receitaSqlVal)
  checks.push({
    rotulo: 'Receita Bruta motor BATE SQL direto',
    ok: dRec < 0.01,
    detalhe: `Motor=R$ ${data.receitaBruta.toFixed(2)} SQL=R$ ${receitaSqlVal.toFixed(2)} Δ=${dRec.toFixed(2)}`,
  })

  // 3) Despesa Operacional motor vs SQL
  const dDesp = Math.abs(data.despesaOperacional - despesaSqlVal)
  checks.push({
    rotulo: 'Despesa Operacional motor BATE SQL direto',
    ok: dDesp < 0.01,
    detalhe: `Motor=R$ ${data.despesaOperacional.toFixed(2)} SQL=R$ ${despesaSqlVal.toFixed(2)} Δ=${dDesp.toFixed(2)}`,
  })

  // 4) Top5 sem vazamento NON_DRE
  const vazou: string[] = []
  for (const it of data.top5Despesas.items) {
    const cat = await prisma.category.findUnique({ where: { id: it.categoryId } })
    if (cat?.dreGroup && NON_DRE_GROUPS.includes(cat.dreGroup)) {
      vazou.push(`${it.name} (${cat.dreGroup})`)
    }
  }
  checks.push({
    rotulo: 'Top5 SEM vazamento NON_DRE',
    ok: vazou.length === 0,
    detalhe: vazou.length > 0 ? `🚨 vazaram: ${vazou.join(', ')}` : 'limpo',
  })

  // 5) Contabilidade fora ou pequena
  const contabil = data.top5Despesas.items.find((it) => /contabilidade/i.test(it.name))
  checks.push({
    rotulo: 'Contabilidade FORA do Top 5 (ou < R$ 5k = só I.V.S.)',
    ok: !contabil || contabil.amount < 5000,
    detalhe: contabil ? `R$ ${contabil.amount.toFixed(2)}` : 'fora',
  })

  // 6) MoM honesto Cacula maio→junho
  checks.push({
    rotulo: 'MoM honesto retorna comparable=false quando cobertura insuficiente',
    ok: !data.mom.comparable, // aceita 'sem_dados' (db vazio local) OU 'mes_anterior_incompleto' (prod Cacula)
    detalhe: `comparable=${data.mom.comparable} motivo=${data.mom.motivo} ratio=${data.mom.txPrevious}/${data.mom.txCurrent}`,
  })

  // 7) Saldos intactos
  let saldosOk = true
  let totalDelta = 0
  for (const c of ledgers) {
    const d = Math.abs(c.balance - (c.ledgerBal ?? 0))
    totalDelta += d
    if (d > 0.01) saldosOk = false
  }
  checks.push({
    rotulo: 'Saldos batem LEDGERBAL (recategorização não tocou saldo)',
    ok: saldosOk,
    detalhe: `Σ|Δ| = R$ ${totalDelta.toFixed(2)}`,
  })

  console.log('')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '🚨'} ${c.rotulo}`)
    console.log(`      ${c.detalhe}`)
  }

  const allOk = checks.every((c) => c.ok)
  console.log('\n' + '━'.repeat(80))
  console.log(allOk ? '✅ TODOS OS CONFRONTOS PASSARAM' : '🚨 ALGUM CONFRONTO FALHOU')
  console.log('━'.repeat(80))

  await prisma.$disconnect()
  if (!allOk) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
