import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '@/lib/stock/producao/fichas'
import { upsertVendaMap } from '@/lib/stock/vendas/venda-map'
import { lucroPorSetorDoDia } from '../motor'
import { SEM_SETOR } from '../complemento-setor'

// O motor contra o banco: fichas reais, custo médio do ledger, a porta `custoDeUmaUnidade`.
// O cenário tem os 4 casos que um 2º caminho de custo erraria: combo = produto final DENTRO de
// produto final (só a porta explode), beef intermediário baixado como pacote, ficha incompleta,
// e um dia VIZINHO com outro preço (média do período apareceria aqui).

const CNPJ = '90909090000777'
const DIA = '2026-11-07'
let companyId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LUCRO SETOR' } })).id
  const item = async (nome: string, cat: string, custo: number | null, tipo = 'ENTRADA_NF') => {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: cat, criadoVia: 'MANUAL' } })
    if (custo != null) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo, quantidade: 100, custoUnitario: custo, custoTotal: 100 * custo, origem: tipo === 'ENTRADA_NF' ? 'SEFAZ' : 'MANUAL' } })
    return it.id
  }
  const pao = await item('PAO', 'MATERIA_PRIMA', 1.5)
  const ovo = await item('OVO SEM NOTA', 'MATERIA_PRIMA', null) // sem custo nenhum
  const refri = await item('REFRI 2L', 'REVENDA', 6)
  const massa = await item('MASSA', 'MATERIA_PRIMA', 3)
  const queijo = await item('QUEIJO', 'MATERIA_PRIMA', 4)
  const calab = await item('CALABRESA', 'MATERIA_PRIMA', 2.5)
  const coca = await item('COCA LATA', 'REVENDA', 5)
  const ficha = (nomeProduzido: string, tipoProduto: 'PRODUTO_FINAL' | 'INTERMEDIARIO' | 'SABOR', componentes: { itemId: string; qtdPlanejada: number }[]) =>
    criarFicha({ companyId, nomeProduzido, unidadeProduzido: 'UN', tipoProduto, loteBase: 1, unidadeLoteBase: 'UN', componentes: componentes.map((x) => ({ ...x, unidade: 'UN' })) }, prisma)
  const beef = await ficha('Beef', 'INTERMEDIARIO', [{ itemId: pao, qtdPlanejada: 1 }])
  await prisma.stockMovement.create({ data: { companyId, itemId: beef.itemProduzidoId, tipo: 'PRODUCAO_GERACAO', quantidade: 50, custoUnitario: 2, custoTotal: 100, origem: 'MANUAL' } })
  const xis = await ficha('Xis completo', 'PRODUTO_FINAL', [{ itemId: beef.itemProduzidoId, qtdPlanejada: 1 }, { itemId: pao, qtdPlanejada: 1 }]) // 2 + 1,5
  const combo = await ficha('Combo', 'PRODUTO_FINAL', [{ itemId: xis.itemProduzidoId, qtdPlanejada: 1 }, { itemId: refri, qtdPlanejada: 1 }]) // 3,5 + 6
  const xisOvo = await ficha('Xis ovo', 'PRODUTO_FINAL', [{ itemId: pao, qtdPlanejada: 1 }, { itemId: ovo, qtdPlanejada: 1 }]) // incompleta
  const pizza = await ficha('Base grande', 'PRODUTO_FINAL', [{ itemId: massa, qtdPlanejada: 2 }, { itemId: queijo, qtdPlanejada: 1 }]) // 10
  const sabor = await ficha('Sabor calabresa', 'SABOR', [{ itemId: calab, qtdPlanejada: 1 }]) // 2,5
  const refriComp = await ficha('Refri do combo', 'SABOR', [{ itemId: refri, qtdPlanejada: 1 }]) // 6

  for (const [nome, fichaId] of [['XIS COMPLETO', xis.fichaId], ['COMBO CACULA', combo.fichaId], ['XIS OVO', xisOvo.fichaId], ['PIZZA GRANDE', pizza.fichaId]] as const) {
    await upsertVendaMap(companyId, nome, { tipo: 'FICHA', fichaId }, 'u', prisma)
  }
  await upsertVendaMap(companyId, 'COCA LATA', { tipo: 'REVENDA', itemId: coca }, 'u', prisma)

  await prisma.stockCardapioSecao.createMany({ data: [
    { companyId, chave: 'XIS', nome: 'Xis', ordem: 1 }, { companyId, chave: 'PIZZAS', nome: 'Pizzas', ordem: 7 },
    { companyId, chave: 'BEBIDAS', nome: 'Bebidas', ordem: 8 }, { companyId, chave: 'OUTROS', nome: 'Outros', ordem: 99 },
  ] })
  await prisma.stockCardapioProdutoSecao.createMany({ data: [
    { companyId, nomeSuitable: 'XIS COMPLETO', secao: 'XIS', sugerida: false }, { companyId, nomeSuitable: 'XIS OVO', secao: 'XIS', sugerida: true },
    { companyId, nomeSuitable: 'COMBO CACULA', secao: 'OUTROS', sugerida: false }, { companyId, nomeSuitable: 'PIZZA GRANDE', secao: 'PIZZAS', sugerida: false },
    { companyId, nomeSuitable: 'COCA LATA', secao: 'BEBIDAS', sugerida: false },
  ] })

  const venda = async (dia: string, linhas: [string, number, number][], compl: [string, number][]) => {
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${dia}T15:00:00.000Z`), totalLinhas: linhas.length, totalUnidades: linhas.reduce((a, l) => a + l[1], 0) } })
    await prisma.stockVendaLinha.createMany({ data: linhas.map(([nomeSuitable, quantidade, valorTotal]) => ({ companyId, importId: imp.id, data: imp.data, nomeSuitable, quantidade, valorTotal })) })
    if (compl.length) await prisma.stockVendaComplementoLinha.createMany({ data: compl.map(([nomeSuitable, ocorrencias]) => ({ companyId, importId: imp.id, data: imp.data, nomeSuitable, ocorrencias })) })
  }
  await venda(DIA, [['XIS COMPLETO', 10, 300], ['COMBO CACULA', 2, 90], ['XIS OVO', 2, 50], ['PIZZA GRANDE', 4, 200], ['COCA LATA', 3, 27], ['PRODUTO NOVO', 1, 10]],
    [['CALABRESA', 5], ['BORDA CATUPIRY', 2], ['REFRI DO COMBO', 3], ['GRANDE', 4]])
  // o dia vizinho, com OUTRO preço: se o motor usasse a média do período, apareceria aqui
  await venda('2026-11-06', [['XIS COMPLETO', 10, 100], ['PIZZA GRANDE', 9, 9]], [['CALABRESA', 50]])

  await prisma.stockVendaComplementoMap.createMany({ data: [
    { companyId, nomeSuitable: 'CALABRESA', alvoTipo: 'FICHA', fichaId: sabor.fichaId },
    { companyId, nomeSuitable: 'REFRI DO COMBO', alvoTipo: 'FICHA', fichaId: refriComp.fichaId },
    { companyId, nomeSuitable: 'GRANDE', alvoTipo: 'IGNORAR' },
  ] })
}, 60_000)

afterAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('motor do setor-dia contra o banco', () => {
  it('K1: Σ setores == linhas do DIA no banco (o vizinho não vaza)', async () => {
    const r = await lucroPorSetorDoDia(companyId, DIA, prisma)
    expect(r.totais).toMatchObject({ vendeu: 677, un: 22 })
    expect(r.setores.reduce((a, s) => a + s.un, 0)).toBe(22)
  })

  it('custo pela porta: combo explode o xis (3,5 + 6), revenda pelo ledger, vigente × un do dia', async () => {
    const r = await lucroPorSetorDoDia(companyId, DIA, prisma)
    const linha = (secao: string, nome: string) => r.setores.find((s) => s.secao === secao)!.produtos.find((p) => p.nome === nome)!
    expect(linha('XIS', 'Xis completo')).toMatchObject({ un: 10, vendeu: 300, custoUn: 3.5, custo: 35 })
    expect(linha('OUTROS', 'Combo')).toMatchObject({ un: 2, vendeu: 90, custoUn: 9.5, custo: 19 })
    expect(linha('BEBIDAS', 'COCA LATA')).toMatchObject({ custoUn: 5, custo: 15 })
    expect(linha('PIZZAS', 'Base grande')).toMatchObject({ un: 4, vendeu: 200, custoUn: 10, custo: 40 })
  })

  it('K3: ficha incompleta e produto sem destino ficam FORA do custo, nomeados', async () => {
    const r = await lucroPorSetorDoDia(companyId, DIA, prisma)
    const xis = r.setores.find((s) => s.secao === 'XIS')!
    expect(xis.semFicha).toEqual([{ nome: 'Xis ovo', un: 2, vendeu: 50 }])
    expect(xis).toMatchObject({ vendeu: 350, vendeuComCusto: 300, custoProdutos: 35, custo: 35, lucro: 265 })
  })

  it('K4 + complementos: sem seção e sem atribuição em SEM SETOR; sabor nas PIZZAS; IGNORAR contado', async () => {
    const r = await lucroPorSetorDoDia(companyId, DIA, prisma)
    const sem = r.setores.find((s) => s.secao === SEM_SETOR)!
    expect(sem.semFicha).toEqual([{ nome: 'PRODUTO NOVO', un: 1, vendeu: 10 }])
    expect(sem).toMatchObject({ custoComplementos: 18, custo: 18, lucro: -18 })
    const pz = r.setores.find((s) => s.secao === 'PIZZAS')!
    expect(pz).toMatchObject({ custoProdutos: 40, custoComplementos: 12.5, custo: 52.5, lucro: 147.5 })
    expect(pz.complementosSemFicha).toEqual([{ nome: 'BORDA CATUPIRY', ocorrencias: 2 }])
    expect(r.complementos.ignorados).toEqual([{ nome: 'GRANDE', ocorrencias: 4 }])
  })

  it('K2 no banco: custo de cada setor == Σ produtos + Σ complementos', async () => {
    const r = await lucroPorSetorDoDia(companyId, DIA, prisma)
    for (const s of r.setores) {
      const p = s.produtos.reduce((a, x) => a + Math.round((x.custo ?? 0) * 100), 0)
      const k = s.complementos.reduce((a, x) => a + Math.round((x.custo ?? 0) * 100), 0)
      expect(Math.round(s.custo * 100)).toBe(p + k)
    }
    expect(r.totais.custo).toBe(35 + 19 + 15 + 52.5 + 18)
  })

  it('só lê: nenhuma linha nova em lugar nenhum', async () => {
    const antes = await Promise.all([prisma.stockCardapioSecao.count(), prisma.stockCardapioProdutoSecao.count(), prisma.stockMovement.count(), prisma.stockVendaComplementoGrupo.count()])
    await lucroPorSetorDoDia(companyId, DIA, prisma)
    const depois = await Promise.all([prisma.stockCardapioSecao.count(), prisma.stockCardapioProdutoSecao.count(), prisma.stockMovement.count(), prisma.stockVendaComplementoGrupo.count()])
    expect(depois).toEqual(antes)
  })
})
