// ⭐⭐⭐ O LOTE QUE DORME ENTRE ETAPAS (15/09/2026)
//
// **O dono:** *"tem tarefa de 2 etapas onde a etapa 1 é feita hoje e a 2 amanhã (massa que
// descansa, molho que apura) — e tem tarefa que faz tudo no mesmo dia. O lote precisa poder
// DORMIR entre etapas."*
//
// ⛔⛔ **E A ARMADILHA QUE ELE NOMEOU ANTES DE ELA APARECER:** *"o TEMPO do lote é a SOMA dos
// cronômetros das etapas, NUNCA fim−início atravessando a noite. Lote que dorme 16h não
// produziu 16h."*
//
// ⚠️⚠️ **O DEFEITO JÁ EXISTIA** — `lotes.ts` dizia, em comentário: *"a duração do LOTE é da 1ª
// etapa iniciada à última finalizada"*. Qualquer lote com intervalo grande entre etapas já
// inflava a média por lote, o gráfico por dia e o "melhor ritmo". A feature das etapas em
// dias diferentes só tornaria isso rotina.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, iniciarProducao } from '../ordens'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { designarEtapa } from '../etapas'
import { iniciarTarefa, finalizarTarefa, minhasTarefasDeHoje } from '../minhas-tarefas'
import { concluir } from '../conclusao'
import { definirPlanoDaEtapa } from '../plano-etapas'
import { lotesDaJanela } from '../lotes'
import { minutosDoLote, horasDormindo } from '../plano-da-etapa'

const CNPJ = '50607080001011'
let companyId = ''
let fichaId = ''
let acem = ''
let eliane = ''
let rodrigo = ''

/** ⚠️ dias no PASSADO: data fixa em posição de relógio que ainda não chegou é bomba (01/09) */
const ONTEM = new Date('2026-09-03T17:00:00.000Z')
const HOJE = new Date('2026-09-04T17:00:00.000Z')
/** h em São Paulo do dia 03 · UTC = h+3 */
const d3 = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 3, h + 3, m))
const d4 = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'LOTE QUE DORME' } })).id
  const it = await prisma.stockItem.create({ data: { companyId, nome: 'Farinha', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  acem = it.id
  await prisma.stockMovement.create({ data: { companyId, itemId: acem, tipo: 'ENTRADA_NF', quantidade: 100, custoUnitario: 5, custoTotal: 500, origem: 'SEFAZ' } })
  const f = await criarFicha({
    companyId, nomeProduzido: 'Massa de pizza', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG',
    // ⭐ a receita real do caso: sova hoje, modela amanhã (a massa descansa a noite)
    etapas: [{ nome: 'sovar' }, { nome: 'modelar' }],
    componentes: [{ itemId: acem, qtdPlanejada: 1, unidade: 'KG', posicao: 0 }],
  }, prisma)
  fichaId = f.fichaId
  eliane = (await cadastrarPessoa({ companyId, nome: 'Eliane', funcao: 'COZINHA', pin: '4726' }, prisma)).colaboradorId!
  rodrigo = (await cadastrarPessoa({ companyId, nome: 'Rodrigo', funcao: 'COZINHA', pin: '5813' }, prisma)).colaboradorId!
})

afterEach(async () => {
  for (const t of ['stockEtapaPlano', 'stockProducaoConclusao', 'stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockProductionOrder', 'stockMovement', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockColaborador', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** o lote de 2 etapas, separado e em produção, com a etapa 1 da eliane e a 2 sem nome */
async function loteDeDoisDias() {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 10, dataProducao: ONTEM }, prisma)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 10 }], prisma)
  await iniciarProducao(companyId, ordemId, prisma)
  const es = await prisma.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, orderBy: { posicao: 'asc' } })
  await designarEtapa({ companyId, etapaId: es[0].id, colaboradorId: eliane }, prisma)
  // ⭐ a etapa 2 é de AMANHÃ — e ainda sem nome (é o cenário do dono)
  await definirPlanoDaEtapa({ companyId, etapaId: es[1].id, diaPrevisto: '2026-09-04' }, prisma)
  return { ordemId, sovar: es[0].id, modelar: es[1].id }
}

