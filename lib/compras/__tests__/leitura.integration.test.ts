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
  for (const t of ['stockVendaImport', 'stockCompraConfig', 'stockRadarItem', 'stockMovement', 'stockSaldoCache', 'stockItemCustoVigente', 'stockItem'] as const) {
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
    /**
     * ⚠️⚠️ **O PRESSUPOSTO DESTA FIXTURE ERA IMPLÍCITO E AGORA ESTÁ ESCRITO.** Ela comprava 10
     * dias atrás e consumia nos últimos 7, contando com a régua antiga (*"só dia COM movimento
     * é amostra"*) pra ter 1 amostra por dia-da-semana. Pela lei de 17/10 os 3 dias entre a
     * compra e o 1º consumo são **dias FECHADOS com zero** — o item estava na casa e não foi
     * usado —, então 3 dos 7 dows passariam a ter 2 amostras e o cenário do nome deste teste
     * deixaria de existir. ⭐ A REGRA testada não mudou (`MIN_AMOSTRAS_DO_DIA`): o que mudou é
     * que o livro agora **começa no 1º movimento do item**, então a compra entra no MESMO dia.
     */
    await compra(i, 50, 10, 7)
    // 7 dias de livro = 1 amostra por dia-da-semana
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

  it('⭐ PREÇO PAGO: último, média das últimas e a tendência com banda morta de 5%', async () => {
    const i = await item('CALABRESA')
    await compra(i, 10, 10, 40)
    await compra(i, 10, 10, 30)
    await compra(i, 10, 10, 20)
    await compra(i, 10, 20, 1) // ⭐ dobrou: SUBIU
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const p = r.caros[0].precoPago
    expect(p.ultimo).toBe(20)
    expect(p.mediaDasUltimas).toBe(12.5) // (20+10+10+10)/4
    expect(p.tendencia).toBe('SUBIU')
    expect(p.comprasConsideradas).toBe(4)
    /**
     * ⭐⭐ **UMA VERDADE (lei C12, 17/10).** A tela escreve *"vs a média das N anteriores"* e N é
     * **a base que a conta usou de fato** (as compras ANTES da última), nunca o total da janela.
     * ⛔ Antes ela dizia `comprasConsideradas` (4 aqui, e 10 num item de giro) sobre uma média
     * feita com 3 — *rótulo que promete mais do que entrega*.
     */
    expect(p.baseDaTendencia).toBe(3)
  })

  it('⭐⭐ a média do preço usa até `COMPRAS_NA_MEDIA` compras — a constante, nunca um 4 digitado', async () => {
    const i = await item('item de muito giro')
    // ⚠️ 12 compras, preço SUBINDO com a recência: a de 12 dias atrás a R$ 1, a de ontem a R$ 12
    for (let k = 12; k >= 1; k--) await compra(i, 5, 13 - k, k)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const p = r.caros[0].precoPago
    expect(p.comprasConsideradas).toBe(12)
    // ⭐ a média pega as 10 mais recentes (12..3), não as 4 nem as 12
    expect(p.mediaDasUltimas).toBeCloseTo((12 + 11 + 10 + 9 + 8 + 7 + 6 + 5 + 4 + 3) / 10, 2)
    // ⭐ e a base da tendência são as 10 ANTERIORES à última (11..2)
    expect(p.baseDaTendencia).toBe(10)
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

/**
 * ⭐⭐ O NOME DA EMPRESA VAI APARADO — achado na PROVA EM PROD, não no código.
 *
 * O cadastro da Caçula está gravado como `"caçula mix "`, com espaço no fim (a cicatriz da conta
 * `'sicredi '`, 25/08). ⚠️ Esse nome é o **cabeçalho do texto que o FORNECEDOR recebe** no
 * WhatsApp — e o `−/+` da mesa remonta esse texto no cliente, então o espaço sairia na mensagem.
 */
describe('⭐ o nome da empresa vai APARADO (o espaço do cadastro não vai pro WhatsApp)', () => {
  it('apara o espaço do cadastro, mesmo quando as listas estão vazias', async () => {
    const vazia = await lerConsumoECompras(
      { companyId, empresa: '  caçula mix  ', periodo: 'SEMANA', agora: AGORA },
      prisma,
    )
    expect(vazia.empresa).toBe('caçula mix')
  })

  /**
   * ⚠️ OS DOIS CAMINHOS, de propósito: `lerConsumoECompras` tem **dois `return`** (o atalho de
   * lista vazia e o cheio). Cobrir um só deixaria o outro livre pra voltar a mandar o espaço —
   * é a família do *"N caminhos, 1 esquecido"* que esta casa mais paga.
   */
  it('apara também no caminho CHEIO (com item na lista)', async () => {
    const id = await item('FRANGO')
    await porNaLista({ companyId, itemId: id, lista: 'CAROS' }, prisma)
    await baixa(id, 2, 1)
    const cheia = await lerConsumoECompras(
      { companyId, empresa: 'caçula mix ', periodo: 'SEMANA', agora: AGORA },
      prisma,
    )
    expect(cheia.caros.length).toBeGreaterThan(0)
    expect(cheia.empresa).toBe('caçula mix')
  })
})


/**
 * ⭐⭐⭐ O CASO-CICATRIZ DO COXÃO — ZERO DE VERDADE × "A APURAR" (17/10/2026)
 *
 * **Os números são os de prod**, medidos antes de uma linha de código (ledger do item
 * `Coxão Mole`, semana 11→17/10): separação de **27,9** no domingo, **19,44** na segunda,
 * **8,64** na terça, e **NADA de qua a sáb** — porque a casa já tinha porção pronta no estoque
 * (palavra do dono). `27,9 + 19,44 + 8,64 = 55,98 ≈ 56 KG`, que é o herói que ele viu.
 *
 * ⛔ O que este teste trava é o **RÓTULO**: qua/qui/sex são dias **FECHADOS com consumo ZERO**,
 * entram na média, e o herói **não ganha selo de "a apurar"** — porque não há pendência nenhuma
 * (medido em prod: 0 dias sem baixa de venda em 34). Com a régua antiga (`porDia.has(dia)`), os
 * três viravam `null`: *"—"* na barra e **fora da média**.
 */
describe('⭐⭐⭐ ZERO DE VERDADE × A APURAR — o caso do coxão', () => {
  /** separação de insumo: o consumo que NÃO vem da venda (é o caso do coxão) */
  async function separacao(itemId: string, qtd: number, hasAtras: number) {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -qtd, custoUnitario: 30,
      origem: 'MANUAL', dataMovimento: new Date(diasAtras(hasAtras)),
    })
  }

  async function cenarioCoxao() {
    const coxao = await item('Coxão Mole')
    await compra(coxao, 300, 30, DIAS_DA_BASELINE + 2)
    // dom/seg/ter produziram porção; qua/qui/sex/sáb(hoje) NÃO abriram coxão
    await separacao(coxao, 27.9, 6)
    await separacao(coxao, 19.44, 5)
    await separacao(coxao, 8.64, 4)
    await porNaLista({ companyId, itemId: coxao, lista: 'CAROS' }, prisma)
    const r = await lerConsumoECompras(
      { companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA },
      prisma,
    )
    return { coxao, linha: r.caros[0] }
  }

  it('⭐ dia PASSADO sem movimento conta ZERO na barra — nunca "a apurar"', async () => {
    const { linha } = await cenarioCoxao()
    expect(linha.barras).toHaveLength(7)

    // os 3 dias que produziram
    const comConsumo = linha.barras.filter((b) => (b.valor ?? 0) > 0).map((b) => b.valor)
    expect(comConsumo.sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([8.64, 19.44, 27.9])

    // ⭐ qua/qui/sex: FECHADOS com ZERO, nunca null
    const passadosSemMovimento = linha.barras.filter((b) => b.estado === 'FECHADO' && b.valor === 0)
    expect(passadosSemMovimento).toHaveLength(3)

    // ⛔ nenhuma barra de dia passado pode vir "a apurar"
    expect(linha.barras.filter((b) => b.estado === 'PENDENTE')).toEqual([])
    expect(linha.barras.filter((b) => b.estado !== 'HOJE' && b.valor == null)).toEqual([])
  })

  it('⭐ HOJE é dia ABERTO: entra com selo de parcial e FORA da média', async () => {
    const { linha } = await cenarioCoxao()
    const hoje = linha.barras[linha.barras.length - 1]
    expect(hoje.estado).toBe('HOJE')
    // nada saiu hoje ainda — o parcial é zero, mas o ESTADO diz que o dia não acabou
    expect(hoje.valor).toBe(0)
  })

  it('⭐⭐ o herói soma 56 KG de semana VÁLIDA (27,9 + 19,44 + 8,64 + 0 + 0 + 0)', async () => {
    const { linha } = await cenarioCoxao()
    expect(linha.consumoDoPeriodo).toBeCloseTo(55.98, 2)
  })

  it('⭐⭐ os ZEROS ENTRAM na média por dia-da-semana — nenhum dow fica "a apurar"', async () => {
    const { linha } = await cenarioCoxao()
    // 28 dias de baseline → 4 amostras por dow; com os zeros entrando, TODO dow tem média
    expect(linha.mediaPorDia.filter((m) => m == null)).toEqual([])
  })

  it('⛔ o herói NÃO ganha selo quando não há pendência de verdade', async () => {
    const { linha } = await cenarioCoxao()
    expect(linha.temDiaAApurar).toBe(false)
  })

  it('⭐ a cobertura DIZ a janela usada — morre o "sem média medida ainda" com número ao lado', async () => {
    const { linha } = await cenarioCoxao()
    expect(linha.coberturaDias).not.toBeNull()
    expect(linha.coberturaLegenda).toContain(`média de ${DIAS_DA_BASELINE}d`)
    expect(linha.coberturaLegenda).not.toContain('sem média medida')
  })
})

/**
 * ⭐⭐ O OUTRO LADO DA LEI: o item **ESTAVA na casa** e não foi usado — isso é uma medição de
 * ZERO, e é ela que faz a média existir. ⛔ E antes do 1º movimento do item o livro **não o
 * cobre**: ali não há zero a medir, há ausência (`SEM_LIVRO`).
 */
describe('⭐⭐ O LIVRO COMEÇA NO 1º MOVIMENTO DO ITEM', () => {
  it('⛔ dia ANTES do 1º movimento é SEM_LIVRO — nunca zero', async () => {
    const i = await item('item que nasceu ontem')
    await compra(i, 10, 5, 1)
    await baixa(i, 2, 1)
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    // a janela é de 7 dias e o item só existe desde ontem
    expect(l.barras.filter((b) => b.estado === 'SEM_LIVRO')).toHaveLength(5)
    // ⛔ nenhum deles pode ter virado 0 — zero afirmaria uma medição que não houve
    expect(l.barras.filter((b) => b.estado === 'SEM_LIVRO').every((b) => b.valor === null)).toBe(true)
    // ⭐ e com 1 amostra por dow a média segue "a apurar" — o mínimo do dono intacto
    expect(l.mediaPorDia.every((m) => m === null)).toBe(true)
  })

  it('⭐ dia em que o item ESTAVA na casa e não saiu entra como ZERO na média', async () => {
    const i = await item('item parado')
    await compra(i, 500, 10, DIAS_DA_BASELINE + 1)
    // consumo só nas terças (o resto da baseline é dia fechado com zero)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) {
      if (new Date(diasAtras(k)).getUTCDay() === 2) await baixa(i, 7, k)
    }
    await porNaLista({ companyId, lista: 'CAROS', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    // ⭐ TODO dow tem média: os 6 dias sem consumo valem ZERO, que é dado
    expect(l.mediaPorDia.filter((m) => m == null)).toEqual([])
    const terca = l.mediaPorDia[segPrimeiro(2)]
    expect(terca).toBeCloseTo(7, 2)
    // e os outros dows são zero MEDIDO, nunca null
    expect(l.mediaPorDia.filter((m, idx) => idx !== segPrimeiro(2)).every((m) => m === 0)).toBe(true)
  })
})

/**
 * ⭐⭐⭐ A PENDÊNCIA DO LIVRO — contra banco (17/10/2026).
 *
 * ⚠️⚠️ **A FONTE DA PENDÊNCIA FOI MEDIDA, e o brief precisou de correção.** Ele apontava a fila
 * de CONFERÊNCIA; medido, separação/devolução/correção do gerente são datadas com `now()` e
 * **não mudam dia passado**. A única coisa que escreve consumo retroativo é a **baixa da venda**.
 *
 * ⛔⛔ E a trava **(c)** é o que salva o item do sprint: o coxão é consumido por SEPARAÇÃO, nunca
 * por venda — marcá-lo "a apurar" por causa de um relatório de venda parado seria alarme falso
 * exatamente no item que motivou a lei.
 */
describe('⭐⭐⭐ "A APURAR" SÓ COM PENDÊNCIA MEDIDA', () => {
  /** o relatório do dia entrou (`stock_venda_import`) — é a EVIDÊNCIA de que houve venda */
  async function importDoDia(hasAtras: number) {
    await prisma.stockVendaImport.create({
      data: {
        companyId,
        data: new Date(`${iso(new Date(diasAtras(hasAtras)))}T15:00:00Z`),
        totalLinhas: 10,
        totalUnidades: 50,
        status: 'SUCCESS',
      },
    })
  }

  async function separacao(itemId: string, qtd: number, hasAtras: number) {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -qtd, custoUnitario: 30,
      origem: 'MANUAL', dataMovimento: new Date(diasAtras(hasAtras)),
    })
  }

  it('⭐ relatório entrou e a BAIXA não rodou → aquele dia é PENDENTE pro item de VENDA', async () => {
    const i = await item('porçao queijo 135 grama', 'UN')
    await compra(i, 500, 4, DIAS_DA_BASELINE + 1)
    // o livro cobre a baseline inteira, com baixa em todos os dias MENOS o de 3 dias atrás
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) if (k !== 3) await baixa(i, 5, k, 4)
    // ⭐ e o relatório DAQUELE dia entrou: a venda existiu, a baixa não rodou
    await importDoDia(3)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.porcoes[0]
    const pendente = l.barras.filter((b) => b.estado === 'PENDENTE')
    expect(pendente).toHaveLength(1)
    expect(pendente[0].dia).toBe(iso(new Date(diasAtras(3))))
    // ⛔ "a apurar" é null — nunca zero, porque o número AINDA VAI MUDAR
    expect(pendente[0].valor).toBeNull()
    // ⭐ UM selo no herói
    expect(l.temDiaAApurar).toBe(true)
    // ⛔ e o dia pendente NÃO entra na média: o dow dele tem 1 amostra a menos
    expect(l.mediaPorDia[segPrimeiro(new Date(diasAtras(3)).getUTCDay())]).toBeCloseTo(5, 2)
  })

  it('⛔⛔ a trava (c): o COXÃO não é alcançado pela venda → o mesmo dia é ZERO, não "a apurar"', async () => {
    const coxao = await item('Coxão Mole')
    await compra(coxao, 300, 30, DIAS_DA_BASELINE + 1)
    await separacao(coxao, 27.9, 6)
    await separacao(coxao, 19.44, 5)
    await separacao(coxao, 8.64, 4)
    // ⭐ o MESMO relatório de venda parado — e ele não tem nada a ver com este item
    await importDoDia(3)
    await porNaLista({ companyId, lista: 'CAROS', itemId: coxao }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.caros[0]
    expect(l.barras.filter((b) => b.estado === 'PENDENTE')).toEqual([])
    expect(l.temDiaAApurar).toBe(false)
    const dia3 = l.barras.find((b) => b.dia === iso(new Date(diasAtras(3))))
    expect(dia3?.estado).toBe('FECHADO')
    expect(dia3?.valor).toBe(0)
  })

  it('⛔ dia SEM relatório de venda nenhum é ZERO — ausência de evidência não é pendência', async () => {
    // ⚠️ é o dia em que a loja não abriu: chamá-lo de "a apurar" inventaria uma dúvida
    const i = await item('porçao calabresa', 'UN')
    await compra(i, 200, 3, DIAS_DA_BASELINE + 1)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) if (k !== 3) await baixa(i, 4, k, 3)
    // ⛔ nenhum `stock_venda_import` criado
    await porNaLista({ companyId, lista: 'PORCOES', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.porcoes[0]
    expect(l.barras.filter((b) => b.estado === 'PENDENTE')).toEqual([])
    expect(l.barras.find((b) => b.dia === iso(new Date(diasAtras(3))))?.valor).toBe(0)
    expect(l.temDiaAApurar).toBe(false)
  })

  it('⭐⭐ pendência SÓ no período ANTERIOR: o selo ACENDE, porque o Δ% compara os dois lados', async () => {
    /**
     * ⚠️⚠️ **ESTE CASO NASCEU DE UM VERDE DE GRAÇA (REGRA 11).** Repondo o defeito — o selo
     * olhando SÓ `diasDoPeriodo` — a suíte ficou **VERDE**, porque todos os cenários punham a
     * pendência DENTRO da janela atual, e ali o 1º termo do `||` já resolvia. O 2º termo nunca
     * era executado.
     *
     * ⭐ O que ISOLA é a pendência **fora** da janela atual e **dentro** da anterior: o número
     * do herói não muda, mas o **Δ%** muda — ele compara com um período que tem dia a apurar.
     * ***Selo que fala de um lado só mede meia conta.***
     */
    const i = await item('porçao bacon', 'UN')
    await compra(i, 600, 6, DIAS_DA_BASELINE + 1)
    // o livro cobre a baseline inteira MENOS o dia de 9 dias atrás — que cai no período ANTERIOR
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) if (k !== 9) await baixa(i, 5, k, 6)
    await importDoDia(9)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    const l = r.porcoes[0]
    // ⛔ a janela de HOJE está limpa — as barras não têm nenhum "—"
    expect(l.barras.filter((b) => b.estado === 'PENDENTE')).toEqual([])
    // ⭐ e o selo acende assim mesmo: o OUTRO lado da comparação tem dia a apurar
    expect(l.temDiaAApurar).toBe(true)
  })

  it('⛔ relatório entrou E a baixa rodou → nada pendente (o estado de prod hoje)', async () => {
    const i = await item('porçao frango', 'UN')
    await compra(i, 400, 5, DIAS_DA_BASELINE + 1)
    for (let k = 1; k <= DIAS_DA_BASELINE; k++) await baixa(i, 6, k, 5)
    await importDoDia(3)
    await porNaLista({ companyId, lista: 'PORCOES', itemId: i }, prisma)

    const r = await lerConsumoECompras({ companyId, empresa: 'Caçula Mix', periodo: 'SEMANA', agora: AGORA }, prisma)
    expect(r.porcoes[0].temDiaAApurar).toBe(false)
  })
})
