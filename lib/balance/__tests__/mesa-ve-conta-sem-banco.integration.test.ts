/**
 * ⛔⛔⛔ **A MESA ① VÊ A CONTA A PAGAR QUE NASCE SEM CONTA BANCÁRIA (15/10/2026).**
 *
 * **O defeito, medido em prod:** a mesa mostrava `CONTAS 7 DIAS: total R$ 0` com
 * **R$ 58.653,84 vencendo em 39 contas**, e o radar dizia **"Vencem hoje · nada"** com
 * **R$ 17.701,34 vencendo HOJE**. ***Radar que mente verde é pior que radar vermelho
 * errado*** — o dono lê "nada" e não paga.
 *
 * **A causa:** as duas consultas filtravam por `bankAccount: { companyId }`, e **conta a
 * pagar NASCE SEM `bankAccountId`** (a ponte do estoque, desde 24/08). Quem a prende à
 * empresa é fornecedor/funcionário/cliente/categoria. Medido em prod: **110 PAYABLE da
 * empresa, ZERO com conta bancária.** O filtro não erra: devolve ZERO, e em SILÊNCIO.
 *
 * ⚠️⚠️ **É A TERCEIRA VEZ DESTA CLASSE NESTA CASA** (F1 da ponte em 24/08, o selo dos custos
 * fixos em 06/10, a mesa agora) — e as duas primeiras foram consertadas **no call-site**, com
 * a régua seguindo um `const` LOCAL dentro do `buildPayableListWhere`. ⭐ Invisível pra quem
 * escreve a consulta nova, e **a consulta nova é sempre a que esquece**. Agora a decisão tem
 * dono exportado (`ramosDaEmpresaEmContaAPagar`).
 *
 * ⛔⛔ **E ESTE TESTE RODA `lerMesaDeOperacoes` DE VERDADE, contra o banco.** Um teste do
 * `where` isolado seria o *"guard que testa a lib e aprova a tela que a ignora"* — a lib
 * estava certa o tempo todo; quem ignorava era a mesa. O que morde é o caminho real.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { lerMesaDeOperacoes } from '../mesa-de-operacoes'

const CNPJ = '66666666000166'
let companyId: string
let supplierId: string
let categoryId: string

/** o "agora" é relativo ao relógio — data fixa no futuro é bomba de calendário (REGRA 12) */
const AGORA = new Date()
const diaBrasil = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const noDia = (offsetDias: number) => {
  const base = new Date(`${diaBrasil(AGORA)}T00:00:00.000Z`)
  return new Date(base.getTime() + offsetDias * 24 * 3600 * 1000)
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA MESA' } })).id
  supplierId = (
    await prisma.supplier.create({ data: { companyId, razaoSocial: 'FORNECEDOR DA MESA' } })
  ).id
  categoryId = (
    await prisma.category.create({
      data: { companyId, name: 'Matéria-Prima da Mesa', type: 'EXPENSE', dreGroup: 'CUSTO_MERCADORIA' },
    })
  ).id
})

