// Sprint 11 — Smoke: aplica recategorização real, valida que motor
// continua batendo com /despesas ao centavo, saldos intactos, depois
// faz cleanup. NÃO testa scroll (DOM) — isso é responsabilidade da UI;
// aqui só garantimos que os números batem.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'
import { loadExpenseBreakdown } from '../lib/dashboard/expenses-breakdown'
import { getCurrentMTD } from '../lib/dashboard/period-sp'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 11 — Smoke pós-otimista: motor x breakdown x saldos')
  console.log('━'.repeat(80))

  const now = new Date()
  const mtd = getCurrentMTD(now)

  // ─── Estado ANTES ───
  console.log('\n━━ Estado ANTES ━━')
  const motorAntes = await loadDashboardData(CACULA, now, 'caixa', mtd)
  const breakAntes = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
  })
  console.log(`  Motor.despesaOp: R$ ${motorAntes.despesaOperacional.toFixed(2)}`)
  console.log(`  Breakdown.totalGeral: R$ ${breakAntes.totalGeral.toFixed(2)}`)
  console.log(`  Δ motor vs breakdown: R$ ${Math.abs(motorAntes.despesaOperacional - breakAntes.totalGeral).toFixed(2)} ${Math.abs(motorAntes.despesaOperacional - breakAntes.totalGeral) < 0.01 ? '✅' : '🚨'}`)

  const aluguel = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Aluguel', isActive: true },
  })
  const compras = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Compras Mercadoria', isActive: true },
  })
  if (!aluguel || !compras) {
    console.error('🚨 Categorias não encontradas')
    process.exit(1)
  }

  const aluguelTx = await prisma.transaction.findMany({
    where: {
      categoryId: aluguel.id,
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'DEBIT',
    },
    select: { id: true, amount: true, description: true, categoryId: true, classificationSource: true, classifiedByRuleId: true },
    orderBy: { date: 'desc' },
    take: 2,
  })

  const snapshot = aluguelTx.map((t) => ({
    id: t.id,
    previousCategoryId: t.categoryId,
    previousSource: t.classificationSource,
    previousRuleId: t.classifiedByRuleId,
  }))

  const movedAmount = aluguelTx.reduce((s, t) => s + t.amount, 0)
  console.log(`\n━━ Movendo 2 tx (R$ ${movedAmount.toFixed(2)}) Aluguel → Compras ━━`)

  try {
    await prisma.transaction.updateMany({
      where: { id: { in: aluguelTx.map((t) => t.id) } },
      data: {
        categoryId: compras.id,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
      },
    })

    // Confirma motor + breakdown ainda batem
    const motorMid = await loadDashboardData(CACULA, now, 'caixa', mtd)
    const breakMid = await loadExpenseBreakdown({
      companyId: CACULA,
      periodStart: mtd.start,
      periodEnd: mtd.end,
      regime: 'caixa',
    })
    const aluguelMid = breakMid.categorias.find((c) => c.categoryId === aluguel.id)
    const comprasMid = breakMid.categorias.find((c) => c.categoryId === compras.id)
    const aluguelAntesItem = breakAntes.categorias.find((c) => c.categoryId === aluguel.id)
    const comprasAntesItem = breakAntes.categorias.find((c) => c.categoryId === compras.id)

    console.log(`\n  Motor.despesaOp DEPOIS: R$ ${motorMid.despesaOperacional.toFixed(2)}`)
    console.log(`  Aluguel: R$ ${aluguelMid?.total.toFixed(2)} (antes R$ ${aluguelAntesItem?.total.toFixed(2)})`)
    console.log(`  Compras: R$ ${comprasMid?.total.toFixed(2)} (antes R$ ${comprasAntesItem?.total.toFixed(2)})`)

    const deltaMotor = Math.abs(motorMid.despesaOperacional - motorAntes.despesaOperacional)
    const deltaAluguel = (aluguelAntesItem?.total ?? 0) - (aluguelMid?.total ?? 0)
    const deltaCompras = (comprasMid?.total ?? 0) - (comprasAntesItem?.total ?? 0)
    const delta_motor_break = Math.abs(motorMid.despesaOperacional - breakMid.totalGeral)

    console.log(`\n  ${deltaMotor < 0.01 ? '✅' : '🚨'} motor.despesaOp INALTERADO (recategorizar não cria/remove dinheiro)`)
    console.log(`  ${Math.abs(deltaAluguel - movedAmount) < 0.01 ? '✅' : '🚨'} Aluguel caiu R$ ${deltaAluguel.toFixed(2)} (esperado ${movedAmount.toFixed(2)})`)
    console.log(`  ${Math.abs(deltaCompras - movedAmount) < 0.01 ? '✅' : '🚨'} Compras subiu R$ ${deltaCompras.toFixed(2)} (esperado ${movedAmount.toFixed(2)})`)
    console.log(`  ${delta_motor_break < 0.01 ? '✅' : '🚨'} motor.despesaOp = breakdown.totalGeral (Δ R$ ${delta_motor_break.toFixed(2)})`)
  } finally {
    // ─── CLEANUP ───
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
  console.log(`  Motor.despesaOp: R$ ${motorFim.despesaOperacional.toFixed(2)} = ANTES? ${Math.abs(motorFim.despesaOperacional - motorAntes.despesaOperacional) < 0.01 ? '✅' : '🚨'}`)
  console.log(`  Breakdown.totalGeral: R$ ${breakFim.totalGeral.toFixed(2)} = ANTES? ${Math.abs(breakFim.totalGeral - breakAntes.totalGeral) < 0.01 ? '✅' : '🚨'}`)

  const ledgers = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  const saldosOk = ledgers.every((c) => Math.abs(c.balance - (c.ledgerBal ?? 0)) < 0.01)
  console.log(`  ${saldosOk ? '✅' : '🚨'} Saldos LEDGERBAL Δ=0`)

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error(e); process.exit(1) })
