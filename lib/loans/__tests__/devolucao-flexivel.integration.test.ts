/**
 * ⭐⭐⭐ A PORTA DE DEVOLUÇÃO, CONTRA BANCO (09/10/2026) — com o contrato REAL da Arafat.
 *
 * ⚠️ **Por que integração e não teste puro:** o gesto costura três coisas que só existem no
 * banco — a transação de saída, o vínculo pela porta única e o saldo re-ancorado — e o que o
 * dono pediu pra travar (`Σ(histórico) == amortizado == principal − saldo`) **é uma afirmação
 * sobre o estado gravado**. Teste puro aprovaria uma gravação que não acontece.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  previaDaDevolucao,
  registrarDevolucao,
  DevolucaoError,
} from '../devolucao-flexivel'
import { saldoDevedorAtual } from '../saldo'
import { resumoDoFlexivel } from '../resumo-do-flexivel'
import { reAncorarContas } from '@/lib/balance/recalcular'

const CNPJ = '50607090000477'
let companyId: string
let contaId: string
let catId: string
let loanId: string
let semContaId: string
let bancarioId: string

/** a agenda nominal do contrato: 7 × 41.428,57 (a 7ª com o centavo do resto) */
const NOMINAL = 41428.57

async function montarAgenda(loan: string, inicio: number) {
  for (let n = 1; n <= 7; n++) {
    const opening = 380000 - (n - 1) * NOMINAL
    await prisma.loanInstallment.create({
      data: {
        loanId: loan,
        number: n,
        dueDate: new Date(`2026-0${n === 1 ? 9 : 9}-15T00:00:00Z`),
        openingBalance: opening,
        interest: 0,
        amortization: NOMINAL,
        correcao: 0,
        payment: NOMINAL,
        closingBalance: opening - NOMINAL,
        status: n <= inicio ? 'PAID' : 'OPEN',
      },
    })
  }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'DEVOLUCAO' } })
  companyId = c.id
  const b = await prisma.bankAccount.create({
    data: { companyId, name: 'caixa loja/cofre', accountType: 'CASH', balance: 0 },
  })
  contaId = b.id
  /**
   * ⚠️⚠️ A ABERTURA É UM LANÇAMENTO, NÃO UM `balance` DIGITADO — e isso o teste me ensinou.
   *
   * ⛔ Com `balance: 50000` cravado e nenhuma transação, o `reAncorarContas` (que DERIVA o
   * saldo, a lei de 30/09) devolve `Σ(tx)` e o valor digitado **evapora no primeiro gesto** —
   * exatamente a mina registrada no CLAUDE.md sobre criação de conta sem abertura. Fixture que
   * nasce com saldo mágico esconde a régua em vez de exercê-la.
   */
  await prisma.transaction.create({
    data: {
      bankAccountId: contaId, date: new Date('2026-05-01T12:00:00Z'), description: 'saldo de abertura',
      amount: 500000, type: 'CREDIT', status: 'RECONCILED', origin: 'MANUAL',
    },
  })
  /** ⚠️ e o saldo é DERIVADO — a porta real re-ancora, a fixture também */
  await reAncorarContas(prisma, [contaId])
  const cat = await prisma.category.create({
    data: { companyId, name: 'Amortização de Mútuo (terceiros)', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA' },
  })
  catId = cat.id

  const base = {
    companyId,
    lender: 'Arafat (arafet thalji)',
    principal: 380000,
    interestRateMonthly: 0,
    termMonths: 7,
    amortizationSystem: 'SAC',
    rateType: 'PRE',
    firstDueDate: new Date('2026-09-15T00:00:00Z'),
    disbursementDate: new Date('2026-05-02T00:00:00Z'),
    status: 'ACTIVE',
  }
  const l = await prisma.loan.create({
    data: { ...base, contractNumber: null, scheduleSource: 'FLEXIBLE', bankAccountId: contaId },
  })
  loanId = l.id
  await montarAgenda(loanId, 0)

  /** ⛔ o irmão SEM CONTA (o forno) — a porta tem que recusar */
  const sc = await prisma.loan.create({
    data: { ...base, principal: 110000, contractNumber: 'forno', scheduleSource: 'FLEXIBLE', bankAccountId: null },
  })
  semContaId = sc.id
  /** ⛔ e um BANCÁRIO — a porta é só do flexível */
  const bk = await prisma.loan.create({
    data: { ...base, contractNumber: 'Banco X 123', scheduleSource: 'IMPORTED', bankAccountId: contaId },
  })
  bancarioId = bk.id
  await montarAgenda(bancarioId, 0)
})

