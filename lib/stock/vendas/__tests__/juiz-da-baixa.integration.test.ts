/**
 * ⛔⛔⛔ M1 — A BAIXA GRAVADA BATE COM O MOTOR (item 2a, 02/10/2026).
 *
 * **A ordem do dono:** *"pra CADA dia de baixas, Σ(o que o motor diz que deveria sair) ==
 * Σ(o que o ledger escreveu), por item, à grama; divergência = VERMELHO com o nome do fluxo
 * que desviou."*
 *
 * ⭐⭐ E o que este arquivo prova — a parte que separa um invariante útil de um alarme morto —
 * é a **DISCIPLINA DE TRÊS SAÍDAS**: divergência com a receita alterada depois é AVISO
 * (esperado, decisão do dono reprocessar); divergência com a receita INTOCADA é ERRO (alguém
 * baixou fora da porta). Sem isso, os dias do Combo v2 gritariam toda noite pra sempre, e
 * *alarme falso repetido é como um alarme morre*.
 *
 * ⚠️ Roda o caminho que ESCREVE (`processarVendas`), nunca um fixture montado à mão — era
 * exatamente essa diferença que escondeu o guard da sanidade na porta errada (11/09).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { processarVendas } from '../baixa-venda'
import { checkBaixaInvariants } from '../juiz-da-baixa'
import { criarFicha } from '../../producao/fichas'

const CNPJ = '74747474000174'
const DATA = '2026-09-20'
let companyId = ''
let beefId = ''
let paoId = ''
let fichaId = ''

const html = (linhas: [string, number][]) =>
  `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>${linhas
    .map(([p, q]) => `<tr><td>${p}</td><td>${q}</td><td>R$ 0,00</td><td>R$ 0,00</td></tr>`)
    .join('')}</table></body></html>`

const mOf = async (c: string) =>
  (await checkBaixaInvariants(prisma, new Date(`${DATA}T23:00:00Z`))).filter(
    (f) => f.invariante === 'M1' && f.companyId === c,
  )

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'JUIZ DA BAIXA' } })
  companyId = c.id

  const mk = async (nome: string, custo: number, qtd: number) => {
    const it = await prisma.stockItem.create({
      data: { companyId, nome, unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
    })
    await prisma.stockMovement.create({
      data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' },
    })
    return it.id
  }
  beefId = await mk('beef de xis', 3.5, 500)
  paoId = await mk('PAO DE XIS', 1.2, 500)

  // a ficha do xis: 1 beef + 1 pão, pela porta da casa (versiona de verdade)
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: 'XIS COMPLETO',
      unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1,
      unidadeLoteBase: 'UN',
      componentes: [
        { itemId: beefId, qtdPlanejada: 1, unidade: 'UN' },
        { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' },
      ],
      // ⭐ ficha e vínculo na MESMA transação (a trava de 01/09 — 3 fichas nasceram órfãs)
      mapearNomeSuitable: 'XIS COMPLETO',
    },
    prisma,
  )
  fichaId = f.fichaId

  // ⭐ a baixa REAL do dia: 10 xis → 10 beef + 10 pão
  await processarVendas(companyId, DATA, html([['XIS COMPLETO', 10]]), 'u', prisma)
})

afterEach(async () => {
  /**
   * ⚠️⚠️ APAGA AS TABELAS `stock_*` EXPLICITAMENTE — `company.deleteMany` NÃO cascateia aqui.
   * O isolamento do módulo proíbe `@relation` às tabelas fechadas (o `companyId` é VALOR
   * indexado), então não existe cascade. A 1ª versão deste arquivo só apagava a empresa e
   * deixou **32 ordens órfãs no dev.db** — e como `checkProducaoInvariants` varre o banco
   * INTEIRO, o golden da produção (que não filtra empresa) ficou vermelho por sujeira minha.
   * É a mesma classe do `snapshotClosedModules` global (23/08) e do CNPJ colidindo (13/09):
   * teste que não limpa o que cria envenena o vizinho.
   */
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap', 'stockVendaComplementoMap', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ dia baixado pela porta: o M1 CALA', () => {
  it('motor == ledger, por item, à grama', async () => {
    const baixas = await prisma.stockMovement.findMany({
      where: { companyId, tipo: 'BAIXA_VENDA' },
      select: { itemId: true, quantidade: true },
    })
    expect(baixas).toHaveLength(2)
    expect(baixas.every((b) => Math.abs(b.quantidade) === 10)).toBe(true)
    expect(await mOf(companyId)).toEqual([])
  })
})

