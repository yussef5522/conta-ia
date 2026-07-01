'use client'

// Sprint Fluxo-Unificado-Retirada (30/06/2026) — Aba "Retiradas pendentes"
// dentro de /empresas/[id]/socios. Design nível Mercury/Ramp/Linear.
//
// Estrutura visual (topo → base):
//   1. Hero: número grande do total (R$) + contador de retiradas + subtítulo
//   2. Lista de cards premium (1 por retirada) com botão principal "Enviar ao PF"
//   3. Estados: loading skeleton · erro · vazio bonito ("Tudo em dia")
//
// Comportamento:
//   - Clica "Enviar ao PF" → modal com NovaPonteForm PRÉ-PREENCHIDO
//     (tx + perfil + conta + categoria via /ultima-ponte-destino)
//   - Após criar: card sai da lista com transição suave, contador decrementa,
//     toast discreto, refetch em background.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { NovaPonteForm } from '@/components/bridges/NovaPonteForm'
import type {
  RetiradaPendente,
  RetiradasPendentesResponse,
} from '@/app/api/empresas/[id]/retiradas-pendentes/route'
import type { UltimaPonteDestino } from '@/app/api/empresas/[id]/socios/[socioId]/ultima-ponte-destino/route'

interface Props {
  empresaId: string
  /** SocioPF default (usado pra sugestão). Se >1 sócio, pode ficar null e
   *  o form pergunta. Se 1 só (Cacula), passa direto. */
  defaultSocioPFId?: string | null
}

