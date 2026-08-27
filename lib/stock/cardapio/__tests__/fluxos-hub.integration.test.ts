// HUB — os DOIS ajustes que o uso real revelou (27/08).
//
// 1. BEBIDA/REVENDA MAPEIA NO PRÓPRIO HUB. O caminho antigo jogava na tela genérica do
//    Suitable e o dono tinha que achar o produto de novo. Aqui: mapeou → a margem fecha na
//    hora, porque o preço já vem do PDV e o custo já vem da nota.
//
// 2. O CUSTO DO PRODUTO FINAL É Σ COMPONENTES AO VIVO — não "a apurar até a 1ª produção".
//    Aquilo é conceito de INTERMEDIÁRIO (rendimento medido); produto final MONTA na venda.
//
// ⚠️ Estes testes rodam o MOTOR (hubCardapio + upsertVendaMap), não a tela — a regra que
// importa vive no servidor. O que é só visual (seletor escondido, ordem da busca) está no
// componente e é validação de olho.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../../producao/fichas'
import { upsertVendaMap, VendaMapError } from '../../vendas/venda-map'
import { hubCardapio } from '../hub'
import { detalheProduto, parseChave } from '../detalhe'

const CNPJ = '32323232000132' // único na suíte (arquivos rodam em paralelo no mesmo banco)
let companyId: string
let cocaId = '', desengraxanteId = '', carneId = '', paoId = ''

async function item(nome: string, cat: string, qtd: number, custo: number, un = 'UN') {
  const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: un, categoria: cat, criadoVia: 'CONFERENCIA' } })
  if (qtd > 0) await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario: custo, custoTotal: qtd * custo, origem: 'SEFAZ' } })
  return it.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'FLUXOS' } })).id

  // os números REAIS que o dono citou: Coca 2L custo 8,08 e preço 17,00 no PDV
  cocaId = await item('Coca 2L', 'REVENDA', 100, 8.08)
  desengraxanteId = await item('DESENGRAXANTE', 'LIMPEZA', 10, 25)
  await item('SACO DE LIXO', 'LIMPEZA', 10, 30)
  await item('JAPONA DE CAMARA', 'USO_INTERNO', 2, 180)
  carneId = await item('Coxão mole', 'MATERIA_PRIMA', 100, 46.95, 'KG')
  paoId = await item('Pão de xis', 'MATERIA_PRIMA', 100, 1.5)

  // um dia de vendas com os dois casos
  const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date('2026-08-21T00:00:00Z'), totalLinhas: 2, totalUnidades: 0 } })
  const linhas: [string, number, number][] = [
    ['COCA COLA 2L', 20, 340], // 17,00 cada
    ['XIS COMPLETO', 53, 1238.61], // 23,37 cada
  ]
  for (const [nome, qtd, valor] of linhas) {
    await prisma.stockVendaLinha.create({ data: { companyId, importId: imp.id, data: new Date('2026-08-21T00:00:00Z'), nomeSuitable: nome, quantidade: qtd, valorTotal: valor, mapeadoNoImport: false } })
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

const linhaDe = async (nome: string) => (await hubCardapio(companyId, {}, prisma)).linhas.find((l) => l.nome === nome)!

describe('FLUXO 1 — Coca 2L mapeada inline: margem na hora', () => {
  it('⭐ antes do mapa: aparece cobrando, sem custo e sem margem', async () => {
    const antes = await linhaDe('COCA COLA 2L')
    expect(antes.status).toBe('SEM_DESTINO')
    expect(antes.custoUnitario).toBeNull()
    expect(antes.margem).toBeNull()
    expect(antes.precoPraticado).toBe(17) // o PDV já sabe o preço
  })

  it('⭐⭐ mapeou → custo da NOTA + preço do PDV = margem fechada, sem cadastrar nada', async () => {
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
    const dep = await linhaDe('Coca 2L')
    expect(dep.status).toBe('REVENDA')
    expect(dep.custoUnitario).toBe(8.08) // da nota
    expect(dep.precoUsado).toBe(17) // do PDV
    expect(dep.margem).toBe(0.52) // (17 − 8,08) / 17
    expect(dep.vendasQtd).toBe(20) // as vendas seguem o produto
  })

  it('⚠️ o GUARD dos 3 níveis continua no servidor: material de limpeza é RECUSADO', async () => {
    await expect(
      upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: desengraxanteId }, 'u', prisma),
    ).rejects.toBeInstanceOf(VendaMapError)
  })

  it('a chave muda de nome: → item: (a tela navega pro produto que agora existe)', async () => {
    expect(parseChave('nome:COCA COLA 2L')).toEqual({ tipo: 'nome', valor: 'COCA COLA 2L' })
    await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
    const dep = await linhaDe('Coca 2L')
    expect(dep.chave).toBe(`item:${cocaId}`)
  })
})