afterEach(async () => {
  await prisma.transaction.deleteMany({ where: { OR: [{ supplier: { companyId } }, { category: { companyId } }] } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/** cria a conta a pagar exatamente como a ponte do estoque cria: **sem `bankAccountId`** */
async function contaSemBanco(valor: number, venceEm: Date, descricao: string) {
  return prisma.transaction.create({
    data: {
      description: descricao,
      amount: valor,
      type: 'DEBIT',
      date: venceEm,
      dueDate: venceEm,
      lifecycle: 'PAYABLE',
      status: 'PENDING',
      supplierId,
      categoryId,
      // ⛔ bankAccountId: NENHUM — é o estado real de 110 de 110 contas em prod
    },
  })
}

describe('⛔⛔ a mesa ① não pode mentir "nada a pagar"', () => {
  it('⭐⭐ CONTAS 7 DIAS enxerga a conta que nasceu SEM conta bancária', async () => {
    await contaSemBanco(1_000, noDia(0), 'vence HOJE')
    await contaSemBanco(2_500, noDia(2), 'vence em 2 dias')
    await contaSemBanco(400, noDia(6), 'vence em 6 dias')
    // ⚠️ fora da janela: prova que o recorte de 7 dias continua recortando
    await contaSemBanco(99_999, noDia(20), 'vence em 20 dias — FORA')

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)

    /**
     * ⚠️⚠️ **O TESTE CORRIGIU A MINHA ARITMÉTICA, e a diferença é DESENHO:** eu esperava
     * 3.900 (as três). São **2.900** — `contas7Dias` usa `whereDoStatus('A_PAGAR')`, que
     * **começa AMANHÃ**, porque `VENCE_HOJE` é uma PARTIÇÃO própria desde 26/09. ⛔ Somar as
     * duas contaria a mesma conta 2× (foi o defeito do "a vencer 3d"). O boleto de hoje mora
     * na linha do radar, provada no teste abaixo.
     */
    expect(
      mesa.contas7Dias.total,
      'a mesa dizia R$ 0 com R$ 58.653,84 vencendo — o filtro por bankAccount devolve ZERO em silêncio',
    ).toBeCloseTo(2_900, 2)
    expect(mesa.contas7Dias.topo.length + mesa.contas7Dias.resto, 'as 2 de amanhã em diante').toBe(2)
    expect(
      mesa.contas7Dias.topo.some((c) => /FORA/.test(c.descricao ?? '')),
      'a de 20 dias fica FORA — o recorte de 7 dias continua recortando',
    ).toBe(false)
  })

  it('⭐⭐ "VENCEM HOJE" não diz "nada" quando há conta vencendo hoje', async () => {
    await contaSemBanco(17_701.34, noDia(0), 'os 7 boletos de hoje')

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    const linha = mesa.radar.linhas.find((l) => /vencem hoje/i.test(l.rotulo))

    expect(linha, 'a linha do radar existe').toBeTruthy()
    expect(
      linha!.valor,
      'o radar dizia "nada" com R$ 17.701,34 vencendo hoje — radar que mente verde é o pior dos dois',
    ).not.toMatch(/nada/i)
    expect(linha!.gravidade, 'conta vencendo hoje não é VERDE').not.toBe('VERDE')
  })

  it('⭐ a janela e o escopo de EMPRESA continuam valendo (não é afrouxamento)', async () => {
    // conta de OUTRA empresa, com o mesmo vencimento — não pode vazar
    const outra = await prisma.company.create({ data: { cnpj: '00000000000191', name: 'OUTRA' } })
    const fornOutra = await prisma.supplier.create({
      data: { companyId: outra.id, razaoSocial: 'FORNECEDOR DE OUTRA' },
    })
    await prisma.transaction.create({
      data: {
        description: 'conta da OUTRA empresa', amount: 50_000, type: 'DEBIT',
        date: noDia(1), dueDate: noDia(1), lifecycle: 'PAYABLE', status: 'PENDING',
        supplierId: fornOutra.id,
      },
    })
    await contaSemBanco(123.45, noDia(1), 'a minha')

    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.contas7Dias.total, 'só a desta empresa').toBeCloseTo(123.45, 2)

    await prisma.transaction.deleteMany({ where: { supplier: { companyId: outra.id } } })
    await prisma.supplier.deleteMany({ where: { companyId: outra.id } })
    await prisma.company.delete({ where: { id: outra.id } })
  })

  it('⭐ zero HONESTO continua zero — sem conta nenhuma, a mesa diz R$ 0', async () => {
    const mesa = await lerMesaDeOperacoes(companyId, AGORA, prisma)
    expect(mesa.contas7Dias.total).toBe(0)
    const linha = mesa.radar.linhas.find((l) => /vencem hoje/i.test(l.rotulo))
    expect(linha!.valor, 'aqui "nada" é a verdade').toMatch(/nada/i)
  })
})
