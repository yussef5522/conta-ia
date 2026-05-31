// Sprint Landing v2 Elite (30/05/2026) — Background animado mesh gradient.
// 3 blobs violeta que driftam em loop. Performático (GPU). 100% server.

interface MeshBgProps {
  variant?: 'light' | 'dark' | 'hero-immersive'
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
  const isDark = variant === 'dark' || variant === 'hero-immersive'
  const isImmersive = variant === 'hero-immersive'

  // Cores dos blobs por variante
  const blobs = isImmersive
    ? {
        b1: 'radial-gradient(circle, rgba(167, 139, 250, 0.85) 0%, transparent 70%)',
        b2: 'radial-gradient(circle, rgba(124, 58, 237, 0.90) 0%, transparent 70%)',
        b3: 'radial-gradient(circle, rgba(91, 33, 182, 0.70) 0%, transparent 70%)',
      }
    : isDark
      ? {
          b1: 'radial-gradient(circle, rgba(139, 92, 246, 0.55) 0%, transparent 70%)',
          b2: 'radial-gradient(circle, rgba(91, 33, 182, 0.65) 0%, transparent 70%)',
          b3: 'radial-gradient(circle, rgba(76, 29, 149, 0.50) 0%, transparent 70%)',
        }
      : {
          b1: 'radial-gradient(circle, rgba(167, 139, 250, 0.55) 0%, transparent 70%)',
          b2: 'radial-gradient(circle, rgba(196, 181, 253, 0.65) 0%, transparent 70%)',
          b3: 'radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, transparent 70%)',
        }

  const baseClass = isImmersive
    ? 'mesh-hero-immersive'
    : isDark
      ? 'mesh-dark'
      : 'mesh-hero'

  return (
    <div
      aria-hidden
      className={['absolute inset-0 -z-10 overflow-hidden', className].filter(Boolean).join(' ')}
    >
      <div className={`absolute inset-0 ${baseClass}`} />

      {/* Blobs animados (mais opacos no immersive) */}
      <div
        className={`absolute mesh-blob-1 rounded-full ${isImmersive ? 'opacity-90' : 'opacity-60'} blur-[100px]`}
        style={{
          top: isImmersive ? '-15%' : '-10%',
          left: isImmersive ? '-10%' : '-5%',
          width: '55vw',
          height: '55vw',
          background: blobs.b1,
        }}
      />
      <div
        className={`absolute mesh-blob-2 rounded-full ${isImmersive ? 'opacity-85' : 'opacity-50'} blur-[110px]`}
        style={{
          top: '15%',
          right: '-15%',
          width: '50vw',
          height: '50vw',
          background: blobs.b2,
        }}
      />
      <div
        className={`absolute mesh-blob-3 rounded-full ${isImmersive ? 'opacity-75' : 'opacity-45'} blur-[120px]`}
        style={{
          bottom: '-20%',
          left: isImmersive ? '15%' : '25%',
          width: '60vw',
          height: '60vw',
          background: blobs.b3,
        }}
      />

      {/* Corner glows extras pro immersive */}
      {isImmersive && (
        <>
          <div className="absolute top-0 left-0 w-[40vw] h-[40vh] hero-corner-glow-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[40vw] h-[40vh] hero-corner-glow-br pointer-events-none" />
        </>
      )}

      {grid && (
        <div
          className={[
            'absolute inset-0',
            isImmersive
              ? 'bg-grid-violet'
              : isDark
                ? 'bg-grid-dark'
                : 'bg-grid-light',
          ].join(' ')}
        />
      )}
      {noise && (
        <div className="absolute inset-0 bg-noise opacity-[0.04] mix-blend-overlay" />
      )}
    </div>
  )
}
