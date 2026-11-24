/**
 * ⭐⭐⭐ R64/R65 (cheque especial é crédito) + R60 (ficha completa) — por EXECUÇÃO (25/11/2026).
 * Lei: docs/emprestimos-referencia.html.
 *
 *  R64: os juros de limite de cada conta entram no CUSTO DO DINHEIRO, separados dos contratos; o
 *       "JUROS — <fornecedor>" da Stone (mora de boleto) NÃO é rotativo; usado = saldo negativo;
 *       limite só quando cadastrado.
 *  R65: a linha de juros de limite chega na caixa com PALPITE pronto; confirmada uma vez vira regra
 *       (conta + descrição) — e a regra só PALPITA: nenhuma linha muda de estado sozinha.
 *  R60: excluir tem DOIS destinos (sem história apaga; com história some das telas e o DRE fica);
 *       o pós sem indexador é cobrado.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerChequeEspecial, ehJurosDeCheque, sugereJurosCheque } from '../cheque-especial'
import { lerCarteiraDeEmprestimos } from '../carteira'
import { historiaDoContrato, destinoExclusao, cadastroIncompleto, CONTRATO_VISIVEL } from '../ficha'
import { palpitesDaCaixa } from '@/lib/conciliacao/palpites-da-caixa'
import { lerCaixa } from '@/lib/conciliacao/leitura-da-caixa'
import { resolverLinha } from '@/lib/conciliacao/resolver-linha'

const CNPJ = '50607080002471'
let companyId: string
let sicredi: string
let stone: string
let catJuros: string

const linha = async (conta: string, description: string, amount: number, dia = '2026-11-10', extra: Record<string, unknown> = {}) =>
  (await prisma.transaction.create({
    data: { bankAccountId: conta, date: new Date(`${dia}T12:00:00Z`), description, amount, type: 'DEBIT', status: 'PENDING', lifecycle: 'EFFECTED', origin: 'OFX', ...extra },
  })).id

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CHEQUE E FICHA' } })).id
  sicredi = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', bankName: 'Sicredi', accountType: 'CHECKING', balance: -79253.12, creditLimit: 80000 } })).id
  stone = (await prisma.bankAccount.create({ data: { companyId, name: 'stone', bankName: 'Stone', accountType: 'CHECKING', balance: 4.72 } })).id
  catJuros = (await prisma.category.create({ data: { companyId, name: 'Juros sobre Empréstimos', type: 'DEBIT', dreGroup: 'DESPESAS_FINANCEIRAS', isActive: true } })).id
})
afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('R64 — juros de limite por conta, no custo do dinheiro', () => {
  it('soma o código do banco, separa a mora da Stone, usado × limite', async () => {
    await linha(sicredi, 'JUROS UTILIZ.CH.ESPECIAL-ENC036', 1200.5)
    await linha(sicredi, 'JUROS UTILIZ.CH.ESPECIAL-REP029', 800, '2026-10-10')
    await linha(sicredi, 'IOF ADICIONAL PJ-CH. ESPE-IOF.ADIC.', 50) // IOF não é juros
    await linha(stone, 'JUROS — LATICINIOS SANTO CRISTO LTDA', 30) // mora de boleto, não rotativo
    const q = await lerChequeEspecial(prisma, companyId, 2026, '2026-11')
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ conta: 'sicredi', jurosAno: 2000.5, jurosMes: 1200.5, usado: 79253.12, limite: 80000, linhasAno: 2 })
  })

  it('conta sem limite cadastrado mostra SÓ o usado (limite null, nunca inventado)', async () => {
    await prisma.bankAccount.update({ where: { id: sicredi }, data: { creditLimit: 0 } })
    const q = await lerChequeEspecial(prisma, companyId, 2026, '2026-11')
    expect(q[0].limite).toBeNull()
    expect(q[0].usado).toBe(79253.12)
  })

  it('a categoria de juros de crédito conta — menos linha que fala de PARCELA, e menos linha vinculada a contrato', () => {
    const regras = new Set<string>()
    expect(ehJurosDeCheque({ description: 'OP CRED C GARANT', bankAccountId: 'b', categoryName: 'Juros sobre Empréstimos', temVinculoDeContrato: false }, regras)).toBe(true)
    expect(ehJurosDeCheque({ description: 'LIQUIDACAO DE PARCELA-C41022570', bankAccountId: 'b', categoryName: 'Juros sobre Empréstimos', temVinculoDeContrato: false }, regras)).toBe(false)
    expect(ehJurosDeCheque({ description: 'JUROS UTILIZ.CH.ESPECIAL', bankAccountId: 'b', categoryName: null, temVinculoDeContrato: true }, regras)).toBe(false)
    expect(sugereJurosCheque('JUROS')).toBe(true)
    expect(sugereJurosCheque('JUROS — DIVINE ALIMENTOS LTDA')).toBe(false)
  })

  it('o custo do dinheiro da carteira = contratos + cheque, declarados separados', async () => {
    await linha(sicredi, 'JUROS UTILIZ.CH.ESPECIAL-ENC036', 1200.5)
    const c = await lerCarteiraDeEmprestimos(companyId, new Date('2026-11-25T12:00:00Z'), prisma)
    expect(c.custo.cheque).toBe(1200.5)
    expect(c.custo.total).toBe(c.custo.contratos + 1200.5)
  })
})

describe('R65 — o palpite pronto, e a regra aprendida que só PALPITA', () => {
  it('a linha de juros de limite chega com palpite "juros de cheque especial · conta"', async () => {
    const id = await linha(sicredi, 'JUROS UTILIZ.CH.ESPECIAL-ENC036', 1200.5)
    const { rows } = await lerCaixa(companyId)
    const p = (await palpitesDaCaixa(companyId, rows)).get(id)
    expect(p?.acao).toBe('CATEGORIA')
    expect(p?.titulo).toBe('juros de cheque especial · sicredi')
    expect(p?.alvo).toEqual({ categoryId: catJuros, aprenderCheque: true })
  })

  it('confirmada UMA vez vira regra; a próxima linha igual PALPITA, mas fica na caixa (nunca marca sozinha)', async () => {
    // descrição que NÃO está na lista do banco — só a regra aprendida a reconhece
    const a = await linha(sicredi, 'ENC S/ LIM 0001', 310)
    await resolverLinha({ companyId, txId: a, acao: 'CATEGORIA', categoryId: catJuros, aprenderCheque: true })
    expect(await prisma.chequeEspecialRegra.count({ where: { companyId } })).toBe(1)

    const b = await linha(sicredi, 'ENC S/ LIM 0002', 290, '2026-11-11')
    const { rows } = await lerCaixa(companyId)
    const p = (await palpitesDaCaixa(companyId, rows)).get(b)
    expect(p?.detalhe).toContain('regra aprendida')
    const tb = await prisma.transaction.findUniqueOrThrow({ where: { id: b }, select: { status: true, categoryId: true } })
    expect(tb, 'a regra marcou a linha sozinha').toEqual({ status: 'PENDING', categoryId: null })
  })
})

describe('R60 — a ficha: excluir com dois destinos e o cadastro cobrado', () => {
  const contrato = (o: Record<string, unknown> = {}) => prisma.loan.create({
    data: {
      companyId, bankAccountId: sicredi, lender: 'Sicredi', contractNumber: 'C41022227-1', principal: 100000,
      interestRateMonthly: 0.017, rateType: 'POS', indexer: null, termMonths: 2, amortizationSystem: 'PRICE',
      disbursementDate: new Date('2025-01-15T00:00:00Z'), firstDueDate: new Date('2026-11-15T00:00:00Z'),
      scheduleSource: 'IMPORTED', status: 'ACTIVE', ...o,
    },
  })

  it('sem história → apaga; com parcela paga + pedaço → some das telas e a parcela FICA (o DRE lê)', async () => {
    const sem = await contrato()
    expect(destinoExclusao((await historiaDoContrato(prisma, sem.id)).temHistoria)).toBe('apaga')

    const com = await contrato({ contractNumber: 'C41022570-0' })
    const i = await prisma.loanInstallment.create({ data: { loanId: com.id, number: 1, dueDate: new Date('2026-11-15T00:00:00Z'), openingBalance: 100, interest: 0, amortization: 100, correcao: 0, payment: 100, closingBalance: 0, status: 'PAID', paidInterest: 12, paidTotal: 112, paidDate: new Date('2026-11-15T00:00:00Z') } })
    await prisma.loanInstallmentPayment.create({ data: { installmentId: i.id, transactionId: await linha(sicredi, 'LIQUIDACAO DE PARCELA-C41022570', 112), amount: 112 } })
    const h = await historiaDoContrato(prisma, com.id)
    expect(h).toMatchObject({ pagas: 1, vinculos: 1, temHistoria: true })
    expect(destinoExclusao(h.temHistoria)).toBe('relatorios')

    await prisma.loan.update({ where: { id: com.id }, data: { archivedAt: new Date() } })
    const visiveis = await prisma.loan.findMany({ where: { companyId, ...CONTRATO_VISIVEL }, select: { id: true } })
    expect(visiveis.map((v) => v.id)).toEqual([sem.id])
    // ⭐ a história sobrevive: a parcela paga e o encargo apurado continuam onde o DRE os lê
    expect(await prisma.loanInstallment.count({ where: { loanId: com.id, status: 'PAID', paidInterest: { not: null } } })).toBe(1)
    const c = await lerCarteiraDeEmprestimos(companyId, new Date('2026-11-25T12:00:00Z'), prisma)
    expect(c.contratos.map((k) => k.id)).toEqual([sem.id])
  })

  it('pós-fixado sem indexador é COBRADO; com indexador, não; o mútuo nunca', () => {
    expect(cadastroIncompleto({ rateType: 'POS', indexer: null, scheduleSource: 'IMPORTED' })).toEqual([{ campo: 'indexer', rotulo: 'indexador em branco' }])
    expect(cadastroIncompleto({ rateType: 'POS', indexer: 'SELIC', scheduleSource: 'IMPORTED' })).toEqual([])
    expect(cadastroIncompleto({ rateType: 'POS', indexer: null, scheduleSource: 'FLEXIBLE' })).toEqual([])
  })
})
