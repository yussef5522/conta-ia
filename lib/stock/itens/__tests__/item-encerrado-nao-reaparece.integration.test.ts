// ⛔⛔⛔ ITEM ENCERRADO NÃO REAPARECE EM LISTA VIVA NENHUMA (19/09/2026)
//
// **A ordem do dono, sobre a CUBA MAIONESE:** *"sai DE TUDO que é vivo — posição, contagem,
// seletores de todos os universos, fichas, produção. Pra operação, ela NÃO EXISTE mais.
// GUARD: item encerrado que reaparece em qualquer lista viva ou seletor = vermelho."*
//
// ⭐ O teste **EXECUTA** cada universo (REGRA 3), não faz grep: grep não distingue
// *"filtra"* de *"seleciona o campo e esquece de usar"* — que é exatamente como a Posição
// deixou 9 itens invisíveis em 11/09, pelo lado contrário.

import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../../movement'
import { encerrarItem, EncerrarItemError, fraseDoSelo, selosDeEncerrado } from '../encerrar-item'
import { listPosicao } from '../../posicao'
import { getQuadro } from '../../contagem'
import { categoriasDoUniverso, type UniversoDoSeletor } from '../../universo-do-seletor'
import { listCatalogo } from '../../catalogo'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*--.*$/gm, '')

function usosDe(src: string, simbolo: string): number {
  return src.split('\n')
    .filter((l) => !/^\s*import\b/.test(l) && !/^\s*\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .split(`${simbolo}(`).length - 1
}

const UNIVERSOS: UniversoDoSeletor[] = ['COMPRAVEL', 'PRATELEIRA', 'RECEITA', 'VENDAVEL', 'CATALOGO']

/**
 * ⭐ O SELETOR, executado com a MESMA régua da rota — `ativo: true` + as categorias do
 * universo. Se a rota mudar de régua, este helper fica desatualizado e é aí que o guard
 * do seletor (abaixo) cobra.
 */
async function itensDoSeletor(companyId: string, u: UniversoDoSeletor) {
  const cats = categoriasDoUniverso(u)
  return prisma.stockItem.findMany({
    where: { companyId, ativo: true, ...(cats ? { categoria: { in: [...cats] } } : {}) },
    select: { id: true, nome: true },
  })
}

describe('⛔⛔ o item ENCERRADO some de tudo que é vivo', () => {
  let companyId = ''
  let itemId = ''

  beforeEach(async () => {
    const c = await prisma.company.create({ data: { name: `enc-${Date.now()}-${Math.random()}`, cnpj: `${Date.now()}`.slice(-14) } })
    companyId = c.id
    const it = await prisma.stockItem.create({
      data: { companyId, nome: 'CUBA DE TESTE', unidadeControle: 'KG', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
    })
    itemId = it.id
  })

  it('⭐ com saldo ZERO: encerra e some de TODOS os universos', async () => {
    // antes: ela aparece onde deve aparecer
    const antes = await itensDoSeletor(companyId, 'PRATELEIRA')
    expect(antes.map((i) => i.id), 'o cenário precisa começar com o item VISÍVEL').toContain(itemId)

    await encerrarItem({ companyId, itemId, motivo: 'a família virou uma só' }, prisma)

    for (const u of UNIVERSOS) {
      const itens = await itensDoSeletor(companyId, u)
      expect(itens.map((i) => i.id), `o item encerrado reapareceu no universo ${u}`).not.toContain(itemId)
    }
    // ⛔ e nas listas que não são seletor
    expect((await listPosicao(companyId)).itens.map((l) => l.itemId), 'reapareceu na POSIÇÃO').not.toContain(itemId)
    expect((await getQuadro(companyId)).linhas.map((l) => l.itemId), 'reapareceu na CONTAGEM').not.toContain(itemId)
  })

  it('⛔⛔ com SALDO no estoque, RECUSA — encerrar esconderia o dinheiro', async () => {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'SEFAZ',
    })
    await expect(encerrarItem({ companyId, itemId, motivo: 'teste' }, prisma)).rejects.toThrow(EncerrarItemError)
    // ⭐ e a recusa DIZ o caminho
    try { await encerrarItem({ companyId, itemId, motivo: 'teste' }, prisma) } catch (e) {
      expect((e as Error).message).toContain('10')
      expect((e as Error).message).toContain('50,00'.replace(',', '.'))
      expect((e as Error).message, 'a recusa tem que ensinar a saída').toMatch(/conte o item|dê saída/)
    }
    // ⛔ e nada foi encerrado pela metade
    expect((await prisma.stockItem.findUniqueOrThrow({ where: { id: itemId } })).ativo).toBe(true)
    expect(await prisma.stockItemEncerrado.count({ where: { itemId } })).toBe(0)
  })

  it('⛔ encerrar sem MOTIVO é recusado', async () => {
    await expect(encerrarItem({ companyId, itemId, motivo: '  ' }, prisma)).rejects.toThrow(EncerrarItemError)
  })

  it('⭐ a FICHA dele vai junto — senão "produzir" continuaria sendo oferecido', async () => {
    const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: itemId, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 } })
    await encerrarItem({ companyId, itemId, motivo: 'aposentado' }, prisma)
    expect((await prisma.stockFicha.findUniqueOrThrow({ where: { id: f.id } })).ativo).toBe(false)
  })

  it('⭐⭐ mas o PASSADO fica legível — o histórico cita o nome, com o SELO', async () => {
    // um movimento e o estorno dele: a história existe e soma zero
    const m = await criarMovimento(prisma, {
      companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 4, custoUnitario: 2, custoTotal: 8, origem: 'SEFAZ',
    })
    await prisma.stockMovement.create({
      data: { companyId, itemId, tipo: 'ESTORNO', quantidade: -4, custoUnitario: 2, custoTotal: -8, estornoDeId: m.id, origem: 'SEFAZ' },
    })
    await encerrarItem({ companyId, itemId, motivo: 'a família virou uma MAIONESE só' }, prisma)

    // ⛔ o ledger NÃO foi apagado — apagar reescreveria custo de produto já vendido
    expect(await prisma.stockMovement.count({ where: { companyId, itemId } })).toBe(2)
    // ⭐ e o nome continua resolvível, com o selo
    const selos = await selosDeEncerrado(companyId, [itemId], prisma)
    const selo = selos.get(itemId)
    expect(selo, 'sem o selo o histórico não distingue "sumiu" de "foi encerrado"').toBeTruthy()
    expect(fraseDoSelo(selo!)).toMatch(/item encerrado em \d{2}\/\d{2}\/\d{4} — a família virou uma MAIONESE só/)
    // ⭐ e o CATÁLOGO (a lista administrativa, que mostra inativos) continua achando
    expect((await listCatalogo(companyId)).map((l) => l.id), 'o catálogo é onde o passado se consulta').toContain(itemId)
  })

  it('⭐ encerrar 2× é idempotente (unique no banco), não erro', async () => {
    await encerrarItem({ companyId, itemId, motivo: 'primeira' }, prisma)
    await expect(encerrarItem({ companyId, itemId, motivo: 'segunda' }, prisma)).resolves.toBeTruthy()
    expect(await prisma.stockItemEncerrado.count({ where: { itemId } })).toBe(1)
    // ⚠️ o motivo ORIGINAL fica — reescrever apagaria a razão de quem decidiu primeiro
    expect((await prisma.stockItemEncerrado.findFirstOrThrow({ where: { itemId } })).motivo).toBe('primeira')
  })
})

