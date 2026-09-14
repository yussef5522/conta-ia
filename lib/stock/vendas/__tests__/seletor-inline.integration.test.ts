// ⭐⭐⭐ PARIDADE COM A TELA DE PRODUTOS — O SELETOR QUE NÃO EXPULSA (14/09/2026).
//
// **O dono:** *"o 'definir ficha' me EXPULSA da tela. (…) 1. o seletor vira o MESMO
// componente inline. 2. CRIAR FICHA SIMPLES (revenda 1 componente — caso FRUKI LATA comum)
// também inline."*
//
// Aqui ficam as DUAS metades de servidor desse pedido:
//   (a) `destinosPossiveis` — o que o seletor OFERECE, igual nos dois lugares
//   (b) o atalho `REVENDA` no mapa de COMPLEMENTOS — a ficha simples nascendo do gesto
//
// ⛔ A régua de 09/09 (*"venda → ficha → componente, um mecanismo só"*) **não afrouxou**:
// REVENDA continua sendo ATALHO, não um quarto destino — por baixo vira FICHA, pelo MESMO
// `garantirFichaDeRevenda` que o mapa de produtos usa.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { destinosPossiveis } from '../destinos-de-venda'
import { upsertComplementoMap, ComplementoMapError } from '../complemento-map'
import { upsertVendaMap } from '../venda-map'

const CNPJ = '50607080000922'
let companyId = ''
let itemFruki = ''
let itemCarne = ''
let fSabor = ''
let fFinal = ''

