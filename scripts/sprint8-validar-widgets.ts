// Sprint 8 — Validação dos 3 widgets: fluxo de caixa 6m, fornecedores, receita por forma
// Read-only. Roda em prod CAIXAOS.

import { PrismaClient } from '@prisma/client'
import { loadDashboardData } from '../lib/dashboard/engine'
import {
  loadCashflowMensal,
  loadTopFornecedores,
  loadReceitaPorForma,
} from '../lib/dashboard/widgets'
import { getCurrentMTD } from '../lib/dashboard/period-sp'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 8 — Validação dos 3 widgets')
  console.log('━'.repeat(80))

  const now = new Date()
  const mtd = getCurrentMTD(now)

  // ───── Motor (referencia) ─────
  const data = await loadDashboardData(CACULA, now, 'caixa', mtd)
  console.log(`\n  Motor: receitaBruta=R$ ${data.receitaBruta.toFixed(2)}, despesaOp=R$ ${data.despesaOperacional.toFixed(2)}, resultado=R$ ${data.lucroLiquido.toFixed(2)}`)

  // ───── 1. Fluxo Caixa Mensal ─────
  console.log(`\n━━ Widget 1: Fluxo de Caixa Mensal (6 meses) ━━`)
  const cf = await loadCashflowMensal(CACULA, now, 'caixa', 6)
  for (const m of cf.meses) {
    console.log(`  ${m.mesLabel} | entrou R$ ${m.entrou.toFixed(2).padStart(11)} | saiu R$ ${m.saiu.toFixed(2).padStart(11)} | result R$ ${m.resultado.toFixed(2).padStart(11)} | qtd ${String(m.qtdTx).padStart(4)} | cobertura ${m.cobertura}${m.isMTD ? ' (MTD)' : ''}`)
  }
  const mesAtual = cf.meses[cf.meses.length - 1]
  const dResMes = Math.abs(mesAtual.resultado - data.lucroLiquido)
  console.log(`\n  Junho (mes atual no fluxo): entrou-saiu = R$ ${mesAtual.resultado.toFixed(2)} vs motor.lucroLiquido R$ ${data.lucroLiquido.toFixed(2)} → Δ R$ ${dResMes.toFixed(2)} ${dResMes < 0.01 ? '✅' : '🚨'}`)

  // ───── 2. Maiores Fornecedores ─────
  console.log(`\n━━ Widget 2: Top 5 Fornecedores (DEBIT non-NON_DRE no periodo) ━━`)
  const fornec = await loadTopFornecedores({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
    limit: 5,
  })
  for (const f of fornec.fornecedores) {
    console.log(`  ${f.razaoSocial.substring(0, 45).padEnd(46)} R$ ${f.total.toFixed(2).padStart(11)} (${f.pct.toFixed(1)}% do total despesas) [${f.qtdTx} tx]`)
  }
  console.log(`  Total top 5 (com supplier): R$ ${fornec.totalGeral.toFixed(2)} de R$ ${fornec.totalDespesas.toFixed(2)} despesa total`)
  const sumPctOk = fornec.totalDespesas > 0
  console.log(`  totalDespesas widget = motor.despesaOperacional? ${Math.abs(fornec.totalDespesas - data.despesaOperacional) < 0.01 ? '✅' : '🚨 Δ ' + Math.abs(fornec.totalDespesas - data.despesaOperacional).toFixed(2)}`)

  // ───── 3. Receita por Forma ─────
  console.log(`\n━━ Widget 3: Receita por Forma ━━`)
  const rec = await loadReceitaPorForma({
    companyId: CACULA,
    periodStart: mtd.start,
    periodEnd: mtd.end,
    regime: 'caixa',
  })
  for (const f of rec.formas) {
    console.log(`  ${f.label.padEnd(20)} R$ ${f.total.toFixed(2).padStart(11)} (${f.pct.toFixed(1)}%) [${f.qtdTx} tx]`)
  }
  const somaFormas = rec.formas.reduce((s, f) => s + f.total, 0)
  console.log(`\n  Soma formas: R$ ${somaFormas.toFixed(2)} | totalReceita widget: R$ ${rec.totalReceita.toFixed(2)} | motor.receitaBruta: R$ ${data.receitaBruta.toFixed(2)}`)
  const dReceita = Math.abs(somaFormas - data.receitaBruta)
  console.log(`  Δ Soma formas vs Motor.receitaBruta: R$ ${dReceita.toFixed(2)} ${dReceita < 0.01 ? '✅' : '🚨'}`)
  const somaPct = rec.formas.reduce((s, f) => s + f.pct, 0)
  console.log(`  Soma %s: ${somaPct.toFixed(2)}% ${Math.abs(somaPct - 100) < 0.05 ? '✅' : '🚨'}`)

  // ───── Confronts finais ─────
  console.log(`\n${'━'.repeat(80)}`)
  console.log('CONFRONTOS FINAIS')
  console.log('━'.repeat(80))

  const checks: Array<{ rotulo: string; ok: boolean; detalhe: string }> = []

  checks.push({
    rotulo: 'fluxoCaixa[mes corrente].resultado = motor.lucroLiquido',
    ok: dResMes < 0.01,
    detalhe: `Δ R$ ${dResMes.toFixed(2)}`,
  })

  checks.push({
    rotulo: 'maioresFornecedores.totalDespesas = motor.despesaOperacional (varredura)',
    ok: Math.abs(fornec.totalDespesas - data.despesaOperacional) < 0.01,
    detalhe: `widget R$ ${fornec.totalDespesas.toFixed(2)} vs motor R$ ${data.despesaOperacional.toFixed(2)}`,
  })

  checks.push({
    rotulo: 'receitaPorForma soma = motor.receitaBruta',
    ok: dReceita < 0.01,
    detalhe: `soma R$ ${somaFormas.toFixed(2)} vs motor R$ ${data.receitaBruta.toFixed(2)}`,
  })

  checks.push({
    rotulo: 'receitaPorForma: soma %s = ~100%',
    ok: Math.abs(somaPct - 100) < 0.05,
    detalhe: `${somaPct.toFixed(2)}%`,
  })

  checks.push({
    rotulo: 'fluxoCaixa marca MTD como parcial',
    ok: mesAtual.isMTD && mesAtual.cobertura === 'parcial',
    detalhe: `isMTD=${mesAtual.isMTD} cobertura=${mesAtual.cobertura}`,
  })

  // Saldos
  let saldosOk = true
  const ledgers = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  for (const c of ledgers) {
    if (Math.abs(c.balance - (c.ledgerBal ?? 0)) > 0.01) saldosOk = false
  }
  checks.push({
    rotulo: 'Saldos LEDGERBAL Δ=0 (read-only OK)',
    ok: saldosOk,
    detalhe: `${ledgers.length} contas com ledger`,
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
