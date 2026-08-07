// E2E throwaway (06/08/2026) — prova REAL do fix: runImportV2 aplica a categoria
// escolhida no preview. Roda contra um SQLite temporário (NÃO toca dev.db nem
// prod). Cria empresa+conta, importa um OFX com 2 débitos onde SÓ UM tem override,
// e confere no banco: o com override entra RECONCILED+categoria; o sem, PENDING.
// Uso: DATABASE_URL=file:/tmp/ofx-e2e.db RECONCILE_V2=true npx tsx scripts/e2e-ofx-v2-override.ts

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'
import { dedupHashOFX } from '../lib/ofx/dedup'

const prisma = new PrismaClient()

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>99999-9
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701
<DTEND>20260715
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260715
<TRNAMT>-100.50
<FITID>ABC123
<MEMO>PIX ENVIADO JOAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260715
<TRNAMT>-30.00
<FITID>T1
<MEMO>TARIFA MENSAL
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000.00
<DTASOF>20260715
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

async function main() {
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('setar RECONCILE_V2=true')

  const stamp = Date.now()
  const usr = await prisma.user.create({ data: { name: 'E2E', email: `e2e${stamp}@x.com`, password: 'x' } })
  const company = await prisma.company.create({ data: { cnpj: `E2E${stamp}`, name: 'E2E OFX' } })
  const acc = await prisma.bankAccount.create({ data: { companyId: company.id, name: 'Conta E2E' } })
  const cat = await prisma.category.create({
    data: { companyId: company.id, name: 'Despesa E2E', type: 'EXPENSE' },
  })

  // O client casa o override por dedupHashOFX (fitid|date|valor|memo).
  const overrideKey = dedupHashOFX({
    datePosted: new Date('2026-07-15T00:00:00Z'),
    type: 'DEBIT',
    amount: 100.5,
    memo: 'PIX ENVIADO JOAO',
    fitid: 'ABC123',
  })

  await prisma.$transaction(async (tx) =>
    runImportV2(tx as any, {
      bankAccountId: acc.id,
      rawOfx: OFX,
      userId: usr.id,
      fileName: 'e2e.ofx',
      categoryOverrides: [{ dedupHash: overrideKey, categoryId: cat.id }],
    }),
  )

  const txs = await prisma.transaction.findMany({
    where: { bankAccountId: acc.id },
    select: { description: true, amount: true, status: true, categoryId: true, classificationSource: true, aiConfidence: true },
    orderBy: { amount: 'desc' },
  })

  console.log('\n=== TRANSAÇÕES CRIADAS ===')
  for (const t of txs) {
    console.log(
      `${t.description.padEnd(20)} R$${String(t.amount).padStart(7)} | status=${t.status} | categoria=${t.categoryId === cat.id ? 'Despesa E2E' : (t.categoryId ?? 'NULL')} | src=${t.classificationSource ?? '-'} | conf=${t.aiConfidence ?? '-'}`,
    )
  }

  const comOverride = txs.find((t) => t.amount === 100.5)
  const semOverride = txs.find((t) => t.amount === 30)
  const ok =
    comOverride?.status === 'RECONCILED' &&
    comOverride?.categoryId === cat.id &&
    comOverride?.classificationSource === 'MANUAL' &&
    semOverride?.status === 'PENDING' &&
    semOverride?.categoryId == null

  console.log('\n=== RESULTADO ===')
  console.log(ok ? '✅ PASSOU: com override → RECONCILED+categoria; sem → PENDING' : '❌ FALHOU')

  // limpeza total do throwaway
  await prisma.transaction.deleteMany({ where: { bankAccountId: acc.id } })
  await prisma.category.deleteMany({ where: { companyId: company.id } })
  await prisma.ofxImport.deleteMany({ where: { bankAccountId: acc.id } })
  await prisma.bankAccount.delete({ where: { id: acc.id } })
  await prisma.company.delete({ where: { id: company.id } })
  await prisma.user.delete({ where: { id: usr.id } })

  process.exit(ok ? 0 : 1)
}

main().finally(() => prisma.$disconnect())
