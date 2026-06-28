// Sprint Account Kind PJ/PF (27/06/2026, modelo QuickBooks/Wave/FreshBooks).
//
// CLASSIFICADOR de PARES de transferência. Decisão definitiva sobre o que
// fazer com um par (transferência interna vs aporte/retirada/patrimônio) é
// SEMPRE pelo accountKind das 2 contas, NUNCA pelo nome do banco/dono.
//
// Função PURA — sem Prisma, sem fetch. Caller passa o accountKind dos 2
// lados e o tipo (DEBIT/CREDIT) da tx ORIGEM (a que tava no preview /
// aguardando par). Função devolve a classificação.

export type AccountKind = 'PJ' | 'PF'

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  PJ: 'Pessoa Jurídica (empresa)',
  PF: 'Pessoa Física (dono)',
}

export type PairClassification =
  | { kind: 'TRANSFER_INTERNAL' }                 // PJ ↔ PJ — transferência interna fora do DRE
  | { kind: 'APORTE_CAPITAL'; sideReceiving: 'PJ' }   // PF → PJ — dinheiro entrou na PJ vindo da PF (patrimônio)
  | { kind: 'RETIRADA_LUCRO'; sideSending: 'PJ' }     // PJ → PF — dinheiro saiu da PJ pra PF (distribuição)
  | { kind: 'OUT_OF_SCOPE' }                       // PF ↔ PF — não é assunto desta empresa

/**
 * Classifica o par com base nos accountKinds dos 2 lados.
 *
 * @param originKind — accountKind da conta da tx que foi MARCADA como pendingTransfer (origin no preview)
 * @param originType — type da tx origin ('DEBIT' = saiu da origin; 'CREDIT' = entrou na origin)
 * @param pairKind   — accountKind da conta candidata (o par)
 */
export function classifyTransferPair(
  originKind: AccountKind | string,
  originType: 'DEBIT' | 'CREDIT' | string,
  pairKind: AccountKind | string,
): PairClassification {
  const o = (originKind === 'PF' ? 'PF' : 'PJ') as AccountKind
  const p = (pairKind === 'PF' ? 'PF' : 'PJ') as AccountKind

  // PJ + PJ → transferência interna (sai do DRE)
  if (o === 'PJ' && p === 'PJ') return { kind: 'TRANSFER_INTERNAL' }

  // PF + PF → não interessa pra DRE de NENHUMA empresa (privado)
  if (o === 'PF' && p === 'PF') return { kind: 'OUT_OF_SCOPE' }

  // PJ + PF: descobrir quem entrou e quem saiu.
  // originType=DEBIT  → saiu da origin
  // originType=CREDIT → entrou na origin
  const moneyLeftOrigin = originType === 'DEBIT'

  if (o === 'PJ') {
    // PJ origin
    if (moneyLeftOrigin) {
      // Saiu da PJ, foi pra PF → Retirada de Lucros / Pró-labore
      return { kind: 'RETIRADA_LUCRO', sideSending: 'PJ' }
    } else {
      // Entrou na PJ, vindo da PF → Aporte de Capital
      return { kind: 'APORTE_CAPITAL', sideReceiving: 'PJ' }
    }
  } else {
    // PF origin (caso simétrico)
    if (moneyLeftOrigin) {
      // Saiu da PF, foi pra PJ → Aporte de Capital (do ponto de vista da PJ)
      return { kind: 'APORTE_CAPITAL', sideReceiving: 'PJ' }
    } else {
      // Entrou na PF, vindo da PJ → Retirada de Lucros (do ponto de vista da PJ)
      return { kind: 'RETIRADA_LUCRO', sideSending: 'PJ' }
    }
  }
}

/** Helper de normalização. Aceita qualquer string mas devolve só PJ ou PF. */
export function normalizeAccountKind(raw: string | null | undefined): AccountKind {
  return raw === 'PF' ? 'PF' : 'PJ'
}
