// CICLO COMPLETO DO CARTÃO PF (26/08) — cadastrar → importar fatura → casar → PAGA.
//
// Roda contra o banco de teste, com a FATURA REAL do dono (anonimizada, colunas
// preservadas). É o teste que prova que o ciclo que a PJ tinha existe agora na PF.
//
// ⚠️ O isolamento PF↔PJ é testado de verdade (não por leitura de código): cria uma
// empresa com cartão PJ ao lado e confere que nenhuma das duas enxerga a outra.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { previewFaturaPF, confirmarFaturaPF } from '../importar-fatura-pf'
import { candidatosPagamentoPF, casarPagamentoPF, desfazerCasamentoPF } from '../casar-pagamento-pf'
import { checkCardInvariantsPF } from '../card-invariants-pf'

const db = new PrismaClient()
const TEXTO = readFileSync(
  join(__dirname, '../../fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt'),
  'utf-8',
)

let userId = ''
let outroUserId = ''
let profileId = ''
let cardId = ''
let contaId = ''
let companyId = ''
let pjCardId = ''

beforeAll(async () => {
  const u = await db.user.create({
    data: { email: `pf-ciclo-${Date.now()}@t.com`, password: 'x', name: 'Dono', role: 'USER' },
  })
  userId = u.id
  const u2 = await db.user.create({
    data: { email: `pf-outro-${Date.now()}@t.com`, password: 'x', name: 'Outro', role: 'USER' },
  })
  outroUserId = u2.id

  const p = await db.personalProfile.create({ data: { name: 'Dono PF', type: 'OWN' } })
  profileId = p.id
  await db.userPersonalProfile.create({ data: { userId, profileId, role: 'OWNER' } })

  // cartão com o fechamento/vencimento REAIS do dono: fecha 29, vence 10
  const c = await db.creditCard.create({
    data: {
      profileId, name: 'banrisul pf', bankName: 'banrisul', lastDigits: '9113',
      brand: 'MASTERCARD', creditLimit: 76150, closingDay: 29, dueDay: 10, closingDayRule: 'ATUAL',
    },
  })
  cardId = c.id
  const acc = await db.personalBankAccount.create({
    data: { profileId, name: 'banrisul', balance: 0 },
  })
  contaId = acc.id

  // ── vizinho PJ, pro teste de isolamento ──
  const emp = await db.company.create({
    data: { name: 'Empresa vizinha', cnpj: `${Date.now()}`.slice(-14).padStart(14, '7') },
  })
  companyId = emp.id
  const pj = await db.businessCreditCard.create({
    data: { companyId, name: 'cartão da empresa', closingDay: 5, dueDay: 15, creditLimit: 10000 },
  })
  pjCardId = pj.id
})

afterAll(async () => {
  await db.personalProfile.delete({ where: { id: profileId } }).catch(() => {})
  await db.company.delete({ where: { id: companyId } }).catch(() => {})
  await db.user.deleteMany({ where: { id: { in: [userId, outroUserId] } } }).catch(() => {})
  await db.$disconnect()
})

