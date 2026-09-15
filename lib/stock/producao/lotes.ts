// ⭐ O LEITOR DOS LOTES FECHADOS (13/09/2026) — o tijolo dos Relatórios.
//
// ⚠️ É o irmão de `execucoes.ts`: lá a unidade é a PESSOA (quem trabalhou), aqui é o LOTE
// (o que saiu). As duas perguntas são diferentes e por isso são dois leitores — mas **as
// duas régua de honestidade são as mesmas**, e por isso elas moram no mesmo lugar:
// cancelada fora pelo ESTADO, tempo não medido contado à parte, meta ausente ≠ meta zero.

import { prisma as defaultPrisma } from '@/lib/db'
import type { Lote } from './relatorios'
import { minutosDoLote } from './plano-da-etapa'

type Db = typeof defaultPrisma

/** ⚠️ o dia do lote no fuso do BRASIL — datar em UTC jogaria o lote da noite pro dia seguinte */
function diaBrasil(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export interface JanelaDeLotes { de?: Date; ate?: Date; tarefa?: string }

export async function lotesDaJanela(companyId: string, janela: JanelaDeLotes = {}, db: Db = defaultPrisma): Promise<Lote[]> {
  const conclusoes = await db.stockProducaoConclusao.findMany({
    where: {
      companyId,
      ...(janela.de || janela.ate ? { criadoEm: { ...(janela.de ? { gte: janela.de } : {}), ...(janela.ate ? { lte: janela.ate } : {}) } } : {}),
    },
    select: { ordemId: true, qtdGerada: true, custoUnitarioReal: true, criadoEm: true },
  })
  if (!conclusoes.length) return []

  const ordemIds = [...new Set(conclusoes.map((c) => c.ordemId))]
  const [ordens, metas, etapas] = await Promise.all([
    db.stockProductionOrder.findMany({ where: { companyId, id: { in: ordemIds } }, select: { id: true, estado: true, itemProduzidoId: true } }),
    db.stockOrdemMeta.findMany({ where: { companyId, ordemId: { in: ordemIds } }, select: { ordemId: true, unidades: true } }),
    db.stockOrdemEtapa.findMany({ where: { companyId, ordemId: { in: ordemIds }, iniciadoEm: { not: null } }, select: { ordemId: true, iniciadoEm: true, finalizadoEm: true } }),
  ])
  // ⛔ CANCELADA fora — pelo ESTADO, nunca por heurística de nome (a régua de 06/09)
  const vivas = new Map(ordens.filter((o) => o.estado !== 'CANCELADA').map((o) => [o.id, o]))
  const itens = await db.stockItem.findMany({
    where: { id: { in: [...new Set([...vivas.values()].map((o) => o.itemProduzidoId))] } }, select: { id: true, nome: true, unidadeControle: true },
  })
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const unidadeItem = new Map(itens.map((i) => [i.id, i.unidadeControle]))
  const metaPorOrdem = new Map(metas.map((m) => [m.ordemId, m.unidades]))

  /**
   * ⛔⛔⛔ AQUI MORAVA A ARMADILHA DO RELÓGIO (corrigida 15/09/2026).
   *
   * Esta linha dizia, em comentário: *"a duração do LOTE é da 1ª etapa iniciada à última
   * finalizada"* — ou seja, **fim − início atravessando a noite**. Um lote cuja etapa 1 é
   * feita hoje e a 2 amanhã contava as **16 horas de descanso como produção**, e esse número
   * ia pra média por lote, pro gráfico por dia e pro "melhor ritmo".
   *
   * **A régua do dono:** *"o TEMPO do lote é a SOMA dos cronômetros das etapas. Lote que
   * dorme 16h não produziu 16h — se a etapa 1 levou 40min e a 2 levou 35min, o lote levou
   * 1h15."*
   *
   * ⚠️ O defeito **já existia** antes das etapas em dias diferentes: bastava um intervalo
   * grande entre duas etapas do mesmo lote. A feature só o tornaria rotina.
   */
  const etapasDaOrdem = new Map<string, { iniciadoEm: Date | null; finalizadoEm: Date | null }[]>()
  for (const e of etapas) etapasDaOrdem.set(e.ordemId, [...(etapasDaOrdem.get(e.ordemId) ?? []), e])

  // ⚠️ produção PARCIAL gera VÁRIAS conclusões na mesma ordem — elas somam num lote só,
  // senão o mesmo pedido apareceria 3× no numerador do rendimento.
  const porOrdem = new Map<string, { entregue: number; custoSoma: number; comCusto: number; quando: Date }>()
  for (const c of conclusoes) {
    if (!vivas.has(c.ordemId)) continue
    const a = porOrdem.get(c.ordemId) ?? { entregue: 0, custoSoma: 0, comCusto: 0, quando: c.criadoEm }
    porOrdem.set(c.ordemId, {
      entregue: a.entregue + c.qtdGerada,
      custoSoma: a.custoSoma + (c.custoUnitarioReal ?? 0) * c.qtdGerada,
      comCusto: a.comCusto + (c.custoUnitarioReal ? c.qtdGerada : 0),
      quando: a.quando < c.criadoEm ? a.quando : c.criadoEm,
    })
  }

  const out: Lote[] = []
  for (const [ordemId, v] of porOrdem) {
    const o = vivas.get(ordemId)!
    const tarefa = nomeItem.get(o.itemProduzidoId) ?? '(item removido)'
    if (janela.tarefa && tarefa !== janela.tarefa) continue
    const doLote = etapasDaOrdem.get(ordemId) ?? []
    out.push({
      ordemId, tarefa,
      unidade: unidadeItem.get(o.itemProduzidoId) ?? 'UN',
      pedido: metaPorOrdem.get(ordemId) ?? null,
      entregue: Math.round(v.entregue * 100) / 100,
      custoUnitario: v.comCusto > 0 ? Math.round((v.custoSoma / v.comCusto) * 100) / 100 : null,
      // ⭐ SOMA dos cronômetros — nunca a janela do lote (o sono não é trabalho)
      minutos: minutosDoLote(doLote),
      dia: diaBrasil(v.quando),
    })
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia))
}

/** ⭐ as tarefas que aparecem no seletor — só o que de fato produziu na janela */
export function tarefasDaJanela(lotes: Lote[]): { tarefa: string; lotes: number; unidades: number; unidade: string }[] {
  // ⚠️ aqui a soma é SEGURA porque agrupa POR TAREFA — e uma tarefa produz uma coisa só.
  // É exatamente o contrário de somar por PESSOA, que atravessa tarefas de unidades diferentes.
  const m = new Map<string, { lotes: number; unidades: number; unidade: string }>()
  for (const l of lotes) {
    const a = m.get(l.tarefa) ?? { lotes: 0, unidades: 0, unidade: l.unidade }
    m.set(l.tarefa, { lotes: a.lotes + 1, unidades: a.unidades + l.entregue, unidade: a.unidade })
  }
  return [...m.entries()]
    .map(([tarefa, v]) => ({ tarefa, lotes: v.lotes, unidades: Math.round(v.unidades * 100) / 100, unidade: v.unidade }))
    .sort((a, b) => b.lotes - a.lotes || b.unidades - a.unidades)
}
