// FRENTE Banrisul (08/08) — GRAVA. 4 itens numa transação com guardas:
//  ① 2.444,15 (27/07) → #57 do 57538834 (1:1); remove dup PENDING V2 + anula rwith órfão.
//  ② duas cotas 12/06 (1.393,74 + 2.784,22) → #21 do 64956967 (N:1); descategoriza a
//     1.393,74; troca o 1:1 atual (#21←2.784,22) por N:1 com split do documento.
//  ④ 2.677,29 (15/07, cartão) → remove dup PENDING V2 + anula rwith órfão (sem vínculo).
// ABORTA (rollback) se qualquer estado divergir. NÃO muda valor/data/saldo de tx.
// Uso: DATABASE_URL=<prod> npx tsx scripts/frente-vinculos-banrisul.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const D = (s: string) => new Date(`${s}T12:00:00Z`)

async function snapshot() {
  const contas = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { id: true, name: true, balance: true }, orderBy: { name: 'asc' } })
  const per: Record<string, { balance: number; count: number }> = {}
  for (const c of contas) per[c.name] = { balance: c.balance, count: await prisma.transaction.count({ where: { bankAccountId: c.id } }) }
  const eff = await prisma.transaction.count({ where: { bankAccount: { companyId: CO }, lifecycle: 'EFFECTED' } })
  const jeRows = await prisma.transaction.findMany({
    where: { bankAccount: { companyId: CO }, category: { name: 'Juros e Encargos' }, date: { gte: D('2026-06-01'), lt: D('2026-07-01') } },
    select: { amount: true },
  })
  const jurosEncargosJun = Math.round(jeRows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  return { per, eff, jurosEncargosJun }
}

async function main() {
  const antes = await snapshot()

  await prisma.$transaction(async (tx) => {
    // ── ① + ④ : resolve as 2 duplicatas (2.444,15 e 2.677,29) ──
    const keptByAmount: Record<number, string> = {}
    for (const amount of [2444.15, 2677.29]) {
      const rows = await tx.transaction.findMany({
        where: { bankAccountId: BANRISUL, amount, lifecycle: 'EFFECTED' },
        select: { id: true, status: true, reconciledWithId: true },
      })
      if (rows.length !== 2) throw new Error(`${amount}: esperava 2 cópias, achou ${rows.length} — ABORTA`)
      const orig = rows.find((r) => r.status === 'RECONCILED')
      const dup = rows.find((r) => r.status === 'PENDING')
      if (!orig || !dup) throw new Error(`${amount}: não achei orig(RECONCILED)+dup(PENDING) — ABORTA`)
      // nenhuma das duas pode ter vínculo de empréstimo
      for (const id of [orig.id, dup.id]) {
        const li = await tx.loanInstallment.count({ where: { reconciledTransactionId: id } })
        const lip = await tx.loanInstallmentPayment.count({ where: { transactionId: id } })
        if (li || lip) throw new Error(`${amount}: cópia ${id} tem vínculo de empréstimo — ABORTA`)
      }
      // anula rwith órfão da original (apontava pra dup) e deleta a dup
      if (orig.reconciledWithId === dup.id) {
        await tx.transaction.update({ where: { id: orig.id }, data: { reconciledWithId: null } })
      }
      await tx.transaction.delete({ where: { id: dup.id } })
      keptByAmount[amount] = orig.id
    }

    // ── ① vincula a 2.444,15 (original) à #57 do 57538834 (1:1) ──
    const l57 = await tx.loan.findFirstOrThrow({ where: { companyId: CO, contractNumber: '002100057538834' }, select: { id: true } })
    const p57 = await tx.loanInstallment.findFirstOrThrow({ where: { loanId: l57.id, number: 57 }, select: { id: true, status: true, reconciledTransactionId: true, interest: true } })
    if (p57.reconciledTransactionId) throw new Error(`#57 já vinculada (${p57.reconciledTransactionId}) — ABORTA`)
    if (Math.abs((p57.interest ?? 0) - 545.46) > 0.02) throw new Error(`#57 interest ${p57.interest} ≠ 545,46 — ABORTA`)
    await tx.loanInstallment.update({ where: { id: p57.id }, data: { reconciledTransactionId: keptByAmount[2444.15] } })

    // ── ② as duas cotas de 12/06 → #21 do 64956967 (N:1) ──
    const cotas = await tx.transaction.findMany({
      where: { bankAccount: { companyId: CO }, date: D('2026-06-12'), amount: { in: [1393.74, 2784.22] } },
      select: { id: true, amount: true, categoryId: true },
    })
    const cota1 = cotas.find((c) => c.amount === 1393.74)
    const cota2 = cotas.find((c) => c.amount === 2784.22)
    if (!cota1 || !cota2) throw new Error(`cotas 12/06 não encontradas (${cotas.length}) — ABORTA`)
    const l21 = await tx.loan.findFirstOrThrow({ where: { companyId: CO, contractNumber: '002100064956967' }, select: { id: true } })
    const p21 = await tx.loanInstallment.findFirstOrThrow({ where: { loanId: l21.id, number: 21 }, select: { id: true, reconciledTransactionId: true, amortization: true, interest: true } })
    if (p21.reconciledTransactionId !== cota2.id) throw new Error(`#21 vínculo 1:1 atual (${p21.reconciledTransactionId}) ≠ cota 2.784,22 (${cota2.id}) — ABORTA`)
    if (Math.abs((p21.amortization ?? 0) - 2954.43) > 0.02) throw new Error(`#21 amort ${p21.amortization} ≠ 2.954,43 — ABORTA`)
    // remove o 1:1, descategoriza a 1.393,74, cria N:1 das duas cotas, grava split do doc
    await tx.loanInstallment.update({ where: { id: p21.id }, data: { reconciledTransactionId: null } })
    await tx.transaction.update({ where: { id: cota1.id }, data: { categoryId: null } })
    for (const c of [cota1, cota2]) {
      await tx.loanInstallmentPayment.create({ data: { installmentId: p21.id, transactionId: c.id, amount: c.amount } })
    }
    await tx.loanInstallment.update({
      where: { id: p21.id },
      data: { paidDate: D('2026-06-12'), paidTotal: 4177.96, paidInterest: 1223.53, paidCorrection: 0 },
    })
    console.log('  [tx] ① #57←2.444,15  ② #21←(1.393,74+2.784,22) N:1  ④ 2 dups removidas')
  })

  const depois = await snapshot()
  console.log('\n=== ANTES → DEPOIS ===')
  for (const nome of Object.keys(antes.per)) {
    const a = antes.per[nome], d = depois.per[nome]
    console.log(`  ${nome.padEnd(18)} count ${a.count}→${d.count} · saldo ${a.balance}→${d.balance}`)
  }
  console.log(`  EFFECTED: ${antes.eff}→${depois.eff} (diff ${depois.eff - antes.eff} — as 2 dups)`)
  console.log(`  "Juros e Encargos" jun: ${antes.jurosEncargosJun} → ${depois.jurosEncargosJun}`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
