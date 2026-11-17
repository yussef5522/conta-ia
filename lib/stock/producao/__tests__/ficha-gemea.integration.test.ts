/**
 * ⭐⭐ APOSENTAR A FICHA GÊMEA (17/11/2026) — EXECUTADO contra o banco: reaponta, apelida, exclui pela
 * R24, e a grafia velha da venda cai na canônica.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { aposentarFichaGemea } from '../ficha-gemea'
import { montarPlanoDeLinhas } from '../../vendas/baixa-venda'

let companyId = ''
let queijo = '', caixa = ''

async function pizza(nome: string, qtdQueijo: number, loteBase = 1) {
  const item = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: 'PRODUTO_FINAL', criadoVia: 'MANUAL' } })
  const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: item.id, tipoProduto: 'PRODUTO_FINAL', versaoAtual: 1 } })
  const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase, unidadeLoteBase: 'UN' } })
  await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: queijo, qtdPlanejada: qtdQueijo * loteBase, unidade: 'UN', posicao: 0 } })
  await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: caixa, qtdPlanejada: loteBase, unidade: 'UN', posicao: 1 } })
  return { fichaId: f.id, itemId: item.id }
}

beforeEach(async () => {
  companyId = (await prisma.company.create({ data: { name: `Gemea ${Date.now()}`, cnpj: `67${Date.now()}`.slice(0, 14) } })).id
  queijo = (await prisma.stockItem.create({ data: { companyId, nome: 'PORCAO QUEIJO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  caixa = (await prisma.stockItem.create({ data: { companyId, nome: 'CAIXA 35', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
})

afterEach(async () => {
  for (const t of ['stockFichaExcluida', 'stockDoseADeclarar', 'stockVendaProdutoMap', 'stockVendaComplementoMap', 'stockVendaGrafiaAgrupada',
    'stockItemNomeAnterior', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockMovement', 'stockItem'] as const) {
    await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('aposentar a ficha gêmea', () => {
  it('⭐ reaponta produto + complemento, grava o apelido, exclui de vez (sem lote) e a grafia velha baixa pela canônica', async () => {
    const canon = await pizza('PIZZA GRANDE 35CM', 2)
    const morta = await pizza('Pizza Grande (35cm)', 2, 2) // mesma receita POR UNIDADE, lote base diferente
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: 'PIZZA GRANDE 35CM', alvoTipo: 'FICHA', fichaId: canon.fichaId } })
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: 'Pizza Grande (35cm)', alvoTipo: 'FICHA', fichaId: morta.fichaId } })
    await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'pizza grande (35cm)', alvoTipo: 'FICHA', fichaId: morta.fichaId } })
    await prisma.stockDoseADeclarar.create({ data: { companyId, fichaId: morta.fichaId, itemId: queijo, motivo: 'x' } })

    const r = await aposentarFichaGemea({ companyId, mortaFichaId: morta.fichaId, canonicaFichaId: canon.fichaId, userId: 'dono' }, prisma)

    expect(r.reapontados).toEqual({ produto: ['Pizza Grande (35cm)'], complemento: ['pizza grande (35cm)'], grafia: [] })
    expect(r.exclusao).toMatchObject({ caso: 'EXCLUI', itemApagado: true })
    expect(await prisma.stockFicha.count({ where: { id: morta.fichaId } })).toBe(0)
    expect(await prisma.stockDoseADeclarar.count({ where: { companyId, fichaId: morta.fichaId } }), 'linha órfã da ficha excluída').toBe(0)
    // ⛔ nenhum nome de venda aponta pra ficha excluída
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId, fichaId: morta.fichaId } })).toBe(0)
    expect(await prisma.stockVendaComplementoMap.findFirstOrThrow({ where: { companyId, nomeSuitable: 'pizza grande (35cm)' } })).toMatchObject({ fichaId: canon.fichaId })
    expect(await prisma.stockItemNomeAnterior.findMany({ where: { companyId, itemId: canon.itemId }, select: { nomeAnterior: true } })).toEqual([{ nomeAnterior: 'Pizza Grande (35cm)' }])

    // ⭐ a venda com a grafia velha cai na canônica e baixa a receita dela
    const plano = await montarPlanoDeLinhas(companyId, '2026-11-17', [{ produto: 'Pizza Grande (35cm)', quantidade: 3, valorTotal: 0 }], null, prisma)
    expect(plano.pendentes).toEqual([])
    expect(plano.produtos).toHaveLength(1)
    expect(plano.produtos[0]).toMatchObject({ fichaId: canon.fichaId, alvoNome: 'PIZZA GRANDE 35CM' })
    expect(Object.fromEntries(plano.produtos[0].baixa.map((b) => [b.itemId, b.qtd]))).toEqual({ [queijo]: 6, [caixa]: 3 })
  })

  it('⭐ com lote na história a morta só some das telas (R24) — a história fica', async () => {
    const canon = await pizza('PIZZA GRANDE 35CM', 2)
    const morta = await pizza('Pizza Grande (35cm)', 2)
    await prisma.stockProductionOrder.create({ data: { companyId, fichaId: morta.fichaId, versaoFicha: 1, itemProduzidoId: morta.itemId, dataProducao: new Date('2026-11-01T12:00:00Z'), estado: 'CANCELADA' } })
    const r = await aposentarFichaGemea({ companyId, mortaFichaId: morta.fichaId, canonicaFichaId: canon.fichaId, userId: 'dono' }, prisma)
    expect(r.exclusao.caso).toBe('DESATIVA')
    expect(await prisma.stockFicha.findUniqueOrThrow({ where: { id: morta.fichaId } })).toMatchObject({ ativo: false })
    expect(await prisma.stockFichaExcluida.count({ where: { fichaId: morta.fichaId } })).toBe(1)
    await prisma.stockProductionOrder.deleteMany({ where: { companyId } })
  })

  it('⛔ receitas diferentes ou nomes diferentes: RECUSA e não toca em nada', async () => {
    const canon = await pizza('PIZZA GRANDE 35CM', 2)
    const morta = await pizza('Pizza Grande (35cm)', 3)
    await prisma.stockVendaProdutoMap.create({ data: { companyId, nomeSuitable: 'Pizza Grande (35cm)', alvoTipo: 'FICHA', fichaId: morta.fichaId } })
    await expect(aposentarFichaGemea({ companyId, mortaFichaId: morta.fichaId, canonicaFichaId: canon.fichaId, userId: 'dono' }, prisma)).rejects.toThrow('diferem')
    const outra = await pizza('PIZZA FAMILIA 45CM', 2)
    await expect(aposentarFichaGemea({ companyId, mortaFichaId: outra.fichaId, canonicaFichaId: canon.fichaId, userId: 'dono' }, prisma)).rejects.toThrow('não são o mesmo nome')
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(3)
    expect(await prisma.stockVendaProdutoMap.findFirstOrThrow({ where: { companyId } })).toMatchObject({ fichaId: morta.fichaId })
  })
})
