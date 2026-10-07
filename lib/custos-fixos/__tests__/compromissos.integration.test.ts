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

  /**
   * ⚠️ TÍTULO AJUSTADO EM 07/10: o selo do FLEXIBLE passou a vir da `referenciaFlexivelDoMes`
   * (a lei do caixa do mês), não do `estadoDaParcela`. **A pergunta do teste não mudou** — o
   * mútuo NUNCA é "atrasado" —, mudou quem a responde. O bancário segue no `estadoDaParcela`,
   * e isso tem contrafactual próprio no fim do arquivo.
   */
  it('⛔⛔ o mútuo FLEXIBLE NUNCA é "atrasado", nem com o vencimento no passado', async () => {
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

  /**
   * ⚠️⚠️ **TESTE INVERTIDO EM 07/10 COM O MOTIVO ESCRITO, não apagado.** Ele afirmava
   * *"FLEXIBLE não-paga FICA FORA da Σ — a prateleira promete caixa que CERTAMENTE sai"*.
   *
   * **A premissa caiu no dado:** eu supus *"um pagamento que o dono ainda não decidiu fazer"*,
   * e ele devolveu em TRÊS meses seguidos (jul 40k · ago 50k · set 50k). Ordem dele:
   * *"eu devolvo todo mês, esse caixa certamente sai; tela de compromissos que esconde 41 mil
   * me faz afundar sorrindo"*.
   *
   * ⭐ **A metade CERTA do teste velho continua travada:** a linha NÃO SOME e o porquê é DITO
   * — o que mudou é que ela deixou de sair da soma pra sair com a marca `~referência`.
   */
  it('⭐⭐ FLEXIBLE não-paga CONTA na Σ pelo NOMINAL, marcada ~referência (07/10)', async () => {
    await criarContrato({
      lender: 'Arafat (arafet thalji)',
      contractNumber: 'MUTUO',
      rateType: 'PRE',
      scheduleSource: 'FLEXIBLE',
      parcelas: [{ number: 1, dia: 15, payment: 41_428.57, interest: 0 }],
    })
    const r = await lerCompromissos(companyId, MES, AGORA)
    expect(r.parcelas).toHaveLength(1)
    const p = r.parcelas[0]
    expect(p.contaNaSoma, 'o dono devolve todo mês — esse caixa sai').toBe(true)
    expect(p.valor).toBeCloseTo(41_428.57, 2)
    expect(r.somaParcelas).toBeCloseTo(41_428.57, 2)
    // ⭐ e ela NÃO se passa por fato: a tela marca `~`
    expect(p.valorEhPrevisto).toBe(true)
    expect(p.selo).toContain('~referência flexível')
    // ⚠️ o único motivo de ficar fora da Σ voltou a ser UM: valor a apurar
    expect(r.foraDaSoma.n).toBe(0)
    // ⭐ a linha-mitigação DIZ por que a referência do mês não está paga
    expect(p.avisoFlexivel).toContain('setembro')
    expect(p.avisoFlexivel).toContain('ainda não teve devolução')
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
    /**
     * ⚠️ Desde 07/10 o FLEXIBLE **entra na soma pelo nominal** (ajuste do dono). O caso que
     * quebra a conta ingênua passou a ser o CARTÃO sem fatura importada, logo abaixo — e o
     * invariante continua sendo o mesmo: Σ(linhas que contam) == Σ da prateleira.
     */
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
    // ⭐ 07/10: o nominal do FLEXIBLE entra na conta
    expect(r.total).toBeCloseTo(2_325.59 + 41_428.57 + 1_000, 2)
    // ⭐ a linha fora da soma está CONTADA e EXPLICADA (o cartão sem fatura importada)
    expect(r.foraDaSoma.n).toBe(1)
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

/**
 * ⭐⭐⭐ O CASO ARAFAT, COM OS NÚMEROS REAIS DE PROD, NOS DOIS MESES (07/10/2026).
 *
 * ⛔ **O defeito que motivou a lei:** outubro mostrava *"parcela 2 · R$ 50.000 · paga"* e o
 * dono não havia pago outubro — o selo vinha do pagamento de **AGOSTO**, porque a devolução
 * promove a próxima parcela aberta por NÚMERO e a agenda nominal só começa em setembro.
 *
 * ⚠️ O cenário é montado com as datas e valores MEDIDOS em prod: agenda 7× R$ 41.428,57 a
 * partir de 15/09, devoluções de **40.000 em 06/07** (1:1), **50.000 em 04/08** (1:1) e
 * **50.000 em 01/09** (N:1). Fixture que não reproduz a ordem real não prova nada sobre prod.
 */
describe('⭐⭐⭐ ARAFAT — a referência do mês é paga pelo CAIXA do mês (os dois meses)', () => {
  const CNPJ_ARAFAT = '70707070707071'
  let coId = ''
  let ctId = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ_ARAFAT } })
    const c = await prisma.company.create({ data: { cnpj: CNPJ_ARAFAT, name: 'CASO ARAFAT' } })
    coId = c.id
    const conta = await prisma.bankAccount.create({
      data: { companyId: coId, name: 'caixa loja/cofre', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
    })
    ctId = conta.id

    const l = await prisma.loan.create({
      data: {
        companyId: coId,
        bankAccountId: ctId,
        lender: 'Arafat (arafet thalji)',
        principal: 380_000,
        interestRateMonthly: 0,
        termMonths: 7,
        amortizationSystem: 'SAC',
        firstDueDate: new Date(Date.UTC(2026, 8, 15)),
        disbursementDate: new Date(Date.UTC(2026, 4, 1)),
        status: 'ACTIVE',
        rateType: 'PRE',
        scheduleSource: 'FLEXIBLE',
      } as never,
    })

    // a agenda NOMINAL: 7× 41.428,57 do dia 15, de setembro a março
    for (let n = 1; n <= 7; n++) {
      await prisma.loanInstallment.create({
        data: {
          loanId: l.id,
          number: n,
          dueDate: new Date(Date.UTC(2026, 7 + n, 15)),
          openingBalance: 380_000,
          interest: 0,
          amortization: 41_428.57,
          payment: 41_428.57,
          closingBalance: 380_000 - 41_428.57 * n,
          status: n <= 3 ? 'PAID' : 'OPEN',
        } as never,
      })
    }

    const tx = async (d: Date, valor: number, desc: string) =>
      prisma.transaction.create({
        data: {
          bankAccountId: ctId, date: d, description: desc, amount: valor,
          type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
        } as never,
      })

    const ins = await prisma.loanInstallment.findMany({ where: { loanId: l.id }, orderBy: { number: 'asc' } })

    // ⚠️ as DUAS portas, como em prod: #1 e #2 por 1:1, #3 por N:1
    const t1 = await tx(new Date(Date.UTC(2026, 6, 6)), 40_000, 'arafat ')
    await prisma.loanInstallment.update({
      where: { id: ins[0].id },
      data: { reconciledTransactionId: t1.id, paidTotal: 40_000, paidDate: t1.date } as never,
    })
    const t2 = await tx(new Date(Date.UTC(2026, 7, 4)), 50_000, 'Arafat emprestimo')
    await prisma.loanInstallment.update({
      where: { id: ins[1].id },
      data: { reconciledTransactionId: t2.id, paidTotal: 50_000, paidDate: t2.date } as never,
    })
    const t3 = await tx(new Date(Date.UTC(2026, 8, 1)), 50_000, 'Devolução de mútuo — Arafat (parcela #3)')
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: ins[2].id, transactionId: t3.id, amount: 50_000 } as never,
    })
    await prisma.loanInstallment.update({
      where: { id: ins[2].id },
      data: { paidTotal: 50_000, paidDate: t3.date } as never,
    })
  })

  afterEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ_ARAFAT } })
  })

  it('⭐ SETEMBRO mostra PAGA — e pelo caixa de setembro (50.000), não pelos 40.000 de julho', async () => {
    const r = await lerCompromissos(coId, '2026-09', new Date('2026-09-20T12:00:00Z'))
    const p = r.parcelas.find((x) => x.contrato.startsWith('Arafat'))!
    expect(p.numero, 'a referência de setembro é a #1').toBe(1)
    expect(p.estado).toBe('PAGA')
    expect(p.selo).toBe('paga')
    // ⛔ o valor é o caixa que REALMENTE saiu no mês — os 40.000 são de JULHO
    expect(p.valor).toBeCloseTo(50_000, 2)
    expect(p.valorEhPrevisto).toBe(false)
    expect(p.contaNaSoma).toBe(true)
    // ⭐ paga não ganha linha-mitigação (frase sobre o que não acontece é ruído)
    expect(p.avisoFlexivel).toBeNull()
  })

  it('⛔⛔ OUTUBRO mostra A VENCER (vence dia 15) — o defeito que o dono reportou', async () => {
    const r = await lerCompromissos(coId, '2026-10', new Date('2026-10-07T12:00:00Z'))
    const p = r.parcelas.find((x) => x.contrato.startsWith('Arafat'))!
    expect(p.numero, 'a referência de outubro é a #2').toBe(2)
    // ⛔ ERA 'PAGA' pelo pagamento de 04/08 — este é o red-then-green do caso
    expect(p.estado).toBe('A_VENCER')
    expect(p.selo).toContain('~referência flexível')
    expect(p.diaDoVencimento).toBe(15)
    // ⭐ e o nominal CONTA na Σ (ajuste do dono): esconder 41 mil o faria afundar sorrindo
    expect(p.valor).toBeCloseTo(41_428.57, 2)
    expect(p.contaNaSoma).toBe(true)
    expect(r.somaParcelas).toBeCloseTo(41_428.57, 2)
    // ⭐ a linha-mitigação NOMEIA a última devolução (01/09), que é o pedido do dono
    expect(p.avisoFlexivel).toContain('outubro')
    expect(p.avisoFlexivel).toContain('01/09')
  })

  it('⭐ NOVEMBRO também é a vencer — a devolução de 01/09 não paga o mês de novembro', async () => {
    const r = await lerCompromissos(coId, '2026-11', new Date('2026-11-05T12:00:00Z'))
    const p = r.parcelas.find((x) => x.contrato.startsWith('Arafat'))!
    expect(p.numero).toBe(3)
    // ⛔ a #3 é a que o vínculo N:1 chama de paga — e novembro não teve caixa
    expect(p.estado).toBe('A_VENCER')
    expect(p.avisoFlexivel).toContain('novembro')
  })

  it('⭐⭐ quando o caixa do mês cobre o nominal, vira paga SOZINHO — e o vínculo é irrelevante', async () => {
    // o dono devolve 50.000 em 10/10; o vínculo cai na #4 (dezembro), como a alocação real faz
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: ctId, date: new Date(Date.UTC(2026, 9, 10)), description: 'devolucao arafat',
        amount: 50_000, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const quarta = await prisma.loanInstallment.findFirstOrThrow({
      where: { loan: { companyId: coId }, number: 4 },
    })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: quarta.id, transactionId: tx.id, amount: 50_000 } as never,
    })

    const r = await lerCompromissos(coId, '2026-10', new Date('2026-10-20T12:00:00Z'))
    const p = r.parcelas.find((x) => x.contrato.startsWith('Arafat'))!
    // ⭐ OUTUBRO fecha mesmo com o vínculo pendurado em DEZEMBRO — a lei é imune à ordem
    expect(p.estado).toBe('PAGA')
    expect(p.valor).toBeCloseTo(50_000, 2)
    expect(p.avisoFlexivel).toBeNull()
  })

  it('⚠️ caixa PARCIAL no mês segue valendo o NOMINAL, com o parcial dito no selo', async () => {
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: ctId, date: new Date(Date.UTC(2026, 9, 12)), description: 'devolucao parcial',
        amount: 20_000, type: 'DEBIT', lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const quarta = await prisma.loanInstallment.findFirstOrThrow({
      where: { loan: { companyId: coId }, number: 4 },
    })
    await prisma.loanInstallmentPayment.create({
      data: { installmentId: quarta.id, transactionId: tx.id, amount: 20_000 } as never,
    })

    const r = await lerCompromissos(coId, '2026-10', new Date('2026-10-20T12:00:00Z'))
    const p = r.parcelas.find((x) => x.contrato.startsWith('Arafat'))!
    expect(p.estado).toBe('A_VENCER')
    // ⭐ a prateleira responde "quanto o mês CUSTA", não "quanto ainda falta sair"
    expect(p.valor).toBeCloseTo(41_428.57, 2)
    expect(p.selo).toContain('devolvido')
    expect(p.avisoFlexivel).toContain('20.000')
  })
})

