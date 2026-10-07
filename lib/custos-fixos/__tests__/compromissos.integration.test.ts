/**
 * ⭐⭐ A PRATELEIRA 📅 COMPROMISSOS, CONTRA O BANCO (07/10/2026).
 *
 * ⛔⛔ **O QUE SÓ SE PROVA COM BANCO:** que a parcela do mês sai do contrato que o sistema já
 * tem, que o selo vem do `estadoDaParcela` (e não do `statusDaConta`, que chamaria o mútuo
 * flexível de atrasado), que a fatura NÃO IMPORTADA é estado próprio em vez de R$ 0,00, e que
 * **a Σ da prateleira é exatamente a Σ das linhas que contam** — o invariante do dono.
 *
 * ⚠️ CNPJ PRÓPRIO: a suíte roda os arquivos em PARALELO contra o mesmo banco, e dois testes
 * apagando a MESMA empresa no setup derrubam um ao outro por FK (foi o que mordeu em 06/10).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerCompromissos } from '../compromissos'

const CNPJ = '70707070707070'
const MES = '2026-09'
/**
 * ⚠️⚠️ **O MÊS DO CENÁRIO É SETEMBRO, e isso não é detalhe: o guard da casa pegou este
 * arquivo.** Eu tinha escrito `AGORA = 2026-10-20` achando que era passado — é FUTURO (hoje é
 * 07/10), e data fixa no futuro *"não é futuro, é uma data que o calendário alcança"* (a
 * REGRA de 01/09). Um mês INTEIRAMENTE no passado nunca apodrece.
 */
const AGORA = new Date('2026-09-20T12:00:00Z')

let companyId = ''
let contaId = ''

const dia = (d: number) => new Date(Date.UTC(2026, 8, d))

