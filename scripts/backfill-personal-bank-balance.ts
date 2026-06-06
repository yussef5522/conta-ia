// Sprint Retirada-Despesa-PF/saldo-fix — Recalcula balance cacheado de
// PersonalBankAccount somando as tx reais (CREDIT − DEBIT).
//
// MOTIVO: bug histórico de Sprint PF Fatia 4 — createBridge criava
// PersonalTransaction CREDIT mas NÃO atualizava balance da conta. Em
// perfis que tinham só ENTRADAS via ponte, o saldo cacheado ficou 0
// (errado, era pra ser +X). Quando passamos a criar despesas via
// Etapa 3 (Sprint Retirada-Despesa-PF), o decrement saiu do 0 → balance
// virou negativo, evidenciando o erro.
//
// FIX:
//  1) createBridge agora incrementa balance ao criar pfTx CREDIT (já feito)
//  2) deleteBridge WITH_PF_TX decrementa balance ao remover pfTx (já feito)
//  3) ESTE script recalcula balance pra TODAS as contas existentes
//     (idempotente — pode rodar quantas vezes quiser, sempre dá o mesmo
//     resultado: saldo = SUM(CREDIT) − SUM(DEBIT) das tx).
//
// Rodar: npx tsx scripts/backfill-personal-bank-balance.ts
//
// Zero credencial em log.

import { prisma } from '@/lib/db'

const ROUND_TOLERANCE = 0.005 // R$ 0,005 — limpa floating point noise

async function main() {
  console.log('🔍 Recalcula balance cacheado das PersonalBankAccount')
  const accounts = await prisma.personalBankAccount.findMany({
    select: { id: true, name: true, balance: true, profileId: true },
    orderBy: { name: 'asc' },
  })
  console.log(`📋 ${accounts.length} contas encontradas`)

  let unchanged = 0
  let updated = 0

  for (const acc of accounts) {
    // Soma real das transações da conta
    const agg = await prisma.personalTransaction.aggregate({
      where: { bankAccountId: acc.id, type: 'CREDIT' },
      _sum: { amount: true },
    })
    const aggDebit = await prisma.personalTransaction.aggregate({
      where: { bankAccountId: acc.id, type: 'DEBIT' },
      _sum: { amount: true },
    })
    const credits = agg._sum.amount ?? 0
    const debits = aggDebit._sum.amount ?? 0
    // Limpa noise float (1e-13 etc). Arredonda pra centavos.
    const realBalance = Math.round((credits - debits) * 100) / 100
    const diff = acc.balance - realBalance

    if (Math.abs(diff) < ROUND_TOLERANCE) {
      unchanged++
      console.log(
        `  ✓ ${acc.name.padEnd(20)} balance=${acc.balance.toFixed(2).padStart(12)} (ok)`,
      )
      continue
    }

    await prisma.personalBankAccount.update({
      where: { id: acc.id },
      data: { balance: realBalance },
    })
    updated++
    console.log(
      `  🔧 ${acc.name.padEnd(20)} balance: ${acc.balance.toFixed(2)} → ${realBalance.toFixed(2)} (diff ${diff.toFixed(2)})`,
    )
  }

  console.log('')
  console.log(`📊 Resultado: ${updated} corrigidas · ${unchanged} já estavam certas`)
  console.log('✅ Backfill concluído')
}

main()
  .catch((err) => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
