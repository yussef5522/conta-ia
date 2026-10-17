/**
 * ⭐⭐⭐ A LEITURA DA TELA CONSUMO & COMPRAS — contra banco (16/10/2026).
 *
 * **O que este arquivo prova:** que a cadeia inteira fecha a partir do LEDGER — movimento →
 * `consumoPorDiaDoItem` → `mediaPorDiaDaSemana` (SEG-first) → `contaDoPedido` → a mesa e a
 * agenda. ⚠️ *Guard que testa a lib não prova o encaixe de quem a chama* (a cicatriz do teto
 * ponderado de 14/10 e do `rendimentoMedio` de 03/10): aqui o número sai do BANCO, pela função
 * que a rota vai chamar.
 *
 * ⭐ O cenário é construído com **consumo CONSTANTE por dia-da-semana**, de propósito: com
 * `2 KG` todo dia a média de cada dow é exatamente 2, e aí dá pra prever a conta do pedido na
 * mão e cravar o número — em vez de afirmar "deu algum número".
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '@/lib/stock/movement'
import { porNaLista } from '@/lib/stock/radar/watchlist'
import { salvarConfigDeCompra } from '../config-de-compra'
import { lerConsumoECompras, SEMANAS_DO_SPARK } from '../leitura'
import { DIAS_DA_BASELINE, segPrimeiro } from '../consumo-e-compras'

const CNPJ = '87878787000187'
let companyId: string

/** ⚠️ âncora RELATIVA ao relógio — data fixa no futuro é bomba de calendário (REGRA 12, 01/09) */
const AGORA = new Date()
const DIA_MS = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
/** o dia de hoje em UTC, como o `hojeBrasil` devolve pra o fuso -03 */
const hojeBr = () => iso(new Date(AGORA.getTime() - 3 * 3600_000))
const diasAtras = (n: number) => new Date(`${hojeBr()}T12:00:00Z`).getTime() - n * DIA_MS

async function item(nome: string, unidade = 'KG') {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: unidade, categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  return i.id
}

/** uma compra: alimenta o custo vigente E o "preço pago" */
async function compra(itemId: string, qtd: number, unit: number, hasAtras: number) {
  await criarMovimento(prisma, {
    companyId, itemId, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: unit,
    origem: 'SEFAZ', dataMovimento: new Date(diasAtras(hasAtras)),
  })
}

