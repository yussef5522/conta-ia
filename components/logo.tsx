// Logo CAIXAOS — componente reutilizável (Sprint 1.2 — wordmark atualizado
// Sprint Brand CAIXAOS 29/05/2026 mantendo o SVG legado azul Foundation).
// SVG "Chart": 4 barras crescentes (3 brand-light + 1 success-light) com
// círculo de "data point" no topo da barra mais alta.
//
// Usado em: header dashboard antigo, email templates, exports, páginas
// de erro. Login agora usa /brand/logo-vertical.svg direto.

import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  textColor?: string
  className?: string
}

const SIZE_MAP = {
  sm: { svg: 24, text: 14 },
  md: { svg: 40, text: 17 },
  lg: { svg: 56, text: 22 },
} as const

export function Logo({
  size = 'md',
  showText = true,
  textColor = '#0C447C',
  className,
}: LogoProps) {
  const { svg: svgSize, text: textSize } = SIZE_MAP[size]

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 36 36"
        fill="none"
        aria-label="Logo CAIXAOS"
        role="img"
      >
        <rect width="36" height="36" rx="9" fill="#0C447C" />
        <rect x="9" y="22" width="3.5" height="6" rx="1" fill="#85B7EB" />
        <rect x="14.5" y="17" width="3.5" height="11" rx="1" fill="#85B7EB" />
        <rect x="20" y="13" width="3.5" height="15" rx="1" fill="#85B7EB" />
        <rect x="25.5" y="9" width="3.5" height="19" rx="1" fill="#5DCAA5" />
        <circle
          cx="27.25"
          cy="9"
          r="2.5"
          fill="#9FE1CB"
          stroke="#0C447C"
          strokeWidth="1.5"
        />
      </svg>
      {showText && (
        <span
          className="font-medium tracking-tight"
          style={{ fontSize: textSize, color: textColor, letterSpacing: '-0.2px' }}
        >
          CAIXAOS
        </span>
      )}
    </div>
  )
}
