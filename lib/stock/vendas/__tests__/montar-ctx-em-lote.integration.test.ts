/**
 * ⭐⭐⭐ O GRAFO DE FICHAS SE MONTA EM LOTE — contagem FIXA, qualquer que seja o cardápio.
 *
 * ⛔ O `montarCtx` fazia **2 consultas POR FICHA** (`findFirst` da versão atual + `findMany` dos
 * componentes). Medido em prod (21/10/2026): **196 fichas ativas → 394 consultas em 258 ms**, e
 * ele roda em TODA baixa de venda, em todo plano de complementos, no hub do Cardápio, na tela da
 * margem e no montador de pizza. ⚠️ Ele não cresce com os DIAS (aquele N+1 morreu em 20/10) —
 * cresce com o **CARDÁPIO**.
 *
 * ⭐ A régua é a de 28/09: **o que o N+1 custa é round-trip, e round-trip se CONTA.** Teste em
 * milissegundo passa ou falha pela máquina de quem roda; a contagem não.
 *
 * ⛔ E o espião vem do **dono único** (`lib/testing/espiao-de-consultas.ts`) — copiá-lo seria a 2ª
 * régua de *"o que conta como ida ao banco"*. O auto-teste completo dele mora em
 * `lista-de-dias-em-lote.integration.test.ts`; aqui vai um mínimo, porque **instrumento cego
 * aprova qualquer coisa** (`0 === 0` satisfaz toda asserção de contagem).
 *
 * ⭐⭐ **A LEI DA EQUIVALÊNCIA é o teste que manda neste arquivo** (`montarCtxPeloLaco` abaixo é a
 * referência histórica, byte a byte): velocidade que muda resultado não é velocidade, é bug.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { espiaoDeConsultas } from '@/lib/testing/espiao-de-consultas'
import { montarCtx, explodir, type Ctx } from '../baixa-venda'
import { criarFicha, atualizarFicha } from '../../producao/fichas'

/** ⚠️ CNPJ conferido LIVRE no repo antes de escolher — o guard `cnpj-de-teste-nao-colide` reprova colisão */
const CNPJ = '94949494000194'
let companyId = ''
let insumoId = ''

/**
 * ⛔⛔ A REFERÊNCIA HISTÓRICA — **é o laço que o lote substituiu**, cópia literal.
 *
 * ⚠️ Ela existe aqui, e só aqui, pra o teste poder comparar o resultado **byte a byte**. Fora
 * do teste ela seria a 2ª montagem do mesmo grafo — exatamente o que o `Ctx` compartilhado com
 * `explodirReceita` existe pra impedir.
 */
