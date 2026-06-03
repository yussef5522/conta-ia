// Sprint PF Fatia 3 — Detecção de parcelamento no MEMO.
//
// Casos reais do OFX Nubank Yussef:
//   "Airbnb * Hm9z23za5s - Parcela 5/6"
//   "Laghetto Golden - Parcela 4/9"
//   "Mercadolivre*Rgs - Parcela 5/10"

export interface InstallmentDetection {
  isInstallment: boolean
  installmentNumber?: number
  installmentTotal?: number
  /** Descrição base sem o sufixo "Parcela X/Y" — usa pra match/dedup */
  baseDescription?: string
}

// Ordem: mais específica primeiro.
const PATTERNS: Array<RegExp> = [
  // "- Parcela 5/6" (Nubank padrão)
  /\s*-\s*Parcela\s+(\d+)\/(\d+)\s*$/i,
  // "Parcela 5/6" (sem hífen)
  /\s+Parcela\s+(\d+)\/(\d+)\s*$/i,
  // "Parc. 5/6"
  /\s+Parc\.?\s+(\d+)\/(\d+)\s*$/i,
  // "(5/6)" no fim
  /\s*\((\d+)\/(\d+)\)\s*$/,
  // "5 de 6 x" / "5x de 6"
  /\s+(\d+)\s+de\s+(\d+)\s*x\s*$/i,
]

export function detectInstallment(memo: string): InstallmentDetection {
  if (!memo || typeof memo !== 'string') return { isInstallment: false }

  for (const pattern of PATTERNS) {
    const m = memo.match(pattern)
    if (!m) continue
    const num = Number.parseInt(m[1], 10)
    const total = Number.parseInt(m[2], 10)
    if (!Number.isFinite(num) || !Number.isFinite(total)) continue
    if (num < 1 || total < 1 || num > total || total > 99) continue
    const baseDescription = memo.replace(pattern, '').trim()
    return {
      isInstallment: true,
      installmentNumber: num,
      installmentTotal: total,
      baseDescription,
    }
  }

  return { isInstallment: false }
}
