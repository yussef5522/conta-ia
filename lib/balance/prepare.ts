// Aplica regras de sinal pra cada transação antes do cálculo de saldo.
// Sprint 0.5 Dia 3 — função PURA, sem DB.
//
// Regras:
//   CREDIT  → +amount
//   DEBIT   → -amount
//   TRANSFER:
//     - saída na conta atual: -amount
//     - entrada na conta atual: +amount
//
// Detecção de direção em TRANSFER: agrupa por transferGroupId, ordena ASC por
// createdAt (e desempata por id pra ser deterministico). A primeira ponta criada
// é a SAÍDA (from), a segunda é a ENTRADA (to). Garantia vem de lib/transfers/create.ts
// que chama prisma.$transaction([create debit, create credit, ...]) nessa ordem.

export interface RawBalanceTransaction {
  id: string
  date: Date
  createdAt: Date
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
  amount: number // sempre positivo
  bankAccountId: string
  transferGroupId: string | null
  // Fase 2: direção EXPLÍCITA quando preenchida. Quando NULL, fallback
  // para heurística createdAt-ASC (tx criadas antes da migration Fase 2).
  transferDirection?: 'OUT' | 'IN' | null
}

export interface SignedBalanceTransaction {
  id: string
  date: Date
  signedAmount: number
  // Campos opcionais úteis pra agregação posterior (cashflow):
  rawType: 'CREDIT' | 'DEBIT' | 'TRANSFER'
}

// Atribui sinal a cada transação considerando a conta-alvo.
// Transações em outras contas (que não a target) são FILTRADAS — esta função
// não vaza valores cross-account.
export function prepareBalanceTransactions(
  txs: RawBalanceTransaction[],
  targetAccountId: string,
): SignedBalanceTransaction[] {
  if (!targetAccountId) {
    throw new Error('targetAccountId é obrigatório (isolamento multi-tenant)')
  }

  // 1. Index pares TRANSFER por transferGroupId pra detectar direção
  const transferGroups = new Map<string, RawBalanceTransaction[]>()
  for (const tx of txs) {
    if (tx.type === 'TRANSFER' && tx.transferGroupId) {
      const arr = transferGroups.get(tx.transferGroupId) ?? []
      arr.push(tx)
      transferGroups.set(tx.transferGroupId, arr)
    }
  }

  // Ordena cada grupo: primeira = saída (from), segunda = entrada (to)
  for (const [, group] of transferGroups) {
    group.sort((a, b) => {
      const ta = a.createdAt.getTime()
      const tb = b.createdAt.getTime()
      if (ta !== tb) return ta - tb
      return a.id.localeCompare(b.id)
    })
  }

  // 2. Filtra só transações da conta-alvo + atribui sinal
  const result: SignedBalanceTransaction[] = []
  for (const tx of txs) {
    if (tx.bankAccountId !== targetAccountId) continue

    if (tx.type === 'CREDIT') {
      result.push({
        id: tx.id,
        date: tx.date,
        signedAmount: tx.amount,
        rawType: 'CREDIT',
      })
    } else if (tx.type === 'DEBIT') {
      result.push({
        id: tx.id,
        date: tx.date,
        signedAmount: -tx.amount,
        rawType: 'DEBIT',
      })
    } else if (tx.type === 'TRANSFER') {
      if (!tx.transferGroupId) {
        // TRANSFER sem groupId é estado inválido — skip e segue (resiliente).
        continue
      }
      // Fase 2: prioriza coluna transferDirection EXPLÍCITA.
      // Vantagem: imune a pernas órfãs ou ordem createdAt distorcida.
      if (tx.transferDirection === 'OUT') {
        result.push({ id: tx.id, date: tx.date, signedAmount: -tx.amount, rawType: 'TRANSFER' })
        continue
      }
      if (tx.transferDirection === 'IN') {
        result.push({ id: tx.id, date: tx.date, signedAmount: tx.amount, rawType: 'TRANSFER' })
        continue
      }
      // FALLBACK: tx pré-Fase-2 (transferDirection NULL) — heurística createdAt-ASC
      const group = transferGroups.get(tx.transferGroupId)
      if (!group || group.length !== 2) {
        // Par corrompido: skip pra não inflar/deflar saldo errado.
        continue
      }
      const isFromSide = group[0].id === tx.id
      const sign = isFromSide ? -1 : 1
      result.push({
        id: tx.id,
        date: tx.date,
        signedAmount: sign * tx.amount,
        rawType: 'TRANSFER',
      })
    }
    // Tipos desconhecidos são ignorados (defensivo)
  }

  return result
}
