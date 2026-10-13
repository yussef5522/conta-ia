/**
 * ⭐⭐⭐ O CUSTO MÉDIO NÃO MORRE QUANDO O ESTOQUE ZERA — NO LEDGER REAL (13/10/2026).
 *
 * ⚠️ REGRA 3: roda `criarMovimento` e `saldoItem` de verdade contra o banco — o choke-point
 * do writer, o CHECK do ledger e a porta de leitura inteiros. *"Guard que testa a função pura
 * não prova o encaixe dela"* — e o encaixe é justamente o que faltava: a lei pura já existia
 * em `custo-vigente.test.ts`, mas quem APAGAVA o custo era a porta.
 *
 * O CASO REAL (13/10): `metade de bolinha massa de pizza` tinha custo (~R$ 0,54), o serviço
 * consumiu tudo, o saldo foi a 0 → as 4 bases de pizza viraram "a apurar" e o montador apagou.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { saldoItem, custoMedioPorItem } from '../saldo'
import { memoriaDoLedger } from '../custo-vigente'
import { checkCustoVigenteInvariants } from '../custo-vigente-invariants'
import type { StockInvariantFail } from '../stock-invariants'

const CNPJ = '50607080001455' // ⚠️ exclusivo deste arquivo
let companyId = ''
let massaId = ''

async function item(nome: string, un = 'UN') {
  const i = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: un, categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    select: { id: true },
  })
  return i.id
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'custo-nao-morre', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
})

afterAll(async () => {
  await prisma.stockItemCustoVigente.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

beforeEach(async () => {
  await prisma.stockItemCustoVigente.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  massaId = await item('metade de bolinha massa de pizza')
})

describe('⭐⭐⭐ O CASO DA MASSA — consumir até o fim não apaga quanto a coisa custa', () => {
  it('⭐⭐ produziu 400 a R$ 0,54 → consumiu TUDO → o custo lido CONTINUA R$ 0,54', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'PRODUCAO_GERACAO',
      quantidade: 400, custoUnitario: 0.54, custoTotal: 216, origem: 'MANUAL',
    })
    const cheio = await saldoItem(prisma, companyId, massaId)
    expect(cheio.saldo).toBe(400)
    expect(cheio.custoMedio, 'com saldo em pé o custo é o derivado, como sempre').toBe(0.54)

    // ⭐ o serviço corta tudo de noite — o caso que apagou o montador
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'SEPARACAO_SAIDA',
      quantidade: -400, custoUnitario: 0.54, custoTotal: -216, origem: 'MANUAL',
    })

    const zerado = await saldoItem(prisma, companyId, massaId)
    expect(zerado.saldo).toBe(0)
    expect(zerado.valor).toBe(0)
    expect(
      zerado.custoMedio,
      '⛔ null aqui é o DEFEITO de 13/10: as 4 bases de pizza viram "a apurar" e o montador apaga',
    ).toBe(0.54)
  })

  it('⭐⭐ e com saldo NEGATIVO o custo continua — "uma coisa não tem nada a ver com a outra"', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'PRODUCAO_GERACAO',
      quantidade: 400, custoUnitario: 0.54, custoTotal: 216, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'SEPARACAO_SAIDA',
      quantidade: -400, custoUnitario: 0.54, custoTotal: -216, origem: 'MANUAL',
    })
    // vendeu sem produzir: o saldo vai pro negativo (sinal legítimo, nunca barrado)
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'BAIXA_VENDA',
      quantidade: -30, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL',
    })

    const neg = await saldoItem(prisma, companyId, massaId)
    expect(neg.saldo).toBe(-30)
    expect(neg.custoMedio, '⛔ null aqui faria a ficha piscar "a definir" num item que custa 0,54').toBe(0.54)
  })

  it('⭐ a porta da EMPRESA (a que ficha/cardápio/margem leem) devolve a mesma coisa', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'PRODUCAO_GERACAO',
      quantidade: 400, custoUnitario: 0.54, custoTotal: 216, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'SEPARACAO_SAIDA',
      quantidade: -400, custoUnitario: 0.54, custoTotal: -216, origem: 'MANUAL',
    })
    const mapa = await custoMedioPorItem(prisma, companyId)
    expect(mapa.get(massaId), 'é por este mapa que o custo da BASE da pizza é somado').toBe(0.54)
  })
})

describe('⛔ o item que nunca teve valor segue "a definir" — número inventado NUNCA', () => {
  it('contagem sem custo + baixa: saldo 0 e custo null (não inventa)', async () => {
    const semValor = await item('sal sem nota')
    await criarMovimento(prisma, {
      companyId, itemId: semValor, tipo: 'AJUSTE_CONTAGEM',
      quantidade: 5, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL', ancoraValorada: true,
    })
    await criarMovimento(prisma, {
      companyId, itemId: semValor, tipo: 'BAIXA_VENDA',
      quantidade: -5, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL',
    })
    const s = await saldoItem(prisma, companyId, semValor)
    expect(s.saldo).toBe(0)
    expect(s.custoMedio, 'inventar custo aqui poria preço chutado na ficha e no CMV').toBeNull()
    expect(await prisma.stockItemCustoVigente.count({ where: { companyId, itemId: semValor } })).toBe(0)
  })
})

describe('⭐⭐ a ENTRADA e a memória', () => {
  it('⭐ entrada com saldo ≤ 0: o custo REINICIA no custo da entrada (não na média contaminada)', async () => {
    const fermento = await item('fermento', 'KG')
    // o estado real do fermento: −5 KG com R$ −31 pendurados
    await prisma.stockMovement.create({
      data: { companyId, itemId: fermento, tipo: 'BAIXA_VENDA', quantidade: -5, custoUnitario: 6.2, custoTotal: -31, origem: 'MANUAL' },
    })
    await criarMovimento(prisma, {
      companyId, itemId: fermento, tipo: 'ENTRADA_NF',
      quantidade: 10, custoUnitario: 34, custoTotal: 340, origem: 'SEFAZ', confirmouResiduo: true,
    })
    const memoria = await prisma.stockItemCustoVigente.findUniqueOrThrow({
      where: { companyId_itemId: { companyId, itemId: fermento } },
    })
    expect(
      memoria.custoMedio,
      '⛔ a média ponderada daria 309 ÷ 5 = 61,80 — o resíduo negativo contaminando o preço de compra',
    ).toBe(34)
    // ⭐ e o rastro diz QUAL entrada ensinou
    expect(memoria.movimentoId).not.toBeNull()
  })

  it('⭐ entrada com saldo > 0: média ponderada, IGUAL a hoje, ao centavo (regressão)', async () => {
    const oleo = await item('oleo', 'LT')
    await criarMovimento(prisma, {
      companyId, itemId: oleo, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'SEFAZ',
    })
    await criarMovimento(prisma, {
      companyId, itemId: oleo, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 9, custoTotal: 90, origem: 'SEFAZ',
    })
    const s = await saldoItem(prisma, companyId, oleo)
    expect(s.saldo).toBe(20)
    expect(s.valor).toBe(140)
    expect(s.custoMedio, 'o número de sempre: 140 ÷ 20').toBe(7)
    // ⭐ e a memória concorda com a tela — nunca dois números pro mesmo custo
    const memoria = await prisma.stockItemCustoVigente.findUniqueOrThrow({
      where: { companyId_itemId: { companyId, itemId: oleo } },
    })
    expect(memoria.custoMedio).toBe(7)
  })

  it('⛔⛔ a ficha fechada com saldo > 0 NÃO muda nada de custo com a lei nova (regressão ao centavo)', async () => {
    // os números REAIS das bases de pizza medidos em prod em 13/10
    const queijo = await item('porçao queijo 135 grama')
    const caixa = await item('CAIXA P/ PIZZA 35 cm')
    await criarMovimento(prisma, {
      companyId, itemId: queijo, tipo: 'PRODUCAO_GERACAO', quantidade: 822, custoUnitario: 4.2, custoTotal: 3452.4, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: caixa, tipo: 'ENTRADA_NF', quantidade: 8029, custoUnitario: 2.74, custoTotal: 21999.46, origem: 'SEFAZ',
    })
    const mapa = await custoMedioPorItem(prisma, companyId)
    expect(mapa.get(queijo)).toBe(4.2)
    expect(mapa.get(caixa)).toBe(2.74)
  })
})

describe('⭐⭐⭐ E17 — o JUIZ EXECUTADO contra um drift de verdade', () => {
  /**
   * ⚠️⚠️ ESTE BLOCO EXISTE PORQUE A REGRA 11 PEGOU O GUARD DELE VERDE. Enquanto o E17 era
   * inline no `stock-invariants.ts`, o único jeito de travá-lo era grep de símbolo — e
   * `void memoriaDoLedger` passa por "uso" (*"menção, não uso"*, 15ª vez nesta casa). Agora
   * o teste **roda o juiz** e olha o que ele acusa (REGRA 3).
   */
  async function massaZerada() {
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'PRODUCAO_GERACAO',
      quantidade: 400, custoUnitario: 0.54, custoTotal: 216, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'SEPARACAO_SAIDA',
      quantidade: -400, custoUnitario: 0.54, custoTotal: -216, origem: 'MANUAL',
    })
  }
  // ⚠️ tipado com StockInvariantFail (não uma forma estrutural): com `{invariante, companyId}`
  // o TS infere o retorno SEM `nivel`/`detalhe`, e as asserções sobre eles param de compilar.
  const e17 = (fails: StockInvariantFail[]) =>
    fails.filter((f) => f.invariante === 'E17' && f.companyId === companyId)

  it('⭐ memória coerente com o ledger → o juiz CALA', async () => {
    await massaZerada()
    expect(e17(await checkCustoVigenteInvariants(prisma, [companyId]))).toEqual([])
  })

  it('⛔⛔ memória DRIFTADA (caminho que furou o choke-point) → ERRO que nomeia o item', async () => {
    await massaZerada()
    await prisma.stockItemCustoVigente.update({
      where: { companyId_itemId: { companyId, itemId: massaId } },
      data: { custoMedio: 99 },
    })
    const achados = e17(await checkCustoVigenteInvariants(prisma, [companyId]))
    expect(achados).toHaveLength(1)
    expect(achados[0].nivel ?? 'erro', 'drift de custo é ERRO, não aviso').toBe('erro')
    expect(achados[0].detalhe).toContain(massaId)
    expect(achados[0].detalhe).toContain('99.00')
    expect(achados[0].detalhe).toContain('0.54')
  })

  it('⚠️ memória FALTANDO com ledger que sabe o custo → AVISO (é o backfill pendente)', async () => {
    await massaZerada()
    await prisma.stockItemCustoVigente.deleteMany({ where: { companyId, itemId: massaId } })
    const achados = e17(await checkCustoVigenteInvariants(prisma, [companyId]))
    expect(achados).toHaveLength(1)
    expect(achados[0].nivel, 'falta de backfill não deixa o selo vermelho').toBe('aviso')
    expect(achados[0].detalhe).toContain('SEM memória de custo')
  })

  it('⛔ item que nunca teve valor NÃO vira achado (senão o juiz grita por item sem compra)', async () => {
    const semValor = await item('sal sem nota')
    await criarMovimento(prisma, {
      companyId, itemId: semValor, tipo: 'AJUSTE_CONTAGEM',
      quantidade: 5, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL', ancoraValorada: true,
    })
    await criarMovimento(prisma, {
      companyId, itemId: semValor, tipo: 'BAIXA_VENDA',
      quantidade: -5, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL',
    })
    expect(e17(await checkCustoVigenteInvariants(prisma, [companyId]))).toEqual([])
  })
})

describe('⭐⭐⭐ o replay do ledger CONCORDA com o campo persistido (é o juiz E17)', () => {
  it('a memória gravada pelo writer == a memória que o ledger diz', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'PRODUCAO_GERACAO',
      quantidade: 400, custoUnitario: 0.54, custoTotal: 216, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: massaId, tipo: 'SEPARACAO_SAIDA',
      quantidade: -400, custoUnitario: 0.54, custoTotal: -216, origem: 'MANUAL',
    })
    const persistido = (await prisma.stockItemCustoVigente.findUniqueOrThrow({
      where: { companyId_itemId: { companyId, itemId: massaId } },
    })).custoMedio
    const doLedger = await memoriaDoLedger(prisma, companyId, massaId)
    expect(doLedger).toBe(persistido)
    expect(doLedger).toBe(0.54)
  })
})
