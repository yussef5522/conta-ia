/**
 * ⭐⭐ 08/11/2026 — A MAÇANETA DO CONFLITO: o comparador e o gesto de escolher, EXECUTADOS.
 *
 * O caso real (Caçula): `XIS COMPLETO` e `XIS - COMPLETO` já apontavam pra duas fichas ATIVAS
 * diferentes, e `Xis Completo` ficava CONFLITO. O "escolher →" abria a central geral — porta
 * sem nada atrás. Aqui roda o caminho real: a ROTA (pela mesma URL que o componente monta),
 * a porta `conflito-de-grafia`, e depois o plano/detalhe/revisão (o juiz) sem o conflito.
 * Fixtures com campo preenchido: consumidor de fora (base do tamanho, outra grafia) existe.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { montarPlanoDeLinhas } from '../baixa-venda'
import { lerDetalheDoDia } from '../detalhe-do-dia'
import { montarRevisaoDeLinhas } from '../revisao-do-import'
import { lerComparadorDoConflito, escolherFichaDoConflito, ConflitoDeGrafiaError } from '../conflito-de-grafia'
import { urlDoConflito } from '@/components/estoque/comparador-de-conflito'

const sessao = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/stock/require-stock', () => ({
  guardStock: async () => ({ user: { sub: sessao.userId, name: 'Dono do teste' } }),
}))
// ⚠️ importada DEPOIS do mock (o vi.mock é içado, mas a leitura fica explícita)
import { GET, POST } from '@/app/api/empresas/[id]/estoque/vendas/conflito/route'
// ⭐ 09/11 — a rota que o EDITOR DE FICHA EXISTENTE chama ao salvar (a porta do editar)
import { PATCH as salvarFicha } from '@/app/api/empresas/[id]/estoque/fichas/[fichaId]/route'
import { getFicha } from '@/lib/stock/producao/fichas'

/** ⚠️ CNPJ exclusivo — 0 ocorrências no repo antes deste arquivo */
const CNPJ = '08120812000108'
const EMAIL = 'macaneta-do-conflito@teste.local'
/** ⚠️ dia RELATIVO a hoje — as "vendas 30 dias" do comparador não viram bomba de calendário */
const DIA = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
let companyId = ''
const f: Record<string, string> = {}
const item: Record<string, string> = {}

const LINHAS = [
  { produto: 'XIS COMPLETO', quantidade: 5, valorTotal: 250 },
  { produto: 'XIS - COMPLETO', quantidade: 3, valorTotal: 150 },
  { produto: 'Xis Completo', quantidade: 2, valorTotal: 100 },
  { produto: 'PIZZA GRANDE 35CM', quantidade: 4, valorTotal: 300 },
  { produto: 'Pizza Grande (35cm)', quantidade: 1, valorTotal: 75 },
  { produto: 'pizza grande 35cm', quantidade: 2, valorTotal: 150 },
  { produto: 'LASANHA DE CARNE', quantidade: 1, valorTotal: 20 },
]

