'use client'

// Sprint 5.0.3.0b — Botão "Exportar CSV" com loading state.
//
// Constrói URL com mesmos filtros da página + dispara download via
// `<a href download>` invisível (sem fetch JS — browser baixa direto).

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

interface Props {
  empresaId: string
  /** Query string COMPLETA (sem ?) com os filtros aplicados. */
  filtersQS: string
  /** Se preenchido, exporta SÓ essas IDs (bulk selection). */
  selectedIds?: string[]
  disabled?: boolean
}

export function ExportButton({
  empresaId,
  filtersQS,
  selectedIds,
  disabled,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const hasSelection = selectedIds && selectedIds.length > 0

  async function download() {
    if (!empresaId) return
    setLoading(true)
    try {
      const params = new URLSearchParams(filtersQS)
      params.set('empresaId', empresaId)
      if (hasSelection) {
        params.set('transactionIds', selectedIds.join(','))
      }

      const url = `/api/empresas/${empresaId}/contas-pagar/export?${params.toString()}`
      const res = await fetch(url, { credentials: 'include' })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha no export',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }

      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `contas-pagar-${Date.now()}.csv`
      const rowCount = res.headers.get('x-row-count') ?? '?'

      // Download via blob URL — preserva BOM/encoding
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      toast({
        title: 'CSV exportado',
        description: `${rowCount} contas em ${filename}`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={download}
      disabled={loading || disabled}
      data-testid="export-csv-button"
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-3.5 w-3.5" />
      )}
      {hasSelection
        ? `Exportar ${selectedIds.length} ${selectedIds.length === 1 ? 'selecionada' : 'selecionadas'}`
        : 'Exportar CSV'}
    </Button>
  )
}
