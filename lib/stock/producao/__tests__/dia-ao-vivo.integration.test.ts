// ⭐⭐ "HOJE" AO VIVO — O QUE A TELA TEM QUE TRAVAR (06/09/2026).
//
// Os cinco red-then-green do desenho aprovado: iniciada aparece em AGORA com o tempo correndo ·
// finalizada SAI do agora e entra no histórico · cancelada SOME dos três blocos · o dia é o de
// **São Paulo** · quem não tem tarefa APARECE.
//
// ⚠️ `agora` é PARÂMETRO em toda chamada — o relógio serve pra exibir, nunca pra decidir, e um
// teste que não controla o instante não consegue provar o cronômetro.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao, cancelarOrdem } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { iniciarTarefa, finalizarTarefa } from '../minhas-tarefas'
import { concluirDoTablet } from '../concluir-do-tablet'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { diaAoVivo } from '../dia-ao-vivo'

const CNPJ = '11785433000122'
let companyId = ''
let fichaId = ''
let acem = ''
let gordura = ''
let carlise = ''
let nadine = ''
let michelle = ''

/** ⚠️ dia no PASSADO: data fixa em posição de relógio que ainda não chegou é bomba */
const DIA = '2026-09-04'
/** o instante de SP convertido pra UTC (SP = UTC−3) */
const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 4, h + 3, m))
const AGORA = emSP(10, 0)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'AO VIVO' } })).id
  for (const [nome, custo] of [['Acém', 33.95], ['Gordura', 9.6]] as const) {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    if (nome === 'Acém') acem = it.id; else gordura = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 200, custoUnitario: custo, custoTotal: custo * 200, origem: 'SEFAZ' } })
  }
  fichaId = (await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 1, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'gessado' }, { nome: 'moldar beef' }],
    componentes: [
      { itemId: acem, qtdPlanejada: 0.8, unidade: 'KG', posicao: 0 },
      { itemId: gordura, qtdPlanejada: 0.2, unidade: 'KG', posicao: 1 },
    ],
  }, prisma)).fichaId
  carlise = (await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)).colaboradorId!
  nadine = (await cadastrarPessoa({ companyId, nome: 'Nadine', funcao: 'COZINHA', pin: '5813' }, prisma)).colaboradorId!
  michelle = (await cadastrarPessoa({ companyId, nome: 'Michelle', funcao: 'COZINHA', pin: '9042' }, prisma)).colaboradorId!
})

afterEach(async () => {
  for (const t of ['stockOrdemEtapa', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

async function ordemSeparada(escala = 5) {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: escala, dataProducao: emSP(6) }, prisma)
  await confirmarSeparacao(companyId, ordemId, [
    { itemId: acem, qtdSeparada: 0.8 * escala },
    { itemId: gordura, qtdSeparada: 0.2 * escala },
  ], prisma)
  return ordemId
}

/** ⚠️ o teste controla os carimbos: o motor tem que ler o que o toque gravou, não o relógio */
async function carimbar(etapaId: string, campos: { iniciadoEm?: Date; finalizadoEm?: Date; designadoEm?: Date }) {
  await prisma.stockOrdemEtapa.update({ where: { id: etapaId }, data: campos })
}

describe('⭐⭐ AGORA — quem está com a mão na massa', () => {
  it('⭐⭐ tarefa INICIADA aparece em AGORA, com o instante que o toque gravou', async () => {
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(8, 40) })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora).toHaveLength(1)
    expect(d.agora[0].nome).toBe('Carlise')
    expect(d.agora[0].tarefa.nome).toBe('gessado')
    expect(d.agora[0].tarefa.produto).toBe('Beef de xis')
    // ⛔ o cronômetro é da TELA — o motor entrega o INSTANTE, não os minutos decorridos
    expect(d.agora[0].tarefa.iniciadoEm?.toISOString()).toBe(emSP(8, 40).toISOString())
    expect(d.agora[0].tarefa.estado).toBe('EM_ANDAMENTO')
    expect(d.agora[0].tarefa.abertaDemais, '1h20 não é alarme de 4h').toBe(false)
  })

  it('⛔⛔ FINALIZADA sai de AGORA e entra no histórico do dia, com início, fim e duração', async () => {
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await finalizarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(7, 10), finalizadoEm: emSP(7, 55) })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora, 'tarefa fechada continuou "acontecendo agora"').toHaveLength(0)
    const carla = d.pessoas.find((p) => p.colaboradorId === carlise)!
    // ⚠️ a etapa 2 não foi designada a ninguém, então não é fila DELA
    expect(carla).toMatchObject({ fazendo: 0, naFila: 0, feitas: 1 })
    const feita = carla.tarefas.find((t) => t.estado === 'FEITA')!
    expect(feita.minutos, '7:10 → 7:55 são 45 minutos').toBe(45)
  })

  it('⭐ o alarme de 4h aparece na tarefa, e é o ÚNICO alerta da tela', async () => {
    // ⛔ nenhum "vermelho de atraso": não existe hora prometida por tarefa. O alarme de 4h tem
    // causa real — o cronômetro correndo corrompe a média.
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: nadine }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: nadine }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(4, 30) })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora[0].tarefa.abertaDemais, '5h30 em aberto e nada acusou').toBe(true)
    expect(d.abertasDemais).toBe(1)
  })

  it('⛔ em DIA PASSADO o bloco AGORA é vazio — não há "agora" no passado', async () => {
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(8) })

    // o mesmo dia, olhado de uma semana depois
    const d = await diaAoVivo({ companyId, dia: DIA, agora: new Date(Date.UTC(2026, 8, 11, 12)) }, prisma)
    expect(d.ehHoje).toBe(false)
    expect(d.agora, 'o passado ganhou um "agora"').toHaveLength(0)
    // ⚠️ mas a tarefa continua no dia da pessoa — o diário não some
    expect(d.pessoas.find((p) => p.colaboradorId === carlise)!.tarefas).toHaveLength(1)
    expect(d.linhaDoTempo.some((e) => e.tipo === 'INICIOU')).toBe(true)
  })
})

