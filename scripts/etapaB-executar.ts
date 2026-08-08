// ETAPA B execução (08/08) — GRAVA. Remove as 29 duplicatas confirmadas:
//   A) 27 RECEIVABLE fantasma do Sicredi (preview↔real: têm gêmea EFFECTED)
//   B) 2 pernas do par V1 de R$ 5.000 (transferGroup a79d2d5e; mantém o V2)
// Transação com guardas; ABORTA (rollback) se qualquer contagem/segurança falhar.
// NÃO recalcula saldo (alvos são pré-âncora + não-EFFECTED → saldo não muda).
// Uso: DATABASE_URL=<prod> npx tsx scripts/etapaB-executar.ts

import { PrismaClient, Prisma } from '@prisma/client'
const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const V1_GROUP = 'a79d2d5e-5f39-4b56-b7ee-12077838c3cf'

async function snapshot() {
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: CO }, select: { id: true, name: true, balance: true }, orderBy: { name: 'asc' },
  })
  const perConta: Record<string, { balance: number; count: number }> = {}
  for (const c of contas) {
    perConta[c.name] = {
      balance: c.balance,
      count: await prisma.transaction.count({ where: { bankAccountId: c.id } }),
    }
  }
  const effected = await prisma.transaction.count({ where: { bankAccount: { companyId: CO }, lifecycle: 'EFFECTED' } })
  const recebRows = await prisma.transaction.findMany({
    where: { bankAccount: { companyId: CO }, lifecycle: 'RECEIVABLE' }, select: { amount: true },
  })
  const contasReceber = Math.round(recebRows.reduce((s, r) => s + r.amount, 0) * 100) / 100
  const pontes = await prisma.pJtoPFBridge.count()
  return { perConta, effected, contasReceber, pontes }
}

async function main() {
  // ── Alvo A: RECEIVABLE/PAYABLE que têm gêmea EFFECTED (preview↔real) ──
  const alvoA = await prisma.$queryRaw<Array<{ id: string; conta: string; lifecycle: string; amount: number }>>(Prisma.sql`
    SELECT prev.id, ba.name AS conta, prev.lifecycle, prev.amount
    FROM transactions prev JOIN bank_accounts ba ON ba.id = prev."bankAccountId"
    WHERE ba."companyId" = ${CO} AND prev.lifecycle IN ('PAYABLE','RECEIVABLE')
      AND prev."reconcileGroupId" IS NULL AND prev."reconciledWithId" IS NULL
      AND EXISTS (SELECT 1 FROM transactions eff
        WHERE eff."bankAccountId" = prev."bankAccountId" AND eff.date = prev.date
          AND eff.amount = prev.amount AND eff.type = prev.type
          AND eff.description = prev.description AND eff.lifecycle = 'EFFECTED')`)
  // ── Alvo B: par V1 de 5.000 ──
  const alvoB = await prisma.transaction.findMany({
    where: { transferGroupId: V1_GROUP },
    select: { id: true, amount: true, type: true, lifecycle: true, reconcileGroupId: true, reconciledWithId: true },
  })

  const antes = await snapshot()

  await prisma.$transaction(async (tx) => {
    // GUARDAS Alvo A
    if (alvoA.length !== 27) throw new Error(`Alvo A esperava 27, achou ${alvoA.length} — ABORTA`)
    if (alvoA.some((a) => a.conta !== 'sicredi')) throw new Error('Alvo A tem conta != sicredi — ABORTA')
    if (alvoA.some((a) => a.lifecycle === 'EFFECTED')) throw new Error('Alvo A contém EFFECTED — ABORTA')
    // GUARDAS Alvo B
    if (alvoB.length !== 2) throw new Error(`Alvo B esperava 2, achou ${alvoB.length} — ABORTA`)
    if (alvoB.some((b) => b.type !== 'TRANSFER' || b.amount !== 5000)) throw new Error('Alvo B não é par TRANSFER 5000 — ABORTA')
    if (alvoB.some((b) => b.reconcileGroupId || b.reconciledWithId)) throw new Error('Alvo B conciliado — ABORTA')
    const ids = [...alvoA.map((a) => a.id), ...alvoB.map((b) => b.id)]
    // Nenhum alvo pode ter vínculo de empréstimo
    const li = await tx.loanInstallment.count({ where: { reconciledTransactionId: { in: ids } } })
    const lip = await tx.loanInstallmentPayment.count({ where: { transactionId: { in: ids } } })
    if (li > 0 || lip > 0) throw new Error(`Alvo tem vínculo de empréstimo (li=${li} lip=${lip}) — ABORTA`)

    const del = await tx.transaction.deleteMany({ where: { id: { in: ids } } })
    if (del.count !== 29) throw new Error(`Delete removeu ${del.count} (esperava 29) — ABORTA`)
    console.log(`  [tx] removidas ${del.count} (27 RECEIVABLE Sicredi + 2 pernas V1 5.000)`)
  })

  const depois = await snapshot()

  // Verificação do par V2 que FICA (tem que ser TRANSFER dos 2 lados)
  const v2 = await prisma.transaction.findMany({
    where: { bankAccount: { companyId: CO }, amount: 5000, type: 'TRANSFER' },
    select: { transferGroupId: true, transferDirection: true },
  })

  console.log('\n=== ANTES → DEPOIS ===')
  for (const nome of Object.keys(antes.perConta)) {
    const a = antes.perConta[nome], d = depois.perConta[nome]
    console.log(`  ${nome.padEnd(18)} count ${a.count}→${d.count} · saldo ${a.balance}→${d.balance}`)
  }
  console.log(`  EFFECTED: ${antes.effected}→${depois.effected} (diff ${depois.effected - antes.effected})`)
  console.log(`  Contas a Receber (Σ RECEIVABLE): ${antes.contasReceber}→${depois.contasReceber} (diff ${Math.round((depois.contasReceber - antes.contasReceber) * 100) / 100})`)
  console.log(`  Pontes PJ→PF: ${antes.pontes}→${depois.pontes}`)
  console.log(`  Par 5.000 restante: ${v2.length} pernas — grupos ${[...new Set(v2.map((x) => x.transferGroupId))].join(', ')} — direções ${v2.map((x) => x.transferDirection).sort().join('/')}`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
