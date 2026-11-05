/**
 * ⭐⭐ 05/11/2026 — O SOBROU PARA DE MENTIR: amortização paga a TERCEIRO aparece no fluxo.
 *
 * O caso real (raio-X de 04/11, Caçula): a devolução do mútuo Arafat, R$ 40.000 saindo em
 * dinheiro do cofre, tem a categoria "Amortização de Mútuo (terceiros)", que fica no grupo
 * TRANSFERENCIA. O `whereFluxoCaixa` excluía o grupo INTEIRO, então ela sumia como se fosse
 * dinheiro entre contas próprias:
 *   outubro  → tela SOBROU +12.443,43 · real −27.556,57
 *   novembro → tela SAIU 53.629,49    · real 93.629,49
 *
 * As fixtures reproduzem os TOTAIS de prod (os mesmos 548.573,99 / 536.130,56 / 36.531,77),
 * e o contrafactual roda a régua VELHA contra o mesmo banco: ela tem que dar o número errado.
 * REGRA 3: executa o where contra o banco e o motor de agrupamento, sem procurar string.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, type Prisma } from '@prisma/client'
import {
  whereFluxoCaixa, whereTransferenciaPropria, SELECT_FLUXO, paraLinha, agruparFluxo, CAT_PARCELA,
  CAT_LIBERACAO,
} from '../motor'

const db = new PrismaClient()
/** ⚠️ CNPJ exclusivo — conferido contra o repo (0 ocorrências antes deste arquivo) */
const CNPJ = '05110511000105'
const AMORT = 'Amortização de Mútuo (terceiros)'

const dia = (s: string) => new Date(`${s}T12:00:00.000Z`)
const janela = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  return { de: new Date(Date.UTC(a, m - 1, 1)), ate: new Date(Date.UTC(a, m, 0, 23, 59, 59, 999)) }
}

/** ⛔ A RÉGUA VELHA, verbatim: o grupo TRANSFERENCIA inteiro fora. É o contrafactual. */
const whereVelho = (companyId: string, p: { de: Date; ate: Date }): Prisma.TransactionWhereInput => ({
  ...whereFluxoCaixa(companyId, p),
  NOT: { category: { dreGroup: 'TRANSFERENCIA' } },
})

let companyId = ''
let sicredi = ''
let cofre = ''
const cat: Record<string, string> = {}
const parcela: Record<string, string> = {}

async function tx(data: {
  conta: string; type: string; amount: number; date: string; desc: string; categoria?: string
}) {
  return (await db.transaction.create({
    data: {
      bankAccountId: data.conta, type: data.type, amount: data.amount, date: dia(data.date),
      description: data.desc, categoryId: data.categoria ? cat[data.categoria] : null,
      lifecycle: 'EFFECTED', status: 'RECONCILED', origin: data.conta === cofre ? 'MANUAL' : 'OFX',
    },
  })).id
}

async function contrato(lender: string, conta: string | null, numeros: number[]) {
  const l = await db.loan.create({
    data: {
      companyId, bankAccountId: conta, lender, principal: 380000, interestRateMonthly: 0,
      termMonths: 7, firstDueDate: dia('2026-07-15'), disbursementDate: dia('2026-06-01'),
      amortizationSystem: 'SAC', status: 'ACTIVE',
    },
  })
  for (const n of numeros) {
    const i = await db.loanInstallment.create({
      data: {
        loanId: l.id, number: n, dueDate: dia(`2026-${String(((5 + n) % 12) + 1).padStart(2, '0')}-15`), // o mês só importa ser válido
        openingBalance: 0, interest: 0, amortization: 40000, correcao: 0, payment: 40000,
        closingBalance: 0, status: 'PAID',
      },
    })
    parcela[`${lender}#${n}`] = i.id
  }
  return l.id
}

/** a porta N:1 — a que a devolução flexível usa (`vincularPagamentoDeParcela`) */
const pagaN1 = (chave: string, transactionId: string, amount: number) =>
  db.loanInstallmentPayment.create({ data: { installmentId: parcela[chave], transactionId, amount } })

async function medir(mes: string, regua: typeof whereFluxoCaixa = whereFluxoCaixa) {
  const cruas = await db.transaction.findMany({ where: regua(companyId, janela(mes)), select: SELECT_FLUXO })
  return agruparFluxo(cruas.map(paraLinha))
}
const linhaSaida = (r: Awaited<ReturnType<typeof medir>>, rotulo: string) =>
  r.saidas.find((g) => g.rotulo === rotulo)?.total ?? null

beforeAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await db.company.create({ data: { name: 'Capital de terceiros', cnpj: CNPJ } })).id
  sicredi = (await db.bankAccount.create({
    data: { companyId, name: 'sicredi ', bankName: 'Sicredi', accountType: 'CHECKING' },
  })).id
  cofre = (await db.bankAccount.create({
    data: { companyId, name: 'caixa loja/cofre', bankName: 'Caixa', accountType: 'CASH' },
  })).id
  for (const [k, name, type, dreGroup] of [
    ['receita', 'Vendas', 'INCOME', 'RECEITA_BRUTA'],
    ['despesa', 'Fornecedores', 'EXPENSE', 'CUSTO_PRODUTO_VENDIDO'],
    ['amort', AMORT, 'EXPENSE', 'TRANSFERENCIA'],
    ['propria', 'Entre Contas Próprias', 'TRANSFER', 'TRANSFERENCIA'],
    ['mutuoSocio', 'Mútuo entre Sócios', 'TRANSFER', 'TRANSFERENCIA'],
  ] as const) {
    cat[k] = (await db.category.create({ data: { companyId, name, type, dreGroup } })).id
  }

  await contrato('Arafat', cofre, [1, 4, 5])
  await contrato('Sicredi', sicredi, [25, 26])

  // ─── OUTUBRO: os totais de prod ───
  await tx({ conta: sicredi, type: 'CREDIT', amount: 548573.99, date: '2026-10-10', desc: 'vendas', categoria: 'receita' })
  await tx({ conta: sicredi, type: 'DEBIT', amount: 499598.79, date: '2026-10-12', desc: 'fornecedores', categoria: 'despesa' })
  // parcela bancária SEM categoria → linha "Parcela de empréstimo (pelo sistema)"
  await pagaN1('Sicredi#25', await tx({ conta: sicredi, type: 'DEBIT', amount: 36531.77, date: '2026-10-26', desc: 'parcelas' }), 36531.77)
  // ⭐ a 4ª devolução Arafat: cofre, categoria do grupo TRANSFERENCIA, vínculo N:1
  await pagaN1('Arafat#4', await tx({ conta: cofre, type: 'DEBIT', amount: 40000, date: '2026-10-09', desc: 'Devolução de mútuo — Arafat (4ª devolução)', categoria: 'amort' }), 40000)
  // ⛔ transferência própria DE VERDADE: os 3 jeitos que ela existe — têm que SEGUIR fora
  await tx({ conta: sicredi, type: 'DEBIT', amount: 10000, date: '2026-10-15', desc: 'saque pro cofre', categoria: 'propria' })
  await tx({ conta: cofre, type: 'CREDIT', amount: 10000, date: '2026-10-15', desc: 'saque pro cofre', categoria: 'propria' })
  await tx({ conta: sicredi, type: 'TRANSFER', amount: 5000, date: '2026-10-20', desc: 'par TRANSFER' })
  // liberação com categoria de transferência: entra no universo, mas vai pra faixa informativa
  const lib = await tx({ conta: sicredi, type: 'CREDIT', amount: 100000, date: '2026-10-05', desc: 'liberação', categoria: 'mutuoSocio' })
  await db.loan.create({
    data: {
      companyId, bankAccountId: sicredi, lender: 'Liberação', principal: 100000, interestRateMonthly: 0,
      termMonths: 10, firstDueDate: dia('2026-11-05'), disbursementDate: dia('2026-10-05'),
      amortizationSystem: 'SAC', status: 'ACTIVE', disbursementTransactionId: lib,
    },
  })

  // ─── NOVEMBRO (parcial): os totais de prod ───
  await tx({ conta: sicredi, type: 'DEBIT', amount: 45998.27, date: '2026-11-02', desc: 'fornecedores', categoria: 'despesa' })
  await pagaN1('Sicredi#26', await tx({ conta: sicredi, type: 'DEBIT', amount: 7631.22, date: '2026-11-03', desc: 'Caixa #34' }), 7631.22)
  await pagaN1('Arafat#5', await tx({ conta: cofre, type: 'DEBIT', amount: 40000, date: '2026-11-04', desc: 'Devolução de mútuo — Arafat (5ª devolução)', categoria: 'amort' }), 40000)

  // ─── JULHO: a porta 1:1 (`reconciledTransactionId`), a das duas primeiras devoluções ───
  const jul = await tx({ conta: cofre, type: 'DEBIT', amount: 40000, date: '2026-07-06', desc: 'arafat', categoria: 'amort' })
  await db.loanInstallment.update({ where: { id: parcela['Arafat#1'] }, data: { reconciledTransactionId: jul } })
})

