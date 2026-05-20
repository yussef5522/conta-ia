// Helpers PUROS de UI pra fornecedores (Supplier) — Sprint 2.2.

export type SupplierFonte = 'MANUAL' | 'BRASILAPI' | 'CLAUDE'

export function fonteLabel(f: string): string {
  switch (f) {
    case 'BRASILAPI': return 'BrasilAPI'
    case 'CLAUDE': return 'IA'
    case 'MANUAL': return 'Manual'
    default: return f
  }
}

export function fonteColor(f: string): { bg: string; text: string } {
  switch (f) {
    case 'BRASILAPI':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' }
    case 'CLAUDE':
      return { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' }
    case 'MANUAL':
      return { bg: 'bg-zinc-500/10', text: 'text-zinc-600 dark:text-zinc-400' }
    default:
      return { bg: 'bg-zinc-500/10', text: 'text-zinc-500' }
  }
}

// Valida CNPJ via dígitos verificadores (algoritmo módulo 11).
export function isValidCNPJ(raw: string | null | undefined): boolean {
  if (!raw) return false
  const cnpj = String(raw).replace(/\D/g, '')
  if (cnpj.length !== 14) return false
  // Rejeita repetidos (00000000000000, 11111111111111, ...)
  if (/^(\d)\1+$/.test(cnpj)) return false

  const calc = (size: number) => {
    let sum = 0
    let pos = size - 7
    for (let i = size; i >= 1; i--) {
      sum += Number(cnpj[size - i]) * pos--
      if (pos < 2) pos = 9
    }
    const res = sum % 11
    return res < 2 ? 0 : 11 - res
  }

  const d1 = calc(12)
  if (d1 !== Number(cnpj[12])) return false
  const d2 = calc(13)
  if (d2 !== Number(cnpj[13])) return false
  return true
}

export function formatCNPJ(raw: string | null | undefined): string {
  if (!raw) return ''
  const cnpj = String(raw).replace(/\D/g, '')
  if (cnpj.length !== 14) return raw
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

export function unformatCNPJ(raw: string): string {
  return raw.replace(/\D/g, '')
}