/** uma baixa de venda — o consumo que o livro registra */
async function baixa(itemId: string, qtd: number, hasAtras: number, custo = 10) {
  await criarMovimento(prisma, {
    companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -qtd, custoUnitario: custo,
    origem: 'MANUAL', dataMovimento: new Date(diasAtras(hasAtras)),
  })
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONSUMO E COMPRAS' } })
  companyId = c.id
})
afterEach(async () => {
  for (const t of ['stockCompraConfig', 'stockRadarItem', 'stockMovement', 'stockSaldoCache', 'stockItemCustoVigente', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico ao delegate
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔ A TELA NASCE VAZIA E DIZ POR QUÊ — nunca um número inventado', () => {
  it('⭐ sem lista, a leitura devolve o convite, não zeros', async () => {
    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    expect(r.caros).toEqual([])
    expect(r.porcoes).toEqual([])
    expect(r.agenda).toEqual([])
    expect(r.mesa).toEqual([])
    expect(r.avisos.join(' ')).toContain('listas nascem vazias')
  })
})

describe('⭐⭐⭐ O ENCAIXE — do LEDGER até a conta do pedido', () => {
  /**
   * ⭐ 2 KG por dia, todos os dias da baseline → a média de TODO dia-da-semana é 2.
   * Com chegada diária (todos os 7 dias) e antecedência 0:
   *   chegaEm 1 · janela de 1 dia · saiJanela 2 · precisa 2×1,1 = 2,2
   *   saiAteChegar = hoje inteiro = 2 · sobra = max(0, estoque − 2)
   */
  async function cenarioConstante(estoqueFinal: number) {
    const frango = await item('FILE DE PEITO DE FRANGO')
    // ⚠️ a compra entra ANTES da baseline pra não virar "consumo" nem sujar a média
    await compra(frango, 200, 15, DIAS_DA_BASELINE + 2)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) await baixa(frango, 2, k)
    // o saldo é 200 − 28×2 = 144; ajusto o alvo com uma baixa EXTRA fora da baseline
    const sobra = 200 - DIAS_DA_BASELINE * 2 - estoqueFinal
    if (sobra > 0) await baixa(frango, sobra, DIAS_DA_BASELINE + 1)
    await porNaLista({ companyId, lista: 'CAROS', itemId: frango }, prisma)
    return frango
  }

  it('⭐⭐ a média por dia-da-semana sai do LEDGER e é SEG-first (7 dias medidos)', async () => {
    await cenarioConstante(10)
    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.mediaPorDia).toHaveLength(7)
    // ⭐ consumo constante → TODO dia-da-semana tem média, e ela é 2
    expect(l.mediaPorDia.every((m) => m === 2), `veio ${JSON.stringify(l.mediaPorDia)}`).toBe(true)
    // ⚠️ e o índice é SEG-first: o `hojeSegPrimeiro` tem que casar com o dia real
    expect(r.hojeSegPrimeiro).toBe(segPrimeiro(new Date(`${r.hoje}T00:00:00Z`).getUTCDay()))
  })

  it('⭐⭐⭐ chegada DIÁRIA, antec 0, estoque 10 → não precisa pedir (a sobra cobre)', async () => {
    const frango = await cenarioConstante(10)
    await salvarConfigDeCompra(
      { companyId, itemId: frango, diasChegada: [0, 1, 2, 3, 4, 5, 6], antecedenciaDias: 0, fornecedor: 'Frigorífico Silva' },
      prisma,
    )
    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const p = r.caros[0].pedido
    expect(p?.ok).toBe(true)
    if (!p?.ok) throw new Error('a conta deveria fechar')
    expect(p.chegaEm).toBe(1)
    expect(p.janela).toHaveLength(1)
    expect(p.saiJanela).toBe(2)
    expect(p.precisa).toBe(2.2)
    expect(p.saiAteChegar, 'hoje inteiro').toBe(2)
    expect(p.sobraNaChegada).toBe(8)
    expect(p.pedir, 'a sobra de 8 cobre o que precisa (2,2)').toBe(0)
    // ⭐ e sem pedir nada, a agenda e a mesa ficam VAZIAS — nada de card de 0 KG
    expect(r.agenda).toEqual([])
    expect(r.mesa).toEqual([])
  })

  it('⭐⭐⭐ o MESMO cenário com estoque 1 → PEDIR 2,2 e o card nasce na mesa', async () => {
    const frango = await cenarioConstante(1)
    await salvarConfigDeCompra(
      { companyId, itemId: frango, diasChegada: [0, 1, 2, 3, 4, 5, 6], antecedenciaDias: 0, fornecedor: 'Frigorífico Silva' },
      prisma,
    )
    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const p = r.caros[0].pedido
    if (!p?.ok) throw new Error('a conta deveria fechar')
    expect(p.sobraNaChegada, 'estoque 1 não sobrevive ao dia').toBe(0)
    expect(p.pedir).toBe(2.2)

    // ── a AGENDA (lei C7): pedirEm 1 − antec 0 = 1 → amanhã
    expect(r.agenda).toHaveLength(1)
    expect(r.agenda[0]).toMatchObject({ nome: 'FILE DE PEITO DE FRANGO', pedir: 2.2, fornecedor: 'Frigorífico Silva' })

    // ── a MESA (lei C8): um card do fornecedor + dia de chegada
    expect(r.mesa).toHaveLength(1)
    const card = r.mesa[0]
    expect(card.fornecedor).toBe('Frigorífico Silva')
    expect(card.linhas[0]).toMatchObject({ pedir: 2.2, temAgora: 1, saiAteChegar: 2 })
    // ⭐ o preço pago veio da NOTA (15,00/KG) → o total é a conta, não um chute
    expect(card.linhas[0].precoPago).toBe(15)
    expect(card.linhas[0].total).toBe(33)
    expect(card.totalReais).toBe(33)
    // ⛔ PROSA É PROIBIDA: a conta aberta é número rotulado
    expect(card.linhas[0].conta).toMatchObject({ saiNaJanela: 2, folga: 10, precisa: 2.2, sobra: 0 })
    // ⭐ e o texto do WhatsApp sai pronto, pelo formatador da lib PURA
    expect(card.texto).toContain('Pedido Caçula Mix — Frigorífico Silva')
    expect(card.texto).toContain('FILE DE PEITO DE FRANGO 2,2 KG')
  })
})

