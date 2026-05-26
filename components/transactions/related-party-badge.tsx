// Sprint 5.0.2.j — Badge visual de Pix relacionado / transferência interna.
//
// 3 tipos:
//   - 🔗 Conta Própria (ciano): transferência entre contas da mesma empresa
//   - 👤 Sócio (âmbar): Pix pra CPF cadastrado
//   - 🏢 Grupo (azul): Pix pra empresa relacionada (com 🔗 anexo se conciliada)

import { Badge } from '@/components/ui/badge'

interface RelatedPartyBadgeProps {
  relatedPartyType?: string | null
  isInternalTransfer?: boolean
  className?: string
}

export function RelatedPartyBadge({
  relatedPartyType,
  isInternalTransfer,
  className,
}: RelatedPartyBadgeProps) {
  // 1. Transferência entre contas da MESMA empresa (Sprint 5.0.2.j)
  if (isInternalTransfer && !relatedPartyType) {
    return (
      <Badge
        variant="outline"
        title="Transferência entre contas da mesma empresa — conciliada automaticamente"
        className={
          'bg-cyan-50 text-cyan-700 border-cyan-200 ' + (className ?? '')
        }
      >
        🔗 Conta Própria
      </Badge>
    )
  }

  // 2. Sócio PF
  if (relatedPartyType === 'SOCIO_PF') {
    return (
      <Badge
        variant="outline"
        title="Pix para sócio — Distribuição de Lucros / Pró-labore"
        className={
          'bg-amber-50 text-amber-700 border-amber-200 ' + (className ?? '')
        }
      >
        👤 Sócio
      </Badge>
    )
  }

  // 3. Grupo PJ
  if (relatedPartyType === 'GRUPO_PJ') {
    return (
      <Badge
        variant="outline"
        title={
          isInternalTransfer
            ? 'Transferência entre empresas do grupo — conciliada bilateralmente'
            : 'Pix para empresa do grupo'
        }
        className={
          'bg-blue-50 text-blue-700 border-blue-200 ' + (className ?? '')
        }
      >
        🏢 Grupo{isInternalTransfer ? ' 🔗' : ''}
      </Badge>
    )
  }

  return null
}
