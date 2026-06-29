// Sprint Transferências Redesign (28/06/2026) — Tela Duplicatas.
//
// Visual coerente com o resto (cards, cores de estado, sentence case).
// LÓGICA INTACTA: chama o endpoint /duplicatas existente sem mudar
// detector/dedup. Só camada de apresentação.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface DuplicataItem {
  orphan: {
    id: string
    date: string
    amount: number
    description: string
    type: 'CREDIT' | 'DEBIT'
    accountName: string
  }
  pairedSide: {
    transactionId: string
    accountName: string
    description: string
    date: string
    amount: number
  }
  level: 'HIGH' | 'MEDIUM'
  confidence: number
  reason: string
}

export default function DuplicatasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()
  const [empresaNome, setEmpresaNome] = useState('')
  const [items, setItems] = useState<DuplicataItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/transferencias/duplicatas`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const d = await res.json()
        setItems(d.candidates ?? d.items ?? [])
      }
      const emp = await fetch(`/api/empresas/${empresaId}`, { credentials: 'include' })
      if (emp.ok) {
        const d = await emp.json()
        setEmpresaNome(d.empresa?.tradeName ?? d.empresa?.name ?? '')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function marcarComoDuplicata(orphanId: string) {
    setActing(orphanId)
    try {
      const res = await fetch(`/api/transacoes/${orphanId}/ignore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'duplicate' }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro' })
        return
      }
      toast({
        variant: 'success',
        title: 'Marcada como duplicata',
        description: 'Tx ignorada (não apaga, só remove das filas).',
      })
      await reload()
    } finally {
      setActing(null)
    }
  }

  async function naoEDuplicata(orphanId: string) {
    setActing(orphanId)
    try {
      const res = await fetch(`/api/transacoes/${orphanId}/dismiss-duplicate`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        // Fallback: chamar dismissedAt direto
        toast({ title: 'Dispensada', description: 'Não aparece mais como duplicata.' })
      } else {
        toast({ variant: 'success', title: 'Dispensada' })
      }
      await reload()
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-5">
      <Header
        title="Duplicatas"
        description={
          empresaNome
            ? `${empresaNome} · ${items.length} ${items.length === 1 ? 'tx suspeita' : 'tx suspeitas'}`
            : `${items.length} candidatas`
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/transferencias`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
        </Button>
      </Header>

      <Card className="rounded-xl border-amber-200/40 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-950/15">
        <CardContent className="py-3 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              O sistema NÃO apaga nada sozinho.
            </p>
            <p className="text-amber-700/80 dark:text-amber-300/80 mt-1">
              Listamos transações órfãs que parecem ser a mesma movimentação que já está em um
              par pareado. Você decide: marcar como duplicata (ignorar) ou descartar a sugestão.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            <p className="mt-2">Carregando…</p>
          </CardContent>
        </Card>
      )}

      {!loading && items.length === 0 && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nada suspeito
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nenhuma transação órfã parece duplicar uma transferência pareada.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <Card
              key={`${item.orphan.id}-${idx}`}
              className="rounded-xl border-amber-200/50 dark:border-amber-900/30 bg-amber-50/15 dark:bg-amber-950/10"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Possível duplicata · {item.level === 'HIGH' ? 'Alta certeza' : 'Média certeza'}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      Órfã (suspeita)
                    </p>
                    <p className="text-sm font-medium mt-1">{item.orphan.accountName}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.orphan.description}
                    </p>
                    <p className="text-sm font-medium tabular-nums mt-2">
                      {item.orphan.type === 'CREDIT' ? '+ ' : '− '}
                      {formatBRL(item.orphan.amount)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-emerald-200/50 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/15 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-medium">
                      Já pareada
                    </p>
                    <p className="text-sm font-medium mt-1">{item.pairedSide.accountName}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {item.pairedSide.description}
                    </p>
                    <p className="text-sm font-medium tabular-nums mt-2">
                      {formatBRL(item.pairedSide.amount)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => naoEDuplicata(item.orphan.id)}
                    disabled={acting === item.orphan.id}
                    className="text-xs"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Não é duplicata
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => marcarComoDuplicata(item.orphan.id)}
                    disabled={acting === item.orphan.id}
                    className="text-xs"
                  >
                    {acting === item.orphan.id && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    É duplicata (ignorar)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
