// ESTOQUE FASE 2 item 2.1 — ordem + separação: cria ordem, explode a ficha × escala,
// separa (SEPARACAO_SAIDA sai do estoque geral → em-produção), devolve sobra, cancela
// (devolve tudo). Invariante do armazém em-produção + ISOLAMENTO. Executa o ledger real.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, explodirSeparacao, confirmarSeparacao, iniciarProducao, devolverInsumo, cancelarOrdem, getOrdem, OrdemError } from '../ordens'
import { saldoItem } from '../../saldo'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'

const CNPJ = '40404040000140'
let companyId: string
let coxaoId: string
let fichaId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ORDENS' } })
  companyId = c.id
  const coxao = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  coxaoId = coxao.id
  // 20kg em estoque a 46,95/kg (custo derivado)
  await prisma.stockMovement.create({ data: { companyId, itemId: coxaoId, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 46.95, custoTotal: 939, origem: 'SEFAZ' } })
  const f = await criarFicha({ companyId, nomeProduzido: 'Porção de carne 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: coxaoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
  fichaId = f.fichaId
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('ordens de produção 2.1', () => {
  it('cria ordem PLANEJADA e a separação vem pré-preenchida da ficha × escala', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: new Date('2026-08-21') }, prisma)
    const o = await getOrdem(companyId, ordemId)
    expect(o!.estado).toBe('PLANEJADA')
    const { linhas } = await explodirSeparacao(companyId, ordemId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].qtdPlanejada).toBe(5) // 1kg × escala 5
    expect(linhas[0].saldoDisponivel).toBe(20)
    expect(linhas[0].custoMedio).toBe(46.95)
    expect(linhas[0].qtdSeparada).toBe(0)
  })

  it('separar tira do estoque geral e põe em-produção (SEPARACAO_SAIDA), estado → SEPARADA', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: new Date('2026-08-21') }, prisma)
    // o dono pegou 5,2kg (mais que os 5 planejados) — registra o REAL
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 5.2 }], prisma)
    const o = await getOrdem(companyId, ordemId)
    expect(o!.estado).toBe('SEPARADA')
    // estoque geral caiu de 20 → 14,8
    expect((await saldoItem(prisma, companyId, coxaoId)).saldo).toBe(14.8)
    // em-produção = 5,2
    const { linhas } = await explodirSeparacao(companyId, ordemId)
    expect(linhas[0].qtdSeparada).toBe(5.2)
  })

  it('devolver sobra volta pro estoque geral (DEVOLUCAO_PRODUCAO)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: new Date('2026-08-21') }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 5.2 }], prisma)
    await iniciarProducao(companyId, ordemId)
    await devolverInsumo(companyId, ordemId, coxaoId, 0.2, prisma) // sobrou 0,2
    expect((await saldoItem(prisma, companyId, coxaoId)).saldo).toBe(15) // 14,8 + 0,2
    const { linhas } = await explodirSeparacao(companyId, ordemId)
    expect(linhas[0].qtdSeparada).toBe(5) // em-produção 5,2 − 0,2
  })

  it('não dá pra devolver mais do que está em produção', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: new Date('2026-08-21') }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 5 }], prisma)
    await expect(devolverInsumo(companyId, ordemId, coxaoId, 6, prisma)).rejects.toThrow(OrdemError)
  })

  it('cancelar após separar DEVOLVE tudo pro estoque geral (nada some)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: new Date('2026-08-21') }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 5 }], prisma)
    await cancelarOrdem(companyId, ordemId, prisma)
    const o = await getOrdem(companyId, ordemId)
    expect(o!.estado).toBe('CANCELADA')
    expect((await saldoItem(prisma, companyId, coxaoId)).saldo).toBe(20) // voltou ao inicial
  })

  it('não separa 2×; não produz sem separar', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-08-21') }, prisma)
    await expect(iniciarProducao(companyId, ordemId)).rejects.toThrow(OrdemError) // PLANEJADA
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 1 }], prisma)
    await expect(confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 1 }], prisma)).rejects.toThrow(OrdemError) // já SEPARADA
  })

  it('ISOLAMENTO: ordem/separação não muda módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma, companyId)
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 2, dataProducao: new Date('2026-08-21') }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: coxaoId, qtdSeparada: 2 }], prisma)
    expect(isolationHeld(antes, await snapshotClosedModules(prisma, companyId))).toBe(true)
  })
})
