// Helpers PUROS de formatação de cupom pra UI — Sprint 1.7.

import type { CouponType, CouponStatus } from './types'

// Formata valor pra exibição: "100%" / "R$ 50,00" / "3 meses grátis"
export function formatCouponValue(
  type: string,
  value: number | string,
  freeMonths: number | null | undefined,
): string {
  if (type === 'FREE_MONTHS') {
    const m = freeMonths ?? 0
    return m === 1 ? '1 mês grátis' : `${m} meses grátis`
  }
  const n = typeof value === 'string' ? Number(value) : value
  if (type === 'PERCENTAGE') {
    // Formato compacto: 100% ou 25.5%
    return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`
  }
  if (type === 'FIXED_AMOUNT') {
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }
  return String(value)
}

// Label pt-BR pra cada tipo (dropdown / labels)
export function couponTypeLabel(type: string): string {
  switch (type) {
    case 'PERCENTAGE':
      return 'Porcentagem'
    case 'FIXED_AMOUNT':
      return 'Valor fixo'
    case 'FREE_MONTHS':
      return 'Meses grátis'
    default:
      return type
  }
}

// Label pt-BR de status
export function couponStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Ativo'
    case 'PAUSED':
      return 'Pausado'
    case 'EXPIRED':
      return 'Expirado'
    case 'EXHAUSTED':
      return 'Exaurido'
    case 'DEACTIVATED':
      return 'Desativado'
    default:
      return status
  }
}

// Cor dark mode pro badge de status
export function couponStatusColor(status: string): {
  bg: string
  border: string
  text: string
} {
  switch (status) {
    case 'ACTIVE':
      return {
        bg: 'rgba(29, 158, 117, 0.10)',
        border: 'rgba(29, 158, 117, 0.35)',
        text: '#5DCAA5',
      }
    case 'PAUSED':
      return {
        bg: 'rgba(239, 159, 39, 0.10)',
        border: 'rgba(239, 159, 39, 0.35)',
        text: '#EF9F27',
      }
    case 'EXPIRED':
    case 'EXHAUSTED':
      return {
        bg: 'rgba(115, 115, 115, 0.10)',
        border: 'rgba(115, 115, 115, 0.30)',
        text: '#a3a3a3',
      }
    case 'DEACTIVATED':
      return {
        bg: 'rgba(239, 68, 68, 0.10)',
        border: 'rgba(239, 68, 68, 0.30)',
        text: '#fca5a5',
      }
    default:
      return {
        bg: 'rgba(115, 115, 115, 0.10)',
        border: 'rgba(115, 115, 115, 0.30)',
        text: '#a3a3a3',
      }
  }
}

// "currentUses / maxUses ou ∞"
export function formatUsage(currentUses: number, maxUses: number | null): string {
  if (maxUses === null || maxUses === undefined) return `${currentUses} / ∞`
  return `${currentUses} / ${maxUses}`
}

// Cor dark accent por TIPO
export function couponTypeColor(type: string): { bg: string; text: string } {
  switch (type) {
    case 'PERCENTAGE':
      return { bg: 'rgba(99, 102, 241, 0.10)', text: '#a5b4fc' }
    case 'FIXED_AMOUNT':
      return { bg: 'rgba(34, 197, 94, 0.10)', text: '#86efac' }
    case 'FREE_MONTHS':
      return { bg: 'rgba(168, 85, 247, 0.10)', text: '#d8b4fe' }
    default:
      return { bg: 'rgba(115, 115, 115, 0.10)', text: '#a3a3a3' }
  }
}

// Helper pro front: type-check com fallback
export function isKnownCouponType(t: string): t is CouponType {
  return t === 'PERCENTAGE' || t === 'FIXED_AMOUNT' || t === 'FREE_MONTHS'
}

export function isKnownCouponStatus(s: string): s is CouponStatus {
  return ['ACTIVE', 'PAUSED', 'EXPIRED', 'EXHAUSTED', 'DEACTIVATED'].includes(s)
}
