// ⭐⭐⭐ EXCLUIR RECEITA — os DOIS casos, contra banco (16/09/2026)
//
// **A régua do dono:** sem lote → **exclui de vez** (*"rascunho que nasceu errado não
// merece cerimônia"*); com lotes → **desativa**, e ***o passado não se reescreve***.
//
// ⛔ **A trava mora no SERVIDOR.** A tela só pergunta; quem olha a história é ele.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { preverExclusaoDaFicha, excluirFicha } from '../excluir-ficha'
import { listFichas } from '../fichas'

let companyId = ''
let insumoId = ''

async function novaFicha(nome: string): Promise<{ fichaId: string; itemProduzidoId: string }> {
  const item = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: 'UN', categoria: 'INTERMEDIARIO', criadoVia: 'MANUAL' },
  })
  const f = await prisma.stockFicha.create({
    data: { companyId, itemProduzidoId: item.id, tipoProduto: 'INTERMEDIARIO', versaoAtual: 1 },
  })
  const v = await prisma.stockFichaVersao.create({
    data: { companyId, fichaId: f.id, versao: 1, loteBase: 1, unidadeLoteBase: 'UN' },
  })
  await prisma.stockFichaComponente.create({
    data: { companyId, versaoId: v.id, itemId: insumoId, qtdPlanejada: 1, unidade: 'KG', posicao: 0 },
  })
  return { fichaId: f.id, itemProduzidoId: item.id }
}

