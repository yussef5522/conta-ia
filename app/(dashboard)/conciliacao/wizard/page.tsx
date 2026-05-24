'use client'

// Sprint 4.0.2 — Wizard pós-import OFX.
// Chama /api/conciliacao/scan-by-import, mostra sugestões agrupadas por
// recomendação (AUTO marcadas, CONFIRM revisão), confirma em bulk.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, CheckCircle2, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { MatchCard } from '@/components/conciliacao/match-card'

interface Suggestion {
  ofxTransaction: {
    id: string
    description: string
    amount: number
    date: string
    type: string
  }
  topMatch: {
    candidateId: string
    score: number
    breakdown: { amount: number; date: number; supplier: number; description: number }
    reasoning: string[]
    candidate: {
      id: string
      description: string
      amount: number
      dueDate: string | null
      lifecycle: string
    }
  }
  recommendation: 'AUTO_RECONCILE' | 'CONFIRM' | 'NO_MATCH'
}

export default function WizardConciliacaoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <WizardInner />
    </Suspense>
  )
}

function WizardInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const importId = searchParams.get('importId')

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!importId) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/conciliacao/scan-by-import', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.suggestions) {
          const list: Suggestion[] = data.suggestions
          setSuggestions(list)
          // Pré-seleciona AUTO_RECONCILE
          const preSelected = new Set(
            list
              .filter((s) => s.recommendation === 'AUTO_RECONCILE')
              .map((s) => s.ofxTransaction.id),
          )
          setSelected(preSelected)
        }
      })
      .finally(() => setLoading(false))
  }, [importId])

  function toggleOne(ofxId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ofxId)) next.delete(ofxId)
      else next.add(ofxId)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === suggestions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(suggestions.map((s) => s.ofxTransaction.id)))
    }
  }

  async function confirmar() {
    const pairs = suggestions
      .filter((s) => selected.has(s.ofxTransaction.id))
      .map((s) => ({
        ofxTransactionId: s.ofxTransaction.id,
        candidateId: s.topMatch.candidateId,
      }))

    if (pairs.length === 0) {
      toast({ title: 'Nenhuma seleção', description: 'Marque ao menos 1 sugestão.' })
      return
    }

    setConfirming(true)
    try {
      const res = await fetch('/api/conciliacao/bulk-confirmar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({
        title: `${data.reconciled} conciliada${data.reconciled === 1 ? '' : 's'}`,
        description: data.failed > 0 ? `${data.failed} falharam` : undefined,
      })
      router.push('/transacoes')
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setConfirming(false)
    }
  }

  if (!importId) {
    return (
      <div className="space-y-6">
        <Header title="Conciliação" description="importId não fornecido na URL" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Use `/conciliacao/wizard?importId=xxx` após um import OFX.
          </CardContent>
        </Card>
      </div>
    )
  }

  const autoCount = suggestions.filter((s) => s.recommendation === 'AUTO_RECONCILE').length
  const confirmCount = suggestions.filter((s) => s.recommendation === 'CONFIRM').length

  return (
    <div className="space-y-6">
      <Header
        title="Conciliação Sugerida"
        description={
          loading
            ? 'Analisando transações…'
            : `${suggestions.length} sugestão${suggestions.length === 1 ? '' : 'es'} (${autoCount} auto · ${confirmCount} pra confirmar)`
        }
      >
        <Button size="sm" variant="outline" asChild>
          <Link href="/transacoes">
            <SkipForward className="mr-1.5 h-3.5 w-3.5" />
            Pular
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={confirmar}
          disabled={confirming || selected.size === 0}
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          {confirming ? 'Conciliando…' : `Confirmar ${selected.size} selecionada${selected.size === 1 ? '' : 's'}`}
        </Button>
      </Header>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-2 animate-pulse" />
            Calculando matches…
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-600" />
            <p>Nenhuma sugestão de conciliação. Todas as transações são únicas.</p>
            <Button size="sm" variant="link" asChild className="mt-3">
              <Link href="/transacoes">Ver transações</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Toggle all */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <button
              type="button"
              onClick={toggleAll}
              className="hover:text-foreground transition-colors"
            >
              {selected.size === suggestions.length ? 'Desmarcar tudo' : 'Selecionar tudo'}
            </button>
            <span>{selected.size}/{suggestions.length} selecionada{selected.size === 1 ? '' : 's'}</span>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {suggestions.map((s) => (
              <MatchCard
                key={s.ofxTransaction.id}
                ofx={s.ofxTransaction}
                candidate={s.topMatch.candidate}
                score={s.topMatch.score}
                reasoning={s.topMatch.reasoning}
                selected={selected.has(s.ofxTransaction.id)}
                onToggle={() => toggleOne(s.ofxTransaction.id)}
                recommendation={s.recommendation}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