async function fichaDe(nome: string, insumo: string, qtd = 1) {
  return (await criarFicha({
    companyId, nomeProduzido: nome, unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
    loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: insumo, qtdPlanejada: qtd, unidade: 'UN' }],
  }, prisma)).fichaId
}

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://teste.local${url}`, init)
const ctx = () => ({ params: Promise.resolve({ id: companyId }) })

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: EMAIL } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'MACANETA DO CONFLITO' } })).id
  sessao.userId = (await prisma.user.create({ data: { email: EMAIL, name: 'Dono do teste', password: 'x' } })).id
  const insumo = (await prisma.stockItem.create({
    data: { companyId, nome: 'PAO DE XIS', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })).id
  item.pao = insumo
  // ⭐ 09/11 — custo REAL (derivado do movimento, como em prod): pão R$ 1,237/UN, bacon R$ 41,333/KG
  item.bacon = (await prisma.stockItem.create({
    data: { companyId, nome: 'BACON', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })).id
  await prisma.stockMovement.createMany({
    data: [
      { companyId, itemId: item.pao, tipo: 'ENTRADA_NF', quantidade: 1000, custoUnitario: 1.237, custoTotal: 1237, origem: 'MANUAL' },
      { companyId, itemId: item.bacon, tipo: 'ENTRADA_NF', quantidade: 30, custoUnitario: 41.333, custoTotal: 1239.99, origem: 'MANUAL' },
    ],
  })
  f.xisA = await fichaDe('XIS COMPLETO', insumo, 1)
  f.xisB = await fichaDe('XIS - COMPLETO', insumo, 2)
  f.lasanha = await fichaDe('LASANHA DE CARNE', insumo)
  f.pizzaA = await fichaDe('PIZZA GRANDE 35CM', insumo)
  f.pizzaB = await fichaDe('Pizza Grande (35cm)', insumo)
  await prisma.stockVendaProdutoMap.createMany({
    data: [
      { companyId, nomeSuitable: 'XIS COMPLETO', alvoTipo: 'FICHA', fichaId: f.xisA },
      { companyId, nomeSuitable: 'XIS - COMPLETO', alvoTipo: 'FICHA', fichaId: f.xisB },
      { companyId, nomeSuitable: 'LASANHA DE CARNE', alvoTipo: 'FICHA', fichaId: f.lasanha },
      { companyId, nomeSuitable: 'PIZZA GRANDE 35CM', alvoTipo: 'FICHA', fichaId: f.pizzaA },
      { companyId, nomeSuitable: 'Pizza Grande (35cm)', alvoTipo: 'FICHA', fichaId: f.pizzaB },
      // ⛔ consumidor de FORA da pizza B: grafia de outro produto
      { companyId, nomeSuitable: 'PIZZA PROMO', alvoTipo: 'FICHA', fichaId: f.pizzaB },
    ],
  })
  // ⛔ e outro consumidor de fora: a pizza B é a base do tamanho GRANDE
  await prisma.stockBaseDoTamanho.create({ data: { companyId, tamanho: 'GRANDE', fichaId: f.pizzaB } })
  await prisma.stockVendaLinha.createMany({
    data: LINHAS.map((l) => ({
      companyId, importId: 'imp-1', data: new Date(`${DIA}T12:00:00.000Z`),
      nomeSuitable: l.produto, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: false,
    })),
  })
})

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.stockBaseDoTamanho.deleteMany({ where: { companyId } })
  await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
  await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: EMAIL } })
})

describe('o comparador (só leitura)', () => {
  it('⭐ FIAÇÃO: a URL que o componente monta chega na rota e traz as 2 fichas CERTAS', async () => {
    const r = await GET(req(urlDoConflito(companyId, 'Xis Completo')), ctx())
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.comparador.fichas.map((x: { fichaId: string }) => x.fichaId).sort()).toEqual([f.xisA, f.xisB].sort())
  })

  it('⭐ lado a lado: nome, ingredientes, custo, última edição, grafias, vendas recentes', async () => {
    const c = (await lerComparadorDoConflito(companyId, 'Xis Completo', prisma))!
    const a = c.fichas.find((x) => x.fichaId === f.xisA)!
    const b = c.fichas.find((x) => x.fichaId === f.xisB)!
    expect(a).toMatchObject({ nome: 'XIS COMPLETO', ativo: true, ingredientes: 1, grafias: ['XIS COMPLETO'], vendasRecentes: { unidades: 5, ultimoDia: DIA } })
    expect(b).toMatchObject({ nome: 'XIS - COMPLETO', grafias: ['XIS - COMPLETO'], vendasRecentes: { unidades: 3, ultimoDia: DIA } })
    expect(Number.isNaN(Date.parse(a.ultimaEdicao))).toBe(false)
    expect(a.custoLote === null || typeof a.custoLote === 'number').toBe(true)
  })

  it('⭐ sem consumidor de fora → inativar vem marcado; com consumidor → desmarcado E dito o quê', async () => {
    const xis = (await lerComparadorDoConflito(companyId, 'Xis Completo', prisma))!
    expect(xis.fichas.every((x) => x.inativarSemAviso)).toBe(true)
    const pz = (await lerComparadorDoConflito(companyId, 'pizza grande 35cm', prisma))!
    const b = pz.fichas.find((x) => x.fichaId === f.pizzaB)!
    expect(b.inativarSemAviso).toBe(false)
    expect(b.consumidores).toMatchObject({ outrasGrafias: ['PIZZA PROMO'], basesDeTamanho: ['GRANDE'] })
    expect(pz.fichas.find((x) => x.fichaId === f.pizzaA)!.inativarSemAviso).toBe(true)
  })

  it('⛔ nome que NÃO está em conflito → null (nunca um comparador vazio)', async () => {
    expect(await lerComparadorDoConflito(companyId, 'LASANHA DE CARNE', prisma)).toBeNull()
    expect(await lerComparadorDoConflito(companyId, 'lasanha de carne', prisma)).toBeNull()
  })
})