describe('⛔⛔ AS RÉGUAS DE HONESTIDADE (lei C2)', () => {
  it('⛔⛔ item SEM config aparece na lista e fica FORA da mesa, com o que fazer escrito', async () => {
    const i = await item('ACEM')
    await compra(i, 50, 32.5, DIAS_DA_BASELINE + 2)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) await baixa(i, 1, k)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    expect(r.caros).toHaveLength(1) // ⭐ aparece
    expect(r.mesa).toEqual([]) //      ⛔ e fica fora da mesa
    expect(r.agenda).toEqual([])
    expect(r.semConfig).toEqual([{ itemId: i, nome: 'ACEM', porque: 'configura os dias de chegada' }])
  })

  it('⛔⛔ dia-da-semana com UMA amostra só NÃO vira média (o mínimo que o dono recusou em 10/10)', async () => {
    const i = await item('item de 1 semana')
    await compra(i, 50, 10, 10)
    // 7 dias de consumo = 1 amostra por dia-da-semana
    for (let k = 1; k <= 7; k++) await baixa(i, 3, k)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)
    await salvarConfigDeCompra({ companyId, itemId: i, diasChegada: [0, 1, 2, 3, 4, 5, 6] }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.mediaPorDia.every((m) => m === null), 'uma amostra não é média').toBe(true)
    // ⭐ e a conta DIZ o que falta, nomeando o dia — nunca um pedido montado no escuro
    expect(l.pedido?.ok).toBe(false)
    if (l.pedido?.ok) throw new Error('não deveria montar pedido')
    expect(l.pedido!.porque).toContain('sem consumo medido')
    expect(r.mesa).toEqual([])
  })

  it('⛔ sem custo vigente, o custo do período é `null` — NUNCA R$ 0,00', async () => {
    const i = await item('item sem nota')
    // ⚠️ sem ENTRADA com valor não existe custo vigente (a lei de 13/10)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) await baixa(i, 1, k, 0)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'MES', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.custoVigente).toBeNull()
    expect(l.custoDoPeriodo, 'R$ 0,00 afirmaria que o consumo não custou nada').toBeNull()
  })

  it('⛔ Δ% não existe sem base: período anterior ZERO devolve `null`, nunca 100%', async () => {
    const i = await item('item novo')
    await compra(i, 50, 10, 3)
    await baixa(i, 5, 1)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    expect(r.caros[0].deltaPct).toBeNull()
    expect(r.caros[0].consumoAnterior).toBeNull()
  })
})

