// HUB DO CARDÁPIO (27/08) — a casa do dono. O teste que importa é o PRIMEIRO:
//
// ⭐ o custo que o hub mostra tem que ser EXATAMENTE o custo que a venda baixa do estoque.
// Se um dia alguém escrever uma fórmula própria de custo pro cardápio (dividir por lote
// base, usar rendimento, arredondar diferente), este teste fica vermelho ANTES de a tela
// mostrar margem sobre um custo que não acontece no ledger.
//
// Cenário = o real da Caçula em 3 níveis: Combo → Xis → (beef intermediário + pão) e a Coca
// como revenda direta.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { montarPlanoVenda } from '../../vendas/baixa-venda'
import { upsertVendaMap } from '../../vendas/venda-map'
import { hubCardapio } from '../hub'

// ⚠️ CNPJ ÚNICO na suíte: os arquivos rodam em PARALELO contra o mesmo banco, então dois
// testes com o mesmo CNPJ derrubam um ao outro no `create` (colidiu com saida.integration).
const CNPJ = '31313131000131'
let companyId: string
let paoId = '', refriId = '', cocaId = '', molhoId = '', beefId = ''
let xisFichaId = '', comboFichaId = '', pizzaFichaId = ''

/** relatório do Suitable: [produto, qtd, valorTotal] */
const html = (linhas: [string, number, number][]) =>
  `<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr>${
    linhas.map(([p, q, v]) => `<tr><td>${p}</td><td>${q}</td><td>R$ 0,00</td><td>R$ ${v.toFixed(2).replace('.', ',')}</td></tr>`).join('')
  }</table></body></html>`

