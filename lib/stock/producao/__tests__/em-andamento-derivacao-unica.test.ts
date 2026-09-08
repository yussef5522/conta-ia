// ⛔⛔⛔ O CASO CARLISE (08/09/2026) — o tablet trancou quem não tinha nada em aberto.
//
// **O RELATO DO DONO:** *"Ela esqueceu de finalizar e foi embora; eu resolvi pela Produção —
// tudo fechado. Mas quando ela digita o PIN no tablet aparece 'Você está com "produção" em
// andamento. Finalize antes de começar outra.' — e ela não tem NADA em aberto."*
//
// **O DADO REAL (medido em prod ANTES de qualquer linha de código):**
//   etapa cmtpeu3h300davfmpcfu3wx0v · "produção" · iniciada 06/09 19:38 · finalizadoEm NULL
//   encerrada sem finalizar? SIM (ORDEM_CONCLUIDA) · estado da ORDEM: CONCLUIDA
//   a trava via: 1 etapa aberta   ×   a derivação única dizia: ENCERRADA_SEM_FINALIZAR
//
// ⛔⛔ **A CAUSA, e é por isso que o fix é de CLASSE:** nos dois gestos que fecham uma etapa
// sem tempo medido, `finalizadoEm` **fica NULL de propósito** — é o que os mantém fora das
// médias (REGRA 5). Lida crua, essa mesma coluna tranca a pessoa. **Todo leitor que perguntar
// "em andamento?" olhando a coluna vai errar**, e a varredura achou CINCO deles.
//
// ⭐ Cada teste abaixo prova os dois lados: a régua crua tranca (o vermelho, afirmado
// explicitamente pra o guard não passar por cegueira — REGRA 11) e a derivação única solta.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { criarFicha } from '../fichas'
import { criarOrdem, confirmarSeparacao } from '../ordens'
import { etapasDaOrdem, designarEtapa } from '../etapas'
import { iniciarTarefa, TarefaError, tarefasAbertasDemais } from '../minhas-tarefas'
import { concluir } from '../conclusao'
import { cadastrarPessoa } from '../cadastrar-pessoa'
import { finalizarPeloGerente } from '../gestos-do-gerente'
import { relatorioPorPessoa } from '../relatorio-por-pessoa'
import { trabalhoPendurado, motivoParaNaoInativar } from '@/lib/equipe/inativar-colaborador'
import {
  etapasEmAndamentoDoColaborador,
  somenteEmAndamento,
  somentePendentes,
} from '../em-andamento'

const CNPJ = '55901224000155'
let companyId = ''
let fichaId = ''
let acem = ''
let gordura = ''
let carlise = ''
let userGerente = ''

const emSP = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 6, h + 3, m))
/** ⚠️ 4h21 depois do início das 19:38 — passa do limiar do alarme, que é o que o teste mede */
const AGORA = emSP(23, 59)
const DIA = '2026-09-06'

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: 'gerente-emandamento@teste.local' } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EM_ANDAMENTO' } })).id
  userGerente = (await prisma.user.create({ data: { email: 'gerente-emandamento@teste.local', name: 'Yussef', password: 'x' } })).id
  for (const [nome, custo] of [['Acém', 33.95], ['Gordura', 9.6]] as const) {
    const it = await prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA' } })
    if (nome === 'Acém') acem = it.id; else gordura = it.id
    await prisma.stockMovement.create({ data: { companyId, itemId: it.id, tipo: 'ENTRADA_NF', quantidade: 400, custoUnitario: custo, custoTotal: custo * 400, origem: 'SEFAZ' } })
  }
  fichaId = (await criarFicha({
    companyId, nomeProduzido: 'Beef de xis', unidadeProduzido: 'UN', tipoProduto: 'INTERMEDIARIO',
    loteBase: 10, unidadeLoteBase: 'KG', validadeDias: 10,
    etapas: [{ nome: 'produção' }, { nome: 'moldar beef' }],
    componentes: [
      { itemId: acem, qtdPlanejada: 0.8, unidade: 'KG', posicao: 0 },
      { itemId: gordura, qtdPlanejada: 0.2, unidade: 'KG', posicao: 1 },
    ],
  }, prisma)).fichaId
  carlise = (await cadastrarPessoa({ companyId, nome: 'Carlise', funcao: 'COZINHA', pin: '4726' }, prisma)).colaboradorId!
})

