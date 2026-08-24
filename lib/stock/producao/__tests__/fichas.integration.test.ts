// ESTOQUE FASE 2 item 2.0 — fichas: criar (cria item produzido + v1 + componentes),
// editar corpo → versão NOVA, ciclo rejeitado, custo teórico ao vivo, ISOLAMENTO.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, getFicha, listFichas, FichaError } from '../fichas'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'

const CNPJ = '55667788000199'
let companyId: string
let coxaoId: string
let gorduraId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA FICHAS' } })
  companyId = c.id
  const coxao = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  const gordura = await prisma.stockItem.create({ data: { companyId, nome: 'Gordura', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  coxaoId = coxao.id; gorduraId = gordura.id
  // custoMedio é DERIVADO do ledger (ENTRADA_NF), não do campo: coxão 40/kg, gordura 8/kg
  await prisma.stockMovement.createMany({ data: [
    { companyId, itemId: coxaoId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 40, custoTotal: 400, origem: 'SEFAZ' },
    { companyId, itemId: gorduraId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 8, custoTotal: 80, origem: 'SEFAZ' },
  ] })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem', 'stockSetor', 'stockColaborador'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('fichas item 2.0', () => {
  it('criar ficha: cria item produzido + v1 + componentes, custo do lote ao vivo, rendimento a apurar', async () => {
    const { fichaId, itemProduzidoId } = await criarFicha({
      companyId, userId: 'u', nomeProduzido: 'Carne de panela 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 5, unidadeLoteBase: 'KG',
      componentes: [{ itemId: coxaoId, qtdPlanejada: 5, unidade: 'KG' }, { itemId: gorduraId, qtdPlanejada: 1, unidade: 'KG' }],
    })
    const produzido = await prisma.stockItem.findUnique({ where: { id: itemProduzidoId } })
    expect(produzido?.categoria).toBe('INTERMEDIARIO')
    expect(produzido?.unidadeControle).toBe('UN')

    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.versaoAtual).toBe(1)
    expect(got!.ficha.componentes).toHaveLength(2)
    expect(got!.ficha.custoLote).toBe(208) // 40×5 + 8×1
    expect(got!.ficha.custoPorUnidade).toBeNull() // sem rendimento ainda
    expect(got!.ficha.rendimentoMedio).toBeNull()
  })

  it('editar componentes → versão NOVA (v2), versão atual aponta pra ela', async () => {
    const { fichaId } = await criarFicha({ companyId, nomeProduzido: 'Carne 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 5, unidadeLoteBase: 'KG', componentes: [{ itemId: coxaoId, qtdPlanejada: 5, unidade: 'KG' }] })
    const r = await atualizarFicha(companyId, fichaId, { componentes: [{ itemId: coxaoId, qtdPlanejada: 6, unidade: 'KG' }, { itemId: gorduraId, qtdPlanejada: 1, unidade: 'KG' }] })
    expect(r.versao).toBe(2)
    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.versaoAtual).toBe(2)
    expect(got!.ficha.custoLote).toBe(248) // 40×6 + 8×1
    expect(got!.versoes.map((v) => v.versao)).toEqual([2, 1])
  })

  it('mudar só o preço (head) NÃO cria versão nova', async () => {
    const { fichaId } = await criarFicha({ companyId, nomeProduzido: 'Xis', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: coxaoId, qtdPlanejada: 0.2, unidade: 'KG' }] })
    const r = await atualizarFicha(companyId, fichaId, { valorVenda: 25 })
    expect(r.versao).toBe(1)
    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.valorVenda).toBe(25)
  })

  it('ciclo proibido: A produz e usa B; B não pode passar a usar A', async () => {
    // ficha A (produz "Molho", usa coxão)
    const a = await criarFicha({ companyId, nomeProduzido: 'Molho', unidadeProduzido: 'LT', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'LT', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    // ficha B (produz "Base", usa o Molho)
    const b = await criarFicha({ companyId, nomeProduzido: 'Base', unidadeProduzido: 'LT', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'LT', componentes: [{ itemId: a.itemProduzidoId, qtdPlanejada: 1, unidade: 'LT' }] })
    // tentar fazer o Molho (A) usar a Base (B) → ciclo
    await expect(atualizarFicha(companyId, a.fichaId, { componentes: [{ itemId: b.itemProduzidoId, qtdPlanejada: 1, unidade: 'LT' }] })).rejects.toThrow(FichaError)
  })

  it('custo a definir quando componente não tem custoMedio (nunca 0,01)', async () => {
    const semCusto = await prisma.stockItem.create({ data: { companyId, nome: 'Tempero X', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    const { fichaId } = await criarFicha({ companyId, nomeProduzido: 'Marinada', unidadeProduzido: 'LT', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'LT', componentes: [{ itemId: semCusto.id, qtdPlanejada: 1, unidade: 'KG' }] })
    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.custoADefinir).toBe(true)
    expect(got!.ficha.custoLote).toBeNull()
  })

  it('ISOLAMENTO: criar/editar ficha não muda módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma, companyId)
    await criarFicha({ companyId, nomeProduzido: 'Y', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    expect(isolationHeld(antes, await snapshotClosedModules(prisma, companyId))).toBe(true)
  })

  it('lista traz a versão atual de cada ficha', async () => {
    await criarFicha({ companyId, nomeProduzido: 'A', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    expect((await listFichas(companyId)).length).toBe(1)
  })

  it('3 NÍVEIS: ficha de PRODUTO_FINAL aceita intermediário E outra ficha final como componente (Combo)', async () => {
    // intermediário: porção de carne (usa coxão)
    const carne = await criarFicha({ companyId, nomeProduzido: 'Porção de carne', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    // produto final Xis: usa o INTERMEDIÁRIO (porção de carne) + insumo
    const xis = await criarFicha({ companyId, nomeProduzido: 'Xis', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: carne.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: gorduraId, qtdPlanejada: 0.05, unidade: 'KG' }] })
    // Combo (PRODUTO_FINAL) usa OUTRA ficha final (o Xis) como componente — recursão dos 3 níveis
    const combo = await criarFicha({ companyId, nomeProduzido: 'Combo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: xis.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' }] })
    const got = await getFicha(companyId, combo.fichaId)
    expect(got!.ficha.componentes[0].itemId).toBe(xis.itemProduzidoId) // Combo contém o Xis (outra ficha final)
    const gotXis = await getFicha(companyId, xis.fichaId)
    expect(gotXis!.ficha.componentes.some((c) => c.itemId === carne.itemProduzidoId)).toBe(true) // Xis contém o intermediário
  })

  it('custoMedio vem do LEDGER (movimento), não do campo stockItem.custoMedio (bug do editor)', async () => {
    // item com ENTRADA_NF de 46,95/kg mas SEM o campo custoMedio populado (como em prod)
    const acem = await prisma.stockItem.create({ data: { companyId, nome: 'Açém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } }) // custoMedio field = null
    await prisma.stockMovement.create({ data: { companyId, itemId: acem.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 33.95, custoTotal: 339.5, origem: 'SEFAZ' } })
    expect(acem.custoMedio).toBeNull() // o campo está null (é isso que enganava o editor)

    const { fichaId } = await criarFicha({ companyId, nomeProduzido: 'Porção', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: acem.id, qtdPlanejada: 1, unidade: 'KG' }] })
    const got = await getFicha(companyId, fichaId)
    expect(got!.ficha.componentes[0].custoMedio).toBe(33.95) // DERIVADO do movimento, não o campo null
    expect(got!.ficha.custoLote).toBe(33.95)
    expect(got!.ficha.custoADefinir).toBe(false)
  })
})
