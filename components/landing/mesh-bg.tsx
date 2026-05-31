// Sprint Landing v2 Elite (30/05/2026) — Background animado mesh gradient.
// 3 blobs violeta que driftam em loop. Performático (GPU). 100% server.

interface MeshBgProps {
  variant?: 'light' | 'dark'
  /** Mostra grid sutil por cima. */
  grid?: boolean
  /** Mostra noise texture (luxo). */
  noise?: boolean
  className?: string
}

export function MeshBg({
  variant = 'light',
  grid = false,
  noise = false,
  className,
}: MeshBgProps) {
  const isDark = variant === 'dark'
  return (
    <div
      aria-hidden
      className={['absolute inset-0 -z-10 overflow-hidden', className].filter(Boolean).join(' ')}
    >
      {/* Base color */}
      <div className={isDark ? 'absolute inset-0 mesh-dark' : 'absolute inset-0 mesh-hero'} />

      {/* Blobs animados */}
      <div
        className="absolute mesh-blob-1 rounded-full opacity-60 blur-[100px]"
        style={{
          top: '-10%',
          left: '-5%',
          width: '50vw',
          height: '50vw',
          background: isDark
            ? 'radial-gradient(circle, rgba(139, 92, 246, 0.55) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(167, 139, 250, 0.55) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute mesh-blob-2 rounded-full opacity-50 blur-[110px]"
        style={{
          top: '20%',
          right: '-10%',
          width: '45vw',
          height: '45vw',
          background: isDark
            ? 'radial-gradient(circle, rgba(91, 33, 182, 0.65) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(196, 181, 253, 0.65) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute mesh-blob-3 rounded-full opacity-45 blur-[120px]"
        style={{
          bottom: '-15%',
          left: '25%',
          width: '55vw',
          height: '55vw',
          background: isDark
            ? 'radial-gradient(circle, rgba(76, 29, 149, 0.50) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, transparent 70%)',
        }}
      />

      {grid && (
        <div className={isDark ? 'absolute inset-0 bg-grid-dark' : 'absolute inset-0 bg-grid-light'} />
      )}
      {noise && (
        <div className="absolute inset-0 bg-noise opacity-[0.035] mix-blend-overlay" />
      )}
    </div>
  )
}
