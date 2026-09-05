// ⭐⭐ ONDE ESTÃO OS R$ 776,53 QUE O BANCO ENFIOU EM AGOSTO (05/09/2026).
//
// O PDF de 01/09 declarava `SALDO ANT EM 31/08 = −7.353,66`; o de 05/09 diz **−8.130,19**.
// A diferença são lançamentos que o Banrisul postou **depois do fato** — e eles **não estão
// em nenhum OFX que a gente guardou** (conferido: os 32 blobs do Banrisul não têm nada de
// agosto além do que já está no ledger). Só o PDF de agosto ATUALIZADO os mostra.
//
// ⭐⭐ A COMPARAÇÃO USA O MESMO MOTOR DO IMPORT (`reconcileStatement`), não uma régua
// própria: se eu escrevesse um "diff" aqui, ele discordaria do import no primeiro caso de
// borda — e aí a lista diria uma coisa e o sistema faria outra.
//
// ⛔ SEM `--apply` NÃO GRAVA. Com `--apply`, as linhas entram **com a data real do PDF**,
// **sem categoria** (categoria é decisão do dono) e marcadas na descrição de origem.
//
//   npx tsx scripts/localizar-linhas-que-o-banco-acrescentou.ts --pdf=/tmp/agosto.pdf [--apply]

