/**
 * ⭐⭐⭐ A CONFERÊNCIA DO GERENTE — contra BANCO, pelo caminho real (09/10/2026).
 *
 * ⛔ Integração e não teste puro porque a REGRA DURA (*conferente ≠ declarante*) tem **duas
 * camadas**: a função pura que recusa com a frase, e o **CHECK do banco** que a torna
 * impossível. Testar só a pura provaria metade — e a metade que um `UPDATE` futuro contorna.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { definirPin } from '../pin'
import { criarMovimento } from '../../movement'
import {
  AGUARDANDO,
  carimbosDasConclusoes,
  confirmarConclusao,
  corrigirConclusao,
  porQueNaoPodeConferir,
  preverCorrecao,
} from '../conferencia'
import { filaDeConferencia } from '../fila-de-conferencia'

const CNPJ = '90919293000190'
let companyId = ''
/** o cenário: uma ficha, uma ordem concluída, dois colaboradores (declarante e conferente) */
let fichaId = ''
let versaoId = ''
let ordemId = ''
let itemProduzidoId = ''
let insumoId = ''
let declaranteId = ''
let conferenteId = ''

const USER_GERENTE = 'u-gerente'
const USER_OUTRO = 'u-outro'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONFERENCIA 4 OLHOS' } })
  companyId = c.id

  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'carne crua', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  insumoId = insumo.id
  const prod = await prisma.stockItem.create({
    data: { companyId, nome: 'porcao de carne 100 grama', unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  itemProduzidoId = prod.id

  const ficha = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  fichaId = ficha.id
  const v = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId, versao: 1, loteBase: 10, unidadeLoteBase: 'UN' },
  })
  versaoId = v.id
  await prisma.stockFichaComponente.create({
    data: { companyId, versaoId, itemId: insumoId, qtdPlanejada: 1, unidade: 'KG', posicao: 0 },
  })

  const ordem = await prisma.stockProductionOrder.create({
    data: {
      companyId, fichaId, versaoFicha: 1, itemProduzidoId,
      escalaReceitas: 1, estado: 'CONCLUIDA', dataProducao: new Date(),
    },
  })
  ordemId = ordem.id

  const dec = await prisma.stockColaborador.create({ data: { companyId, nome: 'eliane' } })
  const conf = await prisma.stockColaborador.create({ data: { companyId, nome: 'cristian' } })
  declaranteId = dec.id
  conferenteId = conf.id
  await definirPin({ companyId, colaboradorId: declaranteId, pin: '5137' }, prisma)
  await definirPin({ companyId, colaboradorId: conferenteId, pin: '8264' }, prisma)
})

afterEach(async () => {
  for (const t of [
    prisma.stockConclusaoConferida, prisma.stockConclusaoEstornada, prisma.stockProducaoDesvio,
    prisma.stockProducaoConclusao, prisma.stockMovement, prisma.stockFichaComponente,
    prisma.stockFichaVersao, prisma.stockFicha, prisma.stockProductionOrder, prisma.stockOrdemMeta,
    prisma.stockColaboradorPin, prisma.stockColaborador, prisma.stockItem, prisma.stockSaldoCache,
  ]) {
    await (t as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
})

/** cria a conclusão com a geração no ledger, como o motor real faz */
async function declarar(qtd: number, opts: { colaboradorId?: string | null; criadoPorId?: string | null } = {}) {
  const custoLote = 100
  await criarMovimento(prisma, {
    companyId, itemId: itemProduzidoId, tipo: 'PRODUCAO_GERACAO', quantidade: qtd,
    custoUnitario: custoLote / qtd, custoTotal: custoLote, receiptId: ordemId, origem: 'MANUAL',
  })
  return prisma.stockProducaoConclusao.create({
    data: {
      companyId, ordemId, qtdGerada: qtd,
      colaboradorId: opts.colaboradorId === undefined ? declaranteId : opts.colaboradorId,
      criadoPorId: opts.criadoPorId ?? null,
      escalaConsumida: 1, custoLoteReal: custoLote, custoUnitarioReal: custoLote / qtd, rendimento: qtd,
    },
  })
}

describe('⭐ o estado é DERIVADO, nunca gravado', () => {
  it('conclusão sem carimbo é AGUARDANDO — a ausência É o estado', async () => {
    const c = await declarar(10)
    const m = await carimbosDasConclusoes(companyId, [c.id], prisma)
    expect(m.get(c.id)).toEqual(AGUARDANDO)
  })

  it('⭐ confirmar carimba e o estado vira CONFERIDA, com quem e quando', async () => {
    const c = await declarar(10)
    const r = await confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_GERENTE }, prisma)
    expect(r.conferidoPorNome).toBe('cristian')
    const m = await carimbosDasConclusoes(companyId, [c.id], prisma)
    expect(m.get(c.id)!.estado).toBe('CONFERIDA')
    expect(m.get(c.id)!.conferidoPorNome).toBe('cristian')
    expect(m.get(c.id)!.corrigiuDe).toBeNull()
  })

  it('⚠️ nada trava a cozinha: a conclusão e a geração no ledger existem ANTES de qualquer carimbo', async () => {
    const c = await declarar(10)
    const movs = await prisma.stockMovement.findMany({ where: { companyId, tipo: 'PRODUCAO_GERACAO' } })
    expect(movs).toHaveLength(1)
    expect(movs[0].quantidade).toBe(10)
    expect((await carimbosDasConclusoes(companyId, [c.id], prisma)).get(c.id)!.estado).toBe('AGUARDANDO_CONFERENCIA')
  })
})

