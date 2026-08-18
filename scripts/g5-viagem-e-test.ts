// G5 (08/08) — os 4 saques ATM de 06/07 (7.000, banrisul) viram ponte DISTRIBUICAO
// fluxo A/B, gasto categoria "Viagem" (criada se não existir). Saldo PF net 0.
// + apaga o "test" de R$1 (06/23, Investimentos, caixa loja/cofre) — lixo de teste.
// createBridge atomic. Prova invariantes. Uso: DATABASE_URL=<prod> npx tsx scripts/g5-viagem-e-test.ts

import { PrismaClient } from '@prisma/client'
import { createBridge } from '@/lib/bridges/create'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const USER = 'cmp9e4kgz00007wajsn05e9mg'
const PROFILE = 'cmq1crgsz00cn50toa9zty4uy'
const SOCIO = 'cmq1cqrjk00cj50toproqbscy'
const PF_BANRISUL = 'cmq1ljh8j00011on17owta8vt'
const CAT_ENTRY = 'cmq1crgt600cr50toreol6jwp' // Pró-labore / Lucros (INCOME) — mesma das outras pontes
const SAQUE_06_07 = [
  'cmr9ogsgs004qw3fsy2ojw56l', 'cmr9ogsgs004sw3fsvz647qr1',
  'cmr9ogsgs004rw3fs043ifj2f', 'cmr9ogsgs004tw3fs8oxzjt4s',
]
const r2 = (n: number) => Math.round(n * 100) / 100

async function pfBalance() {
  const a = await prisma.personalBankAccount.findUniqueOrThrow({ where: { id: PF_BANRISUL }, select: { balance: true } })
  return r2(a.balance)
}
async function pjBalances() {
  const c = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  return new Map(c.map((x) => [x.name, r2(x.balance)]))
}

async function main() {
  const pfBefore = await pfBalance()
  const pjBefore = await pjBalances()
  const pontesBefore = await prisma.pJtoPFBridge.findMany({ select: { id: true, pjTransactionId: true, amount: true } })
  const loansBefore = await prisma.loan.count({ where: { companyId: CO } })
  const snapBefore = new Map((await prisma.transaction.findMany({ where: { id: { in: SAQUE_06_07 } }, select: { id: true, amount: true, date: true } })).map((t) => [t.id, `${t.amount}|${t.date.toISOString()}`]))

  // 1) categoria "Viagem" (EXPENSE) — idempotente
  let viagem = await prisma.personalCategory.findFirst({ where: { profileId: PROFILE, type: 'EXPENSE', name: 'Viagem' }, select: { id: true } })
  if (!viagem) {
    viagem = await prisma.personalCategory.create({ data: { profileId: PROFILE, name: 'Viagem', type: 'EXPENSE', icon: '✈️' }, select: { id: true } })
    console.log(`  categoria "Viagem" criada: ${viagem.id}`)
  } else console.log(`  categoria "Viagem" já existia: ${viagem.id}`)

  // 2) G5 — 4 bridges fluxo A/B (sequencial: mesma linha de saldo PF)
  let ok = 0
  for (const id of SAQUE_06_07) {
    try {
      await createBridge({
        userId: USER, companyId: CO, pjTransactionId: id, profileId: PROFILE,
        pfBankAccountId: PF_BANRISUL, kind: 'DISTRIBUICAO',
        createdVia: 'CREATED_MANUAL', socioPFId: SOCIO, spend: { categoryId: viagem.id },
      })
      ok++
    } catch (e: any) {
      if (e?.code === 'PJ_ALREADY_BRIDGED') { console.log(`  ${id} já tinha ponte — pulado`); continue }
      throw e
    }
  }
  console.log(`  G5: ${ok}/4 bridges criadas · PF banrisul=${await pfBalance()}`)

  // 3) apaga o "test" R$1 (caixa loja/cofre, Investimentos) + reverte saldo (+1)
  const test = await prisma.transaction.findFirst({
    where: { bankAccount: { companyId: CO, name: 'caixa loja/cofre' }, amount: 1, origin: 'MANUAL', description: { contains: 'test' }, category: { name: 'Investimentos' } },
    select: { id: true, bankAccountId: true, amount: true, type: true },
  })
  let caixaDelta = 0
  if (test) {
    if (test.type !== 'DEBIT' || test.amount !== 1) throw new Error(`test inesperado (${test.type}/${test.amount}) — ABORTA`)
    await prisma.$transaction(async (tx) => {
      await tx.transaction.delete({ where: { id: test.id } })
      await tx.bankAccount.update({ where: { id: test.bankAccountId! }, data: { balance: { increment: 1 } } }) // reverte o DEBIT
    })
    caixaDelta = 1
    console.log(`  "test" R$1 apagado (${test.id}) · caixa +1 (reverte o débito)`)
  } else console.log('  "test" R$1 não encontrado (já apagado?)')

  // ============ PROVA ============
  const pfAfter = await pfBalance()
  const pjAfter = await pjBalances()
  const pontesAfter = await prisma.pJtoPFBridge.findMany({ select: { id: true, pjTransactionId: true, amount: true } })
  const loansAfter = await prisma.loan.count({ where: { companyId: CO } })
  const snapAfter = new Map((await prisma.transaction.findMany({ where: { id: { in: SAQUE_06_07 } }, select: { id: true, amount: true, date: true } })).map((t) => [t.id, `${t.amount}|${t.date.toISOString()}`]))

  console.log('\n════════ PROVA ════════')
  console.log(`  PF banrisul: ${pfBefore} → ${pfAfter}  (Δ ${r2(pfAfter - pfBefore)} — esperado 0, A/B net zero)`)
  console.log('  Saldos das 5 contas PJ:')
  for (const [name, bal] of pjAfter) {
    const exp = name === 'caixa loja/cofre' ? caixaDelta : 0
    const d = r2(bal - (pjBefore.get(name) ?? 0))
    console.log(`    ${name.padEnd(18)} ${pjBefore.get(name)} → ${bal}  Δ ${d}  ${Math.abs(d - exp) < 0.01 ? 'ok' : '✗'}${name === 'caixa loja/cofre' ? ` (esperado +${caixaDelta}, test)` : ''}`)
  }
  const beforeMap = new Map(pontesBefore.map((p) => [p.id, `${p.pjTransactionId}|${p.amount}`]))
  const afterMap = new Map(pontesAfter.map((p) => [p.id, `${p.pjTransactionId}|${p.amount}`]))
  const oldIntact = [...beforeMap].every(([id, v]) => afterMap.get(id) === v)
  console.log(`  Pontes: ${pontesBefore.length} → ${pontesAfter.length} (+${pontesAfter.length - pontesBefore.length}) · antigas intactas ? ${oldIntact ? 'SIM ✓' : 'NÃO ✗'}`)
  console.log(`  Empréstimos: ${loansBefore} → ${loansAfter} (Δ0 ? ${loansBefore === loansAfter ? 'SIM ✓' : 'NÃO ✗'})`)
  const noChange = [...snapBefore].every(([id, v]) => snapAfter.get(id) === v)
  console.log(`  Saques ATM sem valor/data alterados ? ${noChange ? 'SIM ✓' : 'NÃO ✗'}`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
