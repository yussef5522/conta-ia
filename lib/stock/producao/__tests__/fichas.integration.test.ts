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
  const coxao = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA', custoMedio: 40 } })
  const gordura = await prisma.stockItem.create({ data: { companyId, nome: 'Gordura', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA', custoMedio: 8 } })
  coxaoId = coxao.id; gorduraId = gordura.id
})
afterEach(async () => {
  for (const t of ['stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem', 'stockSetor', 'stockColaborador'] as const) {
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
    const antes = await snapshotClosedModules(prisma)
    await criarFicha({ companyId, nomeProduzido: 'Y', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    expect(isolationHeld(antes, await snapshotClosedModules(prisma))).toBe(true)
  })

  it('lista traz a versão atual de cada ficha', async () => {
    await criarFicha({ companyId, nomeProduzido: 'A', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] })
    expect((await listFichas(companyId)).length).toBe(1)
  })
})
