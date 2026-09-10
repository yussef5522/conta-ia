// ⭐⭐⭐ BAIXA PARCIAL, contra o banco — os casos REAIS de prod (10/09/2026).
//
// **O dono:** *"Box Paper: 3 notas × linha 5.211,85 → duas inteiras + parcial 283,04 na NF
// 6477, restante 1.797,09 em aberto e visível. Oesa: linha 1.838,61 × 2 notas 2.380,11 →
// mesma mecânica."*
//
// ⛔ E a régua que este arquivo trava: **o em aberto é DERIVADO da soma das baixas**, nunca
// um status escrito à mão. Desfazer devolve o saldo sozinho.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  aplicarBaixaParcial, jaPagoPorConta, desfazerBaixasDoGrupo, BaixaParcialError,
} from '../aplicar-baixa-parcial'

const db = new PrismaClient()
let companyId = ''
let contaBancariaId = ''
let fornecedorId = ''
const ids: Record<string, string> = {}

const criarPayable = async (desc: string, valor: number, venc: string) =>
  (await db.transaction.create({
    data: {
      description: desc, amount: valor, type: 'DEBIT', date: new Date(`${venc}T12:00:00.000Z`),
      dueDate: new Date(`${venc}T00:00:00.000Z`), lifecycle: 'PAYABLE', status: 'PENDING',
      origin: 'MANUAL', supplierId: fornecedorId,
    },
  })).id

beforeAll(async () => {
  const c = await db.company.create({
    data: { name: 'Baixa parcial teste', cnpj: `${Date.now()}`.slice(-14).padStart(14, '5') },
  })
  companyId = c.id
  const acc = await db.bankAccount.create({
    data: { companyId, name: 'stone', bankName: 'Stone', accountNumber: '1', balance: 0 },
  })
  contaBancariaId = acc.id
  const f = await db.supplier.create({ data: { companyId, razaoSocial: 'BOX PAPER EMBALAGENS LTDA' } })
  fornecedorId = f.id

  // ⭐ os números REAIS medidos em prod
  ids.nf6472 = await criarPayable('NF 6472', 3799.60, '2026-09-10')
  ids.nf6474 = await criarPayable('NF 6474', 1129.21, '2026-09-10')
  ids.nf6477 = await criarPayable('NF 6477', 2080.13, '2026-09-10')
  ids.oesaA = await criarPayable('OESA NF 3866696', 1641.12, '2026-09-10')
  ids.oesaB = await criarPayable('OESA NF 3866706', 738.99, '2026-09-10')

  ids.linhaBox = (await db.transaction.create({
    data: {
      description: 'BOX PAPER EMBALAGENS LTDA - Pagamento', amount: 5211.85, type: 'DEBIT',
      date: new Date('2026-09-02T12:00:00.000Z'), lifecycle: 'EFFECTED', status: 'PENDING',
      origin: 'OFX', bankAccountId: contaBancariaId,
    },
  })).id
  ids.linhaOesa = (await db.transaction.create({
    data: {
      description: 'OESA COMERCIO E REPRESENTACOES S A - Pagamento', amount: 1838.61, type: 'DEBIT',
      date: new Date('2026-09-08T12:00:00.000Z'), lifecycle: 'EFFECTED', status: 'PENDING',
      origin: 'OFX', bankAccountId: contaBancariaId,
    },
  })).id
})

afterAll(async () => {
  await db.conciliacaoBaixaParcial.deleteMany({ where: { companyId } })
  await db.transaction.deleteMany({ where: { OR: [{ supplierId: fornecedorId }, { bankAccountId: contaBancariaId }] } })
  await db.supplier.deleteMany({ where: { companyId } })
  await db.bankAccount.deleteMany({ where: { companyId } })
  await db.company.deleteMany({ where: { id: companyId } })
  await db.$disconnect()
})

