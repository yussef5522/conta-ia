// ⭐⭐ OS TEMPOS DAS ETAPAS — a leitura única do AO VIVO e do DESEMPENHO (leis R3/R4/R10, 13/11/2026).
//
// ⭐ "TEMPO SE COMPARA COM A PRÓPRIA ETAPA" (R3): a identidade da etapa é a `chave`:
//   ordem de produção → `P:{itemProduzidoId}:{nome da etapa}` (a MESMA etapa da MESMA receita);
//   tarefa            → `T:{nome da tarefa}`.
// ⭐ Só etapa FEITA tem tempo medido (finalizada pelo gerente / encerrada sem finalizar não têm).
//   O tempo é em SEGUNDOS — a régua dos 30s (R4) não sobrevive a minutos arredondados.
// ⚠️ LEVE (a limpeza de sinal, 13/11): cada leitura tem JANELA (etapas do dia/período) e as
//   medianas leem a história SÓ das etapas com o mesmo nome das que estão na tela.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { resolverEstadoDasEtapas } from './gestos-do-gerente'
import type { EstadoDaEtapa } from './estado-da-etapa'
import { medianaDaEtapa } from './leis-r'

type Db = PrismaClient | Prisma.TransactionClient

export interface EtapaLida {
  etapaId: string
  ordemId: string
  chave: string
  ehTarefa: boolean
  /** o produto da ordem, ou o nome da tarefa */
  oQue: string
  /** a unidade do que a ordem produz (UN/KG/LT); tarefa → null */
  unidade: string | null
  itemProduzidoId: string | null
  etapaNome: string
  /** quem executou (o PIN que iniciou) — senão quem foi designado */
  quemId: string | null
  /** os outros participantes da etapa (nomes) */
  comQuem: string[]
  iniciadoEm: Date | null
  finalizadoEm: Date | null
  estado: EstadoDaEtapa
  /** segundos medidos — SÓ quando FEITA */
  seg: number | null
}

type FiltroDeEtapas =
  | { emAndamento: true }
  | { finalizadasEntre: { de: Date; ate: Date } }
  /** ⭐ a régua do LOTE (13/11): as etapas das ordens cujo lote fechou no período */
  | { ordemIds: readonly string[] }

const SEL = { id: true, ordemId: true, nome: true, executorId: true, colaboradorId: true, iniciadoEm: true, finalizadoEm: true } as const

/** as etapas de uma janela, já com chave, estado e segundos. Ordem CANCELADA/tarefa cancelada não entra. */
export async function lerEtapas(companyId: string, filtro: FiltroDeEtapas, db: Db = defaultPrisma): Promise<EtapaLida[]> {
  if ('ordemIds' in filtro && !filtro.ordemIds.length) return []
  const etapas = await db.stockOrdemEtapa.findMany({
    where: {
      companyId,
      ...('emAndamento' in filtro
        ? { iniciadoEm: { not: null }, finalizadoEm: null }
        : 'ordemIds' in filtro
          ? { ordemId: { in: [...filtro.ordemIds] } }
          : { finalizadoEm: { gte: filtro.finalizadasEntre.de, lte: filtro.finalizadasEntre.ate } }),
    },
    select: SEL,
  })
  return montar(companyId, etapas, db)
}

