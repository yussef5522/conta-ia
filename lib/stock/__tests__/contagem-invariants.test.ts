// ESTOQUE FASE 3 PARTE 2 — juiz da CONTAGEM (E7/E8) contra banco real.
// Cada invariante tem red-then-green: quebra de propósito → o juiz PEGA → conserta → 0.
// E8 é o que impede a contagem de virar enfeite (relatório bonito, saldo intacto).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { recomputeSaldoCache } from '../saldo'
import { checkContagemInvariants, E7_DIAS } from '../contagem-invariants'
import type { StockInvariantFail } from '../stock-invariants'
import { iniciarContagem, contarLinha, finalizarContagem, getQuadro } from '../contagem'

const CNPJ = '50607080000144'
let companyId: string
let itemId: string
let contagemId: string

const soDesta = (fs: StockInvariantFail[], inv?: string) =>
  fs.filter((f) => f.companyId === companyId && (!inv || f.invariante === inv))

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA JUIZ CONTAGEM' } })
  companyId = c.id
  itemId = (await prisma.stockItem.create({ data: { companyId, nome: 'Picanha', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })).id
  await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 60, origem: 'SEFAZ' })

  const sessao = await iniciarContagem(companyId, { userId: 'u1', userName: 'Cristian' }, prisma)
  contagemId = sessao.id
  const q = await getQuadro(companyId, new Date(), prisma)
  // conta 18 (faltaram 2 KG = R$ 120): gera AJUSTE_CONTAGEM de verdade
  await contarLinha({ companyId, contagemId: q.contagem!.id, itemId, qtdContada: 18, userId: 'u1', userName: 'Cristian' }, prisma)
  await finalizarContagem(companyId, contagemId, prisma)
  await recomputeSaldoCache(prisma, companyId)
})

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.stockContagemItem.deleteMany({ where: { companyId } })
  await prisma.stockContagem.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('E8 — o ajuste da contagem bate com o ledger', () => {
  it('contagem bem-feita passa VERDE', async () => {
    const fails = await checkContagemInvariants(prisma)
    expect(soDesta(fails, 'E8')).toHaveLength(0)
  })

  it('PEGA divergência registrada SEM movimento de ajuste (contagem viraria enfeite)', async () => {
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId, itemId } })
    const movIdReal = linha!.movementId
    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { movementId: null } })

    const fails = await checkContagemInvariants(prisma)
    const e8 = soDesta(fails, 'E8')
    expect(e8).toHaveLength(1)
    expect(e8[0].detalhe).toContain('SEM movimento de ajuste')

    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { movementId: movIdReal } })
    expect(soDesta(await checkContagemInvariants(prisma), 'E8')).toHaveLength(0) // green de novo
  })

  it('PEGA ajuste com quantidade ≠ divergência registrada', async () => {
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId, itemId } })
    const original = linha!.divergencia
    // a linha diz que faltaram 5, o ledger corrigiu 2 → o saldo não reflete a contagem
    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { divergencia: -5 } })

    const e8 = soDesta(await checkContagemInvariants(prisma), 'E8')
    expect(e8).toHaveLength(1)
    expect(e8[0].detalhe).toContain('≠ divergência registrada')

    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { divergencia: original } })
    expect(soDesta(await checkContagemInvariants(prisma), 'E8')).toHaveLength(0)
  })

  it('PEGA linha apontando movimento que não existe', async () => {
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId, itemId } })
    const movIdReal = linha!.movementId
    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { movementId: 'mov-que-nao-existe' } })

    const e8 = soDesta(await checkContagemInvariants(prisma), 'E8')
    expect(e8).toHaveLength(1)
    expect(e8[0].detalhe).toContain('não existe')

    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { movementId: movIdReal } })
  })
})

describe('E7 (aviso) — item com saldo sem contagem', () => {
  it('item contado AGORA não vira aviso', async () => {
    expect(soDesta(await checkContagemInvariants(prisma), 'E7')).toHaveLength(0)
  })

  it(`AVISA quando a última contagem passa de ${E7_DIAS} dias`, async () => {
    const linha = await prisma.stockContagemItem.findFirst({ where: { contagemId, itemId } })
    const original = linha!.contadoEm
    const velho = new Date(Date.now() - (E7_DIAS + 5) * 86_400_000)
    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { contadoEm: velho } })

    const e7 = soDesta(await checkContagemInvariants(prisma), 'E7')
    expect(e7).toHaveLength(1)
    expect(e7[0].detalhe).toContain('Picanha')
    expect(e7[0].nivel).toBe('aviso') // não deixa o selo vermelho

    await prisma.stockContagemItem.update({ where: { id: linha!.id }, data: { contadoEm: original } })
  })

  it('AVISA item que tem saldo e NUNCA foi contado', async () => {
    const novo = await prisma.stockItem.create({ data: { companyId, nome: 'Alcatra', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await criarMovimento(prisma, { companyId, itemId: novo.id, tipo: 'ENTRADA_NF', quantidade: 5, custoUnitario: 50, origem: 'SEFAZ' })
    await recomputeSaldoCache(prisma, companyId)

    const e7 = soDesta(await checkContagemInvariants(prisma), 'E7')
    expect(e7.some((f) => f.detalhe.includes('Alcatra') && f.detalhe.includes('NUNCA'))).toBe(true)
  })

  it('item ZERADO sem contagem NÃO vira aviso (não há estoque pra estar errado)', async () => {
    const zerado = await prisma.stockItem.create({ data: { companyId, nome: 'Item Zerado', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    await recomputeSaldoCache(prisma, companyId)
    const e7 = soDesta(await checkContagemInvariants(prisma), 'E7')
    expect(e7.some((f) => f.detalhe.includes('Item Zerado'))).toBe(false)
    await prisma.stockItem.delete({ where: { id: zerado.id } })
  })
})
