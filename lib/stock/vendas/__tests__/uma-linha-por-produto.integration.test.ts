/**
 * ⭐⭐ 08/11/2026 — UMA LINHA POR LANCHE: a grafia canônica no plano de baixa, no detalhe do
 * dia e na revisão do import (a porta `resolvedorDeGrafia`).
 *
 * O caso real (Caçula, 10/10–06/11): o PDV mandou `Xis Completo` e `lasanha de carne` ao lado
 * de `XIS COMPLETO` / `LASANHA DE CARNE`. A régua exata pôs a grafia nova como "sem destino"
 * na MESMA lista em que a irmã aparecia "baixou ficha ✓", e ela NÃO BAIXOU estoque.
 * As fixtures são as grafias cruas reais; o contrafactual roda a régua exata contra o mesmo
 * banco. REGRA 3: executa o plano e a leitura, não procura string.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { montarPlanoDeLinhas, listProcessados } from '../baixa-venda'
import { lerDetalheDoDia } from '../detalhe-do-dia'
import { montarRevisaoDeLinhas } from '../revisao-do-import'
import { lerCentralDeImport } from '../central-de-import'
import { checkVendasInvariants } from '../vendas-invariants'

/** ⚠️ CNPJ exclusivo — 0 ocorrências no repo antes deste arquivo */
const CNPJ = '08110811000108'
const DIA = '2026-10-17'
let companyId = ''
const ficha: Record<string, string> = {}

/** as linhas do dia, grafia CRUA como o PDV mandou */
const LINHAS = [
  { produto: 'XIS COMPLETO', quantidade: 5, valorTotal: 250 },
  { produto: 'Xis Completo', quantidade: 2, valorTotal: 100.45 },
  { produto: 'LASANHA DE CARNE', quantidade: 3, valorTotal: 59.97 },
  { produto: 'lasanha de carne', quantidade: 1, valorTotal: 19.99 },
  // ⛔ o conflito real: as duas grafias mapeadas apontam pra fichas DIFERENTES
  { produto: 'PIZZA GRANDE 35CM', quantidade: 4, valorTotal: 300 },
  { produto: 'Pizza Grande (35cm)', quantidade: 1, valorTotal: 75 },
  { produto: 'pizza grande 35cm', quantidade: 2, valorTotal: 150 },
  // ⛔ typo continua separado
  { produto: 'XIS COMPLETOO', quantidade: 1, valorTotal: 50 },
]

async function fichaDe(nome: string, insumo: string) {
  const f = await criarFicha({
    companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
    loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo, qtdPlanejada: 1, unidade: 'UN' }],
  }, prisma)
  return f.fichaId
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'UMA LINHA POR PRODUTO' } })).id
  const insumo = (await prisma.stockItem.create({
    data: { companyId, nome: 'PAO DE XIS', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })).id
  ficha.xis = await fichaDe('XIS COMPLETO', insumo)
  ficha.lasanha = await fichaDe('LASANHA DE CARNE', insumo)
  ficha.pizzaA = await fichaDe('PIZZA GRANDE A', insumo)
  ficha.pizzaB = await fichaDe('PIZZA GRANDE B', insumo)
  // o mapa guarda a grafia CRUA (N:1). Só UMA grafia de cada lanche está mapeada.
  await prisma.stockVendaProdutoMap.createMany({
    data: [
      { companyId, nomeSuitable: 'XIS COMPLETO', alvoTipo: 'FICHA', fichaId: ficha.xis },
      { companyId, nomeSuitable: 'LASANHA DE CARNE', alvoTipo: 'FICHA', fichaId: ficha.lasanha },
      { companyId, nomeSuitable: 'PIZZA GRANDE 35CM', alvoTipo: 'FICHA', fichaId: ficha.pizzaA },
      { companyId, nomeSuitable: 'Pizza Grande (35cm)', alvoTipo: 'FICHA', fichaId: ficha.pizzaB },
    ],
  })
  await prisma.stockVendaLinha.createMany({
    data: LINHAS.map((l) => ({
      companyId, importId: 'imp-1', data: new Date(`${DIA}T12:00:00.000Z`),
      nomeSuitable: l.produto, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: false,
    })),
  })
})

