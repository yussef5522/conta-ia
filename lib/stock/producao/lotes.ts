// ⭐ O LEITOR DOS LOTES FECHADOS (13/09/2026) — o tijolo dos Relatórios.
//
// ⚠️ É o irmão de `execucoes.ts`: lá a unidade é a PESSOA (quem trabalhou), aqui é o LOTE
// (o que saiu). As duas perguntas são diferentes e por isso são dois leitores — mas **as
// duas régua de honestidade são as mesmas**, e por isso elas moram no mesmo lugar:
// cancelada fora pelo ESTADO, tempo não medido contado à parte, meta ausente ≠ meta zero.

import { prisma as defaultPrisma } from '@/lib/db'
import type { Lote } from './relatorios'

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
    where: { id: { in: [...new Set([...vivas.values()].map((o) => o.itemProduzidoId))] } }, select: { id: true, nome: true },
  })
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const metaPorOrdem = new Map(metas.map((m) => [m.ordemId, m.unidades]))

  // ⭐ a duração do LOTE é da 1ª etapa iniciada à última finalizada; se alguma etapa ficou
  // sem finalizar, o lote **não tem tempo medido** — inventar o fim seria inventar minutos.
  const janelaDaOrdem = new Map<string, { ini: Date; fim: Date | null }>()
  for (const e of etapas) {
    const a = janelaDaOrdem.get(e.ordemId)
    const fim = a?.fim === null ? null : e.finalizadoEm ? (a?.fim && a.fim > e.finalizadoEm ? a.fim : e.finalizadoEm) : null
    janelaDaOrdem.set(e.ordemId, { ini: a && a.ini < e.iniciadoEm! ? a.ini : e.iniciadoEm!, fim })
  }

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
    const j = janelaDaOrdem.get(ordemId)
    out.push({
      ordemId, tarefa,
      pedido: metaPorOrdem.get(ordemId) ?? null,
      entregue: Math.round(v.entregue * 100) / 100,
      custoUnitario: v.comCusto > 0 ? Math.round((v.custoSoma / v.comCusto) * 100) / 100 : null,
      minutos: j?.fim ? Math.round((j.fim.getTime() - j.ini.getTime()) / 60000) : null,
      dia: diaBrasil(v.quando),
    })
  }
  return out.sort((a, b) => a.dia.localeCompare(b.dia))
}

/** ⭐ as tarefas que aparecem no seletor — só o que de fato produziu na janela */
export function tarefasDaJanela(lotes: Lote[]): { tarefa: string; lotes: number; unidades: number }[] {
  const m = new Map<string, { lotes: number; unidades: number }>()
  for (const l of lotes) {
    const a = m.get(l.tarefa) ?? { lotes: 0, unidades: 0 }
    m.set(l.tarefa, { lotes: a.lotes + 1, unidades: a.unidades + l.entregue })
  }
  return [...m.entries()]
    .map(([tarefa, v]) => ({ tarefa, lotes: v.lotes, unidades: Math.round(v.unidades * 100) / 100 }))
    .sort((a, b) => b.unidades - a.unidades)
}
