/**
 * ⭐⭐ O CONTEXTO DAS ORDENS ABERTAS — *"quem · começou HHhMM · há Xh"* + o PEDIDO (04/10/2026).
 *
 * **Pedido do dono (mock v3 da home):** a linha da ordem aberta mostra *"quem · começou HHhMM ·
 * há Xh"* e, à direita, **o pedido grande** (*"200 UN pedidas"*).
 *
 * ⛔⛔ **A home NÃO carregava nenhum dos dois** — ela mostrava `escala × loteBase` ("~N
 * esperadas"), que é a DERIVAÇÃO da ficha, não o que o dono pediu. O `stockOrdemMeta` existe
 * desde 13/09 e esta tela nunca o leu.
 *
 * ⭐ **E QUEM RESPONDE "QUAL FOI O PEDIDO?" CONTINUA SENDO O `pedidoDaOrdem`** (a porta única de
 * 04/10), que já sabe distinguir DECLARADO de DERIVADO e dizer a origem. Reimplementar o
 * `meta ?? escala × loteBase` aqui seria a segunda régua — e ela divergiria no primeiro caso
 * de borda, que é exatamente a ordem antiga sem meta.
 *
 * ⛔⛔ **ZERO N+1, de propósito:** três queries em lote pra N ordens, nunca uma por ordem. É a
 * lição medida de 28/09 — `listFichas` com `for (const f of fichas) await versaoView(…)` custou
 * **4.909 ms e 1.786 consultas** numa tela que o dono abre todo dia.
 */

import type { PrismaClient, Prisma } from '@prisma/client'
import { pedidoDaOrdem } from './pedido-da-ordem'

type Db = PrismaClient | Prisma.TransactionClient

export interface ContextoDaAberta {
  /** quantas unidades o dono pediu — `null` quando não dá pra dizer */
  pedido: number | null
  /** ⚠️ DECLARADO = ele digitou; DERIVADO = calculado pela ficha (ordem antiga) */
  pedidoOrigem: 'DECLARADO' | 'DERIVADO' | null
  /** quem está com a mão na massa (quem TOCOU o iniciar) — pode ser dupla */
  quem: string[]
  /** ISO do 1º toque no iniciar nesta ordem — `null` quando ninguém começou ainda */
  comecouEm: string | null
}

export interface OrdemPraContexto {
  id: string
  escalaReceitas: number
  loteBase: number
}

export async function contextoDasAbertas(
  companyId: string,
  ordens: OrdemPraContexto[],
  db: Db,
): Promise<Record<string, ContextoDaAberta>> {
  const out: Record<string, ContextoDaAberta> = {}
  if (!ordens.length) return out

  const ids = ordens.map((o) => o.id)

  const [metas, etapas] = await Promise.all([
    db.stockOrdemMeta.findMany({ where: { companyId, ordemId: { in: ids } }, select: { ordemId: true, unidades: true } }),
    /**
     * ⚠️ só as etapas que FORAM INICIADAS: a etapa na fila não tem "começou às", e inventar um
     * horário pra ela seria criar um fato (a mesma régua que mantém o `finalizadoEm` NULL no
     * gesto do gerente, 07/09).
     */
    db.stockOrdemEtapa.findMany({
      where: { companyId, ordemId: { in: ids }, iniciadoEm: { not: null } },
      select: { id: true, ordemId: true, iniciadoEm: true, executorId: true },
    }),
  ])

  const metaPorOrdem = new Map(metas.map((m) => [m.ordemId, m.unidades]))

  /**
   * ⭐ Os PARTICIPANTES (a dupla de 08/09) são a fonte preferida de "quem": é o relógio DELE
   * que nasce do PIN. O `executorId` da etapa entra como rede pra etapa de um só.
   */
  const participantes = etapas.length
    ? await db.stockOrdemEtapaParticipante.findMany({
        where: { companyId, etapaId: { in: etapas.map((e) => e.id) }, iniciadoEm: { not: null } },
        select: { etapaId: true, colaboradorId: true },
      })
    : []

  const colabIds = [...new Set([
    ...etapas.map((e) => e.executorId).filter((x): x is string => !!x),
    ...participantes.map((p) => p.colaboradorId),
  ])]
  const colaboradores = colabIds.length
    ? await db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } })
    : []
  const nome = new Map(colaboradores.map((c) => [c.id, c.nome]))

  const porEtapa = new Map<string, string[]>()
  for (const p of participantes) porEtapa.set(p.etapaId, [...(porEtapa.get(p.etapaId) ?? []), p.colaboradorId])

  const ctx = new Map<string, { comecou: Date | null; quem: Set<string> }>()
  for (const e of etapas) {
    const a = ctx.get(e.ordemId) ?? { comecou: null, quem: new Set<string>() }
    // ⭐ o 1º toque da ordem — "começou às" é quando a cozinha pegou o lote, não a última etapa
    if (e.iniciadoEm && (!a.comecou || e.iniciadoEm < a.comecou)) a.comecou = e.iniciadoEm
    const daEtapa = porEtapa.get(e.id) ?? (e.executorId ? [e.executorId] : [])
    for (const c of daEtapa) { const n = nome.get(c); if (n) a.quem.add(n) }
    ctx.set(e.ordemId, a)
  }

  for (const o of ordens) {
    // ⭐ a porta única do pedido — DECLARADO vs DERIVADO resolvido num lugar só
    const p = pedidoDaOrdem({
      meta: metaPorOrdem.get(o.id) ?? null,
      escala: o.escalaReceitas,
      loteBase: o.loteBase,
    })
    const c = ctx.get(o.id)
    out[o.id] = {
      pedido: p.unidades,
      pedidoOrigem: p.origem,
      quem: [...(c?.quem ?? [])].sort(),
      comecouEm: c?.comecou ? c.comecou.toISOString() : null,
    }
  }
  return out
}

/**
 * ⭐ PURA — os pedidos das ordens que CONCLUÍRAM, pro par *"pedido → fez"*.
 *
 * ⚠️⚠️ **O PEDIDO E A PÍLULA TÊM DENOMINADORES DIFERENTES, e isso é de propósito.** O par diz
 * *"o que eu pedi → o que saiu"*; a pílula diz *"o que saiu ÷ o que a FICHA promete"* (a
 * eficiência congelada que o juiz P8 lê). São duas perguntas, e `fez ÷ pedido` **não** é a
 * pílula. Quem "simplificar" isso numa divisão só vai fazer a tela e o e-mail do P8 discordarem
 * sobre o mesmo lote — a doença que este módulo mais paga.
 */
export function pedidoPorOrdem(
  ordens: OrdemPraContexto[],
  metas: { ordemId: string; unidades: number }[],
): Record<string, { pedido: number | null; origem: 'DECLARADO' | 'DERIVADO' | null }> {
  const metaPorOrdem = new Map(metas.map((m) => [m.ordemId, m.unidades]))
  const out: Record<string, { pedido: number | null; origem: 'DECLARADO' | 'DERIVADO' | null }> = {}
  for (const o of ordens) {
    const p = pedidoDaOrdem({ meta: metaPorOrdem.get(o.id) ?? null, escala: o.escalaReceitas, loteBase: o.loteBase })
    out[o.id] = { pedido: p.unidades, origem: p.origem }
  }
  return out
}
