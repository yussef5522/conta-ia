// ⭐⭐ "HOJE" AO VIVO — O DIA DA COZINHA NUM OLHAR (06/09/2026).
//
// **A pergunta que a tela responde:** *"o que está acontecendo na cozinha agora?"* Hoje, pra
// saber, o gestor abre ordem por ordem. Os eventos já existem (`iniciadoEm`/`finalizadoEm` por
// PIN, as conclusões, as designações) — **só não existe um lugar que os leia juntos, na ordem
// do relógio**.
//
// ⛔⛔ **ZERO EVENTO NOVO.** Esta lib só LÊ. Nenhuma tabela nova, nenhuma coluna, nenhuma
// gravação — se ela precisasse gravar pra funcionar, seria uma segunda verdade sobre o mesmo
// dia, e a primeira divergência apareceria num relatório que ninguém confere.
//
// ⛔ **O CRONÔMETRO É DA TELA, O INSTANTE É DO SERVIDOR.** Aqui sai `iniciadoEm`; quem conta os
// segundos é o navegador. Buscar o servidor de segundo em segundo custaria uma requisição por
// pessoa por segundo pra mostrar um número que a subtração já dá. ⚠️ E por isso a linha carrega
// TAMBÉM o horário de início: o relógio do aparelho pode estar torto, e a hora absoluta é o que
// permite conferir.
//
// ⛔⛔ **NENHUM VERMELHO DE ATRASO** (decisão do dono). Não existe hora prometida por tarefa —
// inventar atraso a partir da designação criaria uma cobrança que ninguém combinou. O único
// alarme é o das 4h em aberto, que já existe e tem causa real (cronômetro correndo corrompe a
// média). "Na fila" é cinza, neutro.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'
import { HORAS_ATE_ALARME } from './etapas'
import { resolverEstadoDasEtapas } from './gestos-do-gerente'
import { rotuloDoEstado, trabalhoConcluido, type EstadoDaEtapa } from './estado-da-etapa'

type Db = PrismaClient | Prisma.TransactionClient

// ⭐⭐ O ESTADO VEM DO RESOLVEDOR ÚNICO (07/09) — os MESMOS 5 estados da tela da ordem.
//
// ⛔⛔ Antes esta lib derivava o dela INLINE (FAZENDO/NA_FILA/AGUARDA_ANTERIOR/FEITA), e por
// isso a tela se contradizia: "na fila" sobrevivia numa ordem já concluída. Duas respostas
// pra mesma pergunta, calculadas em pontos diferentes — a lição do B1.
//
// ⚠️ "AGUARDA_ANTERIOR" deixou de ser ESTADO e virou DETALHE do aguardando (`esperando`
// carrega o nome da etapa que falta): não é um estado diferente da fila, é a mesma fila com
// um motivo — e como estado ele obrigava toda tela a conhecer um sexto caso.

export interface TarefaDoDia {
  etapaId: string
  ordemId: string
  nome: string
  /** o produto da ordem — o subtítulo da linha */
  produto: string
  posicao: number
  /** ⭐ é a última etapa da ordem? (o HOJE conclui ali mesmo quando é) */
  ehUltima: boolean
  /**
   * ⭐ quem está designado NESTA etapa (0, 1 ou 2) — o redesignar do HOJE precisa da
   * verdade da ETAPA, não do dono do card. Sem isto, remanejar pelo HOJE apagaria a
   * segunda pessoa sem ninguém pedir.
   */
  designados: string[]
  estado: EstadoDaEtapa
  /** o instante que o toque gravou; a tela conta os segundos a partir dele */
  iniciadoEm: Date | null
  finalizadoEm: Date | null
  /** minutos fechados — só existe em tarefa FEITA */
  minutos: number | null
  /** ⚠️ só em AGUARDA_ANTERIOR: "depois do gessado" — é sequência da receita, não fila */
  esperando: string | null
  /** ⭐ o rótulo pronto — a MESMA frase da tela da ordem e do tablet */
  rotulo: string
  /** ⭐ o gerente pediu pra ela finalizar — o recado está no tablet */
  pedidoEmAberto: boolean
  /** ⚠️ só quando a tarefa FECHOU o lote: o que saiu, com custo */
  loteFechado: { qtdGerada: number; custoUnitario: number | null; unidade: string } | null
  /** passou do alarme de 4h com o cronômetro correndo */
  abertaDemais: boolean
}

