// Sprint 10 — Smoke real em prod: recategorizar inline + lote via SQL direto
// (simulando o que o endpoint faz) + verifica que motor reflete + cleanup.
// Read-write em prod com cleanup garantido.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'
import { loadExpenseBreakdown } from '../lib/dashboard/expenses-breakdown'
import { getCurrentMTD } from '../lib/dashboard/period-sp'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 10 — Smoke recategorizar inline + lote + cleanup')
  console.log('━'.repeat(80))

  const now = new Date()
  const mtd = getCurrentMTD(now)

  // ─── Categorias source + destino ───
  const aluguel = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Aluguel', isActive: true },
  })
  const compras = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Compras Mercadoria', isActive: true },
  })
  if (!aluguel || !compras) {
    console.error('🚨 Categorias Aluguel/Compras Mercadoria não encontradas. Abort.')
    process.exit(1)
  }
  console.log(`  Aluguel: ${aluguel.id} (${aluguel.dreGroup})`)
  console.log(`  Compras Mercadoria: ${compras.id} (${compras.dreGroup})`)

  // ─── Estado ANTES ───
  console.log('\n━━ Estado ANTES ━━')
  const motorAntes = await loadDashboardData(CACULA, now, 'caixa', mtd)
  const breakAntes = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
  })
  const aluguelAntes = breakAntes.categorias.find((c) => c.categoryId === aluguel.id)
  const comprasAntes = breakAntes.categorias.find((c) => c.categoryId === compras.id)
  console.log(`  Motor.despesaOp: R$ ${motorAntes.despesaOperacional.toFixed(2)}`)
  console.log(`  Aluguel: R$ ${aluguelAntes?.total.toFixed(2)} (${aluguelAntes?.qtdTx} tx)`)
  console.log(`  Compras: R$ ${comprasAntes?.total.toFixed(2)} (${comprasAntes?.qtdTx} tx)`)

  const saldosAntes = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })

  // ─── Pega 3 tx de Aluguel pra testar lote ───
  const aluguelTx = await prisma.transaction.findMany({
    where: {
      categoryId: aluguel.id,
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'DEBIT',
    },
    select: { id: true, amount: true, description: true, categoryId: true, classificationSource: true, classifiedByRuleId: true },
    orderBy: { date: 'desc' },
    take: 3,
  })
  if (aluguelTx.length < 3) {
    console.error('🚨 Menos de 3 tx de Aluguel disponíveis. Abort.')
    process.exit(1)
  }
  const txIdsParaTeste = aluguelTx.map((t) => t.id)
  const txAmounts = aluguelTx.reduce((s, t) => s + t.amount, 0)
  console.log(`\n  3 tx pra teste: total R$ ${txAmounts.toFixed(2)}`)
  for (const t of aluguelTx) {
    console.log(`    · ${t.id.slice(-6)} R$ ${t.amount.toFixed(2)} | ${t.description.substring(0, 50)}`)
  }

  // Snapshot pra undo
  const snapshot = aluguelTx.map((t) => ({
    id: t.id,
    previousCategoryId: t.categoryId,
    previousSource: t.classificationSource,
    previousRuleId: t.classifiedByRuleId,
  }))

  try {
    // ─── FASE 1: INLINE — 1 tx de Aluguel → Compras Mercadoria ───
    console.log('\n━━ INLINE — 1 tx Aluguel → Compras Mercadoria ━━')
    await prisma.transaction.update({
      where: { id: aluguelTx[0].id },
      data: {
        categoryId: compras.id,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
      },
    })

    const breakInline = await loadExpenseBreakdown({
      companyId: CACULA,
      periodStart: mtd.start,
      periodEnd: mtd.end,
      regime: 'caixa',
    })
    const motorInline = await loadDashboardData(CACULA, now, 'caixa', mtd)
    const aluguelInline = breakInline.categorias.find((c) => c.categoryId === aluguel.id)
    const comprasInline = breakInline.categorias.find((c) => c.categoryId === compras.id)
    const deltaAluguel = (aluguelInline?.total ?? 0) - (aluguelAntes?.total ?? 0)
    const deltaCompras = (comprasInline?.total ?? 0) - (comprasAntes?.total ?? 0)
    console.log(`  Aluguel: R$ ${aluguelInline?.total.toFixed(2)} (Δ ${deltaAluguel.toFixed(2)})`)
    console.log(`  Compras: R$ ${comprasInline?.total.toFixed(2)} (Δ +${deltaCompras.toFixed(2)})`)
    console.log(`  Motor.despesaOp: R$ ${motorInline.despesaOperacional.toFixed(2)} (Δ ${(motorInline.despesaOperacional - motorAntes.despesaOperacional).toFixed(2)})`)
    console.log(`  ${Math.abs(deltaAluguel + aluguelTx[0].amount) < 0.01 ? '✅' : '🚨'} Aluguel caiu exatamente ${aluguelTx[0].amount.toFixed(2)}`)
    console.log(`  ${Math.abs(deltaCompras - aluguelTx[0].amount) < 0.01 ? '✅' : '🚨'} Compras subiu exatamente ${aluguelTx[0].amount.toFixed(2)}`)
    console.log(`  ${Math.abs(motorInline.despesaOperacional - motorAntes.despesaOperacional) < 0.01 ? '✅' : '🚨'} Motor.despesaOp NÃO mudou (recategorizar não cria/remove despesa)`)

    // ─── FASE 2: LOTE — 2 tx restantes de Aluguel → Compras Mercadoria ───
    console.log('\n━━ LOTE — 2 tx Aluguel → Compras Mercadoria ━━')
    const idsLote = txIdsParaTeste.slice(1)
    await prisma.transaction.updateMany({
      where: { id: { in: idsLote } },
      data: {
        categoryId: compras.id,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
      },
    })
    const breakLote = await loadExpenseBreakdown({
      companyId: CACULA,
      periodStart: mtd.start,
      periodEnd: mtd.end,
      regime: 'caixa',
    })
    const motorLote = await loadDashboardData(CACULA, now, 'caixa', mtd)
    const aluguelLote = breakLote.categorias.find((c) => c.categoryId === aluguel.id)
    const comprasLote = breakLote.categorias.find((c) => c.categoryId === compras.id)
    console.log(`  Aluguel: R$ ${aluguelLote?.total.toFixed(2)} (Δ ${((aluguelLote?.total ?? 0) - (aluguelAntes?.total ?? 0)).toFixed(2)} total)`)
    console.log(`  Compras: R$ ${comprasLote?.total.toFixed(2)} (Δ +${((comprasLote?.total ?? 0) - (comprasAntes?.total ?? 0)).toFixed(2)} total)`)
    console.log(`  Motor.despesaOp: R$ ${motorLote.despesaOperacional.toFixed(2)}`)
    console.log(`  ${Math.abs(motorLote.despesaOperacional - motorAntes.despesaOperacional) < 0.01 ? '✅' : '🚨'} Motor.despesaOp STILL = R$ ${motorAntes.despesaOperacional.toFixed(2)} (sem cair nada)`)
    console.log(`  ${Math.abs((aluguelLote?.total ?? 0) - ((aluguelAntes?.total ?? 0) - txAmounts)) < 0.01 ? '✅' : '🚨'} Aluguel caiu exatos R$ ${txAmounts.toFixed(2)}`)
    console.log(`  ${Math.abs((comprasLote?.total ?? 0) - ((comprasAntes?.total ?? 0) + txAmounts)) < 0.01 ? '✅' : '🚨'} Compras subiu exatos R$ ${txAmounts.toFixed(2)}`)

  } finally {
    // ─── CLEANUP: reverter ao estado original ───
    console.log('\n━━ CLEANUP ━━')
    for (const s of snapshot) {
      await prisma.transaction.update({
        where: { id: s.id },
        data: {
          categoryId: s.previousCategoryId,
          classificationSource: s.previousSource,
          classifiedByRuleId: s.previousRuleId,
        },
      })
    }
    console.log(`  ✅ Revertido ${snapshot.length} tx`)
  }

  // ─── Validação final ───
  console.log('\n━━ Validação final ━━')
  const motorFim = await loadDashboardData(CACULA, now, 'caixa', mtd)
  const breakFim = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
  })
  const aluguelFim = breakFim.categorias.find((c) => c.categoryId === aluguel.id)
  const comprasFim = breakFim.categorias.find((c) => c.categoryId === compras.id)

  console.log(`  Motor.despesaOp: R$ ${motorFim.despesaOperacional.toFixed(2)} (antes R$ ${motorAntes.despesaOperacional.toFixed(2)}) ${Math.abs(motorFim.despesaOperacional - motorAntes.despesaOperacional) < 0.01 ? '✅' : '🚨'}`)
  console.log(`  Aluguel: R$ ${aluguelFim?.total.toFixed(2)} (antes R$ ${aluguelAntes?.total.toFixed(2)}) ${Math.abs((aluguelFim?.total ?? 0) - (aluguelAntes?.total ?? 0)) < 0.01 ? '✅' : '🚨'}`)
  console.log(`  Compras: R$ ${comprasFim?.total.toFixed(2)} (antes R$ ${comprasAntes?.total.toFixed(2)}) ${Math.abs((comprasFim?.total ?? 0) - (comprasAntes?.total ?? 0)) < 0.01 ? '✅' : '🚨'}`)

  const saldosFim = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  let saldosOk = true
  for (const s of saldosFim) {
    if (Math.abs(s.balance - (s.ledgerBal ?? 0)) > 0.01) saldosOk = false
    const antes = saldosAntes.find((a) => a.name === s.name)
    if (antes && Math.abs(s.balance - antes.balance) > 0.01) saldosOk = false
  }
  console.log(`  ${saldosOk ? '✅' : '🚨'} Saldos LEDGERBAL Δ=0 e iguais ao inicial`)

  // Confronto motor = breakdown ao centavo
  const delta = Math.abs(motorFim.despesaOperacional - breakFim.totalGeral)
  console.log(`  ${delta < 0.01 ? '✅' : '🚨'} Motor.despesaOp = breakdown.totalGeral (Δ R$ ${delta.toFixed(2)})`)

  // Regras: 0 = 0 (recategorizar nunca cria regra)
  const regrasFim = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  console.log(`  ${regrasFim === 0 ? '✅' : '🚨'} Nenhuma regra criada (Cacula = ${regrasFim} regras)`)

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error(e); process.exit(1) })
