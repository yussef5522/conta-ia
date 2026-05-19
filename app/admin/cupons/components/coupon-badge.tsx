// Badge dark de status pra lista/detalhe de cupons — Sprint 1.7.

import { couponStatusColor, couponStatusLabel } from '@/lib/coupons/format'

export function CouponStatusBadge({ status }: { status: string }) {
  const c = couponStatusColor(status)
  return (
    <span
      className="inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
      }}
    >
      {couponStatusLabel(status)}
    </span>
  )
}
