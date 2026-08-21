// ESTOQUE FASE 1 item 2 — o extrato do estoque: lê o ledger, resolve referência (nota),
// destaca estorno, filtra, exporta CSV.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from '../movement'
import { listMovimentos, movimentosToCsv } from '../movimentos'

const CNPJ = '50607080000199'
const CHAVE = '43260850607080000199550100000000011234500017'
let companyId: string
let itemId: string

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA EXTRATO' } })
  companyId = c.id
  const item = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  itemId = item.id
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', emitNome: 'FRIGORIFICO SILVA' } })
  const mov = await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 28, custoUnitario: 40, nfeChave: CHAVE, origem: 'SEFAZ' })
  await estornarMovimento(prisma, mov.id)
})
afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('listMovimentos', () => {
  it('lista com referência da nota (fornecedor + nº) e destaca o estorno', async () => {
    const ms = await listMovimentos(companyId, {})
    expect(ms).toHaveLength(2) // entrada + estorno
    const entrada = ms.find((m) => m.tipo === 'ENTRADA_NF')!
    expect(entrada.referencia.tipo).toBe('nota')
    expect(entrada.referencia.label).toContain('FRIGORIFICO SILVA')
    expect(entrada.referencia.nfeId).toBeTruthy()
    const estorno = ms.find((m) => m.tipo === 'ESTORNO')!
    expect(estorno.estorno).toBe(true)
    expect(estorno.quantidade).toBe(-28)
  })
  it('filtra por tipo', async () => {
    expect(await listMovimentos(companyId, { tipo: 'ESTORNO' })).toHaveLength(1)
  })
  it('CSV tem cabeçalho + linhas com ; e vírgula decimal', async () => {
    const csv = movimentosToCsv(await listMovimentos(companyId, {}))
    expect(csv.split('\n')[0]).toContain('Data')
    expect(csv).toContain('"40,00"') // custo unit com vírgula
  })
})