describe('⛔⛔⛔ ledger mexido por fora: o M1 ACUSA, nomeando o fluxo e o item', () => {
  it('⭐ baixa a MENOS no ledger → ERRO dizendo que falta', async () => {
    /**
     * A cena é "alguém gravou por fora da porta": estornamos uma das duas baixas e o ledger
     * passa a ter 10 pães e ZERO beef, enquanto a explosão da ficha manda os dois.
     * ⚠️ Estorno é o jeito HONESTO de mexer (o ledger é imutável) — e é exatamente o estado
     * que um reprocesso pela metade deixaria.
     */
    const beefBaixa = await prisma.stockMovement.findFirst({
      where: { companyId, tipo: 'BAIXA_VENDA', itemId: beefId },
      select: { id: true, quantidade: true, custoUnitario: true, custoTotal: true, receiptId: true },
    })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: beefId, tipo: 'ESTORNO',
        quantidade: -beefBaixa!.quantidade, custoUnitario: beefBaixa!.custoUnitario,
        custoTotal: -beefBaixa!.custoTotal, receiptId: beefBaixa!.receiptId,
        estornoDeId: beefBaixa!.id, origem: 'MANUAL',
      },
    })

    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBeUndefined() // ⛔ ERRO (default), não aviso
    expect(m[0].detalhe).toContain('produtos')
    expect(m[0].detalhe).toContain(DATA)
    expect(m[0].detalhe).toContain('beef de xis')
    // ⭐ e DIZ que não há movimento nenhum — classe diferente de "diverge em 2 gramas"
    expect(m[0].detalhe).toContain('NÃO têm movimento nenhum')
  })

  it('⭐ baixa a MAIS no ledger → ERRO dizendo que sobra', async () => {
    const qualquer = await prisma.stockMovement.findFirst({
      where: { companyId, tipo: 'BAIXA_VENDA', itemId: paoId },
      select: { receiptId: true },
    })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: paoId, tipo: 'BAIXA_VENDA',
        quantidade: -4, custoUnitario: 1.2, custoTotal: -4.8,
        receiptId: qualquer!.receiptId, origem: 'MANUAL',
      },
    })
    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].detalhe).toContain('PAO DE XIS')
    expect(m[0].detalhe).toContain('sobra')
  })

  it('⛔⛔ À GRAMA: uma divergência de 10 g acusa — a tolerância é ruído, não folga', async () => {
    /**
     * ⚠️⚠️ REGRA 11 ME CORRIGIU AQUI: os dois testes acima divergem em 10 e 4 UNIDADES, então
     * eu podia afrouxar a tolerância pra **1 unidade inteira** e eles seguiam verdes — o guard
     * não protegia o *"à grama"* que o dono pediu por escrito.
     *
     * ⭐ Este caso isola a régua: 0,01 de diferença (10 gramas num item em KG) tem que
     * ACENDER. É a escala em que o resíduo de separação apareceu em 09/09, e é a escala em que
     * uma dose torta de ficha se esconde por meses.
     */
    const b = await prisma.stockMovement.findFirst({
      where: { companyId, tipo: 'BAIXA_VENDA', itemId: beefId },
      select: { receiptId: true },
    })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: beefId, tipo: 'BAIXA_VENDA',
        quantidade: -0.01, custoUnitario: 3.5, custoTotal: -0.04,
        receiptId: b!.receiptId, origem: 'MANUAL',
      },
    })
    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBeUndefined() // ⛔ ERRO, mesmo sendo 10 gramas
    expect(m[0].detalhe).toContain('beef de xis')
    expect(m[0].detalhe).toContain('0.01')
  })
})

