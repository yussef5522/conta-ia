// ESTOQUE FASE 3 passo 2 — BAIXA_VENDA: explosão recursiva (Combo→Xis→beef+pão), revenda
// direta (Coca), idempotência por dia (reprocessar não duplica), pendentes não baixam.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { montarPlanoVenda, processarVendas, vendasPendentesDeMapa } from '../baixa-venda'
import { upsertVendaMap } from '../venda-map'
import { saldoItem } from '../../saldo'

const CNPJ = '13131313000113'
let companyId: string
let paoId = '', beefId = '', refriId = '', cocaId = '', xisFichaId = '', comboFichaId = ''

// HTML do Suitable (mínimo) com as linhas passadas
const html = (linhas: [string, number][]) =>
  `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>${linhas.map(([p, q]) => `<tr><td>${p}</td><td>${q}</td><td>R$ 0,00</td><td>R$ 0,00</td></tr>`).join('')}</table></body></html>`

async function estoque(nome: string, cat: string, qtd: number, custo: number) {
  const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'CONFERENCIA' } })
  if (qtd > 0) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' } })
  return it.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'BAIXA' } })
  companyId = c.id
  paoId = await estoque('Pão de xis', 'MATERIA_PRIMA', 100, 1)
  refriId = await estoque('Refri lata', 'REVENDA', 100, 3)
  cocaId = await estoque('Coca 2L', 'REVENDA', 100, 8)
  // beef intermediário (com ficha própria) + estoque produzido
  const carne = await estoque('Carne moída', 'MATERIA_PRIMA', 100, 40)
  const beef = await criarFicha({ companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: carne, qtdPlanejada: 0.1, unidade: 'KG' }] }, prisma)
  beefId = beef.itemProduzidoId
  await prisma.stockMovement.create({ data: { companyId, itemId: beefId, tipo: 'PRODUCAO_GERACAO', quantidade: 50, custoUnitario: 4, custoTotal: 200, origem: 'MANUAL' } })
  // Xis (produto final) = 1 beef + 1 pão
  const xis = await criarFicha({ companyId, nomeProduzido: 'Xis completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: beefId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  xisFichaId = xis.fichaId
  // Combo (produto final) = 1 Xis (outra ficha final) + 1 refri
  const combo = await criarFicha({ companyId, nomeProduzido: 'Combo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: xis.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: refriId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  comboFichaId = combo.fichaId
  await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
  await upsertVendaMap(companyId, 'COMBO CACULA', { tipo: 'FICHA', fichaId: comboFichaId }, 'u', prisma)
  await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap', 'stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('BAIXA_VENDA', () => {
  it('explode Combo→Xis→beef+pão e baixa revenda direto; pendente não baixa', async () => {
    const arquivo = html([['XIS COMPLETO', 2], ['COMBO CACULA', 1], ['COCA COLA 2L', 3], ['PRODUTO NOVO X', 5]])
    const plano = await montarPlanoVenda(companyId, '2026-08-22', arquivo, prisma)
    expect(plano.totalMapeados).toBe(3)
    expect(plano.totalPendentes).toBe(1)
    expect(plano.pendentes[0].nome).toBe('PRODUTO NOVO X')
    // agregado: beef 3 (2 xis + 1 do combo), pão 3, refri 1, coca 3
    const ag = new Map(plano.agregada.map((a) => [a.itemId, a.qtd]))
    expect(ag.get(beefId)).toBe(3)
    expect(ag.get(paoId)).toBe(3)
    expect(ag.get(refriId)).toBe(1)
    expect(ag.get(cocaId)).toBe(3)

    await processarVendas(companyId, '2026-08-22', arquivo, 'u', prisma)
    expect((await saldoItem(prisma, companyId, beefId)).saldo).toBe(47) // 50 − 3
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(97) // 100 − 3
    expect((await saldoItem(prisma, companyId, cocaId)).saldo).toBe(97) // 100 − 3
    // o produto novo virou pendente (não baixou nada dele)
    const pend = await vendasPendentesDeMapa(companyId, prisma)
    expect(pend.some((p) => p.nome === 'PRODUTO NOVO X')).toBe(true)
  })

  it('idempotente: processar o mesmo dia 2× não duplica a baixa', async () => {
    const arquivo = html([['XIS COMPLETO', 2]])
    await processarVendas(companyId, '2026-08-22', arquivo, 'u', prisma)
    await processarVendas(companyId, '2026-08-22', arquivo, 'u', prisma) // reprocessa
    expect((await saldoItem(prisma, companyId, beefId)).saldo).toBe(48) // 50 − 2 (não −4)
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(98)
    // 1 import só (unique por data)
    expect(await prisma.stockVendaImport.count({ where: { companyId } })).toBe(1)
  })

  it('reprocessar com qtd MENOR ajusta (estorna e refaz)', async () => {
    await processarVendas(companyId, '2026-08-22', html([['XIS COMPLETO', 5]]), 'u', prisma)
    expect((await saldoItem(prisma, companyId, beefId)).saldo).toBe(45)
    await processarVendas(companyId, '2026-08-22', html([['XIS COMPLETO', 2]]), 'u', prisma)
    expect((await saldoItem(prisma, companyId, beefId)).saldo).toBe(48) // 50 − 2 (corrigiu de 5)
  })
})
