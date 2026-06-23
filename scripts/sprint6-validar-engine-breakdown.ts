// Sprint 6 — Sanity: getExpenseBreakdown bate com motor único?
// Roda em prod. Read-only.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'
import { loadExpenseBreakdown } from '../lib/dashboard/expenses-breakdown'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 6 — Validação: getExpenseBreakdown vs motor único')
  console.log('━'.repeat(80))

  const refDate = new Date()
  const y = refDate.getUTCFullYear()
  const m = refDate.getUTCMonth()
  const inicio = new Date(Date.UTC(y, m, 1))
  const fim = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999))

  // 1) Motor único
  const motor = await loadDashboardData(CACULA, refDate, 'caixa')
  console.log(`\n  Motor.despesaOperacional: R$ ${motor.despesaOperacional.toFixed(2)}`)

  // 2) Breakdown
  const breakdown = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: inicio,
    periodEnd: fim,
    regime: 'caixa',
  })
  console.log(`  Breakdown.totalGeral:     R$ ${breakdown.totalGeral.toFixed(2)}`)
  console.log(`  Breakdown.totalCategorias: ${breakdown.totalCategorias}`)
  console.log(`  Breakdown.totalTx:        ${breakdown.totalTx}`)

  // 3) Confronto
  const delta = Math.abs(motor.despesaOperacional - breakdown.totalGeral)
  console.log(`\n  Δ Motor vs Breakdown: R$ ${delta.toFixed(2)} ${delta < 0.01 ? '✅' : '🚨'}`)

  // 4) Top 5 do motor bate com top 5 do breakdown
  console.log(`\n━━ Top 5 do motor vs Top 5 do breakdown ━━`)
  for (let i = 0; i < 5; i++) {
    const motorItem = motor.top5Despesas.items[i]
    const breakItem = breakdown.categorias[i]
    if (!motorItem || !breakItem) break
    const ok = motorItem.categoryId === breakItem.categoryId && Math.abs(motorItem.amount - breakItem.total) < 0.01
    console.log(`  ${ok ? '✅' : '🚨'} #${i + 1} motor=${motorItem.name.padEnd(35)} R$ ${motorItem.amount.toFixed(2).padStart(10)} | breakdown=${breakItem.name.padEnd(35)} R$ ${breakItem.total.toFixed(2).padStart(10)}`)
  }

  // 5) Resumo
  console.log(`\n━━ Resumo do breakdown (todas as categorias de despesa) ━━`)
  for (const c of breakdown.categorias) {
    console.log(`  ${c.name.padEnd(40)} ${c.dreGroup.padEnd(28)} R$ ${c.total.toFixed(2).padStart(11)} (${c.pctDoTotal.toFixed(1)}%) [${c.qtdTx} tx]`)
  }

  console.log(`\n━━ Total: ${breakdown.totalCategorias} categorias, ${breakdown.totalTx} tx, R$ ${breakdown.totalGeral.toFixed(2)} ━━`)

  // 6) NON_DRE não aparecem (varredura defensiva)
  const NON_DRE = ['TRANSFERENCIA', 'DISTRIBUICAO_LUCROS', 'INVESTIMENTOS', 'AJUSTE_SALDO']
  const vazou = breakdown.categorias.find((c) => NON_DRE.includes(c.dreGroup))
  console.log(`\n  ${vazou ? '🚨' : '✅'} NON_DRE FORA do breakdown: ${vazou ? `vazou ${vazou.name}` : 'limpo'}`)

  // 7) Soma % = 100%
  const somaPct = breakdown.categorias.reduce((s, c) => s + c.pctDoTotal, 0)
  console.log(`  ${Math.abs(somaPct - 100) < 0.05 ? '✅' : '🚨'} Soma %s das categorias: ${somaPct.toFixed(2)}%`)

  // 8) Regime competência — deve ser ≠ caixa quando tem competenceDate ≠ paymentDate
  const breakCompet = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: inicio,
    periodEnd: fim,
    regime: 'competencia',
  })
  console.log(`\n  Breakdown competencia totalGeral: R$ ${breakCompet.totalGeral.toFixed(2)}  (caixa = R$ ${breakdown.totalGeral.toFixed(2)})`)

  // 9) Saldos LEDGERBAL intactos (read-only)
  const ledgers = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  let saldosOk = true
  for (const c of ledgers) {
    const delta = Math.abs(c.balance - (c.ledgerBal ?? 0))
    if (delta > 0.01) saldosOk = false
  }
  console.log(`  ${saldosOk ? '✅' : '🚨'} Saldos LEDGERBAL Δ=0: ${ledgers.map((c) => `${c.name}=${(c.balance - (c.ledgerBal ?? 0)).toFixed(2)}`).join(' | ')}`)

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
