// Etapa 3a E2E (06/08) — prova real do SKIP: 5 linhas, 2 marcadas SKIP no
// preview → 3 tx criadas (não 5), e as 2 puladas NÃO existem em lugar nenhum.
// Roda contra Postgres scratch. Uso:
//   DATABASE_URL=<scratch> RECONCILE_V2=true npx tsx scripts/e2e-skip-decisions.ts

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'
import { dedupHashOFX } from '../lib/ofx/dedup'

const prisma = new PrismaClient()

// 5 débitos distintos, todos EFFECTED (datas passadas).
const LINHAS = [
  { fitid: 'S1', amt: -10.01, memo: 'PAGAMENTO A' },
  { fitid: 'S2', amt: -20.02, memo: 'PAGAMENTO B' },
  { fitid: 'S3', amt: -30.03, memo: 'CONSORCIO DESMARCADO' }, // SKIP
  { fitid: 'S4', amt: -40.04, memo: 'PAGAMENTO C' },
  { fitid: 'S5', amt: -50.05, memo: 'DUPLICATA DESMARCADA' }, // SKIP
]
const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>S<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701<DTEND>20260705
${LINHAS.map((l) => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260703<TRNAMT>${l.amt}<FITID>${l.fitid}<MEMO>${l.memo}</STMTTRN>`).join('\n')}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00<DTASOF>20260705</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

function hashOf(l: { fitid: string; amt: number; memo: string }) {
  return dedupHashOFX({ datePosted: new Date('2026-07-03T00:00:00Z'), type: 'DEBIT', amount: Math.abs(l.amt), memo: l.memo, fitid: l.fitid })
}

async function main() {
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('RECONCILE_V2=true faltando')
  const stamp = Date.now()
  const usr = await prisma.user.create({ data: { name: 'S', email: `s${stamp}@x.com`, password: 'x' } })
  const co = await prisma.company.create({ data: { cnpj: `S${stamp}`, name: 'Skip' } })
  const acc = await prisma.bankAccount.create({ data: { companyId: co.id, name: 'C1' } })

  // desmarca (SKIP) a #3 e a #5
  const decisions = [
    { dedupHash: hashOf(LINHAS[2]), action: 'SKIP' as const },
    { dedupHash: hashOf(LINHAS[4]), action: 'SKIP' as const },
  ]

  await prisma.$transaction((tx) =>
    runImportV2(tx as any, { bankAccountId: acc.id, rawOfx: OFX, userId: usr.id, fileName: 's.ofx', decisions }),
  )

  const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { description: true } })
  const descs = rows.map((r) => r.description).sort()
  const skipPresente = descs.some((d) => d.includes('DESMARCAD'))

  console.log('\n=== E2E SKIP DECISIONS ===')
  console.log(`tx criadas: ${rows.length} (esperado 3)`)
  console.log(`descrições: ${descs.join(' | ')}`)
  console.log(`alguma DESMARCADA entrou? ${skipPresente ? 'SIM (FALHOU)' : 'NÃO (OK)'}`)
  const ok = rows.length === 3 && !skipPresente
  console.log(ok ? '✅ PASSOU: 5 linhas, 2 SKIP → 3 criadas, desmarcadas ausentes' : '❌ FALHOU')
  process.exit(ok ? 0 : 1)
}
main().finally(() => prisma.$disconnect())
