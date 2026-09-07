// ⭐⭐ OS DOIS GESTOS DO GERENTE + O RESOLVEDOR ÚNICO DE ESTADO (07/09/2026).
//
// **A ordem do dono:** *"gerente NUNCA fica preso olhando uma etapa aberta sem poder agir."*
//
// São dois gestos, e a diferença entre eles é a QUALIDADE DO DADO:
//   1. **PEDIR PRA FINALIZAR** — o preferido. Um recado no tablet; ela aperta com o PIN dela e
//      o tempo é DELA, **medido de verdade**, e entra na média.
//   2. **FINALIZAR PELO GERENTE** — quando ela foi embora. ⛔ Tempo = **A APURAR**: o gerente
//      não sabe quando ela parou, e tempo não se inventa.
//
// ⛔⛔ **E O `finalizadoEm` DA ETAPA CONTINUA NULL no gesto 2** — REGRA 5, e é a decisão mais
// importante deste arquivo. Se o gesto carimbasse a coluna, o tempo entraria em TODA média
// **por construção** (o relatório calcula `fim − início`), e nenhuma lista de exceções
// seguraria isso pra sempre. Com a coluna nula, o erro é impossível, não improvável.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { derivarEstadoDaEtapa, type EstadoDaEtapa } from './estado-da-etapa'

type Db = PrismaClient | Prisma.TransactionClient

export class GestoError extends Error {}

/** o que uma tela precisa saber sobre a etapa, já derivado */
export interface EtapaResolvida {
  estado: EstadoDaEtapa
  /** quem apertou o FINALIZAR pelo gerente (nome do usuário), quando foi o caso */
  finalizadaPorNome: string | null
  /** o colaborador em nome de quem o gerente finalizou */
  emNomeDeNome: string | null
  /** há um pedido de finalização em aberto pra esta etapa */
  pedidoEmAberto: boolean
  pedidoEm: Date | null
  /** motivo do encerramento pela ordem, quando houve registro */
  encerradaPor: 'ORDEM_CONCLUIDA' | 'ORDEM_CANCELADA' | null
  ordemViva: boolean
  ordemCancelada: boolean
}

/**
 * ⭐⭐ O RESOLVEDOR ÚNICO — carrega os fatos e devolve o estado de cada etapa.
 *
 * ⚠️ **É a lição do B1 aplicada à etapa:** antes existiam DUAS derivações (a tela da ordem e o
 * "HOJE ao vivo" calculavam cada uma a sua), e foi por isso que "na fila" sobreviveu numa
 * ordem já concluída. Agora as três telas chamam ESTA função; se ela mudar, mudam as três.
 */
export async function resolverEstadoDasEtapas(
  companyId: string,
  etapas: { id: string; ordemId: string; iniciadoEm: Date | null; finalizadoEm: Date | null }[],
  db: Db = defaultPrisma,
): Promise<Map<string, EtapaResolvida>> {
  const out = new Map<string, EtapaResolvida>()
  if (!etapas.length) return out
  const ids = etapas.map((e) => e.id)
  const ordemIds = [...new Set(etapas.map((e) => e.ordemId))]

  const [ordens, encerradas, gerentes, pedidos] = await Promise.all([
    db.stockProductionOrder.findMany({ where: { companyId, id: { in: ordemIds } }, select: { id: true, estado: true } }),
    db.stockEtapaEncerrada.findMany({ where: { companyId, etapaId: { in: ids } }, select: { etapaId: true, motivo: true } }),
    db.stockEtapaFinalizadaGerente.findMany({ where: { companyId, etapaId: { in: ids } }, select: { etapaId: true, finalizadaPorId: true, emNomeDeId: true } }),
    db.stockEtapaPedidoFinalizar.findMany({ where: { companyId, etapaId: { in: ids }, atendidoEm: null }, select: { etapaId: true, pedidoEm: true } }),
  ])

  const estadoOrdem = new Map(ordens.map((o) => [o.id, o.estado]))
  const encMap = new Map(encerradas.map((e) => [e.etapaId, e.motivo as 'ORDEM_CONCLUIDA' | 'ORDEM_CANCELADA']))
  const gerMap = new Map(gerentes.map((g) => [g.etapaId, g]))
  const pedMap = new Map(pedidos.map((p) => [p.etapaId, p.pedidoEm]))

  // os nomes: usuário que apertou, colaborador em nome de quem
  const userIds = [...new Set(gerentes.map((g) => g.finalizadaPorId).filter((x): x is string => !!x))]
  const colabIds = [...new Set(gerentes.map((g) => g.emNomeDeId).filter((x): x is string => !!x))]
  const [users, colabs] = await Promise.all([
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    colabIds.length ? db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } }) : Promise.resolve([]),
  ])
  const nomeUser = new Map(users.map((u) => [u.id, (u.name || u.email || '').trim() || null]))
  const nomeColab = new Map(colabs.map((c) => [c.id, c.nome]))

  for (const e of etapas) {
    const est = estadoOrdem.get(e.ordemId)
    const ordemViva = est !== 'CONCLUIDA' && est !== 'CANCELADA'
    const ger = gerMap.get(e.id)
    out.set(e.id, {
      estado: derivarEstadoDaEtapa({
        iniciadoEm: e.iniciadoEm, finalizadoEm: e.finalizadoEm,
        finalizadaPeloGerente: !!ger, ordemViva,
      }),
      finalizadaPorNome: ger?.finalizadaPorId ? nomeUser.get(ger.finalizadaPorId) ?? null : null,
      emNomeDeNome: ger?.emNomeDeId ? nomeColab.get(ger.emNomeDeId) ?? null : null,
      pedidoEmAberto: pedMap.has(e.id),
      pedidoEm: pedMap.get(e.id) ?? null,
      encerradaPor: encMap.get(e.id) ?? null,
      ordemViva,
      ordemCancelada: est === 'CANCELADA',
    })
  }
  return out
}

