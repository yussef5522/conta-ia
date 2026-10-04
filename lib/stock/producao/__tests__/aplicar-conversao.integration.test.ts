/**
 * ⭐⭐ O GESTO DA CONVERSÃO CONTRA O BANCO — versiona, não sobrescreve, e NUNCA converte 2×.
 *
 * ⚠️ **O teste que mais importa aqui é o da SEGUNDA conversão.** O dono vai varrer 37 fichas
 * numa sentada, com o celular e o notebook abertos, e a marcyelle pode estar na mesma tela.
 * Converter a mesma ficha duas vezes **divide as doses duas vezes** — a receita passa a pedir
 * 1/N do material e a cozinha descobre com a panela na mão.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { aplicarConversaoDeLote, ConversaoError } from '../aplicar-conversao'
import { fichasParaConverter } from '../fichas-para-converter'
import { criarFicha } from '../fichas'

const CNPJ = '72727272000253'
let companyId = ''

async function fichaEmKg(nome: string, loteBase = 1, dose = 0.18) {
  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: `Coxão ${nome}`, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  const sal = await prisma.stockItem.create({
    data: { companyId, nome: `sal ${nome}`, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' },
  })
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: nome,
      unidadeProduzido: 'UN', // ⭐ o produto se CONTA em UN…
      tipoProduto: 'INTERMEDIARIO',
      loteBase,
      unidadeLoteBase: 'KG', // …e o lote declara KG: é o caso dos 37
      componentes: [
        { itemId: insumo.id, qtdPlanejada: dose, unidade: 'KG' },
        { itemId: sal.id, qtdPlanejada: 0.002, unidade: 'KG' },
      ],
      modoPreparo: 'moer e moldar',
      validadeDias: 90,
    },
    prisma,
  )
  return { fichaId: f.fichaId, insumoId: insumo.id, salId: sal.id }
}

const versoesDe = (fichaId: string) =>
  prisma.stockFichaVersao.findMany({ where: { companyId, fichaId }, orderBy: { versao: 'asc' } })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'APLICAR CONVERSAO' } })
  companyId = c.id
})

afterEach(async () => {
  for (const t of ['stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } }).catch(() => {})
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐⭐ a conversão vira VERSÃO NOVA e a anterior fica no histórico', () => {
  it('⭐ 1 UN por receita: lote vira 1 UN, doses INTACTAS, e a v1 continua lá', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')

    const r = await aplicarConversaoDeLote(companyId, fichaId, 1, 'user-dono', prisma)
    expect(r).toMatchObject({ versao: 2, loteBaseNovo: 1, unidadeLoteBaseNova: 'UN', soRotulo: true, dosesAlteradas: 0 })

    const vs = await versoesDe(fichaId)
    expect(vs).toHaveLength(2)
    // ⭐ a v1 fica como veio — nunca sobrescreve
    expect(vs[0]).toMatchObject({ versao: 1, loteBase: 1, unidadeLoteBase: 'KG' })
    expect(vs[1]).toMatchObject({ versao: 2, loteBase: 1, unidadeLoteBase: 'UN', criadoPorId: 'user-dono' })

    // ⭐ as doses da v2 são as mesmas (o caso 1:1)
    const comps = await prisma.stockFichaComponente.findMany({ where: { companyId, versaoId: vs[1].id }, orderBy: { posicao: 'asc' } })
    expect(comps.map((c) => c.qtdPlanejada)).toEqual([0.18, 0.002])

    // ⭐ e o `versaoAtual` do head andou
    const head = await prisma.stockFicha.findUniqueOrThrow({ where: { id: fichaId } })
    expect(head.versaoAtual).toBe(2)
  })

  it('⭐ a MAIONESE (2,858) divide as doses — e DIZ que dividiu', async () => {
    const { fichaId } = await fichaEmKg('MAIONESE', 2.858, 3)
    const r = await aplicarConversaoDeLote(companyId, fichaId, 2.858, 'user-dono', prisma)
    expect(r).toMatchObject({ soRotulo: false, dosesAlteradas: 2 })

    const vs = await versoesDe(fichaId)
    const comps = await prisma.stockFichaComponente.findMany({ where: { companyId, versaoId: vs[1].id }, orderBy: { posicao: 'asc' } })
    expect(comps[0].qtdPlanejada).toBeCloseTo(1.049685, 6)
  })

  it('⭐ o modo de preparo e a validade são HERDADOS (a conversão não apaga a receita)', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')
    await aplicarConversaoDeLote(companyId, fichaId, 1, 'user-dono', prisma)
    const vs = await versoesDe(fichaId)
    expect(vs[1]).toMatchObject({ modoPreparo: 'moer e moldar', validadeDias: 90 })
  })

  it('⭐⭐ depois de converter, a ficha SAI da lista de pendentes (o 37 → 0 anda)', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')
    expect((await fichasParaConverter(companyId, prisma)).pendentes).toHaveLength(1)

    await aplicarConversaoDeLote(companyId, fichaId, 1, 'user-dono', prisma)

    const prog = await fichasParaConverter(companyId, prisma)
    expect(prog).toMatchObject({ total: 1, coerentes: 1 })
    expect(prog.pendentes).toEqual([])
  })
})

describe('⛔⛔ as recusas — e a mais importante é a SEGUNDA conversão', () => {
  it('⛔⛔ converter a MESMA ficha de novo é RECUSADO: dividiria as doses duas vezes', async () => {
    const { fichaId } = await fichaEmKg('MAIONESE', 2.858, 3)
    await aplicarConversaoDeLote(companyId, fichaId, 2.858, 'user-dono', prisma)

    await expect(aplicarConversaoDeLote(companyId, fichaId, 2.858, 'user-dono', prisma)).rejects.toThrow(ConversaoError)
    await expect(aplicarConversaoDeLote(companyId, fichaId, 2.858, 'user-dono', prisma)).rejects.toThrow(/já declara o lote em UN/)

    // ⛔ e NADA foi gravado na 2ª tentativa: continua em 2 versões
    expect(await versoesDe(fichaId)).toHaveLength(2)
    const comps = await prisma.stockFichaComponente.findMany({
      where: { companyId, versaoId: (await versoesDe(fichaId))[1].id }, orderBy: { posicao: 'asc' },
    })
    // ⭐ 1,049685 e NÃO 0,367 (que é o que a 2ª divisão daria)
    expect(comps[0].qtdPlanejada).toBeCloseTo(1.049685, 6)
  })

  it('⛔ número que não serve não grava nada', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')
    for (const n of [0, -1, Number.NaN]) {
      await expect(aplicarConversaoDeLote(companyId, fichaId, n, null, prisma)).rejects.toThrow(ConversaoError)
    }
    expect(await versoesDe(fichaId)).toHaveLength(1)
  })

  it('⛔ ficha arquivada recusa nomeando a saída', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')
    await prisma.stockFicha.update({ where: { id: fichaId }, data: { ativo: false } })
    await expect(aplicarConversaoDeLote(companyId, fichaId, 1, null, prisma)).rejects.toThrow(/arquivada/)
  })

  it('⛔ ficha de OUTRA empresa não é alcançável (REGRA 8)', async () => {
    const { fichaId } = await fichaEmKg('porcao coxao 80 grama')
    await expect(aplicarConversaoDeLote('outra-empresa', fichaId, 1, null, prisma)).rejects.toThrow(/não encontrada/i)
    expect(await versoesDe(fichaId)).toHaveLength(1)
  })
})