describe('1. importar a fatura real', () => {
  it('⭐ o preview CONFERE e fecha ao centavo', async () => {
    const p = await previewFaturaPF({ userId, profileId, cardId, texto: TEXTO })
    expect(p.ok).toBe(true)
    expect(p.erro).toBeNull()
    expect(p.conferencia.despesasCalculado).toBeCloseTo(39302.64, 2)
    expect(p.conferencia.saldoCalculado).toBeCloseTo(18348.72, 2)
    expect(p.vencimento).toBe('2026-08-10')
    expect(p.portadores.sort()).toEqual(['5349', '9113'])
    expect(p.novas).toBe(p.linhas.length) // primeira vez: tudo novo
  })

  it('grava os lançamentos na fatura do VENCIMENTO do PDF', async () => {
    const r = await confirmarFaturaPF({ userId, profileId, cardId, texto: TEXTO })
    expect(r.criadas).toBeGreaterThan(100)
    expect(r.puladas).toBe(0)
    const inv = await db.creditCardInvoice.findUniqueOrThrow({ where: { id: r.invoiceId } })
    // ⚠️ a fatura é UMA só — os dois portadores entram nela (decisão do dono)
    expect(inv.dueDate.toISOString().slice(0, 10)).toBe('2026-08-10')
    const linhas = await db.personalTransaction.count({ where: { creditCardInvoiceId: inv.id } })
    expect(linhas).toBe(r.criadas)
  })

  it('⭐ IDEMPOTENTE: importar o MESMO PDF de novo não duplica nada', async () => {
    const antes = await db.personalTransaction.count({ where: { creditCardId: cardId } })
    const r2 = await confirmarFaturaPF({ userId, profileId, cardId, texto: TEXTO })
    expect(r2.criadas).toBe(0)
    expect(r2.puladas).toBeGreaterThan(100)
    expect(await db.personalTransaction.count({ where: { creditCardId: cardId } })).toBe(antes)
  })

  it('cada lançamento guarda o portador, a parcela e o sinal', async () => {
    const linhas = await db.personalTransaction.findMany({ where: { creditCardId: cardId } })
    expect(linhas.every((l) => l.amount > 0)).toBe(true) // sinal vem do type
    expect(linhas.some((l) => l.type === 'CREDIT')).toBe(true) // o estorno entrou
    expect(linhas.some((l) => l.installmentTotal != null)).toBe(true)
    expect(linhas.some((l) => l.notes?.includes('****5349'))).toBe(true)
    expect(linhas.some((l) => l.notes?.includes('****9113'))).toBe(true)
  })
})

describe('2. casar o pagamento que já está no extrato', () => {
  let invoiceId = ''
  let pagamentoId = ''

  it('o débito do extrato aparece como candidato, com valor exato primeiro', async () => {
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { creditCardId: cardId } })
    invoiceId = inv.id
    // o pagamento REAL: o dono pagou o total no vencimento, e isso veio no extrato
    const pg = await db.personalTransaction.create({
      data: {
        profileId, bankAccountId: contaId, date: new Date(Date.UTC(2026, 7, 10)),
        description: 'DEB.CTA.FATURA CARTAO', amount: inv.totalAmount, type: 'DEBIT',
        status: 'RECONCILED', origin: 'OFX',
      },
    })
    pagamentoId = pg.id
    const r = await candidatosPagamentoPF({ userId, profileId, invoiceId })
    expect(r.candidatos[0].id).toBe(pagamentoId)
    expect(r.candidatos[0].valorExato).toBe(true)
    expect(r.devido).toBeCloseTo(inv.totalAmount, 2)
  })

  it('⭐ casar marca a fatura como PAGA', async () => {
    const r = await casarPagamentoPF({ userId, profileId, invoiceId, transactionId: pagamentoId })
    expect(r.status).toBe('PAID')
    expect(r.devido).toBeCloseTo(0, 2)
    const inv = await db.creditCardInvoice.findUniqueOrThrow({ where: { id: invoiceId } })
    expect(inv.status).toBe('PAID')
    expect(inv.paidAmount).toBeCloseTo(inv.totalAmount, 2)
  })

  it('⚠️ NÃO cria transação nova nem mexe no saldo (o dinheiro já saiu)', async () => {
    const conta = await db.personalBankAccount.findUniqueOrThrow({ where: { id: contaId } })
    expect(conta.balance).toBe(0) // intocado — quem debita é o payInvoice, não o casamento
    const pagamentos = await db.personalTransaction.count({
      where: { profileId, isInvoicePayment: true },
    })
    expect(pagamentos).toBe(1) // o que já existia, não um segundo
  })

  it('não deixa casar duas vezes o mesmo lançamento', async () => {
    await expect(
      casarPagamentoPF({ userId, profileId, invoiceId, transactionId: pagamentoId }),
    ).rejects.toThrow(/já/i)
  })

  it('desfazer devolve a tx pro extrato e a fatura sai de PAGA', async () => {
    const r = await desfazerCasamentoPF({ userId, profileId, transactionId: pagamentoId })
    expect(r.status).toBe('CLOSED')
    const tx = await db.personalTransaction.findUniqueOrThrow({ where: { id: pagamentoId } })
    expect(tx.isInvoicePayment).toBe(false)
    expect(tx.creditCardInvoiceId).toBeNull()
    // recasa pra deixar o estado bom pro juiz abaixo
    await casarPagamentoPF({ userId, profileId, invoiceId, transactionId: pagamentoId })
  })
})

