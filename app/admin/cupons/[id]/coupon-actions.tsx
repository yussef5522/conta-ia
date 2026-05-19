'use client'

// Ações de pausar/reativar/desativar cupom — Sprint 1.7.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  couponId: string
  status: string
}

export function CouponActions({ couponId, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function call(action: 'pause' | 'resume' | 'delete') {
    if (action === 'delete') {
      if (
        !confirm(
          'Desativar este cupom? Tentativas futuras de resgate serão rejeitadas.\n\nResgates passados ficam preservados.',
        )
      ) {
        return
      }
    }
    setBusy(action)
    setErro(null)
    try {
      const method = action === 'delete' ? 'DELETE' : 'POST'
      const url =
        action === 'delete'
          ? `/api/admin/coupons/${couponId}`
          : `/api/admin/coupons/${couponId}/${action}`
      const res = await fetch(url, { method })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setErro(data.erro ?? 'Falha na operação.')
        setBusy(null)
        return
      }
      router.refresh()
    } catch {
      setErro('Falha de rede. Tente de novo.')
    } finally {
      setBusy(null)
    }
  }

  const btnBase = 'text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50'

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === 'ACTIVE' && (
        <button
          onClick={() => call('pause')}
          disabled={busy !== null}
          className={btnBase}
          style={{
            background: 'rgba(239, 159, 39, 0.10)',
            border: '1px solid rgba(239, 159, 39, 0.35)',
            color: '#EF9F27',
          }}
        >
          {busy === 'pause' ? 'Pausando...' : 'Pausar'}
        </button>
      )}
      {status === 'PAUSED' && (
        <button
          onClick={() => call('resume')}
          disabled={busy !== null}
          className={btnBase}
          style={{
            background: 'rgba(29, 158, 117, 0.10)',
            border: '1px solid rgba(29, 158, 117, 0.35)',
            color: '#5DCAA5',
          }}
        >
          {busy === 'resume' ? 'Reativando...' : 'Reativar'}
        </button>
      )}
      {status !== 'DEACTIVATED' && (
        <button
          onClick={() => call('delete')}
          disabled={busy !== null}
          className={btnBase}
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
          }}
        >
          {busy === 'delete' ? 'Desativando...' : 'Desativar'}
        </button>
      )}

      {erro && (
        <span
          className="text-xs"
          style={{ color: '#fca5a5' }}
        >
          {erro}
        </span>
      )}
    </div>
  )
}
