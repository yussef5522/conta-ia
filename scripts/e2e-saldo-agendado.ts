// FASE 2.5 (07/08) — regressão do saldo com movimento futuro/agendado.
// Invariante: saldo REALIZADO (anchor) só soma tx EFFECTED após o ledgerBalDate.
// Agendado (PAYABLE/RECEIVABLE, date>anchor) NÃO pode entrar no saldo → tem que
// bater com o LEDGERBAL. Caso real Banrisul caçula (-6.178,45, não -21.576,73).
// Uso: DATABASE_URL=<scratch> npx tsx scripts/e2e-saldo-agendado.ts

import { PrismaClient } from '@prisma/client'
import { recalcularSaldoConta } from '../lib/balance/recalcular'

const prisma = new PrismaClient()
const D = (s: string) => new Date(`${s}T12:00:00Z`)

async function main() {
  const stamp = Date.now()
  const co = await prisma.company.create({ data: { cnpj: `S${stamp}`, name: 'SaldoTest' } })
  // Âncora = LEDGERBAL real do Banrisul (07/08): -6.178,45
  const acc = await prisma.bankAccount.create({
    data: { companyId: co.id, name: 'banrisul-test', ledgerBal: -6178.45, ledgerBalDate: D('2026-08-07'), balance: 0 },
  })

  // 4 AGENDADOS (PAYABLE, date > âncora) — NÃO podem entrar no saldo
  const futuros = [
    { d: '2026-08-10', a: 70.02 }, { d: '2026-08-10', a: 70.02 },
    { d: '2026-08-11', a: 1478.51 }, { d: '2026-08-17', a: 13779.73 },
  ]
  for (const f of futuros) {
    await prisma.transaction.create({
      data: { bankAccountId: acc.id, date: D(f.d), amount: f.a, type: 'DEBIT', status: 'PENDING',
        origin: 'OFX', lifecycle: 'PAYABLE', dueDate: D(f.d), description: 'AGENDADO', dedupHash: `pay-${f.d}-${f.a}-${stamp}` },
    })
  }
  // 1 REAL após a âncora (EFFECTED) — DEVE contar
  await prisma.transaction.create({
    data: { bankAccountId: acc.id, date: D('2026-08-08'), amount: 200, type: 'CREDIT', status: 'RECONCILED',
      origin: 'OFX', lifecycle: 'EFFECTED', description: 'REAL POS ANCORA', dedupHash: `eff-${stamp}` },
  })

  const r = await recalcularSaldoConta(prisma, acc.id)
  const esperado = -5978.45 // -6178.45 (ledger) + 200 (EFFECTED real). Agendados fora.
  const ok = Math.abs(r.saldoDepois - esperado) < 0.005
  console.log(`\n=== RESULTADO ===`)
  console.log(`  saldo calculado: ${r.saldoDepois}`)
  console.log(`  esperado:        ${esperado}  (ledgerBal -6178.45 + EFFECTED 200; agendados -15398.28 FORA)`)
  console.log(`  ${ok ? 'OK — agendado não entrou no saldo' : `FALHOU — saldo inclui agendado (erro ${(r.saldoDepois - esperado).toFixed(2)})`}`)
  process.exit(ok ? 0 : 1)
}
main().finally(() => prisma.$disconnect())
