/**
 * ⛔⛔⛔ M3/M4 — A REGRA DE OURO DO MRP (item 1.b, 02/10/2026).
 *
 * *"phantom (ATRAVESSA) não tem saldo/ordem/contagem; e item que É estocado JAMAIS é marcado
 * ATRAVESSA."*
 *
 * ⭐ A cena é a REAL de 09/09: montar o cardápio de bebidas criou um **invólucro** ao lado de
 * cada garrafa que a NF já alimentava (`COCA COLA 2L` do menu × `COCA-COLA 2L` da geladeira),
 * a contagem oferecia os dois, e as garrafas foram contadas na linha errada.
 *
 * ⚠️ E ESTE TESTE EXISTE PORQUE O ESTADO AINDA É REAL EM PROD: medido em 02/10, a cirurgia
 * daquele dia curou **12 de 13** invólucros — a `FANTA UVA 2L` ficou com **7 UN** num item que
 * nenhuma venda e nenhuma produção vão baixar.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { checkFantasmaInvariants } from '../fantasma-invariants'
import { criarFicha } from '../producao/fichas'

const CNPJ = '75757575000175'
let companyId = ''
let garrafaId = ''
let involucroId = ''

const M = async (inv: string) =>
  (await checkFantasmaInvariants(prisma)).filter((f) => f.invariante === inv && f.companyId === companyId)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'FANTASMA' } })
  companyId = c.id

  // a GARRAFA de verdade, alimentada por nota — é esta que se conta na geladeira
  const g = await prisma.stockItem.create({
    data: { companyId, nome: 'COCA-COLA 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
  })
  garrafaId = g.id
  await prisma.stockMovement.create({
    data: { companyId, itemId: garrafaId, tipo: 'ENTRADA_NF', quantidade: 200, custoUnitario: 8.08, custoTotal: 1616, origem: 'SEFAZ' },
  })

  /**
   * ⭐ a ficha do CARDÁPIO — PRODUTO_FINAL, que a explosão ATRAVESSA. Ela cria um
   * item-invólucro ("COCA COLA 2L do menu") que existe só pra nomear a linha do cardápio.
   * ⚠️ O nome leva "(menu)" porque a trava de 09/09 recusa criar invólucro com o nome EXATO
   * de um item de prateleira — e é justamente o estado "invólucro ao lado da garrafa" que o
   * M3 vigia, com a garrafa de verdade no mesmo cenário.
   */
  const f = await criarFicha(
    {
      companyId,
      nomeProduzido: 'COCA COLA 2L (menu)',
      unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL',
      loteBase: 1,
      unidadeLoteBase: 'UN',
      componentes: [{ itemId: garrafaId, qtdPlanejada: 1, unidade: 'UN' }],
    },
    prisma,
  )
  const ficha = await prisma.stockFicha.findUniqueOrThrow({
    where: { id: f.fichaId },
    select: { itemProduzidoId: true },
  })
  involucroId = ficha.itemProduzidoId
})

afterEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

describe('⭐ o estado SADIO: o invólucro existe e NÃO tem saldo', () => {
  it('M3 e M4 calam', async () => {
    expect(await M('M3')).toEqual([])
    expect(await M('M4')).toEqual([])
  })
})

