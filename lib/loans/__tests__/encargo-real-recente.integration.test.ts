/**
 * ⭐⭐⭐ A RÉGUA QUE LÊ O BANCO — `encargoRealRecente` CONTRA POSTGRES/SQLITE (04/11/2026)
 *
 * O teto novo tem TRÊS bases e o motor (`tetoDoPagamento`) é puro: ele recebe a terceira
 * base já lida. **Esta é a única função que lê** — e até hoje ela não tinha teste nenhum.
 * O guard que existia (`bloqueio-chega-na-tela`) prova a FIAÇÃO (que a porta chama a régua
 * e passa o resultado pro motor); *fiação certa com janela errada dá o mesmo verde*. Ele
 * não distingue janela 3 de janela 10, nem `orderBy number` de `orderBy paidDate`.
 *
 * ⚠️ **Por que integração e não puro com `db` falso:** o que precisa ficar travado aqui é a
 * CONSULTA — `status:'PAID'`, `take: 3`, `orderBy number desc`. Um `db` de mentira que
 * devolve o array que eu escrevi prova a minha soma, **não a minha query**: ele aprovaria
 * `take: 10` e `status` nenhum. *A sonda tem que medir o que o banco faz, não o que eu
 * contei pra ela.*
 *
 * **O caso real (Banrisul `002100057538834`, medido em prod):** `#58` → 126,26 + 419,67 =
 * **545,93** · `#59` → 119,62 + 395,55 = **515,17**. A régua devolve 545,93 (parcela 58).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { encargoRealRecente, PAGAS_NA_JANELA } from '../encargo-real-recente'

/** ⚠️ CNPJ MEDIDO como livre no repo (o guard `cnpj-de-teste-nao-colide` cobra isso) */
const CNPJ = '50607080003366'

let loanId: string

/** os encargos REAIS medidos em prod nas duas últimas pagas do contrato */
const REAL_58 = 545.93
const REAL_59 = 515.17

type Parcela = {
  number: number
  status?: string
  paidInterest?: number | null
  paidCorrection?: number | null
  paidPenalty?: number | null
  paidDate?: Date | null
}

