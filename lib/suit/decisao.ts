// SUITAPI — A DECISÃO DO DONO sobre pedido apagado/alterado DEPOIS que o dia entrou (10/11/2026).
//   MANTER    → o dia fica como entrou (o estoque não muda); os eventos saem da fila.
//   ATUALIZAR → o dia é REENTREGUE à esteira com o estado atual da Suit (gravarVenda estorna a
//               baixa antiga e faz a nova — ledger imutável, correção = estorno + novo).
// ⛔ A decisão é POR DIA (a reentrega refaz o dia inteiro) e fica registrada (quem, quando).
import { readFileSync } from 'node:fs'
import type { PrismaClient } from '@prisma/client'
import { materializarDia, type ResultadoMaterializacao } from './materializar'
import { avisarEventos, SYNC_PARADO_MIN } from './guarda'

export type Decisao = 'MANTER' | 'ATUALIZAR'

export async function decidirDia(db: PrismaClient, companyId: string, dia: string, decisao: Decisao, userId: string | null, agora: Date): Promise<{ eventos: number; reentrega: ResultadoMaterializacao | null }> {
  const pend = await db.suitPedidoEvento.findMany({ where: { companyId, dia, depoisDaMaterializacao: true, decisao: null }, select: { id: true } })
  if (pend.length === 0) return { eventos: 0, reentrega: null }
  const reentrega = decisao === 'ATUALIZAR' ? await materializarDia(db, companyId, dia, agora, { reentregar: true }) : null
  await db.suitPedidoEvento.updateMany({ where: { id: { in: pend.map((p) => p.id) } }, data: { decisao, decididoEm: agora, decididoPorId: userId } })
  await avisarEventos(db, companyId)
  return { eventos: pend.length, reentrega }
}

export function lerBatimento(caminho = `${process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'}/suit-sync.batimento`): Date | null {
  try {
    const d = new Date(readFileSync(caminho, 'utf8').trim())
    return Number.isNaN(d.getTime()) ? null : d
  } catch { return null }
}

/** o que a faixa e a tela da Suit mostram — ⛔ nada de dado pessoal (só número do pedido, hora e valor) */
export async function estadoDaSuit(db: PrismaClient, companyId: string, agora: Date, ultimaLeitura: Date | null = lerBatimento()) {
  const dias = await db.suitDiaMaterializado.findMany({ where: { companyId }, orderBy: { dia: 'desc' }, take: 14, select: { dia: true, status: true, totalCent: true, unidades: true, pedidos: true, motivo: true } })
  const eventos = await db.suitPedidoEvento.findMany({
    where: { companyId, depoisDaMaterializacao: true, decisao: null },
    orderBy: [{ dia: 'desc' }, { detectadoEm: 'asc' }],
    select: { id: true, dia: true, tipo: true, apiId: true, deltaCent: true, deltaUn: true, detectadoEm: true, pedidoId: true },
  })
  const pedidos = eventos.length ? await db.suitPedido.findMany({ where: { id: { in: eventos.map((e) => e.pedidoId) } }, select: { id: true, displayNumber: true, criadoApiEm: true, totalCent: true, orderType: true } }) : []
  const pm = new Map(pedidos.map((p) => [p.id, p]))
  const porDia = new Map<string, { dia: string; n: number; deltaCent: number }>()
  for (const e of eventos) {
    const d = porDia.get(e.dia) ?? { dia: e.dia, n: 0, deltaCent: 0 }
    d.n++; d.deltaCent += e.deltaCent; porDia.set(e.dia, d)
  }
  return {
    ultimaLeitura: ultimaLeitura?.toISOString() ?? null,
    parado: !ultimaLeitura || agora.getTime() - ultimaLeitura.getTime() > SYNC_PARADO_MIN * 60_000,
    dias,
    pendentes: [...porDia.values()],
    eventos: eventos.map((e) => {
      const p = pm.get(e.pedidoId)
      return { id: e.id, dia: e.dia, tipo: e.tipo, pedido: p?.displayNumber ?? String(e.apiId), hora: p?.criadoApiEm.toISOString() ?? null, tipoPedido: p?.orderType ?? null, totalCent: p?.totalCent ?? 0, deltaCent: e.deltaCent, deltaUn: e.deltaUn, detectadoEm: e.detectadoEm.toISOString() }
    }),
  }
}