describe('⛔⛔ M3 — phantom com saldo é dinheiro no LIMBO', () => {
  it('⭐ a contagem na linha errada (a cicatriz de 09/09) acende, nomeando o item', async () => {
    // exatamente o que aconteceu: ajuste de contagem no INVÓLUCRO em vez da garrafa
    await prisma.stockMovement.create({
      data: { companyId, itemId: involucroId, tipo: 'AJUSTE_CONTAGEM', quantidade: 154, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' },
    })
    const m = await M('M3')
    expect(m).toHaveLength(1)
    expect(m[0].nivel).toBeUndefined() // ⛔ ERRO
    expect(m[0].detalhe).toContain('COCA COLA 2L (menu)')
    expect(m[0].detalhe).toContain('LIMBO')
    expect(m[0].detalhe).toContain('contar na GARRAFA')
  })

  it('⛔⛔ e o par AJUSTE + ESTORNO (a cirurgia de 09/09) NÃO acende — saldo líquido zero', async () => {
    /**
     * ⚠️⚠️ ESTE É O TESTE QUE IMPEDE O INVARIANTE DE NASCER MENTINDO. Medido em prod antes de
     * escrever: há **25 movimentos** em itens phantom, e são pares ajuste+estorno da própria
     * cirurgia. Um guard que perguntasse *"existe movimento?"* nasceria com **13 alarmes
     * falsos de um problema já resolvido** — e alarme falso no dia 1 é como um alarme morre.
     */
    const aj = await prisma.stockMovement.create({
      data: { companyId, itemId: involucroId, tipo: 'AJUSTE_CONTAGEM', quantidade: 154, custoUnitario: 0, custoTotal: 0, origem: 'MANUAL' },
    })
    await prisma.stockMovement.create({
      data: { companyId, itemId: involucroId, tipo: 'ESTORNO', quantidade: -154, custoUnitario: 0, custoTotal: 0, estornoDeId: aj.id, origem: 'MANUAL' },
    })
    expect(await M('M3')).toEqual([])
  })

  it('⚠️ a GARRAFA com saldo NÃO é acusada — ela É estocada, e é onde o saldo deve morar', async () => {
    const m = await M('M3')
    expect(m.some((f) => f.detalhe.includes('COCA-COLA 2L'))).toBe(false)
  })
})

describe('⛔⛔⛔ M4 — item que É estocado marcado como ATRAVESSA = baixa DUPLA silenciosa', () => {
  it('⭐ ficha PRODUTO_FINAL com ordem de produção acende, explicando a dupla baixa', async () => {
    /**
     * Se a cozinha produz o item por ORDEM, ele é ESTOCADO. Tipá-lo como PRODUTO_FINAL faz a
     * explosão **descer nos insumos dele** — e os insumos já saíram na ordem. Cada venda
     * passaria a baixar farinha que nunca existiu, sem erro nenhum na tela.
     */
    const ficha = await prisma.stockFicha.findFirstOrThrow({
      where: { companyId, tipoProduto: 'PRODUTO_FINAL' },
      select: { id: true, versaoAtual: true, itemProduzidoId: true },
    })
    await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId: ficha.id, versaoFicha: ficha.versaoAtual,
        itemProduzidoId: ficha.itemProduzidoId,
        escalaReceitas: 1, estado: 'PLANEJADA', dataProducao: new Date('2026-09-20T15:00:00Z'),
      },
    })
    const m = await M('M4')
    expect(m).toHaveLength(1)
    expect(m[0].detalhe).toContain('É ESTOCADO')
    expect(m[0].detalhe).toContain('baixa DUPLA')
    expect(m[0].detalhe).toContain('INTERMEDIARIO')
  })

  it('⭐ ordem de ficha INTERMEDIARIO (o caso normal, 452 em prod) NÃO acende', async () => {
    const f = await criarFicha(
      {
        companyId,
        nomeProduzido: 'porção de queijo',
        unidadeProduzido: 'UN',
        tipoProduto: 'INTERMEDIARIO',
        loteBase: 1,
        unidadeLoteBase: 'UN',
        componentes: [{ itemId: garrafaId, qtdPlanejada: 1, unidade: 'UN' }],
      },
      prisma,
    )
    const ficha = await prisma.stockFicha.findUniqueOrThrow({ where: { id: f.fichaId }, select: { versaoAtual: true, itemProduzidoId: true } })
    await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId: f.fichaId, versaoFicha: ficha.versaoAtual,
        itemProduzidoId: ficha.itemProduzidoId,
        escalaReceitas: 1, estado: 'PLANEJADA', dataProducao: new Date('2026-09-20T15:00:00Z'),
      },
    })
    expect(await M('M4')).toEqual([])
  })
})
