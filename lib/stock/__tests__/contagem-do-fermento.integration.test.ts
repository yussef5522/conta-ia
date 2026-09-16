// ⛔⛔⛔ A CONTAGEM DO FERMENTO — a falha REPRODUZIDA, contra banco (16/09/2026)
//
// **O dono:** *"'Não consegui gravar a contagem' SEM MOTIVO."* — e o pedido foi explícito:
// *"o teste reproduz a falha e exige o motivo"*.
//
// ⭐ **A CENA É A DE PROD, com os números medidos:** o fermento tinha saldo **−1,921** e
// valor **−R$ 31,04** — resíduo de consumo lançado ANTES da nota de compra (as separações
// de 10 e 11/09 saíram a custo zero; depois a NF entrou 1,5 kg a R$ 62,28 e um ajuste de
// +21,24 entrou a custo ZERO, e as saídas seguintes drenaram o valor a 62,28/kg).
//
// ⚠️ **A QUANTIDADE DO DONO ESTÁ CERTA** — 10 kg é o que está na prateleira. O que o guard
// de 11/09 recusa é o VALOR ficar negativo com o saldo positivo. Por isso a mensagem antiga
// (*"confira a quantidade"*) mandava ele caçar um erro que não existe.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, MovementInvalidError } from '@/lib/stock/movement'
import { contarLinha } from '@/lib/stock/contagem'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

const SUFIXO = `fermento-${Date.now()}`
let companyId = ''
let itemId = ''
let contagemId = ''

beforeAll(async () => {
  const c = await prisma.company.create({ data: { name: `Empresa ${SUFIXO}`, cnpj: `77${Date.now()}`.slice(0, 14) } })
  companyId = c.id
  const item = await prisma.stockItem.create({
    data: { companyId, nome: 'fermento', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  itemId = item.id

  // ── a história real, na ordem em que aconteceu ──
  // 1. consumo ANTES de qualquer entrada (custo zero — não havia custo conhecido)
  await criarMovimento(prisma, { companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -21.24, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })
  // 2. a nota chega: 1,5 kg a R$ 62,28
  await criarMovimento(prisma, { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 1.5, custoUnitario: 62.28, custoTotal: 93.42, origem: 'SEFAZ' })
  // 3. um ajuste de contagem repõe a quantidade a custo ZERO
  await criarMovimento(prisma, { companyId, itemId, tipo: 'AJUSTE_CONTAGEM', quantidade: 21.24, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })
  // 4. as saídas seguintes drenam o valor pelo custo da NOTA, não pelo médio diluído
  await criarMovimento(prisma, { companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -1.0005, custoUnitario: 62.28, custoTotal: -62.31, origem: 'MANUAL' })
  await criarMovimento(prisma, { companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -0.9989, custoUnitario: 62.22, custoTotal: -62.15, origem: 'MANUAL' })
  await criarMovimento(prisma, { companyId, itemId, tipo: 'SEPARACAO_SAIDA', quantidade: -0.8006, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' })

  const sessao = await prisma.stockContagem.create({ data: { companyId, tipo: 'ROTINA', status: 'ABERTA' } })
  contagemId = sessao.id
})

afterAll(async () => {
  const sessoes = await prisma.stockContagem.findMany({ where: { companyId }, select: { id: true } })
  await prisma.stockContagemItem.deleteMany({ where: { contagemId: { in: sessoes.map((s) => s.id) } } })
  await prisma.stockContagem.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔ a cena de prod: o item está num estado que a contagem não consegue sair', () => {
  it('⭐ o estado impossível existe mesmo — saldo negativo COM valor negativo', async () => {
    const a = await prisma.stockMovement.aggregate({
      where: { companyId, itemId, tipo: { notIn: ['PRODUCAO_CONSUMO'] } },
      _sum: { quantidade: true, custoTotal: true },
    })
    expect(Number((a._sum.quantidade ?? 0).toFixed(3))).toBeCloseTo(-1.299, 2)
    expect(a._sum.custoTotal ?? 0).toBeLessThan(0)
  })

  /**
   * ⛔⛔ A FALHA, REPRODUZIDA. Contar 10 kg (a quantidade CERTA) cruza o zero com o valor
   * ainda negativo → o guard de 11/09 recusa. **Isso está correto** — o que estava errado
   * era a mensagem morrer no caminho.
   */
  it('⭐⭐ contar 10 FALHA — e o erro TEM motivo, não é genérico', async () => {
    let capturado: unknown = null
    try {
      await contarLinha({ companyId, contagemId, itemId, qtdContada: 10, confirmarFreio: true, viuSistema: true, observacao: null }, prisma)
    } catch (e) { capturado = e }

    expect(capturado, 'a contagem passou — o guard do estado impossível sumiu').toBeTruthy()
    expect(capturado).toBeInstanceOf(MovementInvalidError)

    // ⭐ E O MOTIVO CHEGA NA TELA — era exatamente isto que se perdia no `throw e`
    const r = respostaDeErroDoEstoque(capturado, { companyId: undefined, empresaId: companyId, itemId } as never)
    expect(r, 'o tradutor não reconheceu — viraria 500 mudo').toBeTruthy()
    expect(r!.status).toBe(422)
    expect(r!.erro, 'a mensagem chegou vazia').toMatch(/valor/i)
    expect(r!.erro, 'o número que explica sumiu').toMatch(/-?\d+[.,]\d\d/)
    expect(r!.saida, 'recusa sem saída é beco').toBeTruthy()
    expect(r!.saida!.href).toContain(itemId)
  })

  /**
   * ⭐⭐ E A SAÍDA FUNCIONA: lançada a ENTRADA que faltava (a compra que nunca foi
   * registrada), o valor deixa de ser negativo e **a mesma contagem grava**.
   *
   * ⚠️ É por isso que a saída aponta pro HISTÓRICO do item, e não pro "reunitizar": o
   * problema do fermento **não é unidade** — ele já é KG. Mandar o dono reunitizar seria
   * mandá-lo consertar o campo errado.
   */
  it('⭐⭐⭐ depois da entrada que faltava, a MESMA contagem grava', async () => {
    await criarMovimento(prisma, {
      companyId, itemId, tipo: 'ENTRADA_MANUAL', quantidade: 2, custoUnitario: 62.28, custoTotal: 124.56, origem: 'MANUAL',
    })
    const r = await contarLinha(
      { companyId, contagemId, itemId, qtdContada: 10, confirmarFreio: true, viuSistema: true, observacao: null },
      prisma,
    )
    expect(r.movementId, 'a contagem não gravou o ajuste').toBeTruthy()
    expect(r.saldoDepois).toBe(10)
  })
})
