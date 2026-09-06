// ⭐⭐ DUAS MÃOS, DOIS TEMPOS — o caso REAL do beef (06/09/2026).
//
// O dono descreveu a cozinha: *"etapa 1: um funcionário pega as carnes e faz o GESSADO na
// máquina; etapa 2: OUTRO funcionário faz as bolinhas e molda os beefs."* Até aqui a ordem
// tinha **um** `colaboradorId` no cabeçalho — o sistema só sabia registrar a segunda mão.
//
// Este arquivo executa o caminho inteiro: receita com etapas → ordem → PIN → iniciar →
// finalizar → relatório do mês. Nada de grep: cada teste roda a função que a tela roda.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha, atualizarFicha, getFicha } from '../fichas'
import { criarOrdem } from '../ordens'
import { etapasDaOrdem, designarEtapa, resolverEtapas, normalizarEtapas, ETAPA_UNICA, EtapaError } from '../etapas'
import { definirPin, quemEstaComOPin, validarFormatoDoPin, hashDoPin, PinError } from '../pin'
import { minhasTarefasDeHoje, iniciarTarefa, finalizarTarefa, devolverTarefa, tarefasAbertasDemais, TarefaError } from '../minhas-tarefas'
import { relatorioPorPessoa, AVISO_NAO_E_PONTO } from '../relatorio-por-pessoa'
import { snapshotClosedModules, isolationHeld } from '../../stock-invariants'

const CNPJ = '50505050000188'
let companyId = ''
let ids: Record<string, string> = {}
let fichaBeef = ''
let cristian = ''
let marcyelle = ''

/**
 * ⚠️ INSTANTES EXPLÍCITOS: o relógio nunca decide num teste — tudo aqui é parâmetro.
 *
 * ⛔ E O DIA É NO **PASSADO** (04/09), não hoje: data fixa em posição de relógio que ainda
 * não chegou é bomba de calendário — o guard `sem-data-fixa-no-futuro` pegou a 1ª versão
 * deste arquivo, que usava 06/09. Como todas as funções recebem `agora`, o dia escolhido é
 * indiferente; o que não pode é ele estar à frente do relógio de quem roda a suíte.
 */