async function estoque(nome: string, cat: string, qtd: number, custo: number) {
  const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'CONFERENCIA' } })
  if (qtd > 0) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' } })
  return it.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'HUB' } })).id

  paoId = await estoque('Pão de xis', 'MATERIA_PRIMA', 100, 1)
  refriId = await estoque('Refri lata', 'REVENDA', 100, 3)
  cocaId = await estoque('Coca 2L', 'REVENDA', 100, 8)
  molhoId = await estoque('Molho especial', 'MATERIA_PRIMA', 0, 0) // NUNCA veio em nota → sem custo
  const carne = await estoque('Carne moída', 'MATERIA_PRIMA', 100, 40)

  // beef = INTERMEDIÁRIO produzido em lote (o mundo da cozinha)
  const beef = await criarFicha({ companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: carne, qtdPlanejada: 0.1, unidade: 'KG' }] }, prisma)
  beefId = beef.itemProduzidoId
  await prisma.stockMovement.create({ data: { companyId, itemId: beefId, tipo: 'PRODUCAO_GERACAO', quantidade: 50, custoUnitario: 4, custoTotal: 200, origem: 'MANUAL' } })

  // Xis = PRODUTO FINAL montado na venda: 1 beef (4,00) + 1 pão (1,00) = 5,00
  const xis = await criarFicha({ companyId, nomeProduzido: 'Xis completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: beefId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  xisFichaId = xis.fichaId
  // Combo = 1 Xis + 1 refri = 8,00
  const combo = await criarFicha({ companyId, nomeProduzido: 'Combo Caçula', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: xis.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: refriId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  comboFichaId = combo.fichaId
  // Pizza usa o molho SEM custo → ficha incompleta
  const pizza = await criarFicha({ companyId, nomeProduzido: 'Pizza grande', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN', componentes: [{ itemId: molhoId, qtdPlanejada: 1, unidade: 'UN' }, { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }] }, prisma)
  pizzaFichaId = pizza.fichaId

  // os DOIS apelidos do PDV apontam pro MESMO xis (o caso real da Caçula)
  await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
  await upsertVendaMap(companyId, 'XIS - COMPLETO', { tipo: 'FICHA', fichaId: xisFichaId }, 'u', prisma)
  await upsertVendaMap(companyId, 'COMBO CACULA', { tipo: 'FICHA', fichaId: comboFichaId }, 'u', prisma)
  await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)

  // um dia de vendas: inclui um produto que NINGUÉM mapeou (o campeão sem ficha)
  const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date('2026-08-21T00:00:00Z'), totalLinhas: 5, totalUnidades: 0 } })
  const linhas: [string, number, number][] = [
    ['GRANDE PRECINHO', 38, 380], // sem destino — o campeão
    ['XIS COMPLETO', 10, 250],
    ['XIS - COMPLETO', 5, 125], // mesmo produto, apelido do PDV
    ['COMBO CACULA', 12, 360],
    ['COCA COLA 2L', 4, 48],
  ]
  for (const [nome, qtd, valor] of linhas) {
    await prisma.stockVendaLinha.create({ data: { companyId, importId: imp.id, data: new Date('2026-08-21T00:00:00Z'), nomeSuitable: nome, quantidade: qtd, valorTotal: valor, mapeadoNoImport: nome !== 'GRANDE PRECINHO' } })
  }
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap', 'stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const linhaDe = (h: Awaited<ReturnType<typeof hubCardapio>>, nome: string) => h.linhas.find((l) => l.nome === nome)!

describe('⭐ o custo do hub é o MESMO que a venda baixa do estoque (REGRA 4)', () => {
  it('Combo: custo da tela == Σ (insumo baixado × custo médio) do plano real de venda', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    // o plano REAL: vende 1 combo e vê o que sai do estoque
    const plano = await montarPlanoVenda(companyId, '2026-08-22', html([['COMBO CACULA', 1, 30]]), prisma)
    const baixa = plano.produtos.flatMap((p) => p.baixa)
    const custoDaBaixa = baixa.reduce((s, b) => s + (b.custoMedio ?? 0) * b.qtd, 0)

    expect(baixa.every((b) => b.custoMedio != null)).toBe(true) // sanidade do cenário
    expect(custoDaBaixa).toBeCloseTo(8, 2) // beef 4 + pão 1 + refri 3
    expect(linhaDe(hub, 'Combo Caçula').custoUnitario).toBeCloseTo(custoDaBaixa, 2)
  })

  it('Xis: idem, atravessando o intermediário (beef baixa o pack, não a carne crua)', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    const plano = await montarPlanoVenda(companyId, '2026-08-22', html([['XIS COMPLETO', 1, 25]]), prisma)
    const custoDaBaixa = plano.produtos.flatMap((p) => p.baixa).reduce((s, b) => s + (b.custoMedio ?? 0) * b.qtd, 0)
    expect(linhaDe(hub, 'Xis completo').custoUnitario).toBeCloseTo(custoDaBaixa, 2)
    expect(custoDaBaixa).toBeCloseTo(5, 2)
  })

  it('⚠️ afrouxar o custo (dividir pelo lote base) quebraria — o vínculo é ao centavo', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    const xis = linhaDe(hub, 'Xis completo')
    expect(xis.custoUnitario).toBe(5) // exato, não "por volta de"
  })
})

describe('a linha nasce da VENDA — produto que vendeu sem ficha aparece cobrando', () => {
  it('⭐ o campeão sem destino está na lista e no banner de onboarding', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    const precinho = linhaDe(hub, 'GRANDE PRECINHO')
    expect(precinho.status).toBe('SEM_DESTINO')
    expect(precinho.vendasQtd).toBe(38)
    expect(hub.campeaoSemFicha).toEqual({ nome: 'GRANDE PRECINHO', vendasQtd: 38 })
  })

  it('sem destino não inventa custo nem margem', async () => {
    const p = linhaDe(await hubCardapio(companyId, {}, prisma), 'GRANDE PRECINHO')
    expect(p.custoUnitario).toBeNull()
    expect(p.margem).toBeNull()
  })
})