afterAll(async () => {
  await prisma.stockVendaImport.deleteMany({ where: { companyId } })
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('o plano de baixa (o juiz E a baixa)', () => {
  it('⛔ CONTRAFACTUAL: pela string exata, «Xis Completo» e «lasanha de carne» não têm mapa', async () => {
    const exatos = new Set((await prisma.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } })).map((m) => m.nomeSuitable))
    expect(LINHAS.filter((l) => !exatos.has(l.produto)).map((l) => l.produto))
      .toEqual(['Xis Completo', 'lasanha de carne', 'pizza grande 35cm', 'XIS COMPLETOO'])
  })

  it('⭐ «Xis Completo» e «lasanha de carne» BAIXAM a ficha da irmã', async () => {
    const p = await montarPlanoDeLinhas(companyId, DIA, LINHAS, null, prisma)
    const xis = p.produtos.find((x) => x.nome === 'Xis Completo')
    expect(xis?.fichaId).toBe(ficha.xis)
    expect(xis?.viaGrafia).toBe('XIS COMPLETO')
    expect(xis?.baixa.map((b) => b.qtd)).toEqual([2])
    expect(p.produtos.find((x) => x.nome === 'lasanha de carne')?.fichaId).toBe(ficha.lasanha)
    // a baixa agregada do insumo soma as 4 grafias resolvidas (5+2+3+1), e NÃO o conflito
    expect(p.agregada.reduce((s, a) => s + a.qtd, 0)).toBe(11 + 4 + 1) // + as 2 pizzas EXATAS (4 e 1)
  })

  it('⛔⛔ CONFLITO: «pizza grande 35cm» não baixa, fica pendente E na lista de conflitos', async () => {
    const p = await montarPlanoDeLinhas(companyId, DIA, LINHAS, null, prisma)
    expect(p.produtos.map((x) => x.nome)).not.toContain('pizza grande 35cm')
    expect(p.pendentes.map((x) => x.nome)).toContain('pizza grande 35cm')
    expect(p.conflitos).toEqual([{ nome: 'pizza grande 35cm', quantidade: 2, candidatas: ['PIZZA GRANDE 35CM', 'Pizza Grande (35cm)'] }])
  })

  it('⛔ typo continua pendente, sem conflito', async () => {
    const p = await montarPlanoDeLinhas(companyId, DIA, LINHAS, null, prisma)
    expect(p.pendentes.map((x) => x.nome)).toContain('XIS COMPLETOO')
    expect(p.conflitos.map((c) => c.nome)).not.toContain('XIS COMPLETOO')
  })
})

describe('o detalhe do dia — uma linha por produto', () => {
  it('⭐ Xis Completo: 2 grafias → UMA linha, 7 un, baixou ficha', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    const xis = d.produtos.filter((p) => p.grafias.includes('XIS COMPLETO') || p.grafias.includes('Xis Completo'))
    expect(xis).toHaveLength(1)
    expect(xis[0]).toMatchObject({ nome: 'XIS COMPLETO', unidades: 7, destino: 'BAIXOU_FICHA' })
    expect(xis[0].grafias.sort()).toEqual(['XIS COMPLETO', 'Xis Completo'])
  })

  it('⭐ a lasanha minúscula idem: uma linha, 4 un', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    const l = d.produtos.filter((p) => p.grafias.some((g) => g.toUpperCase() === 'LASANHA DE CARNE'))
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ unidades: 4, destino: 'BAIXOU_FICHA' })
  })

  it('⛔⛔ o conflito é uma linha VISÍVEL com as candidatas, separada das pizzas que baixaram', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    const c = d.produtos.find((p) => p.destino === 'CONFLITO')
    expect(c).toMatchObject({ nome: 'pizza grande 35cm', unidades: 2 })
    expect(c?.candidatas).toEqual(['PIZZA GRANDE 35CM', 'Pizza Grande (35cm)'])
    // as duas grafias EXATAS seguem cada uma com a sua ficha — destinos diferentes não se juntam
    expect(d.produtos.filter((p) => p.destino === 'BAIXOU_FICHA' && /pizza/i.test(p.nome))).toHaveLength(2)
    expect(d.totais.semDestino, 'conflito e typo não têm destino').toBe(2)
  })

  it('⭐ INVARIANTE: juntar linhas não perde nem inventa unidade (Σ linhas == Σ do dia)', async () => {
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    expect(d.totais.bateComODia).toBe(true)
    expect(d.produtos.reduce((s, p) => s + p.unidades, 0)).toBe(LINHAS.reduce((s, l) => s + l.quantidade, 0))
  })
})

