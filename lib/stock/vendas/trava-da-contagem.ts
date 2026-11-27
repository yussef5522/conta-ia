/**
 * ⭐⭐ A TRAVA DA CONTAGEM — PORTA ÚNICA (25/11 + 27/11/2026).
 *
 * "Este item foi CONTADO depois que o dia da venda começou?" Se sim, a contagem já viu a prateleira
 * com aquela venda dentro — tirar de novo seria tirar duas vezes. Quem pergunta:
 *   · a pergunta de acerto da ficha tardia (`ficha-tardia.ts`) — o item contado fica FORA do acerto;
 *   · o REPROCESSO de um dia já fechado (`baixa-venda.ts`) — o item contado não é estornado nem
 *     rebaixado: a baixa original fica de pé, a contagem já fixou a verdade dele.
 * ⛔ Uma régua só: contagem CANCELADA não trava; a janela começa na virada do dia operacional.
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import { HORA_VIRADA_DIA } from '@/lib/suit/regua-sombra'

type Db = PrismaClient | Prisma.TransactionClient

/** o instante em que o dia operacional da venda COMEÇA (relógio da API, UTC) — contagem daí em diante já viu a venda */
export const inicioDoDiaDaVenda = (dia: string) => new Date(`${dia}T${HORA_VIRADA_DIA}Z`)

/** itemId → a contagem VIVA mais recente desde o início do dia `dia` (só os contados aparecem) */
export async function contadosDesdeODia(db: Db, companyId: string, dia: string, itemIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  if (!itemIds.length) return out
  const contados = await db.stockContagemItem.findMany({
    where: { companyId, itemId: { in: itemIds }, contadoEm: { gte: inicioDoDiaDaVenda(dia) } },
    select: { itemId: true, contadoEm: true, contagemId: true },
    orderBy: { contadoEm: 'desc' },
  })
  if (!contados.length) return out
  const vivas = new Set((await db.stockContagem.findMany({
    where: { companyId, id: { in: [...new Set(contados.map((c) => c.contagemId))] }, NOT: { status: 'CANCELADA' } },
    select: { id: true },
  })).map((c) => c.id))
  for (const c of contados) if (vivas.has(c.contagemId) && !out.has(c.itemId) && c.contadoEm) out.set(c.itemId, c.contadoEm)
  return out
}