describe('⛔⛔ ordem CANCELADA some dos três blocos', () => {
  it('⛔⛔ nem AGORA, nem fila, nem linha do tempo', async () => {
    const ordemId = await ordemSeparada()
    const [e1, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await designarEtapa({ companyId, etapaId: e2.id, colaboradorId: nadine }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(9) })

    const antes = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(antes.agora).toHaveLength(1)
    expect(antes.linhaDoTempo.some((e) => e.tipo === 'INICIOU')).toBe(true)

    await cancelarOrdem(companyId, ordemId, prisma)

    const depois = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(depois.agora, 'ordem cancelada continuou "em andamento"').toHaveLength(0)
    expect(depois.pessoas.every((p) => p.tarefas.length === 0), 'tarefa de ordem cancelada ficou na fila de alguém').toBe(true)
    expect(depois.linhaDoTempo, 'trabalho que não produziu ficou no diário').toHaveLength(0)
  })
})

describe('⛔⛔ o dia é o de SÃO PAULO', () => {
  it('⛔⛔ tarefa das 23h aparece no dia DELA, não no seguinte', async () => {
    // ⚠️ 23h em SP é 02h UTC do dia seguinte — foi exatamente o bug que fazia a conclusão da
    // noite sumir do filtro "hoje".
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await finalizarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(23, 0), finalizadoEm: emSP(23, 40) })

    const noDia = await diaAoVivo({ companyId, dia: DIA, agora: emSP(23, 50) }, prisma)
    expect(noDia.linhaDoTempo.filter((e) => e.tipo !== 'DESIGNOU'), 'a tarefa das 23h caiu no dia seguinte').toHaveLength(2)

    const seguinte = await diaAoVivo({ companyId, dia: '2026-09-05', agora: emSP(23, 50) }, prisma)
    expect(seguinte.linhaDoTempo.filter((e) => e.tipo !== 'DESIGNOU')).toHaveLength(0)
  })
})