describe('⭐⭐ A TERCEIRA SAÍDA — a receita mudou DEPOIS da baixa', () => {
  it('⛔⛔ divergência com ficha nova = AVISO, nunca erro (era o caso do Combo v3)', async () => {
    /**
     * ⚠️⚠️ ESTE É O TESTE QUE IMPEDE O JUIZ DE NASCER MENTINDO. Em 02/10 a ficha do Combo
     * Caçula virou v3 (sem a Coca 2L embutida) e os dias de 20/09 e 01/10 seguem gravados
     * com a v2 — um juiz de duas saídas acusaria os dois **toda noite, pra sempre**.
     *
     * ⭐ A pergunta só é respondível porque a porta devolve o RASTRO (`viaFichas`): o juiz
     * olha se **ESTA** ficha ganhou versão depois da baixa, não se "alguma ficha mudou".
     */
    const { atualizarFicha } = await import('../../producao/fichas')
    await atualizarFicha(
      companyId,
      fichaId,
      { componentes: [{ itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }] }, // tirou o beef, como o Combo tirou a Coca
      prisma,
    )

    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBe('aviso') // ⭐ NÃO deixa o selo vermelho
    expect(m[0].detalhe).toContain('a receita mudou depois desta baixa')
    expect(m[0].detalhe).toContain('decisão do dono')
  })

  it('⭐⭐ NOME DO PDV mapeado DEPOIS também é AVISO — o caso real dos complementos de 11/09', async () => {
    /**
     * ⚠️⚠️ **ESTE TESTE NASCEU DE UM DEFEITO MEU QUE SÓ A PROVA EM PROD PEGOU.** A 1ª versão
     * do M1 olhava só a FICHA, e o juiz acusou **complementos de 11/09** como ERRO:
     * *"COCA COLA LATA 350ML — motor 15 × ledger 0"*. Não havia ficha nenhuma mudada: aqueles
     * **nomes do PDV foram mapeados em 14/09**, depois da baixa. Na época eram pendentes e
     * não baixaram nada; hoje o mapa existe e o motor manda baixar.
     *
     * ⭐ A cena aqui é a mesma: um nome que o dia TINHA e que só ganhou destino depois.
     */
    const novoItem = await prisma.stockItem.create({
      data: { companyId, nome: 'COCA COLA LATA 350ML', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
    })
    await prisma.stockMovement.create({
      data: { companyId, itemId: novoItem.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 2.9, custoTotal: 290, origem: 'SEFAZ' },
    })
    // a linha do dia existia (entrou no import como PENDENTE) — acrescentamos e mapeamos AGORA
    const imp = await prisma.stockVendaImport.findFirstOrThrow({ where: { companyId }, select: { id: true, data: true } })
    await prisma.stockVendaLinha.create({
      data: { companyId, importId: imp.id, data: imp.data, nomeSuitable: 'COCA COLA LATA', quantidade: 15, valorTotal: 90 },
    })
    const { upsertVendaMap } = await import('../venda-map')
    await upsertVendaMap(companyId, 'COCA COLA LATA', { tipo: 'REVENDA', itemId: novoItem.id }, 'u', prisma)

    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBe('aviso') // ⭐ NÃO é erro: o dono mapeou um nome, não baixou por fora
    expect(m[0].detalhe).toContain('mapeados depois')
    expect(m[0].detalhe).toContain('COCA COLA LATA')
  })

  it('⭐ e a versão nova de OUTRA ficha NÃO compra o perdão', async () => {
    /**
     * ⛔ O contrafactual que separa "rastro" de "alguma coisa mudou": se o juiz olhasse a
     * empresa inteira, editar qualquer receita absolveria a divergência de todos os dias.
     */
    const outra = await criarFicha(
      {
        companyId,
        nomeProduzido: 'OUTRA COISA',
        unidadeProduzido: 'UN',
        tipoProduto: 'PRODUTO_FINAL',
        loteBase: 1,
        unidadeLoteBase: 'UN',
        componentes: [{ itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }],
      },
      prisma,
    )
    await atualizarFichaHelper(companyId, outra.fichaId, paoId)

    // e o ledger do xis mexido por fora
    const b = await prisma.stockMovement.findFirst({
      where: { companyId, tipo: 'BAIXA_VENDA', itemId: beefId },
      select: { id: true, quantidade: true, custoUnitario: true, custoTotal: true, receiptId: true },
    })
    await prisma.stockMovement.create({
      data: {
        companyId, itemId: beefId, tipo: 'ESTORNO',
        quantidade: -b!.quantidade, custoUnitario: b!.custoUnitario, custoTotal: -b!.custoTotal,
        receiptId: b!.receiptId, estornoDeId: b!.id, origem: 'MANUAL',
      },
    })

    const m = await mOf(companyId)
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBeUndefined() // ⛔ segue ERRO: a ficha DO XIS não mudou
  })
})

async function atualizarFichaHelper(companyId: string, fichaId: string, itemId: string) {
  const { atualizarFicha } = await import('../../producao/fichas')
  await atualizarFicha(companyId, fichaId, { componentes: [{ itemId, qtdPlanejada: 2, unidade: 'UN' }] }, prisma)
}
