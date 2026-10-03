// ESTOQUE FASE 2 item 2.4 — sugestão de produção (min/max). Executa a lógica real.
// (o cardápio/margem saiu daqui em 27/08 → lib/stock/cardapio/__tests__/hub.integration)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { sugestoesDeProducao } from '../sugestao-cardapio'

const CNPJ = '60606060000160'
let companyId: string
let insumoId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'SUGESTAO' } })
  companyId = c.id
  const insumo = await prisma.stockItem.create({ data: { companyId, nome: 'Insumo', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  insumoId = insumo.id
  await prisma.stockMovement.create({ data: { companyId, itemId: insumoId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 10, custoTotal: 1000, origem: 'SEFAZ' } })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('sugestão de produção (min/max)', () => {
  it('produzido abaixo do mínimo → sugere; sem mínimo ou acima → não sugere', async () => {
    const f = await criarFicha({ companyId, nomeProduzido: 'Produto A', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: insumoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // sem mínimo → nenhuma sugestão
    expect(await sugestoesDeProducao(companyId, prisma)).toHaveLength(0)
    // define mínimo 10, máximo 50; saldo do produzido = 0 → abaixo
    await prisma.stockItem.update({ where: { id: f.itemProduzidoId }, data: { estoqueMin: 10, estoqueMax: 50 } })
    const sug = await sugestoesDeProducao(companyId, prisma)
    expect(sug).toHaveLength(1)
    expect(sug[0].saldo).toBe(0)
    expect(sug[0].faltam).toBe(50) // até o máximo
    /**
     * ⛔⛔ **ASSERÇÃO INVERTIDA EM 03/10 — e ela escondia um BUG SILENCIOSO.**
     *
     * Era `toBeNull()` com o comentário *"sem rendimento ainda → a apurar"*, porque a escala
     * saía de `faltam ÷ rendimentoMedio`. Só que a tela faz `escalaReceitas: escalaSugerida ?? 1`
     * — então o botão "criar ordem" do painel, numa receita **nunca produzida**, criava uma
     * ordem de **1 unidade** faltando **50**. O `null` não era "a apurar" na prática: era
     * uma ordem errada, do tamanho errado, sem nada na tela dizendo isso.
     *
     * ⭐ Com a decisão do dono (*"a separação é SEMPRE ficha × pedido"*) a escala sai de
     * `faltam ÷ loteBase`, que **não precisa de histórico**: ficha nova sugere o número certo
     * desde o primeiro clique. A segunda porta virou a porta certa.
     */
    expect(sug[0].escalaSugerida).toBe(50) // loteBase 1 → 50 unidades = 50 receitas
    expect(sug[0].rendimentoMedio).toBeNull() // ⭐ e o espelho segue honesto: sem histórico
  })

  it('⭐ loteBase > 1 divide a sugestão — e o espelho continua fora da conta', async () => {
    /**
     * ⚠️ O caso da massa que rende 17 metades: faltando 34, a sugestão é **2 receitas**, não
     * 34. É `escalaDoPedido` — a MESMA porta que a tela de criar ordem usa (REGRA 4), e não
     * uma segunda divisão escrita aqui.
     */
    const f = await criarFicha({ companyId, nomeProduzido: 'Massa', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 17, unidadeLoteBase: 'UN', componentes: [{ itemId: insumoId, qtdPlanejada: 5, unidade: 'KG' }] }, prisma)
    await prisma.stockItem.update({ where: { id: f.itemProduzidoId }, data: { estoqueMin: 10, estoqueMax: 34 } })
    const sug = (await sugestoesDeProducao(companyId, prisma)).find((s) => s.nome === 'Massa')!
    expect(sug.faltam).toBe(34)
    expect(sug.escalaSugerida).toBe(2)
  })
})
