// Sprint Empréstimos 4-Sicredi — cadastra os 4 contratos Sicredi da Cacula.
// Idempotente (skip por contractNumber). Modo EM_ANDAMENTO em todos
// (mid-life): NÃO cria transação de liberação → ZERO impacto em saldo/DRE.
//
// IMPORTANTE: pra contratos POS-fixados (BNDES TFB, PRONAMPE SELIC, GIRO SELIC),
// as parcelas futuras ficam isEstimate=true. Quando o user conciliar com OFX
// no futuro, valor real substitui a estimativa.

import { PrismaClient } from '@prisma/client'
import { generateMidLifeSchedule } from '../lib/loans/mid-life-schedule'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'
const prisma = new PrismaClient()

interface Contrato {
  contractNumber: string
  lender: string
  produto: string
  dataContratacao: string
  principal: number
  termMonths: number
  vencimentoFinal: string
  saldoDevedor: number
  taxaAnual: number | null
  taxaMensal: number | null
  rateType: 'PRE' | 'POS'
  indexer: 'CDI' | 'SELIC' | 'IPCA' | null
  installmentsPaidBefore: number
  futureCount: number
  startNumber: number
  firstDueDate: string
  fixedPayment: number
  system: 'PRICE' | 'SAC'
}

const CONTRATOS: Contrato[] = [
  {
    contractNumber: 'C41022227-1',
    lender: 'Sicredi',
    produto: 'BNDES Peq/Médias',
    dataContratacao: '2024-07-23',
    principal: 250_000,
    termMonths: 58,
    vencimentoFinal: '2029-07-15',
    saldoDevedor: 162_280.80,
    taxaAnual: 0.2272, // 22,72% a.a. POS-FIXADA(TFB)
    taxaMensal: null,
    rateType: 'POS',
    indexer: null, // TFB não é CDI/SELIC/IPCA padrão — deixar null mas marca como POS
    installmentsPaidBefore: 21,
    futureCount: 37,
    startNumber: 22,
    firstDueDate: '2026-07-15',
    fixedPayment: 4_385.96,
    system: 'PRICE',
  },
  {
    contractNumber: 'C41022570-0',
    lender: 'Sicredi',
    produto: 'PRONAMPE Solidário RS',
    dataContratacao: '2024-08-15',
    principal: 150_000,
    termMonths: 36,
    vencimentoFinal: '2028-07-15',
    saldoDevedor: 104_166.72,
    taxaAnual: 0.06, // 6% a.a. POS(SELIC)
    taxaMensal: null,
    rateType: 'POS',
    indexer: 'SELIC',
    installmentsPaidBefore: 11,
    futureCount: 25,
    startNumber: 12,
    firstDueDate: '2026-07-15',
    fixedPayment: 4_166.66,
    system: 'PRICE',
  },
  {
    contractNumber: 'C41033828-8',
    lender: 'Sicredi',
    produto: 'Veículos e Utilitários',
    dataContratacao: '2024-11-26',
    principal: 200_515,
    termMonths: 24,
    vencimentoFinal: '2026-11-25',
    saldoDevedor: 61_406.10,
    taxaAnual: null,
    taxaMensal: 0.017011, // 1,7011% a.m. PRICE PRE-FIXADA
    rateType: 'PRE',
    indexer: null,
    installmentsPaidBefore: 18,
    futureCount: 6,
    startNumber: 19,
    firstDueDate: '2026-07-25',
    fixedPayment: 10_234.35,
    system: 'PRICE',
  },
  {
    contractNumber: 'C61021346-2',
    lender: 'Sicredi',
    produto: 'GIRO PRONAMPE',
    dataContratacao: '2026-06-10',
    principal: 100_000,
    termMonths: 36,
    vencimentoFinal: '2029-06-10',
    saldoDevedor: 100_000,
    taxaAnual: 0.06,
    taxaMensal: null,
    rateType: 'POS',
    indexer: 'SELIC',
    installmentsPaidBefore: 0,
    futureCount: 36,
    startNumber: 1,
    firstDueDate: '2026-07-10',
    fixedPayment: 2_777.77,
    system: 'PRICE',
  },
]