export interface PessoaDoDia {
  colaboradorId: string
  nome: string
  fazendo: number
  naFila: number
  feitas: number
  /** ⛔ a ordem acabou e levou a etapa aberta junto — sem tempo medido */
  encerradas: number
  tarefas: TarefaDoDia[]
}

export type TipoDeEvento = 'INICIOU' | 'FINALIZOU' | 'DESIGNOU'

export interface EventoDoDia {
  quando: Date
  tipo: TipoDeEvento
  quem: string
  /** a tarefa (ou, no DESIGNOU agregado, a contagem já embutida no texto) */
  texto: string
  minutos: number | null
  loteFechado: TarefaDoDia['loteFechado']
  ordemId: string | null
  /** ⭐ o rótulo do estado FINAL daquela tarefa — a linha do tempo diz o que aconteceu com
   *  ela ("ficou aberta — a ordem foi concluída pela Produção"), nunca só "iniciou" e ponto */
  rotulo: string | null
}

export interface DiaAoVivo {
  dia: string
  /** quem está com a mão na massa AGORA — vazio em dia passado, por construção */
  agora: { colaboradorId: string; nome: string; tarefa: TarefaDoDia }[]
  pessoas: PessoaDoDia[]
  /** mais recente em cima — o diário do dia */
  linhaDoTempo: EventoDoDia[]
  /** quantas das tarefas em AGORA passaram do alarme */
  abertasDemais: number
  /** ⚠️ dia passado não tem "agora"; a tela some com o bloco em vez de mostrá-lo vazio */
  ehHoje: boolean
}

const minutosEntre = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))

/**
 * ⭐⭐ O DIA INTEIRO, NUMA LEITURA SÓ.
 *
 * `dia` é dia de calendário de São Paulo ('YYYY-MM-DD') — a mesma função que consertou o painel
 * às 21h. ⚠️ **`agora` é PARÂMETRO, nunca `new Date()` aqui dentro**: o relógio serve pra exibir,
 * nunca pra decidir, e um teste que não controla o instante não consegue provar o cronômetro.
 */