async function criarContrato(opts: {
  lender: string
  contractNumber: string
  rateType: 'PRE' | 'POS'
  scheduleSource: 'IMPORTED' | 'FLEXIBLE'
  parcelas: { number: number; dia: number; payment: number; interest: number; status?: string }[]
}) {
  const l = await prisma.loan.create({
    data: {
      companyId,
      bankAccountId: contaId,
      lender: opts.lender,
      contractNumber: opts.contractNumber,
      principal: 100_000,
      interestRateMonthly: 0.019,
      termMonths: opts.parcelas.length,
      amortizationSystem: 'PRICE',
      firstDueDate: dia(opts.parcelas[0].dia),
      disbursementDate: new Date(Date.UTC(2026, 0, 1)),
      status: 'ACTIVE',
      rateType: opts.rateType,
      scheduleSource: opts.scheduleSource,
    } as never,
  })
  for (const p of opts.parcelas) {
    await prisma.loanInstallment.create({
      data: {
        loanId: l.id,
        number: p.number,
        dueDate: dia(p.dia),
        openingBalance: 100_000,
        interest: p.interest,
        amortization: p.payment - p.interest,
        payment: p.payment,
        closingBalance: 100_000 - (p.payment - p.interest),
        status: p.status ?? 'OPEN',
      } as never,
    })
  }
  return l
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'COMPROMISSOS DO MES' } })
  companyId = c.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: 'conta', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
  })
  contaId = conta.id
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ (a) PARCELAS DE EMPRÉSTIMO — uma linha por contrato, do contrato que já existe', () => {
  it('⭐ a parcela que vence no mês aparece, com o dia e "faltam N parcelas (termina MM/AAAA)"', async () => {
    await criarContrato({
      lender: 'Banrisul',
      contractNumber: '002100064956967',
      rateType: 'PRE',
      scheduleSource: 'IMPORTED',
      parcelas: [
        { number: 1, dia: 11, payment: 4_092.02, interest: 500 },
        { number: 2, dia: 11, payment: 4_092.02, interest: 500 },
      ],
    })
    // ⚠️ a 2ª parcela é de NOVEMBRO pra a janela recortar de verdade
    await prisma.loanInstallment.updateMany({
      where: { loan: { companyId }, number: 2 },
      data: { dueDate: new Date(Date.UTC(2026, 9, 11)) },
    })

    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas).toHaveLength(1)
    const p = r.parcelas[0]
    expect(p.contrato).toBe('Banrisul 002100064956967')
    expect(p.diaDoVencimento).toBe(11)
    expect(p.faltam).toContain('faltam 2')
    expect(p.faltam).toContain('termina 10/2026')
    expect(p.valor).toBeCloseTo(4_092.02, 2)
    // ⭐ PRE: a agenda é FATO, não previsão
    expect(p.valorEhPrevisto).toBe(false)
    expect(p.contaNaSoma).toBe(true)
    expect(r.somaParcelas).toBeCloseTo(4_092.02, 2)
  })

  it('⭐ parcela PAGA mostra o que REALMENTE saiu, não o nominal da agenda', async () => {
    const l = await criarContrato({
      lender: 'Sicredi',
      contractNumber: 'C41022227-1',
      rateType: 'POS',
      scheduleSource: 'IMPORTED',
      parcelas: [{ number: 1, dia: 15, payment: 4_385.96, interest: 0, status: 'PAID' }],
    })
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, date: dia(15), description: 'LIQUIDACAO DE PARCELA',
        amount: 6_903.45, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const i = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId: l.id, number: 1 } })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: i.id, transactionId: tx.id, amount: 6_903.45 } as never,
    })

    const r = await lerCompromissos(companyId, MES, AGORA)
    const p = r.parcelas[0]
    expect(p.estado).toBe('PAGA')
    // ⛔ 6.903,45 (o extrato), NUNCA 4.385,96 (a agenda amort-only do POS)
    expect(p.valor).toBeCloseTo(6_903.45, 2)
    expect(r.somaParcelas).toBeCloseTo(6_903.45, 2)
  })

  /**
   * ⚠️⚠️ **ESTE TESTE NASCEU ERRADO E O CÓDIGO ME CORRIGIU.** Eu esperava que a PRÓXIMA parcela
   * POS sem base casada caísse no nominal "marcado como previsto"; ela cai em **a apurar**, e
   * está certo — é a régua do `forecastProxima` desde 14/08 (*"sem casada → a apurar, nunca
   * inventa"*), a MESMA que a carteira de empréstimos usa. Mostrar 7.093,19 ali seria prometer
   * um débito 36% menor que o real (o C41022227 saiu a 6.903,45 contra 4.385,96 agendados).
   *
   * ⭐ E o ramo do nominal-marcado existe pra a parcela que **NÃO é a próxima** — a de mais pra
   * frente que também cai no mês olhado. Os dois estão aqui, no mesmo contrato.
   */
  it('⛔ POS: a PRÓXIMA sem base casada é "a apurar"; a de depois é nominal MARCADO', async () => {
    await criarContrato({
      lender: 'Caixa',
      contractNumber: '1827478',
      rateType: 'POS',
      scheduleSource: 'IMPORTED',
      parcelas: [
        { number: 1, dia: 10, payment: 7_093.19, interest: 0 },
        { number: 2, dia: 24, payment: 7_093.19, interest: 0 },
      ],
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas).toHaveLength(2)

    const proxima = r.parcelas.find((x) => x.numero === 1)!
    expect(proxima.valor, 'a apurar NUNCA vira R$ 0,00').toBeNull()
    expect(proxima.valorPorque).toContain('só se conhece no vencimento')
    expect(proxima.contaNaSoma, 'sem valor, não entra na Σ').toBe(false)

    const depois = r.parcelas.find((x) => x.numero === 2)!
    expect(depois.valor).toBeCloseTo(7_093.19, 2)
    expect(depois.valorEhPrevisto, 'o ~ diz que o juro ainda não nasceu').toBe(true)
    expect(depois.valorPorque).toContain('juro deste mês nasce no vencimento')

    // ⭐ e a Σ conta SÓ a que tem valor — o "a apurar" fica fora, contado e explicado
    expect(r.somaParcelas).toBeCloseTo(7_093.19, 2)
    expect(r.foraDaSoma.porque.join(' ')).toContain('a apurar')
  })

  it('⛔⛔ o SELO vem do `estadoDaParcela`: o mútuo FLEXIBLE NUNCA é "atrasado"', async () => {
    await criarContrato({
      lender: 'Arafat (arafet thalji)',
      contractNumber: 'MUTUO',
      rateType: 'PRE',
      scheduleSource: 'FLEXIBLE',
      // ⚠️ vencimento no dia 15 e "hoje" é 20 — o `statusDaConta` diria VENCIDA
      parcelas: [{ number: 1, dia: 15, payment: 41_428.57, interest: 0 }],
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    const p = r.parcelas[0]
    expect(p.flexible).toBe(true)
    expect(p.estado).not.toBe('ATRASADA')
    expect(p.selo.toLowerCase()).not.toContain('atrasad')
  })

  it('⛔⛔ FLEXIBLE não-paga FICA FORA da Σ — a prateleira promete caixa que CERTAMENTE sai', async () => {
    await criarContrato({
      lender: 'Arafat (arafet thalji)',
      contractNumber: 'MUTUO',
      rateType: 'PRE',
      scheduleSource: 'FLEXIBLE',
      parcelas: [{ number: 1, dia: 15, payment: 41_428.57, interest: 0 }],
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas).toHaveLength(1)
    expect(r.parcelas[0].contaNaSoma, 'a devolução é conforme o caixa').toBe(false)
    expect(r.somaParcelas).toBe(0)
    // ⚠️ e a linha NÃO SOME — ela aparece, e o porquê é dito
    expect(r.foraDaSoma.n).toBeGreaterThan(0)
    expect(r.foraDaSoma.porque.join(' ')).toContain('flexível')
  })

  it('⭐ FLEXIBLE PAGA conta — aí não é previsão, é fato (o dinheiro saiu)', async () => {
    const l = await criarContrato({
      lender: 'Arafat (arafet thalji)',
      contractNumber: 'MUTUO',
      rateType: 'PRE',
      scheduleSource: 'FLEXIBLE',
      parcelas: [{ number: 1, dia: 15, payment: 41_428.57, interest: 0, status: 'PAID' }],
    })
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, date: dia(15), description: 'devolucao mutuo',
        amount: 41_428.57, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const i = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId: l.id } })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: i.id, transactionId: tx.id, amount: 41_428.57 } as never,
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas[0].estado).toBe('PAGA')
    expect(r.parcelas[0].contaNaSoma).toBe(true)
    expect(r.somaParcelas).toBeCloseTo(41_428.57, 2)
  })

  it('⛔ contrato ENCERRADO não entra — compromisso é do que está vivo', async () => {
    const l = await criarContrato({
      lender: 'Banrisul',
      contractNumber: 'MORTO',
      rateType: 'PRE',
      scheduleSource: 'IMPORTED',
      parcelas: [{ number: 1, dia: 11, payment: 1_000, interest: 100 }],
    })
    await prisma.loan.update({ where: { id: l.id }, data: { status: 'PAID' } as never })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas).toHaveLength(0)
  })
})

