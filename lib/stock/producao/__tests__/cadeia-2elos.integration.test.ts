// ESTOQUE FASE 2 — CADEIA DE 2 ELOS (fluxo real do dono): Acém+Coxão+Gordura → GESSADO
// (intermediário 1) → BEEF DE XIS (intermediário 2, consome gessado). Rendimento e custo
// MEDIDOS em CADA elo (a máquina perde peso; a moldagem também). A produção do beef consome
// gessado do estoque; a do gessado consumiu as carnes. Ciclo bloqueado continua valendo.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, FichaError } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao, explodirSeparacao } from '../ordens'
import { concluir } from '../conclusao'
import { saldoItem } from '../../saldo'

const CNPJ = '11223344000155'
let companyId: string
let ids: Record<string, string> = {}
const CARNES = [{ nome: 'Acém', custo: 33.95 }, { nome: 'Coxão Mole', custo: 46.95 }, { nome: 'Gordura', custo: 9.6 }]

async function produzir(fichaId: string, itens: { itemId: string; qtd: number }[], qtdGerada: number) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 1, dataProducao: new Date('2026-08-22') }, prisma)
  await confirmarSeparacao(companyId, ordemId, itens.map((i) => ({ itemId: i.itemId, qtdSeparada: i.qtd })), prisma)
  await iniciarProducao(companyId, ordemId)
  return concluir({ companyId, ordemId, consumo: itens.map((i) => ({ itemId: i.itemId, qtdConsumida: i.qtd })), qtdGerada }, prisma)
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CADEIA' } })
  companyId = c.id; ids = {}
  for (const k of CARNES) {
    const it = await prisma.stockItem.create({ data: { companyId, nome: k.nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    ids[k.nome] = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: k.custo, custoTotal: k.custo * 50, origem: 'SEFAZ' } })
  }
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

describe('cadeia de 2 elos: gessado → beef', () => {
  it('elo 1: gessado consome as carnes (com perda de peso), custo medido', async () => {
    const gessado = await criarFicha({ companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 3, unidadeLoteBase: 'KG', componentes: CARNES.map((k) => ({ itemId: ids[k.nome], qtdPlanejada: 1, unidade: 'KG' })) }, prisma)
    // moeu 3kg de carne (1 de cada), saíram 2,85kg de gessado (perdeu 0,15 na máquina)
    const r = await produzir(gessado.fichaId, CARNES.map((k) => ({ itemId: ids[k.nome], qtd: 1 })), 2.85)
    expect(r.custoLoteReal).toBe(90.5) // 33,95+46,95+9,60
    expect(r.custoUnitarioReal).toBe(31.75) // 90,50 / 2,85 = 31,754... → 31,75
    // carnes baixadas do estoque
    expect((await saldoItem(prisma, companyId, ids['Coxão Mole'])).saldo).toBe(49)
    // gessado entrou com 2,85
    const gessadoSaldo = await saldoItem(prisma, companyId, gessado.itemProduzidoId)
    expect(gessadoSaldo.saldo).toBe(2.85)
    expect(gessadoSaldo.custoMedio).toBe(31.75)
  })

  it('elo 2: beef consome GESSADO do estoque (intermediário → intermediário), custo herdado', async () => {
    const gessado = await criarFicha({ companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 3, unidadeLoteBase: 'KG', componentes: CARNES.map((k) => ({ itemId: ids[k.nome], qtdPlanejada: 1, unidade: 'KG' })) }, prisma)
    await produzir(gessado.fichaId, CARNES.map((k) => ({ itemId: ids[k.nome], qtd: 1 })), 3) // 3kg de gessado a 30,17/kg (90,50/3)

    // beef de xis: ficha INTERMEDIÁRIO que consome o GESSADO (outro intermediário)
    const beef = await criarFicha({ companyId, nomeProduzido: 'Beef de Xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: gessado.itemProduzidoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    // moldou 1kg de gessado → 9 beefs (100g cada, perdeu 0,1kg na moldagem)
    const r = await produzir(beef.fichaId, [{ itemId: gessado.itemProduzidoId, qtd: 1 }], 9)
    // gessado baixou de 3 → 2
    expect((await saldoItem(prisma, companyId, gessado.itemProduzidoId)).saldo).toBe(2)
    // beef entrou: 9 UN, custo = 1kg de gessado (30,17) / 9 = 3,35
    const beefSaldo = await saldoItem(prisma, companyId, beef.itemProduzidoId)
    expect(beefSaldo.saldo).toBe(9)
    expect(r.custoLoteReal).toBe(30.17) // custo do 1kg de gessado consumido
    expect(r.custoUnitarioReal).toBe(3.35) // 30,17 / 9
  })

  it('ciclo bloqueado continua: gessado não pode passar a usar o beef', async () => {
    const gessado = await criarFicha({ companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: ids['Acém'], qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    const beef = await criarFicha({ companyId, nomeProduzido: 'Beef', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: gessado.itemProduzidoId, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    await expect(atualizarFicha(companyId, gessado.fichaId, { componentes: [{ itemId: beef.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)).rejects.toThrow(FichaError)
  })

  it('elo 2 avisa a falta: separar beef sem gessado suficiente mostra saldo < planejado + a ficha do gessado', async () => {
    const gessado = await criarFicha({ companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: ids['Acém'], qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
    const beef = await criarFicha({ companyId, nomeProduzido: 'Beef', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 5, unidadeLoteBase: 'KG', componentes: [{ itemId: gessado.itemProduzidoId, qtdPlanejada: 5, unidade: 'KG' }] }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId: beef.fichaId, escalaReceitas: 1, dataProducao: new Date('2026-08-22') }, prisma)
    const { linhas } = await explodirSeparacao(companyId, ordemId)
    const lg = linhas.find((l) => l.itemId === gessado.itemProduzidoId)!
    expect(lg.qtdPlanejada).toBe(5)
    expect(lg.saldoDisponivel).toBe(0) // não produziu gessado ainda
    expect(lg.fichaIdComponente).toBe(gessado.fichaId) // dá pra produzir antes (link)
  })
})
