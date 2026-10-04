/**
 * ⭐⭐⭐ O WRITER QUE FALTAVA — `stock_ordem_meta` passa a ser GRAVADA (item 2, 04/10/2026).
 *
 * ⛔⛔ **O DEFEITO QUE ISTO FECHA, medido em prod:** a tabela existe desde **13/09**, tem DOIS
 * leitores (`lotes.ts` e `dia-ao-vivo.ts`) e **ZERO writers** — **0 linhas em 471 ordens**. O
 * relatório por tarefa já sabia imprimir *"pedido 130 → entregue 137 (105%)"* e **o pedido era
 * SEMPRE null**, então o % nunca apareceu. *Campo que ninguém escreve é promessa que a tela não
 * cumpre* — a mesma família do `futureParcelasNotInvoiced` que chegava vazio ("pra MVP fica
 * vazio", e ficou) e do `rawOfxBlob` que não gravava em todos os caminhos.
 *
 * ⚠️ E o teste roda contra BANCO de propósito: um teste puro sobre `criarOrdem` não prova que a
 * linha nasceu — foi exatamente assim que o buraco sobreviveu a 471 ordens.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarOrdem } from '../ordens'
import { criarFicha } from '../fichas'
import { pedidoDaOrdem } from '../pedido-da-ordem'
import { escalaDoPedido } from '../escala-da-ordem'
import { lotesDaJanela } from '../lotes'

const CNPJ = '73737373000254'
let companyId = ''
let fichaId = ''
let itemProduzidoId = ''

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'PEDIDO GRAVADO' } })
  companyId = c.id

  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'Acém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 33.96, custoTotal: 3396, origem: 'SEFAZ' },
  })
  const f = await criarFicha(
    {
      companyId, nomeProduzido: 'beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo.id, qtdPlanejada: 0.091, unidade: 'KG' }],
    },
    prisma,
  )
  fichaId = f.fichaId
  itemProduzidoId = (await prisma.stockFicha.findUniqueOrThrow({ where: { id: fichaId } })).itemProduzidoId
})

afterEach(async () => {
  for (const t of ['stockProducaoConclusao', 'stockOrdemMeta', 'stockOrdemEtapa', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐⭐ o pedido em UN vira LINHA no banco', () => {
  it('⭐⭐ criar ordem com `pedidoUnidades: 80` grava a meta', async () => {
    const escala = escalaDoPedido({ pedido: 80, loteBase: 1 })!
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: escala, dataProducao: new Date('2026-10-04T15:00:00Z'),
      pedidoUnidades: 80, userId: 'user-dono',
    }, prisma)

    const meta = await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })
    expect(meta, 'a meta tem que NASCER com a ordem — era isto que faltava').not.toBeNull()
    expect(meta).toMatchObject({ unidades: 80, registradoPorId: 'user-dono' })
  })

  it('⭐⭐ e o resolvedor devolve DECLARADO (o número que o dono digitou)', async () => {
    const escala = escalaDoPedido({ pedido: 80, loteBase: 1 })!
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: escala, dataProducao: new Date('2026-10-04T15:00:00Z'),
      pedidoUnidades: 80,
    }, prisma)

    const meta = await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId }, select: { unidades: true } })
    const ordem = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true } })
    const p = pedidoDaOrdem({ meta: meta?.unidades ?? null, escala: ordem.escalaReceitas, loteBase: 1 })
    expect(p).toMatchObject({ unidades: 80, origem: 'DECLARADO' })
  })

  it('⚠️ SEM `pedidoUnidades` (tablet, sugestão min/máx) a ordem nasce igual — e cai no DERIVADO', async () => {
    /**
     * ⛔ É o que mantém os caminhos antigos vivos. Exigir a meta aqui quebraria a sugestão de
     * min/máx (que calcula escala e não "pede" nada) e o tablet. **O que não pode é a ausência
     * virar um pedido inventado** — por isso a origem é DERIVADO, dita na tela.
     */
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: 80, dataProducao: new Date('2026-10-04T15:00:00Z'),
    }, prisma)
    expect(await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })).toBeNull()

    const p = pedidoDaOrdem({ meta: null, escala: 80, loteBase: 1 })
    expect(p).toMatchObject({ unidades: 80, origem: 'DERIVADO' })
  })

  it('⛔ meta inválida (0 / negativa) NÃO vira linha — nada de "pedido 0" no banco', async () => {
    for (const n of [0, -3]) {
      const { ordemId } = await criarOrdem({
        companyId, fichaId, escalaReceitas: 10, dataProducao: new Date('2026-10-04T15:00:00Z'),
        pedidoUnidades: n,
      }, prisma)
      expect(await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } }), `pedido ${n}`).toBeNull()
    }
  })

  it('⛔ duas metas pra MESMA ordem é impossível (o `@@unique` do banco, não uma checagem)', async () => {
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: 80, dataProducao: new Date('2026-10-04T15:00:00Z'),
      pedidoUnidades: 80,
    }, prisma)
    await expect(
      prisma.stockOrdemMeta.create({ data: { companyId, ordemId, unidades: 999 } }),
    ).rejects.toThrow()
    const metas = await prisma.stockOrdemMeta.findMany({ where: { companyId, ordemId } })
    expect(metas).toHaveLength(1)
    expect(metas[0].unidades).toBe(80)
  })
})

describe('⭐⭐ e o LEITOR que esperava desde 13/09 passa a ter número', () => {
  it('⭐⭐ `lotesDaJanela` devolve o `pedido` — o % do relatório por tarefa finalmente existe', async () => {
    const escala = escalaDoPedido({ pedido: 80, loteBase: 1 })!
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: escala, dataProducao: new Date('2026-10-04T15:00:00Z'),
      pedidoUnidades: 80,
    }, prisma)
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CONCLUIDA' } })
    await prisma.stockProducaoConclusao.create({
      data: {
        companyId, ordemId, qtdGerada: 78, escalaConsumida: escala, rendimento: 78 / escala,
        custoLoteReal: 247.5, custoUnitarioReal: 247.5 / 78,
      },
    })

    const lotes = await lotesDaJanela(companyId, {}, prisma)
    // ⚠️ o `Lote` se identifica pela TAREFA (o nome do item produzido), não por id
    const meu = lotes.find((l) => l.tarefa === 'beef de xis')
    expect(meu, 'o lote tem que aparecer na janela').toBeTruthy()
    /**
     * ⛔⛔ **ERA AQUI QUE O NULL VIVIA.** Antes deste sprint, `pedido` vinha `null` em 100% dos
     * lotes — então *"pedido 130 → entregue 137 (105%)"* nunca tinha o 130.
     */
    expect(meu!.pedido).toBe(80)
    expect(meu!.entregue).toBe(78)
  })
})