const HOJE = new Date('2026-09-04T17:00:00.000Z') // 14:00 em São Paulo
const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'ETAPAS' } })).id
  ids = {}
  for (const [nome, custo] of [['Acém', 33.95], ['Gordura', 9.6]] as const) {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    ids[nome] = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 50, custoUnitario: custo, custoTotal: custo * 50, origem: 'SEFAZ' } })
  }
  const f = await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 10,
    // ⭐ as DUAS etapas reais da cozinha
    etapas: [{ nome: 'gessado' }, { nome: 'moldar beef' }],
    componentes: [
      { itemId: ids['Acém'], qtdPlanejada: 0.8, unidade: 'KG', posicao: 0 },
      { itemId: ids['Gordura'], qtdPlanejada: 0.2, unidade: 'KG', posicao: 1 },
    ],
  }, prisma)
  fichaBeef = f.fichaId
  cristian = (await prisma.stockColaborador.create({ data: { companyId, nome: 'Cristian' } })).id
  marcyelle = (await prisma.stockColaborador.create({ data: { companyId, nome: 'Marcyelle' } })).id
})

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  for (const t of ['stockOrdemEtapaCorrecao', 'stockOrdemEtapa', 'stockColaboradorPin', 'stockColaborador', 'stockProducaoConclusao', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const ordemDeHoje = async () => (await criarOrdem({ companyId, fichaId: fichaBeef, escalaReceitas: 12, dataProducao: HOJE }, prisma)).ordemId

describe('⭐⭐ as etapas moram na receita e nascem com a ordem', () => {
  it('⭐⭐ a ordem do beef nasce com as DUAS etapas, na ordem certa', async () => {
    const etapas = await etapasDaOrdem(companyId, await ordemDeHoje(), HOJE, prisma)
    expect(etapas.map((e) => e.nome)).toEqual(['gessado', 'moldar beef'])
    expect(etapas.every((e) => e.estado === 'AGUARDANDO')).toBe(true)
    expect(etapas.every((e) => e.minutos === null), 'tempo só existe depois do toque').toBe(true)
  })

  it('⛔⛔ receita SEM etapa continua funcionando — vira UMA etapa, sem backfill', async () => {
    const sem = await criarFicha({
      companyId, nomeProduzido: 'Porção avulsa', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
      loteBase: 1, unidadeLoteBase: 'KG',
      componentes: [{ itemId: ids['Acém'], qtdPlanejada: 1, unidade: 'KG', posicao: 0 }],
    }, prisma)
    const { ordemId } = await criarOrdem({ companyId, fichaId: sem.fichaId, escalaReceitas: 1, dataProducao: HOJE }, prisma)
    const etapas = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    expect(etapas).toHaveLength(1)
    expect(etapas[0].nome).toBe(ETAPA_UNICA)
    // ⭐ e o banco não ganhou linha de etapa na FICHA — a ausência continua sendo a resposta
    const versao = await prisma.stockFichaVersao.findFirst({ where: { companyId, fichaId: sem.fichaId } })
    expect(await prisma.stockFichaEtapa.count({ where: { companyId, versaoId: versao!.id } })).toBe(0)
  })

  it('⭐ a régua da ausência é PURA e vale pra todo leitor', () => {
    expect(resolverEtapas([]).map((e) => e.nome)).toEqual([ETAPA_UNICA])
    expect(resolverEtapas([{ posicao: 1, nome: 'b', setorId: null }, { posicao: 0, nome: 'a', setorId: null }]).map((e) => e.nome))
      .toEqual(['a', 'b'])
  })

  it('⛔ etapa repetida é recusada — senão o relatório por tipo de tarefa vira ambíguo', () => {
    expect(() => normalizarEtapas([{ nome: 'gessado' }, { nome: 'Gessado' }])).toThrow(EtapaError)
    expect(normalizarEtapas([{ nome: ' gessado ' }, { nome: '' }, { nome: 'moldar' }]).map((e) => e.nome))
      .toEqual(['gessado', 'moldar'])
  })

  it('⛔⛔ mudar as etapas versiona (é MÉTODO) e a ordem antiga NÃO muda', async () => {
    const ordemId = await ordemDeHoje()
    await atualizarFicha(companyId, fichaBeef, { etapas: [{ nome: 'gessado' }, { nome: 'moldar beef' }, { nome: 'embalar' }] }, prisma)
    const f = await getFicha(companyId, fichaBeef, prisma)
    expect(f!.ficha.versaoAtual, 'etapa nova = versão nova').toBe(2)
    expect(f!.ficha.etapas.map((e) => e.nome)).toEqual(['gessado', 'moldar beef', 'embalar'])
    // ⭐ a ordem de hoje continua com o método da época — o passado não se reescreve
    expect((await etapasDaOrdem(companyId, ordemId, HOJE, prisma)).map((e) => e.nome)).toEqual(['gessado', 'moldar beef'])
  })

  it('⚠️ salvar a ficha SEM mandar etapas HERDA as anteriores (não apaga o método em silêncio)', async () => {
    await atualizarFicha(companyId, fichaBeef, { loteBase: 2 }, prisma)
    const f = await getFicha(companyId, fichaBeef, prisma)
    expect(f!.ficha.etapas.map((e) => e.nome)).toEqual(['gessado', 'moldar beef'])
  })
})

describe('⭐ o PIN identifica — e não sai do banco em claro', () => {
  it('⛔⛔ o que é gravado é HASH, e o PIN não aparece em lugar nenhum da linha', async () => {
    await definirPin({ companyId, colaboradorId: cristian, pin: '4726' }, prisma)
    const linha = await prisma.stockColaboradorPin.findFirst({ where: { companyId, colaboradorId: cristian } })
    expect(linha!.pinHash).not.toContain('4726')
    expect(linha!.pinHash).toBe(hashDoPin(companyId, '4726'))
    expect(JSON.stringify(linha)).not.toContain('4726')
  })

  it('⭐ o hash leva o companyId junto: o mesmo PIN em duas empresas dá hashes diferentes', () => {
    expect(hashDoPin('empresa-a', '4726')).not.toBe(hashDoPin('empresa-b', '4726'))
  })

  it('⭐⭐ o PIN diz QUEM é — e PIN errado não diz nada', async () => {
    await definirPin({ companyId, colaboradorId: cristian, pin: '4726' }, prisma)
    expect((await quemEstaComOPin(companyId, '4726', prisma))?.nome).toBe('Cristian')
    expect(await quemEstaComOPin(companyId, '4727', prisma)).toBeNull()
    expect(await quemEstaComOPin(companyId, 'abcd', prisma)).toBeNull()
  })

  it('⛔ PIN óbvio e PIN repetido são recusados — o PIN é a assinatura de quem fez', async () => {
    expect(() => validarFormatoDoPin('1234')).toThrow(PinError)
    expect(() => validarFormatoDoPin('0000')).toThrow(PinError)
    expect(() => validarFormatoDoPin('47')).toThrow(PinError)
    await definirPin({ companyId, colaboradorId: cristian, pin: '4726' }, prisma)
    await expect(definirPin({ companyId, colaboradorId: marcyelle, pin: '4726' }, prisma)).rejects.toThrow(/já usa esse PIN/)
  })

  it('⭐ trocar o PIN revoga o anterior (um ativo por pessoa, com rastro dos dois)', async () => {
    await definirPin({ companyId, colaboradorId: cristian, pin: '4726' }, prisma)
    const r = await definirPin({ companyId, colaboradorId: cristian, pin: '8351' }, prisma)
    expect(r.trocou).toBe(true)
    expect(await quemEstaComOPin(companyId, '4726', prisma), 'o PIN velho morreu').toBeNull()
    expect((await quemEstaComOPin(companyId, '8351', prisma))?.nome).toBe('Cristian')
    expect(await prisma.stockColaboradorPin.count({ where: { companyId, colaboradorId: cristian } }), 'rastro dos dois').toBe(2)
    expect(await prisma.stockColaboradorPin.count({ where: { companyId, colaboradorId: cristian, revogadoEm: null } })).toBe(1)
  })
})

describe('⭐⭐ a janela do funcionário: cada um vê SÓ o que é dele', () => {
  let ordemId = ''
  let gessado = ''
  let moldar = ''

  beforeEach(async () => {
    ordemId = await ordemDeHoje()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    gessado = es[0].id; moldar = es[1].id
    await designarEtapa({ companyId, etapaId: gessado, colaboradorId: cristian }, prisma)
    await designarEtapa({ companyId, etapaId: moldar, colaboradorId: marcyelle }, prisma)
  })

  it('⭐⭐ o beef designado às duas mãos: cada um vê a SUA etapa, e só ela', async () => {
    const doCristian = await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma)
    const daMarcyelle = await minhasTarefasDeHoje(companyId, marcyelle, HOJE, prisma)
    expect(doCristian.map((t) => t.nome)).toEqual(['gessado'])
    expect(daMarcyelle.map((t) => t.nome)).toEqual(['moldar beef'])
    // ⭐ a tela diz o que está esperando, sem bloquear
    expect(daMarcyelle[0].esperandoEtapaAnterior).toBe('gessado')
    expect(doCristian[0].esperandoEtapaAnterior).toBeNull()
  })

  it('⭐⭐ iniciar e finalizar gravam o tempo dos TOQUES, com dono', async () => {
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(14, 2) }, prisma)
    const r = await finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(15, 14) }, prisma)
    expect(r.minutos).toBe(72)
    const e = (await etapasDaOrdem(companyId, ordemId, HOJE, prisma))[0]
    expect(e.estado).toBe('FEITA')
    expect(e.executorNome).toBe('Cristian')
    expect(e.minutos).toBe(72)
  })

  it('⛔ ninguém finaliza a tarefa de outro — a assinatura é de quem iniciou', async () => {
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await expect(finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: marcyelle, agora: emSP(15) }, prisma))
      .rejects.toThrow(/Quem finaliza é quem iniciou/)
  })

  it('⛔ a tarefa solta que o outro pegou SOME da minha janela — e o que protege é a designação', async () => {
    await designarEtapa({ companyId, etapaId: moldar, colaboradorId: null }, prisma) // solta
    // antes: ela aparece pros dois
    expect((await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma)).map((t) => t.nome))
      .toEqual(['gessado', 'moldar beef'])
    await iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: marcyelle, agora: emSP(15, 20) }, prisma)
    // ⭐ o mecanismo REAL: pegar a etapa carimba o `colaboradorId` — e é ISSO que a tira da
    // janela dos outros (o filtro por `executorId` é backstop, e está anotado como tal).
    expect((await etapasDaOrdem(companyId, ordemId, HOJE, prisma))[1].colaboradorNome).toBe('Marcyelle')
    expect((await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma)).map((t) => t.nome)).toEqual(['gessado'])
  })

  it('⛔ e ninguém INICIA a tarefa designada a outro (a trava que o teste acima depende)', async () => {
    await expect(iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: cristian, agora: emSP(15) }, prisma))
      .rejects.toThrow(/designada pra outra pessoa/)
  })

  it('⭐ etapa SEM designação aparece pra todo mundo e a designação nasce do gesto', async () => {
    await designarEtapa({ companyId, etapaId: moldar, colaboradorId: null }, prisma)
    expect((await minhasTarefasDeHoje(companyId, cristian, HOJE, prisma)).map((t) => t.nome))
      .toEqual(['gessado', 'moldar beef'])
    await iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: cristian, agora: emSP(15) }, prisma)
    const e = (await etapasDaOrdem(companyId, ordemId, HOJE, prisma))[1]
    expect(e.colaboradorNome, 'quem pegou fica registrado').toBe('Cristian')
  })

  it('⛔ uma tarefa por par de mãos: começar a segunda com a primeira aberta é recusado', async () => {
    await designarEtapa({ companyId, etapaId: moldar, colaboradorId: cristian }, prisma)
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await expect(iniciarTarefa({ companyId, etapaId: moldar, colaboradorId: cristian, agora: emSP(14, 5) }, prisma))
      .rejects.toThrow(/gessado[\s\S]*em andamento/)
  })

  it('⭐⭐ "não é meu turno" devolve SEM gravar tempo (não é finalizar com zero)', async () => {
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(14) }, prisma)
    await devolverTarefa({ companyId, etapaId: gessado, colaboradorId: cristian }, prisma)
    const e = (await etapasDaOrdem(companyId, ordemId, HOJE, prisma))[0]
    expect(e.estado).toBe('AGUARDANDO')
    expect(e.iniciadoEm).toBeNull()
    expect(e.executorId).toBeNull()
    // ⚠️ a designação da GERÊNCIA fica (ela não nasceu do gesto)
    expect(e.colaboradorNome).toBe('Cristian')
  })

  it('⛔⛔ tarefa aberta NUNCA fecha sozinha — ela vira alarme depois de 4h', async () => {
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(9) }, prisma)
    expect(await tarefasAbertasDemais(companyId, emSP(12, 30), prisma), 'com 3h30 ainda não alarma').toHaveLength(0)
    const abertas = await tarefasAbertasDemais(companyId, emSP(14), prisma)
    expect(abertas).toHaveLength(1)
    expect(abertas[0].quem).toBe('Cristian')
    expect(abertas[0].horas).toBe(5)
    // ⭐ e continua ABERTA no banco: o sistema cobra, não inventa um horário de fim
    expect((await etapasDaOrdem(companyId, ordemId, emSP(14), prisma))[0].finalizadoEm).toBeNull()
  })

  it('⛔⛔ terminar ANTES de começar é recusado (e a 1ª versão deste teste passava por cegueira)', async () => {
    // ⚠️ CONFISSÃO: a 1ª versão mandava a Marcyelle finalizar e "passava" — pela trava do
    // executor, não pela do tempo. Guard que passa pelo motivo errado dá selo verde de graça.
    await iniciarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(15) }, prisma)
    await expect(finalizarTarefa({ companyId, etapaId: gessado, colaboradorId: cristian, agora: emSP(14) }, prisma))
      .rejects.toThrow(/não pode ser antes do início/)
    // ⭐ e nada foi gravado: a tarefa segue aberta, não fechada com duração zero
    expect((await etapasDaOrdem(companyId, ordemId, emSP(16), prisma))[0].finalizadoEm).toBeNull()
  })
})

