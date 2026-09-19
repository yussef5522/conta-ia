// ⭐⭐ O LOTE ESTORNADO — quem foi desfeito, por quem e por quê (19/09/2026).
//
// **A ordem do dono:** *"RENDIMENTO MEDIDO desintoxica — lote estornado NUNCA entra na
// média (guard)."*
//
// ⛔⛔ **POR QUE ISTO NÃO É UMA COLUNA em `stock_producao_conclusao`:** o isolamento do
// módulo proíbe `ALTER` em tabela existente (migration de estoque é CREATE-only, com guard
// de CI desde a Fase 0). E a separação é honesta por conteúdo também: *a conclusão é o
// FATO registrado; o estorno dela é outro fato, com autor, data e motivo próprios* — a
// mesma disciplina do `stock_unidade_corrigida` e do `stock_etapa_encerrada`.
//
// ⚠️ **E o registro é o que faz a média se curar sozinha.** Sem ele o rendimento podre de
// **2858** continuaria sendo "o histórico" da maionese: envenenaria toda conclusão
// seguinte **e o próprio guard de plausibilidade**, que passaria a aprovar o erro por ele
// ter virado a norma. É o caso mais perigoso de dado ruim — o que se legitima com o tempo.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

/** ⭐ os ids que NÃO contam em média nenhuma (uma pergunta, um dono — REGRA 4) */
export async function idsDeConclusoesEstornadas(companyId: string, db: Db = defaultPrisma): Promise<string[]> {
  const rows = await db.stockConclusaoEstornada.findMany({ where: { companyId }, select: { conclusaoId: true } })
  return rows.map((r) => r.conclusaoId)
}

export interface EstornoDeConclusao {
  companyId: string
  conclusaoId: string
  motivo: string
  /** o movimento de ESTORNO que desfez a geração — o rastro no ledger */
  estornoMovimentoId?: string | null
  /** o movimento NOVO, quando o lote foi relançado com o número certo */
  relancamentoMovimentoId?: string | null
  userId?: string | null
}

/**
 * ⭐ Marca a conclusão como estornada. **Idempotente por construção** (unique no
 * `conclusaoId`): estornar duas vezes é impossível, não "checado".
 *
 * ⛔ Isto NÃO apaga a conclusão — ela é o registro do que foi feito naquele dia, e o
 * ledger que ela gerou também fica (correção = estorno + novo). O que muda é que ela
 * para de ser usada como RÉGUA.
 */
export async function marcarConclusaoEstornada(e: EstornoDeConclusao, db: Db = defaultPrisma) {
  return db.stockConclusaoEstornada.upsert({
    where: { conclusaoId: e.conclusaoId },
    create: {
      companyId: e.companyId, conclusaoId: e.conclusaoId, motivo: e.motivo,
      estornoMovimentoId: e.estornoMovimentoId ?? null,
      relancamentoMovimentoId: e.relancamentoMovimentoId ?? null,
      criadoPorId: e.userId ?? null,
    },
    update: {},
  })
}
