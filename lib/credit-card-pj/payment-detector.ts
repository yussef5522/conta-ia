// Sprint Cartao R2 (24/06/2026) — detector de "tx parece pagamento de cartao".
//
// PURO, sem DB. Recebe description (e opcionalmente amount), retorna se a
// transacao parece ser pagamento de fatura de cartao. Usado em 2 lugares:
//   - HOOK no import OFX: marca isCardPayment=true (aguardando casar)
//   - DETECTOR no preview da fatura: lista candidatos pra reclassificar tx
//     ja existentes (caso real R$ 2.654,63)
//
// NUNCA bloqueia o import. Apenas SUGERE pra UI mostrar como "aguardando".

const POSITIVE_PATTERNS: RegExp[] = [
  /pagamento\s+(cartao|cartão|cart[aã]o\s+de\s+cr[eé]dito|fatura)/i,
  /pagto\s+(cartao|cartão|cart[aã]o)/i,
  /pag\.?\s+fatura/i,
  /pgto\.?\s+(cartao|cartão|fatura)/i,
  /quita[cç]ao\s+fatura/i,
  /^pagamento\s+cartao/i,
  /^pag(amento|to)\.?\s+cart[aã]o\s+de\s+cr[eé]dito/i,
]

const NEGATIVE_PATTERNS: RegExp[] = [
  // Recebimentos / estornos NAO sao pagamento DE cartao
  /estorno/i,
  /cashback/i,
  /reembolso/i,
  /receb[ie]mento\s+de\s+cart[aã]o/i,
  /credito\s+cart[aã]o/i,
]

export interface CardPaymentDetectorResult {
  /** true se parece pagamento de cartao */
  isLikely: boolean
  /** Confianca 0-1 */
  confidence: number
  /** Padrao que casou (pra debug) */
  matched?: string
}

export function detectCardPayment(input: {
  description: string
  type?: 'CREDIT' | 'DEBIT' | 'TRANSFER' | string
}): CardPaymentDetectorResult {
  const desc = (input.description ?? '').trim()
  if (desc.length === 0) return { isLikely: false, confidence: 0 }

  // CREDIT nunca eh pagamento (DEBIT sim — saida do banco)
  if (input.type === 'CREDIT') return { isLikely: false, confidence: 0 }

  for (const neg of NEGATIVE_PATTERNS) {
    if (neg.test(desc)) return { isLikely: false, confidence: 0, matched: neg.source }
  }

  for (const pos of POSITIVE_PATTERNS) {
    if (pos.test(desc)) {
      return { isLikely: true, confidence: 0.9, matched: pos.source }
    }
  }

  return { isLikely: false, confidence: 0 }
}
