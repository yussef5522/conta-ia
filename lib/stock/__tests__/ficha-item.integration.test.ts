// ESTOQUE FASE 1 — ficha do produto: lê o ledger e monta o histórico de compras +
// preço no tempo. Sem modelo novo. Prova que a tela lê o que existe.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { buildFichaItem } from '../ficha-item'

const CNPJ = '30405060000177'
const CHAVE1 = '43260811111111000111550010000000011000000017' // nNF nas pos 25..33
let companyId: string
let itemId: string

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA FICHA TESTE' } })
  companyId = c.id
  const item = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  itemId = item.id
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE1, nsu: '1', status: 'CONFIRMADA', emitNome: 'FRIGORIFICO SILVA' } })
  // 2 compras (preços diferentes) — dias distintos
  await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 28, custoUnitario: 40, nfeChave: CHAVE1, origem: 'SEFAZ', dataMovimento: new Date('2026-08-20T10:00:00Z') })
  await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 42, origem: 'SEFAZ', dataMovimento: new Date('2026-08-25T10:00:00Z') })
})
afterAll(async () => {
  // o dev.db é compartilhado; o trigger de imutabilidade (do teste do ledger) pode
  // estar aplicado e bloquear o delete de movimentos no cleanup — dropa defensivo.
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('buildFichaItem', () => {
  it('cabeçalho + saldo + custo médio', async () => {
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.item.nome).toBe('Coxão Mole')
    expect(f.item.categoriaLabel).toBe('Matéria-prima')
    expect(f.saldo).toBe(58) // 28 + 30
    expect(f.valor).toBe(2380) // 28×40 + 30×42 = 1120 + 1260
    expect(f.custoMedio).toBe(41.03) // 2380 / 58
  })

  it('histórico de compras — mais recente primeiro, fornecedor + nº da nota', async () => {
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.compras).toHaveLength(2)
    expect(f.compras[0].custoUnitario).toBe(42) // 25/08 vem primeiro (desc)
    const comFornecedor = f.compras.find((c) => c.fornecedor)
    expect(comFornecedor?.fornecedor).toBe('FRIGORIFICO SILVA')
    expect(comFornecedor?.nNF).toBe('1') // extraído da chave
  })

  it('preço no tempo (ordem crescente, pro gráfico)', async () => {
    const f = (await buildFichaItem(companyId, itemId))!
    expect(f.precoTempo.map((p) => p.preco)).toEqual([40, 42])
  })

  it('item inexistente → null', async () => {
    expect(await buildFichaItem(companyId, 'nao-existe')).toBeNull()
  })
})