import { readFileSync } from 'fs'
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { extractPdfText } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { banrisulPdfParser } from '@/lib/bank-statement-pdf/banrisul-parser'
import { reconcileStatement } from '@/lib/reconciliation/reconcile-statement'
import { conferirDiaADia } from '@/lib/bank-statement-pdf/conferencia-diaria'
import type { StatementLine, DbBankTransaction } from '@/lib/reconciliation/types'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'   // Caçula Mix — REGRA 8
const CONTA = 'cmq17z90v00qxrndl02kfn4iz'     // Banrisul da Caçula — REGRA 8
const APLICAR = process.argv.includes('--apply')
const pdfPath = process.argv.find((a) => a.startsWith('--pdf='))?.split('=')[1] ?? ''
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  if (!pdfPath) throw new Error('⛔ Sem --pdf=<caminho> não há o que comparar.')

  const p = banrisulPdfParser.parse(await extractPdfText(readFileSync(pdfPath))) as ReturnType<typeof banrisulPdfParser.parse> & {
    saldoAnterior?: { data: string; valor: number } | null
    saldosDiarios?: Array<{ data: string; valor: number }>
  }
  // ⚠️ a linha do PDF traz a data como STRING YYYY-MM-DD (`date`) e o valor com sinal em
  // `signed` — não confundir com `amount`, que é absoluto.
  const doPdf = p.lines.filter((l): l is typeof l & { date: string } => !!l.date)
  if (!doPdf.length) throw new Error('⛔ O PDF não trouxe lançamento nenhum — confira se é o extrato certo.')

  const deIso = doPdf.reduce((m, l) => (l.date < m ? l.date : m), doPdf[0].date)
  const ateIso = doPdf.reduce((m, l) => (l.date > m ? l.date : m), doPdf[0].date)
  const de = new Date(`${deIso}T00:00:00.000Z`)
  const ate = new Date(`${ateIso}T23:59:59.999Z`)
  console.log(`\n=== ${APLICAR ? 'APLICANDO' : 'PREVIEW'} · PDF cobre ${deIso} a ${ateIso} · ${doPdf.length} lançamentos ===`)

  const txs = await prisma.transaction.findMany({
    where: { bankAccountId: CONTA, date: { gte: de, lte: ate } },
    select: { id: true, date: true, amount: true, type: true, description: true, lifecycle: true, transferGroupId: true, transferDirection: true },
  })

  const linhas: StatementLine[] = doPdf.map((l) => ({
    datePosted: new Date(`${l.date}T00:00:00.000Z`), signedAmount: l.signed, memo: l.historico,
  }))
  const noBanco: DbBankTransaction[] = txs.map((t) => ({
    id: t.id, date: t.date, signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
    memo: t.description, lifecycle: t.lifecycle, type: t.type,
  }))

  // ⭐ o MESMO motor do import — inclusive a fronteira de dia (Tier 1.5)
  const r = reconcileStatement(linhas, noBanco, ate, new Date(), { skipPreviewSeparation: true })

  console.log(`\ncasadas: ${r.matched.length} · o banco tem e nós não: ${r.missing.length} · nós temos e o banco não: ${r.orphans.length}`)
  if (r.deslocamentosDeDia?.length) console.log(`(${r.deslocamentosDeDia.length} linha(s) que o banco só re-datou — não contam como novas)`)

  console.log(`\n=== ⭐ AS LINHAS QUE O BANCO ACRESCENTOU (entram no ledger) ===`)
  let soma = 0
  for (const m of r.missing.sort((a, b) => +a.datePosted - +b.datePosted)) {
    soma += m.signedAmount
    console.log(`  ${dia(m.datePosted)} · ${brl(m.signedAmount).padStart(14)} · "${m.memo}"`)
  }
  console.log(`  soma: ${brl(soma)}`)

  if (r.orphans.length) {
    console.log(`\n=== ⚠️ NÓS TEMOS E O PDF NÃO LISTA (NÃO se apaga nada — só se olha) ===`)
    for (const o of r.orphans) console.log(`  ${dia(o.date)} · ${brl(o.signedAmount).padStart(14)} · "${o.memo}" · ${o.id}`)
  }

  // ⭐ A PROVA: o dia a dia fecha DEPOIS de entrar com elas?
  if (p.saldoAnterior && p.saldosDiarios?.length) {
    const lanc = (t: { id: string; date: Date; signedAmount: number; memo: string }) =>
      ({ id: t.id, data: dia(t.date), valor: t.signedAmount, descricao: t.memo })
    const antes = conferirDiaADia({ saldoAnterior: p.saldoAnterior, saldosDiarios: p.saldosDiarios }, noBanco.map(lanc))
    const depois = conferirDiaADia({ saldoAnterior: p.saldoAnterior, saldosDiarios: p.saldosDiarios },
      [...noBanco.map(lanc), ...r.missing.map((m, i) => ({ id: `nova-${i}`, data: dia(m.datePosted), valor: m.signedAmount, descricao: m.memo }))])
    const fecham = (x: typeof antes) => x.dias.filter((d) => d.fecha).length
    console.log(`\n=== a conferência dia a dia ===`)
    console.log(`  antes:  ${fecham(antes)}/${antes.dias.length} dias fecham`)
    console.log(`  depois: ${fecham(depois)}/${depois.dias.length} dias fecham`)
    for (const d of depois.dias.filter((x) => !x.fecha)) console.log(`    ✗ ${d.data}: nosso ${brl(d.saldoSistema)} vs banco ${brl(d.saldoBanco)} → ${brl(d.diferenca)}`)
    // ⛔ se não fecha depois, a lista está incompleta — entrar com ela espalharia o erro
    if (fecham(depois) < depois.dias.length && APLICAR) {
      console.log(`\n⛔ ABORTADO: com estas linhas o período ainda não fecha. A lista não explica tudo — nada foi gravado.\n`)
      return
    }
  }

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply pra entrar com elas.\n'); return }

  const criadas = await prisma.$transaction(async (tx) => {
    const ids: string[] = []
    for (const m of r.missing) {
      const t = await tx.transaction.create({
        data: {
          bankAccountId: CONTA,
          date: new Date(dia(m.datePosted) + 'T12:00:00.000Z'), // convenção do sistema
          amount: Math.abs(m.signedAmount),
          type: m.signedAmount >= 0 ? 'CREDIT' : 'DEBIT',
          description: m.memo,
          lifecycle: 'EFFECTED',
          status: 'PENDING',        // ⛔ SEM categoria: categoria é decisão do dono
          origin: 'PDF_EXTRATO',
        },
        select: { id: true },
      })
      ids.push(t.id)
    }
    return ids
  })
  console.log(`\n✓ ${criadas.length} linha(s) criada(s), sem categoria — elas aparecem em Pendentes pra você classificar.`)
  console.log('⚠️ O saldo da conta se recalcula no próximo import; se quiser agora, rode o recalcular.\n')
}

main().finally(() => prisma.$disconnect())
