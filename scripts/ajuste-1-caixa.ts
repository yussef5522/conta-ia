// Ajuste −R$1 no caixa loja/cofre (08/08) — volta o saldo pra 4.988,82 (físico
// conferido pelo usuário) após apagar o "test". Categoria "Ajuste de Saldo"
// (AJUSTE_SALDO, FORA do DRE). Data 31/07 (erro é de julho). Atomic.
// Uso: DATABASE_URL=<prod> npx tsx scripts/ajuste-1-caixa.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const CAIXA = 'cmq2o25qe0001y2faydl1yrp5' // caixa loja/cofre
const CAT_AJUSTE = 'cmq46ohp9000p2meq3s7cule7' // Ajuste de Saldo (AJUSTE_SALDO)
const r2 = (n: number) => Math.round(n * 100) / 100

async function main() {
  const antes = (await prisma.bankAccount.findUniqueOrThrow({ where: { id: CAIXA }, select: { balance: true } })).balance
  // idempotência: não duplica se já existir o ajuste
  const existe = await prisma.transaction.findFirst({ where: { bankAccountId: CAIXA, amount: 1, categoryId: CAT_AJUSTE, description: 'ajuste de contagem de caixa' } })
  if (existe) { console.log(`  já existe (${existe.id}) — nada a fazer · saldo=${r2(antes)}`); process.exit(0) }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        bankAccountId: CAIXA, categoryId: CAT_AJUSTE,
        date: new Date('2026-07-31T12:00:00Z'),
        description: 'ajuste de contagem de caixa',
        amount: 1, type: 'DEBIT', status: 'RECONCILED', origin: 'MANUAL',
        lifecycle: 'EFFECTED', classificationSource: 'MANUAL',
      },
    })
    await tx.bankAccount.update({ where: { id: CAIXA }, data: { balance: { decrement: 1 } } })
  })

  const depois = (await prisma.bankAccount.findUniqueOrThrow({ where: { id: CAIXA }, select: { balance: true } })).balance
  console.log(`  Ajuste -1 lançado (31/07, Ajuste de Saldo, fora do DRE)`)
  console.log(`  caixa loja/cofre: ${r2(antes)} → ${r2(depois)}  (esperado 4988.82 ? ${Math.abs(depois - 4988.82) < 0.01 ? 'SIM ✓' : 'NÃO ✗'})`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
