// ⭐⭐ RENEGOCIAÇÃO PÓS-NOTA, PONTA A PONTA — caso BOX PAPER (29/08/2026).
//
// Roda contra o banco de verdade (dev). Prova as quatro coisas que o dono pediu:
//   1. edito as parcelas partindo do XML como sugestão → gravam com origem RENEGOCIADO
//   2. a NOTA continua dizendo 3 (o XML não é tocado) e o financeiro diz 4 — os dois visíveis
//   3. depois de ENVIADO: cancela as pendentes daquela nota e recria, vínculo preservado
//   4. ⛔ conta já paga/conciliada BLOQUEIA a renegociação, nomeando qual

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildAuthContextForTest } from '@/lib/auth/rbac'
import { combinadoDaNota, salvarCombinado, CombinadoError } from '../combinado'
import { renegociarParcelasDaNota } from '../renegociar-enviadas'
import { enviarParaContasPagar } from '../../ponte-contas-pagar'

const CNPJ = '41414141000141'
const TOTAL = 10400.66
// ⭐ os valores REAIS lidos de prod (nota cmtan0d65…, emitida 26/08/2026)
const XML = [
  { nDup: '001', vDup: 3466.88, dVenc: new Date('2026-09-10T00:00:00.000Z') },
  { nDup: '002', vDup: 3466.88, dVenc: new Date('2026-09-25T00:00:00.000Z') },
  { nDup: '003', vDup: 3466.90, dVenc: new Date('2026-10-10T00:00:00.000Z') },
]
const NOVAS = [
  { valor: 2600.17, dVenc: '2026-09-15' },
  { valor: 2600.17, dVenc: '2026-10-15' },
  { valor: 2600.16, dVenc: '2026-11-15' },
  { valor: 2600.16, dVenc: '2026-12-15' },
]

let companyId: string
let nfeId: string
let userId: string
let supplierId: string
// ⚠️ o ctx precisa de `company`: a ponte chama `createContaPendente`, que grava AUDIT — e
// audit sem empresa é recusado de propósito (todo rastro é escopado por empresa). Sem isso
// o envio falhava em silêncio dentro do try/catch por-parcela e devolvia "0 criadas".
// Usa o MESMO helper dos outros testes da ponte (REGRA 4: um jeito de montar ctx de teste).
const ctx = () => buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { cnpj: CNPJ, name: 'BOX PAPER TESTE' } })
  companyId = co.id
  userId = (await prisma.user.create({ data: { email: `box-${Date.now()}@t.com`, password: 'x', name: 'T' } })).id
  supplierId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'BOX PAPER LTDA', cnpj: '11222333000144' } })).id

  const nfe = await prisma.stockNfe.create({
    data: {
      companyId, chave: '43260800011122233300015500100000012341234567890',
      nsu: '9001', status: 'CONFIRMADA', vNF: TOTAL, dataEmissao: new Date('2026-08-20T00:00:00.000Z'),
      emitNome: 'BOX PAPER LTDA', emitCnpj: '11222333000144', temXmlCompleto: true,
    },
  })
  nfeId = nfe.id
  for (const d of XML) await prisma.stockNfeDup.create({ data: { companyId, nfeId, ...d } })
  // a conferência já rodou: a fila tem as 3 do XML
  for (const d of XML) {
    await prisma.stockPayableSuggestion.create({
      data: { companyId, nfeId, chave: nfe.chave, supplierCnpj: '11222333000144', supplierNome: 'BOX PAPER LTDA', nDup: d.nDup, dVenc: d.dVenc, valor: d.vDup },
    })
  }
})

afterEach(async () => {
  await prisma.stockPayableLink.deleteMany({ where: { companyId } })
  await prisma.stockPayableSuggestion.deleteMany({ where: { companyId } })
  await prisma.stockParcelaCombinada.deleteMany({ where: { companyId } })
  await prisma.stockNfeDup.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { supplierId } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ 1+2 — edito antes de enviar: 3 do XML → 4 combinadas', () => {
  it('⭐⭐ o combinado passa a ser 4; a NOTA continua dizendo 3', async () => {
    const antes = await combinadoDaNota(companyId, nfeId, prisma)
    expect(antes!.parcelas).toHaveLength(3)
    expect(antes!.renegociado).toBe(false)
    expect(antes!.parcelas.every((p) => p.origem === 'XML')).toBe(true)

    await salvarCombinado({ companyId, nfeId, parcelas: NOVAS, userId }, prisma)

    const depois = await combinadoDaNota(companyId, nfeId, prisma)
    expect(depois!.parcelas).toHaveLength(4)
    expect(depois!.renegociado).toBe(true)
    expect(depois!.parcelas.every((p) => p.origem === 'RENEGOCIADO')).toBe(true)
    expect(depois!.somaCombinado).toBe(TOTAL)
    expect(depois!.fechaComANota).toBe(true)

    // ⭐ O PONTO: o XML da SEFAZ está INTACTO — os dois visíveis, nenhum sobrescreve
    expect(depois!.xml).toHaveLength(3)
    expect(await prisma.stockNfeDup.count({ where: { companyId, nfeId } })).toBe(3)
  })

  it('⭐ a FILA de boletos anda junto — a tela não mostra 4 e manda 3', async () => {
    await salvarCombinado({ companyId, nfeId, parcelas: NOVAS, userId }, prisma)
    const fila = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId }, orderBy: { dVenc: 'asc' } })
    expect(fila).toHaveLength(4)
    expect(fila.map((s) => s.nDup)).toEqual(['R01', 'R02', 'R03', 'R04'])
    expect(fila.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(TOTAL, 2)
  })

  it('⚠️ renegociar 2× guarda o histórico (as antigas ficam inativas, não somem)', async () => {
    await salvarCombinado({ companyId, nfeId, parcelas: NOVAS, userId }, prisma)
    await salvarCombinado({ companyId, nfeId, parcelas: [{ valor: TOTAL, dVenc: '2026-12-20' }], motivo: 'virou parcela única', userId }, prisma)
    const todas = await prisma.stockParcelaCombinada.findMany({ where: { companyId, refId: nfeId } })
    expect(todas.filter((p) => p.ativo)).toHaveLength(1)
    expect(todas.filter((p) => !p.ativo)).toHaveLength(4) // o combinado anterior, preservado
  })
})

