// ESTOQUE FASE 1 item 1 — o LEDGER. Prova: validador (arredondamento real), o caminho
// de CORREÇÃO (cria → estorna → novo → saldo fecha), imutabilidade (UPDATE/DELETE
// recusados no banco), saldo == Σ, e ISOLAMENTO. Antes de qualquer tela existir.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { assertMovementValid, criarMovimento, estornarMovimento, MovementInvalidError } from '../movement'
import { saldoItem } from '../saldo'
import { snapshotClosedModules, isolationHeld } from '../stock-invariants'

const CNPJ = '77888999000111'
let companyId: string
let itemId: string

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA LEDGER TESTE' } })
  companyId = c.id
  const item = await prisma.stockItem.create({ data: { companyId, nome: 'OLEO DE SOJA', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
  itemId = item.id
  // dev (sqlite) não aplica o trigger da migration (Postgres) → aplica o equivalente
  // sqlite pra provar a imutabilidade aqui também (o prod usa o plpgsql da migration).
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS trg_stock_movement_no_update BEFORE UPDATE ON stock_movement BEGIN SELECT RAISE(ABORT, 'MOVIMENTO IMUTAVEL'); END;`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER IF NOT EXISTS trg_stock_movement_no_delete BEFORE DELETE ON stock_movement BEGIN SELECT RAISE(ABORT, 'MOVIMENTO IMUTAVEL'); END;`)
})
afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`)
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`)
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('assertMovementValid — CHECK do custo (arredondamento real ±0,01/linha)', () => {
  it('aceita o arredondamento real: qtd 0,333 × custo 10,00 = 3,33', () => {
    expect(() => assertMovementValid({ quantidade: 0.333, custoUnitario: 10.0, custoTotal: 3.33 })).not.toThrow()
  })
  it('recusa custoTotal torto (3,50 pra 0,333×10,00)', () => {
    expect(() => assertMovementValid({ quantidade: 0.333, custoUnitario: 10.0, custoTotal: 3.5 })).toThrow(MovementInvalidError)
  })
  it('recusa quantidade 0', () => {
    expect(() => assertMovementValid({ quantidade: 0, custoUnitario: 10, custoTotal: 0 })).toThrow(MovementInvalidError)
  })
})

describe('LEDGER — imutabilidade + correção', () => {
  it('IMUTÁVEL: o banco recusa UPDATE e DELETE (pelo TRIGGER, msg acionável)', async () => {
    const mov = await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, origem: 'MANUAL' })
    // SQL cru pra bater direto no trigger (sem a camada de FK do prisma) e exigir a MENSAGEM.
    await expect(prisma.$executeRawUnsafe(`UPDATE stock_movement SET quantidade = 99 WHERE id = '${mov.id}'`)).rejects.toThrow(/IMUTAVEL/i)
    await expect(prisma.$executeRawUnsafe(`DELETE FROM stock_movement WHERE id = '${mov.id}'`)).rejects.toThrow(/IMUTAVEL/i)
    // segue existindo, intacto
    const ainda = await prisma.stockMovement.findUnique({ where: { id: mov.id } })
    expect(ainda?.quantidade).toBe(10)
  })

  it('CORREÇÃO: cria → estorna → novo → saldo fecha (o fluxo de "conferi errado")', async () => {
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'ITEM CORRECAO', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    // entrada errada: 120 un @ 7,72 = 926,40
    const errado = await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 120, custoUnitario: 7.72, origem: 'SEFAZ' })
    expect((await saldoItem(prisma, companyId, item.id)).saldo).toBe(120)
    // conferiu errado → ESTORNA (não edita o original)
    const estorno = await estornarMovimento(prisma, errado.id, { criadoPorId: 'user-teste' })
    expect(estorno.tipo).toBe('ESTORNO')
    expect(estorno.quantidade).toBe(-120)
    expect(estorno.estornoDeId).toBe(errado.id)
    expect((await saldoItem(prisma, companyId, item.id)).saldo).toBe(0) // zerou
    // cria o CERTO: veio 100, não 120
    await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 7.72, origem: 'SEFAZ' })
    const fim = await saldoItem(prisma, companyId, item.id)
    expect(fim.saldo).toBe(100) // 120 − 120 + 100 = SALDO FECHA
    expect(fim.custoMedio).toBe(7.72)
    // o original SEGUE lá (rastro), o ledger só cresce
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: item.id } })).toBe(3)
  })

  it('estorno é idempotente (estornar 2× = 1 estorno)', async () => {
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'ITEM IDEMP', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    const mov = await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 5, custoUnitario: 2, origem: 'MANUAL' })
    const e1 = await estornarMovimento(prisma, mov.id)
    const e2 = await estornarMovimento(prisma, mov.id)
    expect(e1.id).toBe(e2.id)
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: item.id, tipo: 'ESTORNO' } })).toBe(1)
  })
})

describe('saldo derivado + isolamento', () => {
  it('saldo == Σ movimentos', async () => {
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'ITEM SOMA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
    await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 3.5, custoUnitario: 10, origem: 'SEFAZ' })
    await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 1.5, custoUnitario: 12, origem: 'SEFAZ' })
    const s = await saldoItem(prisma, companyId, item.id)
    expect(s.saldo).toBe(5) // 3,5 + 1,5
    expect(s.valor).toBe(53) // 35 + 18
    expect(s.custoMedio).toBe(10.6) // 53 / 5
  })

  it('ISOLAMENTO: mexer no ledger não muda nenhum módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma)
    const item = await prisma.stockItem.create({ data: { companyId, nome: 'ITEM ISO', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    await criarMovimento(prisma, { companyId, itemId: item.id, tipo: 'ENTRADA_NF', quantidade: 1, custoUnitario: 1, origem: 'MANUAL' })
    expect(isolationHeld(antes, await snapshotClosedModules(prisma))).toBe(true)
  })
})
