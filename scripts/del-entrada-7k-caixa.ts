// CORREÇÃO 1 (08/08) — apaga a entrada MANUAL errada de R$ 7.000 no caixa loja/cofre
// (06/07, "saque do banco", Aporte de Capital). Era engano do usuário: o dinheiro
// saiu no ATM do banrisul p/ trocar por dólar, NÃO entrou no cofre. Sem soft delete.
// Atomic: delete a tx + decrementa o saldo da conta em 7.000. Guardas defensivas.
// Uso: DATABASE_URL=<prod> npx tsx scripts/del-entrada-7k-caixa.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const TID = 'cmr9orniz007jw3fsokhwdu5l'
const r2 = (n: number) => Math.round(n * 100) / 100

async function main() {
  const contasAntes = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { id: true, name: true, balance: true }, orderBy: { name: 'asc' } })
  const pontesAntes = await prisma.pJtoPFBridge.count()
  const loansAntes = await prisma.loan.count({ where: { companyId: CO } })

  await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.findUniqueOrThrow({ where: { id: TID }, select: { amount: true, type: true, origin: true, bankAccountId: true, transferGroupId: true, reconcileGroupId: true } })
    // Guardas: só apaga se for exatamente o esperado e sem vínculo
    if (t.origin !== 'MANUAL') throw new Error(`origin=${t.origin} != MANUAL — ABORTA`)
    if (t.amount !== 7000 || t.type !== 'CREDIT') throw new Error(`amount/type inesperado (${t.amount}/${t.type}) — ABORTA`)
    if (t.transferGroupId || t.reconcileGroupId) throw new Error('tem vínculo transfer/reconcile — ABORTA')
    const bridge = await tx.pJtoPFBridge.count({ where: { OR: [{ pjTransactionId: TID }, { pfTransactionId: TID }, { spendTransactionId: TID }] } })
    if (bridge > 0) throw new Error('tem ponte — ABORTA')
    const inst = await tx.loanInstallment.count({ where: { reconciledTransactionId: TID } })
    if (inst > 0) throw new Error('vinculada a parcela — ABORTA')

    await tx.transaction.delete({ where: { id: TID } })
    // saldo é cache: delete manual não recalcula → decremento explícito do CREDIT
    await tx.bankAccount.update({ where: { id: t.bankAccountId! }, data: { balance: { decrement: 7000 } } })
  })

  const contasDepois = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  const pontesDepois = await prisma.pJtoPFBridge.count()
  const loansDepois = await prisma.loan.count({ where: { companyId: CO } })
  const mapA = new Map(contasAntes.map((c) => [c.name, c.balance]))

  console.log('\n════════ PROVA (apagar entrada 7.000) ════════')
  for (const c of contasDepois) {
    const d = r2(c.balance - (mapA.get(c.name) ?? 0))
    console.log(`  ${c.name.padEnd(18)} ${r2(mapA.get(c.name) ?? 0)} → ${r2(c.balance)}  Δ ${d}${c.name === 'caixa loja/cofre' ? '  (esperado -7000)' : ''}`)
  }
  const outrasOk = contasDepois.filter((c) => c.name !== 'caixa loja/cofre').every((c) => Math.abs(c.balance - (mapA.get(c.name) ?? 0)) < 0.01)
  const caixaOk = Math.abs((contasDepois.find((c) => c.name === 'caixa loja/cofre')!.balance) - ((mapA.get('caixa loja/cofre') ?? 0) - 7000)) < 0.01
  console.log(`  caixa -7000 exato ? ${caixaOk ? 'SIM ✓' : 'NÃO ✗'} · outras 4 inalteradas ? ${outrasOk ? 'SIM ✓' : 'NÃO ✗'}`)
  console.log(`  Pontes: ${pontesAntes} → ${pontesDepois} (Δ0 ? ${pontesAntes === pontesDepois ? 'SIM ✓' : 'NÃO ✗'}) · Empréstimos: ${loansAntes} → ${loansDepois} (Δ0 ? ${loansAntes === loansDepois ? 'SIM ✓' : 'NÃO ✗'})`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
