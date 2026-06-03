// Sprint PF Fatia 4 — Badge anônimo/identificado pra tx PJ com ponte.
//
// 🔒 PRIVACIDADE MULTI-SÓCIO:
// - belongsToMe=true → mostra "🌉 Sua ponte" + link clicável
// - belongsToMe=false → mostra "🌉 Saída pareada com perfil PF de sócio"
//   anônimo, sem link.

'use client'

import Link from 'next/link'

interface Props {
  /** Esta tx PJ tem ponte? */
  hasBridge: boolean
  /** A ponte pertence ao user logado (dono do perfil OU criador)? */
  belongsToMe: boolean
  /** ID da bridge — só preenchido se belongsToMe=true (anonimização). */
  bridgeId?: string | null
  /** Modo compacto pra coluna de tabela */
  compact?: boolean
}

export function BridgeBadge({ hasBridge, belongsToMe, bridgeId, compact }: Props) {
  if (!hasBridge) return null

  if (belongsToMe && bridgeId) {
    return (
      <Link
        href={`/pontes/${bridgeId}`}
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
        title="Sua ponte ativa — clique pra ver"
      >
        <span>🌉</span>
        {!compact && <span>Sua ponte</span>}
      </Link>
    )
  }

  // belongsToMe=false → anônimo, sem link (privacidade)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
      title="Saída pareada com perfil PF de sócio. Detalhes privados ao sócio em questão."
    >
      <span>🌉</span>
      {!compact && <span>pareada com PF</span>}
    </span>
  )
}
