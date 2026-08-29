// ITEM 4 — O SELF-HEAL VIRA COMPORTAMENTO DOCUMENTADO, NÃO SORTE (28/08).
//
// ⚠️ O CENÁRIO É REAL, mas NÃO foi o que houve nos 2.444,62: lá a linha estava no arquivo e
// o SISTEMA a descartou (ver fitid-nao-descarta-emprestimo.test.ts). Extrato incompleto
// acontece de verdade — o banco lança ao longo do dia — então o ciclo abaixo precisa estar
// travado do mesmo jeito: linha atrasada chega num re-export, entra pelo dedup e fecha o
// buraco sozinha, sem duplicar.
//
// ⚠️ Isso funcionou por DESENHO (dedup por `stableKey`), mas nunca esteve travado por
// teste. Este arquivo trava o ciclo inteiro contra o banco real:
//     import incompleto → juiz VERMELHO → re-import com a linha → VERDE, sem duplicar.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerConta, checkSaldosBancarios } from '../ler-conferencia'
import { avaliarConta } from '../ledgerbal-invariants'

const CNPJ = '36363636000136'
let companyId: string
let contaId: string
let userId: string

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const HOJE = D('2026-08-28')

/** grava um import com o saldo que o banco declarou naquele dia */
const declarar = (anchorDate: Date, ledgerBalAmount: number, status = 'SUCCESS') =>
  prisma.ofxImport.create({
    data: { bankAccountId: contaId, userId, status, fileName: 'x.ofx', rawOfxBlob: '<OFX/>', anchorDate, ledgerBalAmount, totalTransactions: 0, newTransactions: 0 },
  })

