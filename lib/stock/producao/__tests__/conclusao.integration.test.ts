// ESTOQUE FASE 2 item 2.2 — conclusão: consumo real → PRODUCAO_CONSUMO (não duplica a
// prateleira) + PRODUCAO_GERACAO (produto entra com custo REAL) → rendimento MEDIDO contra
// o consumo (não a escala). Invariante P1 (Σ SEPARACAO == Σ CONSUMO + Σ DEVOLUCAO). Parcial.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao, TIPO_SEPARACAO, TIPO_CONSUMO, TIPO_DEVOLUCAO } from '../ordens'
import { concluir } from '../conclusao'
import { saldoItem } from '../../saldo'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'

const CNPJ = '50505050000150'
let companyId: string
let ids: Record<string, string> = {}
let fichaId: string
let produtoId: string

const COMPS = [{ nome: 'Coxão Mole', custo: 46.95 }, { nome: 'Açém', custo: 33.95 }, { nome: 'Gordura', custo: 9.6 }]

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONCLUSAO' } })
  companyId = c.id; ids = {}
  for (const k of COMPS) {
    const it = await prisma.stockItem.create({ data: { companyId, nome: k.nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    ids[k.nome] = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 20, custoUnitario: k.custo, custoTotal: k.custo * 20, origem: 'SEFAZ' } })
  }
  const f = await criarFicha({ companyId, nomeProduzido: 'Porção de carne 100g', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 15, componentes: COMPS.map((k, i) => ({ itemId: ids[k.nome], qtdPlanejada: 1, unidade: 'KG', posicao: i })) }, prisma)
  fichaId = f.fichaId; produtoId = f.itemProduzidoId
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function ordemSeparada(escala: number, sep: number) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: escala, dataProducao: new Date('2026-08-21') }, prisma)
  await confirmarSeparacao(companyId, ordemId, COMPS.map((k) => ({ itemId: ids[k.nome], qtdSeparada: sep })), prisma)
  await iniciarProducao(companyId, ordemId)
  return ordemId
}

describe('conclusão 2.2', () => {
  it('conclui: rendimento 17 contra o REAL, custo do lote 90,50, produto entra com 5,32/un', async () => {
    const ordemId = await ordemSeparada(100, 1) // escala 100 mas separou 1kg de cada
    const r = await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 1 })), qtdGerada: 17 }, prisma)
    expect(r.escalaConsumida).toBe(1) // 1kg / 1kg por lote = 1 (não a escala 100)
    expect(r.rendimento).toBe(17) // 17 / 1
    expect(r.custoLoteReal).toBe(90.5) // 46,95 + 33,95 + 9,60
    expect(r.custoUnitarioReal).toBe(5.32) // 90,50 / 17
    expect(r.validadeAte?.slice(0, 10)).toBe('2026-09-05') // 21/08 + 15 dias
    expect(r.estado).toBe('CONCLUIDA')

    // produto entrou no estoque: 17 UN, valor 90,50, custo médio 5,32
    const sp = await saldoItem(prisma, companyId, produtoId)
    expect(sp.saldo).toBe(17)
    expect(sp.valor).toBe(90.5)
    expect(sp.custoMedio).toBe(5.32)
    // insumo NÃO foi baixado 2× (só o SEPARACAO_SAIDA conta na prateleira): 20 − 1 = 19
    expect((await saldoItem(prisma, companyId, ids['Coxão Mole'])).saldo).toBe(19)
  })

  it('invariante P1: Σ SEPARACAO == Σ CONSUMO + Σ DEVOLUCAO (nada evapora)', async () => {
    const ordemId = await ordemSeparada(1, 1.2) // separou 1,2 de cada
    await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 1 })), qtdGerada: 15 }, prisma) // consumiu 1, sobra 0,2 volta
    for (const k of COMPS) {
      const movs = await prisma.stockMovement.findMany({ where: { companyId, receiptId: ordemId, itemId: ids[k.nome] } })
      const sep = movs.filter((m) => m.tipo === TIPO_SEPARACAO).reduce((s, m) => s + Math.abs(m.quantidade), 0)
      const con = movs.filter((m) => m.tipo === TIPO_CONSUMO).reduce((s, m) => s + Math.abs(m.quantidade), 0)
      const dev = movs.filter((m) => m.tipo === TIPO_DEVOLUCAO).reduce((s, m) => s + Math.abs(m.quantidade), 0)
      expect(Math.round(sep * 100) / 100).toBe(Math.round((con + dev) * 100) / 100) // 1,2 == 1 + 0,2
    }
    // sobra voltou: 20 − 1,2 (separou) + 0,2 (devolveu) = 19
    expect((await saldoItem(prisma, companyId, ids['Coxão Mole'])).saldo).toBe(19)
  })

  it('parcial: 300 hoje deixa a ordem EM_PRODUCAO; conclui o resto depois', async () => {
    const ordemId = await ordemSeparada(5, 5) // 5kg de cada em produção
    const p1 = await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 3 })), qtdGerada: 300, parcial: true }, prisma)
    expect(p1.estado).toBe('EM_PRODUCAO') // ainda aberta
    const p2 = await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 2 })), qtdGerada: 200 }, prisma)
    expect(p2.estado).toBe('CONCLUIDA')
    // produto total = 500 UN
    expect((await saldoItem(prisma, companyId, produtoId)).saldo).toBe(500)
    // rendimento da 2ª conclusão comparou com a 1ª (média anterior existe)
    expect(p2.rendimentoMedioAnterior).not.toBeNull()
  })

  it('não consome mais do que está em produção; não conclui ordem já concluída', async () => {
    const ordemId = await ordemSeparada(1, 1)
    await expect(concluir({ companyId, ordemId, consumo: [{ itemId: ids['Coxão Mole'], qtdConsumida: 5 }], qtdGerada: 10 }, prisma)).rejects.toThrow()
    await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 1 })), qtdGerada: 17 }, prisma)
    await expect(concluir({ companyId, ordemId, consumo: [{ itemId: ids['Coxão Mole'], qtdConsumida: 1 }], qtdGerada: 5 }, prisma)).rejects.toThrow()
  })

  it('ISOLAMENTO: conclusão não muda módulo fechado', async () => {
    const ordemId = await ordemSeparada(1, 1)
    const antes = await snapshotClosedModules(prisma, companyId)
    await concluir({ companyId, ordemId, consumo: COMPS.map((k) => ({ itemId: ids[k.nome], qtdConsumida: 1 })), qtdGerada: 17 }, prisma)
    expect(isolationHeld(antes, await snapshotClosedModules(prisma, companyId))).toBe(true)
  })
})
