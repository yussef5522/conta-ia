// ⭐⭐ A JANELA DO FUNCIONÁRIO — "o que eu tenho que fazer hoje" (06/09/2026).
//
// O funcionário abre o tablet da cozinha, digita o PIN e vê **só as tarefas dele de hoje**.
// Nada de financeiro, nada de estoque, nada das tarefas dos outros. É o *Lists → Mine* do
// Jolt, com o vocabulário desta cozinha.
//
// ⛔⛔ O TEMPO É DOS TOQUES, E SÓ. `iniciadoEm` sai do botão INICIAR, `finalizadoEm` do
// FINALIZAR. Ninguém digita duração; ninguém edita horário (correção é evento com autor e
// motivo); e **tarefa iniciada NUNCA fecha sozinha** — fechar seria inventar um horário que
// ninguém mediu, e o inventado entraria na média de min/kg como se fosse fato.
//
// ⚠️ UM RESPONSÁVEL POR ETAPA (decisão do dono): quem inicia e finaliza assina o tempo. Dois
// trabalhando juntos dividiriam o tempo em rateio arbitrário e o min/kg viraria número de fé.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'
import { minutosDaEtapa, HORAS_ATE_ALARME, type EstadoDaEtapa } from './etapas'
import { resolverEstadoDasEtapas, marcarPedidoAtendido } from './gestos-do-gerente'
import { participantesDaEtapa, registrarInicio, registrarFim, desfazerInicio } from './participantes'
import { etapasEmAndamentoDoColaborador, somenteEmAndamento } from './em-andamento'
import { validarEntrada, MAX_PARTICIPANTES } from './dupla-na-etapa'

type Db = PrismaClient | Prisma.TransactionClient

export class TarefaError extends Error {}

export interface MinhaTarefa {
  etapaId: string
  ordemId: string
  posicao: number
  nome: string
  produto: string
  escalaReceitas: number
  estado: EstadoDaEtapa
  iniciadoEm: string | null
  minutos: number | null
  /**
   * ⭐ a etapa anterior ainda não terminou. A tela mostra "depois de X" **e desabilita o
   * INICIAR** — e o SERVIDOR recusa (06/09). Antes só a tela avisava, e o botão funcionava:
   * a etapa 2 do beef foi feita com a 1 ainda aguardando.
   */
  esperandoEtapaAnterior: string | null
  /** designada a mim, ou solta (qualquer um pega com o PIN) */
  minha: boolean
  /**
   * ⭐⭐ O GERENTE PEDIU PRA VOCÊ FINALIZAR (07/09) — o caminho PREFERIDO de resolver uma
   * tarefa aberta. Ela aperta com o PIN dela e **o tempo é dela, medido de verdade**.
   * ⚠️ É um RECADO, não uma ordem: o botão FINALIZAR é o mesmo de sempre, e nada muda no
   * fluxo — só aparece o aviso.
   */
  pedidoPraFinalizar: boolean
  /**
   * ⭐ é a ÚLTIMA etapa da ordem? Finalizar ela pergunta "quantos saíram?" ALI — o número
   * vem de quem sabe, e conclui a ordem pelo mesmo motor da tela de Produção.
   */
  ultima: boolean
}

/**
 * ⭐ AS TAREFAS DE HOJE DE UMA PESSOA.
 *
 * ⚠️ "Hoje" é o dia de **São Paulo** — a mesma função do painel. Foi o bug de 05/09: às 22h
 * o dia UTC já virou e a cozinha veria a lista vazia justamente quando ainda está
 * trabalhando.
 *
 * ⭐ Inclui as **não designadas** das ordens abertas: etapa sem dono continua funcionando, e
 * quem pegar com o PIN fica registrado. Nada trava a cozinha por falta de cadastro.
 */