describe('⭐⭐ a etapa aparece no DIA DELA', () => {
  it('⭐ hoje (03) a eliane vê só a etapa 1 — a 2 é de amanhã', async () => {
    const { sovar } = await loteDeDoisDias()
    const dela = await minhasTarefasDeHoje(companyId, eliane, ONTEM, prisma)
    expect(dela.map((t) => t.nome)).toEqual(['sovar'])
    expect(dela[0].etapaId).toBe(sovar)
  })

  /**
   * ⛔⛔ TERMINAR A ETAPA 1 NÃO OBRIGA COMEÇAR A 2 — o lote dorme, e à noite **não há nada
   * pendente**. Era exatamente o que o dono pediu: *"hoje à noite nada de etapa 2"*.
   */
  it('⛔ terminada a etapa 1, a noite fica VAZIA — o descanso é a receita', async () => {
    const { sovar } = await loteDeDoisDias()
    await iniciarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14, 40) }, prisma)
    expect(await minhasTarefasDeHoje(companyId, eliane, ONTEM, prisma)).toEqual([])
    expect(await minhasTarefasDeHoje(companyId, rodrigo, ONTEM, prisma)).toEqual([])
  })

  it('⭐ amanhã (04), nomeado o rodrigo, a etapa 2 aparece PRA ELE com "começou ontem"', async () => {
    const { sovar, modelar } = await loteDeDoisDias()
    await iniciarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14, 40) }, prisma)
    // ⛔ antes de nomear, a etapa 2 é rascunho: ninguém a vê
    expect(await minhasTarefasDeHoje(companyId, rodrigo, HOJE, prisma)).toEqual([])
    await designarEtapa({ companyId, etapaId: modelar, colaboradorId: rodrigo }, prisma)

    const dele = await minhasTarefasDeHoje(companyId, rodrigo, HOJE, prisma)
    expect(dele.map((t) => t.nome)).toEqual(['modelar'])
    expect(dele[0].continuacao).toEqual({ etapaAnterior: 'sovar', dia: '2026-09-03', quem: 'Eliane' })
    // ⚠️ e a eliane não vê a etapa do rodrigo — a janela é dele
    expect(await minhasTarefasDeHoje(companyId, eliane, HOJE, prisma)).toEqual([])
  })

  /**
   * ⚠️⚠️ REGRA 11 ME CORRIGIU: o teste "a eliane vê só a etapa 1" passava **mesmo sem o
   * filtro de dia** — a etapa 2 estava sem responsável, e a régua da VISIBILIDADE já a
   * escondia. *Duas travas empilhadas, e o teste media a de cima.*
   *
   * ⭐ O caso que ISOLA o dia: a etapa 2 **designada à própria eliane** e marcada pra amanhã.
   * Visível por responsável, invisível por DIA — só a régua do dia pode explicar.
   */
  it('⛔ etapa designada A MIM, mas de AMANHÃ, não aparece no meu hoje', async () => {
    const { modelar } = await loteDeDoisDias()
    await designarEtapa({ companyId, etapaId: modelar, colaboradorId: eliane }, prisma)
    const hoje03 = await minhasTarefasDeHoje(companyId, eliane, ONTEM, prisma)
    expect(hoje03.map((t) => t.nome), 'a etapa de amanhã vazou pro hoje').toEqual(['sovar'])
    // ⭐ e amanhã ela está lá, pra mesma pessoa
    const hoje04 = await minhasTarefasDeHoje(companyId, eliane, HOJE, prisma)
    expect(hoje04.map((t) => t.nome)).toEqual(['modelar'])
  })

  it('⭐ lote do MESMO dia não ganha selo de continuação — selo que aparece sempre ninguém lê', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: ONTEM }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 5 }], prisma)
    await iniciarProducao(companyId, ordemId, prisma)
    const es = await prisma.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, orderBy: { posicao: 'asc' } })
    for (const e of es) await designarEtapa({ companyId, etapaId: e.id, colaboradorId: eliane }, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: eliane, agora: d3(9) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: eliane, agora: d3(9, 30) }, prisma)
    const dela = await minhasTarefasDeHoje(companyId, eliane, ONTEM, prisma)
    expect(dela[0].continuacao).toBeNull()
  })
})

