// Dry-run READ-ONLY do enriquecimento de contraparte. NÃO grava nada.
// Uso: npx tsx scripts/counterparty-dryrun.ts <bankAccountId> <caminho-pdftotext.txt>
//   (o .txt = saída de `pdftotext -layout extrato.pdf out.txt`)
// Reporta EXACT / AMBIGUOUS / SEM MATCH + cobertura por histórico, e valida o
// cabeçalho (agência/conta) contra a conta selecionada. Mascara nomes no output.

import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { banrisulPdfParser } from '../lib/bank-statement-pdf/banrisul-parser'
import { joinPdfStatement, type JoinTxInput } from '../lib/counterparty/join-pdf-statement'

const mask = (n: string) => (n.length <= 4 ? n : n.slice(0, 4) + '…')

async function main() {
  const [accId, pdfPath] = process.argv.slice(2)
  if (!accId || !pdfPath) throw new Error('uso: <bankAccountId> <pdftotext.txt>')
  const prisma = new PrismaClient()

  const acc = await prisma.bankAccount.findUnique({
    where: { id: accId },
    select: { id: true, agency: true, accountNumber: true, companyId: true },
  })
  if (!acc) throw new Error('conta não encontrada')

  const parsed = banrisulPdfParser.parse(readFileSync(pdfPath, 'utf8'))
  // FASE 2.4: valida cabeçalho vs conta selecionada
  const agOk = !acc.agency || !parsed.header.agencia || acc.agency.replace(/\D/g, '') === parsed.header.agencia.replace(/\D/g, '')
  const ccOk = !acc.accountNumber || !parsed.header.conta || acc.accountNumber.replace(/\D/g, '') === parsed.header.conta.replace(/\D/g, '')
  console.log('PDF header:', parsed.header, '| conta ag/cc:', acc.agency, acc.accountNumber, '| bate:', agOk && ccOk)
  if (!(agOk && ccOk)) { console.log('❌ ABORTA: cabeçalho do PDF não bate com a conta — não enriquecer conta errada.'); await prisma.$disconnect(); return }

  const txs = await prisma.transaction.findMany({
    where: { bankAccountId: accId },
    select: { id: true, externalId: true, amount: true, description: true, counterpartySource: true },
  })
  const joinTx: JoinTxInput[] = txs.map((t) => ({
    id: t.id, externalId: t.externalId, amount: t.amount, description: t.description, counterpartySource: t.counterpartySource,
  }))

  const r = joinPdfStatement(parsed.lines, joinTx)
  console.log('\n== DRY-RUN (nada gravado) ==')
  console.log('PDF linhas:', parsed.lines.length, '| com NOME:', parsed.lines.filter((l) => l.counterpartyName).length)
  console.log('tx no banco:', txs.length)
  console.log('EXACT:', r.stats.exactCount, '| AMBIGUOUS keys:', r.stats.ambiguousKeys, '(tx:', r.stats.ambiguousTxCount + ')', '| SEM MATCH:', r.stats.noMatchCount, '| MANUAL protegido:', r.stats.manualProtected)

  // cobertura por histórico (PIX ENVIADO, PIX RECEBIDO...)
  const exactIds = new Set(r.exact.map((e) => e.txId))
  const byHist: Record<string, { total: number; comNome: number }> = {}
  for (const t of txs) {
    const k = (t.description || '').toUpperCase().split(' ').slice(0, 2).join(' ')
    byHist[k] = byHist[k] || { total: 0, comNome: 0 }
    byHist[k].total++
    if (exactIds.has(t.id)) byHist[k].comNome++
  }
  console.log('\ncobertura por histórico:')
  for (const [k, v] of Object.entries(byHist).sort((a, b) => b[1].total - a[1].total).slice(0, 12))
    console.log(`  ${k}: ${v.comNome}/${v.total}`)
  console.log('\nchaves AMBÍGUAS (nomes mascarados):')
  for (const a of r.ambiguous) console.log(`  doc=${a.documento} val=${a.amount} → ${a.candidateNames.map(mask).join(' | ')} (${a.txIds.length} tx)`)

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e.message); process.exit(1) })
