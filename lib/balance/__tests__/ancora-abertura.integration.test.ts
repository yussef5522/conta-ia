// ⭐⭐ O SALDO PASSA A VIR DO NOSSO LEDGER (01/09/2026) — e o banco vira conferência.
//
// Reproduz o caso REAL do Banrisul da Caçula com os números do PDF de 01/09:
// abertura 31/07 = −22.188,17 · agosto inteiro no ledger · contábil 28/08 = −4.567,03.
// Antes deste sprint a conta mostrava **−6.267,03** — o LEDGERBAL do OFX, que é o saldo
// DISPONÍVEL (já sem o bloqueado de 1.700). Fantasma de R$ 1.700 com o ledger correto.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { recalcularSaldoConta } from '../recalcular'
import { definirAncoraDeAbertura, gravarReguaDeclarada, diaUtc } from '../ancora-abertura'

const CNPJ = '50505050000199'
let companyId: string
let contaId: string

const tx = (data: string, valor: number, desc: string) => ({
  date: diaUtc(data), amount: Math.abs(valor), type: valor < 0 ? 'DEBIT' : 'CREDIT',
  description: desc, lifecycle: 'EFFECTED', bankAccountId: contaId,
})

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ANCORA' } })
  companyId = c.id
  const b = await prisma.bankAccount.create({ data: { companyId, name: 'banrisul', bankCode: '041' } })
  contaId = b.id
})
afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { bankAccountId: contaId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o saldo deixa de ser cópia do LEDGERBAL', () => {
  it('⛔⛔ ANTES: ancorado no LEDGERBAL, a conta mostra o DISPONÍVEL (com o fantasma)', async () => {
    // o OFX declarou -6.267,03 (disponível) e não há tx depois da âncora
    await prisma.bankAccount.update({ where: { id: contaId }, data: { ledgerBal: -6267.03, ledgerBalDate: diaUtc('2026-08-28') } })
    const r = await recalcularSaldoConta(prisma, contaId)
    expect(r.modo).toBe('LEDGERBAL_ANCHOR')
    expect(r.saldoDepois).toBe(-6267.03) // ⛔ o número errado, 1.700 pior que o contábil
  })

  it('⭐⭐ DEPOIS: com a âncora de abertura, o saldo sai do LEDGER e bate com o banco', async () => {
    // abertura conferida contra o "SALDO ANT 31/07" do PDF
    await prisma.bankAccount.update({ where: { id: contaId }, data: { ledgerBal: -6267.03, ledgerBalDate: diaUtc('2026-08-28') } })
    await definirAncoraDeAbertura(prisma, {
      bankAccountId: contaId, valor: -22188.17, data: diaUtc('2026-07-31'),
      origem: 'SALDO ANT 31/07 do PDF do Banrisul emitido 01/09 13:55',
    })
    // o movimento líquido de agosto até 28/08 (do PDF): -22.188,17 → -4.567,03
    await prisma.transaction.createMany({ data: [tx('2026-08-15', 17621.14, 'movimento de agosto')] as never })

    const r = await recalcularSaldoConta(prisma, contaId)
    expect(r.modo).toBe('ABERTURA_CONFERIDA')
    expect(r.saldoDepois).toBeCloseTo(-4567.03, 2) // ⭐ o contábil do banco
    // ⚠️ e o LEDGERBAL continua GRAVADO na conta — vira conferência, não some
    const c = await prisma.bankAccount.findUnique({ where: { id: contaId }, select: { ledgerBal: true } })
    expect(c?.ledgerBal).toBe(-6267.03)
  })

  it('⚠️ a abertura NÃO entra duas vezes: tx no DIA da âncora fica fora', async () => {
    // o "SALDO ANT EM 31/07" já contém tudo até 31/07 — somar o dia 31 de novo dobraria
    await definirAncoraDeAbertura(prisma, { bankAccountId: contaId, valor: -100, data: diaUtc('2026-07-31'), origem: 'teste' })
    await prisma.transaction.createMany({ data: [tx('2026-07-31', -50, 'já está na abertura'), tx('2026-08-01', -10, 'depois')] as never })
    const r = await recalcularSaldoConta(prisma, contaId)
    expect(r.saldoDepois).toBe(-110) // -100 - 10, sem o -50
  })
})