describe('apelidos do PDV: mesmo destino = UMA linha, vendas somadas', () => {
  it('⭐ "XIS COMPLETO" + "XIS - COMPLETO" viram um produto de 15 unidades', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    const xis = linhaDe(hub, 'Xis completo')
    expect(xis.vendasQtd).toBe(15) // 10 + 5
    expect(xis.nomesSuitable.sort()).toEqual(['XIS - COMPLETO', 'XIS COMPLETO'])
    expect(hub.linhas.filter((l) => l.fichaId === xisFichaId)).toHaveLength(1)
  })

  it('⚠️ nomes parecidos SEM o mesmo destino ficam separados — casar por semelhança seria adivinhar', async () => {
    await prisma.stockVendaProdutoMap.deleteMany({ where: { companyId, nomeSuitable: 'XIS - COMPLETO' } })
    const hub = await hubCardapio(companyId, {}, prisma)
    expect(linhaDe(hub, 'Xis completo').vendasQtd).toBe(10)
    expect(linhaDe(hub, 'XIS - COMPLETO').status).toBe('SEM_DESTINO')
  })
})

describe('preço: o que o PDV cobrou de fato manda sobre o que está cadastrado', () => {
  it('⭐ preço praticado = valor ÷ quantidade do próprio relatório', async () => {
    const combo = linhaDe(await hubCardapio(companyId, {}, prisma), 'Combo Caçula')
    expect(combo.precoPraticado).toBe(30) // 360 / 12
    expect(combo.precoOrigem).toBe('praticado')
    // margem em fração com 2 casas (0,73 = 73%) — MESMA convenção do `calcularMargem` que
    // já existia; a tela mostra percentual inteiro, então 2 casas é a precisão do contrato.
    expect(combo.margem).toBe(0.73) // (30 − 8) / 30
  })

  it('produto cadastrado que não vendeu no período usa o preço de cardápio', async () => {
    await prisma.stockFicha.update({ where: { id: pizzaFichaId }, data: { valorVenda: 50 } })
    await prisma.stockVendaLinha.deleteMany({ where: { companyId } })
    const pizza = linhaDe(await hubCardapio(companyId, {}, prisma), 'Pizza grande')
    expect(pizza.precoPraticado).toBeNull()
    expect(pizza.precoUsado).toBe(50)
    expect(pizza.precoOrigem).toBe('cardapio')
  })

  it('revenda fecha sozinha: custo da nota + preço do PDV = margem real, sem cadastrar preço', async () => {
    const coca = linhaDe(await hubCardapio(companyId, {}, prisma), 'Coca 2L')
    expect(coca.status).toBe('REVENDA')
    expect(coca.custoUnitario).toBe(8)
    expect(coca.precoPraticado).toBe(12) // 48 / 4
    expect(coca.margem).toBe(0.33) // (12 − 8) / 12
  })
})

describe('honestidade: "a definir" nunca vira número', () => {
  it('⭐ ficha com insumo sem custo fica INCOMPLETA e sem margem (nunca 0,01)', async () => {
    const pizza = linhaDe(await hubCardapio(companyId, {}, prisma), 'Pizza grande')
    expect(pizza.status).toBe('FICHA_INCOMPLETA')
    expect(pizza.custoUnitario).toBeNull()
    expect(pizza.componentesSemCusto).toBe(1)
    expect(pizza.margem).toBeNull()
  })

  it('produto final cadastrado sem venda continua na lista (trabalho feito não some)', async () => {
    const pizza = linhaDe(await hubCardapio(companyId, {}, prisma), 'Pizza grande')
    expect(pizza.vendasQtd).toBe(0)
    expect(pizza.fichaId).toBe(pizzaFichaId)
  })

  it('ordena por venda: o que mais gira aparece primeiro', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    expect(hub.linhas.slice(0, 3).map((l) => l.nome)).toEqual(['GRANDE PRECINHO', 'Xis completo', 'Combo Caçula'])
  })

  it('os totais fecham com as linhas', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    expect(hub.totais.vendasQtd).toBe(hub.linhas.reduce((s, l) => s + l.vendasQtd, 0))
    expect(hub.totais.semDestino).toBe(1)
    expect(hub.totais.produtos).toBe(hub.linhas.length)
  })
})

describe('período', () => {
  it('recorte por dias deixa de fora o que está fora da janela', async () => {
    const hub = await hubCardapio(companyId, { dias: 1 }, prisma)
    expect(hub.totais.vendasQtd).toBe(0)
    // o cadastro continua: produto final cadastrado não some por falta de venda
    expect(hub.linhas.some((l) => l.nome === 'Combo Caçula')).toBe(true)
  })
})
