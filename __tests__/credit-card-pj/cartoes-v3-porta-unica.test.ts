// ⭐⭐⭐ CARTÕES v3 (24/11/2026) — AS 3 FUNDAÇÕES, EXECUTADAS contra o banco (REGRA 3).
//
// (A) a fatura PJ é REGISTRO com ciclo (o import cria; o estado sai do vínculo);
// (B) parcelas futuras GRAVADAS, com o grupo LIGANDO a mesma compra entre faturas;
// (C) UMA porta de conciliação: a pergunta do topo (confirm do import) e o "casar pagamento"
//     gravam A MESMA coisa, a fatura vira Paga/Parcial NA HORA, e desfazer devolve tudo.
// E a leitura da página em lote: consultas CONSTANTES com 1 ou 4 cartões (o N+1 morreu).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

const PREFIX = `cart-v3-${Date.now()}-${process.pid}`
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})
const { POST: confirmar } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/confirm/route')
const { POST: casar, DELETE: desfazer } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/casar-pagamento/route')
const { lerCarteira } = await import('@/lib/credit-card-pj/carteira')
const { lerFatura } = await import('@/lib/credit-card-pj/fatura-detalhe')
const { projetarParcelas, registrarFatura } = await import('@/lib/credit-card-pj/materializar')

let userId = ''
let companyId = ''
let contaId = ''
let catDespesa = ''
const cards: string[] = []
const HOJE = '2026-11-23'

