// Etapa A (07/08) — prova do bug de dedup + regressão. Scratch Postgres.
// Cenários (red ANTES do fix, green DEPOIS):
//   S1 (bug original): PAYABLE existente + linha real chega depois → PROMOVE (não duplica)
//   S2: RECEIVABLE existente + linha real → promove
//   S3: preview com categoria → promove HERDANDO a categoria
//   S4: preview conciliada (reconcileGroupId) → NÃO promove, NÃO duplica, sinaliza
// Uso: DATABASE_URL=<scratch> RECONCILE_V2=true npx tsx scripts/e2e-dedup-promote.ts

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'

const prisma = new PrismaClient()

// OFX com UMA linha real (não-preview): data <= DTASOF, fitid NÃO-YYMMDD.
function ofx(fitid: string, amt: number, memo: string, dtposted = '20260715', dtasof = '20260731') {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>041<ACCTID>X<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260701<DTEND>${dtasof}
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${dtposted}<TRNAMT>-${amt.toFixed(2)}<FITID>${fitid}<MEMO>${memo}</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00<DTASOF>${dtasof}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

async function main() {
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('RECONCILE_V2=true faltando')
  const stamp = Date.now()
  const usr = await prisma.user.create({ data: { name: 'D', email: `d${stamp}@x.com`, password: 'x' } })
  const co = await prisma.company.create({ data: { cnpj: `D${stamp}`, name: 'Dedup' } })
  const acc = await prisma.bankAccount.create({ data: { companyId: co.id, name: 'C1' } })
  const cat = await prisma.category.create({ data: { companyId: co.id, name: 'Cat X', type: 'EXPENSE' } })

  const results: string[] = []
  async function scenario(nome: string, seed: () => Promise<void>, o: string, check: () => Promise<string>) {
    await prisma.loanInstallmentPayment.deleteMany({ where: { transaction: { bankAccountId: acc.id } } }).catch(() => {})
    await prisma.transaction.deleteMany({ where: { bankAccountId: acc.id } })
    await prisma.ofxImport.deleteMany({ where: { bankAccountId: acc.id } })
    await seed()
    await prisma.$transaction((t) => runImportV2(t as any, { bankAccountId: acc.id, rawOfx: o, userId: usr.id, fileName: 'x.ofx' }))
    const dump = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { date: true, lifecycle: true, description: true, amount: true, type: true } })
    for (const d of dump) console.log(`   [dump ${nome}] ${d.date.toISOString().slice(0, 10)} ${d.type} ${d.amount} ${d.lifecycle} "${d.description}"`)
    results.push(`${nome}: ${await check()}`)
  }

  // Parser OFX materializa datePosted em T12:00:00Z (lib/ofx/parser.ts). A
  // preview seedada tem que usar o MESMO instante, senão cai antes do minDate
  // da janela e nem entra no universo de reconcile.
  const D = new Date('2026-07-15T12:00:00Z')

  // S1 — PAYABLE existente + linha real → deve PROMOVER (1 tx EFFECTED), não duplicar
  await scenario('S1 PAYABLE→promove',
    async () => { await prisma.transaction.create({ data: { bankAccountId: acc.id, date: D, amount: 500, type: 'DEBIT', status: 'PENDING', origin: 'OFX', lifecycle: 'PAYABLE', dueDate: D, description: 'PAGAMENTO TESTE', dedupHash: `seed-s1-${stamp}` } }) },
    ofx('REALS1', 500, 'PAGAMENTO TESTE'),
    async () => {
      const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { lifecycle: true } })
      const eff = rows.filter((r) => r.lifecycle === 'EFFECTED').length
      return `total=${rows.length} effected=${eff} ${rows.length === 1 && eff === 1 ? 'OK(promoveu)' : 'FALHOU(duplicou)'}`
    })

  // S2 — RECEIVABLE existente + linha real (credit) → promove
  await scenario('S2 RECEIVABLE→promove',
    async () => { await prisma.transaction.create({ data: { bankAccountId: acc.id, date: D, amount: 700, type: 'CREDIT', status: 'PENDING', origin: 'OFX', lifecycle: 'RECEIVABLE', dueDate: D, description: 'RECEBIMENTO TESTE', dedupHash: `seed-s2-${stamp}` } }) },
    `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL<BANKACCTFROM><BANKID>041<ACCTID>X<ACCTTYPE>CHECKING</BANKACCTFROM><BANKTRANLIST><DTSTART>20260701<DTEND>20260731<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260715<TRNAMT>700.00<FITID>REALS2<MEMO>RECEBIMENTO TESTE</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>1000.00<DTASOF>20260731</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
    async () => {
      const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { lifecycle: true } })
      return `total=${rows.length} ${rows.length === 1 && rows[0].lifecycle === 'EFFECTED' ? 'OK(promoveu)' : 'FALHOU'}`
    })

  // S3 — preview com categoria → promove HERDANDO a categoria
  await scenario('S3 categoria herdada',
    async () => { await prisma.transaction.create({ data: { bankAccountId: acc.id, date: D, amount: 900, type: 'DEBIT', status: 'RECONCILED', origin: 'OFX', lifecycle: 'PAYABLE', dueDate: D, description: 'PAG CAT', categoryId: cat.id, dedupHash: `seed-s3-${stamp}` } }) },
    ofx('REALS3', 900, 'PAG CAT'),
    async () => {
      const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { lifecycle: true, categoryId: true } })
      return `total=${rows.length} ${rows.length === 1 && rows[0].lifecycle === 'EFFECTED' && rows[0].categoryId === cat.id ? 'OK(promoveu+cat)' : 'FALHOU'}`
    })

  // S4 — preview conciliada (reconcileGroupId) → NÃO promove, NÃO duplica, link intacto
  await scenario('S4 conciliada→não mexe',
    async () => { await prisma.transaction.create({ data: { bankAccountId: acc.id, date: D, amount: 1100, type: 'DEBIT', status: 'RECONCILED', origin: 'OFX', lifecycle: 'PAYABLE', dueDate: D, description: 'PAG CONCILIADO', reconcileGroupId: `rg-${stamp}`, dedupHash: `seed-s4-${stamp}` } }) },
    ofx('REALS4', 1100, 'PAG CONCILIADO'),
    async () => {
      const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { lifecycle: true, reconcileGroupId: true } })
      const ok = rows.length === 1 && rows[0].lifecycle === 'PAYABLE' && rows[0].reconcileGroupId === `rg-${stamp}`
      return `total=${rows.length} lifecycle=${rows[0]?.lifecycle} link=${rows[0]?.reconcileGroupId ? 'intacto' : 'PERDIDO'} ${ok ? 'OK(não mexeu)' : 'FALHOU'}`
    })

  console.log('\n=== RESULTADOS ===')
  for (const r of results) console.log('  ' + r)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