function taxaMensalDe(c: Contrato): number {
  if (c.taxaMensal != null) return c.taxaMensal
  if (c.taxaAnual != null) return Math.pow(1 + c.taxaAnual, 1 / 12) - 1
  throw new Error(`Contrato ${c.contractNumber} sem taxa`)
}

async function main() {
  console.log('━'.repeat(80))
  console.log('Cadastro dos 4 contratos Sicredi da Cacula (EM_ANDAMENTO)')
  console.log('━'.repeat(80))

  // ─── Baseline ───
  const saldosAntes = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
    orderBy: { name: 'asc' },
  })
  console.log('\n━━ Saldos LEDGERBAL ANTES ━━')
  for (const s of saldosAntes) {
    console.log(`  ${s.name.padEnd(15)} balance=R$ ${s.balance.toFixed(2).padStart(12)} ledger=R$ ${(s.ledgerBal ?? 0).toFixed(2).padStart(12)} Δ=${(s.balance - (s.ledgerBal ?? 0)).toFixed(2)}`)
  }

  const loansAntes = await prisma.loan.count({ where: { companyId: CACULA } })
  console.log(`  Loans existentes: ${loansAntes}`)

  // ─── Cadastrar cada contrato ───
  const criados: Array<{ contract: string; loanId: string; installments: number }> = []
  const skipped: string[] = []

  for (const c of CONTRATOS) {
    console.log(`\n━━ ${c.contractNumber} ${c.produto} ━━`)

    // Idempotência: pula se já existe
    const existing = await prisma.loan.findFirst({
      where: { companyId: CACULA, contractNumber: c.contractNumber },
      select: { id: true, lender: true, outstandingBalanceInitial: true },
    })
    if (existing) {
      console.log(`  ⚠ Já existe (id=${existing.id}) — SKIP`)
      skipped.push(c.contractNumber)
      continue
    }

    const rateMonthly = taxaMensalDe(c)
    console.log(`  Saldo devedor: R$ ${c.saldoDevedor.toFixed(2)} | Taxa mensal: ${(rateMonthly * 100).toFixed(4)}% | ${c.rateType}${c.indexer ? ` ${c.indexer}` : ''}`)

    // Gera schedule mid-life
    const overridesMap = new Map<number, number>()
    for (let i = 0; i < c.futureCount; i++) {
      overridesMap.set(c.startNumber + i, c.fixedPayment)
    }

    const schedule = generateMidLifeSchedule({
      outstandingBalance: c.saldoDevedor,
      rateMonthly,
      futureCount: c.futureCount,
      startNumber: c.startNumber,
      firstDueDate: new Date(`${c.firstDueDate}T00:00:00.000Z`),
      system: c.system,
      isPostFixed: c.rateType === 'POS',
      estimatedCorrectionMonthly: 0,
      paymentOverrides: overridesMap,
      fixedPayment: c.fixedPayment,
    })

    console.log(`  Schedule: ${schedule.length} parcelas futuras (numero ${schedule[0].number} a ${schedule[schedule.length - 1].number})`)
    console.log(`  Próxima parcela: ${schedule[0].dueDate.toISOString().slice(0, 10)} R$ ${schedule[0].payment.toFixed(2)} (principal R$ ${schedule[0].amortization.toFixed(2)} + juros R$ ${schedule[0].interest.toFixed(2)}${schedule[0].correcao !== 0 ? ` + correção R$ ${schedule[0].correcao.toFixed(2)}` : ''})`)

    // Cria Loan + Installments futuros
    const loan = await prisma.loan.create({
      data: {
        companyId: CACULA,
        bankAccountId: SICREDI,
        lender: c.lender,
        contractNumber: c.contractNumber,
        // Princípio: passivo = saldo atual, não principal original
        principal: c.saldoDevedor,
        outstandingBalanceInitial: c.saldoDevedor,
        interestRateMonthly: rateMonthly,
        termMonths: c.termMonths,
        amortizationSystem: c.system,
        firstDueDate: new Date(`${c.firstDueDate}T00:00:00.000Z`),
        iof: 0,
        disbursementDate: new Date(`${c.dataContratacao}T00:00:00.000Z`),
        rateType: c.rateType,
        indexer: c.indexer,
        // ANTI-DUPLICAÇÃO: disbursementTransactionId fica null. Yussef pode
        // vincular depois manualmente na UI se quiser tirar a liberação do
        // DRE. Cadastro não cria CREDIT no saldo.
        installments: {
          create: schedule.map((r) => ({
            number: r.number,
            dueDate: r.dueDate,
            openingBalance: r.openingBalance,
            interest: r.interest,
            amortization: r.amortization,
            payment: r.payment,
            closingBalance: r.closingBalance,
            isEstimate: r.isEstimate,
            correcao: r.correcao,
            status: 'OPEN',
          })),
        },
      },
      include: { installments: { select: { id: true } } },
    })
    console.log(`  ✅ Criado: loan.id=${loan.id} · installments=${loan.installments.length}`)
    criados.push({ contract: c.contractNumber, loanId: loan.id, installments: loan.installments.length })
  }

  // ─── Validar ───
  console.log('\n' + '━'.repeat(80))
  console.log('VALIDAÇÃO PÓS-CADASTRO')
  console.log('━'.repeat(80))

  const saldosDepois = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
    orderBy: { name: 'asc' },
  })
  console.log('\n━━ Saldos LEDGERBAL DEPOIS ━━')
  let saldosOk = true
  for (let i = 0; i < saldosDepois.length; i++) {
    const a = saldosAntes[i]
    const d = saldosDepois[i]
    const deltaBalance = d.balance - a.balance
    const deltaLedger = d.balance - (d.ledgerBal ?? 0)
    if (Math.abs(deltaBalance) > 0.01) saldosOk = false
    console.log(`  ${d.name.padEnd(15)} balance=R$ ${d.balance.toFixed(2).padStart(12)} Δantes=R$ ${deltaBalance.toFixed(2)} (esperado 0) | Δledger=R$ ${deltaLedger.toFixed(2)}`)
  }
  console.log(`\n  ${saldosOk ? '✅' : '🚨'} Saldos balance NÃO mudaram (cadastro não cria CREDIT)`)

  const loansFinal = await prisma.loan.findMany({
    where: { companyId: CACULA, lender: 'Sicredi' },
    select: {
      contractNumber: true,
      outstandingBalanceInitial: true,
      installments: { select: { status: true, payment: true } },
    },
    orderBy: { contractNumber: 'asc' },
  })
  let totalSaldoDevedor = 0
  console.log('\n━━ 4 contratos Sicredi cadastrados ━━')
  for (const l of loansFinal) {
    const totalParcelas = l.installments.length
    const openCount = l.installments.filter((i) => i.status === 'OPEN').length
    totalSaldoDevedor += l.outstandingBalanceInitial ?? 0
    console.log(`  ${l.contractNumber} | saldo R$ ${(l.outstandingBalanceInitial ?? 0).toFixed(2).padStart(11)} | parcelas futuras: ${openCount}/${totalParcelas}`)
  }
  console.log(`\n  Total saldo devedor: R$ ${totalSaldoDevedor.toFixed(2)}`)
  console.log(`  Esperado PDF:         R$ 427853.62`)
  console.log(`  ${Math.abs(totalSaldoDevedor - 427853.62) < 0.01 ? '✅' : '🚨'} Bate com PDF (Δ R$ ${(totalSaldoDevedor - 427853.62).toFixed(2)})`)

  console.log(`\n━━ Resumo ━━`)
  console.log(`  Criados: ${criados.length}`)
  console.log(`  Skipped (já existiam): ${skipped.length}`)
  if (skipped.length > 0) console.log(`  Skipped: ${skipped.join(', ')}`)

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error('🚨', e); process.exit(1) })
