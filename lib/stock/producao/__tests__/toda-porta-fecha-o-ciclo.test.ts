// ⛔⛔⛔ TODA PORTA DE CRIAR FICHA FECHA O CICLO — a terceira vez desta classe (03/09/2026).
//
// HISTÓRICO, e é o que dá o peso: 01/09 três fichas ÓRFÃS criadas pelo cardápio (a PIZZA
// saiu duplicada) · 02/09 a prateleira de complementos nasceu com ficha+vínculo na mesma
// transação · 03/09 o dono montou a receita do **GRANDE PRECINHO** pela tela do produto e
// levou a faixa *"a ficha foi salva, mas este produto continua sem vínculo"* de novo.
//
// ⛔ A CAUSA DESTA: a tela mandava a **CHAVE DO HUB** (`nome:GRANDE PRECINHO`) no lugar do
// nome do PDV. O sistema gravou um mapeamento com um nome que **não existe em relatório
// nenhum** — pior que não vincular: lixo no banco com cara de vínculo.
//
// ⭐ A TRAVA FICOU NA FONTE (`criarFicha`), não na tela: nenhuma tela futura consegue
// repetir isso, porque quem GRAVA recusa chave interna.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, FichaError } from '../fichas'
import { hubCardapio } from '../../cardapio/hub'

const CNPJ = '80808080000111'
let companyId = ''
let insumo = ''

/** relatório do Suitable com o produto que o dono vende */
const html = (nome: string, qtd = 10, valor = 100) =>
  `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>` +
  `<tr><td>${nome}</td><td>${qtd}</td><td>R$ 0,00</td><td>R$ ${valor.toFixed(2).replace('.', ',')}</td></tr></table></body></html>`

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'PORTAS' } })).id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'PAO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  insumo = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId: insumo, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 2, custoTotal: 200, origem: 'SEFAZ' } })
  // o produto existe no PDV (é o que a tela do cardápio mostra)
  await prisma.stockVendaLinha.create({
    data: { companyId, importId: `v-${companyId}`, data: new Date('2026-08-21T00:00:00.000Z'),
      nomeSuitable: 'GRANDE PRECINHO', quantidade: 10, valorTotal: 100 },
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

const comps = () => [{ itemId: insumo, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }]

describe('⛔⛔ a porta do PRODUTO (montar a receita)', () => {
  it('⛔⛔ CHAVE DO HUB é RECUSADA — era o que gravava lixo com cara de vínculo', async () => {
    await expect(criarFicha({
      companyId, nomeProduzido: 'GRANDE PRECINHO', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 10,
      componentes: comps(), mapearNomeSuitable: 'nome:GRANDE PRECINHO', // ⛔ o bug real
    }, prisma)).rejects.toThrow(FichaError)
    // e não sobrou nada gravado
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId } })).toBe(0)
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(0)
  })

  it('⭐⭐ com o nome REAL do PDV, o produto volta VINCULADO na tela', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'GRANDE PRECINHO', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 10,
      componentes: comps(), mapearNomeSuitable: ['GRANDE PRECINHO'],
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)

    // ⭐ o que o dono vê ao voltar: a receita aparecendo no produto
    const hub = await hubCardapio(companyId, {}, prisma)
    const linha = hub.linhas.find((l) => l.nomesSuitable.includes('GRANDE PRECINHO'))!
    expect(linha.fichaId, 'o produto voltou órfão — a faixa amarela apareceria de novo').toBe(r.fichaId)
    expect(linha.status).toBe('FICHA_OK')
    expect(linha.custoUnitario).toBe(2) // e o custo já sai (1 pão × R$ 2)
  })

  it('⭐ APELIDOS do PDV entram todos — mapear só um deixa metade da venda sem baixar', async () => {
    await prisma.stockVendaLinha.create({
      data: { companyId, importId: `v2-${companyId}`, data: new Date('2026-08-21T00:00:00.000Z'),
        nomeSuitable: 'GRANDE - PRECINHO', quantidade: 3, valorTotal: 30 },
    })
    const r = await criarFicha({
      companyId, nomeProduzido: 'GRANDE PRECINHO', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 10,
      componentes: comps(), mapearNomeSuitable: ['GRANDE PRECINHO', 'GRANDE - PRECINHO'],
    }, prisma)
    const maps = await prisma.stockVendaProdutoMap.findMany({ where: { companyId } })
    expect(maps).toHaveLength(2)
    expect(maps.every((m) => m.fichaId === r.fichaId)).toBe(true)
    // ⭐ e o hub junta os dois numa linha só (as vendas somam)
    const hub = await hubCardapio(companyId, {}, prisma)
    const linha = hub.linhas.find((l) => l.fichaId === r.fichaId)!
    expect(linha.vendasQtd).toBe(13)
  })
})

describe('⛔ a flag não promete o que não gravou', () => {
  it('⛔ tipo errado é RECUSADO em vez de pular calado dizendo "vinculei"', async () => {
    // ⚠️ antes: o guard interno pulava o upsert e `vinculadoAoPdv` vinha do INPUT → true.
    // A tela dizia "pronto" com o produto órfão. "A flag diz PARECE, o vínculo diz É."
    await expect(criarFicha({
      companyId, nomeProduzido: 'porcao qualquer', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: comps(), mapearNomeSuitable: 'GRANDE PRECINHO',
    }, prisma)).rejects.toThrow(/PRODUTO FINAL/)
    expect(await prisma.stockFicha.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ sem pedido de vínculo, a flag é falsa e ninguém promete nada', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'porcao solta', unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'UN', componentes: comps(),
    }, prisma)
    expect(r.vinculadoAoPdv).toBe(false)
  })
})

describe('⭐⭐ ficha + vínculo entram JUNTOS ou não entram', () => {
  it('⛔⛔ vínculo recusado NO MEIO da transação não deixa a ficha pra trás', async () => {
    // ⚠️ o gatilho é a recusa "produto E complemento no mesmo gesto", que dispara DEPOIS de
    // o item e a ficha já terem sido criados dentro da transação. Se ela não fosse atômica,
    // sobraria exatamente a órfã que este arquivo inteiro existe pra impedir.
    await expect(criarFicha({
      companyId, nomeProduzido: 'X', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 5,
      componentes: comps(), mapearNomeSuitable: 'GRANDE PRECINHO', mapearComplemento: 'CALABRESA',
    }, prisma)).rejects.toThrow(FichaError)
    expect(await prisma.stockFicha.count({ where: { companyId } }), 'ficha órfã sobrou').toBe(0)
    expect(await prisma.stockItem.count({ where: { companyId, nome: 'X' } }), 'item órfão sobrou').toBe(0)
    expect(await prisma.stockVendaProdutoMap.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ e o caminho feliz grava os DOIS numa transação só', async () => {
    const r = await criarFicha({
      companyId, nomeProduzido: 'GRANDE PRECINHO', unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 10,
      componentes: comps(), mapearNomeSuitable: ['GRANDE PRECINHO'],
    }, prisma)
    const map = await prisma.stockVendaProdutoMap.findFirst({ where: { companyId, nomeSuitable: 'GRANDE PRECINHO' } })
    expect(map?.fichaId).toBe(r.fichaId)
  })
})
