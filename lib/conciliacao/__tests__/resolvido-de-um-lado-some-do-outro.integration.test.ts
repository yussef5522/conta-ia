// ⛔⛔ "RESOLVIDO DE UM LADO, O OUTRO SOME NA HORA" — o guard que o dono pediu (20/09/2026)
//
// A régua de apresentação dele tem três partes; duas são de DIVISÃO (quem mora onde) e esta
// é de **CONSISTÊNCIA**: *"resolvido de um lado, o outro some na hora (já deve ser assim —
// guard)"*.
//
// ⚠️ *"Já deve ser assim"* é uma hipótese até alguém rodar. Este teste **executa** as duas
// leituras contra o banco e confere o par nos dois sentidos — porque uma superfície que
// continua oferecendo o que a outra já resolveu é o mesmo dinheiro em duas filas, que é a
// doença que a caixa inteira existe pra curar.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { LINHA_DISPONIVEL_WHERE } from '../fila-de-conciliacao'
import { lerCaixa, paraLei } from '../leitura-da-caixa'
import { estacaoDaLinha } from '../caixa-de-entrada'

const CNPJ = '50607080000616'
let companyId = ''
let contaId = ''
let supplierId = ''
let categoryId = ''
let linhaId = ''
let notaId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA DUAS CASAS' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', bankName: 'Sicredi' } })).id
  supplierId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'FRANCIELE DE LIMA DIAS' } })).id
  categoryId = (await prisma.category.create({ data: { companyId, name: 'Salários', type: 'EXPENSE' } })).id

  linhaId = (await prisma.transaction.create({
    data: {
      description: 'FRANCIELE DE LIMA DIAS - Transferência | Pix', amount: 500,
      date: new Date('2026-09-15'), type: 'DEBIT', lifecycle: 'EFFECTED', status: 'PENDING',
      origin: 'OFX', bankAccountId: contaId,
    },
  })).id
  notaId = (await prisma.transaction.create({
    data: {
      description: 'franciele', amount: 500, date: new Date('2026-09-14'),
      dueDate: new Date('2026-09-14'), type: 'DEBIT', lifecycle: 'PAYABLE', status: 'PENDING',
      origin: 'MANUAL', supplierId, categoryId,
    },
  })).id
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ bankAccount: { companyId } }, { supplier: { companyId } }, { category: { companyId } }] } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** ⭐ superfície 1 — a CAIXA: a linha ainda pede decisão? */
const estaNaCaixa = async () => {
  const { rows } = await lerCaixa(companyId)
  const r = rows.find((x) => x.id === linhaId)
  return !!r && estacaoDaLinha(paraLei(r)) === 'CAIXA'
}

/** ⭐ superfície 2 — o CARD: a linha ainda é oferecida como candidata? */
const oCardAindaOferece = async () =>
  (await prisma.transaction.count({ where: { id: linhaId, ...LINHA_DISPONIVEL_WHERE } })) === 1

describe('⛔⛔ resolvido de um lado, o outro some', () => {
  it('⭐ antes: as DUAS superfícies veem a linha (é o estado que cria a disputa)', async () => {
    expect(await estaNaCaixa()).toBe(true)
    expect(await oCardAindaOferece()).toBe(true)
  })

  it('⭐⭐ conciliada (o gesto do CARD) → some das duas', async () => {
    // é o que o reconcile grava no CLASSIC: a conta aponta pra linha
    await prisma.transaction.update({
      where: { id: notaId },
      data: { lifecycle: 'EFFECTED', status: 'RECONCILED', reconciledWithId: linhaId, bankAccountId: contaId },
    })
    expect(await estaNaCaixa(), 'a linha ficou na caixa depois de conciliada — duas filas').toBe(false)
    expect(await oCardAindaOferece(), 'o card continuaria oferecendo dinheiro que já tem dono').toBe(false)
  })

  it('⭐⭐ ignorada (um gesto da CAIXA) → some das duas', async () => {
    await prisma.transaction.update({ where: { id: linhaId }, data: { ignoredAt: new Date() } })
    expect(await estaNaCaixa()).toBe(false)
    expect(await oCardAindaOferece()).toBe(false)
  })

  /**
   * ⛔⛔ E A EXCEÇÃO DELIBERADA, que este teste existe pra travar: **categorizar NÃO tira a
   * linha do card**. A régua de 07/09 é explícita — *"ter categoria não quita conta
   * nenhuma"* — e é ela que faz a Tiele continuar sendo candidata da conta «franciele».
   * ⚠️ As duas perguntas convivem: a linha sai da CAIXA (não pede mais decisão) e continua
   * elegível pro card (ainda pode ser o pagamento de uma conta em aberto).
   */
  it('⛔ categorizar tira da CAIXA e MANTÉM no card — de propósito', async () => {
    await prisma.transaction.update({ where: { id: linhaId }, data: { categoryId, status: 'RECONCILED' } })
    expect(await estaNaCaixa(), 'a linha categorizada continua pedindo decisão').toBe(false)
    expect(await oCardAindaOferece(), 'esconder aqui esconderia o pagamento lançado como despesa avulsa').toBe(true)
  })
})