async function montarCtxPeloLaco(cId: string, db: PrismaClient): Promise<Ctx> {
  const fichas = await db.stockFicha.findMany({ where: { companyId: cId, ativo: true }, select: { id: true, tipoProduto: true, itemProduzidoId: true, versaoAtual: true } })
  const componentesByFicha = new Map<string, { itemId: string; qtdPlanejada: number }[]>()
  for (const f of fichas) {
    const v = await db.stockFichaVersao.findFirst({ where: { companyId: cId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    const comps = v ? await db.stockFichaComponente.findMany({ where: { companyId: cId, versaoId: v.id }, select: { itemId: true, qtdPlanejada: true } }) : []
    componentesByFicha.set(f.id, comps)
  }
  const itens = await db.stockItem.findMany({ where: { companyId: cId }, select: { id: true, nome: true } })
  return {
    componentesByFicha,
    fichaByItemProduzido: new Map(fichas.map((f) => [f.itemProduzidoId, { id: f.id, tipoProduto: f.tipoProduto, itemProduzidoId: f.itemProduzidoId }])),
    fichaById: new Map(fichas.map((f) => [f.id, { id: f.id, tipoProduto: f.tipoProduto, itemProduzidoId: f.itemProduzidoId }])),
    nomeItem: new Map(itens.map((i) => [i.id, i.nome])),
  }
}

/** serializa o Ctx INTEIRO preservando a ORDEM das chaves — é ela que decide a ordem do `acc` */
function serializar(c: Ctx) {
  return JSON.stringify({
    componentesByFicha: [...c.componentesByFicha],
    fichaByItemProduzido: [...c.fichaByItemProduzido],
    fichaById: [...c.fichaById],
    nomeItem: [...c.nomeItem],
  })
}

/** ⚠️ `inicio` existe porque a porta RECUSA ficha de nome repetido — e está certa: duas
 *  fichas do mesmo produto brigariam pelo vínculo com o PDV e pelo custo. */
async function criarFichas(quantas: number, inicio = 0) {
  const ids: string[] = []
  for (let i = inicio; i < inicio + quantas; i++) {
    const f = await criarFicha(
      {
        companyId,
        nomeProduzido: `porcao ${i}`,
        unidadeProduzido: 'UN',
        tipoProduto: 'INTERMEDIARIO',
        loteBase: 1,
        unidadeLoteBase: 'UN',
        componentes: [{ itemId: insumoId, qtdPlanejada: 0.1 + i / 100, unidade: 'KG' }],
      },
      prisma,
    )
    ids.push(f.fichaId)
  }
  return ids
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CTX EM LOTE' } })
  companyId = c.id
  const it0 = await prisma.stockItem.create({
    data: { companyId, nome: 'Acém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  insumoId = it0.id
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumoId, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 34, custoTotal: 3400, origem: 'SEFAZ' },
  })
})

afterEach(async () => {
  /**
   * ⚠️ Apaga as `stock_*` EXPLICITAMENTE — o isolamento proíbe `@relation` às tabelas fechadas,
   * então não existe cascade. A cicatriz de 02/10: o teste DISCIPLINADO que apaga a própria
   * `Company` tira a empresa da rede de limpeza e deixa linhas órfãs pra sempre.
   */
  for (const t of ['stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ a contagem de consultas NÃO cresce com o número de FICHAS', () => {
  it('3 fichas e 9 fichas custam as MESMAS idas ao banco', async () => {
    await criarFichas(3)
    const a = espiaoDeConsultas(prisma)
    const ctxA = await montarCtx(companyId, a.db)
    expect(ctxA.componentesByFicha.size).toBe(3)

    await criarFichas(6, 3)
    const b = espiaoDeConsultas(prisma)
    const ctxB = await montarCtx(companyId, b.db)
    expect(ctxB.componentesByFicha.size).toBe(9)

    expect(
      b.chamadas.length,
      `9 fichas custaram ${b.chamadas.length} e 3 custaram ${a.chamadas.length} — o laço por ficha voltou: ${JSON.stringify(b.porModelo())}`,
    ).toBe(a.chamadas.length)
  })

  it('⛔ NENHUM modelo é consultado uma vez por ficha', async () => {
    await criarFichas(9)
    const e = espiaoDeConsultas(prisma)
    await montarCtx(companyId, e.db)
    for (const [chave, n] of Object.entries(e.porModelo())) {
      expect(n, `${chave} foi chamado ${n}× pra 9 fichas — é N+1`).toBeLessThan(9)
    }
  })

  it('⭐ são 4 consultas: fichas · versões · componentes · itens', async () => {
    await criarFichas(9)
    const e = espiaoDeConsultas(prisma)
    await montarCtx(companyId, e.db)
    expect(e.porModelo()).toEqual({
      'stockFicha.findMany': 1,
      'stockFichaVersao.findMany': 1,
      'stockFichaComponente.findMany': 1,
      'stockItem.findMany': 1,
    })
  })
})

describe('⭐⭐⭐ A LEI DA EQUIVALÊNCIA — o lote devolve o MESMO grafo que o laço, byte a byte', () => {
  it('cardápio com 9 fichas: Ctx idêntico', async () => {
    await criarFichas(9)
    const lote = await montarCtx(companyId, prisma)
    const laco = await montarCtxPeloLaco(companyId, prisma)
    expect(serializar(lote)).toBe(serializar(laco))
  })

  it('⭐⭐ ficha EDITADA (2 versões): só a ATUAL entra — a antiga NÃO vaza', async () => {
    const [fichaId] = await criarFichas(1)
    const outro = await prisma.stockItem.create({
      data: { companyId, nome: 'Peito', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    })
    // editar componente cria VERSÃO NOVA (a porta versiona) — a v1 fica no histórico
    await atualizarFicha(
      companyId,
      fichaId,
      { componentes: [{ itemId: outro.id, qtdPlanejada: 0.5, unidade: 'KG' }] },
      prisma,
    )
    const versoes = await prisma.stockFichaVersao.count({ where: { companyId, fichaId } })
    expect(versoes, 'a edição tinha que versionar').toBeGreaterThan(1)

    const lote = await montarCtx(companyId, prisma)
    const laco = await montarCtxPeloLaco(companyId, prisma)
    expect(serializar(lote)).toBe(serializar(laco))
    expect(lote.componentesByFicha.get(fichaId)).toEqual([{ itemId: outro.id, qtdPlanejada: 0.5 }])
  })

  it('⭐ ficha SEM versão atual fica com [] (o `v ? … : []` que isto substituiu)', async () => {
    const [fichaId] = await criarFichas(1)
    // ⚠️ aponta o HEAD pra uma versão que não existe — é o estado que o `findFirst` devolvia null
    await prisma.stockFicha.update({ where: { id: fichaId }, data: { versaoAtual: 99 } })
    const lote = await montarCtx(companyId, prisma)
    const laco = await montarCtxPeloLaco(companyId, prisma)
    expect(serializar(lote)).toBe(serializar(laco))
    expect(lote.componentesByFicha.get(fichaId)).toEqual([])
  })

  it('⭐ ficha INATIVA fica fora, nos dois', async () => {
    const ids = await criarFichas(3)
    await prisma.stockFicha.update({ where: { id: ids[0] }, data: { ativo: false } })
    const lote = await montarCtx(companyId, prisma)
    const laco = await montarCtxPeloLaco(companyId, prisma)
    expect(serializar(lote)).toBe(serializar(laco))
    expect(lote.componentesByFicha.has(ids[0])).toBe(false)
  })

  it('⭐ cardápio VAZIO: o grafo vazio é igual nos dois (e custa 2 consultas, não 4)', async () => {
    const e = espiaoDeConsultas(prisma)
    const lote = await montarCtx(companyId, e.db)
    const laco = await montarCtxPeloLaco(companyId, prisma)
    expect(serializar(lote)).toBe(serializar(laco))
    expect(e.chamadas.length, 'sem ficha não há versão nem componente pra buscar').toBe(2)
  })

  it('⭐⭐ e o CONSUMIDOR concorda: a explosão dá o MESMO acc pelos dois grafos', async () => {
    // ficha de 2 níveis: o produto final leva a porção produzida (o caso do xis)
    const ids = await criarFichas(2)
    const porcao = await prisma.stockFicha.findUniqueOrThrow({ where: { id: ids[0] }, select: { itemProduzidoId: true } })
    const pao = await prisma.stockItem.create({
      data: { companyId, nome: 'PAO DE XIS', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    })
    const final = await criarFicha(
      {
        companyId,
        nomeProduzido: 'XIS COMPLETO',
        unidadeProduzido: 'UN',
        tipoProduto: 'PRODUTO_FINAL',
        loteBase: 1,
        unidadeLoteBase: 'UN',
        componentes: [
          { itemId: porcao.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' },
          { itemId: pao.id, qtdPlanejada: 1, unidade: 'UN' },
        ],
      },
      prisma,
    )
    const lote = await montarCtx(companyId, prisma)
    const laco = await montarCtxPeloLaco(companyId, prisma)

    const accLote = new Map<string, number>()
    const accLaco = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: final.fichaId }, 7, lote, accLote)
    explodir({ tipo: 'FICHA', fichaId: final.fichaId }, 7, laco, accLaco)
    // ⚠️ compara SERIALIZADO: a ordem de inserção no acc é o que serializa o plano
    expect(JSON.stringify([...accLote])).toBe(JSON.stringify([...accLaco]))
    expect(accLote.size, 'a explosão tinha que descer na porção e chegar no insumo').toBeGreaterThan(0)
  })
})

/**
 * ⚠️ Sem isto o guard passa por **CEGUEIRA**: com o espião devolvendo nada, `0 === 0`,
 * `0 < 9` e `{} toEqual {}` satisfazem TODAS as asserções acima. É a lição de 20/10.
 * O auto-teste completo (delegação + ordem) mora no dono único.
 */
describe('⭐ o espião CONTA de verdade (auto-teste mínimo)', () => {
  it('registra a ida ao banco e DELEGA o resultado', async () => {
    const e = espiaoDeConsultas(prisma)
    const achou = await e.db.company.findFirst({ where: { cnpj: CNPJ }, select: { cnpj: true } })
    expect(achou?.cnpj, 'o espião MEDE, não substitui o Prisma').toBe(CNPJ)
    expect(e.chamadas).toEqual(['company.findFirst'])
  })
})