/** Formata data ISO pra "22/06 · Ter" ou "hoje" / "ontem". */
function formatDateSmart(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function RetiradasPendentesTab({ empresaId, defaultSocioPFId }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<RetiradasPendentesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTx, setSelectedTx] = useState<RetiradaPendente | null>(null)
  const [sugestao, setSugestao] = useState<UltimaPonteDestino | null>(null)
  // Set de ids sendo removidos (animação de saída) — evita layout jump antes do refetch.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/retiradas-pendentes`, {
        credentials: 'include',
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j: RetiradasPendentesResponse = await r.json()
      setData(j)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    load()
  }, [load])

  // Ao abrir modal, busca sugestão (última ponte deste sócio).
  const handleOpenModal = useCallback(
    async (tx: RetiradaPendente) => {
      setSelectedTx(tx)
      setSugestao(null)
      if (!defaultSocioPFId) return
      try {
        const r = await fetch(
          `/api/empresas/${empresaId}/socios/${defaultSocioPFId}/ultima-ponte-destino`,
          { credentials: 'include' },
        )
        if (r.ok) {
          const j: UltimaPonteDestino = await r.json()
          setSugestao(j)
        }
      } catch {
        // Sem sugestão → user escolhe manualmente. Sem barra de erro por isso.
      }
    },
    [empresaId, defaultSocioPFId],
  )

  const handleClose = useCallback(() => {
    setSelectedTx(null)
    setSugestao(null)
  }, [])

  const handleBridgeCreated = useCallback(
    (_bridgeId: string) => {
      if (!selectedTx) return
      const tx = selectedTx
      // Fecha modal + anima saída do card + decrementa contador otimista + refetch em bg.
      setRemovingIds((prev) => new Set([...prev, tx.id]))
      setSelectedTx(null)
      setSugestao(null)
      toast({
        title: '🌉 Enviado ao seu PF',
        description: `${formatBRL(tx.amount)} · ${tx.description.slice(0, 40)}`,
      })
      // Otimista: remove da lista já.
      setData((prev) =>
        prev
          ? {
              ...prev,
              tx: prev.tx.filter((t) => t.id !== tx.id),
              total: prev.total - 1,
              totalAmount: prev.totalAmount - tx.amount,
            }
          : prev,
      )
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(tx.id)
        return next
      })
      // Refetch em background pra pegar estado real (invalidação de cache já feita no POST).
      void load()
    },
    [selectedTx, toast, load],
  )

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (loading) {
    return <RetiradasPendentesSkeleton />
  }

  if (error) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="p-4">
          <p className="text-sm text-rose-800">
            Erro ao carregar retiradas: {error}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.total === 0) {
    return <RetiradasPendentesEmpty />
  }

  return (
    <div className="space-y-5">
      {/* Hero — número heroi + subtítulo (Mercury/Ramp pattern) */}
      <RetiradasHero total={data.total} totalAmount={data.totalAmount} />

      {/* Lista de cards premium */}
      <div className="space-y-2.5">
        <AnimatePresence mode="popLayout">
          {data.tx.map((tx, i) => (
            <RetiradaCard
              key={tx.id}
              tx={tx}
              removing={removingIds.has(tx.id)}
              delayMs={i * 30}
              onEnviar={() => handleOpenModal(tx)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Modal com form pré-preenchido */}
      <Dialog open={!!selectedTx} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl w-[calc(100vw-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-base" aria-hidden>🌉</span>
              Enviar retirada ao seu PF
            </DialogTitle>
            <DialogDescription>
              A tx PJ continua na mesma categoria (DRE não muda). Uma entrada é
              criada na sua conta pessoal e as 2 pontas ficam ligadas por uma
              ponte auditável.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <NovaPonteForm
              empresaId={empresaId}
              socioPFId={defaultSocioPFId ?? null}
              initialPjTxId={selectedTx.id}
              initialProfileId={sugestao?.profileId ?? null}
              initialAccountId={sugestao?.bankAccountId ?? null}
              initialCategoryId={sugestao?.categoryId ?? null}
              onCancel={handleClose}
              onCreated={handleBridgeCreated}
              compact
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────

function RetiradasHero({ total, totalAmount }: { total: number; totalAmount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#185FA5] to-[#0F4A8C] text-white shadow-md">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/80">
                Retiradas esperando ir pro seu PF
              </p>
              <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                {formatBRL(totalAmount)}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/80">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                <span className="tabular-nums">{total}</span>{' '}
                {total === 1 ? 'retirada' : 'retiradas'} categorizadas · aguardam
                virar entrada no PF
              </p>
            </div>
            <div className="hidden shrink-0 rounded-full bg-white/10 p-3 text-2xl sm:block" aria-hidden>
              🌉
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Card por retirada
// ─────────────────────────────────────────────

interface CardProps {
  tx: RetiradaPendente
  removing: boolean
  delayMs: number
  onEnviar: () => void
}

function RetiradaCard({ tx, removing, delayMs, onEnviar }: CardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: removing ? 0 : 1,
        y: 0,
        scale: removing ? 0.98 : 1,
      }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.25, delay: delayMs / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="group relative border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            {/* Esquerda: descrição + meta */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 sm:text-[15px]">
                {tx.description}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {formatDateSmart(tx.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" aria-hidden />
                  {tx.bankAccountName}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                  {tx.categoryName}
                </span>
              </div>
            </div>

            {/* Direita: valor + ação */}
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="whitespace-nowrap text-base font-semibold tabular-nums text-slate-900 sm:text-lg">
                {formatBRL(tx.amount)}
              </span>
              <Button
                size="sm"
                onClick={onEnviar}
                disabled={removing}
                aria-label={`Enviar ${formatBRL(tx.amount)} ao seu PF`}
                className="gap-1 shadow-sm"
              >
                {removing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    Enviar ao PF
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Empty
// ─────────────────────────────────────────────

function RetiradasPendentesEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="border-slate-200">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="rounded-full bg-emerald-50 p-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
          </div>
          <p className="text-base font-medium text-slate-900">Tudo em dia!</p>
          <p className="max-w-sm text-sm text-slate-500">
            Nenhuma retirada esperando ir pro PF. Quando você categorizar uma tx
            como <span className="font-medium">Distribuição de Lucros</span>, ela
            aparece aqui pra virar entrada no seu perfil pessoal.
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="h-3 w-3" aria-hidden />
            13 pontes já foram criadas nesta empresa
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function RetiradasPendentesSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-slate-50" />
      ))}
    </div>
  )
}

// Import só de tipo — não gera import runtime em produção.
// Necessário porque exportamos a interface pra reuso na aba /socios.
export type { RetiradaPendente, RetiradasPendentesResponse }