async function montar(companyId: string, etapas: { id: string; ordemId: string; nome: string; executorId: string | null; colaboradorId: string | null; iniciadoEm: Date | null; finalizadoEm: Date | null }[], db: Db): Promise<EtapaLida[]> {
  if (!etapas.length) return []
  const ordemIds = [...new Set(etapas.map((e) => e.ordemId))]
  const [ordens, tarefas, participantes, estados] = await Promise.all([
    db.stockProductionOrder.findMany({ where: { companyId, id: { in: ordemIds } }, select: { id: true, estado: true, itemProduzidoId: true } }),
    db.stockTarefa.findMany({ where: { companyId, id: { in: ordemIds } }, select: { id: true, nome: true, canceladaEm: true } }),
    db.stockOrdemEtapaParticipante.findMany({ where: { companyId, etapaId: { in: etapas.map((e) => e.id) } }, select: { etapaId: true, colaboradorId: true } }),
    resolverEstadoDasEtapas(companyId, etapas, db),
  ])
  const itens = await db.stockItem.findMany({
    where: { id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } }, select: { id: true, nome: true, unidadeControle: true },
  })
  const colabIds = [...new Set(participantes.map((p) => p.colaboradorId))]
  const colabs = colabIds.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } }) : []
  const nomeColab = new Map(colabs.map((c) => [c.id, c.nome]))
  const ordem = new Map(ordens.map((o) => [o.id, o]))
  const tarefa = new Map(tarefas.map((t) => [t.id, t]))
  const item = new Map(itens.map((i) => [i.id, i]))
  const partes = new Map<string, string[]>()
  for (const p of participantes) partes.set(p.etapaId, [...(partes.get(p.etapaId) ?? []), p.colaboradorId])

  const out: EtapaLida[] = []
  for (const e of etapas) {
    const o = ordem.get(e.ordemId), t = tarefa.get(e.ordemId)
    if (o ? o.estado === 'CANCELADA' : !t || t.canceladaEm) continue
    const estado = estados.get(e.id)?.estado
    if (!estado) continue
    const quemId = e.executorId ?? e.colaboradorId ?? partes.get(e.id)?.[0] ?? null
    const it = o ? item.get(o.itemProduzidoId) : undefined
    out.push({
      etapaId: e.id, ordemId: e.ordemId, ehTarefa: !o,
      chave: o ? `P:${o.itemProduzidoId}:${e.nome}` : `T:${t!.nome}`,
      oQue: o ? it?.nome ?? '(item removido)' : t!.nome,
      unidade: o ? it?.unidadeControle ?? 'UN' : null,
      itemProduzidoId: o?.itemProduzidoId ?? null,
      etapaNome: e.nome, quemId,
      comQuem: (partes.get(e.id) ?? []).filter((c) => c !== quemId).map((c) => nomeColab.get(c) ?? '—'),
      iniciadoEm: e.iniciadoEm, finalizadoEm: e.finalizadoEm, estado,
      seg: estado === 'FEITA' && e.iniciadoEm && e.finalizadoEm ? Math.max(0, (e.finalizadoEm.getTime() - e.iniciadoEm.getTime()) / 1000) : null,
    })
  }
  return out
}

/**
 * ⭐ A MEDIANA DE CADA CHAVE (R3/R4): a história das etapas FEITAS com o MESMO nome, mediana só com
 * ≥ 5 medições ≥ 30s. ⚠️ Lê só os nomes das chaves pedidas — nunca a história inteira do módulo.
 */
export async function medianasDasChaves(companyId: string, chaves: readonly string[], db: Db = defaultPrisma): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (!chaves.length) return out
  const nomes = new Set<string>()
  for (const c of chaves) nomes.add(c.startsWith('T:') ? c.slice(2) : c.slice(c.indexOf(':', 2) + 1))
  const etapas = await db.stockOrdemEtapa.findMany({
    where: { companyId, nome: { in: [...nomes] }, iniciadoEm: { not: null }, finalizadoEm: { not: null } },
    select: SEL,
  })
  const historia = await montar(companyId, etapas, db)
  const segs = new Map<string, number[]>()
  for (const e of historia) if (e.seg != null) segs.set(e.chave, [...(segs.get(e.chave) ?? []), e.seg])
  for (const c of chaves) out.set(c, medianaDaEtapa(segs.get(c) ?? []))
  return out
}

/** nomes das contas (inclusive excluídas — o nome vive nos relatórios antigos, R23) */
export async function nomesDasContas(companyId: string, ids: readonly string[], db: Db = defaultPrisma): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const cs = await db.stockColaborador.findMany({ where: { companyId, id: { in: [...ids] } }, select: { id: true, nome: true } })
  return new Map(cs.map((c) => [c.id, c.nome]))
}
