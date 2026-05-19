'use client'

import Link from 'next/link'

export function NewCouponButton() {
  return (
    <Link
      href="/admin/cupons/novo"
      className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
      style={{
        background: '#fafafa',
        color: '#0a0a0a',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e5e5')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
    >
      + Novo cupom
    </Link>
  )
}