afterAll(async () => {
  await db.company.deleteMany({ where: { cnpj: CNPJ } })
  await db.$disconnect()
})

describe('outubro — o SOBROU de prod', () => {
  it('⛔ CONTRAFACTUAL: a régua velha dá o número que a tela mostrava (+12.443,43)', async () => {
    const r = await medir('2026-10', whereVelho)
    expect(r.saiu).toBe(536130.56)
    expect(r.resultado).toBe(12443.43)
  })

  it('⭐ a régua nova: SAIU 576.130,56 e SOBROU −27.556,57', async () => {
    const r = await medir('2026-10')
    expect(r.entrou).toBe(548573.99)
    expect(r.saiu).toBe(576130.56)
    expect(r.resultado).toBe(-27556.57)
  })

  it('a devolução aparece como LINHA PRÓPRIA da categoria do dono, com o rastro', async () => {
    const r = await medir('2026-10')
    const g = r.saidas.find((x) => x.rotulo === AMORT)
    expect(g?.total).toBe(40000)
    expect(g?.lancamentos.map((l) => l.conta)).toEqual(['caixa loja/cofre'])
  })

  it('a linha de parcelas segue 36.531,77 (não mudou, não absorveu a devolução)', async () => {
    expect(linhaSaida(await medir('2026-10'), CAT_PARCELA)).toBe(36531.77)
  })

  it('⛔ transferência própria SEGUE fora — categoria, par TRANSFER, os dois lados', async () => {
    const r = await medir('2026-10')
    const rotulos = [...r.saidas, ...r.entradas].map((g) => g.rotulo)
    expect(rotulos).not.toContain('Entre Contas Próprias')
    expect(r.entrou).toBe(548573.99) // o lado CREDIT da própria não inflou a entrada
  })

  it('a liberação com categoria de transferência fica na faixa informativa, fora do ENTROU', async () => {
    const r = await medir('2026-10')
    expect(r.informativas.find((g) => g.rotulo === CAT_LIBERACAO)?.total).toBe(100000)
    expect(r.entrou).toBe(548573.99)
  })

  it('o aviso "transferências entre contas próprias" conta só as próprias (25.000), sem a devolução', async () => {
    const a = await db.transaction.aggregate({
      where: whereTransferenciaPropria(companyId, janela('2026-10')), _sum: { amount: true }, _count: true,
    })
    expect(a._count).toBe(3)
    expect(a._sum.amount).toBe(25000)
  })

  it('⭐ INVARIANTE: universo do fluxo + aviso de próprias = todo lançamento efetivado do mês (nada some, nada conta 2×)', async () => {
    const p = janela('2026-10')
    const noFluxo = await db.transaction.count({ where: whereFluxoCaixa(companyId, p) })
    const proprias = await db.transaction.count({ where: whereTransferenciaPropria(companyId, p) })
    const todos = await db.transaction.count({ where: { bankAccount: { companyId }, lifecycle: 'EFFECTED', date: { gte: p.de, lte: p.ate } } })
    expect(noFluxo + proprias).toBe(todos)
  })
})

describe('novembro parcial — a 5ª devolução de 04/11', () => {
  it('⛔ CONTRAFACTUAL: régua velha → SAIU 53.629,49', async () => {
    expect((await medir('2026-11', whereVelho)).saiu).toBe(53629.49)
  })

  it('⭐ régua nova → SAIU 93.629,49, com a linha de 40.000 e a parcela da Caixa #34 (7.631,22)', async () => {
    const r = await medir('2026-11')
    expect(r.saiu).toBe(93629.49)
    expect(linhaSaida(r, AMORT)).toBe(40000)
    expect(linhaSaida(r, CAT_PARCELA)).toBe(7631.22)
  })
})

describe('as duas portas do vínculo', () => {
  it('porta 1:1 (reconciledTransactionId) também conta — é como entraram as devoluções de jul/ago', async () => {
    const r = await medir('2026-07')
    expect(r.saiu).toBe(40000)
    expect(linhaSaida(r, AMORT)).toBe(40000)
  })
})
