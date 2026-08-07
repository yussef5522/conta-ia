// Etapa 2 (06/08) — MEDIÇÃO de paridade V1/V2. Read-mostly num scratch DB.
// Roda o MESMO OFX 2× pelo runImportV2 e mede: re-import dedup, fitidKey/
// contentHash nas rows, ImportedIdentity seedado, categoryOverride aplicado.
// Uso: DATABASE_URL=<scratch> RECONCILE_V2=true npx tsx scripts/measure-v1v2-parity.ts

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'

const prisma = new PrismaClient()

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>P1<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701<DTEND>20260710
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260705<TRNAMT>-111.11<FITID>F1<MEMO>PAGAMENTO FORNECEDOR A</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260705<TRNAMT>-222.22<FITID>F2<MEMO>PAGAMENTO FORNECEDOR B</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260706<TRNAMT>333.33<FITID>F3<MEMO>RECEBIMENTO CLIENTE X</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00<DTASOF>20260710</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

async function main() {
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('RECONCILE_V2=true faltando')
  const stamp = Date.now()
  const usr = await prisma.user.create({ data: { name: 'P', email: `p${stamp}@x.com`, password: 'x' } })
  const co = await prisma.company.create({ data: { cnpj: `P${stamp}`, name: 'Parity' } })
  const acc = await prisma.bankAccount.create({ data: { companyId: co.id, name: 'C1' } })

  // 1º import
  await prisma.$transaction((tx) => runImportV2(tx as any, { bankAccountId: acc.id, rawOfx: OFX, userId: usr.id, fileName: 'a.ofx' }))
  const afterFirst = await prisma.transaction.count({ where: { bankAccountId: acc.id } })

  // 2º import DO MESMO ARQUIVO
  await prisma.$transaction((tx) => runImportV2(tx as any, { bankAccountId: acc.id, rawOfx: OFX, userId: usr.id, fileName: 'a.ofx' }))
  const afterSecond = await prisma.transaction.count({ where: { bankAccountId: acc.id } })

  const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { description: true, fitidKey: true, contentHash: true, status: true } })
  const identityRows = await prisma.importedIdentity.count({ where: { bankAccountId: acc.id } }).catch(() => -1)

  console.log('\n=== MEDIÇÃO PARIDADE V1/V2 (scratch) ===')
  console.log(`1º import criou: ${afterFirst} tx (esperado 3)`)
  console.log(`2º import (mesmo arquivo) → total: ${afterSecond} tx | NOVAS no 2º: ${afterSecond - afterFirst}`)
  console.log(`  → re-import dedup: ${afterSecond === afterFirst ? 'OK (0 novas) — reconcileStatement cobre' : 'FALHOU (duplicou!)'}`)
  const comFitidKey = rows.filter((r) => r.fitidKey).length
  const comContentHash = rows.filter((r) => r.contentHash).length
  console.log(`  → fitidKey preenchido: ${comFitidKey}/${rows.length} | contentHash: ${comContentHash}/${rows.length}`)
  console.log(`  → ImportedIdentity seedado: ${identityRows} linhas (V1 criaria ${afterFirst})`)
  console.log(`  → status das tx: ${rows.map((r) => r.status).join(', ')} (V1 auto-classificaria por regra/keyword)`)

  // cleanup
  await prisma.transaction.deleteMany({ where: { bankAccountId: acc.id } })
  await prisma.importedIdentity.deleteMany({ where: { bankAccountId: acc.id } }).catch(() => {})
  await prisma.statementLine.deleteMany({ where: { bankAccountId: acc.id } }).catch(() => {})
  await prisma.ofxImport.deleteMany({ where: { bankAccountId: acc.id } })
  await prisma.bankAccount.delete({ where: { id: acc.id } })
  await prisma.company.delete({ where: { id: co.id } })
  await prisma.user.delete({ where: { id: usr.id } })
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
