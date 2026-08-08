// FASE 3 execução (07/08) — GRAVA. Duas ações numa transação com guardas:
//  1. Remove os 4 PAYABLE futuros do Banrisul (agendado — não cadastrado).
//  2. Recalcula o saldo do Banrisul (só EFFECTED) → deve dar -6.178,45.
// Aborta (rollback) se qualquer guarda falhar. Uso: DATABASE_URL=<prod> npx tsx ...

import { PrismaClient } from '@prisma/client'
import { recalcularSaldoConta } from '../lib/balance/recalcular'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const ESPERADO = -6178.45

async function main() {
  const antes = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  const effAntes = await prisma.transaction.count({ where: { bankAccount: { companyId: CO }, lifecycle: 'EFFECTED' } })

  await prisma.$transaction(async (tx) => {
    // Guarda A: a conta é mesmo o Banrisul.
    const conta = await tx.bankAccount.findUniqueOrThrow({ where: { id: BANRISUL }, select: { name: true, companyId: true } })
    if (conta.companyId !== CO || !/banrisul/i.test(conta.name)) throw new Error(`Conta inesperada: ${conta.name}`)

    // Guarda B: pega EXATAMENTE os 4 PAYABLE futuros seguros.
    const alvos = await tx.transaction.findMany({
      where: {
        bankAccountId: BANRISUL, lifecycle: 'PAYABLE',
        amount: { in: [70.02, 1478.51, 13779.73] },
        date: { gt: new Date('2026-08-07T23:59:59Z') },
        reconcileGroupId: null, reconciledWithId: null,
      },
      select: { id: true, amount: true, date: true, externalId: true, categoryId: true },
    })
    if (alvos.length !== 4) throw new Error(`Esperava 4 PAYABLE, achei ${alvos.length} — ABORTA`)
    // Guarda C: nenhum é EFFECTED, nenhum tem vínculo de empréstimo, nenhum tem categoria.
    for (const a of alvos) {
      if (a.categoryId) throw new Error(`PAYABLE ${a.id} tem categoria — ABORTA`)
      const li = await tx.loanInstallment.count({ where: { reconciledTransactionId: a.id } })
      const lip = await tx.loanInstallmentPayment.count({ where: { transactionId: a.id } })
      if (li > 0 || lip > 0) throw new Error(`PAYABLE ${a.id} tem vínculo de empréstimo — ABORTA`)
    }
    const ids = alvos.map((a) => a.id)
    const del = await tx.transaction.deleteMany({ where: { id: { in: ids }, lifecycle: 'PAYABLE' } })
    if (del.count !== 4) throw new Error(`Delete removeu ${del.count} (esperava 4) — ABORTA`)

    // Ação 2: recalcula o saldo do Banrisul.
    const r = await recalcularSaldoConta(tx, BANRISUL)
    if (Math.abs(r.saldoDepois - ESPERADO) > 0.005) {
      throw new Error(`Saldo pós-recalc ${r.saldoDepois} != ${ESPERADO} — ABORTA`)
    }
    console.log(`  [tx] 4 PAYABLE removidos · saldo Banrisul ${r.saldoAntes} → ${r.saldoDepois}`)
  })

  // Verificação pós-commit
  const depois = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  const effDepois = await prisma.transaction.count({ where: { bankAccount: { companyId: CO }, lifecycle: 'EFFECTED' } })
  const mapA = new Map(antes.map((a) => [a.name, a.balance]))

  console.log('\n=== SALDOS antes → depois ===')
  for (const d of depois) {
    const a = mapA.get(d.name) ?? 0
    const delta = Math.round((d.balance - a) * 100) / 100
    console.log(`  ${d.name.padEnd(18)} ${String(a).padStart(12)} → ${String(d.balance).padStart(12)}  delta ${delta}`)
  }
  console.log(`\n  EFFECTED (caçula) antes=${effAntes} depois=${effDepois}  (tem que ser IGUAL)`)
  const restantes = await prisma.transaction.count({
    where: { bankAccountId: BANRISUL, lifecycle: 'PAYABLE', date: { gt: new Date('2026-08-07T23:59:59Z') } },
  })
  console.log(`  PAYABLE futuros Banrisul restantes=${restantes} (tem que ser 0)`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
