// ESTOQUE PARTE B — lançamento manual: vendáveis (só PRODUTO_FINAL + REVENDA), baixa igual
// ao import, e CONVIVE com o import do dia (mescla por nome; reprocessar cobre os dois).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { listVendaveis, confirmarLancamentoManual, previewLancamentoManual } from '../lancamento-manual'
import { processarVendas } from '../baixa-venda'
import { upsertVendaMap } from '../venda-map'
import { saldoItem } from '../../saldo'

const CNPJ = '15151515000115'
let companyId: string, paoId = '', cocaId = '', xisFichaId = '', xisItemId = ''

const html = (linhas: [string, number][]) => `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>${linhas.map(([p, q]) => `<tr><td>${p}</td><td>${q}</td><td>R$ 0,00</td><td>R$ 0,00</td></tr>`).join('')}</table></body></html>`

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'MANUAL' } })
  companyId = c.id
  const pao = await prisma.stockItem.create({ data: { companyId, nome: 'Pão', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  paoId = pao.id
  await prisma.stockMovement.create({ data: { companyId, itemId: paoId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 1, custoTotal: 100, origem: 'SEFAZ' } })
  const coca = await prisma.stockItem.create({ data: { companyId, nome: 'Coca 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
  cocaId = coca.id
  await prisma.stockMovement.create({ data: { companyId, itemId: cocaId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 8, custoTotal: 800, origem: 'SEFAZ' } })
  // matéria-prima e intermediário NÃO devem aparecer nos vendáveis
  await prisma.stockItem.create({ data: { companyId, nome: 'Coxão cru', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  const xis = await criarFicha({ companyId, nomeProduzido: 'Xis Completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  xisFichaId = xis.fichaId; xisItemId = xis.itemProduzidoId
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

describe('lançamento manual', () => {
  it('vendáveis = só PRODUTO_FINAL + REVENDA (matéria-prima/intermediário fora)', async () => {
    const v = await listVendaveis(companyId, prisma)
    expect(v.fichas.map((f) => f.nome)).toEqual(['Xis Completo'])
    expect(v.itens.map((i) => i.nome)).toEqual(['Coca 2L'])
  })

  it('lançar 3 Xis + 2 Coca baixa o estoque (pão −3, coca −2)', async () => {
    const entradas = [{ alvoTipo: 'FICHA' as const, alvoId: xisFichaId, quantidade: 3 }, { alvoTipo: 'REVENDA' as const, alvoId: cocaId, quantidade: 2 }]
    const plano = await previewLancamentoManual(companyId, '2026-08-22', entradas, 'u', prisma)
    expect(plano.agregada.find((a) => a.nome === 'Pão')?.qtd).toBe(3)
    await confirmarLancamentoManual(companyId, '2026-08-22', entradas, 'u', prisma)
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(97)
    expect((await saldoItem(prisma, companyId, cocaId)).saldo).toBe(98)
  })

  it('CONVIVE com o import do dia: manual soma ao Suitable, reprocessar cobre os dois', async () => {
    // Suitable do dia: 2 Coca (mapeada)
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
    await processarVendas(companyId, '2026-08-22', html([['COCA COLA 2L', 2]]), 'u', prisma)
    expect((await saldoItem(prisma, companyId, cocaId)).saldo).toBe(98) // −2 do Suitable
    // manual: + 3 Xis no MESMO dia → convive (pão −3), Coca do Suitable segue
    await confirmarLancamentoManual(companyId, '2026-08-22', [{ alvoTipo: 'FICHA', alvoId: xisFichaId, quantidade: 3 }], 'u', prisma)
    expect((await saldoItem(prisma, companyId, paoId)).saldo).toBe(97) // xis baixou o pão
    expect((await saldoItem(prisma, companyId, cocaId)).saldo).toBe(98) // Coca do Suitable preservada (não dobrou)
    expect(xisItemId).toBeTruthy()
  })
})