describe('⛔⛔⛔ A REGRA DURA: conferente ≠ declarante, SEMPRE', () => {
  it('⛔ o PIN do DECLARANTE é recusado, nomeando a regra', async () => {
    const c = await declarar(10)
    await expect(
      confirmarConclusao({ companyId, conclusaoId: c.id, pin: '5137', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/QUATRO OLHOS|quem confere nunca é quem declarou/)
    /** ⛔ e NADA foi gravado — recusa não deixa meio carimbo */
    expect(await prisma.stockConclusaoConferida.count({ where: { companyId } })).toBe(0)
  })

  it('⛔ nem o GERENTE confere a própria conclusão (eixo do USUÁRIO)', async () => {
    // o gerente concluiu pela tela de Produção: tem `criadoPorId`, não tem colaborador
    const c = await declarar(10, { colaboradorId: null, criadoPorId: USER_GERENTE })
    await expect(
      confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/lançada por você|QUATRO OLHOS/)
    expect(await prisma.stockConclusaoConferida.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ OUTRO gerente confere a conclusão lançada pela tela — o quatro-olhos de verdade', async () => {
    const c = await declarar(10, { colaboradorId: null, criadoPorId: USER_GERENTE })
    const r = await confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_OUTRO }, prisma)
    expect(r.conferidoPorNome).toBe('cristian')
  })

  /**
   * ⛔⛔ O CHECK DO BANCO — a 2ª camada. ⚠️ REGRA 13: ele é escrito com `IS NULL` EXPLÍCITO
   * e PRIMEIRO, porque `a <> b` com b NULL avalia pra NULL e ***CHECK com NULL PASSA***.
   * ⚠️ Em dev (SQLite, `db push`) o CHECK **não existe** — a prova dele é o script contra
   * Postgres (REGRA 13). Aqui se prova a camada da APLICAÇÃO.
   */
  it('⚠️ a decisão é PURA e testável nos dois eixos', () => {
    const base = { conferidoPorId: 'u1', conferidoPorColaboradorId: 'c1', nomeDoConferente: 'cristian' }
    expect(porQueNaoPodeConferir({ ...base, declaradoPorId: null, declaradoPorColaboradorId: 'c1' })).toMatch(/QUATRO OLHOS/)
    expect(porQueNaoPodeConferir({ ...base, declaradoPorId: 'u1', declaradoPorColaboradorId: null })).toMatch(/QUATRO OLHOS/)
    expect(porQueNaoPodeConferir({ ...base, declaradoPorId: 'u2', declaradoPorColaboradorId: 'c2' })).toBeNull()
    /** ⚠️ sem declarante conhecido não há auto-conferência a barrar — e aí passar é o certo */
    expect(porQueNaoPodeConferir({ ...base, declaradoPorId: null, declaradoPorColaboradorId: null })).toBeNull()
  })

  it('⛔ conferir DUAS vezes é impossível — e a recusa diz quem já conferiu', async () => {
    const c = await declarar(10)
    await confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_GERENTE }, prisma)
    await expect(
      confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_OUTRO }, prisma),
    ).rejects.toThrow(/já foi conferida por cristian/)
    expect(await prisma.stockConclusaoConferida.count({ where: { companyId } })).toBe(1)
  })

  it('⛔ PIN que não existe é recusado sem dizer de quem é', async () => {
    const c = await declarar(10)
    await expect(
      confirmarConclusao({ companyId, conclusaoId: c.id, pin: '9876', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/PIN não confere/)
  })
})

