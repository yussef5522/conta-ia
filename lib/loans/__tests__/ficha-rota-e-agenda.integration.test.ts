/**
 * ⭐⭐ R60 + R63 — a ROTA do contrato e o importar agenda que não pula calado (25/11/2026).
 * Lei: docs/emprestimos-referencia.html.
 *
 * R60: PATCH existe (edita campo a campo e o indexador em branco deixa de ser cobrado); DELETE tem
 *      DOIS destinos — sem história apaga, com história some das telas (GET 404) e a parcela fica.
 * R63: o contrato que o documento traz e o sistema não tem vira OFERTA de cadastro, com o nº e o
 *      banco do documento no link — e o formulário lê o MESMO link.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hrefCadastrarNaHora, prefillDoCadastro } from '../cadastro-na-hora'
import { semComentarios } from '../../../__tests__/regras-ui/_leitura-de-fonte'

vi.mock('@/lib/auth/rbac', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/rbac')>()
  return { ...actual, getAuthContext: async () => ({ requirePermission: () => {}, user: { id: 'u' } }) }
})
const rota = await import('@/app/api/empresas/[id]/emprestimos/[loanId]/route')

const CNPJ = '50607080002552'
let companyId: string
let contaId: string

const req = (method: string, body?: unknown) =>
  new NextRequest(new URL('http://localhost:3000/x'), { method, ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) })
const params = (loanId: string) => ({ params: Promise.resolve({ id: companyId, loanId }) })
const contrato = (o: Record<string, unknown> = {}) => prisma.loan.create({
  data: {
    companyId, bankAccountId: contaId, lender: 'Sicredi', contractNumber: 'C41022227-1', principal: 100000,
    interestRateMonthly: 0.017, rateType: 'POS', indexer: null, termMonths: 1, amortizationSystem: 'PRICE',
    disbursementDate: new Date('2025-01-15T00:00:00Z'), firstDueDate: new Date('2026-11-15T00:00:00Z'),
    scheduleSource: 'IMPORTED', status: 'ACTIVE', ...o,
  },
})

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'FICHA ROTA' } })).id
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', accountType: 'CHECKING', balance: 0 } })).id
})
afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('R60 — a rota do contrato', () => {
  it('PATCH edita a ficha e o indexador em branco deixa de ser cobrado', async () => {
    const l = await contrato()
    const r = await rota.PATCH(req('PATCH', { indexer: 'CDI', indexerPercent: 100, notes: 'conta garantida' }), params(l.id))
    expect(r.status).toBe(200)
    expect((await r.json()).pendencias).toEqual([])
    const depois = await prisma.loan.findUniqueOrThrow({ where: { id: l.id } })
    expect([depois.indexer, depois.indexerPercent, depois.notes]).toEqual(['CDI', 100, 'conta garantida'])
  })

  it('PATCH recusa campo que não é da ficha (strict) — nada de agenda por aqui', async () => {
    const l = await contrato()
    const r = await rota.PATCH(req('PATCH', { payment: 1 }), params(l.id))
    expect(r.status).toBeGreaterThanOrEqual(400)
  })

  it('DELETE sem história APAGA de vez', async () => {
    const l = await contrato()
    const r = await rota.DELETE(req('DELETE'), params(l.id))
    expect((await r.json()).destino).toBe('apaga')
    expect(await prisma.loan.count({ where: { id: l.id } })).toBe(0)
  })

  it('DELETE com história some das telas (GET 404) e a parcela paga FICA pro DRE', async () => {
    const l = await contrato()
    const i = await prisma.loanInstallment.create({ data: { loanId: l.id, number: 1, dueDate: new Date('2026-11-15T00:00:00Z'), openingBalance: 100, interest: 0, amortization: 100, correcao: 0, payment: 100, closingBalance: 0, status: 'PAID', paidInterest: 12, paidTotal: 112, paidDate: new Date('2026-11-15T00:00:00Z') } })
    const tx = await prisma.transaction.create({ data: { bankAccountId: contaId, date: new Date('2026-11-15T12:00:00Z'), description: 'LIQUIDACAO DE PARCELA', amount: 112, type: 'DEBIT', status: 'RECONCILED', lifecycle: 'EFFECTED', origin: 'OFX' } })
    await prisma.loanInstallmentPayment.create({ data: { installmentId: i.id, transactionId: tx.id, amount: 112 } })

    const r = await rota.DELETE(req('DELETE'), params(l.id))
    const j = await r.json()
    expect(j.destino).toBe('relatorios')
    expect(j.frase).toContain('1 parcela(s) paga(s)')
    expect((await rota.GET(req('GET'), params(l.id))).status).toBe(404)
    expect(await prisma.loanInstallmentPayment.count({ where: { installmentId: i.id } })).toBe(1)
  })
})

describe('R63 — o importar agenda oferece cadastrar (nunca pula calado)', () => {
  it('o link leva nº, banco, financiado e parcelas — e o formulário lê o MESMO link', () => {
    const href = hrefCadastrarNaHora('emp1', { contractNumber: 'C61021346-2', banco: 'Sicredi', valorFinanciado: 100000, numParcelas: 36 })
    expect(href.startsWith('/empresas/emp1/emprestimos/novo?')).toBe(true)
    const pre = prefillDoCadastro(new URLSearchParams(href.split('?')[1]))
    expect(pre).toEqual({ contractNumber: 'C61021346-2', lender: 'Sicredi', principal: '100000', termMonths: '36' })
  })

  it('⛔ o confirm não PULA o desconhecido: oferece (e a tela desenha a oferta)', () => {
    const confirm = semComentarios(readFileSync(join(process.cwd(), 'app/api/empresas/[id]/emprestimos/importar-agenda/confirm/route.ts'), 'utf8'))
    expect(confirm).not.toMatch(/motivo:\s*'não cadastrado'/)
    expect(confirm).toMatch(/desconhecidos\.push\(\{[^}]*cadastrarHref:\s*hrefCadastrarNaHora\(/)
    const tela = semComentarios(readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/emprestimos/importar-agenda/page.tsx'), 'utf8'))
    expect(tela).toMatch(/data-testid="desconhecidos"/)
    expect(tela).toMatch(/cadastrar agora →/)
    const novo = semComentarios(readFileSync(join(process.cwd(), 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'), 'utf8'))
    expect(novo).toMatch(/prefillDoCadastro\(/)
  })
})
