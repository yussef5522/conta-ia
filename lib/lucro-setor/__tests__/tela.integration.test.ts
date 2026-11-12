/**
 * ⭐ LUCRO POR SETOR (Fatia 2) — AS CONTAS DA LEI v11 contra um DIA REAL do banco.
 *
 * O dia é o SÁBADO 08/11 real da SuitAPI (fixture com allowlist, sem dado de cliente), gravado
 * pela porta de sempre (`gravarPedido`) e deslocado +7 dias (15/11, também sábado) porque o laço só
 * vale a partir do corte dos complementos pela API (10/11). O sábado 08/11 entra como HISTÓRICO
 * com as linhas REAIS do XLS daquele dia (PIZZA GRANDE PRECINHO 102 un — dia de promo).
 *
 * ⛔ Os números do arquivo da lei são AMOSTRA (S12): aqui cada conta é conferida contra a PORTA
 * (custo pela `portaDeCusto`, contagens recontadas direto do fixture), nunca contra a amostra.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { upsertVendaMap } from '@/lib/stock/vendas/venda-map'
import { gravarPedido } from '@/lib/suit/sync'
import { linhasDaRegua, lerPedidosDoDia } from '@/lib/suit/materializar'
import type { PedidoCru } from '@/lib/suit/cliente-leitura'
import fixture from '@/lib/suit/__fixtures__/dia-2026-11-08.json'
import { lerTelaDoDia, pedidosDoItem, montarDoLaco, diasDaRegua, reguaDeUn, emPromo, type TelaDTO, type Historico } from '../tela'
import { eseConta, vereditoDoEse, quadrantes, medianaDaLei, lerPreco, ehNomeDePromo, gemeoDe, paineisDoDia } from '../estudo'
import { corpoDaCriacao, corpoDaEdicao, moverDose, custoAoVivo, recusa } from '../ficha-na-linha'
import { atualizarFicha } from '@/lib/stock/producao/fichas'

const CNPJ = '90909090000888'
const DIA = '2026-11-15' // o sábado 08/11 real, +7
const FECHADO = new Date('2026-11-16T12:00:00Z')
let companyId = ''
const ids: Record<string, string> = {}

/** desloca TODA data ISO do pedido em +7 dias (mantém o dia-da-semana e a hora) */
function maisSete<T>(v: T): T {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(Date.parse(`${v.slice(0, 10)}T00:00:00Z`) + 7 * 86400_000).toISOString().slice(0, 10)
    return (d + v.slice(10)) as T
  }
  if (Array.isArray(v)) return v.map(maisSete) as T
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maisSete(x)])) as T
  return v
}
const PEDIDOS = (fixture.pedidos as unknown as PedidoCru[]).map(maisSete)

/** recontagem INDEPENDENTE do fixture (não passa pela tela): un, R$ e sabores de um produto */
function recontar(nome: string) {
  let q = 0, cent = 0
  const sab = new Map<string, number>()
  for (const p of PEDIDOS) {
    if (p.status === 'abandoned') continue
    for (const i of p.items) {
      if (i.cancelled_at || i.name.replace(/\s+/g, ' ').trim() !== nome) continue
      q += Number(i.quantity)
      cent += Math.round(Number(i.price) * 100)
      for (const o of i.options ?? []) sab.set(o.name.replace(/\s+/g, ' ').trim(), (sab.get(o.name.replace(/\s+/g, ' ').trim()) ?? 0) + Number(o.quantity) * Number(i.quantity))
    }
  }
  return { q, cent, sab }
}

const item = async (nome: string, custo: number | null) => {
  const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  if (custo != null) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: custo, custoTotal: 100 * custo, origem: 'SEFAZ' } })
  return it.id
}
const ficha = (nomeProduzido: string, tipoProduto: 'PRODUTO_FINAL' | 'SABOR', componentes: { itemId: string; qtdPlanejada: number }[], extra: { mapearNomeSuitable?: string[]; mapearComplemento?: string[] } = {}) =>
  criarFicha({ companyId, nomeProduzido, unidadeProduzido: 'UN', tipoProduto, loteBase: 1, unidadeLoteBase: 'UN', componentes: componentes.map((x) => ({ ...x, unidade: 'UN' })), ...extra }, prisma)

