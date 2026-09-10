// ⭐⭐⭐ O CARD DO MAGALU — "vence HOJE" e vira "paga ✓" sem o dono tocar em nada além
// de confirmar QUAL débito foi (09/09/2026).
//
// **O dono:** *"o Magalu (fatura 4.491,18, venceu HOJE 09/09) tem que aparecer coral
// 'vence hoje' — e quando o pagamento aparecer no extrato e for categorizado, virar
// 'paga ✓' sem eu tocar em nada."*
//
// ⚠️ O QUE O SISTEMA **NÃO** FAZ SOZINHO, e é decisão de desenho: escolher **qual débito
// pagou qual cartão**. Ele tem 4 cartões e os valores podem se parecer; casar por conta
// própria marcaria uma fatura como paga com o dinheiro de outra, e desfazer isso depois
// custa mais que um clique. O card **oferece o candidato com o motivo**; daí em diante o
// estado é derivado — nenhum job, nenhuma coluna nova.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { listarCartoesComEstado } from '../cards-com-estado'
import { casarPagamentoPF } from '../casar-pagamento-pf'

const db = new PrismaClient()
// ⚠️ calendário congelado e relativo — ver a nota em `estado-da-fatura-no-card.test.ts`
const HOJE = new Date('2026-09-09T12:00:00.000Z')
const maisDias = (n: number) => new Date(HOJE.getTime() + n * 86_400_000)

let userId = ''
let profileId = ''
let cardId = ''
let invoiceId = ''
let contaId = ''
let pagamentoId = ''

beforeAll(async () => {
  const u = await db.user.create({
    data: { email: `pf-card-${Date.now()}@t.com`, password: 'x', name: 'Dono', role: 'USER' },
  })
  userId = u.id
  const p = await db.personalProfile.create({ data: { name: 'Dono PF', type: 'OWN' } })
  profileId = p.id
  await db.userPersonalProfile.create({ data: { userId, profileId, role: 'OWNER' } })

  // ⭐ o cartão REAL do dono: fecha 2, vence 9
  const c = await db.creditCard.create({
    data: {
      profileId, name: 'magazine luiza', bankName: 'Itaú', lastDigits: '2971',
      brand: 'MASTERCARD', creditLimit: 6535, closingDay: 2, dueDay: 9, closingDayRule: 'ATUAL',
    },
  })
  cardId = c.id
  const inv = await db.creditCardInvoice.create({
    data: {
      creditCardId: cardId, reference: '2026-09',
      closingDate: new Date('2026-09-02T00:00:00.000Z'),
      dueDate: new Date('2026-09-09T00:00:00.000Z'),
      totalAmount: 4491.18, paidAmount: 0, status: 'OPEN',
    },
  })
  invoiceId = inv.id
  const acc = await db.personalBankAccount.create({
    data: { profileId, name: 'banrisul', balance: 0 },
  })
  contaId = acc.id
})

afterAll(async () => {
  await db.personalTransaction.deleteMany({ where: { profileId } })
  await db.creditCardInvoice.deleteMany({ where: { creditCardId: cardId } })
  await db.creditCard.deleteMany({ where: { profileId } })
  await db.personalBankAccount.deleteMany({ where: { profileId } })
  await db.userPersonalProfile.deleteMany({ where: { profileId } })
  await db.personalProfile.deleteMany({ where: { id: profileId } })
  await db.user.deleteMany({ where: { id: userId } })
  await db.$disconnect()
})

describe('⭐⭐ o card do Magalu, no dia do vencimento', () => {
  it('⛔ diz "vence HOJE" em alerta, com o valor — antes ele só dizia "vence dia 9"', async () => {
    const [card] = await listarCartoesComEstado(userId, profileId, HOJE)
    expect(card.fatura.estado).toBe('VENCE_HOJE')
    expect(card.fatura.tom).toBe('alerta')
    expect(card.fatura.frase.replace(/ /g, ' ')).toBe('R$ 4.491,18 · vence HOJE')
    expect(card.fatura.invoiceId).toBe(invoiceId)
  })

  it('⭐ e ainda NÃO há pagamento pra sugerir — o extrato não entrou', async () => {
    const [card] = await listarCartoesComEstado(userId, profileId, HOJE)
    expect(card.pagamentoSugerido).toBeNull()
  })
})

