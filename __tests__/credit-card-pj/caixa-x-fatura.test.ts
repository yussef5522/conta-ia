// ⭐⭐⭐ CAIXA DE ENTRADA × FATURA DE CARTÃO (24/11/2026) — o PIX de R$ 527,82 do Mercado Pago, EXECUTADO.
// (1) a quitação está na lista; (2) não pagas primeiro, já paga pergunta antes; (3) o nome do emissor
// decide o palpite; (4) pagamento a maior pede a diferença DECLARADA — e a fatura vira PAGA com ela.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { escolherPalpite, type CandidatoBruto } from '@/lib/conciliacao/palpite-da-linha'
import { linhaCitaOEmissor } from '@/lib/credit-card-pj/ciclo'
import { perguntaAntesDeQuitar, ordenarFaturasPraQuitar, type FaturaPraQuitar } from '@/lib/credit-card-pj/faturas-pra-quitar'

const PREFIX = `caixa-fat-${Date.now()}-${process.pid}`
const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: (req: NextRequest) => mockGetAuthUser(req) }
})
const { POST: confirmar } = await import('@/app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/confirm/route')
const { cartoesComFaturas, secoesDeFatura } = await import('@/lib/credit-card-pj/faturas-pra-quitar')
const { semearQuitacoes } = await import('@/lib/credit-card-pj/materializar')
const { palpitesDaCaixa } = await import('@/lib/conciliacao/palpites-da-caixa')
const { casarPagamentoDeCartao, CasarPagamentoError } = await import('@/lib/credit-card-pj/casar-pagamento')
const { lerCarteira } = await import('@/lib/credit-card-pj/carteira')