describe('⭐⭐ CORRIGIR — nova versão com rastro, o declarado original fica', () => {
  it('⭐ o delta vai pro ledger pela porta existente, e a conclusão velha fica no histórico', async () => {
    const c = await declarar(10)
    const r = await corrigirConclusao(
      { companyId, conclusaoId: c.id, qtdCerta: 7, motivo: 'CONTOU_ERRADO', pin: '8264', userId: USER_GERENTE },
      prisma,
    )
    expect(r.modo).toBe('ESTORNA_E_RELANCA')
    expect(r.corrigiuDe).toBe(10)

    /** ⭐ o LEDGER: geração 10 anulada + geração 7 viva → líquido 7 */
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId: itemProduzidoId }, orderBy: { criadoEm: 'asc' } })
    const liquido = movs.reduce((s, m) => s + m.quantidade, 0)
    expect(Math.round(liquido * 1000) / 1000).toBe(7)

    /** ⭐ a VELHA fica (é o registro do que foi declarado) e sai das médias */
    const velha = await prisma.stockProducaoConclusao.findUnique({ where: { id: c.id } })
    expect(velha!.qtdGerada).toBe(10)
    expect(await prisma.stockConclusaoEstornada.count({ where: { companyId, conclusaoId: c.id } })).toBe(1)

    /** ⭐ o carimbo vai na NOVA, com o número antigo no rastro */
    const m = await carimbosDasConclusoes(companyId, [r.conclusaoNovaId], prisma)
    expect(m.get(r.conclusaoNovaId)!.estado).toBe('CORRIGIDA_E_CONFERIDA')
    expect(m.get(r.conclusaoNovaId)!.corrigiuDe).toBe(10)
    expect(m.get(r.conclusaoNovaId)!.motivoDaCorrecao).toBe('contou errado')
    /** ⛔ e a VELHA nunca é carimbada: diria "conferido" sobre o número que ele rejeitou */
    expect((await carimbosDasConclusoes(companyId, [c.id], prisma)).get(c.id)!.estado).toBe('AGUARDANDO_CONFERENCIA')
  })

  it('⛔ a regra dura vale igual no corrigir — o declarante não corrige a própria', async () => {
    const c = await declarar(10)
    await expect(
      corrigirConclusao({ companyId, conclusaoId: c.id, qtdCerta: 7, motivo: 'CONTOU_ERRADO', pin: '5137', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/QUATRO OLHOS/)
    /** ⛔ e o ledger fica INTACTO: a recusa roda antes de qualquer escrita */
    const movs = await prisma.stockMovement.findMany({ where: { companyId, itemId: itemProduzidoId } })
    expect(movs).toHaveLength(1)
    expect(movs[0].quantidade).toBe(10)
  })

  it('⛔ «outro» sem escrever o que houve é recusado — correção sem porquê vira mistério', async () => {
    const c = await declarar(10)
    await expect(
      corrigirConclusao({ companyId, conclusaoId: c.id, qtdCerta: 7, motivo: 'OUTRO', pin: '8264', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/escreva em uma linha/)
    expect(await prisma.stockConclusaoConferida.count({ where: { companyId } })).toBe(0)
  })

  it('⛔ o MESMO número manda usar o confirmar — correção que não corrige nada não existe', async () => {
    const c = await declarar(10)
    await expect(
      corrigirConclusao({ companyId, conclusaoId: c.id, qtdCerta: 10, motivo: 'CONTOU_ERRADO', pin: '8264', userId: USER_GERENTE }, prisma),
    ).rejects.toThrow(/mesmo número/)
  })

  /**
   * ⛔⛔⛔ O CASO QUE A MEDIÇÃO EM PROD ACHOU — ledger JÁ corrigido por fora.
   *
   * Nas 2 conclusões de 22.864 (19/09) a geração podre já está estornada e o líquido é
   * 22,864; só a CONCLUSÃO continua dizendo 22864. `preverRelancamento` acharia o movimento
   * ANULADO, o estorno seria idempotente, e o movimento NOVO **somaria em cima do vivo** —
   * ***dobrando o lote***.
   */
  it('⛔⛔ ledger já consertado por fora → corrige SÓ a conclusão, sem dobrar o lote', async () => {
    const c = await declarar(100)
    /** simula o conserto de fora: estorna a geração e lança a certa (o que a cascata fez) */
    const ger = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: 'PRODUCAO_GERACAO' } })
    const { estornarMovimento } = await import('../../movement')
    await estornarMovimento(prisma, ger.id, {})
    await criarMovimento(prisma, {
      companyId, itemId: itemProduzidoId, tipo: 'PRODUCAO_GERACAO', quantidade: 10,
      custoUnitario: 10, custoTotal: 100, receiptId: ordemId, origem: 'MANUAL',
    })
    const liquidoAntes = (await prisma.stockMovement.findMany({ where: { companyId, itemId: itemProduzidoId } }))
      .reduce((s, m) => s + m.quantidade, 0)
    expect(Math.round(liquidoAntes * 1000) / 1000).toBe(10)

    const plano = await preverCorrecao(companyId, c.id, 10, prisma)
    expect(plano.modo).toBe('SO_A_CONCLUSAO')
    if (plano.modo === 'SO_A_CONCLUSAO') expect(plano.porque).toMatch(/DOBRARIA o lote|estornada/)

    const r = await corrigirConclusao(
      { companyId, conclusaoId: c.id, qtdCerta: 10, motivo: 'DIGITOU_ERRADO', pin: '8264', userId: USER_GERENTE },
      prisma,
    )
    expect(r.modo).toBe('SO_A_CONCLUSAO')
    /** ⭐⭐ O LEDGER NÃO SE MEXEU — é o que impede o lote de dobrar */
    const liquidoDepois = (await prisma.stockMovement.findMany({ where: { companyId, itemId: itemProduzidoId } }))
      .reduce((s, m) => s + m.quantidade, 0)
    expect(Math.round(liquidoDepois * 1000) / 1000).toBe(10)
    /** e a conclusão nova diz o número certo */
    const nova = await prisma.stockProducaoConclusao.findUnique({ where: { id: r.conclusaoNovaId } })
    expect(nova!.qtdGerada).toBe(10)
  })
})

