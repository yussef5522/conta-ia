// ⭐⭐ CONVERTER A UNIDADE — O CASO DO OVO (30/08/2026).
//
// O dono não conseguiu converter as 36 cartelas em 1.080 ovos: o gatilho do bloco na
// ficha era `text-xs text-slate-400`, sem borda e sem ícone, com sublinhado só no `hover`
// (que no celular não existe) — ele leu como legenda. **O `onClick` sempre esteve lá e a
// API sempre respondeu**; o defeito era de AFORDÂNCIA. Mas o efeito pra ele é o mesmo:
// não dá pra converter. Controle que ninguém reconhece como controle é controle morto.
//
// Este teste roda o CAMINHO que a tela chama (prévia → aplicar) com os números reais de
// prod depois da cirurgia: 36 UN × R$ 18,00 = R$ 648,00.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { previewReunitizar, reunitizarItem } from '../reunitizar-item'
import { saldoItem } from '../saldo'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const CNPJ = '54545454000154'
let companyId: string, itemId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'OVO TESTE' } })).id
  itemId = (await prisma.stockItem.create({
    data: { companyId, nome: 'OVO BRANCO CARTELA GRAUDO', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })).id
  // as 3 notas da CIA DA FRUTA, já corrigidas pela cirurgia: 12 cartelas × R$ 18,00
  for (const chave of ['CHAVE1020', 'CHAVE1021', 'CHAVE1022']) {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 12, custoUnitario: 18, custoTotal: 216,
      nfeChave: chave, receiptId: null, nItem: null, origem: 'SEFAZ',
    })
  }
})

afterEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockSaldoCache.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockSupplierProduct.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ 36 cartelas → 1.080 ovos, com o valor INTACTO', () => {
  it('⭐⭐ a PRÉVIA (o que o botão "ver a prévia" chama) dá os números de prod', async () => {
    const p = await previewReunitizar(companyId, itemId, 30, prisma)
    expect(p.antes.saldo).toBe(36)
    expect(p.antes.custoMedio).toBe(18)
    expect(p.antes.valor).toBe(648)

    expect(p.depois.saldo).toBe(1080)
    expect(p.depois.custoMedio).toBe(0.6)
    // ⭐ A INVARIANTE: só a régua muda, o dinheiro não
    expect(p.depois.valor).toBe(648)
    expect(p.movimentos).toBe(3)
  })

  it('⭐⭐ APLICAR converte de verdade e o valor continua 648,00', async () => {
    await reunitizarItem({ companyId, itemId, fator: 30, novoNome: 'OVO BRANCO (unidade)' }, prisma)
    const s = await saldoItem(prisma, companyId, itemId)
    expect(s.saldo).toBe(1080)
    expect(s.custoMedio).toBe(0.6)
    expect(s.valor).toBe(648)
  })

  it('⭐ o LEDGER não perde linha: cada entrada vira estorno + linha na régua nova', async () => {
    await reunitizarItem({ companyId, itemId, fator: 30 }, prisma)
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId } })
    expect(movs).toHaveLength(9) // 3 originais + 3 estornos + 3 novas
    // e a soma dos valores é a mesma de sempre
    expect(Math.round(movs.reduce((acc, m) => acc + m.custoTotal, 0) * 100) / 100).toBe(648)
  })

  it('⚠️ a procedência sobrevive — cada linha nova mantém a chave da nota (o E16 fecha)', async () => {
    await reunitizarItem({ companyId, itemId, fator: 30 }, prisma)
    for (const chave of ['CHAVE1020', 'CHAVE1021', 'CHAVE1022']) {
      const daNota = await prisma.stockMovement.findMany({ where: { companyId, nfeChave: chave } })
      expect(Math.round(daNota.reduce((acc, m) => acc + m.custoTotal, 0) * 100) / 100).toBe(216)
    }
  })

  it('⭐ o fator da NOTA é atualizado — a próxima entra convertida sozinha', async () => {
    await prisma.stockSupplierProduct.create({
      data: { companyId, supplierCnpj: '36603841000130', cProd: 'OVO1', xProd: 'OVO BRANCO CARTELA GRAUDO', itemId, fatorConversao: 1 },
    })
    await reunitizarItem({ companyId, itemId, fator: 30, ajustarFatorDasNotas: true }, prisma)
    const mp = await prisma.stockSupplierProduct.findFirstOrThrow({ where: { companyId, cProd: 'OVO1' } })
    expect(mp.fatorConversao).toBe(30)
  })
})

describe('⚠️ o GATILHO tem que parecer um controle (guard de afordância)', () => {
  // ⚠️ ESTRUTURAL de propósito: o projeto roda em `environment: node`, sem jsdom, então
  // não dá pra clicar de verdade aqui. O que este guard trava é o que QUEBROU na prática —
  // o gatilho ter virado texto indistinguível de legenda. A validação visual é REGRA 2,
  // do dono, no celular dele.
  const fonte = readFileSync(
    join(__dirname, '..', '..', '..', 'app/(dashboard)/empresas/[id]/estoque/itens/[itemId]/page.tsx'),
    'utf-8',
  )

  it('⭐ o gatilho é um <button> com aria-expanded (disclosure de verdade)', () => {
    expect(fonte).toMatch(/aria-expanded=\{false\}/)
  })

  it('⭐⭐ e tem afordância VISÍVEL — borda e chevron, não só hover', () => {
    // o hover não existe no celular; foi exatamente por isso que o dono não viu o controle
    const trecho = fonte.slice(fonte.indexOf('Converter a unidade') - 900, fonte.indexOf('Converter a unidade') + 400)
    expect(trecho).toMatch(/border/)
    expect(trecho).toMatch(/ChevronDown/)
  })
})
