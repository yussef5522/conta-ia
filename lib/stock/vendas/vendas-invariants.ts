// ESTOQUE FASE 3 — invariante do juiz pra vendas. V1: venda importada SEM destino (nome não
// mapeado) há > 7 dias. É AVISO (não vermelho) — mapear a cauda longa é decisão do dono; o
// juiz só lembra. Rodado no juiz noturno junto de E*/P*, na tabela isolada.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from '../stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient
const V1_DIAS = 7

export async function checkVendasInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const limite = new Date(now.getTime() - V1_DIAS * 86_400_000)
  const [linhas, mapa] = await Promise.all([
    db.stockVendaLinha.findMany({ where: { data: { lt: limite } }, select: { companyId: true, nomeSuitable: true } }),
    db.stockVendaProdutoMap.findMany({ select: { companyId: true, nomeSuitable: true } }),
  ])
  const mapeados = new Set(mapa.map((m) => `${m.companyId}|${m.nomeSuitable}`))
  const pendentesAntigos = new Map<string, { companyId: string; nome: string }>()
  for (const l of linhas) {
    const k = `${l.companyId}|${l.nomeSuitable}`
    if (mapeados.has(k)) continue
    if (!pendentesAntigos.has(k)) pendentesAntigos.set(k, { companyId: l.companyId, nome: l.nomeSuitable })
  }
  for (const p of pendentesAntigos.values()) {
    fails.push({ invariante: 'V1', companyId: p.companyId, nivel: 'aviso', detalhe: `venda "${p.nome}" importada há > ${V1_DIAS} dias sem destino no estoque — mapeie pra a baixa contar (ou deixe pendente).` })
  }
  return fails
}
