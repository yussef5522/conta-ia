// ESTOQUE PARTE C — saída que não é venda: PERDA/USO_INTERNO com motivo obrigatório, baixa
// o estoque com custo real, relatório por motivo/item, e juiz (órfã = erro, perda alta = aviso).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { registrarSaida, relatorioPerdas, SaidaError } from '../saida'
import { checkSaidaInvariants } from '../saida-invariants'
import { saldoItem } from '../saldo'
import { snapshotClosedModules, isolationHeld } from '../stock-invariants'

const CNPJ = '14141414000114'
let companyId: string
let itemId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SAIDA' } })
  companyId = c.id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  itemId = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: 46.95, custoTotal: 939, origem: 'SEFAZ' } })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockSaida', 'stockMovement', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('registrarSaida', () => {
  it('perda (VENCEU) baixa o estoque com custo real + grava o motivo', async () => {
    const r = await registrarSaida({ companyId, itemId, quantidade: 2, motivo: 'VENCEU', data: '2026-08-22' }, prisma)
    expect(r.custoTotal).toBe(93.9) // 2 × 46,95
    expect((await saldoItem(prisma, companyId, itemId)).saldo).toBe(18) // 20 − 2
    const s = await prisma.stockSaida.findFirst({ where: { companyId } })
    expect(s?.motivo).toBe('VENCEU')
    expect(s?.tipoMovimento).toBe('PERDA')
    const mov = await prisma.stockMovement.findFirst({ where: { companyId, tipo: 'PERDA' } })
    expect(mov?.quantidade).toBe(-2)
  })
  it('uso interno (CONSUMO_FUNCIONARIO) vira movimento USO_INTERNO', async () => {
    await registrarSaida({ companyId, itemId, quantidade: 1, motivo: 'CONSUMO_FUNCIONARIO', data: '2026-08-22' }, prisma)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'USO_INTERNO' } })).toBe(1)
  })
  it('sem motivo válido → recusa', async () => {
    // @ts-expect-error motivo inválido de propósito
    await expect(registrarSaida({ companyId, itemId, quantidade: 1, motivo: '' }, prisma)).rejects.toThrow(SaidaError)
  })
  it('ISOLAMENTO: registrar saída não muda módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma)
    await registrarSaida({ companyId, itemId, quantidade: 1, motivo: 'ESTRAGOU' }, prisma)
    expect(isolationHeld(antes, await snapshotClosedModules(prisma))).toBe(true)
  })
})

describe('relatório + juiz C', () => {
  it('relatório agrupa por motivo e por item', async () => {
    await registrarSaida({ companyId, itemId, quantidade: 2, motivo: 'VENCEU', data: '2026-08-22' }, prisma)
    await registrarSaida({ companyId, itemId, quantidade: 1, motivo: 'ESTRAGOU', data: '2026-08-22' }, prisma)
    const rel = await relatorioPerdas(companyId, '2026-08-01', '2026-08-31', prisma)
    expect(rel.totalValor).toBe(140.85) // 3 × 46,95
    expect(rel.porMotivo.map((m) => m.motivo).sort()).toEqual(['ESTRAGOU', 'VENCEU'])
    expect(rel.porItem[0].valor).toBe(140.85)
  })
  it('C1: movimento de saída SEM stock_saida → erro', async () => {
    // injeta uma PERDA "na mão" sem a linha de motivo (simula anomalia)
    await prisma.stockMovement.create({ data: { companyId, itemId, tipo: 'PERDA', quantidade: -1, custoUnitario: 46.95, custoTotal: -46.95, origem: 'MANUAL' } })
    const f = (await checkSaidaInvariants(prisma)).filter((x) => x.companyId === companyId)
    expect(f.some((x) => x.invariante === 'C1' && x.nivel !== 'aviso')).toBe(true)
  })
  it('C2 (aviso): perda > 30% do consumo do mês', async () => {
    // consumo por venda 10; perda 5 → 50% > 30%
    await prisma.stockMovement.create({ data: { companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -10, custoUnitario: 1, custoTotal: -10, origem: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId, tipo: 'PERDA', quantidade: -5, custoUnitario: 1, custoTotal: -5, origem: 'MANUAL' } })
    await prisma.stockSaida.create({ data: { companyId, itemId, movementId: 'x', tipoMovimento: 'PERDA', motivo: 'VENCEU', quantidade: 5, custoUnitario: 1, custoTotal: 5, data: new Date() } })
    const f = (await checkSaidaInvariants(prisma)).filter((x) => x.companyId === companyId)
    expect(f.some((x) => x.invariante === 'C2' && x.nivel === 'aviso')).toBe(true)
  })
})