describe('⛔⛔ conta SEM âncora não sente nada (cofre, banco caixa)', () => {
  it('⛔⛔ sem openingBalance, o comportamento é byte por byte o de antes', async () => {
    await prisma.transaction.createMany({ data: [tx('2026-08-01', 500, 'entrada'), tx('2026-08-02', -200, 'saída')] as never })
    const r = await recalcularSaldoConta(prisma, contaId)
    expect(r.modo).toBe('SUM_TODAS') // o caminho antigo, intacto
    expect(r.saldoDepois).toBe(300)
  })
})

describe('⭐ mudar a âncora é EVENTO auditado — nunca edição silenciosa', () => {
  it('⭐ o evento guarda quem, quando e o valor ANTERIOR', async () => {
    await definirAncoraDeAbertura(prisma, { bankAccountId: contaId, valor: -22188.17, data: diaUtc('2026-07-31'), origem: 'PDF agosto', userId: 'u1' })
    const mov = await definirAncoraDeAbertura(prisma, { bankAccountId: contaId, valor: -9000, data: diaUtc('2026-05-31'), origem: 'PDF junho', userId: 'u2' })

    expect(mov.anterior).toEqual({ valor: -22188.17, data: diaUtc('2026-07-31') })
    const evs = await prisma.bankAccountOpeningEvent.findMany({ where: { bankAccountId: contaId }, orderBy: { criadoEm: 'asc' } })
    expect(evs).toHaveLength(2)
    expect(evs[0]).toMatchObject({ valorAnterior: null, valorNovo: -22188.17, userId: 'u1' })
    // ⭐ o rastro que permite mover a âncora pra trás com segurança quando jun/jul entrarem
    expect(evs[1]).toMatchObject({ valorAnterior: -22188.17, valorNovo: -9000, origem: 'PDF junho', userId: 'u2' })
  })

  it('⭐ a ORIGEM fica na conta, pra tela mostrar de onde o número veio', async () => {
    const origem = 'SALDO ANT 31/07 do PDF do Banrisul emitido 01/09 13:55'
    await definirAncoraDeAbertura(prisma, { bankAccountId: contaId, valor: -22188.17, data: diaUtc('2026-07-31'), origem })
    const c = await prisma.bankAccount.findUnique({ where: { id: contaId }, select: { openingSource: true } })
    expect(c?.openingSource).toBe(origem)
  })
})

describe('⭐ a régua declarada e o bloqueio', () => {
  it('⭐ grava um saldo por dia, e reimportar o mesmo PDF ATUALIZA em vez de duplicar', async () => {
    const dias = [{ data: '2026-08-27', valor: -8008.4 }, { data: '2026-08-28', valor: -4567.03 }]
    await gravarReguaDeclarada(prisma, { bankAccountId: contaId, origem: 'PDF_BANRISUL', emitidoEm: new Date('2026-09-01T13:55:00Z'), dias, bloqueado: 1700 })
    await gravarReguaDeclarada(prisma, { bankAccountId: contaId, origem: 'PDF_BANRISUL', emitidoEm: new Date('2026-09-01T14:01:00Z'), dias, bloqueado: 1700 })

    const rows = await prisma.bankAccountSaldoDeclarado.findMany({ where: { bankAccountId: contaId } })
    expect(rows).toHaveLength(2) // 2 dias, não 4
  })

  it('⭐⭐ o bloqueio é campo da CONTA e vem DATADO — nunca transação', async () => {
    await gravarReguaDeclarada(prisma, {
      bankAccountId: contaId, origem: 'PDF_BANRISUL', emitidoEm: new Date('2026-09-01T13:55:00Z'),
      dias: [{ data: '2026-09-01', valor: -3225.96 }], bloqueado: 1700,
    })
    const c = await prisma.bankAccount.findUnique({ where: { id: contaId }, select: { blockedAmount: true, blockedAt: true } })
    expect(c?.blockedAmount).toBe(1700)
    expect(c?.blockedAt?.toISOString()).toBe('2026-09-01T13:55:00.000Z')
    // ⛔ e nenhuma transação foi criada por causa do bloqueio
    expect(await prisma.transaction.count({ where: { bankAccountId: contaId } })).toBe(0)
  })
})
