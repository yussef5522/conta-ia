// ⭐⭐⭐ A DUPLA NA MESMA ETAPA, DE PONTA A PONTA (08/09/2026).
//
// *"A cozinha provou o caso: beef de xis/burger tem produção em que UMA etapa precisa de
// DUAS pessoas trabalhando juntas."* — o dono, aprovando o desenho.
//
// ⛔ Aqui os dois relógios andam no BANCO, com os toques reais de PIN de cada um — e a
// decisão 2 é verificada onde ela importa: a etapa 2 só libera com a 1 INTEIRA.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem } from '../ordens'
import { etapasDaOrdem } from '../etapas'
import { minhasTarefasDeHoje } from '../minhas-tarefas'
import { iniciarTarefa, finalizarTarefa, TarefaError } from '../minhas-tarefas'
import { designarParticipantes, participantesDaEtapa } from '../participantes'
import { dividirUnidades, etapaEstaFeita, DuplaError } from '../dupla-na-etapa'

const CNPJ = '50505050000199'
let companyId = ''
let fichaBeef = ''
let ana = ''
let bruno = ''
let carla = ''

const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))
const HOJE = new Date('2026-09-04T17:00:00.000Z')

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'DUPLA' } })).id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'Acém', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
  await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: 33.95, custoTotal: 1697.5, origem: 'SEFAZ' } })
  const f = await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'gessado' }, { nome: 'moldar beef' }],
    componentes: [{ itemId: it.id, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaBeef = f.fichaId
  ana = (await prisma.stockColaborador.create({ data: { companyId, nome: 'Ana' } })).id
  bruno = (await prisma.stockColaborador.create({ data: { companyId, nome: 'Bruno' } })).id
  carla = (await prisma.stockColaborador.create({ data: { companyId, nome: 'Carla' } })).id
})

afterEach(async () => {
  for (const t of ['stockOrdemEtapaParticipante', 'stockOrdemEtapaCorrecao', 'stockOrdemEtapa', 'stockColaborador', 'stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function ordemComEtapas() {
  const o = await criarOrdem({ companyId, fichaId: fichaBeef, escalaReceitas: 10, dataProducao: HOJE }, prisma)
  const es = await etapasDaOrdem(companyId, o.ordemId, HOJE, prisma)
  return { ordemId: o.ordemId, gessado: es[0].id, moldar: es[1].id }
}

describe('⭐⭐ dois relógios independentes na MESMA etapa', () => {
  it('cada um inicia e finaliza com o próprio toque — e os tempos são de cada um', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)

    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8, 10) }, prisma)
    const r1 = await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8, 30) }, prisma)
    const r2 = await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(9, 10) }, prisma)

    // ⛔ 30 e 60 — o relógio de CADA UM, nada rateado
    expect(r1.minutos).toBe(30)
    expect(r2.minutos).toBe(60)

    const ps = await participantesDaEtapa(gessado, prisma)
    expect(ps).toHaveLength(2)
    expect(etapaEstaFeita(ps)).toBe(true)
  })

  it('⛔⛔ DECISÃO 2: a etapa 2 NÃO libera com um da dupla ainda trabalhando', async () => {
    const { gessado, moldar } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8, 30) }, prisma)

    // ⚠️ a Ana terminou, o Bruno não: o gessado NÃO está pronto — o material não está inteiro
    await expect(iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: carla, agora: emSP(9) }, prisma))
      .rejects.toThrow(/ainda está em andamento|precisa ser feita antes/)

    // ⭐ quando o Bruno fecha, a etapa fica feita e a 2 libera
    await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(9) }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: carla, agora: emSP(9, 5) }, prisma))
      .resolves.toBeTruthy()
  })

  it('⭐⭐ DECISÃO 1: o designado que NUNCA veio não trava a etapa', async () => {
    const { ordemId, gessado, moldar } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    // só a Ana apareceu
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8, 30) }, prisma)

    // ⛔ a etapa fecha, e a seguinte libera — travar pararia a cozinha por um plano furado
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    expect(es[0].estado).toBe('FEITA')
    await expect(iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: carla, agora: emSP(9) }, prisma))
      .resolves.toBeTruthy()
  })
})

describe('⛔ o teto de 2 é do BANCO, não da tela', () => {
  it('a terceira pessoa é recusada no INICIAR', async () => {
    const { gessado } = await ordemComEtapas()
    // etapa SOLTA (sem designação): vale o "quem pegou, pegou" — até o teto
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8) }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: carla, agora: emSP(8) }, prisma))
      .rejects.toThrow(/no máximo 2 pessoas/)
  })

  it('⛔ e designar TRÊS é recusado antes de qualquer escrita', async () => {
    const { gessado } = await ordemComEtapas()
    await expect(designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno, carla] }, prisma))
      .rejects.toThrow(DuplaError)
    expect(await participantesDaEtapa(gessado, prisma)).toHaveLength(0)
  })

  it('⛔ etapa DESIGNADA admite só os designados — o guard antigo continua de pé', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana] }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8) }, prisma))
      .rejects.toThrow(/designada pra outra pessoa/)
  })
})

