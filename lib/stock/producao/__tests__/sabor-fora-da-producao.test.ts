// ⛔⛔ SABOR NÃO É RECEITA DE PRODUÇÃO — a fronteira entre a venda e a cozinha (03/09/2026).
//
// CASO REAL: o dono criou a ficha do sabor CALABRESA pela aba Complementos e ela apareceu em
// **Produção › Receitas**, no meio das 20 receitas de verdade. A ficha nasceu `INTERMEDIARIO`
// porque era o tipo que a mecânica da baixa pedia — ou seja, `tipoProduto` estava
// respondendo DUAS perguntas: *"como baixa na venda?"* e *"aparece na cozinha?"*.
// Com ~50 sabores a caminho, seriam 50 intrusos na tela de quem cozinha.
//
// ⭐ A CURA foi vocabulário, não filtro: o `SABOR` virou tipo próprio, e as réguas — que já
// eram ALLOWLIST — passaram a excluí-lo **por construção**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { ehReceitaDeProducao } from '../tipo-receita'
import { montaNaVenda, rotuloTipoFicha, seContaFisicamente, TIPO_SABOR } from '@/lib/stock/tipos-ficha'
import { upsertComplementoMap } from '../../vendas/complemento-map'
import { montarCtx, explodir } from '../../vendas/baixa-venda'
import { getQuadro } from '../../contagem'