describe('⭐ O LIVRO — para onde foi, e o que ele NÃO sabe', () => {
  it('⭐⭐ a baixa de VENDA vira balde PRÓPRIO e nomeado — nunca rateada por palpite', async () => {
    const i = await item('QUEIJO')
    await compra(i, 100, 38, 10)
    await baixa(i, 4, 1)
    await baixa(i, 6, 2)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.naoAtribuido).toBe(10)
    expect(l.destinos).toHaveLength(1)
    expect(l.destinos[0].nome).toContain('o livro não diz a receita')
    expect(l.destinos[0].pct).toBe(100)
    // ⛔ e o destino da venda NÃO tem link — número morto é proibido, link morto também
    expect(l.destinos[0].fichaId).toBeNull()
  })

  it('⭐ PREÇO PAGO: último, média das 4 e a tendência com banda morta de 5%', async () => {
    const i = await item('CALABRESA')
    await compra(i, 10, 10, 40)
    await compra(i, 10, 10, 30)
    await compra(i, 10, 10, 20)
    await compra(i, 10, 20, 1) // ⭐ dobrou: SUBIU
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const p = r.caros[0].precoPago
    expect(p.ultimo).toBe(20)
    expect(p.media4).toBe(12.5) // (20+10+10+10)/4
    expect(p.tendencia).toBe('SUBIU')
    expect(p.comprasConsideradas).toBe(4)
  })

  it('⭐ compra ESTORNADA não é preço pago (ela não comprou nada)', async () => {
    const i = await item('item com estorno')
    await compra(i, 10, 10, 5)
    const m = await prisma.stockMovement.findFirst({ where: { companyId, itemId: i }, orderBy: { criadoEm: 'desc' } })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: i, tipo: 'ESTORNO', quantidade: -10, custoUnitario: 10, custoTotal: -100,
        origem: 'MANUAL', estornoDeId: m!.id, dataMovimento: new Date(diasAtras(4)),
      },
    })
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    // ⚠️ o estorno NÃO entra como compra; a original ainda conta como preço pago daquele dia
    expect(r.caros[0].precoPago.comprasConsideradas).toBe(1)
  })
})

describe('⭐ O PLANO DE PRODUÇÃO (lei C9) — porção não se compra', () => {
  it('⭐⭐ a porção entra no PLANO e nunca na mesa de pedido', async () => {
    const porcao = await item('porçao queijo 135 grama', 'UN')
    await criarMovimento(prisma, {
      companyId, itemId: porcao, tipo: 'PRODUCAO_GERACAO', quantidade: 500, custoUnitario: 4,
      origem: 'MANUAL', dataMovimento: new Date(diasAtras(DIAS_DA_BASELINE + 2)),
    })
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) await baixa(porcao, 10, k, 4)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: porcao }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    expect(r.porcoes).toHaveLength(1)
    expect(r.caros).toEqual([])
    // ⛔ porção NUNCA monta pedido de compra
    expect(r.porcoes[0].pedido).toBeNull()

    const p = r.porcoes[0].plano
    expect(p?.ok).toBe(true)
    if (!p?.ok) throw new Error('o plano deveria fechar')
    // média 10/dia → mínimo = ceil(10 × 3) = 30 · sai hoje 10 · estoque 500−280 = 220
    expect(p.minimo).toBe(30)
    expect(p.saiHoje).toBe(10)
    expect(p.produzir, 'com 220 na prateleira não precisa produzir').toBe(0)

    expect(r.plano).toHaveLength(1)
    expect(r.plano[0]).toMatchObject({ nome: 'porçao queijo 135 grama', minimo: 30, produzir: 0 })
    // ⚠️ sem ficha cadastrada, o "criar ordem" NÃO tem pra onde apontar — e diz isso com null
    expect(r.plano[0].fichaId).toBeNull()
  })
})

describe('⭐ O HERÓI (lei C3) — spark e barras com o ghost', () => {
  it('⭐ o spark tem 8 semanas e a barra carrega o GHOST do mesmo dia-da-semana anterior', async () => {
    const i = await item('FRANGO')
    await compra(i, 500, 15, SEMANAS_DO_SPARK * 7 + 2)
    for (let k = 1; k <= SEMANAS_DO_SPARK * 7; k++) await baixa(i, 2, k)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.spark).toHaveLength(SEMANAS_DO_SPARK)
    // ⭐ 2 KG/dia × 7 dias = 14 em toda semana fechada
    expect(l.spark.slice(0, SEMANAS_DO_SPARK - 1).every((v) => v === 14), JSON.stringify(l.spark)).toBe(true)
    // as barras da semana do seletor: o dia de HOJE não tem baixa (as baixas começam em k=1)
    expect(l.barras.length).toBeGreaterThan(0)
    const comGhost = l.barras.filter((b) => b.ghost != null)
    expect(comGhost.length, 'o ghost vem da semana anterior, que tem dado').toBeGreaterThan(0)
    expect(comGhost.every((b) => b.ghost === 2)).toBe(true)
  })
})
