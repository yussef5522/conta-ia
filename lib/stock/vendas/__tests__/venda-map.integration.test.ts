// ESTOQUE FASE 3 — mapa que aprende + preview. As 2 duplicatas do PDV apontam pra MESMA
// ficha; nome não mapeado fica pendente; mapear resolve na próxima. Contra o arquivo real.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { previewImportSuitable, upsertVendaMap } from '../venda-map'

const HTML = readFileSync(join(__dirname, 'fixtures/suitable-produtos-agrupado.xls'), 'utf-8')
const CNPJ = '90909090000190'
let companyId: string
let insumoId: string
let xisFichaId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'VENDAS MAP' } })
  companyId = c.id
  const insumo = await prisma.stockItem.create({ data: { companyId, nome: 'Pão', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  insumoId = insumo.id
  await prisma.stockMovement.create({ data: { companyId, itemId: insumoId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 1, custoTotal: 100, origem: 'SEFAZ' } })
  const f = await criarFicha({ companyId, nomeProduzido: 'Xis Completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  xisFichaId = f.fichaId
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

describe('preview + mapa que aprende', () => {
  it('sem mapa → tudo pendente (80 não mapeados)', async () => {
    const p = await previewImportSuitable(companyId, HTML, prisma)
    expect(p.totalProdutos).toBe(80)
    expect(p.naoMapeados).toBe(80)
    expect(p.opcoes.fichas.some((f) => f.nome === 'Xis Completo')).toBe(true)
  })

  it('mapear resolve; as 2 duplicatas do PDV → mesma ficha; revenda → item', async () => {
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
    await upsertVendaMap(companyId, 'XIS - COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma) // duplicata → mesma ficha
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: insumoId }, 'u', prisma)
    const p = await previewImportSuitable(companyId, HTML, prisma)
    expect(p.naoMapeados).toBe(77)
    const xis1 = p.linhas.find((l) => l.produto === 'XIS COMPLETO')!
    const xis2 = p.linhas.find((l) => l.produto === 'XIS - COMPLETO')!
    expect(xis1.alvoId).toBe(xisFichaId)
    expect(xis2.alvoId).toBe(xisFichaId) // as duas → a mesma ficha
    expect(xis1.mapeado).toBe(true)
    const coca = p.linhas.find((l) => l.produto === 'COCA COLA 2L')!
    expect(coca.alvoTipo).toBe('REVENDA')
  })

  it('re-mapear troca o alvo (renomeação no Suitable = nome novo, pergunta de novo)', async () => {
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'REVENDA', itemId: insumoId }, 'u', prisma) // troca
    const p = await previewImportSuitable(companyId, HTML, prisma)
    expect(p.linhas.find((l) => l.produto === 'XIS COMPLETO')!.alvoTipo).toBe('REVENDA')
  })
})
