// REGRA 1 — O MODAL ABRIA COM NOME E PREÇO VAZIOS (28/08, o dono reportou 2×).
//
// Caminho exato que ele descreveu:
//   /estoque/cardapio → card "XIS COMPLETO" → painel (vendas 53 · preço 23,37 VISÍVEIS)
//   → "Montar a receita" → modal abre VAZIO.
//
// ⚠️ Este teste percorre esse caminho no SERVIDOR: monta o mesmo dia de vendas, roda o
// `hubCardapio`, pega a linha pelo `detalheProduto` (a MESMA que a tela recebe) e afirma que
// os valores iniciais saem preenchidos. O projeto não tem jsdom/RTL, então o que dá pra
// travar é a DECISÃO — e é por isso que ela saiu de dentro do `useState`: enquanto morava
// lá, "abre vazio" não tinha como virar teste vermelho.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { hubCardapio } from '../hub'
import { detalheProduto } from '../detalhe'
import { valoresIniciaisDaFicha, paraCampo, faixaMargem } from '../valores-iniciais'

const CNPJ = '35353535000135'
let companyId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'PREFILL' } })).id
  // o dia real: XIS COMPLETO, 53 unidades, R$ 1.238,61 → 23,37 cada
  const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date('2026-08-21T00:00:00Z'), totalLinhas: 1, totalUnidades: 53 } })
  await prisma.stockVendaLinha.create({ data: { companyId, importId: imp.id, data: new Date('2026-08-21T00:00:00Z'), nomeSuitable: 'XIS COMPLETO', quantidade: 53, valorTotal: 1238.61, mapeadoNoImport: false } })
})

afterEach(async () => {
  for (const t of ['stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o caminho do dono: hub → produto → "Montar a receita"', () => {
  it('⭐ a linha que a tela recebe TEM nome e preço (o servidor nunca foi o problema)', async () => {
    const hub = await hubCardapio(companyId, {}, prisma)
    const linha = hub.linhas.find((l) => l.nome === 'XIS COMPLETO')!
    expect(linha.vendasQtd).toBe(53)
    expect(linha.precoPraticado).toBe(23.37)
    expect(linha.nomesSuitable).toEqual(['XIS COMPLETO'])

    // e o detalhe (o endpoint que a tela do produto chama) devolve a MESMA linha
    const det = (await detalheProduto(companyId, linha.chave, prisma))!
    expect(det.linha.precoPraticado).toBe(23.37)
    expect(det.linha.nomesSuitable[0]).toBe('XIS COMPLETO')
  })

  it('⭐⭐ os valores iniciais do modal saem PREENCHIDOS (era isto que abria vazio)', async () => {
    const det = (await detalheProduto(companyId, 'nome:XIS COMPLETO', prisma))!
    const v = valoresIniciaisDaFicha('PRODUTO_FINAL', det.linha)

    expect(v.nome).toBe('XIS COMPLETO') // NÃO ''
    expect(v.preco).toBe('23,37') // NÃO '' — e em pt-BR, com vírgula
    expect(v.precoOrigem).toBe('praticado')
  })

  it('preço em pt-BR: o dono digita com vírgula, o campo mostra com vírgula', () => {
    expect(paraCampo(23.37)).toBe('23,37')
    expect(paraCampo(8)).toBe('8')
    expect(paraCampo(null)).toBe('')
  })
})

describe('produto final = PLATE COST (1 porção vendida)', () => {
  it('⭐ não pergunta rendimento nem validade — isso é do mundo da produção', async () => {
    const det = (await detalheProduto(companyId, 'nome:XIS COMPLETO', prisma))!
    const v = valoresIniciaisDaFicha('PRODUTO_FINAL', det.linha)
    expect(v.mostraRendimento).toBe(false)
    expect(v.mostraValidade).toBe(false)
    expect(v.loteBase).toBe('1') // 1 ficha = 1 unidade vendida
    expect(v.unidadeLoteBase).toBe('UN')
  })

  it('⚠️ receita de PRODUÇÃO mantém os dois — é ela que rende em lote e vence', () => {
    const v = valoresIniciaisDaFicha('INTERMEDIARIO')
    expect(v.mostraRendimento).toBe(true)
    expect(v.mostraValidade).toBe(true)
    expect(v.unidadeLoteBase).toBe('KG') // a cozinha pesa a matéria-prima
    expect(v.preco).toBe('') // intermediário não tem preço de cardápio
  })
})

describe('bordas', () => {
  it('sem linha (ficha nova pelo mundo da produção) abre limpo, sem inventar', () => {
    const v = valoresIniciaisDaFicha('INTERMEDIARIO', null)
    expect(v.nome).toBe('')
    expect(v.preco).toBe('')
    expect(v.precoOrigem).toBeNull()
  })

  it('sem venda no período cai no preço CADASTRADO, e diz que foi de lá', () => {
    const v = valoresIniciaisDaFicha('PRODUTO_FINAL', { nome: 'Pizza', nomesSuitable: [], precoPraticado: null, precoCardapio: 50, fichaId: 'f1' })
    expect(v.preco).toBe('50')
    expect(v.precoOrigem).toBe('cardapio')
  })

  it('sem preço nenhum → vazio (a definir), NUNCA um número chutado', () => {
    const v = valoresIniciaisDaFicha('PRODUTO_FINAL', { nome: 'Novo', nomesSuitable: [], precoPraticado: null, precoCardapio: null, fichaId: null })
    expect(v.preco).toBe('')
    expect(v.precoOrigem).toBeNull()
  })

  it('o nome do PDV vem na frente do nome do item (é por ele que a venda casa)', () => {
    const v = valoresIniciaisDaFicha('PRODUTO_FINAL', { nome: 'Xis completo', nomesSuitable: ['XIS - COMPLETO'], precoPraticado: 20, precoCardapio: null, fichaId: null })
    expect(v.nome).toBe('XIS - COMPLETO')
  })
})

describe('faixa de margem — a MESMA régua da tela do cardápio', () => {
  it('classifica igual em toda tela (uma decisão, um lugar)', () => {
    expect(faixaMargem(null)).toBe('indefinida')
    expect(faixaMargem(0.1)).toBe('ruim')
    expect(faixaMargem(0.2)).toBe('atencao')
    expect(faixaMargem(0.73)).toBe('boa') // a margem real do Xis
  })
})
