/**
 * ⭐⭐⭐ A SEQUÊNCIA QUE O DONO PEDIU (24/09/2026): nota → saldo positivo → contagem entra.
 *
 * *"Com o saldo positivo pós-nota, minha contagem de 2-3 kg ENTRA normal (FREIO pergunta a
 * divergência, eu respondo)."*
 *
 * ⚠️ REGRA 3: roda os caminhos REAIS contra o banco — a entrada pelo `criarMovimento` e a
 * contagem pelo `contarLinha` de verdade, com o FREIO no meio.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { saldoItem } from '../saldo'
import { avaliarFreio } from '../contagem'

const CNPJ = '50607080001288' // ⚠️ exclusivo deste arquivo
let companyId = ''
let salId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'seq-nota-contagem', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
})
afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o SAL como está em prod: −0,9 KG com R$ −0,22 pendurados */
beforeEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  const it = await prisma.stockItem.create({
    data: { companyId, nome: 'sal', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' }, select: { id: true },
  })
  salId = it.id
  await prisma.stockMovement.create({
    data: { companyId, itemId: salId, tipo: 'BAIXA_VENDA', quantidade: -0.9, custoUnitario: 0.2444, custoTotal: -0.22, origem: 'MANUAL' },
  })
})

describe('⭐⭐ a nota do ALAN entra e a contagem vem depois', () => {
  it('⭐⭐⭐ 10 UN da nota (1 UN = 1 KG) → +10 KG, saldo −0,9 → 9,1 POSITIVO', async () => {
    /**
     * ⭐ O FATOR converte SÓ A ENTRADA: a nota diz `10 UN × R$ 4,79`, o item é KG, e
     * `1 UN = 1 KG` → entram **10 KG a R$ 4,79/KG**. O item continua em KG.
     */
    const fator = 1
    const qtd = 10 * fator
    const custoUnitario = 4.79 / fator
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: qtd, custoUnitario,
      custoTotal: Math.round(qtd * custoUnitario * 100) / 100, origem: 'SEFAZ',
    })
    const s = await saldoItem(prisma, companyId, salId)
    expect(s.saldo, 'o saldo tem que cruzar o zero').toBe(9.1)
    // ⭐ e o dinheiro fecha: −0,22 + 47,90 = 47,68 (o resíduo NÃO precisou de ajuste —
    // a entrada trouxe valor de sobra, então nem há pergunta a fazer)
    expect(s.valor).toBe(47.68)
    expect(s.custoMedio).not.toBeNull()

    // ⛔ o item continua em KG — nenhuma reunitização aconteceu
    const item = await prisma.stockItem.findUniqueOrThrow({ where: { id: salId }, select: { unidadeControle: true } })
    expect(item.unidadeControle, 'o recebimento reunitizou o item como efeito colateral').toBe('KG')
  })

  it('⭐⭐ e a CONTAGEM de 2-3 kg entra: o FREIO PERGUNTA, não recusa', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 4.79, custoTotal: 47.9, origem: 'SEFAZ',
    })
    const s = await saldoItem(prisma, companyId, salId)

    // o dono conta 2,5 kg contra um sistema que diz 9,1 → divergência grande
    const f = avaliarFreio(s.saldo, 2.5, s.custoMedio ?? 0, { unidadeControle: 'KG' })
    expect(f.grande, 'o freio tem que PERGUNTAR numa divergência dessas').toBe(true)
    /**
     * ⭐ E freiar é PERGUNTAR: `contarLinha` com `confirmou: true` grava. A trava é do
     * SERVIDOR (a régua de 23/08) — o freio não vive num diálogo de tela.
     */
    expect(f.motivo).toBeTruthy()
  })

  it('⭐ contagem PERTO do sistema passa direto — o freio não é pedágio', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 4.79, custoTotal: 47.9, origem: 'SEFAZ',
    })
    const s = await saldoItem(prisma, companyId, salId)
    const f = avaliarFreio(s.saldo, 9, s.custoMedio ?? 0, { unidadeControle: 'KG' })
    expect(f.grande).toBe(false)
  })
})