describe('⭐⭐⭐ o extrato entra — e o card muda de estado', () => {
  it('⭐ o débito de valor EXATO vira o candidato, com o motivo', async () => {
    const t = await db.personalTransaction.create({
      data: {
        profileId, bankAccountId: contaId, type: 'DEBIT', amount: 4491.18,
        date: new Date('2026-09-09T12:00:00.000Z'),
        description: 'PAGAMENTO FATURA LUIZACRED', status: 'RECONCILED', origin: 'OFX',
      },
    })
    pagamentoId = t.id
    const [card] = await listarCartoesComEstado(userId, profileId, HOJE)
    // ⛔ ainda NÃO é paga: sugerir não é registrar
    expect(card.fatura.estado).toBe('VENCE_HOJE')
    expect(card.pagamentoSugerido?.transacaoId).toBe(pagamentoId)
    expect(card.pagamentoSugerido?.valor).toBeCloseTo(4491.18, 2)
    expect(card.pagamentoSugerido?.distanciaDias).toBe(0)
  })

  it('⭐⭐ confirmado o vínculo, o card vira "paga ✓" — derivado, sem tocar em mais nada', async () => {
    await casarPagamentoPF({ userId, profileId, invoiceId, transactionId: pagamentoId })
    const [card] = await listarCartoesComEstado(userId, profileId, HOJE)
    expect(card.fatura.estado).toBe('PAGA')
    expect(card.fatura.tom).toBe('ok')
    expect(card.fatura.frase).toBe('paga ✓ em 09/09')
    expect(card.fatura.pagoEm).toBe('2026-09-09')
    // ⚠️ e o candidato some: o débito já tem dono
    expect(card.pagamentoSugerido).toBeNull()
  })

  it('⛔⛔ e a fatura seguinte não herda o verde — cada ciclo por si', async () => {
    // ⚠️ o "paga ✓" é da fatura de setembro; em outubro o card volta a falar do ciclo novo.
    const emOutubro = await listarCartoesComEstado(
      userId, profileId, maisDias(26),
    )
    expect(emOutubro[0].fatura.cicloCorrenteSemFatura).toBe(true)
  })
})

describe('⛔⛔ a régua do PAGO é o VÍNCULO, não a semelhança', () => {
  it('⛔ débito de valor DIFERENTE não é oferecido como pagamento', async () => {
    const outra = await db.creditCardInvoice.create({
      data: {
        creditCardId: cardId, reference: '2026-08',
        closingDate: new Date('2026-08-02T00:00:00.000Z'),
        dueDate: new Date('2026-08-09T00:00:00.000Z'),
        totalAmount: 1000, paidAmount: 0, status: 'OPEN',
      },
    })
    await db.personalTransaction.create({
      data: {
        profileId, bankAccountId: contaId, type: 'DEBIT', amount: 998.5, // ⚠️ perto, não exato
        date: new Date('2026-08-09T12:00:00.000Z'),
        description: 'PIX QUALQUER', status: 'RECONCILED', origin: 'OFX',
      },
    })
    const [card] = await listarCartoesComEstado(
      userId, profileId, new Date('2026-08-09T12:00:00.000Z'),
    )
    expect(card.fatura.estado).toBe('VENCE_HOJE')
    expect(card.fatura.invoiceId).toBe(outra.id)
    // ⛔ "parecido" não vira sugestão — marcaria a fatura como paga com o dinheiro errado
    expect(card.pagamentoSugerido).toBeNull()
  })
})