afterEach(async () => {
  await prisma.loanInstallmentPayment.deleteMany({ where: { installment: { loan: { companyId } } } })
  await prisma.loanInstallment.deleteMany({ where: { loan: { companyId } } })
  await prisma.loan.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccount: { companyId } } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const HOJE = new Date('2026-10-09T12:00:00Z')

describe('⭐⭐⭐ o gesto completo — cria a saída E o vínculo, num commit só', () => {
  it('⭐ os 40.000 de hoje: saída criada, vinculada à #1, saldo 380.000 → 340.000', async () => {
    const g = await registrarDevolucao(prisma, {
      companyId, loanId, valor: 40000, data: HOJE,
    })
    expect(g.criouSaida).toBe(true)
    expect(g.referencia).toBe(1)
    expect(g.valor).toBe(40000)
    expect(g.descricao).toBe('Devolução de mútuo — Arafat (1ª devolução)')

    const tx = await prisma.transaction.findUniqueOrThrow({
      where: { id: g.transactionId },
      include: { loanInstallmentPayments: { include: { installment: true } } },
    })
    expect(tx.type).toBe('DEBIT')
    expect(tx.amount).toBe(40000)
    expect(tx.bankAccountId).toBe(contaId)
    expect(tx.origin).toBe('MANUAL')
    /** ⚠️ a escada de status: conta CASH + categoria → RECONCILED, nunca na fila de classificar */
    expect(tx.status).toBe('RECONCILED')
    /** ⭐ e a CATEGORIA vem da lista de transferência — devolução não é despesa do DRE */
    expect(tx.categoryId).toBe(catId)

    /** ⭐⭐ O VÍNCULO EXISTE e passou pela porta única (N:1) */
    expect(tx.loanInstallmentPayments).toHaveLength(1)
    expect(tx.loanInstallmentPayments[0].amount).toBe(40000)

    /**
     * ⭐⭐⭐ O SPLIT DE 0% É O QUE FAZ A DEVOLUÇÃO PARCIAL CONTAR: 40.000 numa referência de
     * 41.428,57 vira `PAID` com `amortization = 40.000`. ⛔ Sem isso ela ficaria `PARTIAL` e o
     * `saldoDevedorAtual` (que soma amortização das PAGAS) **não a veria** — o saldo ficaria
     * nos 380.000 com 40 mil já devolvidos.
     */
    const inst = tx.loanInstallmentPayments[0].installment
    expect(inst.status).toBe('PAID')
    expect(inst.amortization).toBe(40000)
    expect(inst.paidInterest ?? 0).toBe(0)

    const depois = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, include: { installments: true } })
    expect(saldoDevedorAtual(depois, depois.installments)).toBe(340000)
  })

  it('⭐⭐ O GUARD DO DONO: Σ(histórico) == amortizado == principal − saldo, nas 4 devoluções', async () => {
    // as três de prod + a de hoje
    await registrarDevolucao(prisma, { companyId, loanId, valor: 40000, data: new Date('2026-07-06T12:00:00Z') })
    await registrarDevolucao(prisma, { companyId, loanId, valor: 50000, data: new Date('2026-08-04T12:00:00Z') })
    await registrarDevolucao(prisma, { companyId, loanId, valor: 50000, data: new Date('2026-09-01T12:00:00Z') })
    await registrarDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })

    const loan = await prisma.loan.findUniqueOrThrow({
      where: { id: loanId },
      include: {
        installments: {
          include: {
            reconciledTransaction: { select: { amount: true, date: true } },
            payments: { select: { amount: true, transaction: { select: { date: true } } } },
          },
        },
      },
    })
    const saldo = saldoDevedorAtual(loan, loan.installments)
    const devolucoes = loan.installments.flatMap((i) => [
      ...(i.reconciledTransaction ? [{ data: i.reconciledTransaction.date, valor: i.reconciledTransaction.amount }] : []),
      ...i.payments.flatMap((p) => (p.transaction ? [{ data: p.transaction.date, valor: p.amount }] : [])),
    ])
    const r = resumoDoFlexivel(loan.principal, saldo, devolucoes)

    /** ⭐ exatamente os números que o dono ditou */
    expect(r.devolucoes).toBe(4)
    expect(r.totalDevolvido).toBe(180000)
    expect(saldo).toBe(200000)
    expect(r.fecha, 'Σ(histórico) ≠ principal − saldo').toBe(true)

    const amortizado = loan.installments
      .filter((i) => i.status === 'PAID')
      .reduce((s, i) => s + i.amortization, 0)
    expect(Math.round(amortizado * 100) / 100, 'o amortizado tem que bater com a Σ do histórico').toBe(180000)
  })
})