/** uma linha de produto do histórico (import do dia, como o XLS/API grava: T15:00Z) */
async function historico(dia: string, linhas: [string, number, number][]) {
  const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${dia}T15:00:00.000Z`), totalLinhas: linhas.length, totalUnidades: linhas.reduce((a, l) => a + l[1], 0) } })
  await prisma.stockVendaLinha.createMany({ data: linhas.map(([nomeSuitable, quantidade, valorTotal]) => ({ companyId, importId: imp.id, data: imp.data, nomeSuitable, quantidade, valorTotal })) })
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LUCRO SETOR TELA' } })).id
  ids.massa = await item('MASSA BOLINHA', 1.1)
  ids.queijo = await item('SACOLA QUEIJO', 7.2)
  ids.calab = await item('CALABRESA FATIADA', 32)
  ids.bacon = await item('BACON FATIADO', 38)
  ids.pao = await item('PAO DE XIS', 1.2)
  ids.ham = await item('HAMBURGUER 150G', 3.05)
  // base da GRANDE: 2 massas + 2 sacolas = 16,60 — DUAS fichas (35CM e PRECINHO são produtos
  // distintos no PDV; ligar os dois na MESMA ficha faz o hub juntá-los numa linha só, por destino)
  for (const n of ['PIZZA GRANDE PRECINHO', 'PIZZA GRANDE 35CM']) {
    const f = await ficha(`BASE ${n}`, 'PRODUTO_FINAL', [{ itemId: ids.massa, qtdPlanejada: 2 }, { itemId: ids.queijo, qtdPlanejada: 2 }], { mapearNomeSuitable: [n] })
    ids[n] = f.fichaId
  }
  // sabores: CALABRESA (0,15 kg × 32 = 4,80) e BACON (0,10 × 38 = 3,80) com ficha; o resto SEM ficha
  const sCal = await ficha('SABOR CALABRESA', 'SABOR', [{ itemId: ids.calab, qtdPlanejada: 0.15 }], { mapearComplemento: ['CALABRESA'] })
  ids.sCal = sCal.fichaId
  await ficha('SABOR BACON', 'SABOR', [{ itemId: ids.bacon, qtdPlanejada: 0.1 }], { mapearComplemento: ['BACON'] })
  await prisma.stockCardapioSecao.createMany({ data: [
    { companyId, chave: 'XIS', nome: 'Xis', ordem: 1 }, { companyId, chave: 'PIZZAS', nome: 'Pizzas', ordem: 7 },
  ] })
  await prisma.stockCardapioProdutoSecao.createMany({ data: [
    { companyId, nomeSuitable: 'PIZZA GRANDE PRECINHO', secao: 'PIZZAS', sugerida: false },
    { companyId, nomeSuitable: 'PIZZA GRANDE 35CM', secao: 'PIZZAS', sugerida: false },
    { companyId, nomeSuitable: 'PIZZA FAMILIA 45CM', secao: 'PIZZAS', sugerida: false },
    { companyId, nomeSuitable: 'XIS COMPLETO', secao: 'XIS', sugerida: false },
  ] })

  // o laço do dia, pela porta de gravação de sempre
  for (const p of PEDIDOS) await gravarPedido(prisma, companyId, p, FECHADO)
  await prisma.suitDiaMaterializado.create({ data: { companyId, dia: DIA, status: 'MATERIALIZADO', pedidos: 0, linhas: 0, unidades: 0, totalCent: 0 } })

  // o histórico: o sábado 08/11 REAL (as linhas do XLS) + 5 sábados anteriores sem promo
  await historico('2026-11-08', (fixture.xls as { nomeSuitable: string; quantidade: number; valorTotal: number }[]).map((l) => [l.nomeSuitable, l.quantidade, l.valorTotal]))
  // ⚠️ PRECINHO constante (20 = o próprio padrão): nenhum desses é dia de promo; só o 08/11 real (102) é
  const sabados: [string, number, number][] = [['2026-11-01', 14, 20], ['2026-10-25', 12, 20], ['2026-10-18', 16, 20], ['2026-10-11', 10, 20], ['2026-10-04', 30, 20]]
  for (const [d, grande, precinho] of sabados) await historico(d, [['PIZZA GRANDE 35CM', grande, grande * 110.49], ['PIZZA GRANDE PRECINHO', precinho, precinho * 46.83], ['XIS COMPLETO', 40, 40 * 28.42]])
  // padrão do PRECINHO nos sábados mais velhos (pra o 08/11 e os outros terem padrão próprio)
  for (const d of ['2026-09-27', '2026-09-20', '2026-09-13', '2026-09-06']) await historico(d, [['PIZZA GRANDE 35CM', 15, 15 * 110.49], ['PIZZA GRANDE PRECINHO', 20, 20 * 46.83]])
}, 180_000)

afterAll(async () => {
  await prisma.suitPedido.deleteMany({ where: { companyId } })
  await prisma.suitDiaMaterializado.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

let tela: TelaDTO
const it_ = (nome: string) => tela.itens.find((i) => i.nome === nome || i.nomesSuitable.includes(nome))!

describe('Lucro por Setor · a tela do dia REAL (15/11 = o sábado 08/11 da Suit)', () => {
  beforeAll(async () => { tela = await lerTelaDoDia(companyId, DIA, FECHADO, prisma) }, 60_000)

  it('K1 · o laço inteiro entra: Σ setores (vendeu e un) == a régua da materialização do dia', async () => {
    const regua = linhasDaRegua(await lerPedidosDoDia(prisma, companyId, DIA))
    expect(tela.temLaco).toBe(true)
    expect(Math.round(tela.setores.reduce((t, s) => t + s.vendeu * 100, 0))).toBe(regua.totalCent)
    expect(tela.setores.reduce((t, s) => t + s.un, 0)).toBe(regua.unidades)
  })

  it('S17 · CUSTO INTEIRO do item = base × un + Σ sabores (com ficha) que foram NELE — recontado do fixture', () => {
    const r = recontar('PIZZA GRANDE PRECINHO')
    const p = it_('PIZZA GRANDE PRECINHO')
    expect(p.q).toBe(r.q)
    expect(Math.round(p.vendeu * 100)).toBe(r.cent)
    expect(p.custoBaseUn).toBe(16.6) // 2 × 1,10 + 2 × 7,20 — pela porta
    const esperado = r.q * 16.6 + (r.sab.get('CALABRESA') ?? 0) * 4.8 + (r.sab.get('BACON') ?? 0) * 3.8
    expect(p.custo).toBeCloseTo(esperado, 2)
    expect(p.sabores.find((s) => s.nome === 'CALABRESA')).toMatchObject({ q: r.sab.get('CALABRESA'), custoUn: 4.8 })
    // S22 · sabor sem ficha: nomeado, fora do custo ("pelo menos")
    const semF = p.semFicha.filter((f) => f.tipo === 'SABOR').map((f) => f.nome)
    expect(semF).toContain('MUSSARELA')
    expect(semF).not.toContain('CALABRESA')
    expect(p.lucro).toBeCloseTo(p.vendeu - p.custo, 2)
  })

  it('S4/S22 · semBase: item SEM ficha de produto não entra na conta (lucro/margem/quadrante null) e é nomeado no setor', () => {
    const x = it_('XIS COMPLETO')
    expect(x.semBase).toBe(true)
    expect([x.lucro, x.margem, x.quadrante]).toEqual([null, null, null])
    const s = tela.setores.find((y) => y.secao === 'XIS')!
    expect(s.semFicha.find((f) => f.tipo === 'PRODUTO' && f.nome === x.nome)?.q).toBe(x.q)
    expect(s.custo).toBe(0)
    expect(s.lucro).toBe(0) // nada com base no setor: zero venda-com-custo, zero lucro — e o selo diz por quê
    expect(s.vendeu).toBeGreaterThan(0)
  })

  it('S3 · cada setor fecha: lucro == vendeu(com custo) − custo, e o custo == Σ itens com base', () => {
    for (const s of tela.setores) {
      const xs = tela.itens.filter((i) => i.secao === s.secao)
      expect(Math.round(s.custo * 100)).toBe(xs.filter((i) => !i.semBase).reduce((t, i) => t + Math.round(i.custo * 100), 0))
      expect(Math.round(s.lucro * 100)).toBe(Math.round(s.vendeuComCusto * 100) - Math.round(s.custo * 100))
    }
  })

  it('S6 · quadrante nas MEDIANAS REAIS do setor (a mediana de baixo da lei)', () => {
    const pz = tela.itens.filter((i) => i.secao === 'PIZZAS' && i.margem != null)
    expect(pz.length).toBeGreaterThanOrEqual(2)
    const unMed = medianaDaLei(pz.map((i) => i.q))
    const mgMed = medianaDaLei(pz.map((i) => i.margem!))
    for (const i of pz) expect(i.quadrante).toBe(i.q >= unMed ? (i.margem! >= mgMed ? '⭐' : '🐴') : i.margem! >= mgMed ? '💎' : '🐶')
    // caso de mão com n PAR (onde a mediana de baixo e a de cima se separam): cortes un=10 e margem=40
    const q = quadrantes([{ chave: 'a', q: 30, margem: 60 }, { chave: 'b', q: 30, margem: 20 }, { chave: 'c', q: 2, margem: 70 }, { chave: 'd', q: 10, margem: 40 }, { chave: 'z', q: 99, margem: null }])
    expect(Object.fromEntries(q)).toEqual({ a: '⭐', b: '🐴', c: '💎', d: '⭐' })
    // e um caso ímpar onde o 🐶 aparece
    expect(quadrantes([{ chave: 'x', q: 1, margem: 5 }, { chave: 'y', q: 9, margem: 50 }, { chave: 'w', q: 5, margem: 30 }]).get('x')).toBe('🐶')
  })

  it('S14 · PROMO DETECTADA: o PRECINHO acima do padrão; normal = o usual do GÊMEO a preço cheio', () => {
    expect(tela.promo?.nome).toBe(it_('PIZZA GRANDE PRECINHO').nome)
    expect(tela.promo?.usual).toBe(110.49)
    expect(tela.estudo.padrao).toBe(tela.promo?.chave)
  })

  it('S21/S23 · RÉGUA POR ITEM com corte "sem promo": o 08/11 (PRECINHO 102) sai; o gêmeo usa os 4 sábados limpos', () => {
    const r = tela.estudo.reguas[it_('PIZZA GRANDE PRECINHO').chave]
    expect(r.nomeCheio).toBe('PIZZA GRANDE 35CM')
    expect(r.dias).toEqual(['2026-11-01', '2026-10-25', '2026-10-18', '2026-10-11'])
    expect(r.un).toBe(13) // mediana de 14, 12, 16, 10 (pares → média dos do meio)
    // o item comum usa a PRÓPRIA régua
    expect(tela.estudo.reguas[it_('XIS COMPLETO').chave].un).toBe(40)
  })

  it('régua EM FORMAÇÃO quando faltam dias limpos — nunca número inventado', () => {
    const h: Historico = new Map([['2026-11-08', new Map([['k', { un: 5, cent: 500 }]])]])
    expect(diasDaRegua(h, '2026-11-15', new Map([['k', ['K']]]))).toEqual([])
    expect(reguaDeUn(h, [], 'k')).toBeNull()
    // e "teve PRECINHO" não é promo por si: só ACIMA do padrão
    const h2: Historico = new Map(['2026-11-08', '2026-11-01', '2026-10-25', '2026-10-18', '2026-10-11'].map((d) => [d, new Map([['p', { un: 20, cent: 20 * 4683 }]])]))
    expect(emPromo(h2, '2026-11-08', 'p', ['PIZZA GRANDE PRECINHO'])).toBe(false)
    expect(ehNomeDePromo('PIZZA GRANDE PRECINHO')).toBe(true)
    expect(ehNomeDePromo('PROMOCAO? não: PROMOVIDO')).toBe(false)
  })

  it('S7 · veredito do setor da promo contra a régua do SETOR (dias sem promo), em R$', () => {
    expect(tela.veredito?.secao).toBe('PIZZAS')
    expect(tela.veredito?.emFormacao).toBe(false)
    expect(tela.veredito?.dias).toEqual(['2026-11-01', '2026-10-25', '2026-10-18', '2026-10-11'])
    const s = tela.setores.find((x) => x.secao === 'PIZZAS')!
    expect(tela.veredito!.delta).toBeCloseTo(s.lucro - tela.veredito!.regua!.lucro, 2)
  })

  it('S21 · o EMPATE do E SE: ao preço de hoje, empata em EXATAMENTE as un vendidas; e a conta da lei à mão', () => {
    const p = it_('PIZZA GRANDE 35CM')
    // vendido todo a um preço só → lucro = q × (preço − custo/un) → empate == q
    const mesmoPreco = recontar('PIZZA GRANDE 35CM').cent === Math.round(p.preco * 100) * p.q
    if (mesmoPreco && p.lucro != null && p.lucro > 0) expect(eseConta({ lucro: p.lucro, custoUn: p.custo / p.q, cheioUn: null }, p.preco).empate).toBe(p.q)
    // à mão: lucro 100, custo/un 10, régua 14, preço 30 → lucro/un 20, empate 5, cheio 280, perdeu 180
    const r = eseConta({ lucro: 100, custoUn: 10, cheioUn: 14 }, 30)
    expect(r).toEqual({ lucroUn: 20, empate: 5, lucroCheio: 280, delta: -180 })
    expect(vereditoDoEse(true, r)).toEqual({ ok: false, titulo: '✗ A PREÇO CHEIO LUCRARIA MAIS', valor: 180 })
    expect(vereditoDoEse(false, eseConta({ lucro: 300, custoUn: 10, cheioUn: 14 }, 30))).toEqual({ ok: true, titulo: '✓ COMO FOI HOJE GANHA', valor: 20 })
    // ⛔ ponto flutuante: preço 0,30 − custo 0,20 = 0,0999…98 → 1,10 ÷ isso = 11,000…2 → o ceil cru daria 12
    expect(eseConta({ lucro: 1.1, custoUn: 0.2, cheioUn: null }, 0.3).empate).toBe(11)
    // preço que não paga o custo: nenhuma conta inventada
    expect(eseConta({ lucro: 100, custoUn: 10, cheioUn: 14 }, 9)).toMatchObject({ empate: null, lucroCheio: null, delta: null })
    expect(vereditoDoEse(true, eseConta({ lucro: 100, custoUn: 10, cheioUn: null }, 30))).toBeNull() // sem régua: sem veredito
    expect([lerPreco('59,90'), lerPreco('1.059,90'), lerPreco('59.9'), lerPreco('abc'), lerPreco('0')]).toEqual([59.9, 1059.9, 59.9, null, null])
    expect(gemeoDe(['GRANDE PRECINHO'])).toBe('PIZZA GRANDE 35CM')
  })

  it('V8 · NENHUM campo de cliente: a tela e o "ver pedidos" não carregam o que o pedido guarda além do allowlist', async () => {
    const MARCA = 'CLIENTE_SECRETO_FULANO_51999990000'
    await prisma.suitPedido.updateMany({ where: { companyId, dia: DIA }, data: { impressao: MARCA, conteudo: MARCA } })
    const t = await lerTelaDoDia(companyId, DIA, FECHADO, prisma)
    const p = await pedidosDoItem(companyId, DIA, it_('PIZZA GRANDE PRECINHO').chave, prisma)
    expect(JSON.stringify(t)).not.toContain(MARCA)
    expect(JSON.stringify(p)).not.toContain(MARCA)
    expect(p.length).toBeGreaterThan(0)
    for (const x of p) expect(Object.keys(x).sort()).toEqual(['hora', 'numero', 'q', 'sabores'])
    expect(p.reduce((t2, x) => t2 + x.q, 0)).toBe(recontar('PIZZA GRANDE PRECINHO').q) // S19: a soma dos pedidos É o número
    const chavesItem = ['chave', 'custo', 'custoBase', 'custoBaseUn', 'destino', 'fichaId', 'lucro', 'margem', 'nome', 'nomesSuitable', 'preco', 'promo', 'q', 'quadrante', 'sabores', 'secao', 'semBase', 'semFicha', 'vendeu']
    for (const i of t.itens) expect(Object.keys(i).sort()).toEqual(chavesItem)
  })

  it('S22/S13 · CASCATA ao criar ficha pela PORTA do editor: item → setor → estudo recalculam', async () => {
    const antes = await lerTelaDoDia(companyId, DIA, FECHADO, prisma)
    const x = antes.itens.find((i) => i.nome === 'XIS COMPLETO')!
    expect(x.semBase).toBe(true)
    // a mesma chamada que o POST /estoque/fichas faz (criarFicha + vínculo com os nomes do PDV na MESMA transação)
    // ⭐ o CORPO é o que a tela manda (corpoDaCriacao) e a chamada é a da rota: criarFicha({ companyId, userId, ...body })
    const f = x.semFicha.find((g) => g.tipo === 'PRODUTO')!
    const body = corpoDaCriacao({ tipo: 'PRODUTO', nome: f.nome, nomesPdv: f.nomesPdv, preco: x.preco }, [
      { itemId: ids.pao, nome: 'PAO DE XIS', unidade: 'UN', qtdTexto: '1', custoMedio: 1.2 },
      { itemId: ids.ham, nome: 'HAMBURGUER 150G', unidade: 'UN', qtdTexto: '1', custoMedio: 3.05 },
    ])
    expect(body).toMatchObject({ tipoProduto: 'PRODUTO_FINAL', loteBase: 1, valorVenda: x.preco, mapearNomeSuitable: ['XIS COMPLETO'], mapearComplemento: null })
    const r = await criarFicha({ companyId, userId: undefined, ...body }, prisma)
    expect(r.vinculadoAoPdv).toBe(true)
    const depois = await lerTelaDoDia(companyId, DIA, FECHADO, prisma)
    const y = depois.itens.find((i) => i.nome === 'XIS COMPLETO')!
    expect(y.semBase).toBe(false)
    expect(y.custoBaseUn).toBe(4.25)
    expect(y.custo).toBeCloseTo(y.q * 4.25, 2)
    const sx = depois.setores.find((s) => s.secao === 'XIS')!
    expect(sx.custo).toBeCloseTo(y.custo, 2)
    expect(sx.lucro).toBeCloseTo(y.vendeu - y.custo, 2)
    expect(sx.semFicha.find((f) => f.tipo === 'PRODUTO')).toBeUndefined()
    // e a cascata do SABOR: MUSSARELA ganha ficha → o custo do PRECINHO sobe exatamente q × ficha
    const pAntes = depois.itens.find((i) => i.nome === it_('PIZZA GRANDE PRECINHO').nome)!
    const qMus = pAntes.semFicha.find((f) => f.nome === 'MUSSARELA')!.q
    const fm = pAntes.semFicha.find((g) => g.nome === 'MUSSARELA')!
    const bodyS = corpoDaCriacao({ tipo: 'SABOR', nome: fm.nome, nomesPdv: fm.nomesPdv, preco: null }, [{ itemId: ids.queijo, nome: 'SACOLA QUEIJO', unidade: 'UN', qtdTexto: '0,5', custoMedio: 7.2 }])
    expect(bodyS).toMatchObject({ tipoProduto: 'SABOR', valorVenda: null, mapearComplemento: ['MUSSARELA'], mapearNomeSuitable: null })
    await criarFicha({ companyId, ...bodyS }, prisma) // 0,5 × 7,20 = 3,60
    const fim = await lerTelaDoDia(companyId, DIA, FECHADO, prisma)
    const pDepois = fim.itens.find((i) => i.chave === pAntes.chave)!
    expect(pDepois.custo - pAntes.custo).toBeCloseTo(qMus * 3.6, 2)
    expect(pDepois.semFicha.find((f) => f.nome === 'MUSSARELA')).toBeUndefined()
  })

  it('S13 · EDITAR na linha: −/+ e ✕ montam o PATCH da porta; a dose nova recalcula o item', async () => {
    const t0 = await lerTelaDoDia(companyId, DIA, FECHADO, prisma)
    const p0 = t0.itens.find((i) => i.nomesSuitable.includes('PIZZA GRANDE 35CM'))!
    const comps = [{ itemId: ids.massa, nome: 'MASSA BOLINHA', unidade: 'UN', qtdTexto: '2', custoMedio: 1.1 }, { itemId: ids.queijo, nome: 'SACOLA QUEIJO', unidade: 'UN', qtdTexto: '2', custoMedio: 7.2 }]
    const mais = [moverDose(comps[0], 1), comps[1]] // 3 massas
    expect(custoAoVivo(mais)).toBe(17.7)
    expect(moverDose({ ...comps[0], qtdTexto: '1' }, -1).qtdTexto).toBe('1') // nunca chega a 0
    expect(moverDose({ itemId: 'x', nome: 'MOLHO', unidade: 'KG', qtdTexto: '0,08', custoMedio: 9.8 }, 1).qtdTexto).toBe('0,09')
    expect(recusa([])).toBe('Adicione ao menos um ingrediente.') // ficha vazia não grava: segue SEM ficha
    expect(custoAoVivo([])).toBeNull()
    await atualizarFicha(companyId, p0.fichaId!, { ...corpoDaEdicao(mais) }, prisma)
    const p1 = (await lerTelaDoDia(companyId, DIA, FECHADO, prisma)).itens.find((i) => i.chave === p0.chave)!
    expect(p1.custoBaseUn).toBe(17.7)
    expect(p1.custo - p0.custo).toBeCloseTo(p0.q * 1.1, 2)
    await atualizarFicha(companyId, p0.fichaId!, { ...corpoDaEdicao(comps) }, prisma) // volta
  })

  it('S19 · dia SEM laço (import de XLS): só o total por setor — a quebra por item nunca se inventa', async () => {
    const t = await lerTelaDoDia(companyId, '2026-11-08', FECHADO, prisma)
    expect(t.temDado).toBe(true)
    expect(t.temLaco).toBe(false)
    expect(t.itens).toEqual([])
    expect(t.setores.length).toBeGreaterThan(0)
    expect(t.setores.every((s) => s.itens.length === 0)).toBe(true)
    // dia sem dado nenhum: convite, nunca zero
    const v = await lerTelaDoDia(companyId, '2026-09-01', FECHADO, prisma)
    expect([v.temDado, v.setores.length]).toEqual([false, 0])
  })

  it('S8 · HOJE é parcial ("até HH:MM") e não fecha veredito', async () => {
    // o dia ainda ABERTO: sem a marca de materializado (22:30 de sáb em Brasília)
    const mat = await prisma.suitDiaMaterializado.findUniqueOrThrow({ where: { companyId_dia: { companyId, dia: DIA } } })
    await prisma.suitDiaMaterializado.delete({ where: { id: mat.id } })
    const t = await lerTelaDoDia(companyId, DIA, new Date('2026-11-16T01:30:00Z'), prisma)
    await prisma.suitDiaMaterializado.create({ data: { companyId, dia: DIA, status: 'MATERIALIZADO', pedidos: 0, linhas: 0, unidades: 0, totalCent: 0 } })
    expect(t.temLaco).toBe(true)
    expect(t.hoje).toBe(DIA)
    expect(t.parcial).toMatch(/^até \d{2}:\d{2}$/)
    expect(t.veredito).toBeNull()
  })

  it('E1 (12/11) · o caso REAL de HOJE (11/11 00:23): parcial e sem régua — o ESTUDO aparece e as contas vivem', () => {
    // o que a tela de produção devolveu pra PIZZA GRANDE PRECINHO às 00:23 (sonda read-only, 12/11)
    const hoje = { parcial: 'até 00:23', temLaco: true, itens: [{}], veredito: null }
    const p = paineisDoDia(hoje)
    expect(p.estudo).toBe(true)
    expect(p.seloParcial).toBe('até 00:23')
    expect(p.vereditoSetor).toBe(false) // S8 intocado: parcial não fecha veredito do setor
    expect(p.vereditoDoEse(null)).toBe(false) // sem régua: "em formação", sem veredito do E SE
    expect(p.vereditoDoEse(14)).toBe(false) // e com régua, num dia pela metade, também não
    const r = eseConta({ lucro: 997.41, custoUn: 697.1 / 40, cheioUn: null }, 39.99)
    expect(r.lucroUn).toBeCloseTo(22.5625, 4) // lucro/un no preço digitado
    expect(r.empate).toBe(45) // un pra empatar
    expect(eseConta({ lucro: 997.41, custoUn: 697.1 / 40, cheioUn: null }, 59.9).empate).toBe(24)
    // dia FECHADO com régua: aí sim os dois vereditos
    const fechado = paineisDoDia({ parcial: null, temLaco: true, itens: [{}], veredito: {} })
    expect([fechado.estudo, fechado.vereditoSetor, fechado.vereditoDoEse(13), fechado.vereditoDoEse(null)]).toEqual([true, true, true, false])
    // dia sem laço: não há item pra estudar (S19)
    expect(paineisDoDia({ parcial: null, temLaco: false, itens: [], veredito: null }).estudo).toBe(false)
  })

  it('E1 · no banco: HOJE parcial devolve o estudo pronto (padrão + régua por item) e o painel abre', async () => {
    const mat = await prisma.suitDiaMaterializado.findUniqueOrThrow({ where: { companyId_dia: { companyId, dia: DIA } } })
    await prisma.suitDiaMaterializado.delete({ where: { id: mat.id } })
    try {
      const t = await lerTelaDoDia(companyId, DIA, new Date('2026-11-16T01:30:00Z'), prisma)
      expect(t.parcial).toMatch(/^até \d{2}:\d{2}$/)
      expect(paineisDoDia(t).estudo).toBe(true)
      expect(t.estudo.padrao).not.toBeNull()
      expect(Object.keys(t.estudo.reguas).length).toBe(t.itens.length)
    } finally {
      await prisma.suitDiaMaterializado.create({ data: { companyId, dia: DIA, status: 'MATERIALIZADO', pedidos: 0, linhas: 0, unidades: 0, totalCent: 0 } })
    }
  })

  it('montarDoLaco é PURO: o mesmo laço dá o mesmo dia (sem relógio, sem banco)', () => {
    const pedidos = [{ status: 'delivered', sumido: false, itens: [{ nome: 'A', quantidade: 2, unitarioCent: 1000, precoCent: 2000, cancelado: false, opcoes: [{ nome: 'S', quantidade: 1 }] }] }]
    const args = { pedidos, secoes: [{ chave: 'X', nome: 'X', ordem: 1 }], produto: () => ({ chave: 'a', nome: 'A', nomesSuitable: ['A'], secao: 'X', destino: 'FICHA' as const, fichaId: 'f', custoUn: 3 }), opcao: () => ({ alvo: 'FICHA' as const, fichaId: 's', custoUn: 1.5 }) }
    const r = montarDoLaco(args)
    expect(r.itens[0]).toMatchObject({ q: 2, vendeu: 20, custo: 9, lucro: 11, sabores: [{ nome: 'S', q: 2, custo: 3 }] })
    expect(montarDoLaco(args)).toEqual(r)
  })
})