describe('⭐⭐ BOX PAPER — 283,04 na NF 6477, 1.797,09 continuam em aberto', () => {
  it('⭐ a baixa grava e o EM ABERTO é derivado', async () => {
    const r = await aplicarBaixaParcial({
      companyId, payableId: ids.nf6477, extratoId: ids.linhaBox, valor: 283.04,
      reconcileGroupId: 'rg_box',
    }, db)
    expect(r.pagoTotal).toBeCloseTo(283.04, 2)
    expect(r.emAberto).toBeCloseTo(1797.09, 2)
    expect(r.quitou).toBe(false)
  })

  it('⛔⛔ e a conta CONTINUA em aberto — parcial não é paga', async () => {
    const c = await db.transaction.findUniqueOrThrow({ where: { id: ids.nf6477 } })
    expect(c.lifecycle).toBe('PAYABLE')
    expect(c.status).toBe('PENDING')
    expect(c.reconciledWithId).toBeNull()
  })

  it('⭐ o quanto já foi pago sai da SOMA das baixas, não de um campo', async () => {
    expect((await jaPagoPorConta([ids.nf6477], db)).get(ids.nf6477)).toBeCloseTo(283.04, 2)
  })

  it('⛔ e a MESMA linha não baixa a MESMA conta duas vezes — o banco recusa', async () => {
    await expect(aplicarBaixaParcial({
      companyId, payableId: ids.nf6477, extratoId: ids.linhaBox, valor: 10,
    }, db)).rejects.toThrow()
  })
})

describe('⛔⛔ NUNCA MAIS DO QUE A CONTA DEVE', () => {
  it('recusa a baixa que faria o em aberto ficar negativo', async () => {
    await expect(aplicarBaixaParcial({
      companyId, payableId: ids.nf6472, extratoId: ids.linhaOesa, valor: 9999,
    }, db)).rejects.toThrow(BaixaParcialError)
  })

  it('⛔ e recusa baixa em conta já conciliada por inteiro', async () => {
    await db.transaction.update({
      where: { id: ids.nf6474 },
      data: { reconciledWithId: ids.linhaBox, status: 'RECONCILED', lifecycle: 'EFFECTED' },
    })
    await expect(aplicarBaixaParcial({
      companyId, payableId: ids.nf6474, extratoId: ids.linhaOesa, valor: 1,
    }, db)).rejects.toThrow(/já está conciliada/)
    await db.transaction.update({
      where: { id: ids.nf6474 },
      data: { reconciledWithId: null, status: 'PENDING', lifecycle: 'PAYABLE' },
    })
  })
})

describe('⭐⭐ O INVERSO — N linhas pagando 1 nota, até o em aberto zerar', () => {
  it('duas baixas na OESA NF 3866696: 1.099,62 + 541,50 = quitada', async () => {
    const a = await aplicarBaixaParcial({
      companyId, payableId: ids.oesaA, extratoId: ids.linhaOesa, valor: 1099.62,
      reconcileGroupId: 'rg_oesa',
    }, db)
    expect(a.emAberto).toBeCloseTo(541.50, 2)
    expect(a.quitou).toBe(false)

    const segunda = await db.transaction.create({
      data: {
        description: 'OESA - 2º PIX', amount: 541.50, type: 'DEBIT',
        date: new Date('2026-09-11T12:00:00.000Z'), lifecycle: 'EFFECTED', status: 'PENDING',
        origin: 'OFX', bankAccountId: contaBancariaId,
      },
    })
    const b = await aplicarBaixaParcial({
      companyId, payableId: ids.oesaA, extratoId: segunda.id, valor: 541.50,
      reconcileGroupId: 'rg_oesa2',
    }, db)
    expect(b.emAberto).toBeCloseTo(0, 2)
    expect(b.quitou).toBe(true)

    // ⭐ quitou → a conta sai da fila pelo caminho normal
    const c = await db.transaction.findUniqueOrThrow({ where: { id: ids.oesaA } })
    expect(c.lifecycle).toBe('EFFECTED')
    expect(c.status).toBe('RECONCILED')
    expect(c.reconciledWithId).toBe(segunda.id)
  })
})

describe('⭐ DESFAZER devolve o saldo sozinho', () => {
  it('⛔ apagar as baixas do grupo REABRE a conta que tinha sido quitada', async () => {
    const n = await desfazerBaixasDoGrupo('rg_oesa2', db)
    expect(n).toBe(1)
    const c = await db.transaction.findUniqueOrThrow({ where: { id: ids.oesaA } })
    // ⚠️ sem isto ficaria uma conta "paga" com o dinheiro de volta em aberto —
    // a dupla contagem ao contrário.
    expect(c.lifecycle).toBe('PAYABLE')
    expect(c.status).toBe('PENDING')
    expect(c.reconciledWithId).toBeNull()
    expect((await jaPagoPorConta([ids.oesaA], db)).get(ids.oesaA)).toBeCloseTo(1099.62, 2)
  })
})