describe('a revisão do import', () => {
  const cruas = LINHAS.map((l) => ({ nome: l.produto, ocorrencias: l.quantidade }))

  it('⭐ PRODUTOS: «Xis Completo» VINCULADO à ficha da irmã, com o rastro', async () => {
    const r = await montarRevisaoDeLinhas(companyId, DIA, 'PRODUTOS', cruas, prisma)
    expect(r.linhas.find((l) => l.nome === 'Xis Completo')).toMatchObject({ estado: 'VINCULADO', destinoId: ficha.xis, viaGrafia: 'XIS COMPLETO' })
  })

  it('⛔⛔ PRODUTOS: o conflito fica SEM destino, mostra as candidatas e NÃO sugere uma delas', async () => {
    const r = await montarRevisaoDeLinhas(companyId, DIA, 'PRODUTOS', cruas, prisma)
    expect(r.linhas.find((l) => l.nome === 'pizza grande 35cm'))
      .toMatchObject({ estado: 'SEM_VINCULO', sugestao: null, conflito: ['PIZZA GRANDE 35CM', 'Pizza Grande (35cm)'] })
  })

  it('⛔ COMPLEMENTOS seguem pela string exata (lá a canônica é GRAVADA no import, 08/09)', async () => {
    await prisma.stockVendaComplementoMap.create({ data: { companyId, nomeSuitable: 'BACON', alvoTipo: 'FICHA', fichaId: ficha.xis } })
    try {
      const r = await montarRevisaoDeLinhas(companyId, DIA, 'COMPLEMENTOS', [{ nome: 'Bacon', ocorrencias: 1 }], prisma)
      expect(r.linhas[0].estado).toBe('SEM_VINCULO')
      expect(r.linhas[0].viaGrafia).toBeUndefined()
    } finally {
      await prisma.stockVendaComplementoMap.deleteMany({ where: { companyId } })
    }
  })
})

describe('⛔ os CONTADORES de "sem destino" falam a mesma língua da lista (porta única)', () => {
  /** o que a lista diz que não tem destino: o conflito e o typo — nunca as grafias resolvidas */
  const SEM = ['pizza grande 35cm', 'XIS COMPLETOO']

  it('central do mês: o dia conta 2 sem destino (a régua exata contava 4)', async () => {
    const c = await lerCentralDeImport(companyId, DIA.slice(0, 7), prisma)
    expect(c.dias.find((d) => d.dia === DIA)?.conferencia.semDestino).toBe(SEM.length)
  })

  it('histórico Processados: 2 pendentes no dia', async () => {
    const imp = await prisma.stockVendaImport.create({
      data: { id: 'imp-1', companyId, data: new Date(`${DIA}T12:00:00.000Z`), totalLinhas: LINHAS.length, totalUnidades: 19 },
    }).catch(() => prisma.stockVendaImport.findUniqueOrThrow({ where: { id: 'imp-1' } }))
    const dia = (await listProcessados(companyId, prisma)).find((d) => d.data === DIA)
    expect(imp.id).toBe('imp-1')
    expect(dia?.pendentes).toBe(SEM.length)
  })

  it('alarme V1 (sem destino há > 7 dias): só o conflito e o typo, nunca «Xis Completo»', async () => {
    const fails = (await checkVendasInvariants(prisma)).filter((f) => f.invariante === 'V1' && f.companyId === companyId)
    const nomes = fails.map((f) => SEM.find((n) => f.detalhe.includes(`"${n}"`))).filter(Boolean)
    expect(nomes.sort()).toEqual([...SEM].sort())
    expect(fails).toHaveLength(SEM.length)
  })
})
