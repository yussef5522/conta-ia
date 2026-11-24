// ⭐⭐⭐ R53 — CARTÃO ENCERRADO EM QUITAÇÃO (emenda 24/11/2026), EXECUTADO contra o banco (REGRA 3).
// O caso real: o dono cancelou o Mercado Pago e só paga as parcelas que ficaram.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { quitacaoASemear } from '@/lib/credit-card-pj/ciclo'

const PREFIX = `cart-r53-${Date.now()}-${process.pid}`
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})
const { POST: confirmar } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/confirm/route')
const { PATCH: editar } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/route')
const { POST: casar } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/casar-pagamento/route')
const { lerCarteira } = await import('@/lib/credit-card-pj/carteira')
const { semearQuitacoes } = await import('@/lib/credit-card-pj/materializar')
const { alertasDaCarteira } = await import('@/lib/credit-card-pj/vigia')

let userId = ''
let companyId = ''
let contaId = ''
let mp = ''
let ativo = ''
const NOV = '2026-11-23'
const req = (url: string, body?: unknown, method = 'POST') =>
  new NextRequest(`http://x${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
const ctx = (cardId: string) => ({ params: Promise.resolve({ id: companyId, cardId }) })

// out/2026: 2 compras parceladas vivas → caem em nov: 221,90 + 112,71 = 334,61
const OUT = [
  { date: '2026-09-02', description: 'MP LOJABRAZIL 02/10', amount: 221.9, kind: 'COMPRA_PARCELADA', installmentNumber: 2, installmentTotal: 10 },
  { date: '2026-10-01', description: 'MP CAIOCEZAR 01/02', amount: 112.71, kind: 'COMPRA_PARCELADA', installmentNumber: 1, installmentTotal: 2 },
  { date: '2026-10-05', description: 'PADARIA', amount: 50, kind: 'COMPRA_AVISTA' },
]
const TOTAL_OUT = 384.61

beforeAll(async () => {
  process.env.CREDIT_CARD_PJ_ENABLED = 'true'
  userId = (await prisma.user.create({ data: { name: 'Dono', email: `${PREFIX}@dev.local`, password: 'x' } })).id
  companyId = (await prisma.company.create({ data: { cnpj: String(Date.now()).slice(-14).padStart(14, '6'), name: `${PREFIX} LTDA` } })).id
  await prisma.userCompany.create({ data: { userId, companyId } })
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', bankName: 'Sicredi', bankCode: '748', accountNumber: '9', balance: 0 } })).id
  mp = (await prisma.businessCreditCard.create({ data: { companyId, name: 'mercado pago', bankName: 'mercado pago', creditLimit: 7200, closingDay: 8, dueDay: 18 } })).id
  ativo = (await prisma.businessCreditCard.create({ data: { companyId, name: 'banrisul', bankName: 'banrisul', creditLimit: 30000, closingDay: 25, dueDay: 15 } })).id
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: `${PREFIX}@dev.local` })
  const r = await confirmar(req(`/api/empresas/${companyId}/cartoes/${mp}/importar-fatura/confirm`, { fileName: 'f.pdf', dueDate: '2026-10-18', totalToPay: TOTAL_OUT, lines: OUT }), ctx(mp))
  expect(r.status).toBe(200)
  // como no MP real: a fatura de outubro foi PAGA (casada pela porta)
  const pgOut = (await prisma.transaction.create({ data: { bankAccountId: contaId, type: 'DEBIT', amount: TOTAL_OUT, date: new Date('2026-10-18T12:00:00Z'), description: 'PIX MERCADO PAGO', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' } })).id
  expect((await casar(req(`/api/empresas/${companyId}/cartoes/${mp}/casar-pagamento`, { txId: pgOut, invoiceMonth: '2026-10' }), ctx(mp))).status).toBe(200)
})
afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ businessCreditCardId: { in: [mp, ativo] } }, { bankAccountId: contaId }] } })
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
})

describe('R53 — encerrar não apaga nem arquiva; o limite sai do hero', () => {
  it('antes de encerrar o MP conta no limite e o vigia pede a fatura de novembro', async () => {
    const c = await lerCarteira(companyId, NOV)
    expect(c.hero.limite).toMatchObject({ total: 37200, cartoes: 2 })
    expect(alertasDaCarteira(companyId, c).map((a) => `${a.tipo}:${a.cartaoId === mp ? 'mp' : 'x'}`)).toContain('FATURA_NAO_IMPORTADA:mp')
  })
  it('Encerrado no editar: continua na página, o limite dele sai dos DOIS lados, e o vigia para de pedir import', async () => {
    const r = await editar(req(`/api/empresas/${companyId}/cartoes/${mp}`, { encerrado: true }, 'PATCH'), ctx(mp))
    expect(r.status).toBe(200)
    const card = await prisma.businessCreditCard.findUniqueOrThrow({ where: { id: mp } })
    expect(card.isActive).toBe(true)
    expect(card.encerradoEm).not.toBeNull()
    const c = await lerCarteira(companyId, NOV)
    expect(c.cartoes.map((k) => k.id)).toContain(mp)
    const k = c.cartoes.find((x) => x.id === ativo)!
    expect(c.hero.limite).toEqual({ total: 30000, disponivel: k.disponivel, usoPct: (30000 - k.disponivel) / 30000, cartoes: 1 })
    expect(alertasDaCarteira(companyId, c).filter((a) => a.cartaoId === mp && a.tipo !== 'VENCENDO_SEM_PAGAMENTO')).toEqual([])
    expect(c.hero.abertas.valor).toBe(0)
  })
})

describe('R53 — a fatura de QUITAÇÃO nasce sozinha, uma vez só', () => {
  it('semeia novembro a partir das parcelas gravadas: fechada, vence no dia do cartão, entra no "a pagar"', async () => {
    const r = await semearQuitacoes(prisma, companyId, NOV)
    expect(r.semeadas).toEqual([{ cardId: mp, mes: '2026-11', total: 334.61 }])
    const reg = await prisma.faturaCartaoPJ.findUniqueOrThrow({ where: { cardId_mes: { cardId: mp, mes: '2026-11' } } })
    expect(reg).toMatchObject({ quitacao: true, totalDeclarado: 334.61 })
    expect(reg.vencimento?.toISOString().slice(0, 10)).toBe('2026-11-18')
    const c = await lerCarteira(companyId, NOV)
    const k = c.cartoes.find((x) => x.id === mp)!
    expect(k.atual).toMatchObject({ mes: '2026-11', quitacao: true, estado: 'fechada', total: 334.61 })
    expect(c.hero.aPagar.valor).toBe(334.61)
    // régua de quitação: nov (334,61, 2 parcelas) + dez..jun do Lojabrazil (7 × 221,90)
    expect(k.quitacao).toEqual({ falta: 1887.91, parcelas: 9, ultima: '2027-06', quitado: false })
  })
  it('⛔ rodar de novo (virar do mês + on-read) NÃO duplica — a 2ª decisão já é "nada"', async () => {
    expect((await semearQuitacoes(prisma, companyId, NOV)).semeadas).toEqual([])
    expect(await prisma.faturaCartaoPJ.count({ where: { cardId: mp, quitacao: true } })).toBe(1)
    expect(quitacaoASemear({ encerradoEm: '2026-11-23', hoje: NOV, mesesComFatura: new Set(['2026-11']), previstasDoMes: () => 334.61 })).toBeNull()
  })
  it('⛔ fatura real do banco no mesmo mês MANDA: a quitação não nasce; e meses antigos nunca', () => {
    expect(quitacaoASemear({ encerradoEm: '2026-11-01', hoje: '2026-12-02', mesesComFatura: new Set(['2026-12']), previstasDoMes: () => 100 })).toBeNull()
    expect(quitacaoASemear({ encerradoEm: '2026-12-01', hoje: '2026-11-23', mesesComFatura: new Set(), previstasDoMes: () => 100 })).toBeNull()
    expect(quitacaoASemear({ encerradoEm: null, hoje: NOV, mesesComFatura: new Set(), previstasDoMes: () => 100 })).toBeNull()
  })
})

describe('R53 — o pagamento casa pela MESMA porta; juro/tarifa → parcial declarada', () => {
  it('pagamento menor (faltou) → Parcial; o resto → Paga', async () => {
    const saida = async (v: number) => (await prisma.transaction.create({ data: { bankAccountId: contaId, type: 'DEBIT', amount: v, date: new Date('2026-11-18T12:00:00Z'), description: 'PIX MERCADO PAGO', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' } })).id
    const r1 = await (await casar(req(`/api/empresas/${companyId}/cartoes/${mp}/casar-pagamento`, { txId: await saida(300), invoiceMonth: '2026-11' }), ctx(mp))).json()
    expect(r1.fatura).toMatchObject({ estado: 'parcial', total: 334.61, pago: 300 })
    const r2 = await (await casar(req(`/api/empresas/${companyId}/cartoes/${mp}/casar-pagamento`, { txId: await saida(34.61), invoiceMonth: '2026-11' }), ctx(mp))).json()
    expect(r2.fatura).toMatchObject({ estado: 'paga', pago: 334.61 })
  })
  it('última parcela paga → QUITADO (propõe arquivar), história preservada', async () => {
    // a compra que sobrou some das previsões quando o banco para de cobrar (aqui: realizada à mão no teste)
    await prisma.parcelaFuturaPJ.updateMany({ where: { cardId: mp, mes: { gt: '2026-11' } }, data: { canceladaEm: new Date() } })
    const k = (await lerCarteira(companyId, NOV)).cartoes.find((x) => x.id === mp)!
    expect(k.quitacao).toEqual({ falta: 0, parcelas: 0, ultima: null, quitado: true })
    expect(k.historia.lancamentos).toBeGreaterThan(0)
  })
})