describe('⭐⭐ casar com a saída que o dono já lançou — nunca duas saídas pro mesmo pagamento', () => {
  async function lancarNaMao(valor: number, data: Date, desc: string, comCategoria = true) {
    return prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: comCategoria ? catId : null, date: data,
        description: desc, amount: valor, type: 'DEBIT', status: 'RECONCILED', origin: 'MANUAL',
      },
      select: { id: true },
    })
  }

  it('⭐ a prévia ACHA a saída manual e propõe CASAR, sem criar outra', async () => {
    const manual = await lancarNaMao(40000, HOJE, 'arafat')
    const p = await previaDaDevolucao(prisma, {
      companyId, loanId, valor: 40000, data: HOJE, casarComTransactionId: manual.id,
    })
    expect(p.acao).toBe('CASAR')
    expect(p.candidatos.map((c) => c.id)).toContain(manual.id)
    expect(p.frase).toContain('nenhuma saída nova')

    const antes = await prisma.transaction.count({ where: { bankAccountId: contaId } })
    const g = await registrarDevolucao(prisma, {
      companyId, loanId, valor: 40000, data: HOJE, casarComTransactionId: manual.id,
    })
    expect(g.criouSaida).toBe(false)
    expect(g.transactionId).toBe(manual.id)
    /** ⛔⛔ NENHUMA saída nova — era o que o dono pediu pra ser impossível */
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId } })).toBe(antes)
  })

  it('⛔⛔ criar com candidata na janela é RECUSADO — e nada fica gravado', async () => {
    await lancarNaMao(40000, HOJE, 'arafat')
    const antes = await prisma.transaction.count({ where: { bankAccountId: contaId } })

    await expect(
      registrarDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE }),
    ).rejects.toThrow(DevolucaoError)

    /**
     * ⛔⛔⛔ A CICATRIZ DE ONTEM (09/10): a recusa do retalho rodava DEPOIS do `create` e deixou
     * uma ordem fantasma (531 → 532). Aqui a contabilidade de escrita é parte da asserção.
     */
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId } }), 'a recusa deixou saída órfã').toBe(antes)
    expect(await prisma.loanInstallmentPayment.count({ where: { installment: { loanId } } })).toBe(0)
  })

  it('⭐ o ESCAPE explícito deixa criar a 2ª saída — duas saídas iguais no mesmo dia existem', async () => {
    await lancarNaMao(40000, HOJE, 'outra coisa de 40 mil')
    const g = await registrarDevolucao(prisma, {
      companyId, loanId, valor: 40000, data: HOJE, criarMesmoComCandidata: true,
    })
    expect(g.criouSaida).toBe(true)
  })

  it('⚠️ saída JÁ vinculada a outra parcela NÃO é candidata — as duas portas são olhadas', async () => {
    const manual = await lancarNaMao(40000, HOJE, 'já vinculada')
    // amarra na #7 por outra via
    const i7 = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId, number: 7 } })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: i7.id, transactionId: manual.id, amount: 40000 },
    })
    const p = await previaDaDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })
    expect(p.candidatos.map((c) => c.id)).not.toContain(manual.id)
    expect(p.acao).toBe('CRIAR')
  })

  it('⚠️ fora da janela de 10 dias não é candidata — a devolução do mês anterior não se oferece', async () => {
    await lancarNaMao(40000, new Date('2026-09-01T12:00:00Z'), 'devolução de setembro')
    const p = await previaDaDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })
    expect(p.candidatos).toHaveLength(0)
  })

  it('⚠️ valor diferente não é candidata — mesmo valor é a âncora, não "parecido"', async () => {
    await lancarNaMao(39999, HOJE, 'quase')
    const p = await previaDaDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })
    expect(p.candidatos).toHaveLength(0)
  })
})

