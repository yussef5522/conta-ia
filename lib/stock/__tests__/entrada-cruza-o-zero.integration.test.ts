/**
 * ⭐⭐⭐ A ENTRADA CRUZANDO O ZERO NO LEDGER REAL (23/09/2026).
 *
 * ⚠️ REGRA 3: roda o `criarMovimento` de verdade contra o banco — o guard, o ajuste e o
 * CHECK do ledger inteiros. Guard que testa a função pura não prova o encaixe dela.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarMovimento, MovementInvalidError } from '../movement'
import { saldoItem } from '../saldo'
import { TIPO_AJUSTE_RESIDUO } from '../entrada-cruza-o-zero'

const CNPJ = '50607080001199' // ⚠️ exclusivo deste arquivo
let companyId = ''
let salId = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const co = await prisma.company.create({ data: { name: 'cruza-o-zero', cnpj: CNPJ }, select: { id: true } })
  companyId = co.id
})

afterAll(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o cenário REAL do sal: −0,9 KG com R$ −0,22 pendurados */
beforeEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  const it = await prisma.stockItem.create({
    data: { companyId, nome: 'sal', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' }, select: { id: true },
  })
  salId = it.id
  // ⚠️ o negativo nasce como nasce na vida real: consumo sem a compra correspondente
  await prisma.stockMovement.create({
    data: { companyId, itemId: salId, tipo: 'BAIXA_VENDA', quantidade: -0.9, custoUnitario: 0.2444, custoTotal: -0.22, origem: 'MANUAL' },
  })
})

describe('⛔⛔ item negativo NÃO trava a nota que chega', () => {
  it('⭐⭐ O CASO DO ALAN: a entrada PERGUNTA em vez de recusar (nada gravado)', async () => {
    const e = await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 2.9, custoUnitario: 0, custoTotal: 0, origem: 'SEFAZ',
    }).catch((err: unknown) => err)

    expect(e).toBeInstanceOf(MovementInvalidError)
    const c = (e as MovementInvalidError & { culpado?: { code?: string; residuo?: number } }).culpado
    expect(c?.code, 'a recusa não é uma PERGUNTA — o dono fica no beco').toBe('RESIDUO_AO_CRUZAR_O_ZERO')
    expect(c?.residuo).toBe(-0.22)
    // ⛔ e NADA gravou: nem a entrada, nem o ajuste
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'ENTRADA_NF' } })).toBe(0)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: TIPO_AJUSTE_RESIDUO } })).toBe(0)
  })

  it('⭐⭐⭐ confirmando, a nota ENTRA e o resíduo vira ajuste REGISTRADO', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 2.9, custoUnitario: 0, custoTotal: 0,
      origem: 'SEFAZ', confirmouResiduo: true,
    })
    const s = await saldoItem(prisma, companyId, salId)
    expect(s.saldo, 'o saldo tem que cruzar o zero').toBe(2)
    expect(s.valor, 'o dinheiro pendurado tem que ter sido zerado').toBe(0)

    // ⭐ e o ajuste é uma linha PRÓPRIA, nomeada — nunca um custo inflado na entrada
    const aj = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: TIPO_AJUSTE_RESIDUO } })
    expect(aj.custoTotal).toBe(0.22)
    /**
     * ⛔⛔ **A NOTA NÃO É REESCRITA.** Somar os 22 centavos no `custoTotal` da ENTRADA_NF
     * quebraria o invariante **E16** (`Σ(ENTRADA_NF da nota) == Σ(vProd)`): o documento
     * assinado pela SEFAZ passaria a "valer" mais do que diz.
     */
    const entrada = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: 'ENTRADA_NF' } })
    expect(entrada.custoTotal, 'a nota veio a custo 0 e tem que ENTRAR a custo 0').toBe(0)
  })

  it('⭐ com a entrada trazendo dinheiro, passa direto (sem ajuste nenhum)', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 2.9, custoUnitario: 5, custoTotal: 14.5, origem: 'SEFAZ',
    })
    const s = await saldoItem(prisma, companyId, salId)
    expect(s.saldo).toBe(2)
    expect(s.valor).toBe(14.28)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: TIPO_AJUSTE_RESIDUO } })).toBe(0)
  })

  it('⛔⛔ a CONTAGEM sobre o negativo continua na porta de 22/09 — não vira pergunta de centavo', async () => {
    const e = await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'AJUSTE_CONTAGEM', quantidade: 2.9, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL',
    }).catch((err: unknown) => err)
    /**
     * ⚠️ Contar por cima NÃO é o conserto — é o enterro do lançamento que falta. Se esta
     * asserção cair, a régua nova engoliu a porta do negativo (foi o que aconteceu na 1ª
     * versão, e quem pegou foi o teste da porta, não eu).
     */
    const c = (e as MovementInvalidError & { culpado?: { code?: string } }).culpado
    expect(c?.code, 'a contagem passou a ser tratada como entrada — a porta de 22/09 foi engolida')
      .not.toBe('RESIDUO_AO_CRUZAR_O_ZERO')
  })

  it('⭐ o ajuste ENTRA no saldo (não é linha invisível) e não move a quantidade', async () => {
    await criarMovimento(prisma, {
      companyId, itemId: salId, tipo: 'ENTRADA_NF', quantidade: 2.9, custoUnitario: 0, custoTotal: 0,
      origem: 'SEFAZ', confirmouResiduo: true,
    })
    const aj = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: TIPO_AJUSTE_RESIDUO } })
    // ⚠️ 0,001 é o menor passo que o módulo reconhece (o CHECK recusa quantidade ZERO) e o
    // `round2` do saldo o absorve — o mesmo idioma do `encerrar-item`.
    expect(aj.quantidade).toBe(0.001)
    expect((await saldoItem(prisma, companyId, salId)).saldo).toBe(2)
  })
})
