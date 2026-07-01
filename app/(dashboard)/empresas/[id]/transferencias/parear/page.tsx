// Sprint Parear-Transferencias (01/07/2026).
//
// /empresas/[id]/transferencias/parear
//
// UI que expõe POST /api/transferencias/pair-pendentes (Sprint 1.7):
//   • Lista PARES SUGERIDOS (auto-detectados: mesmo valor, ±3d, contas diferentes)
//   • Ferramenta MANUAL (2 dropdowns filtrados por PENDING) pra casos não auto-detectados
//
// Diferente de "Nova transferência" que CRIA 2 tx novas — aqui LIGA 2 EXISTENTES.
// Deixa claro na UI pra não confundir.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Info,
  Link2,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import type {
  ParearSugestao,
  ParearSugestoesResponse,
} from '@/app/api/empresas/[id]/transferencias/parear-sugestoes/route'

interface PendingTx {
  id: string
  date: string
  amount: number
  description: string
  bankAccountId: string
  bankAccountName: string
}

function formatDateSmart(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function PearearTransferenciasPage() {
  const { id: empresaId } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<ParearSugestoesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState<Set<string>>(new Set())
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set())
  // Manual mode
  const [debitId, setDebitId] = useState('')
  const [creditId, setCreditId] = useState('')
  const [manualBusy, setManualBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(
        `/api/empresas/${empresaId}/transferencias/parear-sugestoes`,
        { credentials: 'include' },
      )
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j: ParearSugestoesResponse = await r.json()
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

  const handlePair = useCallback(
    async (sug: ParearSugestao) => {
      setPairing((prev) => new Set([...prev, sug.key]))
      try {
        const res = await fetch('/api/transferencias/pair-pendentes', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transacaoIdA: sug.debit.id,
            transacaoIdB: sug.credit.id,
          }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.erro ?? `HTTP ${res.status}`)
        }
        toast({
          title: '🔗 Transferência casada',
          description: `${formatBRL(sug.debit.amount)} · ${sug.debit.bankAccountName} → ${sug.credit.bankAccountName}`,
        })
        // Otimista: animar saída + remover da lista + refetch em bg
        setRemovingKeys((prev) => new Set([...prev, sug.key]))
        setData((prev) =>
          prev
            ? {
                ...prev,
                sugestoes: prev.sugestoes.filter((s) => s.key !== sug.key),
                totalDebitPending: prev.totalDebitPending - 1,
                totalCreditPending: prev.totalCreditPending - 1,
              }
            : prev,
        )
        setRemovingKeys((prev) => {
          const next = new Set(prev)
          next.delete(sug.key)
          return next
        })
        void load()
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Erro ao casar',
          description: (err as Error).message,
        })
      } finally {
        setPairing((prev) => {
          const next = new Set(prev)
          next.delete(sug.key)
          return next
        })
      }
    },
    [toast, load],
  )

  // ─────────── Manual mode ───────────

  // Deriva lista de PENDING DEBIT/CREDIT únicos vindos das sugestões
  const { debitOptions, creditOptions } = useMemo(() => {
    const dMap = new Map<string, PendingTx>()
    const cMap = new Map<string, PendingTx>()
    for (const s of data?.sugestoes ?? []) {
      if (!dMap.has(s.debit.id)) dMap.set(s.debit.id, s.debit)
      if (!cMap.has(s.credit.id)) cMap.set(s.credit.id, s.credit)
    }
    return {
      debitOptions: Array.from(dMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
      creditOptions: Array.from(cMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
    }
  }, [data?.sugestoes])

  const handleManualPair = useCallback(async () => {
    if (!debitId || !creditId) {
      toast({ variant: 'destructive', title: 'Selecione as 2 transações' })
      return
    }
    setManualBusy(true)
    try {
      const res = await fetch('/api/transferencias/pair-pendentes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transacaoIdA: debitId,
          transacaoIdB: creditId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.erro ?? `HTTP ${res.status}`)
      }
      toast({
        title: '🔗 Transferência casada manualmente',
      })
      setDebitId('')
      setCreditId('')
      void load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao casar',
        description: (err as Error).message,
      })
    } finally {
      setManualBusy(false)
    }
  }, [debitId, creditId, toast, load])

  // ─────────── Render ───────────

  return (
    <div className="space-y-6">
      <Header
        title="Parear transferências"
        description="Ligar 2 tx existentes como par TRANSFER (sem criar novas)"
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/transferencias`}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Voltar
          </Link>
        </Button>
      </Header>

      {/* Aviso explicativo — diferencia de "Nova transferência" */}
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <div className="leading-relaxed">
          Esta tela <strong>liga 2 transações que já existem</strong> como par
          de transferência (uma saída e uma entrada equivalentes).{' '}
          <strong>Não cria transações novas</strong> — pra isso, use{' '}
          <Link
            href={`/empresas/${empresaId}/transferencias`}
            className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          >
            Nova transferência
          </Link>
          . Aqui a origem e o destino já foram importadas (OFX/Excel) e só
          precisam ser reconhecidas como o mesmo movimento.
        </div>
      </div>

      {loading ? (
        <ParearSkeleton />
      ) : error ? (
        <Card className="border-rose-200 bg-rose-50/60">
          <CardContent className="p-4">
            <p className="text-sm text-rose-800">Erro ao carregar: {error}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={load}>
              Tentar de novo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pares sugeridos */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                Pares sugeridos
                {data && data.sugestoes.length > 0 && (
                  <span className="tabular-nums font-normal text-slate-500">
                    ({data.sugestoes.length})
                  </span>
                )}
              </h2>
              {data && (
                <span className="text-xs text-slate-500">
                  {data.totalDebitPending} saídas · {data.totalCreditPending} entradas pendentes
                </span>
              )}
            </div>

            {!data || data.sugestoes.length === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                  <div className="rounded-full bg-emerald-50 p-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden />
                  </div>
                  <p className="text-base font-medium text-slate-900">
                    Nenhum par sugerido
                  </p>
                  <p className="max-w-sm text-sm text-slate-500">
                    Nenhuma saída pendente casa com uma entrada pendente de outra
                    conta com o mesmo valor e data próxima (±3 dias). Se você
                    sabe que 2 tx são par, use a ferramenta manual abaixo.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                <AnimatePresence mode="popLayout">
                  {data.sugestoes.map((sug, i) => (
                    <SugestaoCard
                      key={sug.key}
                      sug={sug}
                      delayMs={i * 30}
                      busy={pairing.has(sug.key)}
                      removing={removingKeys.has(sug.key)}
                      onPair={() => handlePair(sug)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Ferramenta manual */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Link2 className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              Casar manualmente
            </h2>
            <Card className="border-slate-200">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs text-slate-500">
                  Escolha uma saída e uma entrada pendentes pra casar como par.
                  O sistema valida (mesma empresa, contas diferentes, tipos
                  opostos, valor ±0,01, data ±3 dias) antes de aplicar.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                      Saída (débito)
                    </label>
                    <select
                      value={debitId}
                      onChange={(e) => setDebitId(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs text-slate-900"
                    >
                      <option value="">Escolher saída…</option>
                      {debitOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDateSmart(t.date)} · {t.bankAccountName} ·{' '}
                          {formatBRL(t.amount)} ·{' '}
                          {t.description.slice(0, 45)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
                      Entrada (crédito)
                    </label>
                    <select
                      value={creditId}
                      onChange={(e) => setCreditId(e.target.value)}
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-xs text-slate-900"
                    >
                      <option value="">Escolher entrada…</option>
                      {creditOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDateSmart(t.date)} · {t.bankAccountName} ·{' '}
                          {formatBRL(t.amount)} ·{' '}
                          {t.description.slice(0, 45)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {debitOptions.length === 0 && creditOptions.length === 0 && (
                  <p className="rounded-md bg-slate-50 p-2 text-center text-xs text-slate-500">
                    Nenhuma tx pendente candidata. Só aparecem aqui saídas e
                    entradas com contrapar de mesmo valor e data próxima.
                  </p>
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    onClick={handleManualPair}
                    disabled={!debitId || !creditId || manualBusy}
                    className="gap-1 shadow-sm"
                  >
                    {manualBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Casando…
                      </>
                    ) : (
                      <>
                        Confirmar par
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Card de par sugerido
// ─────────────────────────────────────────────

interface SugestaoCardProps {
  sug: ParearSugestao
  delayMs: number
  busy: boolean
  removing: boolean
  onPair: () => void
}

function SugestaoCard({ sug, delayMs, busy, removing, onPair }: SugestaoCardProps) {
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
      <Card className="group border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/* Grid 2 lados */}
            <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
              {/* Saída (débito) */}
              <div className="rounded-md border border-rose-100 bg-rose-50/40 p-2.5">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-rose-700">
                  <Building2 className="h-3 w-3" aria-hidden />
                  Saída · {sug.debit.bankAccountName}
                </p>
                <p className="mt-1 truncate text-xs text-slate-700">
                  {sug.debit.description}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {formatDateSmart(sug.debit.date)}
                  <span className="ml-auto tabular-nums font-semibold text-rose-700">
                    −{formatBRL(sug.debit.amount)}
                  </span>
                </p>
              </div>

              {/* Seta central */}
              <div className="hidden items-center justify-center sm:flex">
                <ArrowRight className="h-4 w-4 text-slate-300" aria-hidden />
              </div>

              {/* Entrada (crédito) */}
              <div className="rounded-md border border-emerald-100 bg-emerald-50/40 p-2.5">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700">
                  <Building2 className="h-3 w-3" aria-hidden />
                  Entrada · {sug.credit.bankAccountName}
                </p>
                <p className="mt-1 truncate text-xs text-slate-700">
                  {sug.credit.description}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Calendar className="h-3 w-3" aria-hidden />
                  {formatDateSmart(sug.credit.date)}
                  <span className="ml-auto tabular-nums font-semibold text-emerald-700">
                    +{formatBRL(sug.credit.amount)}
                  </span>
                </p>
              </div>
            </div>

            {/* Ação */}
            <div className="flex flex-col items-end gap-1 sm:min-w-[160px]">
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {sug.sameDay ? 'Mesma data' : `${sug.daysApart}d de diferença`}
              </span>
              <Button
                size="sm"
                onClick={onPair}
                disabled={busy || removing}
                className="gap-1 shadow-sm"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Casando…
                  </>
                ) : (
                  <>
                    <Link2 className="h-3.5 w-3.5" />
                    Casar como par
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
// Skeleton
// ─────────────────────────────────────────────

function ParearSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-50" />
      ))}
    </div>
  )
}