let userId = ''
let companyId = ''
let contaId = ''
let mp = ''
let pix = ''
const HOJE = '2026-11-23'
const req = (url: string, body: unknown) => new NextRequest(`http://x${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

beforeAll(async () => {
  process.env.CREDIT_CARD_PJ_ENABLED = 'true'
  userId = (await prisma.user.create({ data: { name: 'Dono', email: `${PREFIX}@dev.local`, password: 'x' } })).id
  companyId = (await prisma.company.create({ data: { cnpj: String(Date.now()).slice(-14).padStart(14, '5'), name: `${PREFIX} LTDA` } })).id
  await prisma.userCompany.create({ data: { userId, companyId } })
  contaId = (await prisma.bankAccount.create({ data: { companyId, name: 'banrisul', bankName: 'Banrisul', bankCode: '041', accountNumber: '9', balance: 0 } })).id
  mp = (await prisma.businessCreditCard.create({ data: { companyId, name: 'mercado pago', bankName: 'mercado pago', creditLimit: 7200, closingDay: 8, dueDay: 18 } })).id
  mockGetAuthUser.mockResolvedValue({ sub: userId, email: `${PREFIX}@dev.local` })
  // outubro importado (e pago); as parcelas vivas caem em novembro: 330,42 + 100,09 = 430,51
  const out = [
    { date: '2026-03-02', description: 'MP CASA 08/18', amount: 330.42, kind: 'COMPRA_PARCELADA', installmentNumber: 8, installmentTotal: 18 },
    { date: '2026-05-02', description: 'MP IMPORT 06/21', amount: 100.09, kind: 'COMPRA_PARCELADA', installmentNumber: 6, installmentTotal: 21 },
  ]
  expect((await confirmar(req(`/api/empresas/${companyId}/cartoes/${mp}/importar-fatura/confirm`, { fileName: 'f.pdf', dueDate: '2026-10-18', totalToPay: 430.51, lines: out }), { params: Promise.resolve({ id: companyId, cardId: mp }) })).status).toBe(200)
  const pgOut = (await prisma.transaction.create({ data: { bankAccountId: contaId, type: 'DEBIT', amount: 430.51, date: new Date('2026-10-18T12:00:00Z'), description: 'PIX MP', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' } })).id
  await casarPagamentoDeCartao({ companyId, cardId: mp, txId: pgOut, invoiceMonth: '2026-10' }, prisma)
  await prisma.businessCreditCard.update({ where: { id: mp }, data: { encerradoEm: new Date('2026-11-01T12:00:00Z') } })
  expect((await semearQuitacoes(prisma, companyId, HOJE)).semeadas).toEqual([{ cardId: mp, mes: '2026-11', total: 430.51 }])
  pix = (await prisma.transaction.create({ data: { bankAccountId: contaId, type: 'DEBIT', amount: 527.82, date: new Date('2026-11-23T12:00:00Z'), description: 'PIX - MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA', origin: 'OFX', lifecycle: 'EFFECTED', status: 'PENDING' } })).id
})
afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ businessCreditCardId: mp }, { bankAccountId: contaId }] } })
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  await prisma.user.delete({ where: { id: userId } }).catch(() => {})
})

describe('1. a fatura de QUITAÇÃO está na lista da caixa (toda fatura do registro)', () => {
  it('o grupo do Mercado Pago vai até 2026-11 — a quitação, vencida, não paga', async () => {
    const cs = await cartoesComFaturas(companyId, prisma, HOJE)
    const f = cs.find((c) => c.id === mp)!.faturas
    expect(f.map((x) => x.invoiceMonth)).toEqual(['2026-11', '2026-10'])
    expect(f[0]).toMatchObject({ quitacao: true, net: 430.51, falta: 430.51, vencida: true, jaPaga: false, estado: 'fechada' })
    const itens = secoesDeFatura(cs, brl).find((s) => s.titulo.includes('mercado pago'))!.itens
    expect(itens[0].nome).toBe('⚠ fatura 2026-11')
    expect(itens[0].detalhe).toContain('⚠ VENCIDA')
    expect(itens[1].detalhe).toContain('já paga')
  })
})

describe('2. ordem e estado: não pagas primeiro, já paga pergunta antes', () => {
  const f = (o: Partial<FaturaPraQuitar>): FaturaPraQuitar => ({ invoiceMonth: '2026-10', net: 100, vencimento: '2026-10-18', jaPaga: false, estado: 'fechada', falta: 100, vencida: false, quitacao: false, ...o })
  it('não pagas (a vencida mais antiga no topo) antes das pagas (a mais recente primeiro)', () => {
    const o = ordenarFaturasPraQuitar([
      f({ invoiceMonth: '2026-11', vencimento: '2026-11-18', jaPaga: true, estado: 'paga', falta: 0 }),
      f({ invoiceMonth: '2026-12', vencimento: '2026-12-18' }),
      f({ invoiceMonth: '2026-09', vencimento: '2026-09-18', jaPaga: true, estado: 'paga', falta: 0 }),
      f({ invoiceMonth: '2026-10', vencimento: '2026-10-18', vencida: true }),
    ])
    expect(o.map((x) => x.invoiceMonth)).toEqual(['2026-10', '2026-12', '2026-11', '2026-09'])
  })
  it('já paga → pergunta; a maior → declara; o resto → direto', () => {
    expect(perguntaAntesDeQuitar(100, f({ jaPaga: true, estado: 'paga', falta: 0 })).tipo).toBe('JA_PAGA')
    expect(perguntaAntesDeQuitar(527.82, f({ falta: 430.51 }))).toEqual({ tipo: 'A_MAIOR', excesso: 97.31, falta: 430.51 })
    expect(perguntaAntesDeQuitar(100.01, f({ falta: 100 }))).toEqual({ tipo: 'DIRETO' })
    expect(perguntaAntesDeQuitar(60, f({ falta: 100 }))).toEqual({ tipo: 'DIRETO' }) // a menos = parcial, como sempre
  })
})

describe('3. o PALPITE olha o nome do emissor', () => {
  it('a linha cita "MERCADO PAGO" → reconhece o emissor (palavra inteira, sem caixa nem acento)', () => {
    expect(linhaCitaOEmissor('PIX - MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA', 'mercado pago')).toBe(true)
    expect(linhaCitaOEmissor('PIX - MERCADOPAGOS LTDA', 'mercado pago')).toBe(false)
    expect(linhaCitaOEmissor('PIX ANA', 'mp')).toBe(false) // nome curto demais não decide
  })
  it('⛔ o nome VENCE a proximidade de valor (o salário a R$ 18 não pode ganhar)', () => {
    const conta: CandidatoBruto = { acao: 'CASAR_PAGAR', familia: '🧾', titulo: 'SALARIO', detalhe: '', diferenca: 18, confianca: 'ALTA', alvo: { contaIds: ['x'] } }
    const fatura: CandidatoBruto = { acao: 'PGTO_CARTAO', familia: '💳', titulo: 'Fatura do cartão mercado pago', detalhe: '', diferenca: 97.31, confianca: 'ALTA', porNome: true, alvo: { cardId: 'c', invoiceMonth: '2026-11' } }
    expect(escolherPalpite([conta, fatura], 'SAIDA', 527.82)!.acao).toBe('PGTO_CARTAO')
  })
  it('na caixa de verdade: o PIX do MP vira "pagamento da fatura 2026-11" com os R$ 97,31 a mais NOMEADOS', async () => {
    const linha = await prisma.transaction.findUniqueOrThrow({ where: { id: pix }, include: { reconciledFrom: { select: { id: true } }, loanInstallmentPaid: { select: { id: true } }, loanInstallmentPayments: { select: { id: true } } } })
    const p = (await palpitesDaCaixa(companyId, [linha as never], prisma)).get(pix)!
    expect(p.acao).toBe('PGTO_CARTAO')
    expect(p.alvo).toEqual({ cardId: mp, invoiceMonth: '2026-11' })
    expect(p.diferenca).toMatch(/R\$\s97,31 a mais/)
  })
})

describe('4. a DIFERENÇA A MAIOR é declarada — e a fatura vira PAGA com ela guardada', () => {
  it('⛔ sem declaração a porta RECUSA (antes passava calado)', async () => {
    await expect(casarPagamentoDeCartao({ companyId, cardId: mp, txId: pix, invoiceMonth: '2026-11' }, prisma)).rejects.toBeInstanceOf(CasarPagamentoError)
    await expect(casarPagamentoDeCartao({ companyId, cardId: mp, txId: pix, invoiceMonth: '2026-11', diferencaAMaior: { valor: 90, motivo: 'multa' } }, prisma)).rejects.toThrow(/não é a desta fatura/)
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: pix } })).businessCreditCardId).toBeNull()
  })
  it('declarada: PAGA, o acréscimo no registro da fatura e o texto no histórico da conta', async () => {
    const r = await casarPagamentoDeCartao({ companyId, cardId: mp, txId: pix, invoiceMonth: '2026-11', diferencaAMaior: { valor: 97.31, motivo: 'multa' } }, prisma)
    expect(r.acrescimoDeclarado).toBe(97.31)
    expect(r.fatura).toMatchObject({ estado: 'paga', total: 430.51, pago: 527.82, falta: 0, acrescimo: 97.31 })
    const reg = await prisma.faturaCartaoPJ.findUniqueOrThrow({ where: { cardId_mes: { cardId: mp, mes: '2026-11' } } })
    expect(reg).toMatchObject({ acrescimo: 97.31 })
    expect(reg.acrescimoMotivo).toMatch(/R\$\s97,31 a mais na fatura 2026-11: multa/)
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: pix } })).notes).toMatch(/\[FATURA\] R\$\s97,31 a mais na fatura 2026-11: multa/)
    const k = (await lerCarteira(companyId, HOJE)).cartoes.find((x) => x.id === mp)!
    expect(k.atual).toMatchObject({ estado: 'paga', acrescimo: 97.31, falta: 0 })
  })
})

describe('a tela (lida sem comentário): os TRÊS caminhos de fatura passam pela pergunta', async () => {
  const { semComentarios } = await import('../regras-ui/_leitura-de-fonte')
  const { readFileSync } = await import('node:fs')
  const t = semComentarios(readFileSync('components/conciliacao/caixa-de-entrada.tsx', 'utf8'), 'c.tsx')
  it('palpite, chip e "não é essa" chamam quitarFatura — nenhum manda PGTO_CARTAO direto', () => {
    expect(t.match(/quitarFatura\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4) // 1 definição + 3 usos
    expect(t).not.toMatch(/onEscolher=\{\(id\) => onGesto\(l, (?:'PGTO_CARTAO'|a\.acao), alvoDaFatura\(id\)\)\}/)
    expect(t).toContain("l.palpite!.acao === 'PGTO_CARTAO'\n                  ? quitarFatura(")
    expect(t).toContain('diferencaAceita: p.excesso, motivoDaDiferenca: motivoAMaior')
  })
})
