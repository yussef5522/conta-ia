// ESTOQUE FASE 3 — mapa que aprende + GUARD dos 3 níveis. Destino de venda SÓ pode ser
// PRODUTO_FINAL (ficha) ou item REVENDA. Matéria-prima e intermediário são RECUSADOS na
// FONTE (não só escondidos na tela) — REGRA 1. Contra o arquivo real.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { previewImportSuitable, upsertVendaMap, VendaMapError } from '../venda-map'

const HTML = readFileSync(join(__dirname, 'fixtures/suitable-produtos-agrupado.xls'), 'utf-8')
const CNPJ = '90909090000190'
let companyId: string
let materiaPrimaId: string // Coxão Mole (cru) — NUNCA destino de venda
let cocaId: string // REVENDA — destino válido
let xisFichaId: string // PRODUTO_FINAL — destino válido
let intermFichaId: string // INTERMEDIARIO — NUNCA destino direto

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'VENDAS MAP' } })
  companyId = c.id
  const mp = await prisma.stockItem.create({ data: { companyId, nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  materiaPrimaId = mp.id
  await prisma.stockMovement.create({ data: { companyId, itemId: mp.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 40, custoTotal: 4000, origem: 'SEFAZ' } })
  const coca = await prisma.stockItem.create({ data: { companyId, nome: 'Coca 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
  cocaId = coca.id
  const xis = await criarFicha({ companyId, nomeProduzido: 'Xis Completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: mp.id, qtdPlanejada: 0.2, unidade: 'KG' }] }, prisma)
  xisFichaId = xis.fichaId
  const interm = await criarFicha({ companyId, nomeProduzido: 'Porção de carne 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: mp.id, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
  intermFichaId = interm.fichaId
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockVendaProdutoMap', 'stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('preview — só PRODUTO_FINAL e REVENDA como destino', () => {
  it('opções NÃO listam matéria-prima nem intermediário', async () => {
    const p = await previewImportSuitable(companyId, HTML, prisma)
    expect(p.opcoes.fichas.map((f) => f.nome)).toEqual(['Xis Completo']) // só o PRODUTO_FINAL
    expect(p.opcoes.fichas.some((f) => f.nome === 'Porção de carne 100g')).toBe(false) // intermediário fora
    expect(p.opcoes.itens.map((i) => i.nome)).toEqual(['Coca 2L']) // só REVENDA
    expect(p.opcoes.itens.some((i) => i.nome === 'Coxão Mole')).toBe(false) // matéria-prima fora
  })
})

describe('mapa que aprende + GUARD na fonte', () => {
  it('mapear pra PRODUTO_FINAL e REVENDA funciona; dupes do PDV → mesma ficha', async () => {
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
    await upsertVendaMap(companyId, 'XIS - COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
    const p = await previewImportSuitable(companyId, HTML, prisma)
    expect(p.naoMapeados).toBe(77)
    expect(p.linhas.find((l) => l.produto === 'XIS COMPLETO')!.alvoId).toBe(xisFichaId)
    expect(p.linhas.find((l) => l.produto === 'XIS - COMPLETO')!.alvoId).toBe(xisFichaId)
    expect(p.linhas.find((l) => l.produto === 'COCA COLA 2L')!.alvoTipo).toBe('REVENDA')
  })

  it('RECUSA venda mapeada em MATÉRIA-PRIMA (Coxão cru) — REGRA 1', async () => {
    await expect(upsertVendaMap(companyId, 'XIS - COXAO MOLE', { tipo: 'REVENDA', itemId: materiaPrimaId }, 'u', prisma)).rejects.toThrow(VendaMapError)
  })

  it('RECUSA venda mapeada em INTERMEDIÁRIO (porção de carne) — consumido via ficha', async () => {
    await expect(upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: intermFichaId }, 'u', prisma)).rejects.toThrow(VendaMapError)
  })
})
