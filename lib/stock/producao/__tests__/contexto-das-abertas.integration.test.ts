/**
 * ⭐⭐ O CONTEXTO DAS ABERTAS CONTRA O BANCO — *"quem · começou HHhMM"* + o PEDIDO (04/10/2026).
 *
 * ⛔⛔ **O TESTE QUE JUSTIFICA O DESENHO É O DO N+1.** A home da Produção é a tela que o dono abre
 * todo dia; ler "quem começou" por ORDEM, uma query por linha, é literalmente o defeito medido de
 * 28/09 — `listFichas` com `for (const f of fichas) await versaoView(…)` custou **4.909 ms e
 * 1.786 consultas**. Aqui o teste CONTA as consultas e exige que elas **não cresçam com N**.
 *
 * ⚠️ REGRA 3: executa o leitor contra o banco. Um teste puro provaria o agrupamento e **não**
 * provaria que são 3 queries em lote em vez de 3N.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { contextoDasAbertas, pedidoPorOrdem } from '../contexto-das-abertas'

const CNPJ = '75757575000256'
let companyId = ''

async function ordem(opts: { escala: number; loteBase: number; meta?: number }) {
  const o = await prisma.stockProductionOrder.create({
    data: {
      companyId, fichaId: 'f1', versaoFicha: 1, itemProduzidoId: 'it1',
      dataProducao: new Date('2026-10-04T15:00:00.000Z'),
      escalaReceitas: opts.escala, estado: 'EM_PRODUCAO',
    },
  })
  if (opts.meta != null) {
    await prisma.stockOrdemMeta.create({ data: { companyId, ordemId: o.id, unidades: opts.meta } })
  }
  return { id: o.id, escalaReceitas: opts.escala, loteBase: opts.loteBase }
}

/** uma etapa INICIADA, com participante(s) */
async function etapaIniciada(ordemId: string, posicao: number, iniciadoEm: string, quem: string[]) {
  const e = await prisma.stockOrdemEtapa.create({
    data: { companyId, ordemId, posicao, nome: `etapa ${posicao}`, iniciadoEm: new Date(iniciadoEm) },
  })
  for (const nome of quem) {
    const c = await prisma.stockColaborador.create({ data: { companyId, nome } })
    await prisma.stockOrdemEtapaParticipante.create({
      data: { companyId, etapaId: e.id, colaboradorId: c.id, iniciadoEm: new Date(iniciadoEm) },
    })
  }
  return e.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONTEXTO ABERTAS' } })
  companyId = c.id
})

afterEach(async () => {
  // ⚠️ `stock_*` não cascateia (o isolamento proíbe @relation) — apaga explícito
  for (const t of ['stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockOrdemMeta', 'stockProductionOrder', 'stockColaborador'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ o PEDIDO vem da porta única, com a ORIGEM dita', () => {
  it('⭐ com meta: DECLARADO — é o número que o dono digitou', async () => {
    const o = await ordem({ escala: 2, loteBase: 100, meta: 200 })
    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].pedido).toBe(200)
    expect(ctx[o.id].pedidoOrigem).toBe('DECLARADO')
  })

  /**
   * ⚠️ As 471 ordens antigas não têm meta — e o pedido delas é DERIVADO da ficha, **marcado como
   * tal**. Carimbar meta retroativa inventaria um pedido que ninguém fez.
   */
  it('⭐ sem meta: DERIVADO da ficha (escala × loteBase), marcado', async () => {
    const o = await ordem({ escala: 3, loteBase: 50 })
    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].pedido).toBe(150)
    expect(ctx[o.id].pedidoOrigem).toBe('DERIVADO')
  })

  it('⛔ nem meta nem ficha utilizável: `null` — a tela diz "sem pedido", nunca 0', async () => {
    const o = await ordem({ escala: 0, loteBase: 0 })
    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].pedido).toBeNull()
    expect(ctx[o.id].pedidoOrigem).toBeNull()
  })
})

