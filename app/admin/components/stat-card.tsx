// StatCard dark — Sprint 1.6.
// Vibe Linear: number grande, label discreto, sparkline opcional futuro.

interface StatCardProps {
  label: string
  value: string | number
  hint?: string
  accent?: string // '#185FA5' (brand) | '#5DCAA5' (success) | '#525252' (neutral)
}

export function StatCard({
  label,
  value,
  hint,
  accent = '#185FA5',
}: StatCardProps) {
  return (
    <div
      className="rounded-md p-5"
      style={{
        background: '#0f0f0f',
        border: '1px solid #1f1f1f',
      }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.18em] mb-2"
        style={{ color: '#737373' }}
      >
        {label}
      </p>
      <p
        className="text-3xl font-medium tracking-tight tabular-nums"
        style={{ color: '#fafafa' }}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[11px] mt-2" style={{ color: accent }}>
          {hint}
        </p>
      )}
    </div>
  )
}