afterEach(async () => {
  for (const t of ['stockEtapaPedidoFinalizar', 'stockEtapaFinalizadaGerente', 'stockEtapaEncerrada', 'stockOrdemEtapaParticipante', 'stockOrdemEtapa', 'stockProducaoDesvio', 'stockProducaoConclusao', 'stockColaboradorPin', 'stockColaborador', 'stockMovement', 'stockProductionOrder', 'stockFichaEtapa', 'stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
  await prisma.user.deleteMany({ where: { id: userGerente } })
})

/** a etapa da Carlise aberta desde as 19:38 — o cenário do caso real */
async function etapaAberta() {
  const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: emSP(6) }, prisma)
  await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 4 }, { itemId: gordura, qtdSeparada: 1 }], prisma)
  const [e1] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)
  await designarEtapa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await iniciarTarefa({ companyId, etapaId: e1.id, colaboradorId: carlise }, prisma)
  await prisma.stockOrdemEtapa.update({ where: { id: e1.id }, data: { iniciadoEm: emSP(19, 38) } })
  return { ordemId, etapaId: e1.id }
}

/** o gesto do encarregado: conclui pela tela de Produção e leva a etapa aberta junto */
async function concluirPelaProducao(ordemId: string) {
  await concluir({
    companyId, ordemId, qtdGerada: 40, userId: userGerente,
    consumo: [{ itemId: acem, qtdConsumida: 4 }, { itemId: gordura, qtdConsumida: 1 }],
  }, prisma)
}

/** ⛔ a régua CRUA que estava no tablet — a que produziu a mensagem que trancou ela */
async function pelaColunaCrua(colaboradorId: string) {
  return prisma.stockOrdemEtapa.count({
    where: { companyId, executorId: colaboradorId, iniciadoEm: { not: null }, finalizadoEm: null },
  })
}

describe('⛔⛔⛔ O CASO REAL — a etapa que a ordem levou junto não prende ninguém', () => {
  it('⛔ a régua crua vê 1 aberta; a derivação única vê ZERO em andamento', async () => {
    const { ordemId } = await etapaAberta()
    await concluirPelaProducao(ordemId)

    // ⛔ é daqui que saía "Você está com 'produção' em andamento":
    expect(await pelaColunaCrua(carlise), 'a coluna crua ainda diz que tem uma aberta').toBe(1)

    // ⭐ e a pessoa não está com nada na mão:
    expect(await etapasEmAndamentoDoColaborador(companyId, carlise, prisma)).toEqual([])
  })

  it('⭐⭐ O PIN DELA ENTRA LIVRE NO TABLET: iniciar a tarefa de hoje NÃO é recusado', async () => {
    const antiga = await etapaAberta()
    await concluirPelaProducao(antiga.ordemId)

    // a produção de hoje, numa ordem viva
    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: emSP(8) }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 4 }, { itemId: gordura, qtdSeparada: 1 }], prisma)
    const [hoje] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)

    const r = await iniciarTarefa({ companyId, etapaId: hoje.id, colaboradorId: carlise }, prisma)
    expect(r.iniciadoEm, 'ela conseguiu começar a tarefa de hoje').toBeTruthy()
  })

  it('⛔ REGRA 11 — a trava CONTINUA mordendo quando a tarefa está mesmo correndo', async () => {
    // ⚠️ o fix não pode ter virado passe livre: ordem VIVA, etapa correndo de verdade.
    await etapaAberta()

    const { ordemId } = await criarOrdem({ companyId, fichaId, escalaReceitas: 5, dataProducao: emSP(8) }, prisma)
    await confirmarSeparacao(companyId, ordemId, [{ itemId: acem, qtdSeparada: 4 }, { itemId: gordura, qtdSeparada: 1 }], prisma)
    const [outra] = await etapasDaOrdem(companyId, ordemId, AGORA, prisma)

    await expect(
      iniciarTarefa({ companyId, etapaId: outra.id, colaboradorId: carlise }, prisma),
    ).rejects.toThrow(TarefaError)
  })

  it('⭐ FINALIZAR PELO GERENTE também solta a pessoa — sem inventar horário', async () => {
    const { etapaId } = await etapaAberta()
    expect(await etapasEmAndamentoDoColaborador(companyId, carlise, prisma)).toHaveLength(1)

    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    // ⛔ o `finalizadoEm` da etapa CONTINUA NULL — é o que a mantém fora das médias
    const depois = await prisma.stockOrdemEtapa.findUnique({ where: { id: etapaId } })
    expect(depois?.finalizadoEm, 'o gesto do gerente não carimba tempo').toBeNull()
    // ⭐ e ainda assim ela está livre
    expect(await etapasEmAndamentoDoColaborador(companyId, carlise, prisma)).toEqual([])
  })

  it('⛔⛔ E O RELÓGIO DO PARTICIPANTE FICA ABERTO — de propósito, e não mente por isso', async () => {
    // ⚠️ A tentação era o gesto do gerente carimbar `participante.finalizadoEm`. Isso
    // inventaria um horário que ninguém mediu, um nível abaixo de todos os testes que
    // protegem o de cima. Quem manda é o ESTADO DA ETAPA; o relógio é rastro.
    const { etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    const p = await prisma.stockOrdemEtapaParticipante.findFirst({ where: { etapaId, colaboradorId: carlise } })
    expect(p?.iniciadoEm, 'o rastro de que ela começou continua lá').toBeTruthy()
    expect(p?.finalizadoEm, 'e ninguém inventou a hora em que ela parou').toBeNull()
    // ⭐ mesmo com o relógio dela aberto, ela não está "em andamento" em lugar nenhum
    expect(await etapasEmAndamentoDoColaborador(companyId, carlise, prisma)).toEqual([])
  })
})

