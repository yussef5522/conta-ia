// ESTOQUE FASE 2 item 2.4 — sugestão (min/max) + cardápio/margem. Executa a lógica real.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { sugestoesDeProducao, cardapio, cardapioToCsv } from '../sugestao-cardapio'

const CNPJ = '60606060000160'
let companyId: string
let insumoId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SUGESTAO' } })
  companyId = c.id
  const insumo = await prisma.stockItem.create({ data: { companyId, nome: 'Insumo', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  insumoId = insumo.id
  await prisma.stockMovement.create({ data: { companyId, itemId: insumoId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 10, custoTotal: 1000, origem: 'SEFAZ' } })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('sugestão de produção (min/max)', () => {
  it('produzido abaixo do mínimo → sugere; sem mínimo ou acima → não sugere', async () => {
    const f = await criarFicha({ companyId, nomeProduzido: 'Produto A', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // sem mínimo → nenhuma sugestão
    expect(await sugestoesDeProducao(companyId, prisma)).toHaveLength(0)
    // define mínimo 10, máximo 50; saldo do produzido = 0 → abaixo
    await prisma.stockItem.update({ where: { id: f.itemProduzidoId }, data: { estoqueMin: 10, estoqueMax: 50 } })
    const sug = await sugestoesDeProducao(companyId, prisma)
    expect(sug).toHaveLength(1)
    expect(sug[0].saldo).toBe(0)
    expect(sug[0].faltam).toBe(50) // até o máximo
    expect(sug[0].escalaSugerida).toBeNull() // sem rendimento ainda → a apurar
  })
})

describe('cardápio/margem', () => {
  it('produto final sem preço → "a definir" (margem null), no topo; com preço → margem', async () => {
    // A: sem preço
    await criarFicha({ companyId, nomeProduzido: 'Prato A', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // B: com preço 20 e custo real 8 (via movimento no produzido)
    const b = await criarFicha({ companyId, nomeProduzido: 'Prato B', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', valorVenda: 20, loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    await prisma.stockMovement.create({ data: { companyId, itemId: b.itemProduzidoId, tipo: 'PRODUCAO_GERACAO', quantidade: 10, custoUnitario: 8, custoTotal: 80, origem: 'MANUAL' } })

    const c = await cardapio(companyId, prisma)
    expect(c).toHaveLength(2)
    expect(c[0].valorVenda).toBeNull() // "a definir" primeiro
    expect(c[0].margem).toBeNull()
    const pratoB = c.find((x) => x.nome === 'Prato B')!
    expect(pratoB.custoUnitario).toBe(8) // real do ledger
    expect(pratoB.margem).toBe(0.6) // (20 − 8) / 20
    expect(cardapioToCsv(c)).toContain('a definir')
  })
})