const CNPJ = '60606060000188'
let companyId = ''
let calabresaCrua = ''
let fichaPorcao = ''
let itemPorcao = ''
let fichaSabor = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SABOR' } })).id

  // a matéria-prima que a cozinha usa
  const crua = await prisma.stockItem.create({ data: { companyId, nome: 'CALABRESA CRUA', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  calabresaCrua = crua.id
  await prisma.stockMovement.create({ data: { companyId, itemId: crua.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 30, custoTotal: 300, origem: 'SEFAZ' } })

  // ⭐ RECEITA DE PRODUÇÃO de verdade: a cozinha faz em lote
  const r = await criarFicha({
    companyId, nomeProduzido: 'porcao de calabresa 120 grama', unidadeProduzido: 'UN',
    tipoProduto: 'INTERMEDIARIO', loteBase: 10, unidadeLoteBase: 'UN',
    componentes: [{ itemId: calabresaCrua, qtdPlanejada: 1.2, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaPorcao = r.fichaId; itemPorcao = r.itemProduzidoId
  // a porção existe fisicamente na câmara
  await prisma.stockMovement.create({ data: { companyId, itemId: itemPorcao, tipo: 'PRODUCAO_GERACAO', quantidade: 20, custoUnitario: 3.6, custoTotal: 72, origem: 'MANUAL' } })

  // ⭐ SABOR: o invólucro que a venda consome (1 UN da porção pronta)
  const sab = await criarFicha({
    companyId, nomeProduzido: 'CALABRESA', unidadeProduzido: 'UN',
    tipoProduto: TIPO_SABOR, loteBase: 1, unidadeLoteBase: 'UN',
    componentes: [{ itemId: itemPorcao, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    mapearComplemento: 'CALABRESA',
  }, prisma)
  fichaSabor = sab.fichaId
})

afterEach(async () => {
  for (const t of ['stockVendaComplementoMap', 'stockVendaComplementoLinha', 'stockVendaComplementoNome',
    'stockContagemItem', 'stockContagem', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha',
    'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o que as DUAS telas da cozinha oferecem — elas filtram a mesma lista com a mesma régua */
async function ofertaDaCozinha() {
  const fichas = await prisma.stockFicha.findMany({
    where: { companyId }, select: { id: true, tipoProduto: true, ativo: true, itemProduzidoId: true },
  })
  const itens = await prisma.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true } })
  const nome = new Map(itens.map((i) => [i.id, i.nome]))
  return fichas.filter(ehReceitaDeProducao).map((f) => nome.get(f.itemProduzidoId)!)
}

describe('⛔⛔ o sabor sai da cozinha', () => {
  it('⛔⛔ ficha de SABOR não aparece em Receitas nem na busca de nova ordem', async () => {
    const oferta = await ofertaDaCozinha()
    expect(oferta, 'o sabor voltou pra tela da cozinha').not.toContain('CALABRESA')
  })

  it('⭐ e a receita de produção de verdade CONTINUA aparecendo', async () => {
    expect(await ofertaDaCozinha()).toEqual(['porcao de calabresa 120 grama'])
  })

  it('⛔ com o tipo revertido pra INTERMEDIARIO, o intruso volta — o defeito reposto', async () => {
    // ⚠️ REGRA 11: guard só conta depois de rodar contra o defeito que o motivou.
    await prisma.stockFicha.update({ where: { id: fichaSabor }, data: { tipoProduto: 'INTERMEDIARIO' } })
    expect(await ofertaDaCozinha()).toContain('CALABRESA')
  })

  it('⭐ a régua é a MESMA função nas duas telas (nada de filtro por tela)', () => {
    expect(ehReceitaDeProducao({ tipoProduto: TIPO_SABOR })).toBe(false)
    expect(ehReceitaDeProducao({ tipoProduto: 'INTERMEDIARIO' })).toBe(true)
    expect(ehReceitaDeProducao({ tipoProduto: 'PRODUTO_FINAL' })).toBe(false)
    expect(ehReceitaDeProducao({ tipoProduto: 'INTERMEDIARIO', ativo: false })).toBe(false)
  })
})

describe('⭐⭐ a mecânica da baixa NÃO muda', () => {
  // ⚠️ a baixa de COMPLEMENTO ainda não está ligada, então o teste roda o MOTOR que ela vai
  // chamar (`explodir`) — o mesmo que a baixa de produtos já usa. Testar o motor é o que dá
  // pra provar hoje sem fingir um caminho que não existe.
  const explosao = async (fichaId: string, qtd = 1) => {
    const ctx = await montarCtx(companyId, prisma)
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId }, qtd, ctx, acc)
    return acc
  }

  it('⭐⭐ 1 CALABRESA → 1 UN da porção pronta, ZERO na calabresa crua', async () => {
    await upsertComplementoMap(companyId, 'CALABRESA', { tipo: 'FICHA', fichaId: fichaSabor }, undefined, prisma)
    const acc = await explosao(fichaSabor, 1)
    expect(acc.get(itemPorcao), 'a porção pronta tem que baixar 1 UN').toBe(1)
    expect(acc.has(calabresaCrua), 'a calabresa CRUA não pode se mexer — quem a consumiu foi a produção').toBe(false)
  })

  it('⭐⭐ e dá o MESMO resultado com o sabor como INTERMEDIARIO — o tipo não mexe na baixa', async () => {
    const comSabor = await explosao(fichaSabor, 3)
    await prisma.stockFicha.update({ where: { id: fichaSabor }, data: { tipoProduto: 'INTERMEDIARIO' } })
    const comInter = await explosao(fichaSabor, 3)
    expect([...comSabor.entries()].sort()).toEqual([...comInter.entries()].sort())
    expect(comSabor.get(itemPorcao)).toBe(3)
  })

  it('⭐ SABOR usado como COMPONENTE explode (não baixa o invólucro fantasma)', async () => {
    // a mudança deliberada: "montam na venda" vale pros dois
    expect(montaNaVenda('SABOR')).toBe(true)
    expect(montaNaVenda('PRODUTO_FINAL')).toBe(true)
    expect(montaNaVenda('INTERMEDIARIO')).toBe(false)

    const combo = await criarFicha({
      companyId, nomeProduzido: 'PIZZA 1 SABOR', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 40,
      componentes: [{ itemId: (await prisma.stockFicha.findUniqueOrThrow({ where: { id: fichaSabor }, select: { itemProduzidoId: true } })).itemProduzidoId, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
    }, prisma)
    const itemSabor = (await prisma.stockFicha.findUniqueOrThrow({ where: { id: fichaSabor }, select: { itemProduzidoId: true } })).itemProduzidoId
    const acc = await explosao(combo.fichaId, 1)
    // ⛔ sem a mudança, baixaria o item-invólucro "CALABRESA" — que ninguém produz → negativo eterno
    expect(acc.get(itemPorcao)).toBe(1)
    expect(acc.has(itemSabor), 'baixou o invólucro fantasma em vez de explodir o sabor').toBe(false)
  })
})

describe('⭐ o resto das telas', () => {
  it('⛔ o invólucro não entra na CONTAGEM — ninguém pesa "CALABRESA" na câmara', async () => {
    const q = await getQuadro(companyId, new Date(), prisma)
    const nomes = q.linhas.map((l) => l.nome)
    expect(nomes).toContain('porcao de calabresa 120 grama')
    expect(nomes).toContain('CALABRESA CRUA')
    expect(nomes, 'o invólucro virou linha impossível de contar').not.toContain('CALABRESA')
    expect(seContaFisicamente('SABOR')).toBe(false)
  })

  it('⭐ o rótulo deixou de ser binário (dizia "Intermediário" pro sabor)', () => {
    expect(rotuloTipoFicha('SABOR')).toBe('Sabor')
    expect(rotuloTipoFicha('INTERMEDIARIO')).toBe('Intermediário')
    expect(rotuloTipoFicha('PRODUTO_FINAL')).toBe('Produto final')
  })

  it('⭐ o item do sabor nasce etiquetado SABOR (visível no catálogo, decisão do dono)', async () => {
    const f = await prisma.stockFicha.findUniqueOrThrow({ where: { id: fichaSabor }, select: { itemProduzidoId: true } })
    const item = await prisma.stockItem.findUniqueOrThrow({ where: { id: f.itemProduzidoId }, select: { categoria: true } })
    expect(item.categoria).toBe('SABOR')
  })
})
