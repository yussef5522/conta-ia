/**
 * ⭐⭐ UMA RÉGUA, DOIS LEITORES — o juiz M5 e a lista de pendentes falam da MESMA ficha (04/10/2026).
 *
 * ⚠️ **POR QUE ESTE ARQUIVO EXISTE:** a pergunta *"o lote desta ficha é comparável?"* nasceu
 * dentro do M5 e acabou de ganhar um SEGUNDO leitor (o assistente de conversão KG→UN). Duas
 * cópias do `unidadeLoteBase !== unidadeControle` divergiriam no primeiro caso de borda — e o
 * efeito seria o pior possível: **o dono varre a lista até 0 pendentes e o juiz continua
 * acusando**, ou a lista cala sobre uma ficha que o e-mail noturno denuncia. É a lição do B1 e
 * dos 7 detectores de par, aplicada a um `===`.
 *
 * ⛔ **E O GUARD EXECUTA OS DOIS** (REGRA 3): grep de `import` provaria só que o símbolo foi
 * mencionado. Aqui a mesma ficha é montada no banco e as duas perguntas são FEITAS — se as
 * respostas discordarem, vermelho.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkFantasmaInvariants } from '../../fantasma-invariants'
import { fichasParaConverter } from '../fichas-para-converter'
import { loteEhComparavel } from '../lote-comparavel'
import { criarFicha } from '../fichas'

const CNPJ = '71717171000252'
let companyId = ''

const M5 = async () =>
  (await checkFantasmaInvariants(prisma)).filter(
    (f) => f.invariante === 'M5' && f.companyId === companyId,
  )

/** Monta uma ficha de produção com o lote declarado na unidade que o teste pedir. */
async function fichaDeProducao(opts: {
  nome: string
  unidadeProduto: string
  unidadeLoteBase: string
  loteBase: number
  dose?: number
}) {
  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: `insumo ${opts.nome}`, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  await prisma.stockMovement.create({
    data: { companyId, itemId: insumo.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 33.95, custoTotal: 3395, origem: 'SEFAZ' },
  })
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: opts.nome,
      unidadeProduzido: opts.unidadeProduto,
      tipoProduto: 'INTERMEDIARIO',
      loteBase: opts.loteBase,
      unidadeLoteBase: opts.unidadeLoteBase,
      componentes: [{ itemId: insumo.id, qtdPlanejada: opts.dose ?? 0.18, unidade: 'KG' }],
    },
    prisma,
  )
  return f.fichaId
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'UMA REGUA LOTE' } })
  companyId = c.id
})

