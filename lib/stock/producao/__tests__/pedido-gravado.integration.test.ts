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
 *
 * ═══ ⚠️⚠️ ATUALIZADO EM 11/10 — O WRITER MUDOU DE LUGAR, A PERGUNTA NÃO ═══
 *
 * Em 04/10 quem gravava a meta era o `criarOrdem` (a quantidade era perguntada na CRIAÇÃO).
 * O dono achou o fantasma: *"a quantidade é perguntada 2× — na criação E depois de criar — e
 * números diferentes deixam o 1º assombrando a tela"*. Agora a pergunta é **UMA**, na página da
 * ordem, e o writer único é o **`confirmarPedido`**.
 *
 * ⭐ O que este arquivo afirma **não mudou**: o pedido em UN vira LINHA no banco e o leitor de
 * 13/09 tem número. O que mudou é **por qual porta** — e os testes migraram pro fluxo REAL
 * (criar → confirmar), que é mais forte que o anterior: ele exercita os DOIS gestos.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarOrdem, OrdemError } from '../ordens'
import { confirmarPedido, rastroDoPedido } from '../confirmar-pedido'
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
  for (const t of ['stockProducaoConclusao', 'stockOrdemPedidoDeclarado', 'stockOrdemRetalho', 'stockOrdemMeta', 'stockOrdemEtapa', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐⭐ o pedido em UN vira LINHA no banco', () => {
  it('⭐⭐ confirmar o pedido de 80 UN grava a meta, a escala e o rastro', async () => {
    const { ordemId } = await criarOrdem({
      companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z'),
    }, prisma)
    // ⭐ a ordem nasce SEM meta: a quantidade morreu da criação (11/10)
    expect(await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })).toBeNull()

    const r = await confirmarPedido({ companyId, ordemId, unidades: 80, userId: 'user-dono' }, prisma)
    expect(r).toMatchObject({ unidades: 80, escala: 80, corrigiu: false })

    const meta = await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })
    expect(meta, 'a meta tem que nascer do gesto — era isto que faltava').not.toBeNull()
    expect(meta).toMatchObject({ unidades: 80, registradoPorId: 'user-dono' })
    /**
     * ⛔⛔ A ESCALA ANDA NA MESMA TRANSAÇÃO — é ela que a separação lê. Gravar uma e não a
     * outra seria o fantasma renascendo por dentro: o cabeçalho diria 80 e a cozinha separaria
     * material pra o DEFAULT 1 do banco.
     */
    const o = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true } })
    expect(o.escalaReceitas).toBe(escalaDoPedido({ pedido: 80, loteBase: 1 }))

    const rastro = await rastroDoPedido(companyId, ordemId, prisma)
    expect(rastro).toHaveLength(1)
    expect(rastro[0]).toMatchObject({ unidades: 80, correcao: false })
  })

  /**
   * ⭐⭐⭐ A CORREÇÃO ATÉ SEPARAR (a ordem do dono): *"ATÉ separar, o pedido pode ser corrigido
   * pela MESMA tela (regrava a meta com rastro); DEPOIS de separada, não — a separação já
   * obedeceu"*.
   *
   * ⚠️ A meta fica com UMA linha (o valor corrente mora num lugar só) e o rastro com DUAS — é
   * ele que guarda o "quem·quando" da correção, porque a meta tem `criadoEm DEFAULT now()` e
   * um upsert deixaria o carimbo apontando pra a PRIMEIRA declaração.
   */
  it('⭐⭐⭐ corrigir 30 → 20 antes de separar: 1 meta, 2 rastros, e só o 20 vale', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    await confirmarPedido({ companyId, ordemId, unidades: 30, userId: 'u1' }, prisma)
    const r2 = await confirmarPedido({ companyId, ordemId, unidades: 20, userId: 'u1' }, prisma)
    expect(r2.corrigiu, 'o 2º gesto se sabe correção').toBe(true)

    const metas = await prisma.stockOrdemMeta.findMany({ where: { companyId, ordemId } })
    expect(metas).toHaveLength(1)
    expect(metas[0].unidades, 'só o 20 existe — o 30 não assombra').toBe(20)

    const rastro = await rastroDoPedido(companyId, ordemId, prisma)
    expect(rastro).toHaveLength(2)
    expect(rastro[0]).toMatchObject({ unidades: 20, correcao: true })
    expect(rastro[1]).toMatchObject({ unidades: 30, correcao: false })

    const o = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true } })
    expect(o.escalaReceitas, 'a escala segue a correção').toBe(escalaDoPedido({ pedido: 20, loteBase: 1 }))
  })

  it('⛔⛔ DEPOIS de separada o pedido NÃO se corrige — e a recusa diz a saída', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    await confirmarPedido({ companyId, ordemId, unidades: 30 }, prisma)
    await prisma.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'SEPARADA' } })

    await expect(confirmarPedido({ companyId, ordemId, unidades: 20 }, prisma)).rejects.toThrow(OrdemError)
    await expect(confirmarPedido({ companyId, ordemId, unidades: 20 }, prisma)).rejects.toThrow(/cancele a ordem/)
    // ⛔ e nada mudou: o material que já saiu da câmara continua obedecendo ao 30
    const metas = await prisma.stockOrdemMeta.findMany({ where: { companyId, ordemId } })
    expect(metas[0].unidades).toBe(30)
    expect(await rastroDoPedido(companyId, ordemId, prisma)).toHaveLength(1)
  })

  it('⭐⭐ e o resolvedor devolve DECLARADO (o número que o dono digitou)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    await confirmarPedido({ companyId, ordemId, unidades: 80 }, prisma)

    const meta = await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId }, select: { unidades: true } })
    const ordem = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true, estado: true } })
    const p = pedidoDaOrdem({ meta: meta?.unidades ?? null, escala: ordem.escalaReceitas, loteBase: 1, estado: ordem.estado })
    expect(p).toMatchObject({ unidades: 80, origem: 'DECLARADO' })
  })

  it('⚠️ a SUGESTÃO de min/máx manda escala como PLANO — e a ordem abre AGUARDANDO mesmo assim', async () => {
    /**
     * ⛔ É o que mantém o caminho antigo vivo: a sugestão calcula uma escala e **não "pede"
     * nada**. `escalaReceitas` segue opcional em `criarOrdem` por isso.
     *
     * ⭐⭐ E repare no desfecho: a ordem nasce com escala 80 e o resolvedor devolve
     * **AGUARDANDO**, não "pedido 80". É a diferença entre um PLANO do sistema e uma
     * DECLARAÇÃO do dono — e é ela que impede a tela de imprimir um número que ninguém pediu.
     */
    const { ordemId } = await criarOrdem({
      companyId, fichaId, escalaReceitas: 80, dataProducao: new Date('2026-10-04T15:00:00Z'), origem: 'SUGESTAO',
    }, prisma)
    expect(await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })).toBeNull()

    const o = await prisma.stockProductionOrder.findUniqueOrThrow({ where: { id: ordemId }, select: { escalaReceitas: true, estado: true } })
    const p = pedidoDaOrdem({ meta: null, escala: o.escalaReceitas, loteBase: 1, estado: o.estado })
    expect(p).toMatchObject({ unidades: null, origem: 'AGUARDANDO' })
  })

  it('⛔ pedido 0 / negativo é RECUSADO — nada de "pedido 0" no banco', async () => {
    /**
     * ⚠️ Antes de 11/10 isto "não gravava linha" em silêncio (o `criarOrdem` pulava). Agora o
     * writer **recusa com a frase que ensina**, que é mais forte: o dono descobre no ato, em
     * vez de descobrir que a meta não existe três telas depois.
     */
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    for (const n of [0, -3]) {
      await expect(confirmarPedido({ companyId, ordemId, unidades: n }, prisma), `pedido ${n}`).rejects.toThrow(OrdemError)
    }
    expect(await prisma.stockOrdemMeta.findFirst({ where: { companyId, ordemId } })).toBeNull()
    expect(await rastroDoPedido(companyId, ordemId, prisma)).toHaveLength(0)
  })

  it('⛔ duas metas pra MESMA ordem é impossível (o `@@unique` do banco, não uma checagem)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    await confirmarPedido({ companyId, ordemId, unidades: 80 }, prisma)
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
    const { ordemId } = await criarOrdem({ companyId, fichaId, dataProducao: new Date('2026-10-04T15:00:00Z') }, prisma)
    await confirmarPedido({ companyId, ordemId, unidades: 80 }, prisma)
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
