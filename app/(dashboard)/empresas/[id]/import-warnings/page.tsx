// Fase 4 — Tela de revisão dos warnings de duplicação pós-import.

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, X, Trash2, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import Link from 'next/link'

interface Warning {
  id: string
  similarity: number
  reason: string
  detectedAt: string
  bankAccount: { id: string; name: string }
  newTx: {
    id: string; amount: number; date: string; description: string;
    type: 'CREDIT' | 'DEBIT' | 'TRANSFER'; externalId: string | null; createdAt: string;
  }
  suspectedDup: {
    id: string; amount: number; date: string; description: string;
    type: 'CREDIT' | 'DEBIT' | 'TRANSFER'; externalId: string | null; createdAt: string;
  }
}

function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

export default function ImportWarningsPage() {
  const { id: empresaId } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const fetchWarnings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/import-warnings?empresaId=${empresaId}`, {
        credentials: 'include',
      })
      const data = await res.json()
      setWarnings(data.warnings ?? [])
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar warnings.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWarnings()
  }, [empresaId])

  async function handleDismiss(warningId: string) {
    setActing(warningId)
    try {
      const res = await fetch(`/api/import-warnings/${warningId}/dismiss`, {
        method: 'POST', credentials: 'include',
      })
      if (!res.ok) throw new Error('Erro')
      toast({ variant: 'success', title: 'Warning ignorado', description: 'Marcado como "não é duplicata".' })
      setWarnings((prev) => prev.filter((w) => w.id !== warningId))
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ignorar.' })
    } finally {
      setActing(null)
    }
  }

  async function handleResolveDelete(warningId: string) {
    if (!confirm('Deletar a transação nova e reverter o saldo? Esta ação NÃO pode ser desfeita.')) return
    setActing(warningId)
    try {
      const res = await fetch(`/api/import-warnings/${warningId}/resolve-delete`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro ?? 'Erro')
      toast({
        variant: 'success',
        title: 'Duplicata resolvida',
        description: `Tx deletada. Saldo revertido em ${fmtBRL(data.balanceReverted ?? 0)}.`,
      })
      setWarnings((prev) => prev.filter((w) => w.id !== warningId))
    } catch (e) {
      toast({
        variant: 'destructive', title: 'Erro',
        description: e instanceof Error ? e.message : 'Falha ao deletar.',
      })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href={`/empresas/${empresaId}`} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>

      <div className="flex items-center gap-3 border-b border-amber-200 pb-4">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
        <div>
          <h1 className="text-xl font-bold">Duplicações suspeitas</h1>
          <p className="text-sm text-slate-600">
            Detectadas pelo sistema após imports. Revise cada uma e decida.
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Carregando…</p>}

      {!loading && warnings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-slate-600">🎉 Nenhuma duplicação suspeita.</p>
          </CardContent>
        </Card>
      )}

      {warnings.map((w) => (
        <Card key={w.id} className="border-amber-200 bg-amber-50/50" data-testid={`warning-${w.id}`}>
          <CardContent className="space-y-4 py-4">
            <div className="text-sm text-amber-900">
              <p className="font-medium">⚠️ Possível duplicação ({Math.round(w.similarity * 100)}% similaridade)</p>
              <p className="mt-1 text-amber-800">{w.reason}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">Tx criada agora</p>
                <p className="font-semibold">
                  {w.newTx.type === 'CREDIT' ? '+' : '−'} {fmtBRL(w.newTx.amount)}
                </p>
                <p className="text-slate-600">{fmtData(w.newTx.date)}</p>
                <p className="mt-1 text-xs text-slate-700">{w.newTx.description}</p>
                {w.newTx.externalId && (
                  <p className="mt-1 text-xs text-slate-500">FITID: {w.newTx.externalId.slice(0, 16)}</p>
                )}
              </div>

              <div className="rounded border border-slate-200 bg-white p-3 text-sm">
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">Tx pré-existente</p>
                <p className="font-semibold">
                  {w.suspectedDup.type === 'CREDIT' ? '+' : '−'} {fmtBRL(w.suspectedDup.amount)}
                </p>
                <p className="text-slate-600">{fmtData(w.suspectedDup.date)}</p>
                <p className="mt-1 text-xs text-slate-700">{w.suspectedDup.description}</p>
                {w.suspectedDup.externalId && (
                  <p className="mt-1 text-xs text-slate-500">FITID: {w.suspectedDup.externalId.slice(0, 16)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline" size="sm"
                onClick={() => handleDismiss(w.id)}
                disabled={acting === w.id}
              >
                <X className="mr-2 h-4 w-4" /> Não é dup, ignorar
              </Button>
              <Button
                variant="destructive" size="sm"
                onClick={() => handleResolveDelete(w.id)}
                disabled={acting === w.id}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Sim, é dup — deletar a nova
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