describe('⭐ (b) FATURA DO CARTÃO — e o "não importada" é estado PRÓPRIO', () => {
  async function cartao(nome: string, dueDay: number, closingDay: number) {
    return prisma.businessCreditCard.create({
      data: { companyId, name: nome, lastDigits: '0115', closingDay, dueDay, isActive: true, creditLimit: 10_000 } as never,
    })
  }

  it('⭐ a fatura do mês soma compras − estornos e diz quantas compras tem', async () => {
    const c = await cartao('Carter banrisul', 15, 5)
    for (const v of [100, 200, 50]) {
      await prisma.transaction.create({
        data: {
          businessCreditCardId: c.id, invoiceMonth: MES, isCardPayment: false,
          date: dia(2), description: 'compra', amount: v, type: 'DEBIT',
          lifecycle: 'EFFECTED', status: 'RECONCILED',
        } as never,
      })
    }
    await prisma.transaction.create({
      data: {
        businessCreditCardId: c.id, invoiceMonth: MES, isCardPayment: false,
        date: dia(3), description: 'estorno', amount: 30, type: 'CREDIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })

    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.faturas).toHaveLength(1)
    const f = r.faturas[0]
    expect(f.compras).toBeCloseTo(350, 2)
    expect(f.estornos).toBeCloseTo(30, 2)
    expect(f.net).toBeCloseTo(320, 2)
    expect(f.nCompras).toBe(4)
    expect(f.diaDoVencimento).toBe(15)
    expect(r.somaFaturas).toBeCloseTo(320, 2)
  })

  it('⛔⛔ fatura NÃO IMPORTADA é "a apurar", NUNCA R$ 0,00 — e fica fora da Σ', async () => {
    await cartao('banco caixa', 12, 26)
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.faturas).toHaveLength(1)
    const f = r.faturas[0]
    expect(f.naoImportada).toBe(true)
    expect(f.net, 'zero diria "este mês o cartão não custou nada"').toBeNull()
    expect(f.estado).toBe('NAO_IMPORTADA')
    expect(f.selo).toContain('não importada')
    expect(f.contaNaSoma).toBe(false)
    expect(r.somaFaturas).toBe(0)
    expect(r.foraDaSoma.porque.join(' ')).toContain('não importada')
  })

  it('⭐ fatura com pagamento vinculado sai PAGA — pelo VÍNCULO, nunca por status gravado', async () => {
    const c = await cartao('mercado pago', 20, 15)
    await prisma.transaction.create({
      data: {
        businessCreditCardId: c.id, invoiceMonth: MES, isCardPayment: false,
        date: dia(2), description: 'compra', amount: 2_900.34, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, businessCreditCardId: c.id, paidInvoiceMonth: MES,
        isCardPayment: true, date: dia(19), description: 'PIX MERCADO PAGO',
        amount: 2_900.34, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    const f = r.faturas[0]
    expect(f.pago?.valor).toBeCloseTo(2_900.34, 2)
    expect(f.estado).toBe('PAGA')
    // ⭐ e ela CONTINUA contando: o dinheiro saiu neste mês
    expect(f.contaNaSoma).toBe(true)
  })

  it('⛔ cartão INATIVO não entra na prateleira', async () => {
    const c = await cartao('morto', 10, 5)
    await prisma.businessCreditCard.update({ where: { id: c.id }, data: { isActive: false } })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.faturas).toHaveLength(0)
  })
})

describe('⛔⛔ O INVARIANTE DO DONO: Σ(linhas que contam) == Σ da prateleira', () => {
  it('⭐ parcelas + faturas, com linha fora da soma no meio — a conta fecha ao centavo', async () => {
    await criarContrato({
      lender: 'Banrisul',
      contractNumber: 'A',
      rateType: 'PRE',
      scheduleSource: 'IMPORTED',
      parcelas: [{ number: 1, dia: 26, payment: 2_325.59, interest: 200 }],
    })
    // ⚠️ o FLEXIBLE entra na LISTA e NÃO na soma — é o caso que quebra a conta ingênua
    await criarContrato({
      lender: 'Arafat (arafet thalji)',
      contractNumber: 'MUTUO',
      rateType: 'PRE',
      scheduleSource: 'FLEXIBLE',
      parcelas: [{ number: 1, dia: 15, payment: 41_428.57, interest: 0 }],
    })
    const c1 = await prisma.businessCreditCard.create({
      data: { companyId, name: 'com fatura', closingDay: 5, dueDay: 15, isActive: true, creditLimit: 10_000 } as never,
    })
    await prisma.transaction.create({
      data: {
        businessCreditCardId: c1.id, invoiceMonth: MES, isCardPayment: false,
        date: dia(2), description: 'compra', amount: 1_000, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    // ⚠️ e um cartão SEM fatura importada, que também fica fora
    await prisma.businessCreditCard.create({
      data: { companyId, name: 'sem fatura', closingDay: 26, dueDay: 12, isActive: true, creditLimit: 10_000 } as never,
    })

    const r = await lerCompromissos(companyId, MES, AGORA)

    const somaDasLinhasDeParcela = r.parcelas
      .filter((p) => p.contaNaSoma)
      .reduce((s, p) => s + (p.valor ?? 0), 0)
    const somaDasLinhasDeFatura = r.faturas
      .filter((f) => f.contaNaSoma)
      .reduce((s, f) => s + (f.net ?? 0), 0)

    expect(somaDasLinhasDeParcela).toBeCloseTo(r.somaParcelas, 2)
    expect(somaDasLinhasDeFatura).toBeCloseTo(r.somaFaturas, 2)
    expect(r.total).toBeCloseTo(r.somaParcelas + r.somaFaturas, 2)
    expect(r.total).toBeCloseTo(2_325.59 + 1_000, 2)
    // ⭐ as duas linhas fora da soma estão CONTADAS e EXPLICADAS
    expect(r.foraDaSoma.n).toBe(2)
    expect(r.parcelas).toHaveLength(2)
    expect(r.faturas).toHaveLength(2)
  })

  it('⚠️ mês sem nada: Σ zero e a lista vazia — nunca "a apurar" sobre um fato conhecido', async () => {
    const r = await lerCompromissos(companyId, '2026-06', AGORA)
    expect(r.parcelas).toHaveLength(0)
    expect(r.total).toBe(0)
  })
})

describe('⭐⭐ A CONDIÇÃO DA DUPLA CONTAGEM — medida, não suposta', () => {
  it('⚠️ sem transação de parcela com categoria do BANCO, a frase NÃO aparece', async () => {
    await criarContrato({
      lender: 'Banrisul',
      contractNumber: 'A',
      rateType: 'PRE',
      scheduleSource: 'IMPORTED',
      parcelas: [{ number: 1, dia: 26, payment: 1_000, interest: 100 }],
    })
    const cat = await prisma.category.create({
      data: { companyId, name: 'Juros sobre Empréstimos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
    })
    const r = await lerCompromissos(companyId, MES, AGORA, undefined, [cat.id])
    expect(r.jurosJaNoBanco, 'frase sobre o que não acontece é ruído').toBeNull()
  })

  it('⭐ COM a transação da parcela carregando categoria do BANCO, a tela DIZ em 1 linha', async () => {
    const l = await criarContrato({
      lender: 'Banrisul',
      contractNumber: 'A',
      rateType: 'PRE',
      scheduleSource: 'IMPORTED',
      parcelas: [{ number: 1, dia: 26, payment: 1_000, interest: 100 }],
    })
    const cat = await prisma.category.create({
      data: { companyId, name: 'Juros sobre Empréstimos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
    })
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: cat.id, date: dia(26), description: 'parcela',
        amount: 1_000, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const i = await prisma.loanInstallment.findFirstOrThrow({ where: { loanId: l.id } })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: i.id, transactionId: tx.id, amount: 1_000 } as never,
    })

    const r = await lerCompromissos(companyId, MES, AGORA, undefined, [cat.id])
    expect(r.jurosJaNoBanco).toContain('prateleira do banco')
  })
})