describe('⭐⭐ 3 — depois de ENVIADO: cancela as pendentes e recria', () => {
  it('⭐⭐ 3 contas viram 4, com o vínculo à nota preservado', async () => {
    const fila = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    const envio = await enviarParaContasPagar(
      { companyId, suggestionIds: fila.map((s) => s.id), cadastrarFornecedores: true, ctx: ctx(), userId },
      prisma,
    )
    expect(envio.criadas).toBe(3)

    const r = await renegociarParcelasDaNota(
      { companyId, nfeId, parcelas: NOVAS, motivo: null, ctx: ctx(), userId },
      prisma,
    )
    expect(r.contasCanceladas).toBe(3)
    expect(r.valorCancelado).toBe(TOTAL)
    expect(r.contasCriadas).toBe(4)

    // no financeiro: 4 contas, somando o mesmo
    const contas = await prisma.transaction.findMany({ where: { supplierId, origin: 'ESTOQUE_NF' } })
    expect(contas).toHaveLength(4)
    expect(contas.reduce((s, c) => s + c.amount, 0)).toBeCloseTo(TOTAL, 2)

    // ⭐ vínculo preservado: as 4 amarras apontam a MESMA nota
    const links = await prisma.stockPayableLink.findMany({ where: { companyId, refId: nfeId } })
    expect(links).toHaveLength(4)
    expect(links.every((l) => l.refId === nfeId)).toBe(true)
    expect(links.map((l) => l.nDup).sort()).toEqual(['R01', 'R02', 'R03', 'R04'])
  })

  it('⚠️ não deixa amarra órfã pra trás (senão o juiz F2 grita todo dia)', async () => {
    const fila = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    await enviarParaContasPagar({ companyId, suggestionIds: fila.map((s) => s.id), cadastrarFornecedores: true, ctx: ctx(), userId }, prisma)
    await renegociarParcelasDaNota({ companyId, nfeId, parcelas: NOVAS, ctx: ctx(), userId }, prisma)

    const links = await prisma.stockPayableLink.findMany({ where: { companyId } })
    const vivas = new Set((await prisma.transaction.findMany({ where: { id: { in: links.map((l) => l.transactionId) } }, select: { id: true } })).map((t) => t.id))
    expect(links.every((l) => vivas.has(l.transactionId))).toBe(true)
  })

  it('⚠️ nota que NUNCA mandou nada não passa a mandar sozinha (a fronteira de papel)', async () => {
    const r = await renegociarParcelasDaNota({ companyId, nfeId, parcelas: NOVAS, ctx: ctx(), userId }, prisma)
    expect(r.contasCanceladas).toBe(0)
    expect(r.contasCriadas).toBe(0) // editar parcela ≠ criar obrigação financeira
    expect(await prisma.transaction.count({ where: { supplierId, origin: 'ESTOQUE_NF' } })).toBe(0)
  })
})

describe('⛔ 4 — a linha vermelha: conta já paga não se reescreve', () => {
  it('⛔⛔ parcela PAGA bloqueia a renegociação e diz QUAL', async () => {
    const fila = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId }, orderBy: { dVenc: 'asc' } })
    await enviarParaContasPagar({ companyId, suggestionIds: fila.map((s) => s.id), cadastrarFornecedores: true, ctx: ctx(), userId }, prisma)

    // a 1ª foi paga
    const contas = await prisma.transaction.findMany({ where: { supplierId, origin: 'ESTOQUE_NF' }, orderBy: { dueDate: 'asc' } })
    await prisma.transaction.update({
      where: { id: contas[0].id },
      data: { lifecycle: 'EFFECTED', paymentDate: new Date('2026-09-10T00:00:00.000Z') },
    })

    await expect(
      renegociarParcelasDaNota({ companyId, nfeId, parcelas: NOVAS, ctx: ctx(), userId }, prisma),
    ).rejects.toThrow(CombinadoError)

    // ⭐ e NADA foi tocado: as 3 contas seguem lá, o combinado antigo também
    expect(await prisma.transaction.count({ where: { supplierId, origin: 'ESTOQUE_NF' } })).toBe(3)
    expect(await prisma.stockParcelaCombinada.count({ where: { companyId, ativo: true } })).toBe(0)
  })

  it('a mensagem nomeia a parcela paga e ensina a saída', async () => {
    const fila = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    await enviarParaContasPagar({ companyId, suggestionIds: fila.map((s) => s.id), cadastrarFornecedores: true, ctx: ctx(), userId }, prisma)
    const conta = await prisma.transaction.findFirstOrThrow({ where: { supplierId, origin: 'ESTOQUE_NF' } })
    await prisma.transaction.update({ where: { id: conta.id }, data: { paymentDate: new Date() } })

    await expect(
      renegociarParcelasDaNota({ companyId, nfeId, parcelas: NOVAS, ctx: ctx(), userId }, prisma),
    ).rejects.toThrow(/JÁ PAGA|conciliada/)
  })
})
