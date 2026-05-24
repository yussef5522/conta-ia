// Sprint 4.0.5.b — Transferências entry point global.
// TODO 4.0.5.c: refatorar page client pra aceitar empresaId via context.

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/lib/contexts/empresa-context'
import { NoEmpresaSelectedState } from '@/components/empresa/empty-empresa-state'

export default function TransferenciasGlobalPage() {
  const router = useRouter()
  const { currentEmpresaId, loading } = useEmpresa()

  useEffect(() => {
    if (!loading && currentEmpresaId) {
      router.replace(`/empresas/${currentEmpresaId}/transferencias`)
    }
  }, [currentEmpresaId, loading, router])

  if (loading) return <p className="text-sm text-zinc-500">Carregando…</p>
  if (!currentEmpresaId) return <NoEmpresaSelectedState />
  return null
}