/**
 * ⛔⛔ O CONTRAFACTUAL QUE IMPEDE A LEI DE VAZAR PRO BANCÁRIO (07/10/2026).
 *
 * Na parcela de banco *"PAID gravado é DECISÃO"* (02/10) tem que continuar valendo. O caso
 * real: a **Caixa 1837311 #28** venceu em **maio** e foi debitada em **junho** — no recorte de
 * maio ela **É paga, com atraso**. Se a lei da referência flexível alcançasse o bancário, a
 * tela diria *"a vencer"* sobre dinheiro que já saiu, e o dono pagaria duas vezes.
 */
describe('⛔⛔ A LEI NÃO ALCANÇA O BANCÁRIO — atraso ≠ não pago', () => {
  const CNPJ_CX = '70707070707072'
  let coId = ''

  beforeEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ_CX } })
    const c = await prisma.company.create({ data: { cnpj: CNPJ_CX, name: 'CONTRAFACTUAL CAIXA' } })
    coId = c.id
    const conta = await prisma.bankAccount.create({
      data: { companyId: coId, name: 'banco caixa', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
    })
    const l = await prisma.loan.create({
      data: {
        companyId: coId, bankAccountId: conta.id, lender: 'Caixa Econômica Federal',
        contractNumber: '000000000001837311', principal: 150_000, interestRateMonthly: 0.005,
        termMonths: 36, amortizationSystem: 'PRICE', firstDueDate: new Date(Date.UTC(2026, 4, 26)),
        disbursementDate: new Date(Date.UTC(2024, 10, 26)), status: 'ACTIVE',
        rateType: 'POS', scheduleSource: 'IMPORTED',
      } as never,
    })
    // #28 vence 26/05 e foi PAGA em 10/06 — o mês do pagamento é OUTRO
    const i = await prisma.loanInstallment.create({
      data: {
        loanId: l.id, number: 28, dueDate: new Date(Date.UTC(2026, 4, 26)),
        openingBalance: 30_000, interest: 311.26, amortization: 2_615.76, payment: 2_927.02,
        closingBalance: 27_384.24, status: 'PAID',
      } as never,
    })
    const tx = await prisma.transaction.create({
      data: {
        bankAccountId: conta.id, date: new Date(Date.UTC(2026, 5, 10)),
        description: 'DEBITO PRESTA SIEMP', amount: 2_927.02, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    await prisma.loanInstallment.update({
      where: { id: i.id },
      data: { reconciledTransactionId: tx.id, paidTotal: 2_927.02, paidDate: tx.date } as never,
    })
  })

  afterEach(async () => {
    await prisma.company.deleteMany({ where: { cnpj: CNPJ_CX } })
  })

  it('⛔ a #28 continua PAGA no recorte de MAIO, mesmo paga em JUNHO', async () => {
    const r = await lerCompromissos(coId, '2026-05', new Date('2026-05-30T12:00:00Z'))
    expect(r.parcelas).toHaveLength(1)
    const p = r.parcelas[0]
    expect(p.flexible).toBe(false)
    expect(p.estado, 'PAID gravado é DECISÃO — atraso não é "a vencer"').toBe('PAGA')
    expect(p.valor).toBeCloseTo(2_927.02, 2)
    expect(p.contaNaSoma).toBe(true)
    // ⭐ e o bancário NUNCA ganha a linha-mitigação do flexível
    expect(p.avisoFlexivel).toBeNull()
  })
})
