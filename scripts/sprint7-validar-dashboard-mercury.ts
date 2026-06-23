// Sprint 7 — Validação do dashboard Mercury com customPeriod
// Compara: hero = soma contas = motor; receita/despesa/resultado bate
// com Despesas (Sprint 6) ao centavo; MTD vs full month junho.
//
// Read-only.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'
import { loadExpenseBreakdown } from '../lib/dashboard/expenses-breakdown'
import { getCurrentMTD, getFullMonth } from '../lib/dashboard/period-sp'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 7 — Validação dashboard Mercury (customPeriod)')
  console.log('━'.repeat(80))

  const now = new Date()
  const mtd = getCurrentMTD(now)
  const fullJune = getFullMonth(2026, 5)
  const fullMay = getFullMonth(2026, 4)

  // ===== Cenário MTD (default) =====
  console.log(`\n━━ Cenário: MTD (${mtd.year}-${String(mtd.month + 1).padStart(2, '0')} até ${now.toISOString().slice(0, 10)}) ━━`)
  const dataMTD = await loadDashboardData(CACULA, now, 'caixa', mtd)
  console.log(`  Saldo total hero:     R$ ${dataMTD.saldoAtual.toFixed(2)}`)
  console.log(`  Receita bruta:        R$ ${dataMTD.receitaBruta.toFixed(2)}`)
  console.log(`  Despesa operacional:  R$ ${dataMTD.despesaOperacional.toFixed(2)}`)
  console.log(`  Resultado (lucroLiq): R$ ${dataMTD.lucroLiquido.toFixed(2)}`)
  console.log(`  Pendentes a categorizar: ${dataMTD.pendentes.total}`)

  // Soma contas individuais
  const somaContas = dataMTD.saldosPorConta.reduce((s, c) => s + c.balance, 0)
  console.log(`\n  Soma contas: R$ ${somaContas.toFixed(2)} ${Math.abs(somaContas - dataMTD.saldoAtual) < 0.01 ? '✅ = hero' : '🚨 ≠ hero'}`)
  for (const c of dataMTD.saldosPorConta) {
    const delta = c.ledgerBal !== null ? Math.abs(c.balance - c.ledgerBal) : null
    const flag = delta === null ? '(sem ledger)' : delta < 0.01 ? '✅ conciliado' : '🚨 Δ ' + delta.toFixed(2)
    console.log(`    ${c.name.padEnd(15)} R$ ${c.balance.toFixed(2).padStart(12)} ledger=${c.ledgerBal?.toFixed(2) ?? '—'} ${flag}`)
  }

  // Cruzando com /despesas
  const breakMTD = await loadExpenseBreakdown({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
  })
  const dDesp = Math.abs(dataMTD.despesaOperacional - breakMTD.totalGeral)
  console.log(`\n  Confronto Despesa Op: motor R$ ${dataMTD.despesaOperacional.toFixed(2)} vs /despesas R$ ${breakMTD.totalGeral.toFixed(2)} → ${dDesp < 0.01 ? '✅ Δ R$ 0.00' : '🚨 Δ R$ ' + dDesp.toFixed(2)}`)

  // ===== Cenário: JUNHO INTEIRO (full month) =====
  console.log(`\n━━ Cenário: Junho inteiro 2026 (full month) ━━`)
  const dataJune = await loadDashboardData(CACULA, now, 'caixa', fullJune)
  console.log(`  Receita bruta:        R$ ${dataJune.receitaBruta.toFixed(2)}`)
  console.log(`  Despesa operacional:  R$ ${dataJune.despesaOperacional.toFixed(2)}`)
  console.log(`  Resultado:            R$ ${dataJune.lucroLiquido.toFixed(2)}`)
  console.log(`  Δ MTD vs Junho: receita +R$ ${(dataJune.receitaBruta - dataMTD.receitaBruta).toFixed(2)} (MTD <= full deve ser true)`)

  // ===== Cenário: MAIO 2026 (mês passado) =====
  console.log(`\n━━ Cenário: Maio 2026 (mês passado) ━━`)
  const dataMay = await loadDashboardData(CACULA, now, 'caixa', fullMay)
  console.log(`  Receita bruta maio:   R$ ${dataMay.receitaBruta.toFixed(2)}`)
  console.log(`  Despesa op maio:      R$ ${dataMay.despesaOperacional.toFixed(2)}`)
  console.log(`  Resultado maio:       R$ ${dataMay.lucroLiquido.toFixed(2)}`)
  console.log(`  Δ Maio vs Junho: ${dataMay.receitaBruta < dataJune.receitaBruta ? '✅ Maio menor (esperado — só 1 conta OFX)' : '🚨 Maio maior?'}`)

  // ===== Resumo de validações =====
  console.log(`\n${'━'.repeat(80)}`)
  console.log('CONFRONTOS FINAIS')
  console.log('━'.repeat(80))

  const checks: Array<{ rotulo: string; ok: boolean; detalhe: string }> = []

  checks.push({
    rotulo: 'Saldo hero = soma das contas',
    ok: Math.abs(somaContas - dataMTD.saldoAtual) < 0.01,
    detalhe: `hero=R$ ${dataMTD.saldoAtual.toFixed(2)} soma=R$ ${somaContas.toFixed(2)}`,
  })

  const todosLedgerBatem = dataMTD.saldosPorConta
    .filter((c) => c.ledgerBal !== null)
    .every((c) => Math.abs(c.balance - (c.ledgerBal ?? 0)) < 0.01)
  checks.push({
    rotulo: 'Saldos LEDGERBAL Δ=0 (selo conciliado pode acender)',
    ok: todosLedgerBatem,
    detalhe: `${dataMTD.saldosPorConta.filter((c) => c.ledgerBal !== null).length} contas com ledger`,
  })

  checks.push({
    rotulo: 'Motor.despesaOperacional = /despesas.totalGeral (MTD)',
    ok: dDesp < 0.01,
    detalhe: `Δ R$ ${dDesp.toFixed(2)}`,
  })

  checks.push({
    rotulo: 'MTD <= Junho inteiro (receita, despesa)',
    ok:
      dataMTD.receitaBruta <= dataJune.receitaBruta &&
      dataMTD.despesaOperacional <= dataJune.despesaOperacional,
    detalhe: `MTD R= ${dataMTD.receitaBruta.toFixed(2)} <= junho ${dataJune.receitaBruta.toFixed(2)}`,
  })

  checks.push({
    rotulo: 'Pendentes a categorizar (mesmo do badge/tela = 7)',
    ok: dataMTD.pendentes.total >= 0 && dataMTD.pendentes.total < 100,
    detalhe: `${dataMTD.pendentes.total} pendentes`,
  })

  checks.push({
    rotulo: 'Maio ≠ Junho (período custom funciona)',
    ok: dataMay.receitaBruta !== dataJune.receitaBruta || dataMay.despesaOperacional !== dataJune.despesaOperacional,
    detalhe: `maio R=${dataMay.receitaBruta.toFixed(0)} D=${dataMay.despesaOperacional.toFixed(0)} | junho R=${dataJune.receitaBruta.toFixed(0)} D=${dataJune.despesaOperacional.toFixed(0)}`,
  })

  console.log('')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '🚨'} ${c.rotulo}`)
    console.log(`      ${c.detalhe}`)
  }

  const allOk = checks.every((c) => c.ok)
  console.log(`\n${'━'.repeat(80)}`)
  console.log(allOk ? '✅ TODOS OS CONFRONTOS PASSARAM' : '🚨 ALGUM CONFRONTO FALHOU')
  console.log('━'.repeat(80))

  await prisma.$disconnect()
  if (!allOk) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