describe('⭐ A FILA DO GERENTE', () => {
  it('⭐ a conclusão sem carimbo entra, com quem declarou e o fiscal falando', async () => {
    // material separado pra 10 un (1 KG por un, lote base 10): separa 1 KG → permite ~10
    await criarMovimento(prisma, {
      companyId, itemId: insumoId, tipo: 'SEPARACAO_SAIDA', quantidade: -1, custoUnitario: 1,
      custoTotal: -1, receiptId: ordemId, origem: 'MANUAL',
    })
    await criarMovimento(prisma, {
      companyId, itemId: insumoId, tipo: 'PRODUCAO_CONSUMO', quantidade: -1, custoUnitario: 1,
      custoTotal: -1, receiptId: ordemId, origem: 'MANUAL',
    })
    const c = await declarar(10)
    const f = await filaDeConferencia(companyId, prisma)
    expect(f.aguardando).toBe(1)
    expect(f.cartoes[0].conclusaoId).toBe(c.id)
    expect(f.cartoes[0].declaradoPor).toBe('eliane')
    expect(f.cartoes[0].declarado).toBe(10)
    /** ⭐ O FISCAL FALA AQUI — e só aqui */
    expect(f.cartoes[0].fiscalFrase).toMatch(/material separado/)
    expect(f.cartoes[0].fiscalOk).toBe(true)
  })

  it('⭐ conferida SAI da fila', async () => {
    const c = await declarar(10)
    await confirmarConclusao({ companyId, conclusaoId: c.id, pin: '8264', userId: USER_GERENTE }, prisma)
    expect((await filaDeConferencia(companyId, prisma)).aguardando).toBe(0)
  })

  it('⛔ conclusão ESTORNADA não entra — não se confere número que já foi substituído', async () => {
    const c = await declarar(10)
    await prisma.stockConclusaoEstornada.create({ data: { companyId, conclusaoId: c.id, motivo: 'teste' } })
    expect((await filaDeConferencia(companyId, prisma)).aguardando).toBe(0)
  })

  it('⭐ passou de 3h → atrasado (o MESMO degrau do aviso)', async () => {
    const c = await declarar(10)
    const agora = new Date(c.criadoEm.getTime() + 4 * 3_600_000)
    const f = await filaDeConferencia(companyId, prisma, agora)
    expect(f.cartoes[0].atrasado).toBe(true)
    expect(f.atrasados).toBe(1)
    /** ⚠️ e 2h ainda NÃO é atraso — ordem recém-fechada é a cozinha trabalhando */
    const f2 = await filaDeConferencia(companyId, prisma, new Date(c.criadoEm.getTime() + 2 * 3_600_000))
    expect(f2.cartoes[0].atrasado).toBe(false)
    expect(f2.atrasados).toBe(0)
  })

  it('⚠️ sem PIN no declarante, a fila NÃO inventa pessoa', async () => {
    await declarar(10, { colaboradorId: null })
    const f = await filaDeConferencia(companyId, prisma)
    expect(f.cartoes[0].declaradoPor).toBeNull()
  })
})