describe('⭐ o SELO chega às telas — registro que ninguém desenha é enfeite', () => {
  it('⭐ o extrato de movimentos carrega e desenha o selo', () => {
    const lib = fonte('lib/stock/movimentos.ts')
    expect(usosDe(lib, 'selosDeEncerrado'), 'o extrato parou de resolver o selo').toBeGreaterThan(0)
    expect(lib).toMatch(/itemEncerrado: selos\.has/)
    const tela = fonte('app/(dashboard)/empresas/[id]/estoque/movimentos/page.tsx')
    expect(tela, 'o selo sumiu da tela do extrato').toMatch(/m\.itemEncerrado &&/)
  })

  it('⭐ a ficha do item idem — e a faixa vem ANTES dos gestos', () => {
    expect(usosDe(fonte('lib/stock/ficha-item.ts'), 'selosDeEncerrado')).toBeGreaterThan(0)
    const tela = fonte('app/(dashboard)/empresas/[id]/estoque/itens/[itemId]/page.tsx')
    const iSelo = tela.indexOf('ficha.encerrado &&')
    const iGesto = tela.indexOf('<ReunitizarBloco')
    expect(iSelo, 'a faixa do encerrado sumiu da ficha').toBeGreaterThan(-1)
    expect(iSelo, 'quem abre a ficha precisa saber antes de tentar mexer').toBeLessThan(iGesto)
  })

  it('⭐ e o tipo da tela vem da LIB, não é copiado à mão', () => {
    expect(fonte('app/(dashboard)/empresas/[id]/estoque/itens/[itemId]/page.tsx')).toMatch(/type Ficha = FichaItem/)
  })

  it('⛔ a migration é CREATE-only, com motivo obrigatório e unique', () => {
    const m = fonte('prisma/migrations/20260919210000_stock_item_encerrado/migration.sql')
    expect(m).not.toMatch(/ALTER TABLE|DROP TABLE/)
    expect(m).toMatch(/CHECK \(length\(trim\("motivo"\)\) > 0\)/)
    expect(m).toMatch(/CREATE UNIQUE INDEX .*itemId/)
  })
})