describe('⭐⭐ quem está com a mão na massa, e desde quando', () => {
  it('⭐⭐ "começou" é o 1º toque da ORDEM, não o da última etapa', async () => {
    const o = await ordem({ escala: 1, loteBase: 10, meta: 10 })
    // ⚠️ a 2ª etapa é criada DEPOIS no banco mas começou ANTES no relógio — se o leitor
    // pegasse "a última linha", responderia 16:00; o certo é 08:30.
    await etapaIniciada(o.id, 1, '2026-10-04T11:30:00.000Z', ['eliane'])
    await etapaIniciada(o.id, 2, '2026-10-04T19:00:00.000Z', ['rodrigo'])

    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].comecouEm).toBe('2026-10-04T11:30:00.000Z')
    expect(ctx[o.id].quem, 'as DUAS pessoas aparecem — a dupla de 08/09').toEqual(['eliane', 'rodrigo'])
  })

  it('⭐ a dupla na MESMA etapa aparece junta', async () => {
    const o = await ordem({ escala: 1, loteBase: 10 })
    await etapaIniciada(o.id, 1, '2026-10-04T12:00:00.000Z', ['marcyelle', 'Carlisle'])
    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].quem).toEqual(['Carlisle', 'marcyelle'])
  })

  /**
   * ⛔ Etapa NA FILA não tem "começou às" — e inventar um horário pra ela seria criar um fato.
   * É a mesma régua que mantém o `finalizadoEm` NULL no gesto do gerente (07/09).
   */
  it('⛔ ordem sem ninguém: `comecouEm` null e `quem` vazio (a tela diz "ninguém pegou ainda")', async () => {
    const o = await ordem({ escala: 1, loteBase: 10, meta: 10 })
    await prisma.stockOrdemEtapa.create({
      data: { companyId, ordemId: o.id, posicao: 1, nome: 'na fila' }, // sem iniciadoEm
    })
    const ctx = await contextoDasAbertas(companyId, [o], prisma)
    expect(ctx[o.id].comecouEm).toBeNull()
    expect(ctx[o.id].quem).toEqual([])
  })

  it('⛔ REGRA 8 — ordem de OUTRA empresa não entra no contexto', async () => {
    const o = await ordem({ escala: 1, loteBase: 10, meta: 10 })
    await etapaIniciada(o.id, 1, '2026-10-04T12:00:00.000Z', ['eliane'])
    const ctx = await contextoDasAbertas('outra-empresa', [o], prisma)
    // ⚠️ o pedido ainda é derivável (é pura aritmética da ficha), mas o QUEM não vaza
    expect(ctx[o.id].quem).toEqual([])
    expect(ctx[o.id].comecouEm).toBeNull()
  })
})

/**
 * ⛔⛔ O TESTE DO N+1 — conta as CONSULTAS, não os milissegundos.
 *
 * ⚠️ Milissegundo é teste que passa ou falha pela máquina de quem roda; round-trip se conta. É a
 * mesma régua do guard da lista de receitas (28/09).
 */
describe('⛔⛔ zero N+1: as consultas NÃO crescem com o número de ordens', () => {
  it('⭐⭐ 2 ordens e 8 ordens custam o MESMO número de queries', async () => {
    const medir = async (quantas: number) => {
      const db = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
      let n = 0
      // ⭐ o evento 'query' é tipado quando o log está declarado no construtor
      db.$on('query', () => { n++ })
      const ordens: { id: string; escalaReceitas: number; loteBase: number }[] = []
      for (let i = 0; i < quantas; i++) {
        const o = await ordem({ escala: 1, loteBase: 10, meta: 10 })
        await etapaIniciada(o.id, 1, '2026-10-04T12:00:00.000Z', [`p${i}`])
        ordens.push(o)
      }
      n = 0
      await contextoDasAbertas(companyId, ordens, db)
      await db.$disconnect()
      return n
    }

    const duas = await medir(2)
    const oito = await medir(8)
    expect(duas, 'o leitor faz um punhado de queries em LOTE').toBeLessThanOrEqual(6)
    expect(oito, `8 ordens não podem custar mais que 2 (${duas} → ${oito})`).toBe(duas)
  })

  it('⭐ lista vazia não consulta nada', async () => {
    expect(await contextoDasAbertas(companyId, [], prisma)).toEqual({})
  })
})

describe('⭐ o pedido das CONCLUÍDAS é a mesma porta (puro)', () => {
  it('⭐ DECLARADO e DERIVADO, sem banco', () => {
    const r = pedidoPorOrdem(
      [{ id: 'a', escalaReceitas: 2, loteBase: 100 }, { id: 'b', escalaReceitas: 3, loteBase: 50 }],
      [{ ordemId: 'a', unidades: 180 }],
    )
    expect(r.a).toEqual({ pedido: 180, origem: 'DECLARADO' })
    expect(r.b).toEqual({ pedido: 150, origem: 'DERIVADO' })
  })
})
