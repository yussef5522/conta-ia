// ⭐⭐⭐ EMPRÉSTIMOS v1 — BACKFILL (25/11/2026, lei docs/emprestimos-referencia.html).
//
// AUTORIZAÇÃO NOMINAL do dono (sprint "EMPRÉSTIMOS NÍVEL MUNDO"), e SÓ isto:
//  (1) R54 — os vínculos 1:1 existentes viram PEDAÇO N:1 (o 1:1 morre); `paid*` preenchidos pelo
//      split da porta (`computeLinkSplit`) quando faltarem;
//  (2) o fantasma PARTIAL (status fora do schema): pedaços que somam a parcela → PAID com a data do
//      último pedaço; parcial de verdade → OPEN (o PARCIAL é derivado da Σ);
//  (3) parcela PAGA sem `paidDate`: a data vem da transação vinculada, quando EXISTE — a que não tem
//      transação fica LISTADA pra decisão do dono (nada se inventa).
// ⛔ PASSADO NÃO SE REPROCESSA além disto. Idempotente: simula → grava → regrava = 0.
//
// Uso (no servidor):  npx tsx scripts/backfill-emprestimos-v1.ts           → SIMULAÇÃO (não grava)
//                     npx tsx scripts/backfill-emprestimos-v1.ts --aplicar → grava
// ⛔ Saída: contagens, nº de contrato/parcela e R$ — nenhum nome de pessoa, nenhuma descrição.

import { PrismaClient } from '@prisma/client'
import { computeLinkSplit, storedScheduleValid, shouldWriteSplit } from '../lib/loans/link-payment'

const APLICAR = process.argv.includes('--aplicar')
const db = new PrismaClient({ log: [] })
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const rot = (l: { contractNumber: string | null; scheduleSource: string | null }, n: number) =>
  `${l.scheduleSource === 'FLEXIBLE' ? 'mútuo' : l.contractNumber ?? '(sem nº)'} #${n}`

/** o DRE do ano, pelas DUAS réguas: a antiga (1:1 lia a agenda) e a nova (paid* só) */
async function dreDoAno(ano: number) {
  const de = new Date(Date.UTC(ano, 0, 1)), ate = new Date(Date.UTC(ano + 1, 0, 1))
  const parcelas = await db.loanInstallment.findMany({
    where: { status: 'PAID', dreHeld: false },
    select: {
      interest: true, correcao: true, paidDate: true, paidInterest: true, paidCorrection: true, paidPenalty: true,
      reconciledTransaction: { select: { date: true } }, _count: { select: { payments: true } },
    },
  })
  let antigo = 0, novo = 0
  for (const p of parcelas) {
    const enc = (p.paidInterest ?? 0) + (p.paidCorrection ?? 0) + (p.paidPenalty ?? 0)
    // régua ANTIGA: 1:1 → agenda (interest+correcao) pela data da tx; N:1 → paid* pela paidDate
    if (p.reconciledTransaction) {
      const j = p.interest + p.correcao
      if (j > 0 && p.reconciledTransaction.date >= de && p.reconciledTransaction.date < ate) antigo += j
    } else if (p._count.payments > 0 && p.paidInterest != null && p.paidDate && p.paidDate >= de && p.paidDate < ate && enc > 0) {
      antigo += enc
    }
    // régua NOVA (R54): paid* de toda parcela vinculada, pela paidDate
    const vinculada = !!p.reconciledTransaction || p._count.payments > 0
    if (vinculada && p.paidInterest != null && p.paidDate && p.paidDate >= de && p.paidDate < ate && enc > 0) novo += enc
  }
  return { antigo: r2(antigo), novo: r2(novo) }
}

async function contagens() {
  const [um, pedacos, partial, semData, comRealPayment] = await Promise.all([
    db.loanInstallment.count({ where: { reconciledTransactionId: { not: null } } }),
    db.loanInstallmentPayment.count(),
    db.loanInstallment.count({ where: { status: 'PARTIAL' } }),
    db.loanInstallment.count({ where: { status: 'PAID', paidDate: null } }),
    db.loanInstallment.count({ where: { realPayment: { not: null } } }),
  ])
  return { vinculos11: um, pedacosN1: pedacos, statusPARTIAL: partial, pagasSemData: semData, comMarcaDoCaminhoAntigo: comRealPayment }
}