export async function minhasTarefasDeHoje(
  companyId: string, colaboradorId: string, agora: Date = new Date(), db: Db = defaultPrisma,
): Promise<MinhaTarefa[]> {
  const hoje = diaEmSaoPaulo(agora)
  const janela = janelaDoDiaSP(hoje, hoje)

  const ordens = await db.stockProductionOrder.findMany({
    where: {
      companyId,
      // ⚠️ CANCELADA já está fora por construção (a lista de estados é allowlist) — e é o
      // certo: ninguém deve começar tarefa de uma ordem que o dono cancelou.
      estado: { in: ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'] },
      dataProducao: { gte: janela.de, lte: janela.ate },
    },
    select: { id: true, itemProduzidoId: true, escalaReceitas: true },
  })
  if (!ordens.length) return []

  const [etapas, itens] = await Promise.all([
    db.stockOrdemEtapa.findMany({
      where: { companyId, ordemId: { in: ordens.map((o) => o.id) } },
      orderBy: [{ ordemId: 'asc' }, { posicao: 'asc' }],
    }),
    db.stockItem.findMany({ where: { companyId, id: { in: ordens.map((o) => o.itemProduzidoId) } }, select: { id: true, nome: true } }),
  ])
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const porOrdem = new Map(ordens.map((o) => [o.id, o]))
  // ⭐⭐ FONTE ÚNICA: o mesmo resolvedor da tela da ordem e do "HOJE ao vivo"
  const resolvidas = await resolverEstadoDasEtapas(companyId, etapas, db)

  const out: MinhaTarefa[] = []
  for (const e of etapas) {
    if (e.finalizadoEm) continue // feita não é tarefa
    // ⚠️ tarefa de OUTRA pessoa não aparece — nem pra espiar. A janela é dele.
    const minha = e.colaboradorId === colaboradorId
    const solta = e.colaboradorId == null
    if (!minha && !solta) continue
    // ⚠️ BACKSTOP HONESTO: hoje esta linha **não é alcançável pelo caminho do app** — quem
    // pega uma etapa solta vira o `colaboradorId` dela (a designação nasce do gesto), e o
    // filtro de cima já a tira da janela dos outros; e etapa designada a alguém o
    // `iniciarTarefa` recusa pra terceiros. Medido na REGRA 11: removi esta linha e os 27
    // testes seguiram VERDES.
    // ⛔ Fica como rede pra um caminho FUTURO que grave `iniciadoEm` sem mexer na designação
    // (uma correção de tempo, por exemplo) — mas fica ANOTADA como não coberta, em vez de
    // passar por defesa provada. Guard que ninguém consegue derrubar é guard que ninguém sabe
    // se funciona.
    if (e.iniciadoEm && e.executorId !== colaboradorId) continue
    // ⛔ o gerente já finalizou por ela: não é mais tarefa dela, e mostrar o botão FINALIZAR
    // deixaria o tablet oferecer um gesto que o servidor recusa.
    const res = resolvidas.get(e.id)!
    if (res.estado !== 'AGUARDANDO' && res.estado !== 'EM_ANDAMENTO') continue

    const anterior = etapas.find((x) => x.ordemId === e.ordemId && x.posicao === e.posicao - 1)
    // ⚠️ "última" é sobre a ORDEM inteira, não sobre o que sobrou pra fazer: a lista já
    // filtrou as finalizadas, então contar aqui daria "última" pra qualquer etapa sozinha.
    const maiorPosicao = Math.max(...etapas.filter((x) => x.ordemId === e.ordemId).map((x) => x.posicao))
    const o = porOrdem.get(e.ordemId)!
    out.push({
      etapaId: e.id, ordemId: e.ordemId, posicao: e.posicao, nome: e.nome,
      produto: nomeItem.get(o.itemProduzidoId) ?? '(produto)',
      escalaReceitas: o.escalaReceitas,
      estado: res.estado,
      iniciadoEm: e.iniciadoEm?.toISOString() ?? null,
      minutos: minutosDaEtapa(e, agora, res.estado),
      esperandoEtapaAnterior: anterior && !anterior.finalizadoEm ? anterior.nome : null,
      minha,
      pedidoPraFinalizar: res.pedidoEmAberto,
      ultima: e.posicao === maiorPosicao,
    })
  }
  // em andamento primeiro (é o que está na mão), depois as designadas, depois as soltas
  // ⚠️ quem tem PEDIDO do gerente vem em PRIMEIRO: é a tarefa que alguém está esperando
  const peso = (t: MinhaTarefa) => (t.pedidoPraFinalizar ? -1 : t.estado === 'EM_ANDAMENTO' ? 0 : t.minha ? 1 : 2)
  return out.sort((a, b) => peso(a) - peso(b) || a.posicao - b.posicao)
}

/**
 * INICIAR. Grava o instante e **carimba o executor** — a partir daqui o tempo tem dono.
 *
 * ⚠️ Uma tarefa por pessoa de cada vez: se ele já tem outra correndo, a resposta diz QUAL,
 * em vez de deixar dois cronômetros do mesmo par de mãos rodando (os dois ficariam errados).
 */
export async function iniciarTarefa(
  input: { companyId: string; etapaId: string; colaboradorId: string; agora?: Date },
  db: PrismaClient = defaultPrisma,
): Promise<{ iniciadoEm: string }> {
  const agora = input.agora ?? new Date()
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new TarefaError('Tarefa não encontrada.')
  if (etapa.finalizadoEm) throw new TarefaError('Essa tarefa já foi finalizada.')
  // ⭐⭐ A DUPLA (08/09/2026): "outra pessoa já está nessa tarefa" deixou de ser recusa —
  // uma etapa aceita até DUAS pessoas, cada uma com o relógio dela. O que continua sendo
  // recusado é a MESMA pessoa iniciar duas vezes e a TERCEIRA entrar (teto na gravação).
  const participantes = await participantesDaEtapa(etapa.id, db)
  const meu = participantes.find((p) => p.colaboradorId === input.colaboradorId)
  if (meu?.iniciadoEm) throw new TarefaError('Você já iniciou essa tarefa.')
  // ⚠️ caminho antigo (sem linha de participante): a etapa iniciada por OUTRO ainda tem
  // dono, e quem entra vira o segundo — mas só se ninguém mais tiver entrado.
  if (participantes.length === 0 && etapa.iniciadoEm && etapa.executorId === input.colaboradorId) {
    throw new TarefaError('Você já iniciou essa tarefa.')
  }
  try {
    validarEntrada(participantes, input.colaboradorId)
  } catch (e) {
    throw new TarefaError((e as Error).message)
  }
  // ⛔⛔ ETAPA DESIGNADA ADMITE SÓ OS DESIGNADOS — e o guard da casa me pegou tentando
  // afrouxar isso (08/09). Eu tinha escrito "só recusa quando já há DOIS designados", o que
  // deixaria um terceiro entrar em tarefa designada a UMA pessoa. Não foi o que o dono
  // pediu: *"a etapa aceita ATÉ 2 designados (o GERENTE escolhe os dois)"*.
  //
  // ⭐ A régua fica: **se há designação, ela manda**; se não há, é tarefa solta e vale o
  // "quem pegou, pegou" — até o teto de 2. Querer uma dupla é um gesto do gerente, não uma
  // porta aberta pra quem passar pelo tablet.
  // ⚠️ PLANO É O QUE O GERENTE DESIGNOU — e o que marca isso é o `designadoEm`, não o
  // `colaboradorId`. Este último também é preenchido quando alguém PEGA uma tarefa solta
  // ("a designação nasce do gesto"), e tratar isso como plano trancaria a etapa na primeira
  // pessoa que tocasse — matando a dupla em toda tarefa não designada, que é a maioria.
  const designados = participantes.filter((p) => p.designadoEm).map((p) => p.colaboradorId)
  const plano = designados.length
    ? designados
    : (etapa.designadoEm && etapa.colaboradorId ? [etapa.colaboradorId] : [])
  if (plano.length && !plano.includes(input.colaboradorId)) {
    throw new TarefaError(plano.length > 1
      ? 'Essa tarefa foi designada pra outras pessoas. Fale com o encarregado.'
      : 'Essa tarefa foi designada pra outra pessoa. Fale com o encarregado.')
  }
  // ⛔⛔ A SEQUÊNCIA É DA RECEITA, E QUEM A IMPÕE É O SERVIDOR (06/09/2026).
  //
  // **PROVADO EM PROD:** na ordem do beef de hambúrguer, a etapa 2 ("beef") foi iniciada E
  // finalizada às 15:19 com a etapa 1 ("gessado") ainda **AGUARDANDO**. A tela dizia
  // *"depois de gessado"* e o botão INICIAR funcionava — **a trava era só visual**.
  //
  // ⚠️ É a classe "o menu esconde e a rota nega": esconder o botão não impede a chamada. E
  // aqui o estrago é de DADO — moldar beef antes de existir gessado registra uma produção
  // que não pode ter acontecido, e o tempo dessa etapa entra na média como se fosse real.
  //
  // ⭐ A ordem das etapas É a ordem da receita (`posicao`), então a régua é simples: a
  // anterior tem que estar FINALIZADA. Sem exceção "só desta vez" — quem precisa pular a
  // ordem está fazendo outra coisa, e isso pede outra etapa, não um furo aqui.
  const anterior = etapa.posicao > 0
    ? await db.stockOrdemEtapa.findFirst({
        where: { companyId: input.companyId, ordemId: etapa.ordemId, posicao: etapa.posicao - 1 },
        select: { nome: true, finalizadoEm: true, iniciadoEm: true },
      })
    : null
  if (anterior && !anterior.finalizadoEm) {
    throw new TarefaError(
      anterior.iniciadoEm
        ? `“${anterior.nome}” ainda está em andamento. Essa etapa começa depois que ela terminar.`
        : `“${anterior.nome}” precisa ser feita antes. Essa etapa começa depois que ela terminar.`,
    )
  }
  // ⛔⛔ "UMA POR VEZ" LÊ A DERIVAÇÃO ÚNICA, NUNCA A COLUNA CRUA (08/09/2026).
  //
  // **CASO REAL:** esta trava era um `finalizadoEm: null` cru e **trancou a Carlise fora do
  // tablet** por causa de uma etapa de 06/09 cuja ordem já fora concluída pela Produção
  // (`ENCERRADA_SEM_FINALIZAR`). Ela não tinha nada em aberto e não tinha saída nenhuma: o
  // gesto que resolveria a etapa é do gerente, e ele já o tinha feito.
  //
  // ⚠️ A coluna fica NULL **de propósito** nos dois gestos que fecham etapa sem tempo medido
  // — é o que os mantém fora das médias. Lida crua, ela responde a pergunta errada.
  // ⚠️ E continua bloqueando inclusive a PRÓPRIA etapa: um segundo toque no INICIAR
  // reescreveria o `iniciadoEm` dela e apagaria o tempo já corrido.
  const [jaCorrendo] = await etapasEmAndamentoDoColaborador(input.companyId, input.colaboradorId, db)
  if (jaCorrendo) throw new TarefaError(`Você está com “${jaCorrendo.nome}” em andamento. Finalize antes de começar outra.`)

  // ⭐ o relógio DELE (a camada nova) …
  await registrarInicio({ companyId: input.companyId, etapaId: etapa.id, colaboradorId: input.colaboradorId, agora }, db)
  // … e o carimbo da ETAPA, que continua sendo o do PRIMEIRO toque: é dele que a régua de
  // sequência e os relatórios antigos leem, e sobrescrever com o segundo apagaria o começo.
  await db.stockOrdemEtapa.update({
    where: { id: etapa.id },
    data: {
      iniciadoEm: etapa.iniciadoEm ?? agora,
      executorId: etapa.executorId ?? input.colaboradorId,
      // ⭐ pegou uma tarefa solta → a designação nasce do GESTO. Nada trava por falta de
      // cadastro, e o gestor vê de quem ela é sem ter designado.
      colaboradorId: etapa.colaboradorId ?? input.colaboradorId,
    },
  })
  return { iniciadoEm: agora.toISOString() }
}

/** FINALIZAR. Só quem iniciou finaliza — é a assinatura do tempo. */
export async function finalizarTarefa(
  input: { companyId: string; etapaId: string; colaboradorId: string; agora?: Date },
  db: PrismaClient = defaultPrisma,
): Promise<{ minutos: number }> {
  const agora = input.agora ?? new Date()
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new TarefaError('Tarefa não encontrada.')
  if (!etapa.iniciadoEm) throw new TarefaError('Essa tarefa ainda não foi iniciada.')
  if (etapa.finalizadoEm) throw new TarefaError('Essa tarefa já foi finalizada.')
  // ⭐⭐ com a DUPLA, "quem finaliza é quem iniciou" vale POR PESSOA, não pela etapa
  const participantes = await participantesDaEtapa(etapa.id, db)
  const meu = participantes.find((p) => p.colaboradorId === input.colaboradorId)
  if (participantes.length === 0) {
    if (etapa.executorId !== input.colaboradorId) throw new TarefaError('Quem finaliza é quem iniciou.')
  } else {
    if (!meu?.iniciadoEm) throw new TarefaError('Quem finaliza é quem iniciou.')
    if (meu.finalizadoEm) throw new TarefaError('Você já finalizou essa tarefa.')
  }
  // ⛔⛔ TERMINAR ANTES DE COMEÇAR. O CHECK do banco cobre isso em produção, mas o dev roda
  // SQLite (sem CHECK) e o caller pode passar um instante — então a trava vale nos DOIS.
  // ⚠️ Sem ela o `minutosDaEtapa` devolveria 0 (ele clampa em zero) e a tarefa entraria na
  // média como se tivesse levado nenhum tempo: dado errado com cara de dado bom.
  if (agora < etapa.iniciadoEm) {
    throw new TarefaError('O fim não pode ser antes do início. Confira o relógio do aparelho.')
  }

  // ⭐ o relógio DELE fecha …
  const { etapaFechou } = await registrarFim(
    { companyId: input.companyId, etapaId: etapa.id, colaboradorId: input.colaboradorId, agora }, db)

  // ⛔⛔ … e a ETAPA só fecha quando TODOS QUE INICIARAM finalizarem (decisão 2 do dono).
  // É este carimbo que a regra de sequência lê — então a etapa 2 libera com a 1 INTEIRA,
  // sem uma linha de mudança na régua de sequência. *"A dependência é física: o moldar
  // precisa do gessado PRONTO."*
  if (etapaFechou) {
    await db.stockOrdemEtapa.update({ where: { id: etapa.id }, data: { finalizadoEm: agora } })
    // ⭐ se o gerente tinha PEDIDO pra finalizar, o pedido foi ATENDIDO — e o tempo é DELA,
    // medido de verdade. É o desfecho que o gesto 1 existe pra produzir.
    await marcarPedidoAtendido(input.companyId, etapa.id, db)
  }
  const inicioDele = meu?.iniciadoEm ?? etapa.iniciadoEm
  return { minutos: minutosDaEtapa({ iniciadoEm: inicioDele, finalizadoEm: agora }, agora, 'FEITA')! }
}

/**
 * DEVOLVER ("não é meu turno"): quem começou por engano solta a tarefa **sem gravar tempo**.
 *
 * ⛔ Isto NÃO é finalizar com duração zero — seria um lote de 0 minuto entrando na média.
 * A tarefa volta ao estado de antes, como se o toque não tivesse acontecido, e a designação
 * some junto se ela tinha nascido do próprio gesto.
 */
export async function devolverTarefa(
  input: { companyId: string; etapaId: string; colaboradorId: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new TarefaError('Tarefa não encontrada.')
  if (etapa.finalizadoEm) throw new TarefaError('Tarefa já finalizada não se devolve — fale com o encarregado.')
  if (etapa.executorId !== input.colaboradorId) throw new TarefaError('Só quem iniciou pode devolver.')
  await db.stockOrdemEtapa.update({
    where: { id: etapa.id },
    data: {
      iniciadoEm: null,
      executorId: null,
      // ⚠️ só solta a designação se ela nasceu do gesto (não havia designadoEm da gerência)
      colaboradorId: etapa.designadoEm ? etapa.colaboradorId : null,
    },
  })
  // ⭐ e o relógio DELE some junto — devolver não grava tempo nenhum, nem na camada nova
  await desfazerInicio(etapa.id, input.colaboradorId, db)
}

export interface TarefaAberta {
  etapaId: string
  ordemId: string
  nome: string
  quem: string | null
  desde: string
  horas: number
}

/**
 * ⚠️ AS TAREFAS ABERTAS HÁ MAIS DE 4H — o alarme do gestor (decisão do dono).
 *
 * Mais apertado que as 24h do P2 (ordem parada) **de propósito**: ordem parada é trabalho
 * que não andou; tarefa aberta **corrompe a média**, porque o cronômetro segue depois que a
 * pessoa foi embora. ⛔ E ela **nunca fecha sozinha**.
 */
export async function tarefasAbertasDemais(
  companyId: string, agora: Date = new Date(), db: Db = defaultPrisma,
): Promise<TarefaAberta[]> {
  const limite = new Date(agora.getTime() - HORAS_ATE_ALARME * 3_600_000)
  // ⛔⛔ ORDEM ENCERRADA NÃO GERA ALARME (cancelada OU concluída).
  //
  // **CANCELADA:** cobrar "tarefa aberta há 6h" de uma ordem que o dono já cancelou é alarme
  // falso, e alarme falso repetido mata o alarme (a lição dos 111 do juiz de vendas).
  //
  // **CONCLUÍDA — e esta é a ponta solta que o fluxo novo criou:** quando sobra material, a
  // tela do tablet manda a cozinha NÃO finalizar e chamar o encarregado. Ele conclui pela
  // tela de Produção ajustando o consumo — e `concluir()` **não toca nas etapas** (de
  // propósito: fechar a etapa ali inventaria um horário de fim que ninguém mediu). Resultado:
  // a última etapa fica aberta pra sempre e viraria um alarme permanente por algo que não
  // tem ação nenhuma.
  //
  // ⚠️ A etapa CONTINUA aberta no banco e à vista na tela da ordem — o rastro é honesto
  // ("ninguém apertou finalizar"). O que sai é a COBRANÇA, porque não há o que cobrar.
  // ⛔⛔ E A FINALIZADA PELO GERENTE TAMBÉM NÃO COBRA (07/09) — o `finalizadoEm` dela é NULL
  // de propósito, então sem esta linha ela cairia direto no alarme e ficaria gritando pra
  // sempre sobre uma tarefa que o gerente JÁ resolveu. Alarme falso repetido mata o alarme.
  // ⚠️ Achado por um teste que esperava o alarme calar depois do gesto e viu ele morder.
  //
  // ⭐⭐ AS DUAS EXCEÇÕES ACIMA ERAM UMA **SEGUNDA DERIVAÇÃO** (08/09): este bloco remontava
  // à mão, com dois `notIn`, exatamente os degraus 1 e 3 de `derivarEstadoDaEtapa`. Concordava
  // com ela por coincidência, e no dia em que nascesse um sexto jeito de fechar etapa sem
  // carimbo o alarme voltaria a gritar sozinho. Agora pergunta pra quem sabe. **É a mesma
  // correção que destravou o tablet da Carlise, aplicada ao leitor vizinho.**
  const candidatas = await db.stockOrdemEtapa.findMany({
    where: { companyId, finalizadoEm: null, iniciadoEm: { not: null, lte: limite } },
    orderBy: { iniciadoEm: 'asc' },
  })
  const rows = await somenteEmAndamento(companyId, candidatas, db)
  if (!rows.length) return []
  const ids = [...new Set(rows.map((r) => r.executorId).filter((x): x is string => !!x))]
  const colabs = ids.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, nome: true } }) : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  return rows.map((r) => ({
    etapaId: r.id, ordemId: r.ordemId, nome: r.nome,
    quem: r.executorId ? nome.get(r.executorId) ?? null : null,
    desde: r.iniciadoEm!.toISOString(),
    horas: Math.floor((agora.getTime() - r.iniciadoEm!.getTime()) / 3_600_000),
  }))
}
