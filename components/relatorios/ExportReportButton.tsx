'use client'

// Sprint Export CSV+PDF (29/05/2026) — Dropdown CSV/PDF reusável.
//
// Genérico pros 8 relatórios. Recebe:
// - relatorio: tipo (string) — usado pra montar o path do endpoint
// - empresaId
// - filtrosQS: querystring (sem '?') dos filtros ATIVOS na tela
//
// Fluxo: fetch GET /api/empresas/{id}/relatorios/{relatorio}/export?{...}&format={csv|pdf}
// → blob → download via `<a download>` invisível.

import { useState } from 'react'
import { Download, Loader2, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'

export type ExportRelatorio =
  | 'comparativo'
  | 'analise-variacao'
  | 'dre'
  | 'fluxo-caixa'
  | 'categorias'
  | 'fornecedores'
  | 'funcionarios'
  | 'variancias'

interface Props {
  /** Tipo do relatório — define o path do endpoint */
  relatorio: ExportRelatorio
  empresaId: string
  /**
   * Query string com os filtros atuais da tela (SEM o '?' inicial).
   * Endpoint adiciona `format=csv|pdf` em cima.
   */
  filtrosQS: string
  disabled?: boolean
}

// Path do endpoint de export por tipo (DRE fica em /dre/export, não /relatorios/dre)
const EXPORT_PATH: Record<ExportRelatorio, string> = {
  comparativo: 'relatorios/comparativo',
  'analise-variacao': 'relatorios/analise-variacao',
  dre: 'dre',
  'fluxo-caixa': 'relatorios/fluxo-caixa',
  categorias: 'relatorios/categorias',
  fornecedores: 'relatorios/fornecedores',
  funcionarios: 'relatorios/funcionarios',
  variancias: 'relatorios/variancias',
}

export function ExportReportButton({
  relatorio,
  empresaId,
  filtrosQS,
  disabled,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<'csv' | 'pdf' | null>(null)

  async function download(format: 'csv' | 'pdf') {
    if (!empresaId) return
    setLoading(format)
    try {
      const params = new URLSearchParams(filtrosQS)
      params.set('format', format)
      const path = EXPORT_PATH[relatorio]
      const url = `/api/empresas/${empresaId}/${path}/export?${params.toString()}`
      const res = await fetch(url, { credentials: 'include' })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha no export',
          description: errBody?.error ?? `HTTP ${res.status}`,
        })
        return
      }

      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `${relatorio}-${Date.now()}.${format}`
      const rowCount = res.headers.get('x-row-count') ?? '?'

      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      toast({
        title: `${format.toUpperCase()} exportado`,
        description: `${rowCount} linhas em ${filename}`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro de rede',
        description: 'Tente novamente.',
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || loading !== null}
          data-testid="export-report-button"
        >
          {loading !== null ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => download('csv')}
          disabled={loading !== null}
          data-testid="export-csv"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => download('pdf')}
          disabled={loading !== null}
          data-testid="export-pdf"
        >
          <FileText className="mr-2 h-4 w-4" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
