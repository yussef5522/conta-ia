/**
 * ⛔⛔⛔ A LISTA DE CONCLUÍDAS NÃO DEPENDE DO TETO DAS ENCERRADAS (05/10/2026).
 *
 * **Achado na prova em prod do visual v4**, medindo a rota real com o período de 30 dias:
 * ```
 * concluídas 379 · ordens no payload 207
 * ⛔ conclusões cuja ORDEM não veio: 200  → nome "—", SEM logo, SEM pedido, SEM pílula
 * ```
 * O `listOrdens` corta as encerradas em **200 de propósito** (elas são a massa e envelhecem), e
 * a lista de concluídas montava nome/unidade/pedido **filtrando essa lista truncada**. Resultado:
 * mais da METADE das linhas perdia o visual v4 em silêncio.
 *
 * ⭐ É o **teto de leitura escondendo o item pela 4ª vez** nesta casa — o `take: 50` que escondia
 * o fermento da busca (16/09), o `take: 200` que sumiu com a ordem do ano 202 (19/09) e o
 * `take: 300` do recebimento (23/09). A cura é sempre a mesma: **quem precisa de uma linha
 * específica resolve por ID**.
 *
 * ⚠️ REGRA 3: este teste CRIA 201 encerradas no banco e executa os dois leitores. Um teste puro
 * provaria o agrupamento e **não** provaria que o teto deixou de morder.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { listOrdens, receitaDasOrdens } from '../ordens'

const CNPJ = '75707570000199'
let companyId = ''
let fichaId = ''
let itemId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'TETO DAS CONCLUIDAS' } })
  companyId = c.id
  const item = await prisma.stockItem.create({
    data: { companyId, nome: 'porçao queijo 135 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemId = item.id
  const f = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: itemId, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  fichaId = f.id
  await prisma.stockFichaVersao.create({
    data: { companyId, fichaId, versao: 1, loteBase: 10, unidadeLoteBase: 'UN' },
  })
})

afterEach(async () => {
  for (const t of ['stockProductionOrder', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔⛔ 201 ordens encerradas — o teto corta a lista, nunca a linha pedida', () => {
  it('⛔⛔ a 201ª encerrada SAI do `listOrdens` e CONTINUA resolvível por ID', async () => {
    // ⚠️ `createMany` numa tacada: o teste precisa de 201 linhas, não de 201 round-trips
    const base = new Date('2026-08-01T15:00:00.000Z')
    await prisma.stockProductionOrder.createMany({
      data: Array.from({ length: 201 }, (_, i) => ({
        companyId, fichaId, versaoFicha: 1, itemProduzidoId: itemId,
        // ⭐ a MAIS ANTIGA é a que o teto corta (a ordenação é `dataProducao desc`)
        dataProducao: new Date(base.getTime() + i * 86400000),
        escalaReceitas: 8.48608, estado: 'CONCLUIDA',
      })),
    })
    const todas = await prisma.stockProductionOrder.findMany({
      where: { companyId }, orderBy: [{ dataProducao: 'asc' }], select: { id: true },
    })
    expect(todas.length).toBe(201)
    const maisAntiga = todas[0].id

    const lista = await listOrdens(companyId, prisma)
    expect(lista.length, 'o teto das encerradas continua valendo pra lista geral').toBe(200)
    expect(
      lista.some((o) => o.id === maisAntiga),
      'a mais antiga cai fora do teto — é esse o estado que escondia 200 linhas',
    ).toBe(false)

    /** ⭐ e a linha que o teto cortou continua resolvível POR ID — com nome, unidade e lote */
    const r = await receitaDasOrdens(companyId, [maisAntiga], prisma)
    expect(r[maisAntiga], 'a ordem fora do teto tem que ter receita').toBeDefined()
    expect(r[maisAntiga].nome).toBe('porçao queijo 135 grama')
    expect(r[maisAntiga].unidade).toBe('UN')
    expect(r[maisAntiga].loteBase).toBe(10)
    expect(r[maisAntiga].escalaReceitas).toBeCloseTo(8.48608, 5)
  })

  /**
   * ⭐⭐ **E O PEDIDO SAI DISSO** — `escala 8,48608 × lote 10 = 84,8608`, o número exato que o
   * dono viu na tela e mandou arredondar. ⛔ Sem a resolução por ID, essas linhas não teriam
   * pedido nenhum → **sem pílula, sem par de números, sem logo**.
   */
  it('⭐⭐ a linha fora do teto tem o pedido de 84,8608 (que a tela mostra como "85")', async () => {
    const o = await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId, versaoFicha: 1, itemProduzidoId: itemId,
        dataProducao: new Date('2026-08-01T15:00:00.000Z'), escalaReceitas: 8.48608, estado: 'CONCLUIDA',
      },
    })
    const { pedidoPorOrdem } = await import('../contexto-das-abertas')
    const { fmtPedido, pilulaDoPedido } = await import('../pedido-na-tela')
    const r = await receitaDasOrdens(companyId, [o.id], prisma)
    const ped = pedidoPorOrdem([{ id: o.id, escalaReceitas: r[o.id].escalaReceitas, loteBase: r[o.id].loteBase }], [])
    expect(ped[o.id].pedido).toBeCloseTo(84.8608, 4)
    expect(ped[o.id].origem, 'sem meta declarada, o pedido é DERIVADO — e a pílula vale igual').toBe('DERIVADO')
    expect(fmtPedido(ped[o.id].pedido, r[o.id].unidade)).toBe('85')
    expect(pilulaDoPedido(85, ped[o.id].pedido, r[o.id].unidade)!.texto).toBe('100% do pedido')
  })

  /** ⚠️ e ela lê em LOTE: 3 consultas pra N ordens, nunca uma por ordem (a lição de 28/09) */
  it('⭐ 3 consultas, e elas NÃO crescem com N', async () => {
    const base = new Date('2026-09-01T15:00:00.000Z')
    await prisma.stockProductionOrder.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        companyId, fichaId, versaoFicha: 1, itemProduzidoId: itemId,
        dataProducao: new Date(base.getTime() + i * 3600000), escalaReceitas: 2, estado: 'CONCLUIDA',
      })),
    })
    const ids = (await prisma.stockProductionOrder.findMany({ where: { companyId }, select: { id: true } })).map((o) => o.id)

    const contar = async (n: number) => {
      let q = 0
      const espia = Object.assign(Object.create(Object.getPrototypeOf(prisma)), prisma, {
        stockProductionOrder: { findMany: (a: never) => { q++; return prisma.stockProductionOrder.findMany(a) } },
        stockFichaVersao: { findMany: (a: never) => { q++; return prisma.stockFichaVersao.findMany(a) } },
        stockItem: { findMany: (a: never) => { q++; return prisma.stockItem.findMany(a) } },
      })
      await receitaDasOrdens(companyId, ids.slice(0, n), espia as never)
      return q
    }
    expect(await contar(3)).toBe(3)
    expect(await contar(30), '30 ordens continuam custando 3 consultas').toBe(3)
  })
})