describe('⭐ os QUATRO leitores vizinhos que a varredura achou', () => {
  it('⭐ INATIVAR: a etapa encerrada não impede mais tirar a pessoa da equipe', async () => {
    const { ordemId } = await etapaAberta()
    await concluirPelaProducao(ordemId)

    const t = await trabalhoPendurado(companyId, carlise, prisma)
    expect(t.etapasEmAndamento).toBe(0)
    expect(t.designadasAbertas).toBe(0)
    expect(motivoParaNaoInativar(t, 'Carlise'), 'nada pendurado, nada a resolver').toBeNull()
  })

  it('⛔ INATIVAR continua impedindo quando há trabalho de verdade pendurado', async () => {
    await etapaAberta()
    const t = await trabalhoPendurado(companyId, carlise, prisma)
    expect(t.etapasEmAndamento).toBe(1)
    expect(motivoParaNaoInativar(t, 'Carlise')).toContain('em andamento')
  })

  it('⭐ ALARME 4h: etapa encerrada há horas não vira cobrança', async () => {
    const { ordemId } = await etapaAberta()
    await concluirPelaProducao(ordemId)
    expect(await tarefasAbertasDemais(companyId, AGORA, prisma)).toEqual([])
  })

  it('⛔ ALARME 4h continua mordendo a que está aberta de verdade', async () => {
    await etapaAberta()
    expect(await tarefasAbertasDemais(companyId, AGORA, prisma)).toHaveLength(1)
  })

  it('⭐ FECHAR O LOTE: a finalizada pelo gerente não conta como "faltando"', async () => {
    const { ordemId, etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    const candidatas = await prisma.stockOrdemEtapa.findMany({
      where: { companyId, ordemId, finalizadoEm: null },
      select: { id: true, ordemId: true, iniciadoEm: true, finalizadoEm: true },
    })
    // ⛔ a régua crua diria "faltam 2" (a do gerente + a que ninguém pegou)
    expect(candidatas).toHaveLength(2)
    // ⭐ pela derivação, só a que ninguém pegou ainda pede trabalho
    const faltando = await somentePendentes(companyId, candidatas, prisma)
    expect(faltando).toHaveLength(1)
    expect(faltando[0].id).not.toBe(etapaId)
  })

  it('⭐ RELATÓRIO: a resolvida pelo gerente sai de "abertas ignoradas"', async () => {
    // ⛔ pela régua crua ela era contada DUAS vezes: presente no corpo do relatório (entra
    // pelo carimbo do gerente) E como "aberta ignorada". O número existe pra dizer quanto
    // trabalho ficou fora da conta — inflado, cobra o que não existe.
    const { etapaId } = await etapaAberta()
    await finalizarPeloGerente({ companyId, etapaId, userId: userGerente }, prisma)

    const r = await relatorioPorPessoa({ companyId, de: DIA, ate: DIA }, prisma)
    expect(r.abertasIgnoradas).toBe(0)
    expect(r.pessoas.find((p) => p.colaboradorId === carlise)?.tarefas, 'e ela continua com a tarefa no dia dela').toBe(1)
  })

  it('⭐ a etapa AGUARDANDO continua sobrando (pendente ≠ em andamento)', async () => {
    const { ordemId } = await etapaAberta()
    // ⚠️ cru do banco: `etapasDaOrdem` devolve ISO string, e a derivação trabalha com Date
    const crus = await prisma.stockOrdemEtapa.findMany({
      where: { companyId, ordemId },
      select: { id: true, ordemId: true, iniciadoEm: true, finalizadoEm: true },
    })

    // as duas pedem trabalho: uma correndo, uma na fila
    expect(await somentePendentes(companyId, crus, prisma)).toHaveLength(2)
    // mas só uma tem alguém com a mão na massa
    expect(await somenteEmAndamento(companyId, crus, prisma)).toHaveLength(1)
  })
})