async function main() {
  const loans = await db.loan.count()
  // ⛔ REGRA 8b — zero silencioso é "banco errado", não "não tem"
  if (loans === 0) throw new Error('⛔ nenhum contrato neste banco — banco errado? abortado sem gravar')
  const ano = 2026
  console.log(`modo: ${APLICAR ? 'APLICAR (grava)' : 'SIMULAÇÃO (não grava)'} · contratos: ${loans}`)
  const antes = await contagens()
  const dreAntes = await dreDoAno(ano)
  console.log('ANTES ', JSON.stringify(antes))
  console.log(`DRE ${ano} (juros de empréstimo) ANTES — régua antiga ${dreAntes.antigo} · régua nova ${dreAntes.novo}`)

  let escritas = 0

  // ── (1) R54: 1:1 → pedaço N:1 ──────────────────────────────────────────────
  const uns = await db.loanInstallment.findMany({
    where: { reconciledTransactionId: { not: null } },
    select: {
      id: true, number: true, status: true, paidDate: true, paidTotal: true, paidInterest: true, amortization: true, openingBalance: true,
      reconciledTransactionId: true, reconciledTransaction: { select: { amount: true, date: true } },
      loan: { select: { id: true, contractNumber: true, scheduleSource: true, interestRateMonthly: true, rateType: true, installmentsPaidBefore: true } },
    },
  })
  for (const i of uns) {
    const tx = i.reconciledTransaction!
    const split = computeLinkSplit({ installment: { amortization: i.amortization, openingBalance: i.openingBalance }, rateMonthly: i.loan.interestRateMonthly, paidTotal: tx.amount })
    const tracked = await db.loanInstallment.findMany({
      where: { loanId: i.loan.id, number: { gt: i.loan.installmentsPaidBefore } }, orderBy: { number: 'asc' },
      select: { number: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true },
    })
    const agendaValida = storedScheduleValid(tracked, tracked[0]?.openingBalance ?? 0, i.loan.interestRateMonthly > 0, i.loan.rateType === 'POS')
    const grava = shouldWriteSplit({ scheduleSource: i.loan.scheduleSource, isZeroRate: i.loan.interestRateMonthly === 0, agendaValida, isPartial: split.isPartial })
    const preenche = i.paidTotal == null
    console.log(`  1:1→N:1 ${rot(i.loan, i.number)} · tx ${r2(tx.amount)} · paidTotal ${i.paidTotal ?? '∅'}${preenche ? ` → ${split.paidTotal} (split ${grava ? 'gravado' : 'a apurar'})` : ' (mantido)'}${i.paidDate ? '' : ` · paidDate ∅ → ${tx.date.toISOString().slice(0, 10)}`}`)
    if (!APLICAR) continue
    await db.$transaction(async (t) => {
      // ⛔ o trigger `loan_installment_no_double_link` recusa as duas portas juntas: solta a 1:1 PRIMEIRO
      await t.loanInstallment.update({
        where: { id: i.id },
        data: {
          reconciledTransactionId: null,
          ...(i.paidDate ? {} : { paidDate: tx.date }),
          ...(preenche ? { paidTotal: split.paidTotal, ...(grava ? { paidInterest: split.paidInterest, paidCorrection: split.paidCorrection, paidPenalty: split.paidPenalty } : {}) } : {}),
        },
      })
      await t.loanInstallmentPayment.create({ data: { installmentId: i.id, transactionId: i.reconciledTransactionId!, amount: tx.amount } })
    })
    escritas++
  }

  // ── (2) o fantasma PARTIAL ───────────────────────────────────────────────────
  const partials = await db.loanInstallment.findMany({
    where: { status: 'PARTIAL' },
    select: {
      id: true, number: true, payment: true, amortization: true, openingBalance: true, paidInterest: true,
      payments: { select: { amount: true, transaction: { select: { date: true } } } },
      loan: { select: { id: true, contractNumber: true, scheduleSource: true, interestRateMonthly: true, rateType: true, installmentsPaidBefore: true } },
    },
  })
  for (const i of partials) {
    const soma = r2(i.payments.reduce((s, p) => s + p.amount, 0))
    const fecha = soma + 0.02 >= i.payment
    const ultima = i.payments.map((p) => p.transaction.date).reduce<Date | null>((m, d) => (!m || d > m ? d : m), null)
    const split = computeLinkSplit({ installment: { amortization: i.amortization, openingBalance: i.openingBalance }, rateMonthly: i.loan.interestRateMonthly, paidTotal: soma })
    const tracked = await db.loanInstallment.findMany({
      where: { loanId: i.loan.id, number: { gt: i.loan.installmentsPaidBefore } }, orderBy: { number: 'asc' },
      select: { number: true, openingBalance: true, interest: true, amortization: true, correcao: true, payment: true, closingBalance: true },
    })
    const agendaValida = storedScheduleValid(tracked, tracked[0]?.openingBalance ?? 0, i.loan.interestRateMonthly > 0, i.loan.rateType === 'POS')
    const grava = fecha && i.paidInterest == null && shouldWriteSplit({ scheduleSource: i.loan.scheduleSource, isZeroRate: i.loan.interestRateMonthly === 0, agendaValida, isPartial: split.isPartial })
    console.log(`  PARTIAL ${rot(i.loan, i.number)} · ${i.payments.length} pedaço(s) Σ ${soma} × parcela ${r2(i.payment)} → ${fecha ? `PAID em ${ultima?.toISOString().slice(0, 10)}` : 'OPEN (parcial derivado)'}${grava ? ` · encargo apurado ${r2(split.paidInterest + split.paidCorrection)}` : ''}`)
    if (!APLICAR) continue
    await db.loanInstallment.update({
      where: { id: i.id },
      data: fecha
        ? { status: 'PAID', paidDate: ultima, paidTotal: soma, ...(grava ? { paidInterest: split.paidInterest, paidCorrection: split.paidCorrection, paidPenalty: split.paidPenalty } : {}) }
        : { status: 'OPEN', paidTotal: soma },
    })
    escritas++
  }

  // ── (3) PAID sem paidDate ────────────────────────────────────────────────────
  const semData = await db.loanInstallment.findMany({
    where: { status: 'PAID', paidDate: null },
    select: {
      id: true, number: true, reconciledTransaction: { select: { date: true } },
      payments: { select: { transaction: { select: { date: true } } } },
      loan: { select: { contractNumber: true, scheduleSource: true } },
    },
  })
  const pendentesDoDono: string[] = []
  for (const i of semData) {
    const datas = [...(i.reconciledTransaction ? [i.reconciledTransaction.date] : []), ...i.payments.map((p) => p.transaction.date)]
    if (datas.length === 0) { pendentesDoDono.push(rot(i.loan, i.number)); continue }
    const d = datas.reduce((m, x) => (x > m ? x : m))
    console.log(`  paidDate ${rot(i.loan, i.number)} ∅ → ${d.toISOString().slice(0, 10)}`)
    if (!APLICAR) continue
    await db.loanInstallment.update({ where: { id: i.id }, data: { paidDate: d } })
    escritas++
  }
  if (pendentesDoDono.length) console.log(`  ⚠️ PAGA SEM DATA E SEM TRANSAÇÃO (decisão do dono): ${pendentesDoDono.join(' · ')}`)

  // ── a cara da agenda sobrescrita pelo caminho antigo (só DECLARAR — não dá pra restaurar) ──
  const marcadas = await db.loanInstallment.findMany({
    where: { realPayment: { not: null } },
    select: { number: true, payment: true, realPayment: true, status: true, loan: { select: { contractNumber: true, scheduleSource: true } } },
  })
  const sobrescritas = marcadas.filter((m) => m.realPayment != null && Math.abs(m.payment - m.realPayment) <= 0.01)
  console.log(`  agenda com a marca do caminho antigo (realPayment gravado): ${marcadas.length} · com payment == realPayment (sobrescrita): ${sobrescritas.length}${sobrescritas.length ? ` → ${sobrescritas.map((m) => `${rot(m.loan, m.number)}[${m.status}]`).join(' · ')}` : ''}`)

  const depois = await contagens()
  const dreDepois = await dreDoAno(ano)
  console.log('DEPOIS', JSON.stringify(depois))
  console.log(`DRE ${ano} (juros de empréstimo) DEPOIS — régua nova ${dreDepois.novo} · diferença vs régua antiga de antes ${r2(dreDepois.novo - dreAntes.antigo)}`)
  console.log(`ESCRITAS: ${escritas}`)
}

main()
  // ⛔ a mensagem do Prisma pode trazer a URI com a senha: sai MASCARADA e cortada
  .catch((e: unknown) => {
    const msg = String((e as Error)?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, '<URI>').slice(0, 300)
    console.error(`⛔ falhou: ${msg}`); process.exitCode = 1
  })
  .finally(() => db.$disconnect())
