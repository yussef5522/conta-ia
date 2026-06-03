// Sprint PF Fatia 3 — Histórico de imports OFX.

'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ImportItem {
  id: string
  status: string
  fileName: string
  fileSize: number
  totalTransactions: number
  newTransactions: number
  duplicates: number
  parcelasDetected: number
  invoicePaymentsSkipped: number
  detectedOrg: string | null
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
  revertedAt: string | null
  creditCard: { name: string; lastDigits: string | null } | null
}

const STATUS = {
  PROCESSING: { label: 'Processando', color: 'bg-blue-50 text-blue-700', icon: Clock },
  SUCCESS: { label: 'Importado', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  FAILED: { label: 'Falhou', color: 'bg-red-50 text-red-700', icon: XCircle },
  REVERTED: { label: 'Revertido', color: 'bg-zinc-100 text-zinc-700', icon: RotateCcw },
} as const

export default function ImportsHistoricoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [imports, setImports] = useState<ImportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [reverting, setReverting] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    fetch(`/api/perfis/${id}/ofx-import/historico`)
      .then((r) => r.json())
      .then((d) => setImports(d.imports ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [id])

  async function handleRevert(importId: string) {
    if (!confirm('Reverter import? Todas as transações importadas serão removidas.')) return
    setReverting(importId)
    try {
      await fetch(`/api/perfis/${id}/ofx-import/${importId}/reverter`, {
        method: 'POST',
      })
      reload()
    } finally {
      setReverting(null)
    }
  }

  return (
    <div>
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Histórico de imports</h1>
          <p className="text-sm text-zinc-600">Faturas OFX já importadas</p>
        </div>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link href={`/perfis/${id}/importar`}>+ Novo import</Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : imports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-zinc-600 mb-3">Nenhum import ainda</p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Link href={`/perfis/${id}/importar`}>Importar 1ª fatura</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {imports.map((imp) => {
            const st = STATUS[imp.status as keyof typeof STATUS] ?? STATUS.PROCESSING
            const Icon = st.icon
            return (
              <Card key={imp.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${st.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-zinc-900">{imp.fileName}</span>
                      <span className={`text-[10px] uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {imp.creditCard?.name}
                      {imp.creditCard?.lastDigits && ` ****${imp.creditCard.lastDigits}`}
                      {imp.detectedOrg && ` · ${imp.detectedOrg}`}
                      {imp.totalTransactions > 0 && ` · ${imp.newTransactions}/${imp.totalTransactions} importadas`}
                      {imp.parcelasDetected > 0 && ` · ${imp.parcelasDetected} parcelas`}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {new Date(imp.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {imp.status === 'SUCCESS' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevert(imp.id)}
                      disabled={reverting === imp.id}
                      className="text-red-700 border-red-200 hover:bg-red-50"
                    >
                      {reverting === imp.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1" /> Reverter
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