describe('⭐ 09/11 — o MIOLO com diff, e o EDITAR pela porta do editor existente', () => {
  it('⭐ o diff vem na rota: dose divergente do pão, e fecha com o custo do lote AO CENTAVO', async () => {
    const j = await (await GET(req(urlDoConflito(companyId, 'Xis Completo')), ctx())).json()
    const c = j.comparador
    expect(c.diff.linhas).toEqual([expect.objectContaining({ itemId: item.pao, tipo: 'DOSE', a: expect.objectContaining({ qtd: c.fichas[0].componentes[0].qtdPlanejada }) })])
    const lote = (id: string) => c.fichas.find((x: { fichaId: string }) => x.fichaId === id).custoLote
    expect(lote(f.xisA)).toBe((await getFicha(companyId, f.xisA, prisma))!.ficha.custoLote)
    expect(Math.round(c.diff.diferencaLote * 100)).toBe(Math.round((lote(c.diff.a.fichaId) - lote(c.diff.b.fichaId)) * 100))
    expect(Math.round((c.diff.linhas.reduce((s: number, l: { diferenca: number }) => s + l.diferenca, 0) + c.diff.arredondamento) * 100))
      .toBe(Math.round(c.diff.diferencaLote * 100))
    expect(c.diff.fecha).toBe(true)
  })

  it('⭐⭐ EDITAR: salvar pela rota do editor (PATCH) → o comparador RELIDO traz custo e diff novos', async () => {
    const custoAntes = (await getFicha(companyId, f.xisB, prisma))!.ficha.custoLote
    // o dono abre a XIS - COMPLETO, baixa o pão pra 1 e põe bacon 0,05 KG
    const r = await salvarFicha(req(`/api/empresas/${companyId}/estoque/fichas/${f.xisB}`, {
      method: 'PATCH', body: JSON.stringify({ componentes: [{ itemId: item.pao, qtdPlanejada: 1, unidade: 'UN' }, { itemId: item.bacon, qtdPlanejada: 0.05, unidade: 'KG' }] }),
    }), { params: Promise.resolve({ id: companyId, fichaId: f.xisB }) })
    expect(r.status).toBe(200)
    const c = (await (await GET(req(urlDoConflito(companyId, 'Xis Completo')), ctx())).json()).comparador
    const b = c.fichas.find((x: { fichaId: string }) => x.fichaId === f.xisB)
    expect(b.ingredientes).toBe(2)
    // o custo é o que a PORTA da ficha diz agora (nunca uma conta refeita aqui), e mudou
    expect(b.custoLote).toBe((await getFicha(companyId, f.xisB, prisma))!.ficha.custoLote)
    expect(b.custoLote).not.toBe(custoAntes)
    const bacon = c.diff.linhas.find((l: { itemId: string }) => l.itemId === item.bacon)
    expect(bacon.tipo).toBe(c.diff.b.fichaId === f.xisB ? 'SO_B' : 'SO_A')
    expect(c.diff.linhas.find((l: { itemId: string }) => l.itemId === item.pao).tipo).toBe('IGUAL')
    expect(c.diff.fecha).toBe(true)
  })
})