describe('3. o juiz KP cobre a PF', () => {
  it('⭐ com a fatura importada e paga, fica VERDE', async () => {
    const fails = await checkCardInvariantsPF(db, profileId, 'Dono PF', new Date(Date.UTC(2026, 7, 12)))
    expect(fails.map((f) => `${f.invariante}: ${f.detalhe}`)).toEqual([])
  })

  it('KP1 pega fatura cujo total não bate com as linhas', async () => {
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { creditCardId: cardId } })
    await db.creditCardInvoice.update({ where: { id: inv.id }, data: { totalAmount: inv.totalAmount + 100 } })
    const fails = await checkCardInvariantsPF(db, profileId, 'Dono PF', new Date(Date.UTC(2026, 7, 12)))
    expect(fails.some((f) => f.invariante === 'KP1')).toBe(true)
    await db.creditCardInvoice.update({ where: { id: inv.id }, data: { totalAmount: inv.totalAmount } })
  })

  it('KP2 pega fatura PAGA sem dinheiro suficiente', async () => {
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { creditCardId: cardId } })
    await db.creditCardInvoice.update({ where: { id: inv.id }, data: { paidAmount: 1 } })
    const fails = await checkCardInvariantsPF(db, profileId, 'Dono PF', new Date(Date.UTC(2026, 7, 12)))
    expect(fails.some((f) => f.invariante === 'KP2')).toBe(true)
    await db.creditCardInvoice.update({ where: { id: inv.id }, data: { paidAmount: inv.paidAmount } })
  })
})

describe('4. isolamento PF ↔ PJ é absoluto', () => {
  it('o cartão PF não aparece entre os cartões da empresa', async () => {
    const daEmpresa = await db.businessCreditCard.findMany({ where: { companyId }, select: { id: true } })
    expect(daEmpresa.map((c) => c.id)).toEqual([pjCardId])
  })

  it('o cartão PJ não aparece entre os cartões do perfil', async () => {
    const doPerfil = await db.creditCard.findMany({ where: { profileId }, select: { id: true } })
    expect(doPerfil.map((c) => c.id)).toEqual([cardId])
  })

  it('⭐ nenhuma linha da fatura PF virou Transaction da empresa', async () => {
    const naEmpresa = await db.transaction.count({ where: { bankAccount: { companyId } } })
    expect(naEmpresa).toBe(0)
    const noCartaoPJ = await db.transaction.count({ where: { businessCreditCardId: pjCardId } })
    expect(noCartaoPJ).toBe(0)
  })

  it('⭐ outro usuário NÃO consegue importar no meu perfil (REGRA 8)', async () => {
    await expect(
      previewFaturaPF({ userId: outroUserId, profileId, cardId, texto: TEXTO }),
    ).rejects.toThrow()
  })

  it('⭐ outro usuário NÃO consegue casar pagamento no meu perfil', async () => {
    const inv = await db.creditCardInvoice.findFirstOrThrow({ where: { creditCardId: cardId } })
    await expect(
      candidatosPagamentoPF({ userId: outroUserId, profileId, invoiceId: inv.id }),
    ).rejects.toThrow()
  })
})
