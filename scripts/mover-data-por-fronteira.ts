// ⭐⭐ MOVER A DATA DE UMA LINHA QUE O BANCO RE-DATOU — **só com o PDF na mão** (05/09/2026).
//
// Decisão do dono: *"a régua é o PDF — a decisão de 01/09 já elegeu o juiz. Se ele disser
// 02/09, move as duas com cirurgia + preview (e os dias 01 e 02 têm que fechar depois); se
// disser 01/09, mantém a nossa e o OFX novo é mania tolerada. **Sem o PDF, não move nada.**"*
//
// ⛔ SEM `--pdf` O SCRIPT NEM RODA. Não há régua sem o documento — e mover data de
// transação lançada por palpite é reescrever história com cara de conserto.
// ⛔ SEM `--apply` só mostra. E **ABORTA se os dias não fecharem depois**: se o movimento
// não faz os dois dias fecharem, a hipótese está errada e mover só espalharia o erro.
//
//   npx tsx scripts/mover-data-por-fronteira.ts --pdf=/caminho/extrato.pdf [--apply]

import { readFileSync } from 'fs'
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { extractPdfText } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { banrisulPdfParser } from '@/lib/bank-statement-pdf/banrisul-parser'
import { conferirDiaADia, type LancamentoSistema } from '@/lib/bank-statement-pdf/conferencia-diaria'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'          // Caçula Mix — REGRA 8
const CONTA = 'cmq17z90v00qxrndl02kfn4iz'            // Banrisul da Caçula — REGRA 8
const APLICAR = process.argv.includes('--apply')
const pdfPath = process.argv.find((a) => a.startsWith('--pdf='))?.split('=')[1] ?? ''

/** o que se propõe mover: histórico + valor + de/para */
const ALVO = { memo: 'CAPITALIZACAO RG', valor: -297.84, de: '2026-09-01', para: '2026-09-02' }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  if (!pdfPath) throw new Error('⛔ Sem --pdf=<caminho> não há régua. O PDF é o juiz da data; sem ele, nada se move.')

  const p = banrisulPdfParser.parse(await extractPdfText(readFileSync(pdfPath))) as ReturnType<typeof banrisulPdfParser.parse> & {
    saldoAnterior?: { data: string; valor: number } | null
    saldosDiarios?: Array<{ data: string; valor: number }>
  }
  if (!p.saldoAnterior || !p.saldosDiarios?.length) {
    throw new Error('⛔ O PDF não traz "SALDO ANT" + "SALDO NA DATA" — sem abertura não há de onde partir.')
  }

  const regua = { saldoAnterior: p.saldoAnterior, saldosDiarios: p.saldosDiarios }
  const de = new Date(`${p.saldoAnterior.data}T00:00:00.000Z`)
  const ate = new Date(`${p.saldosDiarios[p.saldosDiarios.length - 1].data}T23:59:59.999Z`)

  const txs = await prisma.transaction.findMany({
    where: { bankAccountId: CONTA, lifecycle: 'EFFECTED', date: { gt: de, lte: ate } },
    select: { id: true, date: true, amount: true, type: true, description: true },
    orderBy: { date: 'asc' },
  })
  const lanc = (t: typeof txs[number]): LancamentoSistema => ({
    id: t.id, data: t.date.toISOString().slice(0, 10),
    valor: t.type === 'DEBIT' ? -t.amount : t.amount, descricao: t.description,
  })

  const alvos = txs.filter((t) =>
    t.description.toUpperCase().includes(ALVO.memo) &&
    Math.abs((t.type === 'DEBIT' ? -t.amount : t.amount) - ALVO.valor) < 0.005 &&
    t.date.toISOString().slice(0, 10) === ALVO.de)

  console.log(`\n=== MOVER ${ALVO.memo} de ${ALVO.de} pra ${ALVO.para} — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===`)
  console.log(`régua: PDF de ${p.saldoAnterior.data} a ${p.saldosDiarios[p.saldosDiarios.length - 1].data}`)
  console.log(`alvos encontrados: ${alvos.length}`)
  for (const t of alvos) console.log(`  · ${t.date.toISOString().slice(0, 10)} · ${brl(-t.amount)} · "${t.description}" · ${t.id}`)
  if (!alvos.length) { console.log('\nNada a mover.\n'); return }

  // ⭐ ANTES × DEPOIS, pela MESMA conferência que a tela usa (REGRA 4)
  const antes = conferirDiaADia(regua, txs.map(lanc))
  const depois = conferirDiaADia(regua, txs.map((t) =>
    alvos.some((a) => a.id === t.id) ? { ...lanc(t), data: ALVO.para } : lanc(t)))

  const linhaDoDia = (r: typeof antes, dia: string) => r.dias.find((x) => x.data === dia)
  for (const dia of [ALVO.de, ALVO.para]) {
    const a = linhaDoDia(antes, dia), b = linhaDoDia(depois, dia)
    console.log(`  ${dia}: antes ${a ? (a.fecha ? '✓ fecha' : `✗ ${brl(a.diferenca)}`) : '(o PDF não declara este dia)'}`
      + ` → depois ${b ? (b.fecha ? '✓ fecha' : `✗ ${brl(b.diferenca)}`) : '(o PDF não declara este dia)'}`)
  }
  console.log(`  no geral: antes ${antes.diasQueFecham}/${antes.dias.length} · depois ${depois.diasQueFecham}/${depois.dias.length}`)

  // ⛔⛔ A TRAVA DO DONO: "os dias 01 e 02 têm que fechar depois". Se não fecham, a
  // hipótese está errada — e mover a data espalharia o erro em vez de corrigi-lo.
  const piorou = depois.diasQueFecham < antes.diasQueFecham
  const naoFecham = [ALVO.de, ALVO.para].filter((dia) => { const b = linhaDoDia(depois, dia); return b && !b.fecha })
  if (piorou || naoFecham.length) {
    console.log(`\n⛔ ABORTADO: ${piorou ? 'a conferência PIOROU' : `os dias ${naoFecham.join(' e ')} continuam sem fechar`}.`)
    console.log('   A hipótese não se sustenta contra o PDF — nada foi gravado.\n')
    return
  }

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply pra executar.\n'); return }

  await prisma.$transaction(async (tx) => {
    for (const t of alvos) {
      await tx.transaction.update({
        where: { id: t.id },
        // ⚠️ meio-dia UTC: é a convenção de gravação do sistema (a lição de 01/09, quando
        // uma âncora à meia-noite deixou 10 tx do dia de fora da janela).
        data: { date: new Date(`${ALVO.para}T12:00:00.000Z`) },
      })
    }
  })
  console.log(`\n✓ ${alvos.length} transação(ões) movida(s) pra ${ALVO.para}.`)
  console.log('⚠️ O valor, o histórico e a categoria não foram tocados — só a DATA, que era o que o PDF corrigiu.\n')
}

main().finally(() => prisma.$disconnect())
