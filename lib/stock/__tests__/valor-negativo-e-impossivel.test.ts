// ⛔⛔⛔ SALDO POSITIVO COM DINHEIRO NEGATIVO NÃO EXISTE (11/09/2026)
//
// **O caso real:** o import de 10/09 baixou **1.499 FANTA UVA** (o real era 1) → saldo
// −1.492. A marcyelle contou **+1.496 a R$ 0,00** pra consertar o saldo → ficou **4
// unidades e −R$ 10.160,52**. O custo médio virou **−R$ 2.540,13**, e daí contaminou a
// Posição, o cardápio (margem 5218%) e o CMV.
//
// **O dono:** *"valor negativo com saldo positivo é impossível, não improvável — barra na
// escrita."* ⚠️ E o guard mora no choke-point do LEDGER, não na tela: a Posição é
// derivada, então checar lá seria checar **depois** do estrago.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, MovementInvalidError } from '../movement'
import { saldoItem } from '../saldo'

const companyId = `neg-test-${Date.now()}`
let itemId = ''

beforeAll(async () => {
  const i = await prisma.stockItem.create({
    data: { companyId, nome: 'FANTA UVA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' },
    select: { id: true },
  })
  itemId = i.id
  // a geladeira real: 7 garrafas a R$ 6,81
  await criarMovimento(prisma, {
    companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 7, custoUnitario: 6.81, origem: 'SEFAZ',
  })
})

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
})

describe('⛔⛔ o estado impossível é barrado na escrita', () => {
  it('⚠️ a baixa que deixa SALDO negativo continua passando — é sinal legítimo', async () => {
    // "vendeu sem produzir" é um aviso do módulo desde 03/09; barrá-lo esconderia o aviso
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'BAIXA_VENDA', quantidade: -1499, custoUnitario: 6.81, origem: 'VENDA',
    })
    const s = await saldoItem(prisma, companyId, itemId)
    expect(s.saldo).toBe(-1492)
    expect(s.valor).toBeLessThan(0)      // saldo e valor negativos JUNTOS é coerente
  })

  it('⛔⛔ mas a contagem a custo ZERO que criaria "4 un · −R$ 10.160" é RECUSADA', async () => {
    // é exatamente a linha que a marcyelle gravou em 11/09
    await expect(criarMovimento(prisma, {
      companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: 1496, custoUnitario: 0, origem: 'CONTAGEM',
    })).rejects.toBeInstanceOf(MovementInvalidError)

    // ⭐ e NADA foi gravado: o saldo segue o de antes
    const s = await saldoItem(prisma, companyId, itemId)
    expect(s.saldo).toBe(-1492)
  })

  /**
   * ⚠️⚠️ REAPONTADO EM 16/09 — A MENSAGEM PASSOU A APONTAR O CAMPO CERTO.
   *
   * Ela dizia sempre *"confira a quantidade"*. No caso do **fermento** (saldo −1,921 com
   * valor −R$ 31,04) a quantidade do dono estava **CERTA** — 10 kg é o que está na
   * prateleira; o sintoma era o VALOR, resíduo de consumo lançado antes da compra.
   * *Mensagem que acusa o campo errado faz o dono caçar um erro que não existe.*
   *
   * ⭐ Agora ela separa os casos: **saldo que CRUZA o zero** → falta a COMPRA; saldo que
   * já estava positivo → aí sim a quantidade é a suspeita. Este cenário (a Coca de 11/09)
   * vem de −1.492, então ele cai no primeiro.
   *
   * ⚠️⚠️ E O TESTE ANTIGO PASSAVA POR VACUIDADE: era `try/catch` **sem `expect.fail()`** —
   * se `criarMovimento` não lançasse, o catch nunca rodava e o teste ficava verde sem
   * asserção nenhuma. Agora a rejeição é exigida.
   */
  it('⭐ a mensagem ensina onde olhar — e aqui o sintoma é a COMPRA que falta', async () => {
    await expect(criarMovimento(prisma, {
      companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: 1496, custoUnitario: 0, origem: 'CONTAGEM',
    })).rejects.toThrow(/não existe/)

    await expect(criarMovimento(prisma, {
      companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: 1496, custoUnitario: 0, origem: 'CONTAGEM',
    })).rejects.toThrow(/falta registrar a COMPRA/)
  })

  it('⭐ e a contagem com o CUSTO CERTO passa — o guard não trava trabalho honesto', async () => {
    const ok = await criarMovimento(prisma, {
      companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: 1496, custoUnitario: 6.81, origem: 'CONTAGEM',
    })
    expect(ok.id).toBeTruthy()
    const s = await saldoItem(prisma, companyId, itemId)
    expect(s.saldo).toBe(4)
    expect(s.valor).toBeGreaterThan(0)   // ⭐ 4 unidades com dinheiro positivo
  })
})