describe('⛔ as recusas, e cada uma ENSINA a saída', () => {
  it('⛔⛔ contrato BANCÁRIO: a porta não existe, e a frase manda pro «Marcar paga»', async () => {
    await expect(
      registrarDevolucao(prisma, { companyId, loanId: bancarioId, valor: 1000, data: HOJE }),
    ).rejects.toThrow(/Marcar paga/)
    /** ⚠️ 1 = a linha de abertura; o que importa é NENHUMA saída nova */
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId, type: 'DEBIT' } })).toBe(0)
  })

  it('⛔⛔ mútuo SEM CONTA recusa nomeando o conserto — e isso fecha o furo do `undefined` no `where`', async () => {
    await expect(
      registrarDevolucao(prisma, { companyId, loanId: semContaId, valor: 1000, data: HOJE }),
    ).rejects.toThrow(/conta/i)
  })

  it('⛔ valor zero ou negativo recusa, e nada grava', async () => {
    await expect(registrarDevolucao(prisma, { companyId, loanId, valor: 0, data: HOJE })).rejects.toThrow(DevolucaoError)
    await expect(registrarDevolucao(prisma, { companyId, loanId, valor: -5, data: HOJE })).rejects.toThrow(DevolucaoError)
    /** ⚠️ 1 = a linha de abertura; o que importa é NENHUMA saída nova */
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId, type: 'DEBIT' } })).toBe(0)
  })

  it('⛔ agenda sem referência aberta recusa em vez de inventar uma', async () => {
    await prisma.loanInstallment.updateMany({ where: { loanId }, data: { status: 'PAID' } })
    await expect(
      registrarDevolucao(prisma, { companyId, loanId, valor: 1000, data: HOJE }),
    ).rejects.toThrow(/referência aberta/i)
  })

  it('⛔⛔ sem categoria resolvível a prévia COBRA antes do clique, e a gravação recusa', async () => {
    // empresa sem nenhuma categoria de TRANSFERENCIA e sem devolução anterior
    await prisma.category.deleteMany({ where: { companyId } })
    const p = await previaDaDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })
    expect(p.pedeCategoria, 'a tela tem que cobrar ANTES do clique').toBe(true)
    expect(p.categoriasPossiveis).toHaveLength(0)
    await expect(
      registrarDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE }),
    ).rejects.toThrow(/categoria/i)
    /** ⚠️ 1 = a linha de abertura; o que importa é NENHUMA saída nova */
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId, type: 'DEBIT' } })).toBe(0)
  })

  it('⭐⭐ a CATEGORIA repete a decisão do dono: a mais usada nas devoluções anteriores', async () => {
    const outra = await prisma.category.create({
      data: { companyId, name: 'Mútuo entre Sócios', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA' },
    })
    // a 1ª devolução vai com a categoria "outra", escolhida à mão
    await registrarDevolucao(prisma, {
      companyId, loanId, valor: 10000, data: new Date('2026-07-06T12:00:00Z'), categoryId: outra.id,
    })
    // ⭐ a 2ª herda a decisão anterior, sem o dono repetir a escolha
    const p = await previaDaDevolucao(prisma, { companyId, loanId, valor: 20000, data: HOJE })
    expect(p.categoria?.id).toBe(outra.id)
  })
})

describe('⭐ o saldo é RE-ANCORADO no mesmo commit', () => {
  it('⭐ o saldo da conta cai o valor da devolução — derivado, nunca `increment`', async () => {
    /** ⚠️ o 1º gesto já re-ancora a conta inteira (a abertura entra na derivação) */
    await registrarDevolucao(prisma, { companyId, loanId, valor: 10000, data: new Date('2026-07-06T12:00:00Z') })
    const antes = await prisma.bankAccount.findUniqueOrThrow({ where: { id: contaId }, select: { balance: true } })
    expect(antes.balance, 'a abertura de 500.000 menos a 1ª devolução').toBe(490000)

    await registrarDevolucao(prisma, { companyId, loanId, valor: 40000, data: HOJE })
    const depois = await prisma.bankAccount.findUniqueOrThrow({ where: { id: contaId }, select: { balance: true } })
    expect(Math.round((antes.balance - depois.balance) * 100) / 100).toBe(40000)
    expect(depois.balance).toBe(450000)
  })
})