const req = (url: string, body?: unknown, method = 'POST') =>
  new NextRequest(`http://x${url}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })

async function novoCartao(nome: string) {
  const c = await prisma.businessCreditCard.create({ data: { companyId, name: nome, bankName: nome, creditLimit: 25000, closingDay: 27, dueDay: 13, defaultTreatment: 'OPERACIONAL' } })
  cards.push(c.id)
  return c.id
}
async function saidaDoBanco(valor: number, desc = 'PAGAMENTO FATURA CARTAO') {
  return (await prisma.transaction.create({
    data: { bankAccountId: contaId, type: 'DEBIT', amount: valor, date: new Date('2026-11-13T12:00:00Z'), description: desc, origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING', categoryId: catDespesa },
  })).id
}
const LINHAS_NOV = [
  { date: '2026-10-04', description: 'NETFLIX COM', amount: 44.9, kind: 'COMPRA_AVISTA' as const },
  { date: '2026-10-14', description: 'PANVEL FILIAL 79 01/02', amount: 420.64, kind: 'COMPRA_PARCELADA' as const, installmentNumber: 1, installmentTotal: 2 },
  { date: '2026-06-02', description: 'MP LOJABRAZIL 05/10', amount: 221.9, kind: 'COMPRA_PARCELADA' as const, installmentNumber: 5, installmentTotal: 10 },
  { date: '2026-10-06', description: 'MERCADOLIVRE ESTORNO', amount: 148.4, kind: 'ESTORNO' as const },
]
const TOTAL_NOV = Math.round((44.9 + 420.64 + 221.9 - 148.4) * 100) / 100 // 539.04

async function importar(cardId: string, dueDate: string, lines: unknown[], totalToPay: number, reclass?: string) {
  const r = await confirmar(req(`/api/empresas/${companyId}/cartoes/${cardId}/importar-fatura/confirm`, {
    fileName: 'f.pdf', dueDate, totalToPay, totalDeclared: totalToPay, lines, reclassificarPagamentoTxId: reclass ?? null,
  }), { params: Promise.resolve({ id: companyId, cardId }) })
  return { status: r.status, json: await r.json() }
}

beforeAll(async () => {
  process.env.CREDIT_CARD_PJ_ENABLED = 'true'
  userId = (await prisma.user.create({ data: { name: 'Dono', email: `${PREFIX}@dev.local`, password: 'x' } })).id
  companyId = (await prisma.company.create({ data: { cnpj: String(Date.now()).slice(-14).padStart(14, '7'), name: `${PREFIX} LTDA` } })).id
  await prisma.userCompany.create({ data: { userId, companyId } })
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'sicredi', bankName: 'Sicredi', bankCode: '748', accountNumber: '9', balance: 0 } })).id
  catDespesa = (await prisma.category.create({ data: { companyId, name: 'Despesas diversas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' } })).id
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: `${PREFIX}@dev.local` })
})
afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ businessCreditCardId: { in: cards } }, { bankAccountId: contaId }] } })
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
})

describe('(C) R48 — UMA porta: os DOIS caminhos gravam A MESMA coisa', () => {
  it('a pergunta do topo (confirm) e o "casar pagamento" deixam lançamento + fatura IGUAIS, e a fatura Paga na hora', async () => {
    const cA = await novoCartao('sicredi A')
    const cB = await novoCartao('sicredi B')
    const pA = await saidaDoBanco(TOTAL_NOV)
    const pB = await saidaDoBanco(TOTAL_NOV)
    // caminho 1 — a pergunta do topo do import
    const r1 = await importar(cA, '2026-11-13', LINHAS_NOV, TOTAL_NOV, pA)
    expect(r1.status).toBe(200)
    expect(r1.json.fatura).toMatchObject({ estado: 'paga', total: TOTAL_NOV, pago: TOTAL_NOV })
    // caminho 2 — importa sem marcar e casa pelo botão
    expect((await importar(cB, '2026-11-13', LINHAS_NOV, TOTAL_NOV)).status).toBe(200)
    const r2 = await casar(req(`/api/empresas/${companyId}/cartoes/${cB}/casar-pagamento`, { txId: pB, invoiceMonth: '2026-11' }), { params: Promise.resolve({ id: companyId, cardId: cB }) })
    const j2 = await r2.json()
    expect(j2.fatura).toMatchObject({ estado: 'paga', total: TOTAL_NOV, pago: TOTAL_NOV })

    const campos = { isCardPayment: true, paidInvoiceMonth: true, categoryId: true, cardPaymentPrevCategoryId: true, cardPaymentPrevFlag: true }
    const a = await prisma.transaction.findUniqueOrThrow({ where: { id: pA }, select: campos })
    const b = await prisma.transaction.findUniqueOrThrow({ where: { id: pB }, select: campos })
    expect(a).toEqual(b)
    expect(a).toEqual({ isCardPayment: true, paidInvoiceMonth: '2026-11', categoryId: null, cardPaymentPrevCategoryId: catDespesa, cardPaymentPrevFlag: false })
    // e a carteira (a página) lê Paga nos dois
    const cart = await lerCarteira(companyId, HOJE)
    expect(cart.cartoes.filter((k) => cards.slice(0, 2).includes(k.id)).map((k) => k.atual?.estado)).toEqual(['paga', 'paga'])
  })

  it('pagamento PARCIAL é estado próprio (o pino casar)', async () => {
    const c = await novoCartao('mercado pago')
    expect((await importar(c, '2026-11-13', LINHAS_NOV, TOTAL_NOV)).status).toBe(200)
    const p = await saidaDoBanco(500)
    const r = await casar(req(`/api/empresas/${companyId}/cartoes/${c}/casar-pagamento`, { txId: p, invoiceMonth: '2026-11' }), { params: Promise.resolve({ id: companyId, cardId: c }) })
    expect((await r.json()).fatura).toMatchObject({ estado: 'parcial', pago: 500 })
  })

  it('DESFAZER devolve tudo — marca, fatura E a categoria', async () => {
    const c = cards[0]
    const pago = await prisma.transaction.findFirstOrThrow({ where: { businessCreditCardId: c, isCardPayment: true } })
    const r = await desfazer(req(`/api/empresas/${companyId}/cartoes/${c}/casar-pagamento?txId=${pago.id}`, undefined, 'DELETE'), { params: Promise.resolve({ id: companyId, cardId: c }) })
    const j = await r.json()
    expect(j).toMatchObject({ desfeito: true, categoriaDevolvida: catDespesa, origemDoAntes: 'porta', fatura: { estado: 'fechada', pago: 0 } })
    const t = await prisma.transaction.findUniqueOrThrow({ where: { id: pago.id } })
    expect({ isCardPayment: t.isCardPayment, card: t.businessCreditCardId, mes: t.paidInvoiceMonth, cat: t.categoryId, prev: t.cardPaymentPrevFlag })
      .toEqual({ isCardPayment: false, card: null, mes: null, cat: catDespesa, prev: null })
  })
})

describe('(A) R46 — a fatura é REGISTRO; (B) R47 — parcelas futuras gravadas e LIGADAS', () => {
  it('o import cria o registro e projeta as parcelas que faltam', async () => {
    const c = cards[0]
    const reg = await prisma.faturaCartaoPJ.findUniqueOrThrow({ where: { cardId_mes: { cardId: c, mes: '2026-11' } } })
    expect(reg).toMatchObject({ origem: 'IMPORT', totalDeclarado: TOTAL_NOV })
    expect(reg.fechamento?.toISOString().slice(0, 10)).toBe('2026-10-27')
    expect(reg.vencimento?.toISOString().slice(0, 10)).toBe('2026-11-13')
    const prev = await prisma.parcelaFuturaPJ.findMany({ where: { cardId: c }, orderBy: [{ descricao: 'asc' }, { numero: 'asc' }] })
    // Panvel 01/02 → falta 1 (dez); Lojabrazil 05/10 → faltam 5 (dez..abr)
    expect(prev.map((p) => `${p.numero}/${p.total}@${p.mes}`)).toEqual(['6/10@2026-12', '7/10@2027-01', '8/10@2027-02', '9/10@2027-03', '10/10@2027-04', '2/2@2026-12'])
  })

  it('⭐ a fatura seguinte (descrição com OUTRO "NN/MM") LIGA ao mesmo grupo: realiza a previsão, não duplica', async () => {
    const c = cards[0]
    const dez = [
      { date: '2026-10-14', description: 'PANVEL FILIAL 79 02/02', amount: 420.64, kind: 'COMPRA_PARCELADA' as const, installmentNumber: 2, installmentTotal: 2 },
      { date: '2026-06-02', description: 'MP LOJABRAZIL 06/10 PORTO ALEGRE', amount: 221.9, kind: 'COMPRA_PARCELADA' as const, installmentNumber: 6, installmentTotal: 10 },
    ]
    expect((await importar(c, '2026-12-13', dez, 642.54)).status).toBe(200)
    const prev = await prisma.parcelaFuturaPJ.findMany({ where: { cardId: c } })
    expect(prev).toHaveLength(6) // nenhuma nova: as 2 que chegaram foram REALIZADAS
    expect(prev.filter((p) => p.realizadaTxId).map((p) => `${p.numero}/${p.total}`).sort()).toEqual(['2/2', '6/10'])
    const cart = await lerCarteira(companyId, '2026-12-20', prisma, { cardId: c })
    // futuras = Lojabrazil 7..10 = 4 × 221,90 (a régua somaFuturo)
    expect(cart.cartoes[0].parcelasFuturas).toBe(887.6)
    expect(cart.cartoes[0].aberta).toMatchObject({ mes: '2027-01', total: 221.9 })
  })

  it('idempotente: projetar e registrar 2× não duplica nada', async () => {
    const c = cards[0]
    const antes = await prisma.parcelaFuturaPJ.count({ where: { cardId: c } })
    const r = await projetarParcelas(prisma, companyId, c)
    const r2 = await projetarParcelas(prisma, companyId, c)
    expect([r.criadas, r2.criadas, r2.realizadas]).toEqual([0, 0, 0])
    expect(await prisma.parcelaFuturaPJ.count({ where: { cardId: c } })).toBe(antes)
    expect((await registrarFatura(prisma, { companyId, cardId: c, mes: '2026-11', closingDay: 27, dueDay: 13, origem: 'BACKFILL' })).criada).toBe(false)
    expect(await prisma.faturaCartaoPJ.count({ where: { cardId: c } })).toBe(2)
  })
})

describe('⭐ R45 — UMA régua do disponível, e a leitura em LOTE (consultas constantes)', () => {
  it('a lista e o detalhe dão o MESMO disponível = limite − aberta − fechadas não pagas', async () => {
    const c = cards[1]
    const cart = await lerCarteira(companyId, HOJE)
    const k = cart.cartoes.find((x) => x.id === c)!
    const det = await lerFatura(companyId, c, null, HOJE)
    expect(det!.cartao.disponivel).toBe(k.disponivel)
    // e a lista antiga (a caixa de entrada lê ela) é VISTA da mesma carteira — não uma 2ª régua
    const { listCardsForCompany } = await import('@/lib/credit-card-pj/queries')
    expect((await listCardsForCompany(companyId)).find((x) => x.id === c)!.availableLimit).toBe(k.disponivel)
    expect(k.disponivel).toBe(Math.round((25000 - k.aberta.total - k.fechadasNaoPagas) * 100) / 100)
  })

  it('o número de consultas da página NÃO cresce com o número de cartões (N+1 morto)', async () => {
    const contar = async () => {
      let n = 0
      const db = new Proxy(prisma, {
        get(alvo, prop) {
          const v = Reflect.get(alvo, prop)
          if (typeof prop === 'string' && v && typeof v === 'object' && !prop.startsWith('$')) {
            return new Proxy(v, { get(m, op) { const f = Reflect.get(m, op); return typeof f === 'function' ? (...a: unknown[]) => { n++; return f.apply(m, a) } : f } })
          }
          return v
        },
      })
      await lerCarteira(companyId, HOJE, db as typeof prisma)
      return n
    }
    const com3 = await contar()
    await novoCartao('banrisul')
    await novoCartao('caixa')
    const com5 = await contar()
    expect(com5).toBe(com3)
    expect(com3).toBeLessThanOrEqual(7)
  })
})