describe('⭐ o dia de cada uma', () => {
  it('⭐⭐ quem NÃO TEM tarefa aparece — é o momento de designar, não um vazio a esconder', async () => {
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const semNada = d.pessoas.find((p) => p.colaboradorId === michelle)!
    expect(semNada, 'quem está livre sumiu da lista').toBeTruthy()
    expect(semNada.tarefas).toHaveLength(0)
    expect(semNada).toMatchObject({ fazendo: 0, naFila: 0, feitas: 0 })
  })

  it('⛔ mas quem está INATIVO some — livre ≠ inativo', async () => {
    await prisma.stockColaborador.update({ where: { id: michelle }, data: { ativo: false } })
    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.pessoas.map((p) => p.nome).sort()).toEqual(['Carlise', 'Nadine'])
  })

  it('⭐ "aguarda a anterior" NOMEIA a etapa que falta — é sequência, não atraso', async () => {
    const ordemId = await ordemSeparada()
    const [e1, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await designarEtapa({ companyId, etapaId: e2.id, colaboradorId: nadine }, prisma)

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const dela = d.pessoas.find((p) => p.colaboradorId === nadine)!.tarefas[0]
    // ⚠️ "aguarda a anterior" deixou de ser ESTADO e virou DETALHE do aguardando (07/09):
    // não é uma fila diferente, é a MESMA fila com um motivo — e como estado obrigava toda
    // tela a conhecer um sexto caso.
    expect(dela.estado).toBe('AGUARDANDO')
    expect(dela.esperando, 'estado mudo em vez de dizer o que falta').toBe('gessado')
    // ⚠️ e as duas contam como "na fila": separar na contagem faria o cabeçalho não fechar
    // com a lista embaixo dele.
    expect(d.pessoas.find((p) => p.colaboradorId === nadine)!.naFila).toBe(1)
  })

  it('⭐ tarefa SEM designação pertence a quem a EXECUTOU', async () => {
    // ⚠️ quem responde pela tarefa é o PIN que tocou. Designar pra A e B executar é
    // IMPOSSÍVEL por construção (o `iniciarTarefa` recusa) — então o caso que sobra, e que
    // esta tela tem que atribuir certo, é o da tarefa livre que alguém pegou.
    const ordemId = await ordemSeparada()
    const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: nadine }, prisma)
    await carimbar(e1.id, { iniciadoEm: emSP(9) })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    expect(d.agora[0].nome).toBe('Nadine')
    expect(d.pessoas.find((p) => p.colaboradorId === nadine)!.fazendo).toBe(1)
    expect(d.pessoas.find((p) => p.colaboradorId === carlise)!.tarefas).toHaveLength(0)
  })
})

describe('⭐ a linha do tempo é o diário', () => {
  it('⭐⭐ mistura iniciar, finalizar e o LOTE FECHADO — mais recente em cima', async () => {
    const ordemId = await ordemSeparada()
    const [e1, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    for (const [etapa, quem] of [[e1, carlise], [e2, nadine]] as const) {
      await designarEtapa({ companyId, etapaId: etapa.id, colaboradorId: quem }, prisma)
      await iniciarTarefa({ companyId, etapaId: etapa.id, colaboradorId: quem }, prisma)
      await finalizarTarefa({ companyId, etapaId: etapa.id, colaboradorId: quem }, prisma)
    }
    await carimbar(e1.id, { iniciadoEm: emSP(7, 10), finalizadoEm: emSP(7, 55) })
    await carimbar(e2.id, { iniciadoEm: emSP(8, 12), finalizadoEm: emSP(8, 58) })
    await concluirDoTablet({ companyId, ordemId, qtdGerada: 180, colaboradorId: nadine }, prisma)

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const reais = d.linhaDoTempo.filter((e) => e.tipo !== 'DESIGNOU')
    expect(reais.map((e) => e.tipo)).toEqual(['FINALIZOU', 'INICIOU', 'FINALIZOU', 'INICIOU'])
    for (let i = 1; i < reais.length; i++) {
      expect(reais[i - 1].quando.getTime(), 'a linha do tempo saiu fora de ordem').toBeGreaterThanOrEqual(reais[i].quando.getTime())
    }
    // ⭐ o lote fechado pendura na ÚLTIMA etapa finalizada — foi ela que fechou
    const fechou = reais.find((e) => e.loteFechado)!
    expect(fechou.tipo).toBe('FINALIZOU')
    expect(fechou.quem).toBe('Nadine')
    expect(fechou.loteFechado).toMatchObject({ qtdGerada: 180, unidade: 'UN' })
    expect(reais.filter((e) => e.loteFechado), 'o lote apareceu pendurado em duas etapas').toHaveLength(1)
  })

  it('⭐ DESIGNAR entra AGREGADO — uma linha por tarefa afogaria o que aconteceu de verdade', async () => {
    const ordemId = await ordemSeparada()
    const [e1, e2] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
    await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
    await designarEtapa({ companyId, etapaId: e2.id, colaboradorId: nadine }, prisma)
    // ⚠️ designar NO dia é o que vira evento; designar na véspera é preparo do dia seguinte,
    // e a fila daquele dia continua aparecendo pela `dataProducao` da ordem.
    await carimbar(e1.id, { designadoEm: emSP(6, 40) })
    await carimbar(e2.id, { designadoEm: emSP(6, 41) })

    const d = await diaAoVivo({ companyId, dia: DIA, agora: AGORA }, prisma)
    const desig = d.linhaDoTempo.filter((e) => e.tipo === 'DESIGNOU')
    expect(desig, 'designação virou uma linha por tarefa').toHaveLength(1)
    expect(desig[0].texto).toBe('2 tarefas designadas')
  })
})
