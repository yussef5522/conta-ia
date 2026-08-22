// ESTOQUE FASE 2 — GOLDEN da 1ª FICHA REAL da Caçula (capturada de prod 21/08; é receita,
// não PII). "Porção de Carne 100g" v3: Coxão Mole 1kg + Açém 1kg + Gordura 1kg, custos
// DERIVADOS do ledger (46,95 / 33,95 / 9,60 da nota do Frigorífico) → custo do lote 90,50
// AO CENTAVO. Trava: se o cálculo do custo teórico ou a leitura do custo derivado mudar,
// quebra aqui. É o fixture do golden do 2.1 (ordem → separação → produção).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, getFicha } from '../fichas'

const CNPJ = '30303030000130'
let companyId: string

// a receita real, com o custo de cada componente vindo do ledger (ENTRADA_NF)
const RECEITA = [
  { nome: 'Coxão Mole', custo: 46.95 },
  { nome: 'Açém', custo: 33.95 },
  { nome: 'Gordura', custo: 9.6 },
]
const CUSTO_LOTE_ESPERADO = 90.5 // 46,95 + 33,95 + 9,60

let itemIds: Record<string, string> = {}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'GOLDEN CARNE' } })
  companyId = c.id
  itemIds = {}
  for (const r of RECEITA) {
    const it = await prisma.stockItem.create({ data: { companyId, nome: r.nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    itemIds[r.nome] = it.id
    // custo DERIVADO: 10kg pelo custo unit → custoMedio = custo (campo custoMedio fica null de propósito)
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: r.custo, custoTotal: r.custo * 10, origem: 'SEFAZ' } })
  }
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

describe('GOLDEN — Porção de Carne 100g (1ª ficha real da Caçula)', () => {
  it('custo do lote fecha em 90,50 ao centavo, 3 componentes com custo do ledger, sem "a definir"', async () => {
    const { fichaId } = await criarFicha({
      companyId, nomeProduzido: 'porcao de carne 100 grama', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 15,
      componentes: RECEITA.map((r, i) => ({ itemId: itemIds[r.nome], qtdPlanejada: 1, unidade: 'KG', posicao: i })),
    })
    const got = await getFicha(companyId, fichaId)
    const f = got!.ficha
    expect(f.componentes).toHaveLength(3)
    expect(f.componentes.map((c) => c.custoMedio)).toEqual([46.95, 33.95, 9.6]) // derivado, não o campo
    expect(f.custoLote).toBe(CUSTO_LOTE_ESPERADO)
    expect(f.custoADefinir).toBe(false)
    expect(f.custoPorUnidade).toBeNull() // rendimento a apurar (medido na 1ª produção, nunca chutado)
    expect(f.rendimentoMedio).toBeNull()
    expect(f.validadeDias).toBe(15)
    expect(f.unidadeProduzido).toBe('UN')
  })

  it('adicionar um insumo SEM nota (molho) → custo do lote vira "a definir" (nunca 0,01)', async () => {
    const molho = await prisma.stockItem.create({ data: { companyId, nome: 'Molho caseiro', unidadeControle: 'LT', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    const { fichaId } = await criarFicha({ companyId, nomeProduzido: 'Porção', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: itemIds['Coxão Mole'], qtdPlanejada: 1, unidade: 'KG' }] })
    await atualizarFicha(companyId, fichaId, { componentes: [{ itemId: itemIds['Coxão Mole'], qtdPlanejada: 1, unidade: 'KG' }, { itemId: molho.id, qtdPlanejada: 0.2, unidade: 'LT' }] })
    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.versaoAtual).toBe(2)
    expect(got!.ficha.custoADefinir).toBe(true)
    expect(got!.ficha.custoLote).toBeNull()
  })
})
