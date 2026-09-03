// ⛔⛔ SUCESSO DISFARÇADO DE ERRO — "Produto não encontrado no cardápio" (03/09/2026).
//
// CASO REAL: o dono montou a receita da **PIZZA FAMILIA 45CM** pela tela do produto. Gravou
// certo — voltando ao cardápio a ficha estava lá — mas **no meio do caminho a tela abriu uma
// tela de erro**. Palavras dele: *"se toda gravação me mostrar um erro falso, eu paro de
// acreditar nos erros de verdade. Alarme falso repetido mata o alarme."*
//
// ⛔ A CAUSA é da mesma família da chave interna × nome do PDV: a chave do hub **MUDA quando
// o produto ganha destino** (`nome:PIZZA…` → `ficha:<id>`), e a página recarregava com a
// chave VELHA, que não casava mais em `l.chave === chave`.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { hubCardapio } from '../hub'
import { detalheProduto, acharLinhaPorChave } from '../detalhe'
import { upsertVendaMap } from '../../vendas/venda-map'

const CNPJ = '90909090000122'
const PRODUTO = 'PIZZA FAMILIA 45CM'
let companyId = ''
let queijo = ''
let caixa = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CHAVE' } })).id
  const novo = async (nome: string, cat: string, custo: number) => {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'MANUAL' } })
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: custo, custoTotal: 100 * custo, origem: 'SEFAZ' } })
    return it.id
  }
  queijo = await novo('MUSSARELA', 'MATERIA_PRIMA', 31.9)
  caixa = await novo('CAIXA DE PIZZA', 'EMBALAGEM', 1.4)
  await prisma.stockVendaLinha.create({
    data: { companyId, importId: `v-${companyId}`, data: new Date('2026-08-21T00:00:00.000Z'),
      nomeSuitable: PRODUTO, quantidade: 12, valorTotal: 600 },
  })
})

afterEach(async () => {
  for (const t of ['stockVendaProdutoMap', 'stockVendaLinha', 'stockFichaComponente', 'stockFichaVersao',
    'stockFicha', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ a chave é um LINK, e link não apodrece', () => {
  it('⛔⛔ salvar a receita pelo produto → a PÁGINA DO PRODUTO abre, com a receita', async () => {
    // 1. o produto sem ficha: é esta a chave que está na URL da tela
    const antes = await hubCardapio(companyId, {}, prisma)
    const chaveNaUrl = antes.linhas.find((l) => l.nomesSuitable.includes(PRODUTO))!.chave
    expect(chaveNaUrl).toBe(`nome:${PRODUTO}`)

    // 2. o gesto: montar a receita (queijo + caixa), como o dono fez
    const r = await criarFicha({
      companyId, nomeProduzido: PRODUTO, unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 50,
      componentes: [
        { itemId: queijo, qtdPlanejada: 0.4, unidade: 'KG', posicao: 0 },
        { itemId: caixa, qtdPlanejada: 1, unidade: 'UN', posicao: 1 },
      ],
      mapearNomeSuitable: [PRODUTO],
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)

    // 3. a chave MUDOU no hub — é isto que quebrava a tela
    const depois = await hubCardapio(companyId, {}, prisma)
    expect(depois.linhas.find((l) => l.fichaId === r.fichaId)!.chave).toBe(`ficha:${r.fichaId}`)

    // 4. ⭐ e a página recarrega com a chave VELHA: tem que abrir, com a receita
    const d = await detalheProduto(companyId, chaveNaUrl, prisma)
    expect(d, '"Produto não encontrado no cardápio" — o erro falso de 03/09').not.toBeNull()
    expect(d!.linha.fichaId).toBe(r.fichaId)
    expect(d!.componentes.map((c) => c.nome).sort()).toEqual(['CAIXA DE PIZZA', 'MUSSARELA'])
    expect(d!.linha.custoUnitario).toBe(14.16) // 0,4 × 31,90 + 1,40
  })

  it('⭐ e a chave NOVA também abre (o link que a tela passa a usar)', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: PRODUTO, unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 50,
      componentes: [{ itemId: queijo, qtdPlanejada: 0.4, unidade: 'KG', posicao: 0 }],
      mapearNomeSuitable: [PRODUTO],
    }, prisma)
    const d = await detalheProduto(companyId, `ficha:${r.fichaId}`, prisma)
    expect(d?.linha.fichaId).toBe(r.fichaId)
  })

  it('⭐ o mesmo vale pra REVENDA: `nome:` continua abrindo depois de virar `item:`', async () => {
    const bebida = await prisma.stockItem.create({ data: { companyId, nome: 'COCA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
    await prisma.stockVendaLinha.create({
      data: { companyId, importId: `v2-${companyId}`, data: new Date('2026-08-21T00:00:00.000Z'),
        nomeSuitable: 'COCA COLA 2L', quantidade: 5, valorTotal: 85 },
    })
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: bebida.id }, undefined, prisma)
    const d = await detalheProduto(companyId, 'nome:COCA COLA 2L', prisma)
    expect(d, 'o F5 depois de mapear a bebida daria erro').not.toBeNull()
    expect(d!.linha.itemId).toBe(bebida.id)
  })

  it('⛔ e o que NÃO existe continua devolvendo null (o erro de verdade sobrevive)', async () => {
    expect(await detalheProduto(companyId, 'nome:PRODUTO QUE NUNCA EXISTIU', prisma)).toBeNull()
    expect(await detalheProduto(companyId, 'chave-sem-tipo', prisma)).toBeNull()
  })
})

describe('⭐ o resolvedor, sem banco', () => {
  const linha = (p: Partial<Parameters<typeof acharLinhaPorChave>[0][number]>) =>
    ({ chave: 'x', nome: 'N', nomesSuitable: [], fichaId: null, itemId: null, ...p })

  it('⭐ acha por igualdade, por nome do PDV, por ficha e por item', () => {
    const ls = [
      linha({ chave: 'ficha:f1', nome: 'PIZZA', nomesSuitable: ['PIZZA FAMILIA 45CM'], fichaId: 'f1' }),
      linha({ chave: 'item:i1', nome: 'COCA', nomesSuitable: ['COCA COLA 2L'], itemId: 'i1' }),
    ]
    expect(acharLinhaPorChave(ls, 'ficha:f1')?.fichaId).toBe('f1')                    // exata
    expect(acharLinhaPorChave(ls, 'nome:PIZZA FAMILIA 45CM')?.fichaId).toBe('f1')     // ⭐ a chave velha
    expect(acharLinhaPorChave(ls, 'nome:COCA COLA 2L')?.itemId).toBe('i1')
    expect(acharLinhaPorChave(ls, 'item:i1')?.itemId).toBe('i1')
    expect(acharLinhaPorChave(ls, 'nome:NAO EXISTE')).toBeUndefined()
    expect(acharLinhaPorChave(ls, 'lixo')).toBeUndefined()
  })
})
