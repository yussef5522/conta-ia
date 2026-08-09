// CORREÇÃO 1 (08/08) — dívida Arafat: registrar valor original 380.000 + reconhecer
// as 2 devoluções (40.000 06/07 + 50.000 04/08), saldo continua 290.000. Reclassifica
// a tx 40.000 de Distribuição de Lucros → Amortização de Mútuo (terceiros). Transação
// com guardas; ABORTA se saldo != 290.000. NÃO muda valor/data de tx.
// Uso: DATABASE_URL=<prod> npx tsx scripts/correcao-arafat.ts

import { PrismaClient } from '@prisma/client'
import { saldoDevedorAtual } from '../lib/loans/saldo'
const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const CAT_MUTUO = 'cmshqt1gb0001cz0efib2edgf' // Amortização de Mútuo (terceiros), TRANSFERENCIA
const NOTES = 'mútuo de R$ 380.000 com a Arafat (arafet thalji), sem juros, iniciado em mai/2026. Devolvidos 40.000 (06/07) e 50.000 (04/08). Saldo 290.000. Entrada original não registrada por decisão do usuário.'

async function distribuidoLucros() {
  const rows = await prisma.transaction.findMany({
    where: { bankAccount: { companyId: CO }, category: { dreGroup: 'DISTRIBUICAO_LUCROS' }, type: 'DEBIT', lifecycle: 'EFFECTED' },
    select: { amount: true },
  })
  return Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100
}
async function orfasValor() {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: number; v: number }>>(
    `SELECT count(*)::int n, COALESCE(SUM(t.amount),0)::float v FROM transactions t
     JOIN bank_accounts ba ON ba.id=t."bankAccountId" JOIN categories c ON c.id=t."categoryId"
     WHERE ba."companyId"=$1 AND c."dreGroup"='DISTRIBUICAO_LUCROS' AND t.type='DEBIT' AND t.lifecycle='EFFECTED'
       AND NOT EXISTS (SELECT 1 FROM pj_to_pf_bridges b WHERE b."pjTransactionId"=t.id)`, CO)
  return rows[0]
}

async function main() {
  const distAntes = await distribuidoLucros()
  const orfAntes = await orfasValor()
  const contasAntes = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  const pontesAntes = await prisma.pJtoPFBridge.count()

  await prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirstOrThrow({ where: { companyId: CO, lender: { contains: 'rafat' } }, select: { id: true, principal: true, scheduleSource: true } })
    if (loan.principal !== 290000) throw new Error(`principal atual ${loan.principal} != 290000 — ABORTA`)
    if (loan.scheduleSource !== 'FLEXIBLE') throw new Error(`scheduleSource ${loan.scheduleSource} != FLEXIBLE — ABORTA`)

    const t40 = await tx.transaction.findFirstOrThrow({
      where: { bankAccount: { companyId: CO }, amount: 40000, description: { contains: 'arafat' },
        date: { gte: new Date('2026-07-06T00:00:00Z'), lt: new Date('2026-07-07T00:00:00Z') } },
      select: { id: true, categoryId: true, date: true },
    })
    const t50 = await tx.transaction.findFirstOrThrow({
      where: { bankAccount: { companyId: CO }, amount: 50000, description: { contains: 'rafat' },
        date: { gte: new Date('2026-08-04T00:00:00Z'), lt: new Date('2026-08-05T00:00:00Z') } },
      select: { id: true, categoryId: true, date: true },
    })
    const insts = await tx.loanInstallment.findMany({ where: { loanId: loan.id }, orderBy: { number: 'asc' }, select: { id: true, number: true, status: true } })
    if (insts.length < 2) throw new Error(`empréstimo tem ${insts.length} parcelas — ABORTA`)
    if (insts[0].status !== 'OPEN' || insts[1].status !== 'OPEN') throw new Error('parcelas #1/#2 não estão OPEN — ABORTA')
    // guarda: nenhum tx já vinculado a parcela
    const jaVinc = await tx.loanInstallment.count({ where: { loanId: loan.id, reconciledTransactionId: { in: [t40.id, t50.id] } } })
    if (jaVinc > 0) throw new Error('tx já vinculada — ABORTA')

    // 1) principal 380.000 + notes
    await tx.loan.update({ where: { id: loan.id }, data: { principal: 380000, notes: NOTES } })
    // 2) parcela #1 = devolução 40.000 (06/07), vinculada à tx 40k
    await tx.loanInstallment.update({ where: { id: insts[0].id }, data: { status: 'PAID', amortization: 40000, interest: 0, correcao: 0, paidTotal: 40000, paidInterest: 0, paidCorrection: 0, paidDate: t40.date, reconciledTransactionId: t40.id } })
    // 3) parcela #2 = devolução 50.000 (04/08), vinculada à tx 50k
    await tx.loanInstallment.update({ where: { id: insts[1].id }, data: { status: 'PAID', amortization: 50000, interest: 0, correcao: 0, paidTotal: 50000, paidInterest: 0, paidCorrection: 0, paidDate: t50.date, reconciledTransactionId: t50.id } })
    // 4) reclassifica a tx 40k → Amortização de Mútuo (a 50k já está)
    if (t40.categoryId !== CAT_MUTUO) await tx.transaction.update({ where: { id: t40.id }, data: { categoryId: CAT_MUTUO } })

    // guarda de saldo: recomputa com a lib (FLEXIBLE = principal − Σamort PAID)
    const loanFull = await tx.loan.findUniqueOrThrow({ where: { id: loan.id }, select: { principal: true, installmentsPaidBefore: true, interestRateMonthly: true, rateType: true, scheduleSource: true, installments: { select: { number: true, status: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true } } } })
    const saldo = saldoDevedorAtual(loanFull as any, loanFull.installments as any)
    if (Math.abs(saldo - 290000) > 0.01) throw new Error(`saldo pós-correção ${saldo} != 290000 — ABORTA (rollback)`)
    const somaAmort = loanFull.installments.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amortization, 0)
    console.log(`  [tx] principal=380000 · Σamort(pagas)=${somaAmort} · saldo=${saldo}`)
  })

  const distDepois = await distribuidoLucros()
  const orfDepois = await orfasValor()
  const contasDepois = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  const pontesDepois = await prisma.pJtoPFBridge.count()
  const mapA = new Map(contasAntes.map((c) => [c.name, c.balance]))

  console.log('\n=== VERIFICAÇÃO ===')
  console.log(`  Distribuição de Lucros: ${distAntes} → ${distDepois} (Δ ${Math.round((distDepois - distAntes) * 100) / 100})`)
  console.log(`  Órfãs não classificado: ${orfAntes.v} (${orfAntes.n}) → ${orfDepois.v} (${orfDepois.n})`)
  console.log(`  Pontes: ${pontesAntes} → ${pontesDepois}`)
  console.log('  Saldos das contas (todos devem ter Δ 0):')
  for (const c of contasDepois) console.log(`    ${c.name.padEnd(18)} ${mapA.get(c.name)} → ${c.balance}  Δ ${Math.round((c.balance - (mapA.get(c.name) ?? 0)) * 100) / 100}`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