async function semear(parcelas: Parcela[]) {
  for (const p of parcelas) {
    await prisma.loanInstallment.create({
      data: {
        loanId,
        number: p.number,
        dueDate: new Date(`2026-01-15T00:00:00Z`),
        openingBalance: 100000,
        interest: 0,
        amortization: 1898.69,
        correcao: 0,
        payment: 1898.69,
        closingBalance: 98101.31,
        status: p.status ?? 'PAID',
        paidDate: p.paidDate ?? null,
        paidInterest: p.paidInterest ?? null,
        paidCorrection: p.paidCorrection ?? null,
        paidPenalty: p.paidPenalty ?? null,
      },
    })
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ENCARGO REAL' } })
  const b = await prisma.bankAccount.create({
    data: { companyId: c.id, name: 'banrisul', accountType: 'CHECKING', balance: 0 },
  })
  const loan = await prisma.loan.create({
    data: {
      companyId: c.id,
      bankAccountId: b.id,
      lender: 'Banrisul',
      contractNumber: '002100057538834',
      principal: 120000,
      interestRateMonthly: 0.0112,
      rateType: 'POS',
      termMonths: 72,
      disbursementDate: new Date('2021-01-15T00:00:00Z'),
      firstDueDate: new Date('2021-02-15T00:00:00Z'),
      amortizationSystem: 'SAC',
      scheduleSource: 'IMPORTED',
      installmentsPaidBefore: 0,
      status: 'ACTIVE',
    },
  })
  loanId = loan.id
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('encargoRealRecente — a terceira base do teto, lida do banco', () => {
  it('⭐ O CASO REAL: #58 545,93 e #59 515,17 → devolve 545,93 e NOMEIA a parcela 58', async () => {
    await semear([
      { number: 58, paidInterest: 126.26, paidCorrection: 419.67 },
      { number: 59, paidInterest: 119.62, paidCorrection: 395.55 },
    ])

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
  })

  it('soma os TRÊS campos (juros + correção + multa), não só o juros', async () => {
    await semear([{ number: 58, paidInterest: 100, paidCorrection: 20.5, paidPenalty: 3.25 }])

    const r = await encargoRealRecente(prisma, loanId)
    // ⛔ se a régua lesse só paidInterest, isto seria 100 — e o teto nasceria 247 mais baixo
    expect(r).toEqual({ valor: 123.75, parcela: 58 })
  })

  /**
   * ⛔⛔ O TESTE QUE DISCRIMINA A JANELA. O maior encargo do contrato (2.000,00) está na
   * parcela **55**, que é a 4ª mais recente — FORA da janela de 3. Com `take: 3` a resposta
   * é 545,93; com janela 10 (ou sem `take`) viraria 2.000,00. *Encargo cai com o saldo: a
   * parcela antiga é um teto que não vale mais.*
   */
  it(`⛔ janela = ${PAGAS_NA_JANELA}: o pico ANTIGO (#55 = 2.000) não entra — vence o 545,93 de #58`, async () => {
    await semear([
      { number: 55, paidInterest: 2000 },
      { number: 56, paidInterest: 300 },
      { number: 57, paidInterest: 310 },
      { number: 58, paidInterest: 126.26, paidCorrection: 419.67 },
      { number: 59, paidInterest: 119.62, paidCorrection: 395.55 },
    ])

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
    expect(r!.valor).toBeLessThan(2000)
  })

  /**
   * ⛔⛔ ORDEM POR NÚMERO, NUNCA POR `paidDate`. Há 180 parcelas PAID sem data de pagamento
   * em prod. Aqui as recentes (#58/#59/#60) têm `paidDate` NULO e a antiga #55 tem data de
   * ontem: `orderBy paidDate desc` colocaria #55 no topo da janela e devolveria 2.000.
   */
  it('⛔ ordena por NÚMERO: pagas sem paidDate continuam na janela; a antiga COM data fica fora', async () => {
    await semear([
      { number: 55, paidInterest: 2000, paidDate: new Date('2026-11-03T00:00:00Z') },
      { number: 58, paidInterest: 126.26, paidCorrection: 419.67, paidDate: null },
      { number: 59, paidInterest: 119.62, paidCorrection: 395.55, paidDate: null },
      { number: 60, paidInterest: 100, paidDate: null },
    ])

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
  })

  it('⛔ só PAID: parcela ABERTA com encargo gordo não vira régua', async () => {
    await semear([
      { number: 58, paidInterest: 126.26, paidCorrection: 419.67 },
      { number: 61, status: 'OPEN', paidInterest: 9000 },
      { number: 62, status: 'LATE', paidInterest: 8000 },
    ])

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
  })

  /** ⭐ *ausência ≠ zero*: sem encargo gravado a régua se cala e o teto fica o de antes */
  it('devolve null quando as pagas têm os paid* em zero/nulo (contrato sem histórico)', async () => {
    await semear([
      { number: 58, paidInterest: 0, paidCorrection: 0, paidPenalty: 0 },
      { number: 59, paidInterest: null, paidCorrection: null, paidPenalty: null },
    ])

    expect(await encargoRealRecente(prisma, loanId)).toBeNull()
  })

  it('devolve null em contrato sem nenhuma parcela paga', async () => {
    await semear([{ number: 1, status: 'OPEN', paidInterest: 500 }])

    expect(await encargoRealRecente(prisma, loanId)).toBeNull()
  })

  /** ⛔ multi-tenant: a régua é POR CONTRATO — o encargo do vizinho não empresta teto */
  it('⛔ não enxerga parcela de OUTRO contrato', async () => {
    await semear([{ number: 58, paidInterest: 126.26, paidCorrection: 419.67 }])

    const outro = await prisma.loan.findFirstOrThrow({ where: { id: loanId } })
    const vizinho = await prisma.loan.create({
      data: {
        companyId: outro.companyId,
        bankAccountId: outro.bankAccountId,
        lender: 'Banrisul',
        contractNumber: '002100057538835',
        principal: 50000,
        interestRateMonthly: 0.02,
        rateType: 'POS',
        termMonths: 24,
        disbursementDate: new Date('2024-01-15T00:00:00Z'),
        firstDueDate: new Date('2024-02-15T00:00:00Z'),
        amortizationSystem: 'SAC',
        scheduleSource: 'IMPORTED',
        installmentsPaidBefore: 0,
        status: 'ACTIVE',
      },
    })
    await prisma.loanInstallment.create({
      data: {
        loanId: vizinho.id,
        number: 59,
        dueDate: new Date('2026-02-15T00:00:00Z'),
        openingBalance: 1000,
        interest: 0,
        amortization: 100,
        correcao: 0,
        payment: 100,
        closingBalance: 900,
        status: 'PAID',
        paidInterest: 7777,
      },
    })

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
    expect(await encargoRealRecente(prisma, vizinho.id)).toEqual({ valor: 7777, parcela: 59 })
  })

  /** ⭐ a maior das 3 vence, mesmo não sendo a mais recente */
  it('devolve a MAIOR da janela, não a última', async () => {
    await semear([
      { number: 58, paidInterest: 126.26, paidCorrection: 419.67 },
      { number: 59, paidInterest: 119.62, paidCorrection: 395.55 },
      { number: 60, paidInterest: 50, paidCorrection: 50 },
    ])

    const r = await encargoRealRecente(prisma, loanId)
    expect(r).toEqual({ valor: REAL_58, parcela: 58 })
    expect(REAL_58).toBeGreaterThan(REAL_59)
  })
})