const lancar = (date: Date, amount: number, type: 'CREDIT' | 'DEBIT', description: string) =>
  prisma.transaction.create({
    data: { bankAccountId: contaId, date, amount, type, description, lifecycle: 'EFFECTED', status: 'PENDING' },
  })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SELFHEAL' } })).id
  userId = (await prisma.user.create({ data: { email: `selfheal-${Date.now()}@t.com`, password: 'x', name: 'T' } })).id
  contaId = (await prisma.bankAccount.create({
    data: { companyId, name: 'banrisul', bankCode: '041', accountNumber: '1', balance: -9434.99, ledgerBal: -9434.99, ledgerBalDate: D('2026-08-25') },
  })).id
  // o banco declarou -9.434,99 em 25/08 (o estado real da Caçula)
  await declarar(D('2026-08-25'), -9434.99)
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaId } })
  await prisma.ofxImport.deleteMany({ where: { bankAccountId: contaId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** as linhas de 26–28/08 do arquivo real, MENOS o empréstimo (o export de mesmo dia) */
async function importarIncompleto() {
  await lancar(D('2026-08-26'), 3965.48, 'CREDIT', 'OP. CREDITO C/GARANTIA')
  await lancar(D('2026-08-26'), 336.32, 'CREDIT', 'ANTECIP STONE')
  await lancar(D('2026-08-26'), 244.59, 'CREDIT', 'DEBITO STONE')
  await lancar(D('2026-08-26'), 2500, 'DEBIT', 'CACULA MIX')
  await lancar(D('2026-08-27'), 6976.93, 'CREDIT', 'OP. CREDITO C/GARANTIA')
  await lancar(D('2026-08-27'), 386.54, 'CREDIT', 'ANTECIP STONE')
  await lancar(D('2026-08-27'), 261.35, 'CREDIT', 'DEBITO STONE')
  await lancar(D('2026-08-27'), 500, 'DEBIT', 'YUSSEF')
  await lancar(D('2026-08-27'), 7000, 'DEBIT', 'CACULA MIX')
  await lancar(D('2026-08-28'), 7549.18, 'CREDIT', 'OP.CREDITO C/GARANTIA')
  await lancar(D('2026-08-28'), 417.82, 'CREDIT', 'ANTECIP STONE')
  await lancar(D('2026-08-28'), 474.37, 'CREDIT', 'DEBITO STONE')
  // o banco declara o saldo REAL (que já inclui o débito de empréstimo)
  await declarar(D('2026-08-28'), -1267.03)
}

/** o que o `recalcularSaldoConta` faz depois de cada import: cache = âncora + posterior */
async function recalcularCache() {
  const txs = await prisma.transaction.findMany({ where: { bankAccountId: contaId, lifecycle: 'EFFECTED' }, select: { date: true, amount: true, type: true } })
  const conta = await prisma.bankAccount.findUnique({ where: { id: contaId } })
  const pos = txs.filter((t) => t.date > conta!.ledgerBalDate!).reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0)
  await prisma.bankAccount.update({ where: { id: contaId }, data: { balance: Math.round((conta!.ledgerBal! + pos) * 100) / 100 } })
}

describe('⭐⭐ o ciclo do self-heal, travado', () => {
  it('⭐ import INCOMPLETO (export de mesmo dia) → juiz VERMELHO com o valor exato', async () => {
    await importarIncompleto()
    const l = (await lerConta(contaId, prisma))!
    const checks = avaliarConta(l, HOJE)
    const b1 = checks.find((c) => c.invariante === 'B1')!
    expect(b1).toBeDefined()
    expect(b1.nivel).toBe('erro')
    expect(Math.abs(b1.diferenca!)).toBeCloseTo(2444.62, 2) // o buraco real
  })

  it('⭐⭐ re-import traz a linha atrasada → VERDE, e sem duplicar', async () => {
    await importarIncompleto()
    // o re-export do dia seguinte traz a linha que faltava
    await lancar(D('2026-08-26'), 2444.62, 'DEBIT', 'EMPRESTIMO')
    await recalcularCache() // é o que o import faz de verdade

    const l = (await lerConta(contaId, prisma))!
    expect(avaliarConta(l, HOJE).filter((c) => c.nivel === 'erro')).toEqual([])

    // e ela entrou UMA vez só
    const n = await prisma.transaction.count({ where: { bankAccountId: contaId, description: 'EMPRESTIMO' } })
    expect(n).toBe(1)
  })

  it('⚠️ se o re-import DUPLICASSE a linha, o juiz acusaria do outro lado', async () => {
    await importarIncompleto()
    await lancar(D('2026-08-26'), 2444.62, 'DEBIT', 'EMPRESTIMO')
    await lancar(D('2026-08-26'), 2444.62, 'DEBIT', 'EMPRESTIMO') // duplicata
    const b1 = avaliarConta((await lerConta(contaId, prisma))!, HOJE).find((c) => c.invariante === 'B1')!
    expect(b1).toBeDefined()
    // a saída duplicada faz o sistema somar MENOS — e a mensagem oferece as DUAS causas
    expect(b1.detalhe).toContain('SAÍDA duplicada')
  })
})

describe('a leitura usa as âncoras que JÁ existiam no banco de dados', () => {
  it('⭐ PREVIEW não conta como declaração (é simulação, não import aceito)', async () => {
    await importarIncompleto()
    await declarar(D('2026-08-29'), 999999, 'PREVIEW')
    const l = (await lerConta(contaId, prisma))!
    expect(l.ancoras.map((a) => a.data.toISOString().slice(0, 10))).toEqual(['2026-08-25', '2026-08-28'])
  })

  it('⚠️ duas declarações do MESMO dia: fica a ÚLTIMA (aconteceu em 26/08)', async () => {
    await declarar(D('2026-08-26'), -6408.68)
    await declarar(D('2026-08-26'), -9434.99)
    const l = (await lerConta(contaId, prisma))!
    const doDia = l.ancoras.filter((a) => a.data.toISOString().slice(0, 10) === '2026-08-26')
    expect(doDia).toHaveLength(1)
    expect(doDia[0].valor).toBe(-9434.99)
  })

  it('só EFFECTED entra (conta a pagar em aberto não é caixa)', async () => {
    await importarIncompleto()
    await prisma.transaction.create({
      data: { bankAccountId: contaId, date: D('2026-08-27'), amount: 5000, type: 'DEBIT', description: 'AGENDADO', lifecycle: 'PAYABLE', status: 'PENDING' },
    })
    const l = (await lerConta(contaId, prisma))!
    // a agendada NÃO mexe no intervalo (senão o invariante acusaria buraco fantasma)
    expect(Math.abs(avaliarConta(l, HOJE).find((c) => c.invariante === 'B1')!.diferenca!)).toBeCloseTo(2444.62, 2)
  })
})

describe('o juiz varre todas as contas', () => {
  it('conta conferindo não aparece no relatório', async () => {
    await importarIncompleto()
    await lancar(D('2026-08-26'), 2444.62, 'DEBIT', 'EMPRESTIMO')
    await recalcularCache()
    const todos = await checkSaldosBancarios(prisma, HOJE)
    expect(todos.filter((c) => c.bankAccountId === contaId && c.nivel === 'erro')).toEqual([])
  })
})
