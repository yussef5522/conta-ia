/**
 * ⛔⛔⛔ A MEDIANA NO ENCAIXE — o teste que prova QUEM CHAMA, não a função (03/10/2026).
 *
 * ⚠️⚠️ **REGRA 11 ME PEGOU NO MESMO LUGAR DUAS VEZES EM DOIS DIAS.** O pin do par
 * (`pin-do-par-beef.test.ts`) chama `medianaDosRendimentos(XIS_5)` **direto** — então eu podia
 * repor a MÉDIA dentro de `rendimentoMedidoDeFichas` e os 13 testes seguiam **verdes**. É
 * exatamente o que aconteceu com o denominador do M2 em 02/10: *guard que testa a função não
 * prova o encaixe de quem a chama*.
 *
 * ⭐ Este arquivo grava as **5 conclusões REAIS** do `beef de xis` no banco e pergunta pro
 * caminho de verdade (`rendimentoMedidoDaFicha`) qual tendência central ele devolve.
 *
 * ```
 * 1,0400 · 1,0598 · 1,2532 · 1,8803 · 2,1411   →  MÉDIA 1,4749  ·  MEDIANA 1,2532
 * ```
 *
 * Com a média, uma ordem de **10** propõe material pra **6,78** — o caso que o dono reportou.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { rendimentoMedioDaFicha } from '../conclusao'
import { criarFicha } from '../fichas'
import { escalaParaSaida, reguaDoRendimento } from '../previsao-rendimento'

const CNPJ = '78787878000178'
let companyId = ''
let fichaId = ''
let loteBase = 1

/** os 5 rendimentos REAIS dos últimos lotes do `beef de xis`, medidos em prod em 03/10 */
const XIS_5 = [1.0400, 1.0598, 1.2532, 1.8803, 2.1411]

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'MEDIANA ENCAIXE' } })
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
      loteBase: 1,
      unidadeLoteBase: 'UN',
      componentes: [{ itemId: insumo.id, qtdPlanejada: 0.091, unidade: 'KG' }],
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

describe('⛔⛔⛔ o CAMINHO REAL devolve a MEDIANA, não a média', () => {
  it('⭐ rendimentoMedioDaFicha → 1,2532 (mediana), nunca 1,4749 (média)', async () => {
    const r = await rendimentoMedioDaFicha(companyId, fichaId, prisma)
    expect(r).toBe(1.2532)
    // ⛔ o contrafactual: a média dos MESMOS 5 lotes
    const media = XIS_5.reduce((s, x) => s + x, 0) / XIS_5.length
    expect(media).toBeCloseTo(1.4749, 4)
    expect(r).not.toBeCloseTo(media, 3)
  })

  it('⛔⛔ e a ORDEM de 10 propõe a dose da ficha — 0,910 de acém', async () => {
    /**
     * ⭐ O caminho inteiro, como a tela faz: lê o rendimento do banco → monta a régua →
     * converte o pedido em escala. É aqui que o defeito do dono aparecia (0,617).
     */
    const medido = await rendimentoMedioDaFicha(companyId, fichaId, prisma)
    const rend = { teorico: loteBase, medido, lotes: XIS_5.length }
    const regua = reguaDoRendimento(rend)

    // ⭐ a mediana (125%) DISCORDA da ficha → a régua volta pro declarado
    expect(regua.discordante).toBe(true)
    expect(regua.valor).toBe(1)

    const escala = escalaParaSaida(10, rend)!
    expect(escala).toBe(10)
    expect(escala * 0.091).toBeCloseTo(0.910, 6)

    // ⛔ e o que acontecia antes: com a MÉDIA, 10 ÷ 1,4749 = 6,78 → 0,617
    expect((10 / 1.4749) * 0.091).toBeCloseTo(0.617, 3)
  })

  it('⚠️ lote ESTORNADO continua fora da conta (a trava de 19/09 sobrevive à mediana)', async () => {
    /**
     * ⛔ A mediana trocou a fórmula, não o universo: conclusão estornada nunca entrou e não
     * pode passar a entrar — foi o rendimento podre de 2.858 da maionese que criou essa trava.
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
  })
})