export async function diaAoVivo(
  input: { companyId: string; dia: string; agora: Date },
  db: Db = defaultPrisma,
): Promise<DiaAoVivo> {
  const janela = janelaDoDiaSP(input.dia, input.dia)
  const ehHoje = input.agora >= janela.de && input.agora <= janela.ate

  // ⛔ ORDEM CANCELADA FICA DE FORA dos três blocos — a mesma régua do relatório por pessoa:
  // trabalho em ordem que não produziu não conta pra ninguém. Mostrar aqui e esconder lá faria
  // as duas telas discordarem sobre o mesmo dia.
  const canceladas = await db.stockProductionOrder.findMany({
    where: { companyId: input.companyId, estado: 'CANCELADA' }, select: { id: true },
  })
  const fora = canceladas.map((o) => o.id)
  const semCanceladas = fora.length ? { ordemId: { notIn: fora } } : {}

  // ⛔⛔ A FILA VEM DA `dataProducao` DA ORDEM, NÃO DE `designadoEm` — e essa distinção é um
  // bug que o teste pegou antes de ir pra tela. O gestor designa na SEXTA as tarefas do
  // SÁBADO; filtrar pelo carimbo da designação deixaria a manhã de sábado **vazia**,
  // justamente na hora em que a tela mais serve. O que diz de que dia é o trabalho é a ordem.
  const doDia = await db.stockProductionOrder.findMany({
    where: {
      companyId: input.companyId, estado: { not: 'CANCELADA' },
      dataProducao: { gte: janela.de, lte: janela.ate },
    },
    select: { id: true },
  })

  // ⛔⛔ ORDEM VIVA — o filtro que o AGORA passou a exigir (06/09). É o MESMO recorte que o
  // alarme de 4h já tinha: ordem encerrada sai do retrato do presente, porque não há presente
  // nela. Vive aqui como conjunto pra a decisão ser UMA (o carry-over de ontem e o AGORA
  // consultam a mesma lista — duas consultas divergiriam no primeiro caso de borda).
  const vivas = new Set((await db.stockProductionOrder.findMany({
    where: { companyId: input.companyId, estado: { notIn: ['CONCLUIDA', 'CANCELADA'] } },
    select: { id: true },
  })).map((o) => o.id))

  // ⚠️ e uma etapa também entra pelo que ACONTECEU nela — a ordem pode ser de ontem e o toque
  // ser de hoje (produção que virou o dia).
  const etapas = await db.stockOrdemEtapa.findMany({
    where: {
      companyId: input.companyId,
      ...semCanceladas,
      OR: [
        { ordemId: { in: doDia.map((o) => o.id) } },
        { iniciadoEm: { gte: janela.de, lte: janela.ate } },
        { finalizadoEm: { gte: janela.de, lte: janela.ate } },
        // ⚠️ tarefa iniciada ONTEM e ainda aberta continua sendo "o que acontece agora" —
        // e é exatamente o caso que o alarme de 4h existe pra pegar. ⛔ Mas SÓ de ordem VIVA:
        // era por aqui que a etapa da Carlise (ordem já concluída) entrava no dia de hoje.
        ...(ehHoje ? [{ ordemId: { in: [...vivas] }, iniciadoEm: { lt: janela.de }, finalizadoEm: null }] : []),
      ],
    },
    orderBy: [{ ordemId: 'asc' }, { posicao: 'asc' }],
  })

  const ordemIds = [...new Set(etapas.map((e) => e.ordemId))]
  const [ordens, conclusoes, colaboradores] = await Promise.all([
    ordemIds.length
      ? db.stockProductionOrder.findMany({ where: { companyId: input.companyId, id: { in: ordemIds } }, select: { id: true, itemProduzidoId: true } })
      : Promise.resolve([]),
    ordemIds.length
      ? db.stockProducaoConclusao.findMany({
          where: { companyId: input.companyId, ordemId: { in: ordemIds } },
          select: { ordemId: true, qtdGerada: true, custoUnitarioReal: true, criadoEm: true },
        })
      : Promise.resolve([]),
    // ⭐ TODA pessoa ativa, não só quem tem tarefa: *"quem não tem nada hoje aparece — e é isso
    // que a tela tem de útil de manhã"*. Some da lista quem está INATIVO, não quem está livre.
    db.stockColaborador.findMany({ where: { companyId: input.companyId, ativo: true }, select: { id: true, nome: true } }),
  ])
  const itens = ordens.length
    ? await db.stockItem.findMany({
        where: { companyId: input.companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
        select: { id: true, nome: true, unidadeControle: true },
      })
    : []
  const itemDaOrdem = new Map(ordens.map((o) => [o.id, itens.find((i) => i.id === o.itemProduzidoId)]))

  // ⭐ O LOTE PENDURA NO TOQUE QUE O GEROU: cada conclusão vai pra a etapa finalizada mais
  // recente ANTES dela. ⚠️ Não é "a última etapa da ordem" — com produção PARCIAL a mesma
  // ordem tem várias conclusões, e todas cairiam na mesma linha, somadas, mentindo sobre o
  // que saiu naquele momento.
  const loteDaEtapa = new Map<string, { qtdGerada: number; custoUnitario: number | null }>()
  for (const c of conclusoes) {
    const candidatas = etapas
      .filter((e) => e.ordemId === c.ordemId && e.finalizadoEm && e.finalizadoEm <= c.criadoEm)
      .sort((a, b) => b.finalizadoEm!.getTime() - a.finalizadoEm!.getTime())
    const dona = candidatas[0]
    if (!dona) continue // a etapa que fechou não é deste dia — o lote aparece no dia dela
    const a = loteDaEtapa.get(dona.id)
    loteDaEtapa.set(dona.id, {
      qtdGerada: Math.round(((a?.qtdGerada ?? 0) + c.qtdGerada) * 100) / 100,
      custoUnitario: c.custoUnitarioReal ?? a?.custoUnitario ?? null,
    })
  }

  // ⭐⭐ FONTE ÚNICA: o mesmo resolvedor da tela da ordem e do tablet
  const resolvidas = await resolverEstadoDasEtapas(input.companyId, etapas, db)

  // ⭐ os designados de cada etapa (a dupla) — o redesignar do HOJE lê daqui
  const partes = await db.stockOrdemEtapaParticipante.findMany({
    where: { etapaId: { in: etapas.map((e) => e.id) } },
    select: { etapaId: true, colaboradorId: true },
    orderBy: { criadoEm: 'asc' },
  })
  const designadosDaEtapa = new Map<string, string[]>()
  for (const p of partes) designadosDaEtapa.set(p.etapaId, [...(designadosDaEtapa.get(p.etapaId) ?? []), p.colaboradorId])

  const nomeDaEtapaAnterior = (ordemId: string, posicao: number) =>
    etapas.find((x) => x.ordemId === ordemId && x.posicao === posicao - 1) ?? null

  /**
   * ⭐ É A ÚLTIMA ETAPA DA ORDEM? (08/09) — o HOJE precisa saber pra, ao finalizar pelo
   * gerente, perguntar "quantos saíram?" ali mesmo e concluir pelo MESMO motor.
   *
   * ⚠️ Sai daqui, do servidor, junto do resto da tarefa: deixar a tela deduzir "é a última"
   * seria uma segunda derivação da estrutura da ordem — e ela erraria no dia em que a
   * receita ganhasse uma etapa.
   */
  const ehUltimaEtapa = (ordemId: string, posicao: number) =>
    !etapas.some((x) => x.ordemId === ordemId && x.posicao > posicao)

  const limiteDoAlarme = input.agora.getTime() - HORAS_ATE_ALARME * 3_600_000

  const tarefas: (TarefaDoDia & { colaboradorId: string | null })[] = etapas.map((e) => {
    const item = itemDaOrdem.get(e.ordemId)
    const anterior = nomeDaEtapaAnterior(e.ordemId, e.posicao)
    const res = resolvidas.get(e.id)!
    // ⚠️ "aguarda a anterior" NÃO é atraso nem estado próprio: é a MESMA fila com um motivo,
    // e a linha diz o nome da etapa que falta em vez de um estado mudo.
    const esperando = res.estado === 'AGUARDANDO' && anterior && !anterior.finalizadoEm ? anterior.nome : null
    const conc = loteDaEtapa.get(e.id) ?? null
    return {
      etapaId: e.id,
      ordemId: e.ordemId,
      nome: e.nome,
      produto: item?.nome ?? '',
      posicao: e.posicao,
      ehUltima: ehUltimaEtapa(e.ordemId, e.posicao),
      designados: designadosDaEtapa.get(e.id) ?? (e.colaboradorId ? [e.colaboradorId] : []),
      estado: res.estado,
      iniciadoEm: e.iniciadoEm,
      finalizadoEm: e.finalizadoEm,
      // ⛔ só FEITA tem tempo medido — nos outros a tela diz "a apurar"
      minutos: res.estado === 'FEITA' && e.iniciadoEm && e.finalizadoEm ? minutosEntre(e.iniciadoEm, e.finalizadoEm) : null,
      esperando,
      // ⭐ O RÓTULO É O MESMO DAS OUTRAS DUAS TELAS — sai da fonte única
      rotulo: rotuloDoEstado(res.estado, {
        iniciou: !!e.iniciadoEm, ordemCancelada: res.ordemCancelada,
        gerente: res.finalizadaPorNome, pessoa: res.emNomeDeNome,
      }),
      loteFechado: conc ? { ...conc, unidade: item?.unidadeControle ?? '' } : null,
      abertaDemais: res.estado === 'EM_ANDAMENTO' && !!e.iniciadoEm && e.iniciadoEm.getTime() < limiteDoAlarme,
      pedidoEmAberto: res.pedidoEmAberto,
      // ⚠️ quem responde pela tarefa é o EXECUTOR (o PIN que tocou); só antes de iniciar vale a
      // designação. Usar sempre o designado atribuiria a tarefa a quem não a fez.
      colaboradorId: e.executorId ?? e.colaboradorId,
    }
  })

  // ── AGORA ────────────────────────────────────────────────────────────────────────────
  const nomeDe = new Map(colaboradores.map((c) => [c.id, c.nome]))
  const agora = ehHoje
    ? tarefas.filter((t) => t.estado === 'EM_ANDAMENTO').map((t) => ({
        colaboradorId: t.colaboradorId ?? '',
        nome: t.colaboradorId ? (nomeDe.get(t.colaboradorId) ?? '(sem nome)') : '(sem nome)',
        tarefa: t,
      })).sort((a, b) => (a.tarefa.iniciadoEm?.getTime() ?? 0) - (b.tarefa.iniciadoEm?.getTime() ?? 0))
    : [] // ⛔ não existe "agora" no passado

  // ── o dia de cada uma ────────────────────────────────────────────────────────────────
  const pessoas: PessoaDoDia[] = colaboradores.map((c) => {
    const minhas = tarefas.filter((t) => t.colaboradorId === c.id)
    return {
      colaboradorId: c.id,
      nome: c.nome,
      fazendo: minhas.filter((t) => t.estado === 'EM_ANDAMENTO').length,
      // ⚠️ "na fila" soma quem espera a anterior — as duas são trabalho não começado, e separar
      // na contagem faria o cabeçalho não fechar com a lista embaixo dele.
      naFila: minhas.filter((t) => t.estado === 'AGUARDANDO').length,
      // ⚠️ FINALIZADA_PELO_GERENTE conta como FEITA: *"a pessoa fica com a tarefa feita no
      // dia dela, sem tempo"* (dono). O que a distingue é o RÓTULO da linha, não a contagem —
      // tirá-la daqui faria o cabeçalho não fechar com a lista.
      feitas: minhas.filter((t) => trabalhoConcluido(t.estado)).length,
      // ⚠️ CONTADA À PARTE, e nunca dentro de "feitas": ninguém apertou finalizar. Deixá-la
      // fora de toda contagem faria o cabeçalho não fechar com a lista logo abaixo dele —
      // uma linha visível que o resumo não conta é a mesma doença do card `PRONTOS −72`.
      encerradas: minhas.filter((t) => t.estado === 'ENCERRADA_SEM_FINALIZAR').length,
      tarefas: minhas.sort((a, b) => ORDEM_NA_LISTA[a.estado] - ORDEM_NA_LISTA[b.estado]
        || (b.finalizadoEm?.getTime() ?? 0) - (a.finalizadoEm?.getTime() ?? 0)
        || a.posicao - b.posicao),
    }
  }).sort((a, b) => (b.fazendo - a.fazendo) || (b.feitas + b.naFila) - (a.feitas + a.naFila) || a.nome.localeCompare(b.nome, 'pt-BR'))

  // ── linha do tempo ───────────────────────────────────────────────────────────────────
  const eventos: EventoDoDia[] = []
  const dentroDoDia = (d: Date | null): d is Date => !!d && d >= janela.de && d <= janela.ate
  for (const t of tarefas) {
    const quem = t.colaboradorId ? (nomeDe.get(t.colaboradorId) ?? '(sem nome)') : '(sem nome)'
    const texto = t.produto ? `${t.nome} — ${t.produto}` : t.nome
    if (dentroDoDia(t.iniciadoEm)) {
      // ⚠️ o INICIOU FICA: ela começou de verdade, e apagar seria esconder trabalho. O que
      // muda é o rótulo ao lado — "ficou aberta; a ordem foi concluída pela Produção".
      eventos.push({ quando: t.iniciadoEm, tipo: 'INICIOU', quem, texto, minutos: null, loteFechado: null, ordemId: t.ordemId, rotulo: t.estado === 'EM_ANDAMENTO' || t.estado === 'FEITA' ? null : t.rotulo })
    }
    if (dentroDoDia(t.finalizadoEm)) {
      eventos.push({ quando: t.finalizadoEm, tipo: 'FINALIZOU', quem, texto, minutos: t.minutos, loteFechado: t.loteFechado, ordemId: t.ordemId, rotulo: null })
    }
  }
  // ⚠️ DESIGNAR entra AGREGADO ("você designou 4 tarefas"): designação é preparo, e uma linha
  // por tarefa afogaria o que aconteceu de verdade.
  const designadas = etapas.filter((e) => e.designadoEm && e.designadoEm >= janela.de && e.designadoEm <= janela.ate)
  if (designadas.length) {
    const ultima = designadas.reduce((a, b) => (a.designadoEm! > b.designadoEm! ? a : b))
    eventos.push({
      quando: ultima.designadoEm!, tipo: 'DESIGNOU', quem: '',
      texto: `${designadas.length} tarefa${designadas.length === 1 ? '' : 's'} designada${designadas.length === 1 ? '' : 's'}`,
      minutos: null, loteFechado: null, ordemId: null, rotulo: null,
    })
  }
  eventos.sort((a, b) => b.quando.getTime() - a.quando.getTime())

  return {
    dia: input.dia,
    agora,
    pessoas,
    linhaDoTempo: eventos,
    abertasDemais: agora.filter((a) => a.tarefa.abertaDemais).length,
    ehHoje,
  }
}

/** fazendo primeiro (é o urgente), fila no meio, feitas por último */
const ORDEM_NA_LISTA: Record<EstadoDaEtapa, number> = {
  EM_ANDAMENTO: 0, AGUARDANDO: 1, FEITA: 2, FINALIZADA_PELO_GERENTE: 3, ENCERRADA_SEM_FINALIZAR: 4,
}