describe('⭐ redesignar respeita o relógio de quem já trabalhou', () => {
  it('quem já iniciou NÃO perde o relógio ao sair do plano', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    // o gerente remaneja: agora só o Bruno está no plano
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [bruno] }, prisma)
    const ps = await participantesDaEtapa(gessado, prisma)
    // ⛔ a Ana continua lá, com o relógio dela — apagar seria perder tempo medido de verdade
    expect(ps.find((p) => p.colaboradorId === ana)?.iniciadoEm).toBeTruthy()
  })

  it('quem NÃO tinha começado some do plano', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [bruno] }, prisma)
    expect((await participantesDaEtapa(gessado, prisma)).map((p) => p.colaboradorId)).toEqual([bruno])
  })
})

describe('⛔⛔ as unidades dividem só entre quem MEDIU — no dado real', () => {
  it('dois relógios → metade cada; um fechado pelo gerente → tudo pra quem mediu', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8, 30) }, prisma)
    await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(9) }, prisma)

    const ps = await participantesDaEtapa(gessado, prisma)
    expect(dividirUnidades(ps, 20).map((f) => f.unidades)).toEqual([10, 10])

    // ⛔ agora simulando o Bruno fechado PELO GERENTE: as 20 vão inteiras pra Ana
    const comGerente = ps.map((p) => ({ ...p, finalizadaPeloGerente: p.colaboradorId === bruno }))
    const r = dividirUnidades(comGerente, 20)
    expect(r.find((f) => f.colaboradorId === ana)).toEqual({ colaboradorId: ana, unidades: 20, minutos: 30 })
    expect(r.find((f) => f.colaboradorId === bruno)).toEqual({ colaboradorId: bruno, unidades: 0, minutos: null })
  })
})

// ────────────────────────────────────────────────────────────────
// ⛔⛔ O CAMINHO QUE FALTAVA SER NAVEGADO (REGRA 2, 08/09/2026).
//
// *"O modelo aceita 2 participantes, mas a tela da ordem só tem UM seletor de pessoa por
// etapa — não existe onde marcar a segunda. REGRA 2 falhou aqui: o caminho do usuário não
// foi navegado."* — o dono.
//
// ⭐ O motor estava certo; o que faltava era a leitura chegar na TELA. Este bloco anda o
// caminho inteiro: designo 2 → os 2 veem no tablet → cada um inicia com o próprio PIN.
// ────────────────────────────────────────────────────────────────

describe('⭐⭐ REGRA 2: designo 2 → os 2 veem → cada um inicia', () => {
  it('a etapa DEVOLVE os dois participantes pra tela desenhar os chips', async () => {
    const { ordemId, gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)

    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    // ⛔ sem isto a tela não tinha COMO mostrar quem são os dois — era a lacuna
    expect(es[0].participantes.map((p) => p.nome).sort()).toEqual(['Ana', 'Bruno'])
    expect(es[0].participantes.every((p) => !p.iniciou)).toBe(true)
  })

  it('⭐ os DOIS veem a tarefa no tablet, e cada um inicia com o PRÓPRIO PIN', async () => {
    const { gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)

    // a janela de cada um mostra a MESMA etapa
    expect((await minhasTarefasDeHoje(companyId, ana, HOJE, prisma)).map((t) => t.nome)).toContain('gessado')
    expect((await minhasTarefasDeHoje(companyId, bruno, HOJE, prisma)).map((t) => t.nome)).toContain('gessado')

    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: bruno, agora: emSP(8, 15) }, prisma)

    const ps = await participantesDaEtapa(gessado, prisma)
    expect(ps.filter((p) => p.iniciadoEm)).toHaveLength(2)
  })

  it('⛔⛔ quem JÁ INICIOU não sai pela designação — o relógio dele está correndo', async () => {
    const { ordemId, gessado } = await ordemComEtapas()
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [ana, bruno] }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: ana, agora: emSP(8) }, prisma)

    // o gerente tenta deixar só o Bruno
    await designarParticipantes({ companyId, etapaId: gessado, colaboradorIds: [bruno] }, prisma)

    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    const ana2 = es[0].participantes.find((p) => p.nome === 'Ana')
    // ⛔ ela continua lá, marcada como "no relógio" — a TELA usa esse flag pra esconder o X
    expect(ana2?.iniciou).toBe(true)
  })
})