async function item(nome: string, categoria: string) {
  return (await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria, criadoVia: 'MANUAL' } })).id
}
async function ficha(nomeProduzido: string, tipo: string, comps: { itemId: string; qtd: number }[]) {
  const prod = await item(nomeProduzido, tipo === 'INTERMEDIARIO' ? 'INTERMEDIARIO' : 'PRODUTO_FINAL')
  const f = await prisma.stockFicha.create({ data: { companyId, itemProduzidoId: prod, tipoProduto: tipo, versaoAtual: 1, ativo: true } })
  const v = await prisma.stockFichaVersao.create({ data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' } })
  for (const c of comps) await prisma.stockFichaComponente.create({ data: { companyId, versaoId: v.id, itemId: c.itemId, qtdPlanejada: c.qtd, unidade: 'UN' } })
  return f.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA SELETOR' } })).id
  itemFruki = await item('FRUKI GUARANA LATA 350ML', 'REVENDA')
  itemCarne = await item('COXAO MOLE', 'MATERIA_PRIMA')
  fSabor = await ficha('porcao de calabresa', 'INTERMEDIARIO', [{ itemId: itemCarne, qtd: 1 }])
  fFinal = await ficha('XIS COMPLETO', 'PRODUTO_FINAL', [{ itemId: itemCarne, qtd: 1 }])
})

afterEach(async () => {
  for (const t of ['stockVendaComplementoMap', 'stockVendaProdutoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o que o seletor oferece — a MESMA fonte pros dois lugares', () => {
  /**
   * ⚠️ A DIFERENÇA ENTRE OS DOIS **NÃO É INCONSISTÊNCIA** — é a régua de 02/09: sabor é
   * `INTERMEDIARIO` (consumido pela pizza, nunca vendido solto) e recusá-lo em complementos
   * tornaria o módulo impossível; aceitá-lo em produtos faria cada xis baixar carne CRUA.
   */
  it('COMPLEMENTOS oferece sabor (intermediário) E produto final', async () => {
    const d = await destinosPossiveis(companyId, 'COMPLEMENTOS', prisma)
    const ids = d.fichas.map((f) => f.id)
    expect(ids).toContain(fSabor)
    expect(ids).toContain(fFinal)
  })

  it('⛔ PRODUTOS NÃO oferece intermediário — seria a venda baixando insumo cru', async () => {
    const d = await destinosPossiveis(companyId, 'PRODUTOS', prisma)
    expect(d.fichas.map((f) => f.id)).not.toContain(fSabor)
    expect(d.fichas.map((f) => f.id)).toContain(fFinal)
  })

  it('⛔ matéria-prima nunca entra na lista de itens — nem como atalho', async () => {
    const d = await destinosPossiveis(companyId, 'COMPLEMENTOS', prisma)
    expect(d.itens.map((i) => i.id)).toContain(itemFruki)
    expect(d.itens.map((i) => i.id)).not.toContain(itemCarne)
  })

  /**
   * ⭐ O DETALHE ("o que ela baixa") é o que deixa o dono escolher com os olhos. Sem ele,
   * duas fichas parecidas viram aposta — e aposta em destino de venda é estoque errado.
   */
  it('⭐ cada ficha diz o que desconta', async () => {
    const d = await destinosPossiveis(companyId, 'COMPLEMENTOS', prisma)
    expect(d.fichas.find((f) => f.id === fSabor)?.detalhe).toContain('COXAO MOLE')
  })
})

describe('⭐⭐ a ficha SIMPLES nasce do gesto — o caso FRUKI LATA comum', () => {
  it('⭐ mapear complemento em item de revenda cria a ficha ×1 e aponta NELA', async () => {
    const r = await upsertComplementoMap(companyId, 'FRUKI LATA', { tipo: 'REVENDA', itemId: itemFruki }, undefined, prisma)
    // ⛔ a tabela continua com DOIS estados (FICHA | IGNORAR): REVENDA é atalho, não destino
    expect(r.alvoTipo).toBe('FICHA')
    expect(r.fichaId).toBeTruthy()

    const v = await prisma.stockFichaVersao.findFirst({ where: { fichaId: r.fichaId! }, select: { id: true } })
    const comps = await prisma.stockFichaComponente.findMany({ where: { versaoId: v!.id } })
    expect(comps).toHaveLength(1)
    expect(comps[0].itemId).toBe(itemFruki)
    expect(comps[0].qtdPlanejada).toBe(1)
  })

  /**
   * ⭐⭐ O MESMO ITEM, NOS DOIS MAPAS, REUSA A MESMA FICHA. Se cada mapa criasse a sua,
   * o mesmo nome baixaria por duas receitas diferentes e a manutenção viraria duas.
   */
  it('⭐ produtos e complementos com o mesmo nome+item apontam pra MESMA ficha', async () => {
    const a = await upsertComplementoMap(companyId, 'FRUKI LATA', { tipo: 'REVENDA', itemId: itemFruki }, undefined, prisma)
    await upsertVendaMap(companyId, 'FRUKI LATA', { tipo: 'REVENDA', itemId: itemFruki }, undefined, prisma)
    const p = await prisma.stockVendaProdutoMap.findFirst({ where: { companyId, nomeSuitable: 'FRUKI LATA' } })
    expect(p?.fichaId).toBe(a.fichaId)
  })

  it('⛔ o atalho recusa matéria-prima — e ENSINA a saída', async () => {
    await expect(upsertComplementoMap(companyId, 'X', { tipo: 'REVENDA', itemId: itemCarne }, undefined, prisma))
      .rejects.toThrow(ComplementoMapError)
  })

  /**
   * ⛔⛔ REUSAR FICHA SÓ PELO NOME É PERIGOSO (a lição de 09/09): uma homônima que baixa
   * OUTRA COISA seria reusada e o sabor passaria a baixar o item errado **em silêncio**.
   */
  it('⛔ nome que já é ficha de outra coisa é RECUSADO, não reusado', async () => {
    await expect(upsertComplementoMap(companyId, 'XIS COMPLETO', { tipo: 'REVENDA', itemId: itemFruki }, undefined, prisma))
      .rejects.toThrow(/baixa outra coisa/)
  })

  it('IGNORAR segue funcionando — o atalho não mexeu nos estados de sempre', async () => {
    const r = await upsertComplementoMap(companyId, 'GRANDE', { tipo: 'IGNORAR' }, undefined, prisma)
    expect(r.alvoTipo).toBe('IGNORAR')
    expect(r.fichaId).toBeNull()
  })
})