describe('o gesto do dono', () => {
  it('⛔ ficha de fora do conflito → recusa, e nada muda', async () => {
    await expect(escolherFichaDoConflito(companyId, 'Xis Completo', { fichaEscolhidaId: f.lasanha, inativar: [] }, sessao.userId, prisma))
      .rejects.toBeInstanceOf(ConflitoDeGrafiaError)
    expect((await lerComparadorDoConflito(companyId, 'Xis Completo', prisma))?.fichas).toHaveLength(2)
  })

  it('⛔ inativar perdedora que AINDA é usada, sem o "mesmo assim" → recusa ANTES de mover', async () => {
    await expect(escolherFichaDoConflito(companyId, 'pizza grande 35cm', { fichaEscolhidaId: f.pizzaA, inativar: [f.pizzaB] }, sessao.userId, prisma))
      .rejects.toThrow(/ainda é usada/)
    const m = await prisma.stockVendaProdutoMap.findFirst({ where: { companyId, nomeSuitable: 'Pizza Grande (35cm)' } })
    expect(m?.fichaId).toBe(f.pizzaB)
  })

  it('⭐⭐ escolher pela ROTA: as grafias irmãs convergem pra 1 fichaId, a perdedora inativa, auditado', async () => {
    const r = await POST(req(urlDoConflito(companyId), {
      method: 'POST', body: JSON.stringify({ nome: 'Xis Completo', fichaEscolhidaId: f.xisA, inativar: [f.xisB] }),
    }), ctx())
    expect(r.status).toBe(200)
    const mapa = await prisma.stockVendaProdutoMap.findMany({ where: { companyId, nomeSuitable: { in: ['XIS COMPLETO', 'XIS - COMPLETO'] } } })
    expect(new Set(mapa.map((m) => m.fichaId))).toEqual(new Set([f.xisA]))
    expect((await prisma.stockFicha.findUnique({ where: { id: f.xisB } }))?.ativo).toBe(false)
    const audit = await prisma.auditLog.findMany({ where: { companyId, action: 'RESOLVE_CONFLICT' } })
    expect(audit).toHaveLength(1)
    expect(audit[0].userId).toBe(sessao.userId)
    expect(JSON.parse(audit[0].metadata!)).toMatchObject({ fichaEscolhida: { id: f.xisA }, movidas: [{ nomeSuitable: 'XIS - COMPLETO', de: f.xisB }], inativadas: [f.xisB] })
  })

  it('⭐ DEPOIS: o conflito some do juiz — plano baixa, detalhe tem destino, revisão vincula', async () => {
    const p = await montarPlanoDeLinhas(companyId, DIA, LINHAS, null, prisma)
    expect(p.conflitos.map((c) => c.nome)).not.toContain('Xis Completo')
    expect(p.produtos.find((x) => x.nome === 'Xis Completo')?.fichaId).toBe(f.xisA)
    expect(p.produtos.find((x) => x.nome === 'XIS - COMPLETO')?.fichaId).toBe(f.xisA)
    const d = await lerDetalheDoDia(companyId, DIA, prisma)
    const xis = d.produtos.filter((x) => x.grafias.some((g) => g.toUpperCase().includes('XIS')))
    expect(xis).toHaveLength(1)
    expect(xis[0]).toMatchObject({ destino: 'BAIXOU_FICHA', unidades: 10 })
    expect(xis[0].grafias.sort()).toEqual(['XIS - COMPLETO', 'XIS COMPLETO', 'Xis Completo'])
    const rev = await montarRevisaoDeLinhas(companyId, DIA, 'PRODUTOS', LINHAS.map((l) => ({ nome: l.produto, ocorrencias: l.quantidade })), prisma)
    expect(rev.linhas.find((l) => l.nome === 'Xis Completo')).toMatchObject({ estado: 'VINCULADO', destinoId: f.xisA })
    expect(await lerComparadorDoConflito(companyId, 'Xis Completo', prisma)).toBeNull()
  })

  it('⭐ pizza SEM inativar: converge, a perdedora segue ativa e o consumidor de fora fica intocado', async () => {
    const r = await escolherFichaDoConflito(companyId, 'pizza grande 35cm', { fichaEscolhidaId: f.pizzaA, inativar: [] }, sessao.userId, prisma)
    expect(r.movidas).toEqual([{ nomeSuitable: 'Pizza Grande (35cm)', de: f.pizzaB }])
    expect((await prisma.stockFicha.findUnique({ where: { id: f.pizzaB } }))?.ativo).toBe(true)
    expect((await prisma.stockVendaProdutoMap.findFirst({ where: { companyId, nomeSuitable: 'PIZZA PROMO' } }))?.fichaId).toBe(f.pizzaB)
    const p = await montarPlanoDeLinhas(companyId, DIA, LINHAS, null, prisma)
    expect(p.conflitos).toEqual([])
  })

  it('⛔ repetir a escolha depois de resolvido → "não está mais em conflito" (não regrava nada)', async () => {
    await expect(escolherFichaDoConflito(companyId, 'Xis Completo', { fichaEscolhidaId: f.xisA, inativar: [] }, sessao.userId, prisma))
      .rejects.toThrow(/não está mais em conflito/)
  })
})
