// ⭐⭐⭐ "A DEFINIR" — a nota sem boleto deixa de ser dívida invisível (03/09/2026).
//
// ⛔ O QUE O DADO REAL MOSTROU: **21 notas · R$ 8.588,75** confirmadas no estoque que nunca
// geraram sugestão de conta a pagar, porque o laço rodava sobre as DUPLICATAS e pix/dinheiro
// combinado não tem duplicata. O dinheiro sai do bolso do dono e não aparece no fluxo.
//
// ⚠️ E o juiz não via: o F3 vigia sugestão PARADA, e **sugestão que não nasce não pára** — a
// mesma cegueira do E15 de 23/08.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { parcelasSemData, definirVencimento, rastroDoVencimento, ehADefinir, VencimentoError } from '../vencimento'
import { checkPonteInvariants, F3_DIAS } from '../../ponte-invariants'

// ⚠️ CNPJ ÚNICO na suíte: os arquivos rodam em PARALELO contra o mesmo banco, e dois testes
// com o mesmo CNPJ derrubam um ao outro no `create` (colidiu com fichas.integration).
const CNPJ = '55667788000177'
let companyId = ''
let userId = ''

const sugestao = (over: Partial<{ dVenc: Date | null; valor: number; nDup: string | null; nome: string; criadoEm: Date }> = {}) =>
  prisma.stockPayableSuggestion.create({
    data: {
      companyId, nfeId: `nfe-${Math.random().toString(36).slice(2)}`, chave: '4126'.padEnd(44, '0'),
      supplierNome: over.nome ?? 'FRIGORIFICO', supplierCnpj: '11222333000144',
      nDup: over.nDup ?? null, dVenc: over.dVenc ?? null, valor: over.valor ?? 526.2,
      ...(over.criadoEm ? { criadoEm: over.criadoEm } : {}),
    },
  })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'VENC' } })).id
  userId = (await prisma.user.create({ data: { email: `venc-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
})
afterEach(async () => {
  for (const t of ['stockVencimentoDefinido', 'stockPayableLink', 'stockPayableSuggestion'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ a parcela sem data EXISTE e fica visível', () => {
  it('⭐⭐ nota sem boleto vira parcela A DEFINIR na lista', async () => {
    await sugestao({ valor: 526.2 })
    const lista = await parcelasSemData(companyId, prisma)
    expect(lista).toHaveLength(1)
    expect(lista[0].valor).toBe(526.2)
    expect(ehADefinir(null)).toBe(true)
    expect(ehADefinir(new Date())).toBe(false)
  })

  it('⛔ e NÃO ganha data inventada — é null até o dono decidir', async () => {
    const s = await sugestao()
    const gravada = await prisma.stockPayableSuggestion.findUniqueOrThrow({ where: { id: s.id }, select: { dVenc: true } })
    expect(gravada.dVenc, 'o sistema inventou uma data').toBeNull()
  })

  it('⭐ parcela já enviada pro financeiro sai da lista (trabalho feito)', async () => {
    const s = await sugestao()
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: s.nfeId, suggestionId: s.id, nDup: null, chave: s.chave, transactionId: 'tx-1', supplierId: 'sup-1', valor: 526.2, dVenc: new Date('2026-09-10T00:00:00Z') },
    })
    expect((await parcelasSemData(companyId, prisma)).find((p) => p.suggestionId === s.id)?.enviada).toBe(true)
  })
})

describe('⭐⭐ EU defino a data, com rastro', () => {
  it('⭐⭐ definir grava a data e QUEM decidiu, na mesma transação', async () => {
    const s = await sugestao()
    const r = await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'DONO', userId, prisma)
    expect(r.gravou).toBe(true)
    expect(r.conflito).toBeNull()

    const gravada = await prisma.stockPayableSuggestion.findUniqueOrThrow({ where: { id: s.id }, select: { dVenc: true } })
    expect(gravada.dVenc?.toISOString().slice(0, 10)).toBe('2026-09-10')

    const rastro = await rastroDoVencimento(companyId, s.id, prisma)
    expect(rastro).toHaveLength(1)
    expect(rastro[0]).toMatchObject({ origem: 'DONO', criadoPorNome: 'Yussef' })
    expect(rastro[0].dVencAnterior, 'não havia data antes').toBeNull()
  })

  it('⭐ e a parcela sai da lista de "sem data" (entrou no fluxo normal)', async () => {
    const s = await sugestao()
    await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'DONO', userId, prisma)
    expect(await parcelasSemData(companyId, prisma)).toHaveLength(0)
  })

  it('⛔ parcela já virada conta a pagar não se edita por aqui', async () => {
    const s = await sugestao()
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: s.nfeId, suggestionId: s.id, nDup: null, chave: s.chave, transactionId: 'tx-2', supplierId: 'sup-1', valor: 526.2, dVenc: new Date('2026-09-10T00:00:00Z') },
    })
    // ⚠️ senão as duas pontas discordariam em silêncio: a conta lá com uma data, a sugestão
    // aqui com outra.
    await expect(definirVencimento(companyId, s.id, new Date('2026-09-11T00:00:00Z'), 'DONO', userId, prisma))
      .rejects.toThrow(VencimentoError)
  })
})

describe('⛔⛔ o boleto que chega DEPOIS nunca troca em silêncio', () => {
  it('⛔⛔ data do boleto ≠ a minha → devolve as DUAS e NÃO grava', async () => {
    const s = await sugestao()
    await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'DONO', userId, prisma)

    const r = await definirVencimento(companyId, s.id, new Date('2026-09-12T00:00:00Z'), 'BOLETO', userId, prisma)
    expect(r.gravou, 'o boleto trocou a data sozinho').toBe(false)
    expect(r.conflito).toEqual({ daSua: new Date('2026-09-10T00:00:00Z'), doBoleto: new Date('2026-09-12T00:00:00Z') })

    const gravada = await prisma.stockPayableSuggestion.findUniqueOrThrow({ where: { id: s.id }, select: { dVenc: true } })
    expect(gravada.dVenc?.toISOString().slice(0, 10), 'a data mudou sem o OK do dono').toBe('2026-09-10')
  })

  it('⭐⭐ com o meu OK, troca — e o rastro guarda a data anterior', async () => {
    const s = await sugestao()
    await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'DONO', userId, prisma)
    const r = await definirVencimento(companyId, s.id, new Date('2026-09-12T00:00:00Z'), 'BOLETO', userId, prisma, true)
    expect(r.gravou).toBe(true)

    const rastro = await rastroDoVencimento(companyId, s.id, prisma)
    expect(rastro).toHaveLength(2)
    expect(rastro[0]).toMatchObject({ origem: 'BOLETO' })
    expect(rastro[0].dVencAnterior?.toISOString().slice(0, 10)).toBe('2026-09-10')
  })

  it('⭐ boleto com a MESMA data não vira conflito (não há o que confirmar)', async () => {
    const s = await sugestao()
    await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'DONO', userId, prisma)
    const r = await definirVencimento(companyId, s.id, new Date('2026-09-10T00:00:00Z'), 'BOLETO', userId, prisma)
    expect(r.gravou).toBe(true)
    expect(r.conflito).toBeNull()
  })

  it('⭐ e a 1ª data vinda do boleto (sem nada antes) entra direto', async () => {
    const s = await sugestao()
    const r = await definirVencimento(companyId, s.id, new Date('2026-09-12T00:00:00Z'), 'BOLETO', userId, prisma)
    expect(r.gravou).toBe(true)
  })
})

describe('⛔⛔ o juiz: F5 cobra, F3 sai da frente', () => {
  const velha = () => new Date(Date.now() - (F3_DIAS + 3) * 86_400_000)

  it('⛔⛔ F5 avisa "N notas sem data", separado dos vencidos', async () => {
    await sugestao({ criadoEm: velha(), valor: 526.2 })
    await sugestao({ criadoEm: velha(), valor: 730.64 })
    const fails = (await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId)
    const f5 = fails.filter((f) => f.invariante === 'F5')
    expect(f5).toHaveLength(1)
    expect(f5[0].nivel).toBe('aviso')
    expect(f5[0].detalhe).toMatch(/2 nota\(s\) sem data/)
    expect(f5[0].detalhe).toMatch(/1256\.84/) // o total, pra ele saber o tamanho
    // ⚠️ e ENSINA o que fazer, em vez de mandar procurar um atraso que não existe
    expect(f5[0].detalhe).toMatch(/combine o vencimento/i)
  })

  it('⛔⛔ o MESMO caso NÃO aparece no F3 — dois alarmes matam os dois', async () => {
    await sugestao({ criadoEm: velha() })
    const fails = (await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId)
    expect(fails.filter((f) => f.invariante === 'F3'), 'sem data caiu no F3 também').toHaveLength(0)
    expect(fails.filter((f) => f.invariante === 'F5')).toHaveLength(1)
  })

  it('⭐ com data, volta a ser assunto do F3 (boleto parado é outra coisa)', async () => {
    await sugestao({ criadoEm: velha(), dVenc: new Date('2026-09-20T00:00:00Z') })
    const fails = (await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId)
    expect(fails.filter((f) => f.invariante === 'F3')).toHaveLength(1)
    expect(fails.filter((f) => f.invariante === 'F5')).toHaveLength(0)
  })

  it('⭐ e definir a data APAGA o F5 (o trabalho foi feito)', async () => {
    const s = await sugestao({ criadoEm: velha() })
    await definirVencimento(companyId, s.id, new Date('2026-09-15T00:00:00Z'), 'DONO', userId, prisma)
    const fails = (await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'F5')
    expect(fails).toHaveLength(0)
  })
})
