// Sprint Landing Page (30/05/2026) — Logo como componente React.
// Reimplementa /public/brand/logo-horizontal.svg pra permitir trocar cor
// do texto dinamicamente (header light vs footer dark).

interface LogoProps {
  variant?: 'dark-text' | 'light-text'
  className?: string
}

export function CaixaosLogo({ variant = 'dark-text', className }: LogoProps) {
  const textFill = variant === 'light-text' ? '#fafafa' : '#0f172a'
  return (
    <svg
      width="160"
      height="36"
      viewBox="0 0 280 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="CAIXAOS"
    >
      <g>
        <rect x="0" y="32" width="14" height="24" rx="2" fill="#7c3aed" />
        <rect x="20" y="18" width="14" height="38" rx="2" fill="#7c3aed" />
        <rect x="40" y="4" width="14" height="52" rx="2" fill="#7c3aed" />
      </g>
      <text
        x="74"
        y="46"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="38"
        fontWeight="500"
        fill={textFill}
        letterSpacing="-1.2"
      >
        CAIXAOS
      </text>
    </svg>
  )
}
