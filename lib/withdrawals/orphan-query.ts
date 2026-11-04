// Sprint Unificar-Retirada-Órfã (13/08/2026) — FONTE ÚNICA da consulta de
// "retirada órfã" (retirada de sócio sem ponte PJ→PF). Antes havia DOIS endpoints
// com lógica DIFERENTE (`retiradas-orfas` vs `retiradas-pendentes`) → banner e
// sidebar podiam DISCORDAR (o problema do motor de transferência de novo). Agora a
// decisão vive AQUI, numa função só; os endpoints são cascas finas. Mesma lição:
// quando N telas fazem a MESMA pergunta, a resposta vira UMA lib.
//
// Critério (espelha `isOrphanWithdrawal`): DEBIT + lifecycle=EFFECTED (já pago) +
// NÃO transferência interna + NÃO agrupada (evita contar transferência entre as
// próprias contas como retirada — foi o erro dos 157k de PIX pra "CACULA MIX") +
// categoria com dreGroup em WITHDRAWAL_DRE_GROUPS (hoje só DISTRIBUICAO_LUCROS —
// pró-labore fica de fora até ter dreGroup próprio) + SEM bridge.

import type { Prisma, PrismaClient } from '@prisma/client'
import { WITHDRAWAL_DRE_GROUPS } from './is-orphan'
import { dinheirosDeRetiradaPendentes, linhasCandidatasWhere } from './dinheiro-da-retirada'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * O WHERE canônico das LINHAS candidatas.
 *
 * ⛔⛔ **ELE DEIXOU DE FILTRAR PONTE EM 05/11, e isso é o conserto, não um descuido.** Ele
 * tinha `bridge: { is: null }` — exclusão **na própria linha** — e por isso cobrava a gêmea
 * `MANUAL` de uma retirada já resolvida pelo lado `OFX`. Medido em prod: 3 fantasmas
 * (escola 100 · escola 1.318,57 · carro 2.845) e 2 pares com AMBOS os lados listados.
 *
 * ⚠️ *A pergunta "este dinheiro tem ponte?" não cabe num filtro por linha* — ela precisa
 * olhar a linha **e o par conciliado**. Quem responde é `dinheirosDeRetiradaPendentes`
 * (`dinheiro-da-retirada.ts`), e é por lá que a lista E a contagem passam.
 *
 * ⛔ Mantido exportado porque é o universo das candidatas (o `aggregate` de total e os
 * testes o usam). Quem quiser "as pendentes" tem que pedir DINHEIRO, não linha.
 */
export function orphanWithdrawalWhere(companyId: string): Prisma.TransactionWhereInput {
  return linhasCandidatasWhere(companyId)
}

/**
 * Contagem de retiradas órfãs (banner, sidebar, empty state).
 *
 * ⛔ Conta DINHEIRO, não linha, e pela MESMA derivação da lista — esta lib nasceu de dois
 * endpoints discordando, e um `count` por linha ao lado de uma lista colapsada reabriria
 * exatamente isso: o banner diria 4 e a tela mostraria 2.
 */
export async function countOrphanWithdrawals(db: Db, companyId: string): Promise<number> {
  return (await dinheirosDeRetiradaPendentes(db, companyId)).length
}

export interface OrphanWithdrawalRow {
  id: string
  date: string
  amount: number
  description: string
  bankAccountId: string
  bankAccountName: string
  categoryId: string | null
  categoryName: string | null
}

/** Lista das órfãs (com detalhe pra tela). Mesma fonte do count — um DINHEIRO por linha. */
export async function listOrphanWithdrawals(db: Db, companyId: string): Promise<OrphanWithdrawalRow[]> {
  const dinheiros = await dinheirosDeRetiradaPendentes(db, companyId)
  return dinheiros.map((d) => ({
    id: d.id,
    date: d.date.toISOString(),
    amount: d.amount,
    description: d.description,
    bankAccountId: d.bankAccountId ?? '',
    bankAccountName: d.bankAccountName ?? '—',
    categoryId: d.categoryId,
    categoryName: d.categoryName,
  }))
}
