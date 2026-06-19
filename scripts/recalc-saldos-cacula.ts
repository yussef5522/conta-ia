// Recalcula bank_accounts.balance ancorado em LEDGERBAL pra Cacula
import { PrismaClient } from '@prisma/client'
import { recalcularSaldoConta } from '../lib/balance/recalcular'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: CACULA },
    select: { id: true, name: true, balance: true, ledgerBal: true, ledgerBalDate: true },
  })
  for (const c of contas) {
    const balBefore = c.balance
    await recalcularSaldoConta(prisma, c.id)
    const after = await prisma.bankAccount.findUnique({
      where: { id: c.id },
      select: { balance: true },
    })
    console.log(
      `  ${c.name}: ${balBefore.toFixed(2)} -> ${after!.balance.toFixed(2)} | ledgerBal=${c.ledgerBal?.toFixed(2) ?? 'null'} ledgerBalDate=${c.ledgerBalDate?.toISOString().slice(0, 10) ?? 'null'}`,
    )
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