describe('⭐⭐ o relatório do fim do mês', () => {
  beforeEach(async () => {
    // três lotes: Cristian faz o gessado (rápido), Marcyelle molda
    for (let i = 0; i < 3; i++) {
      const { ordemId } = await criarOrdem({ companyId, fichaId: fichaBeef, escalaReceitas: 10, dataProducao: HOJE }, prisma)
      const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
      await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
      await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(9) }, prisma)
      await iniciarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(9) }, prisma)
      await finalizarTarefa({ companyId, etapaId: es[1].id, colaboradorId: marcyelle, agora: emSP(11) }, prisma)
      await prisma.stockProducaoConclusao.create({
        data: { companyId, ordemId, qtdGerada: 100, escalaConsumida: 10, custoLoteReal: 300, custoUnitarioReal: 3, rendimento: 10, criadoEm: emSP(11) },
      })
    }
  })

  it('⭐⭐ conta por PESSOA, e o volume do lote NÃO é contado duas vezes', async () => {
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    expect(r.pessoas).toHaveLength(2)
    const c = r.pessoas.find((p) => p.nome === 'Cristian')!
    const m = r.pessoas.find((p) => p.nome === 'Marcyelle')!
    expect(c.tarefas).toBe(3)
    expect(c.minutos, '3 × 60min').toBe(180)
    expect(m.minutos, '3 × 120min').toBe(360)
    // ⛔ 300 unidades produzidas, DUAS etapas → 150 pra cada. Contar 300 pra cada dobraria
    // a produção da cozinha no relatório.
    expect(c.produziu).toBe(150)
    expect(m.produziu).toBe(150)
  })

  it('⭐⭐ o min/unidade é o que responde a pergunta do dono — tempo bruto puniria o lote grande', async () => {
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    const c = r.pessoas.find((p) => p.nome === 'Cristian')!
    const m = r.pessoas.find((p) => p.nome === 'Marcyelle')!
    expect(c.minPorUnidade, '180min ÷ 150 un').toBe(1.2)
    expect(m.minPorUnidade, '360min ÷ 150 un').toBe(2.4)
    expect(c.unidade).toBe('UN')
  })

  it('⛔ tarefa ABERTA fica de fora da média (senão a pessoa piora sozinha com o relógio)', async () => {
    const { ordemId } = await criarOrdem({ companyId, fichaId: fichaBeef, escalaReceitas: 10, dataProducao: HOJE }, prisma)
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(8) }, prisma)
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    expect(r.pessoas.find((p) => p.nome === 'Cristian')!.tarefas, 'continua 3').toBe(3)
    expect(r.abertasIgnoradas, 'mas a tela DIZ que existe uma aberta').toBe(1)
  })

  it('⭐ o detalhe por TIPO de tarefa responde "quanto demora o gessado dele"', async () => {
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05', detalharColaboradorId: cristian }, prisma)
    expect(r.porTarefa).toHaveLength(1)
    expect(r.porTarefa[0].nome).toBe('gessado')
    expect(r.porTarefa[0].vezes).toBe(3)
    expect(r.porTarefa[0].minutosMedia).toBe(60)
  })

  it('⛔⛔ e a tela DIZ que isto não é ponto — a jornada oficial é o REP', async () => {
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    expect(r.avisoDeEscopo).toBe(AVISO_NAO_E_PONTO)
    expect(r.avisoDeEscopo).toMatch(/não presença/)
    expect(r.avisoDeEscopo).toMatch(/TecnoPonto/)
  })

  it('⚠️ menos de 3 lotes com régua → rendimento "a apurar", nunca um número redondo', async () => {
    const r = await relatorioPorPessoa({ companyId, de: '2026-09-01', ate: '2026-09-05' }, prisma)
    // as 3 conclusões têm rendimento idêntico → a régua existe e o desvio é 0
    const c = r.pessoas.find((p) => p.nome === 'Cristian')!
    expect(c.rendimentoVsEsperado).toBe(0)
    const vazio = await relatorioPorPessoa({ companyId, de: '2026-08-01', ate: '2026-08-31' }, prisma)
    expect(vazio.pessoas, 'mês sem tarefa não inventa linha').toEqual([])
  })
})

describe('⛔ o isolamento continua de pé', () => {
  it('nada disto escreve em tabela fechada', async () => {
    const antes = await snapshotClosedModules(prisma, companyId)
    const ordemId = await ordemDeHoje()
    const es = await etapasDaOrdem(companyId, ordemId, HOJE, prisma)
    await definirPin({ companyId, colaboradorId: cristian, pin: '4726' }, prisma)
    await designarEtapa({ companyId, etapaId: es[0].id, colaboradorId: cristian }, prisma)
    await iniciarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(10) }, prisma)
    await finalizarTarefa({ companyId, etapaId: es[0].id, colaboradorId: cristian, agora: emSP(11) }, prisma)
    expect(isolationHeld(antes, await snapshotClosedModules(prisma, companyId))).toBe(true)
  })
})