describe('⛔⛔⛔ o TEMPO do lote é SOMA — nunca fim−início atravessando a noite', () => {
  it('⭐⭐ o caso do dono: 40min + 35min = 1h15, nunca 20+ horas', async () => {
    const { ordemId, sovar, modelar } = await loteDeDoisDias()
    await iniciarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14) }, prisma)
    await finalizarTarefa({ companyId, etapaId: sovar, colaboradorId: eliane, agora: d3(14, 40) }, prisma)
    await designarEtapa({ companyId, etapaId: modelar, colaboradorId: rodrigo }, prisma)
    await iniciarTarefa({ companyId, etapaId: modelar, colaboradorId: rodrigo, agora: d4(8) }, prisma)
    await finalizarTarefa({ companyId, etapaId: modelar, colaboradorId: rodrigo, agora: d4(8, 35) }, prisma)
    await concluir({ companyId, ordemId, qtdGerada: 30, consumo: [{ itemId: acem, qtdConsumida: 10 }] }, prisma)

    const lotes = await lotesDaJanela(companyId, {}, prisma)
    expect(lotes).toHaveLength(1)
    // ⛔ 40 + 35 = 75. A régua velha daria ~1.235 min (20h35) — o sono contado como produção.
    expect(lotes[0].minutos).toBe(75)
  })

  /**
   * ⚠️ O CONTRAFACTUAL EXISTE PRA A RÉGUA NÃO VIRAR FÉ — e ele me corrigiu: eu tinha escrito
   * "20h35" de cabeça; a conta é **18h35 = 1.115 min**. O número que importa continua o
   * mesmo: **quinze vezes** o tempo que a cozinha de fato trabalhou (75 min).
   */
  it('⛔ e a régua velha (fim−início) daria 18h35 — quinze vezes o trabalho real', () => {
    const ini = d3(14), fim = d4(8, 35)
    const velha = Math.round((fim.getTime() - ini.getTime()) / 60_000)
    expect(velha).toBe(1115)
    expect(Math.round(velha / 75)).toBe(15)
  })

  it('⭐ a função pura soma os cronômetros', () => {
    expect(minutosDoLote([
      { iniciadoEm: d3(14), finalizadoEm: d3(14, 40) },
      { iniciadoEm: d4(8), finalizadoEm: d4(8, 35) },
    ])).toBe(75)
  })

  /** ⚠️ a honestidade não afrouxa: etapa sem fim = lote sem tempo medido. `null` ≠ 0. */
  it('⛔ etapa aberta deixa o lote SEM tempo medido — inventar o fim seria inventar minutos', () => {
    expect(minutosDoLote([
      { iniciadoEm: d3(14), finalizadoEm: d3(14, 40) },
      { iniciadoEm: d4(8), finalizadoEm: null },
    ])).toBeNull()
    expect(minutosDoLote([{ iniciadoEm: null, finalizadoEm: null }])).toBeNull()
  })

  it('⭐ o sono é MEDIDO à parte — informação, nunca tempo de trabalho', () => {
    expect(horasDormindo([
      { iniciadoEm: d3(14), finalizadoEm: d3(14, 40) },
      { iniciadoEm: d4(8), finalizadoEm: d4(8, 35) },
    ])).toBe(17.3)
  })
})