// ── gesto 1: PEDIR PRA FINALIZAR ────────────────────────────────────────────────────────

/**
 * ⭐ O CAMINHO PREFERIDO — o recado vai pro tablet e **ela** aperta.
 *
 * ⚠️ Só faz sentido em etapa EM ANDAMENTO: pedir pra finalizar o que já está finalizado, o
 * que nunca começou ou o que a ordem já levou seria um recado que a pessoa não tem como
 * atender — e recado impossível de atender é o que ensina a ignorar recado.
 */
export async function pedirPraFinalizar(
  input: { companyId: string; etapaId: string; userId?: string | null },
  db: Db = defaultPrisma,
): Promise<{ pedidoEm: Date }> {
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new GestoError('Etapa não encontrada.')
  const r = (await resolverEstadoDasEtapas(input.companyId, [etapa], db)).get(etapa.id)!
  if (r.estado !== 'EM_ANDAMENTO') {
    throw new GestoError(r.estado === 'AGUARDANDO'
      ? 'Essa tarefa ainda não foi iniciada — não há o que finalizar.'
      : 'Essa tarefa já foi encerrada.')
  }
  // ⚠️ UPSERT: pedir de novo é REENVIAR (atualiza a data), nunca empilhar recados — o tablet
  // mostraria o mesmo aviso três vezes e a pessoa aprenderia a passar por cima.
  const pedidoEm = new Date()
  await db.stockEtapaPedidoFinalizar.upsert({
    where: { etapaId: input.etapaId },
    create: { companyId: input.companyId, etapaId: input.etapaId, ordemId: etapa.ordemId, pedidoPorId: input.userId ?? null, pedidoEm },
    update: { pedidoEm, pedidoPorId: input.userId ?? null, atendidoEm: null },
  })
  return { pedidoEm }
}

/** ⭐ o pedido foi atendido — chamado de dentro do `finalizarTarefa` (o PIN dela) */
export async function marcarPedidoAtendido(companyId: string, etapaId: string, db: Db = defaultPrisma): Promise<void> {
  // ⚠️ `updateMany` e não `update`: a esmagadora maioria das finalizações não tem pedido
  // nenhum, e um `update` sem linha lançaria erro no caminho MAIS comum da cozinha.
  await db.stockEtapaPedidoFinalizar.updateMany({
    where: { companyId, etapaId, atendidoEm: null }, data: { atendidoEm: new Date() },
  })
}

// ── gesto 2: FINALIZAR PELO GERENTE ─────────────────────────────────────────────────────

/**
 * ⛔⛔ A SAÍDA DE QUANDO ELA NÃO ESTÁ MAIS LÁ — sem inventar tempo.
 *
 * O registro diz a verdade: *finalizada por [gerente] em nome de [pessoa]*, com o horário do
 * **gesto do gerente**. ⛔ E o `finalizadoEm` da etapa **não é carimbado**: é isso que mantém
 * o tempo fora de toda média por construção, em vez de depender de um filtro que alguém
 * esquece de copiar pra a próxima tela.
 */
export async function finalizarPeloGerente(
  input: { companyId: string; etapaId: string; userId?: string | null; observacao?: string | null },
  db: Db = defaultPrisma,
): Promise<{ emNomeDeId: string | null }> {
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new GestoError('Etapa não encontrada.')
  const r = (await resolverEstadoDasEtapas(input.companyId, [etapa], db)).get(etapa.id)!
  if (r.estado !== 'EM_ANDAMENTO') {
    throw new GestoError(r.estado === 'AGUARDANDO'
      ? 'Essa tarefa ainda não foi iniciada — não há o que finalizar.'
      : 'Essa tarefa já foi encerrada.')
  }
  // ⚠️ "em nome de" é o EXECUTOR (quem apertou INICIAR), não o designado: quem estava com a
  // mão na massa é quem o gerente está substituindo.
  const emNomeDeId = etapa.executorId
  await db.stockEtapaFinalizadaGerente.create({
    data: {
      companyId: input.companyId, etapaId: input.etapaId, ordemId: etapa.ordemId,
      finalizadaPorId: input.userId ?? null, emNomeDeId,
      observacao: input.observacao?.trim() || null,
    },
  })
  // o pedido que porventura existia deixa de fazer sentido — some do tablet dela
  await db.stockEtapaPedidoFinalizar.updateMany({
    where: { companyId: input.companyId, etapaId: input.etapaId, atendidoEm: null },
    data: { atendidoEm: new Date() },
  })
  return { emNomeDeId }
}