beforeEach(async () => {
  const c = await prisma.company.create({ data: { name: `Excluir ${Date.now()}`, cnpj: `66${Date.now()}`.slice(0, 14) } })
  companyId = c.id
  const insumo = await prisma.stockItem.create({
    data: { companyId, nome: 'CARNE', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
  })
  insumoId = insumo.id
})

afterEach(async () => {
  await prisma.stockProductionOrder.deleteMany({ where: { companyId } })
  await prisma.stockFichaComponente.deleteMany({ where: { companyId } })
  await prisma.stockFichaVersao.deleteMany({ where: { companyId } })
  await prisma.stockFicha.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐ CASO 1 — receita SEM lote: exclui de vez', () => {
  it('⭐ a prévia DIZ que vai excluir, com o nome', async () => {
    const { fichaId } = await novaFicha('rascunho errado')
    const p = await preverExclusaoDaFicha(companyId, fichaId, prisma)
    expect(p.caso).toBe('EXCLUI')
    expect(p.lotes).toBe(0)
    expect(p.frase).toContain('nunca foi produzida')
    expect(p.frase).toContain('rascunho errado')
  })

  it('⭐⭐ e some de VEZ — ficha, versões, componentes e o item-invólucro', async () => {
    const { fichaId, itemProduzidoId } = await novaFicha('rascunho errado')
    const r = await excluirFicha(companyId, fichaId, prisma)

    expect(r.caso).toBe('EXCLUI')
    expect(r.itemApagado, 'o item-invólucro ficou órfão poluindo o catálogo').toBe(true)
    expect(await prisma.stockFicha.count({ where: { id: fichaId } })).toBe(0)
    expect(await prisma.stockFichaVersao.count({ where: { companyId, fichaId } })).toBe(0)
    expect(await prisma.stockItem.count({ where: { id: itemProduzidoId } })).toBe(0)
    // ⭐ e o efeito é NOMEADO — nunca um "ok"
    expect(r.efeito).toContain('excluída de vez')
  })

  /**
   * ⛔ O INSUMO NÃO VAI JUNTO. Apagar a receita não apaga a carne — ela é item de estoque
   * com vida própria, e confundir os dois seria apagar matéria-prima por tabela.
   */
  it('⛔ mas o INSUMO fica — ele não é da receita', async () => {
    const { fichaId } = await novaFicha('rascunho')
    await excluirFicha(companyId, fichaId, prisma)
    expect(await prisma.stockItem.count({ where: { id: insumoId } })).toBe(1)
  })
})

describe('⭐⭐ CASO 2 — receita COM lotes: desativa, e o passado fica', () => {
  async function comHistoria(nome = 'maionese caseira') {
    const f = await novaFicha(nome)
    const ordem = await prisma.stockProductionOrder.create({
      data: {
        companyId, fichaId: f.fichaId, versaoFicha: 1, itemProduzidoId: f.itemProduzidoId,
        escalaReceitas: 1, estado: 'CONCLUIDA', dataProducao: new Date('2026-09-10T12:00:00Z'),
      },
    })
    return { ...f, ordemId: ordem.id }
  }

  it('⭐ a prévia AVISA que é desativação, com o número de lotes', async () => {
    const { fichaId } = await comHistoria()
    const p = await preverExclusaoDaFicha(companyId, fichaId, prisma)
    expect(p.caso).toBe('DESATIVA')
    expect(p.lotes).toBe(1)
    expect(p.frase).toContain('DESATIVADA')
    expect(p.frase, 'não prometeu preservar o histórico').toContain('histórico preservado')
  })

  /**
   * ⛔⛔ **O PASSADO NÃO SE REESCREVE** — a mesma regra do fornecedor mesclado (11/09) e do
   * item desativado (09/09). O lote continua apontando pra ficha, com nome e versão.
   */
  it('⭐⭐⭐ o lote antigo continua apontando pra ela, com a versão', async () => {
    const { fichaId, ordemId } = await comHistoria()
    await excluirFicha(companyId, fichaId, prisma)

    const ordem = await prisma.stockProductionOrder.findUnique({ where: { id: ordemId } })
    expect(ordem, 'a ordem sumiu — o passado foi reescrito').toBeTruthy()
    expect(ordem!.fichaId).toBe(fichaId)
    expect(ordem!.versaoFicha).toBe(1)

    // ⭐ e a ficha CONTINUA existindo (desativada), senão o lote apontaria pro vazio
    const f = await prisma.stockFicha.findUnique({ where: { id: fichaId } })
    expect(f, 'a ficha foi apagada com história — o lote virou órfão').toBeTruthy()
    expect(f!.ativo).toBe(false)
    // ⚠️ e as VERSÕES ficam: é delas que o lote antigo lê o que foi produzido
    expect(await prisma.stockFichaVersao.count({ where: { companyId, fichaId } })).toBe(1)
  })

  it('⛔ ela some de planejar/produzir — a lista de ATIVAS não a traz', async () => {
    const { fichaId } = await comHistoria()
    await excluirFicha(companyId, fichaId, prisma)
    // ⭐  já devolve só as ATIVAS — a desativada some do planejar sozinha
    const ativas = await listFichas(companyId, prisma)
    expect(ativas.map((f) => f.id), 'a receita desativada continua no planejar').not.toContain(fichaId)
    // ⚠️ e ela CONTINUA acessível quando se pede explicitamente (o histórico existe)
    const todas = await listFichas(companyId, prisma, { incluirInativas: true })
    expect(todas.map((f) => f.id), 'a desativada sumiu até de quem pede o histórico').toContain(fichaId)
  })

  /**
   * ⭐⭐ E O RELATÓRIO HISTÓRICO CONTINUA MOSTRANDO O LOTE — o guard que o dono pediu:
   * *"o recorte por período não perde produção passada"*.
   */
  it('⭐⭐ o relatório do período antigo continua achando a produção dela', async () => {
    const { fichaId } = await comHistoria()
    await excluirFicha(companyId, fichaId, prisma)

    const lotesNoPeriodo = await prisma.stockProductionOrder.findMany({
      where: {
        companyId,
        dataProducao: { gte: new Date('2026-09-01T00:00:00Z'), lte: new Date('2026-09-30T23:59:59Z') },
      },
      select: { fichaId: true },
    })
    expect(
      lotesNoPeriodo.map((l) => l.fichaId),
      'o relatório histórico perdeu o lote da receita desativada',
    ).toContain(fichaId)
  })

  it('⭐ ordem CANCELADA também é história — não vira exclusão', async () => {
    const f = await novaFicha('tentativa cancelada')
    await prisma.stockProductionOrder.create({
      data: { companyId, fichaId: f.fichaId, versaoFicha: 1, itemProduzidoId: f.itemProduzidoId, escalaReceitas: 1, estado: 'CANCELADA', dataProducao: new Date() },
    })
    const p = await preverExclusaoDaFicha(companyId, f.fichaId, prisma)
    expect(p.caso, 'cancelar apagou a história — mas ela existiu').toBe('DESATIVA')
  })
})

describe('⚠️ o confirm mostra o EFEITO COLATERAL antes, não depois', () => {
  it('⭐ receita usada como ingrediente de outra avisa QUAIS', async () => {
    const base = await novaFicha('porcao de carne')
    const xis = await novaFicha('XIS')
    const vXis = await prisma.stockFichaVersao.findFirstOrThrow({ where: { companyId, fichaId: xis.fichaId } })
    await prisma.stockFichaComponente.create({
      data: { companyId, versaoId: vXis.id, itemId: base.itemProduzidoId, qtdPlanejada: 1, unidade: 'UN', posicao: 1 },
    })

    const p = await preverExclusaoDaFicha(companyId, base.fichaId, prisma)
    expect(p.usadaEmFichas).toContain('XIS')
    expect(p.frase, 'o dono não foi avisado de que outra receita depende dela').toContain('ingrediente de')
  })
})

describe('⛔⛔ a corrida: um lote nasce enquanto o dono decide', () => {
  /**
   * ⚠️ Entre ver o confirm e clicar, a cozinha pode produzir. Se o `DELETE` confiasse na
   * prévia, apagaria uma receita que **acabou de ganhar história**. Por isso ele re-avalia
   * DENTRO da transação — a disciplina do `@@unique` da contagem aberta (23/08).
   */
  it('⭐⭐ o gesto re-avalia e DESATIVA em vez de apagar', async () => {
    const { fichaId, itemProduzidoId } = await novaFicha('corrida')
    const previa = await preverExclusaoDaFicha(companyId, fichaId, prisma)
    expect(previa.caso).toBe('EXCLUI') // ← o que a tela mostrou

    // ⛔ a cozinha produz ANTES do clique
    await prisma.stockProductionOrder.create({
      data: { companyId, fichaId, versaoFicha: 1, itemProduzidoId, escalaReceitas: 1, estado: 'EM_PRODUCAO', dataProducao: new Date() },
    })

    const r = await excluirFicha(companyId, fichaId, prisma, undefined, previa.caso)
    expect(r.caso, 'apagou uma receita que ganhou história no meio').toBe('DESATIVA')
    expect(r.efeito).toContain('enquanto você decidia')
    expect(await prisma.stockFicha.count({ where: { id: fichaId } })).toBe(1)
  })
})
