'use client'

// Sprint TransferSuggestionEvent (13/08) — "voltar atrás": sugestões de
// transferência que você IGNorou, com opção de ver de novo. Não é porta sem volta.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftRight, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface TxView { date: string; amount: number; type: string; description: string; account: string | null }
interface Item { id: string; layer: string | null; confidence: number | null; evidences: string[]; ignoradoEm: string | null; debito: TxView | null; credito: TxView | null }

export default function IgnoradasPage() {
  const { id: empresaId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [itens, setItens] = useState<Item[] | null>(null)
  const [revertingId, setRevertingId] = useState<string | null>(null)

  const load = () => {
    fetch(`/api/empresas/${empresaId}/transferencias/ignoradas`)
      .then((r) => (r.ok ? r.json() : { itens: [] }))
      .then((d) => setItens(d.itens ?? []))
      .catch(() => setItens([]))
  }
  useEffect(load, [empresaId])

  async function reverter(id: string) {
    setRevertingId(id)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/transferencias/ignoradas/${id}/reverter`, { method: 'POST' })
      if (r.ok) {
        toast({ variant: 'success', title: 'Sugestão restaurada', description: 'Vai voltar a aparecer no banner de Pendentes.' })
        setItens((prev) => (prev ? prev.filter((i) => i.id !== id) : prev))
      } else {
        toast({ variant: 'destructive', title: 'Falha ao restaurar' })
      }
    } finally {
      setRevertingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Transferências ignoradas</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Pares que você recusou no banner de Pendentes. Eles não aparecem mais lá —
        mas se ignorou por engano, clique em <b>Ver de novo</b> pra restaurar.
      </p>

      {!itens ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">Nenhuma sugestão ignorada. Quando você recusar um par no banner, ele aparece aqui.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border">
          {itens.map((i) => (
            <li key={i.id} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {i.layer && <span className="rounded-full bg-slate-100 px-2 py-0.5">{i.layer}{typeof i.confidence === 'number' ? ` · ${Math.round(i.confidence * 100)}%` : ''}</span>}
                  {i.ignoradoEm && <span>ignorado em {i.ignoradoEm.slice(0, 10).split('-').reverse().join('/')}</span>}
                </div>
                {i.debito && <p className="mt-1 truncate">− {formatBRL(i.debito.amount)} · {i.debito.account} · {i.debito.description}</p>}
                {i.credito && <p className="truncate">+ {formatBRL(i.credito.amount)} · {i.credito.account} · {i.credito.description}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => reverter(i.id)} disabled={revertingId === i.id}>
                {revertingId === i.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Ver de novo</>}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Link href={`/empresas/${empresaId}/pendentes`} className="text-sm text-primary underline">← Voltar pra Pendentes</Link>
    </div>
  )
}
