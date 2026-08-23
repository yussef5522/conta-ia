// ESTOQUE FASE 3 PARTE 2 — invariantes do juiz pra CONTAGEM.
// E7 (AVISO): item com saldo sem contagem há > 30 dias (ou nunca contado) — a cauda que
//   ninguém conta é onde o estoque mente. Só vale pra empresa que JÁ contou alguma vez:
//   antes da contagem inicial, "nunca contado" é o estado normal, não um problema.
// E8 (ERRO): contagem FINALIZADA em que os ajustes NÃO batem — linha com divergência sem
//   AJUSTE_CONTAGEM, movimento sumido, ou movimento com quantidade ≠ divergência.
//   É o backstop do "ajuste na hora": se a linha diz que faltavam 3 KG, o ledger tem que
//   ter os 3 KG. Sem isso a contagem viraria enfeite — relatório bonito, saldo intacto.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from './stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient

export const E7_DIAS = 30
const EPS = 0.0001
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000

export async function checkContagemInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []

  // ---- E8: os ajustes das contagens FINALIZADAS batem com o ledger ----
  const finalizadas = await db.stockContagem.findMany({ where: { status: 'FINALIZADA' }, select: { id: true, companyId: true } })
  if (finalizadas.length) {
    const linhas = await db.stockContagemItem.findMany({
      where: { contagemId: { in: finalizadas.map((c) => c.id) } },
      select: { id: true, companyId: true, contagemId: true, itemId: true, divergencia: true, movementId: true },
    })
    const movIds = linhas.map((l) => l.movementId).filter((m): m is string => !!m)
    const movs = movIds.length
      ? await db.stockMovement.findMany({ where: { id: { in: movIds } }, select: { id: true, quantidade: true, tipo: true } })
      : []
    const movPorId = new Map(movs.map((m) => [m.id, m]))

    for (const l of linhas) {
      const temDiv = Math.abs(l.divergencia) > EPS
      if (temDiv && !l.movementId) {
        fails.push({ invariante: 'E8', companyId: l.companyId, detalhe: `contagem ${l.contagemId}, item ${l.itemId}: divergência de ${round3(l.divergencia)} registrada mas SEM movimento de ajuste — o saldo não foi corrigido.` })
        continue
      }
      if (!l.movementId) continue
      const m = movPorId.get(l.movementId)
      if (!m) {
        fails.push({ invariante: 'E8', companyId: l.companyId, detalhe: `contagem ${l.contagemId}, item ${l.itemId}: aponta o movimento ${l.movementId}, que não existe.` })
        continue
      }
      if (m.tipo !== 'AJUSTE_CONTAGEM') {
        fails.push({ invariante: 'E8', companyId: l.companyId, detalhe: `contagem ${l.contagemId}, item ${l.itemId}: o movimento ${m.id} é ${m.tipo}, deveria ser AJUSTE_CONTAGEM.` })
        continue
      }
      if (Math.abs(round3(m.quantidade) - round3(l.divergencia)) > 0.001) {
        fails.push({ invariante: 'E8', companyId: l.companyId, detalhe: `contagem ${l.contagemId}, item ${l.itemId}: ajuste de ${round3(m.quantidade)} ≠ divergência registrada ${round3(l.divergencia)}.` })
      }
    }
  }

  // ---- E7 (aviso): item com saldo parado sem contagem ----
  const companiesQueJaContaram = [...new Set(finalizadas.map((c) => c.companyId))]
  if (companiesQueJaContaram.length) {
    const limite = new Date(now.getTime() - E7_DIAS * 86_400_000)
    for (const companyId of companiesQueJaContaram) {
      const [itens, contagens] = await Promise.all([
        db.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true } }),
        db.stockContagemItem.findMany({ where: { companyId }, orderBy: { contadoEm: 'desc' }, select: { itemId: true, contadoEm: true } }),
      ])
      const ultima = new Map<string, Date>()
      for (const c of contagens) if (!ultima.has(c.itemId)) ultima.set(c.itemId, c.contadoEm)

      // só itens que TÊM saldo — item zerado sem contagem não é risco de estoque errado
      const comSaldo = await db.stockSaldoCache.findMany({ where: { companyId }, select: { itemId: true, saldo: true } })
      const saldoPorItem = new Map(comSaldo.map((c) => [c.itemId, c.saldo]))

      for (const i of itens) {
        if (Math.abs(saldoPorItem.get(i.id) ?? 0) <= EPS) continue
        const u = ultima.get(i.id)
        if (!u) {
          fails.push({ invariante: 'E7', companyId, nivel: 'aviso', detalhe: `item "${i.nome}" tem saldo e NUNCA foi contado — entre na próxima contagem.` })
        } else if (u < limite) {
          const dias = Math.floor((now.getTime() - u.getTime()) / 86_400_000)
          fails.push({ invariante: 'E7', companyId, nivel: 'aviso', detalhe: `item "${i.nome}" não é contado há ${dias} dias (limite ${E7_DIAS}).` })
        }
      }
    }
  }

  return fails
}
