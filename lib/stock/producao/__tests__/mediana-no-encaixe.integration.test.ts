/**
 * ⛔⛔⛔ O ENCAIXE REAL — o teste que prova QUEM CHAMA, não a função (03/10/2026).
 *
 * ⚠️⚠️ **REGRA 11 ME PEGOU NO MESMO LUGAR DUAS VEZES EM DOIS DIAS**, e é por isso que este
 * arquivo existe: o pin do par chama as funções **direto**, então eu podia mexer no caminho
 * real (`rendimentoMedidoDeFichas`) e os testes seguiam **verdes**. Foi exatamente o que
 * aconteceu com o denominador do M2 em 02/10: *guard que testa a função não prova o encaixe
 * de quem a chama*.
 *
 * ⭐⭐ **E O QUE ELE PROVA MUDOU NO MESMO DIA, com a decisão do dono.** De manhã ele provava
 * *"o caminho real devolve a MEDIANA, não a média"* — a 1ª cura, que afinava a estatística.
 * À tarde o dono tirou a estatística da conta: *"receita é lei, rendimento é só relatório"*.
 *
 * **Então ele passou a provar a coisa mais forte:** as 5 conclusões REAIS do `beef de xis`
 * gravadas no banco, o espelho lendo **1,2532** (a mediana), e a separação de 10 devolvendo
 * **0,910 de acém de qualquer jeito** — porque o espelho não tem como entrar na conta.
 *
 * ```
 * 1,0400 · 1,0598 · 1,2532 · 1,8803 · 2,1411   →  MÉDIA 1,4749  ·  MEDIANA 1,2532
 * ```
 * Com a média, uma ordem de **10** propunha material pra **6,78** — o caso que o dono reportou.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { rendimentoMedioDaFicha } from '../conclusao'
import { criarFicha } from '../fichas'
import { eficienciaMedia } from '../previsao-rendimento'
import { escalaDoPedido, insumoDoPedido } from '../escala-da-ordem'

const CNPJ = '78787878000178'
let companyId = ''
let fichaId = ''
const loteBase = 1

/** os 5 rendimentos REAIS dos últimos lotes do `beef de xis`, medidos em prod em 03/10 */
const XIS_5 = [1.0400, 1.0598, 1.2532, 1.8803, 2.1411]
const DOSE_ACEM = 0.091

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'ENCAIXE DA RECEITA' } })
  companyId = c.id

  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'Acém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 33.96, custoTotal: 16980, origem: 'SEFAZ' },
  })
  // ⭐ a ficha REAL: loteBase 1, dose por unidade
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: 'beef de xis',
      unidadeProduzido: 'UN',
      tipoProduto: 'INTERMEDIARIO',
      loteBase,
      unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo.id, qtdPlanejada: DOSE_ACEM, unidade: 'KG' }],
    },
    prisma,
  )
  fichaId = f.fichaId
  const ficha = await prisma.stockFicha.findUniqueOrThrow({
    where: { id: fichaId },
    select: { versaoAtual: true, itemProduzidoId: true },
  })

  // ⭐ os 5 lotes, em ordem cronológica (o mais recente por último)
  for (let i = 0; i < XIS_5.length; i++) {
    const ordem = await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId, versaoFicha: ficha.versaoAtual, itemProduzidoId: ficha.itemProduzidoId,
        escalaReceitas: 100, estado: 'CONCLUIDA',
        dataProducao: new Date(`2026-09-${String(20 + i).padStart(2, '0')}T15:00:00Z`),
      },
    })
    await prisma.stockProducaoConclusao.create({
      data: {
        companyId, ordemId: ordem.id,
        qtdGerada: Math.round(100 * XIS_5[i]), escalaConsumida: 100, rendimento: XIS_5[i],
        custoLoteReal: 309, custoUnitarioReal: 3,
        criadoEm: new Date(`2026-09-${String(20 + i).padStart(2, '0')}T18:00:00Z`),
      },
    })
  }
})

afterEach(async () => {
  for (const t of ['stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⛔⛔⛔ a SEPARAÇÃO é a receita, com o banco cheio de medição por baixo', () => {
  it('⭐⭐ o espelho lê 1,2532 do caminho REAL — e a ordem de 10 separa 0,910 do mesmo jeito', async () => {
    const medido = await rendimentoMedioDaFicha(companyId, fichaId, prisma)
    /** ⭐ mediana, não média — o caminho real devolve a tendência que não se move com o outlier */
    expect(medido).toBe(1.2532)
    const espelho = eficienciaMedia({ teorico: loteBase, medido, lotes: XIS_5.length })
    expect(espelho).toEqual({ pct: 1.2532, lotes: 5 })

    /**
     * ⛔⛔ **A PROVA DO SPRINT:** com 5 lotes gravados, uma média de 1,4749 e uma mediana de
     * 1,2532 no banco, a separação de 10 unidades é **0,910** — a dose da ficha × 10.
     * Nenhum desses números alcança a conta.
     */
    expect(escalaDoPedido({ pedido: 10, loteBase })).toBe(10)
    expect(insumoDoPedido({ pedido: 10, loteBase }, DOSE_ACEM)).toBeCloseTo(0.910, 6)

    // ⛔ os dois contrafactuais do mundo antigo, lado a lado
    const media = XIS_5.reduce((s, x) => s + x, 0) / XIS_5.length
    expect(media).toBeCloseTo(1.4749, 4)
    expect((10 / media) * DOSE_ACEM).toBeCloseTo(0.617, 3)        // o defeito que o dono viu
    expect((10 / medido!) * DOSE_ACEM).toBeCloseTo(0.726, 3)      // a minha 1ª cura, recusada
  })

  it('⚠️ lote ESTORNADO continua fora do espelho (a trava de 19/09 sobrevive)', async () => {
    /**
     * ⛔ A decisão de 03/10 tirou a medição da separação — ela **não** afrouxou a medição.
     * Conclusão estornada nunca entrou no espelho e não pode passar a entrar: foi o
     * rendimento podre de 2.858 da maionese que criou essa trava, e ela ainda guarda o
     * número que o dono LÊ na tela e o que o juiz P8 denuncia.
     */
    const conclusoes = await prisma.stockProducaoConclusao.findMany({
      where: { companyId }, select: { id: true }, orderBy: { criadoEm: 'desc' }, take: 2,
    })
    for (const c of conclusoes) {
      await prisma.stockConclusaoEstornada.create({
        data: { companyId, conclusaoId: c.id, motivo: 'teste' },
      })
    }
    // sobram 1,0400 · 1,0598 · 1,2532 → mediana 1,0598
    expect(await rendimentoMedioDaFicha(companyId, fichaId, prisma)).toBe(1.0598)
    // ⭐ e a separação, imperturbável
    expect(insumoDoPedido({ pedido: 10, loteBase }, DOSE_ACEM)).toBeCloseTo(0.910, 6)
  })
})