describe('FLUXO 2 — Xis Completo: custo Σ componentes AO VIVO, sem "a apurar"', () => {
  it('⭐⭐ produto final tem custo NA HORA — zero produção envolvida', async () => {
    const xis = await criarFicha({
      companyId, nomeProduzido: 'Xis Completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 23.37,
      componentes: [{ itemId: carneId, qtdPlanejada: 0.1, unidade: 'KG' }, { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }],
    }, prisma)
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xis.fichaId }, 'u', prisma)

    // ZERO movimento de produção existe — e mesmo assim o custo é conhecido
    const producoes = await prisma.stockMovement.count({ where: { companyId, tipo: 'PRODUCAO_GERACAO' } })
    expect(producoes).toBe(0)

    const l = await linhaDe('Xis Completo')
    expect(l.status).toBe('FICHA_OK')
    expect(l.custoUnitario).toBe(6.2) // 0,1 × 46,95 = 4,695 + 1,50 = 6,195 → 6,20
    expect(l.margem).toBe(0.73) // (23,37 − 6,20) / 23,37
  })

  it('⚠️ o "a apurar" do rendimento é do INTERMEDIÁRIO, e continua valendo LÁ', async () => {
    // a mesma receita como intermediário: sem produção, o rendimento é desconhecido
    const beef = await criarFicha({
      companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO',
      loteBase: 3, unidadeLoteBase: 'KG', componentes: [{ itemId: carneId, qtdPlanejada: 3, unidade: 'KG' }],
    }, prisma)
    const { getFicha } = await import('../../producao/fichas')
    const f = (await getFicha(companyId, beef.fichaId, prisma))!.ficha
    expect(f.custoLote).toBe(140.85) // 3 × 46,95 — o LOTE se conhece
    expect(f.rendimentoMedio).toBeNull() // mas quantos pacotes saem, só a produção dirá
    expect(f.custoPorUnidade).toBeNull() // → "a apurar", correto pro mundo da cozinha
  })

  it('o detalhe mostra o componente com saldo e quanto dá pra fazer', async () => {
    const xis = await criarFicha({
      companyId, nomeProduzido: 'Xis Completo', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1, unidadeLoteBase: 'UN', valorVenda: 23.37,
      componentes: [{ itemId: carneId, qtdPlanejada: 0.1, unidade: 'KG' }, { itemId: paoId, qtdPlanejada: 1, unidade: 'UN' }],
    }, prisma)
    await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'FICHA', fichaId: xis.fichaId }, 'u', prisma)
    const det = (await detalheProduto(companyId, `ficha:${xis.fichaId}`, prisma))!
    expect(det.componentes).toHaveLength(2)
    // 100 kg de carne / 0,1 = 1000 · 100 pães / 1 = 100 → o pão é o gargalo
    expect(det.podeFazer).toBe(100)
    expect(det.gargalo?.nome).toBe('Pão de xis')
  })

  it('⚠️ ficha que RENDE várias porções divide certo (lote base > 1 não é ignorado)', async () => {
    const porcao = await criarFicha({
      companyId, nomeProduzido: 'Porção de fritas', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL',
      loteBase: 4, unidadeLoteBase: 'UN', valorVenda: 20,
      componentes: [{ itemId: carneId, qtdPlanejada: 0.4, unidade: 'KG' }],
    }, prisma)
    const det = (await detalheProduto(companyId, `ficha:${porcao.fichaId}`, prisma))!
    expect(det.loteBase).toBe(4)
    expect(det.componentes[0].qtdPorUnidade).toBe(0.1) // 0,4 ÷ 4 porções
  })
})