afterEach(async () => {
  // ⚠️ `stock_*` não cascateia (o isolamento proíbe @relation) — apaga explícito, senão
  // sobram fichas órfãs e o M5, que varre o banco INTEIRO, fica vermelho por sujeira nossa.
  for (const t of ['stockMovement', 'stockProductionOrder', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ o juiz e a lista NUNCA discordam sobre a mesma ficha', () => {
  it('⛔ lote em KG com produto em UN: o M5 ACUSA e a lista LISTA — os dois', async () => {
    // a `porcao coxao 80 grama` real: 1 receita = 1 KG, produto contado em UN
    const fichaId = await fichaDeProducao({
      nome: 'porcao coxao 80 grama', unidadeProduto: 'UN', unidadeLoteBase: 'KG', loteBase: 1,
    })

    const m5 = await M5()
    expect(m5).toHaveLength(1)
    expect(m5[0].detalhe).toContain('se CONTA em UN')

    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog.total).toBe(1)
    expect(prog.coerentes).toBe(0)
    expect(prog.pendentes.map((p) => p.fichaId)).toEqual([fichaId])
    expect(prog.pendentes[0]).toMatchObject({
      nomeProduto: 'porcao coxao 80 grama',
      unidadeProduto: 'UN',
      unidadeLoteBase: 'KG',
      loteBase: 1,
      dosePrincipal: 0.18,
    })
  })

  it('⭐ lote JÁ na unidade do produto: o M5 CALA e a lista conta como coerente — os dois', async () => {
    await fichaDeProducao({
      nome: 'porcao coxao convertida', unidadeProduto: 'UN', unidadeLoteBase: 'UN', loteBase: 1,
    })

    expect(await M5()).toEqual([])
    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog).toMatchObject({ total: 1, coerentes: 1 })
    expect(prog.pendentes).toEqual([])
  })

  it('⭐ a MAIONESE (lote em UN, produto em KG) também é pendente nos dois — a régua não tem lado', async () => {
    await fichaDeProducao({
      nome: 'MAIONESE', unidadeProduto: 'KG', unidadeLoteBase: 'UN', loteBase: 2.858, dose: 3,
    })

    expect(await M5()).toHaveLength(1)
    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog.pendentes).toHaveLength(1)
    expect(prog.pendentes[0]).toMatchObject({ unidadeLoteBase: 'UN', unidadeProduto: 'KG', loteBase: 2.858 })
  })

  it('⭐⭐ com fichas MISTAS, o Σ fecha: pendentes + coerentes == total, e o M5 acusa exatamente as pendentes', async () => {
    const a = await fichaDeProducao({ nome: 'pendente A', unidadeProduto: 'UN', unidadeLoteBase: 'KG', loteBase: 1 })
    const b = await fichaDeProducao({ nome: 'pendente B', unidadeProduto: 'UN', unidadeLoteBase: 'LT', loteBase: 1 })
    await fichaDeProducao({ nome: 'coerente C', unidadeProduto: 'UN', unidadeLoteBase: 'UN', loteBase: 1 })

    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog.total).toBe(3)
    expect(prog.coerentes).toBe(1)
    expect(prog.pendentes).toHaveLength(2)
    // ⭐ o invariante que vale: ninguém some no caminho
    expect(prog.pendentes.length + prog.coerentes).toBe(prog.total)
    // ⭐ e o juiz acusa exatamente as MESMAS duas
    expect(await M5()).toHaveLength(2)
    expect(new Set(prog.pendentes.map((p) => p.fichaId))).toEqual(new Set([a, b]))
  })

  /**
   * ⚠️ O invólucro de cardápio (PRODUTO_FINAL/SABOR) não tem "lote" — ele MONTA na venda. Os
   * dois leitores pulam pelo MESMO `comoConsome`; se um deles passasse a considerá-lo, a lista
   * ofereceria ao dono uma conversão que não significa nada (ou o juiz acusaria ~95 fichas de
   * cardápio toda noite, que é como um alarme morre).
   */
  it('⛔ invólucro de cardápio fica fora dos DOIS, mesmo com unidade divergente', async () => {
    const insumo = await prisma.stockItem.create({
      data: { companyId, nome: 'porção pronta', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
    })
    await criarFicha(
      {
        companyId,
        nomeProduzido: 'XIS COMPLETO',
        unidadeProduzido: 'UN',
        tipoProduto: 'PRODUTO_FINAL',
        loteBase: 1,
        unidadeLoteBase: 'KG', // divergente de propósito
        componentes: [{ itemId: insumo.id, qtdPlanejada: 1, unidade: 'UN' }],
      },
      prisma,
    )

    expect(await M5()).toEqual([])
    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog).toMatchObject({ total: 0, coerentes: 0 })
    expect(prog.pendentes).toEqual([])
  })
})

describe('a régua pura', () => {
  it('responde pela unidade do PRODUTO, nunca pelo tamanho do lote', () => {
    expect(loteEhComparavel('UN', 'UN')).toBe(true)
    expect(loteEhComparavel('KG', 'UN')).toBe(false)
    expect(loteEhComparavel('UN', 'KG')).toBe(false)
    expect(loteEhComparavel('LT', 'LT')).toBe(true)
  })
})
