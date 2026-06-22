// Sprint 3 FASE 3 — validação pós-recategorização
// Compara antes/depois em DRE + Top 5 + saldos

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('SPRINT 3 FASE 3 — Validação pós-recategorização')
  console.log('━'.repeat(80))

  const inicioMes = new Date('2026-06-01T00:00:00Z')
  const fimMes = new Date('2026-06-30T23:59:59.999Z')

  // ───────────────────────────────────────────────────────
  // 1) Confirmar status dos 3 alvos
  // ───────────────────────────────────────────────────────
  console.log('\n━━ 1) Status atual dos 3 alvos ━━')
  for (const fitid of ['22501610389', '22501591568', '22506240460']) {
    const t = await prisma.transaction.findFirst({
      where: { externalId: fitid, bankAccount: { companyId: CACULA } },
      select: {
        id: true, amount: true, date: true,
        classificationSource: true, classifiedByRuleId: true, aiConfidence: true,
        category: { select: { name: true, dreGroup: true } },
      },
    })
    if (!t) { console.log(`  🚨 ${fitid} NÃO encontrada`); continue }
    const ok = t.category?.dreGroup === 'DISTRIBUICAO_LUCROS'
    console.log(`  ${ok ? '✅' : '🚨'} FITID ${fitid} R$ ${t.amount} → ${t.category?.name} (${t.category?.dreGroup}) src=${t.classificationSource} rule=${t.classifiedByRuleId ?? 'null'}`)
  }

  // ───────────────────────────────────────────────────────
  // 2) Top 5 Despesas junho — ver Contabilidade caindo
  // ───────────────────────────────────────────────────────
  console.log('\n━━ 2) Top 5 Despesas junho (mês corrente) ━━')

  const topByCat = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      bankAccount: { companyId: CACULA },
      type: { not: 'TRANSFER' },
      categoryId: { not: null },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
    take: 20,
  })
  const catIds = topByCat.map((g) => g.categoryId!).filter(Boolean)
  const cats = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true, dreGroup: true },
  })
  const catById = new Map(cats.map((c) => [c.id, c]))
  const EXPENSE_DRE_GROUPS = ['CUSTO_PRODUTO_VENDIDO','DESPESAS_OPERACIONAIS','DESPESAS_ADMINISTRATIVAS','DESPESAS_COMERCIAIS','DESPESAS_FINANCEIRAS','OUTRAS_DESPESAS','IMPOSTOS']
  const top5 = topByCat
    .filter((g) => EXPENSE_DRE_GROUPS.includes(catById.get(g.categoryId!)?.dreGroup ?? ''))
    .slice(0, 5)

  console.log(`  | # | Categoria | dreGroup | Qtd | Valor |`)
  for (const [i, g] of top5.entries()) {
    const c = catById.get(g.categoryId!)!
    console.log(`  | ${i+1} | ${c.name.padEnd(35)} | ${(c.dreGroup ?? '-').padEnd(28)} | ${String(g._count).padStart(4)} | R$ ${(g._sum.amount ?? 0).toFixed(2).padStart(11)} |`)
  }
  // Contabilidade — explicitamente
  const contabilCat = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Contabilidade', isActive: true },
    select: { id: true },
  })
  if (contabilCat) {
    const cont = await prisma.transaction.aggregate({
      where: {
        bankAccount: { companyId: CACULA },
        categoryId: contabilCat.id,
        date: { gte: inicioMes, lte: fimMes },
        type: { not: 'TRANSFER' },
      },
      _sum: { amount: true }, _count: true,
    })
    console.log(`\n  Total "Contabilidade" junho: ${cont._count} tx · R$ ${(cont._sum.amount ?? 0).toFixed(2)}`)
    console.log(`    ANTES (sprint 2 do diagnóstico): 4 tx · R$ 40.621,00`)
    console.log(`    DEPOIS esperado:                  1 tx · R$  1.621,00 (I.V.S. LTDA — único pagamento contábil real)`)
  }

  // Distribuição de Lucros junho
  const distrCat = await prisma.category.findFirst({
    where: { companyId: CACULA, dreGroup: 'DISTRIBUICAO_LUCROS', name: 'Distribuição de Lucros', isActive: true },
    select: { id: true },
  })
  if (distrCat) {
    const distr = await prisma.transaction.aggregate({
      where: {
        bankAccount: { companyId: CACULA },
        categoryId: distrCat.id,
        date: { gte: inicioMes, lte: fimMes },
      },
      _sum: { amount: true }, _count: true,
    })
    console.log(`\n  Total "Distribuição de Lucros" junho: ${distr._count} tx · R$ ${(distr._sum.amount ?? 0).toFixed(2)}`)
    console.log(`    ANTES: 2 tx (08/06 R$ 200 + 08/06 R$ 4.000) = R$ 4.200`)
    console.log(`    DEPOIS esperado: 5 tx = R$ 4.200 + R$ 39.000 = R$ 43.200`)
  }

  // ───────────────────────────────────────────────────────
  // 3) DRE Receita + Despesa Operacional
  // ───────────────────────────────────────────────────────
  console.log('\n━━ 3) DRE junho ━━')

  // Receita bruta
  const receita = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
  })
  console.log(`  Receita Bruta: R$ ${(receita._sum.amount ?? 0).toFixed(2)}`)

  // Despesa operacional total (todos EXPENSE_DRE_GROUPS)
  const despesaOp = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'DEBIT',
      category: { dreGroup: { in: EXPENSE_DRE_GROUPS } },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`  Despesa Operacional Total: R$ ${(despesaOp._sum.amount ?? 0).toFixed(2)} (${despesaOp._count} tx)`)
  console.log(`    ANTES (com Contabilidade R$ 40.621): incluía os R$ 39.000 PIX YUSSEF`)
  console.log(`    DEPOIS esperado: caiu R$ 39.000 (foram pra DISTRIBUICAO_LUCROS non-DRE)`)

  // ───────────────────────────────────────────────────────
  // 4) Saldos vs LEDGERBAL
  // ───────────────────────────────────────────────────────
  console.log('\n━━ 4) Saldos vs LEDGERBAL ━━')
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true },
    select: { name: true, balance: true, ledgerBal: true, ledgerBalDate: true, accountType: true },
  })
  for (const c of contas) {
    const ledger = c.ledgerBal ?? null
    const delta = ledger !== null ? Math.abs(c.balance - ledger) : null
    const flag = delta !== null && delta < 0.01 ? '✅' : delta !== null ? '🚨' : '(cash, sem ledgerBal)'
    console.log(`  ${flag} ${c.name.padEnd(20)} balance=R$ ${c.balance.toFixed(2).padStart(12)} ledgerBal=${ledger?.toFixed(2) ?? 'null'} Δ=${delta?.toFixed(2) ?? '-'}`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — read-only.')
}
main().catch((e) => { console.error(e); process.exit(1) })
