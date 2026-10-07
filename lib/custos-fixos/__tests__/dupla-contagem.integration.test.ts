/**
 * ⛔⛔⛔ O GUARD DE DUPLA CONTAGEM — COM O CASO ARMADO (07/10/2026).
 *
 * **Ordem do dono:** *"Guard de dupla contagem: nenhuma transação/compromisso em 2 somas do
 * topo (teste com caso armado)."*
 *
 * ⚠️⚠️ **O "CASO ARMADO" É O PONTO DESTE ARQUIVO, e ele vem de uma medição.** Em prod, HOJE,
 * o estrago é ZERO: das 58 transações que pagaram parcela, 2 têm categoria e **nenhuma** tem
 * categoria FIXA; dos 6 pagamentos de fatura, nenhum tem categoria. Ou seja: um teste montado
 * com o dado de hoje passaria **verde com o guard removido** — seria um selo de graça, a
 * classe que a REGRA 11 existe pra fechar.
 *
 * ⭐ Então o teste ARMA o estado ruim de propósito (a transação que pagou a parcela carregando
 * a categoria da prateleira BANCO) e prova as duas metades: o real **não** entra em duas somas,
 * **e** a régua velha entraria. Sem o contrafactual, este arquivo seria uma afirmação sobre o
 * mundo bom.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { whereFluxoCaixa } from '@/lib/fluxo-caixa/motor'
import { lerCustosFixos, SEM_DUPLA_CONTAGEM } from '../leitura'
import { marcarComoFixa, definirPlanejado } from '../gestos'

const CNPJ = '60606060606060'
const MES = '2026-09'
const AGORA = new Date('2026-09-20T12:00:00Z')

let companyId = ''
let contaId = ''
let catJuros = ''
let catAluguel = ''

const dia = (d: number) => new Date(Date.UTC(2026, 8, d))

/** ⚠️ a régua VELHA: o realizado SEM o guard — o contrafactual que mede o estrago */
async function realizadoSemGuard(categoryId: string): Promise<number> {
  const r = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      ...whereFluxoCaixa(companyId, { de: dia(1), ate: new Date(Date.UTC(2026, 8, 30, 23, 59, 59)) }),
      type: 'DEBIT',
      categoryId,
    },
  })
  return r._sum.amount ?? 0
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'DUPLA CONTAGEM' } })
  companyId = c.id
  const conta = await prisma.bankAccount.create({
    data: { companyId, name: 'conta', bankName: 'teste', accountType: 'CHECKING', balance: 0 },
  })
  contaId = conta.id

  const j = await prisma.category.create({
    data: { companyId, name: 'Juros sobre Empréstimos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
  })
  catJuros = j.id
  const a = await prisma.category.create({
    data: { companyId, name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  })
  catAluguel = a.id

  await marcarComoFixa(companyId, catJuros, 'quem', undefined, 'BANCO')
  await definirPlanejado(companyId, catJuros, MES, 10_000, 'quem')
  await marcarComoFixa(companyId, catAluguel, 'quem', undefined, 'CASA')
  await definirPlanejado(companyId, catAluguel, MES, 8_500, 'quem')
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

async function armarParcelaComCategoria(valor: number, categoryId: string) {
  const l = await prisma.loan.create({
    data: {
      companyId, bankAccountId: contaId, lender: 'Banrisul', contractNumber: 'ARMADO',
      principal: 100_000, interestRateMonthly: 0.019, termMonths: 1, amortizationSystem: 'PRICE',
      firstDueDate: dia(26), disbursementDate: new Date(Date.UTC(2026, 0, 1)),
      status: 'ACTIVE', rateType: 'PRE', scheduleSource: 'IMPORTED',
    } as never,
  })
  const i = await prisma.loanInstallment.create({
    data: {
      loanId: l.id, number: 1, dueDate: dia(26), openingBalance: 100_000,
      interest: 500, amortization: valor - 500, payment: valor,
      closingBalance: 100_000 - (valor - 500), status: 'PAID',
    } as never,
  })
  // ⚠️ a transação que pagou a parcela, carregando a categoria da prateleira BANCO
  const tx = await prisma.transaction.create({
    data: {
      bankAccountId: contaId, categoryId, date: dia(26),
      description: 'LIQUIDACAO DE PARCELA-ARMADO', amount: valor, type: 'DEBIT',
      lifecycle: 'EFFECTED', status: 'RECONCILED',
    } as never,
  })
  await prisma.loanInstallmentPayment.create({
    data: { installmentId: i.id, transactionId: tx.id, amount: valor } as never,
  })
  return { tx, installmentId: i.id }
}

describe('⛔⛔⛔ CASO ARMADO 1 — a parcela de empréstimo com categoria do BANCO', () => {
  it('⛔⛔ o MESMO real NÃO entra em duas somas: fica no compromisso, sai do realizado', async () => {
    await armarParcelaComCategoria(2_325.59, catJuros)

    const t = await lerCustosFixos(companyId, MES, AGORA)

    // ⭐ o compromisso CONTA a parcela (é caixa que saiu)
    expect(t.compromissos.somaParcelas).toBeCloseTo(2_325.59, 2)
    // ⛔ e o realizado do BANCO **não** conta a transação dela
    expect(t.banco.realizado, 'o guard tirou do realizado o que já é compromisso').toBe(0)

    // ⚠️⚠️ O CONTRAFACTUAL — é ele que prova que o guard MORDE neste caso
    const velho = await realizadoSemGuard(catJuros)
    expect(velho, 'sem o guard, a régua velha somaria o mesmo real').toBeCloseTo(2_325.59, 2)
  })

  it('⛔ e o 4º cartão não exige vender o dobro por causa disso', async () => {
    await armarParcelaComCategoria(2_325.59, catJuros)
    const t = await lerCustosFixos(companyId, MES, AGORA)
    // ⭐ o total do mês é plano da casa + plano do banco + compromisso — UMA vez cada
    expect(t.afundar.totalDoMes).toBeCloseTo(8_500 + 10_000 + 2_325.59, 2)
  })

  it('⭐ a transação COM categoria mas SEM vínculo de parcela continua no realizado', async () => {
    // ⚠️ é o juro da conta garantida: não é compromisso de nada, tem que contar
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: catJuros, date: dia(2),
        description: 'JUROS', amount: 743.57, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.banco.realizado).toBeCloseTo(743.57, 2)
  })
})

describe('⛔⛔⛔ CASO ARMADO 2 — o pagamento de fatura com categoria fixa', () => {
  async function cartaoComFaturaPaga(valor: number, categoryId: string | null) {
    const c = await prisma.businessCreditCard.create({
      data: {
        companyId, name: 'Carter banrisul', lastDigits: '0115',
        closingDay: 5, dueDay: 15, isActive: true, creditLimit: 50_000,
      } as never,
    })
    await prisma.transaction.create({
      data: {
        businessCreditCardId: c.id, invoiceMonth: MES, isCardPayment: false,
        date: dia(2), description: 'compra', amount: valor, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, businessCreditCardId: c.id, paidInvoiceMonth: MES,
        isCardPayment: true, categoryId, date: dia(14),
        description: 'PAGAMENTO CARTAO', amount: valor, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    return c
  }

  it('⛔⛔ a fatura conta no compromisso e o pagamento sai do realizado', async () => {
    await cartaoComFaturaPaga(8_626.98, catAluguel)

    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.compromissos.somaFaturas).toBeCloseTo(8_626.98, 2)
    expect(t.casa.realizado, 'o pagamento da fatura já é compromisso').toBe(0)

    const velho = await realizadoSemGuard(catAluguel)
    expect(velho, 'a régua velha contaria o pagamento de novo').toBeCloseTo(8_626.98, 2)
  })

  it('⛔⛔ A FLAG NÃO DECIDE: `isCardPayment` SEM vínculo continua no realizado (régua de 20/09)', async () => {
    /**
     * ⚠️ Sem `businessCreditCardId` a linha **não quita fatura nenhuma** — ela não é
     * compromisso de nada, e tirá-la do realizado a faria desaparecer das duas somas, que é
     * pior que contar duas vezes (*duplicar é feio; sumir é perder trabalho*).
     */
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: catAluguel, isCardPayment: true,
        date: dia(3), description: 'PIX MERCADO PAGO', amount: 500, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const t = await lerCustosFixos(companyId, MES, AGORA)
    expect(t.casa.realizado).toBeCloseTo(500, 2)
  })
})

describe('⛔ o guard compõe com o `whereFluxoCaixa` em vez de espalhar por cima dele', () => {
  it('⭐ a transferência com categoria de TRANSFERÊNCIA continua FORA (o `NOT` não foi clobbado)', async () => {
    /**
     * ⚠️⚠️ ESTE É O TESTE QUE PEGA O ERRO DE COMPOSIÇÃO: o `whereFluxoCaixa` tem um `NOT` no
     * topo, e espalhar o guard com `{...where, NOT: {...}}` o APAGARIA em silêncio. O número
     * voltaria a contar transferência entre contas próprias como custo fixo, e nada quebraria.
     */
    const t = await prisma.category.create({
      data: { companyId, name: 'Transferência entre contas', type: 'EXPENSE', dreGroup: 'TRANSFERENCIA' },
    })
    await marcarComoFixa(companyId, t.id, 'quem', undefined, 'CASA')
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: t.id, date: dia(5),
        description: 'PIX ENVIADO', amount: 25_000, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })
    const tela = await lerCustosFixos(companyId, MES, AGORA)
    const linha = tela.linhas.find((l) => l.categoryId === t.id)!
    expect(linha.realizado, 'transferência própria nunca é custo fixo').toBe(0)
  })

  it('⭐ o guard é um objeto que COMPÕE — e ele não traz `date` nem `type` por conta própria', () => {
    // ⚠️ guard que trouxesse período próprio recortaria o mês por duas réguas
    expect(Object.keys(SEM_DUPLA_CONTAGEM)).toEqual(['NOT'])
  })
})

describe('⛔⛔ Σ(linhas de cada prateleira) == subtotal dela == composição dos cartões', () => {
  it('⭐ o invariante do dono, com as duas prateleiras e o compromisso juntos', async () => {
    await armarParcelaComCategoria(2_325.59, catJuros)
    await prisma.transaction.create({
      data: {
        bankAccountId: contaId, categoryId: catAluguel, date: dia(5),
        description: 'ALUGUEL', amount: 8_456.88, type: 'DEBIT',
        lifecycle: 'EFFECTED', status: 'RECONCILED',
      } as never,
    })

    const t = await lerCustosFixos(companyId, MES, AGORA)

    // (1) Σ das linhas DESENHADAS == subtotal da prateleira
    for (const p of [t.casa, t.banco]) {
      const somaPlano = p.linhas
        .filter((l) => l.planejado != null)
        .reduce((s, l) => s + (l.planejado ?? 0), 0)
      expect(p.planejado).toBeCloseTo(somaPlano, 2)
      expect(p.realizado).toBeCloseTo(p.linhas.reduce((s, l) => s + l.realizado, 0), 2)
    }

    // (2) os subtotais que viajam pros cartões são OS MESMOS das prateleiras
    expect(t.subtotais.casaPlanejado).toBe(t.casa.planejado)
    expect(t.subtotais.bancoPlanejado).toBe(t.banco.planejado)
    expect(t.subtotais.compromissos).toBeCloseTo(t.compromissos.total, 2)

    // (3) o 1º cartão (tudo ligado) == a Σ dos três, UMA vez cada
    expect(t.conta.total).toBeCloseTo(8_500 + 10_000 + 2_325.59, 2)

    // (4) nenhuma linha em duas prateleiras
    const ids = [...t.casa.linhas, ...t.banco.linhas].map((l) => l.categoryId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(t.linhas.length)
  })
})
