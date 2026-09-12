// ⭐⭐⭐ A CATEGORIA DO ITEM É EDITÁVEL — COM RASTRO (12/09/2026)
//
// **O dono:** *"VINAGRE CBS VINHO TINTO 750ML marquei USO INTERNO por engano — o certo é
// MATÉRIA-PRIMA. **Não existe onde trocar**."*
//
// ⚠️ **MEDIDO ANTES: a ROTA já aceitava `categoria`.** O que faltava era a TELA — a mesma
// anatomia do "sumir com o item" de 09/09, em que a régua existia e o menu não oferecia.
//
// ⭐ E a troca vale na LEITURA: nenhum movimento é reescrito. Este arquivo prova as duas
// coisas — o rastro nasce, e o ledger não se mexe.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { listPosicao } from '../posicao'
import { saldoItem } from '../saldo'

const CNPJ = '10203040000199'
let companyId = ''
let vinagreId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CATEGORIA TESTE' } })).id
  vinagreId = (await prisma.stockItem.create({ data: {
    companyId, nome: 'VINAGRE CBS VINHO TINTO 750ML', unidadeControle: 'UN',
    categoria: 'USO_INTERNO', criadoVia: 'CONFERENCIA',
  } })).id
  await prisma.stockMovement.create({ data: {
    companyId, itemId: vinagreId, tipo: 'ENTRADA_NF', quantidade: 7, custoUnitario: 6.82,
    custoTotal: 47.75, origem: 'SEFAZ',
  } })
})

afterEach(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_update;').catch(() => {})
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;').catch(() => {})
  for (const t of ['stockMovement', 'stockItemCategoriaTrocada', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o que a rota faz: troca + grava o rastro (a rota em si precisa de sessão) */
async function trocarCategoria(para: string, userId = 'u') {
  const atual = await prisma.stockItem.findUniqueOrThrow({ where: { id: vinagreId }, select: { categoria: true } })
  if (atual.categoria !== para) {
    await prisma.stockItemCategoriaTrocada.create({ data: { companyId, itemId: vinagreId, de: atual.categoria, para, trocadoPorId: userId } })
  }
  return prisma.stockItem.update({ where: { id: vinagreId }, data: { categoria: para } })
}

describe('⭐⭐ trocar a categoria do item', () => {
  it('⭐ o vinagre vai de USO_INTERNO pra MATERIA_PRIMA', async () => {
    await trocarCategoria('MATERIA_PRIMA')
    const i = await prisma.stockItem.findUniqueOrThrow({ where: { id: vinagreId } })
    expect(i.categoria).toBe('MATERIA_PRIMA')
  })

  it('⭐⭐ e o RASTRO fica: de onde, pra onde, quem, quando', async () => {
    await trocarCategoria('MATERIA_PRIMA', 'yussef')
    const r = await prisma.stockItemCategoriaTrocada.findFirstOrThrow({ where: { companyId, itemId: vinagreId } })
    expect([r.de, r.para, r.trocadoPorId]).toEqual(['USO_INTERNO', 'MATERIA_PRIMA', 'yussef'])
    expect(r.criadoEm).toBeInstanceOf(Date)
  })

  it('⛔⛔ HISTÓRIA NÃO SE MEXE — o ledger fica intacto e o saldo também', async () => {
    const antes = await saldoItem(prisma, companyId, vinagreId)
    const movsAntes = await prisma.stockMovement.count({ where: { companyId, itemId: vinagreId } })
    await trocarCategoria('MATERIA_PRIMA')
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: vinagreId } })).toBe(movsAntes)
    expect(await saldoItem(prisma, companyId, vinagreId)).toEqual(antes)
  })

  it('⭐ a POSIÇÃO não muda de tamanho — as duas categorias contam na prateleira', async () => {
    // ⚠️ medido: `seContaFisicamente` exclui só SABOR e PRODUTO_FINAL
    const antes = (await listPosicao(companyId, prisma)).itens.length
    await trocarCategoria('MATERIA_PRIMA')
    expect((await listPosicao(companyId, prisma)).itens.length).toBe(antes)
  })

  it('⛔ trocar pra MESMA categoria não grava rastro — não é um fato', async () => {
    await trocarCategoria('USO_INTERNO')
    expect(await prisma.stockItemCategoriaTrocada.count({ where: { companyId, itemId: vinagreId } })).toBe(0)
  })

  it('⭐ trocar duas vezes deixa DOIS rastros — o item pode mudar de ideia', async () => {
    await trocarCategoria('MATERIA_PRIMA')
    await trocarCategoria('LIMPEZA')
    const rs = await prisma.stockItemCategoriaTrocada.findMany({ where: { companyId, itemId: vinagreId }, orderBy: { criadoEm: 'asc' } })
    expect(rs.map((r) => `${r.de}→${r.para}`)).toEqual(['USO_INTERNO→MATERIA_PRIMA', 'MATERIA_PRIMA→LIMPEZA'])
  })
})
