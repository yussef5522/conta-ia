// ⭐⭐ E16 — O QUE ENTROU NO ESTOQUE BATE COM O QUE A NOTA DIZ (29/08/2026).
//
// ⚠️ O INVARIANTE NÃO EXISTIA, e é o buraco que deixou passar R$ 12.528 de estoque
// fantasma sem ninguém ver. O E2 conta LINHAS (itens conferidos × movimentos); **valor
// ninguém olhava**.
//
// CASO REAL (OVO BRANCO CARTELA GRAUDO, CIA DA FRUTA): três notas idênticas dizendo
// `12 UN × R$ 18,00 = R$ 216,00`. Em DUAS delas a quantidade foi convertida à mão pra 360
// (12 cartelas × 30 ovos) **e o custo ficou em 18** — em vez de converter (valor intacto),
// multiplicou o valor por 30. Entrou 6.480 no lugar de 216, duas vezes.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkStockInvariants } from '../stock-invariants'
import { criarMovimento, estornarMovimento } from '../movement'

const CNPJ = '52525252000152'
const CHAVE = '43260836603841000130550010000010201003336490'
let companyId: string, nfeId: string, itemId: string

const e16 = async () =>
  (await checkStockInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'E16')

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'E16 TESTE' } })).id
  nfeId = (await prisma.stockNfe.create({
    data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', temXmlCompleto: true, vNF: 216, emitNome: 'CIA DA FRUTA' },
  })).id
  // a nota declara: 12 UN × 18,00 = 216,00
  await prisma.stockNfeItem.create({
    data: { companyId, nfeId, chave: CHAVE, nItem: 1, cProd: 'OVO1', xProd: 'OVO BRANCO CARTELA GRAUDO', uCom: 'UN', qCom: 12, vUnCom: 18, vProd: 216 },
  })
  itemId = (await prisma.stockItem.create({
    data: { companyId, nome: 'OVO BRANCO CARTELA GRAUDO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })).id
})

afterEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.stockNfeItem.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const entrada = (quantidade: number, custoUnitario: number) =>
  criarMovimento(prisma, {
    companyId, itemId, tipo: 'ENTRADA_NF', quantidade, custoUnitario,
    custoTotal: Math.round(quantidade * custoUnitario * 100) / 100,
    nfeChave: CHAVE, receiptId: null, nItem: null, origem: 'SEFAZ',
  })

describe('⭐⭐ E16 pega o estoque fantasma', () => {
  it('entrada FIEL à nota (12 × 18 = 216) passa VERDE', async () => {
    await entrada(12, 18)
    expect(await e16()).toHaveLength(0)
  })

  it('⭐⭐ o CASO REAL: qtd convertida (×30) com o custo parado → PEGA R$ 6.264 a mais', async () => {
    await entrada(360, 18) // 6.480 — o erro do dono
    const f = await e16()
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain('6480.00')
    expect(f[0].detalhe).toContain('216.00')
    expect(f[0].detalhe).toContain('6264.00')
    expect(f[0].detalhe).toContain('A MAIS')
  })

  it('⭐ conversão FEITA CERTO (qtd ×30, custo ÷30) passa verde — o valor fica intacto', async () => {
    await entrada(360, 0.6) // 216,00 — é isto que "converter" significa
    expect(await e16()).toHaveLength(0)
  })

  it('⭐ entrada A MENOS também é pega (nomeia a direção)', async () => {
    await entrada(6, 18) // 108 — metade
    const f = await e16()
    expect(f).toHaveLength(1)
    expect(f[0].detalhe).toContain('A MENOS')
  })
})

describe('⚠️ correção legítima NÃO vira alarme (a lição do E2)', () => {
  it('⭐⭐ estorno + relançamento fecham em zero — o ESTORNO entra na conta', async () => {
    // ⚠️ o estorno tem tipo 'ESTORNO', não 'ENTRADA_NF'. Esquecer isso foi o meu erro na
    // 1ª varredura: a reunitização do pão apareceu como "+1.775,96" e era o método do
    // módulo funcionando. Invariante que soma em ledger imutável conta o LÍQUIDO.
    const errado = await entrada(360, 18)
    expect(await e16()).toHaveLength(1) // vermelho enquanto está errado

    await estornarMovimento(prisma, errado.id)
    await entrada(12, 18)
    expect(await e16()).toHaveLength(0) // 6480 − 6480 + 216 = 216 ✓
  })
})

describe('a tolerância é de arredondamento, não de conveniência', () => {
  it('1 centavo por linha passa (conversão de fator arredonda)', async () => {
    await entrada(12, 18.0008) // 216,01
    expect(await e16()).toHaveLength(0)
  })

  it('⚠️ os R$ 12,63 da BOX PAPER PASSAM — e está certo assim (decisão registrada)', async () => {
    // 6.313 caixas: o custo certo é 2,742145…; arredondado pra 2,74 perde 12,63 no total.
    // Com meio centavo por unidade a folga é 31,56, então isto NÃO alarma.
    //
    // ⚠️ É TROCA CONSCIENTE, não descuido: essa diferença é o pior caso ARITMÉTICO do
    // código antigo, e o E16 existe pra pegar a classe dos R$ 6.264 (quantidade convertida
    // sem o custo), não meio centavo por caixa. Alarmar aqui traria junto o 0,07 da Cancian
    // e o 0,09 da Menon toda noite — e alarme falso repetido mata o alarme.
    //
    // ⭐ O QUE FECHA ESSE FLANCO É A FONTE, não a régua: desde 29/08 o custo é gravado em
    // precisão cheia (`vUnCom / fator`, sem round2), então qtd × custo == vProd EXATO e a
    // diferença das entradas novas é zero.
    await prisma.stockNfeItem.updateMany({ where: { companyId, nfeId }, data: { qCom: 6313, vUnCom: 2.742145, vProd: 17310.25 } })
    await entrada(6313, 2.74)
    expect(await e16()).toHaveLength(0)
  })

  it('⭐ e com o custo em PRECISÃO CHEIA a mesma nota fecha exato (o fix na fonte)', async () => {
    await prisma.stockNfeItem.updateMany({ where: { companyId, nfeId }, data: { qCom: 6313, vUnCom: 2.742145, vProd: 17310.25 } })
    await entrada(6313, 17310.25 / 6313) // é o que `confirmarConferencia` grava agora
    expect(await e16()).toHaveLength(0)
    const m = await prisma.stockMovement.findFirstOrThrow({ where: { companyId } })
    expect(Math.round(m.custoTotal * 100) / 100).toBe(17310.25) // ao centavo
  })

  it('⚠️ mas 6.264 em 12 unidades NÃO escapa pela folga (a folga é por UNIDADE)', async () => {
    await entrada(360, 18)
    expect(await e16()).toHaveLength(1) // folga de 360×0,005 = 1,80 · diferença 6.264
  })

  it('nota sem itens parseados (só resumo) não é comparada — não inventa alarme', async () => {
    await prisma.stockNfeItem.deleteMany({ where: { companyId, nfeId } })
    await entrada(360, 18)
    expect(await e16()).toHaveLength(0)
  })
})
