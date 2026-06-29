// Sprint Transferências Redesign (28/06/2026, Mercury/Ramp).
//
// /transferencias/conciliadas — lista detalhada das transferências pareadas.
//
// Cada linha mostra: conta origem → conta destino (com selo PJ/PF), valor,
// data, ações "Desfazer par" (seguro, não afeta saldo) e "Excluir"
// (perigoso, pede confirmação dura).

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Trash2,
  ArrowLeftRight,
  Search,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AccountKindBadge } from '@/components/shared/AccountKindBadge'
import { formatBRL } from '@/lib/format/money'

interface Transferencia {
  groupId: string
  date: string
  amount: number
  fromAccount: { id: string; name: string; bankName: string | null; accountKind?: 'PJ' | 'PF' }
  toAccount: { id: string; name: string; bankName: string | null; accountKind?: 'PJ' | 'PF' }
  fromDescription?: string
  toDescription?: string
  classificacao?: 'TRANSFER_INTERNAL' | 'APORTE_CAPITAL' | 'RETIRADA_LUCRO' | 'UNKNOWN'
}

export default function ConciliadasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()
  const [empresaNome, setEmpresaNome] = useState('')
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [unpairTarget, setUnpairTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  async function reload() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/transferencias?empresaId=${empresaId}&limit=200`,
        { credentials: 'include' },
      )
      if (res.ok) {
        const d = await res.json()
        setTransferencias(d.transferencias ?? [])
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

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function executarUnpair() {
    if (!unpairTarget) return
    setActing(true)
    try {
      const res = await fetch(
        `/api/transferencias/${unpairTarget}/unpair`,
        { method: 'POST', credentials: 'include' },
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro', description: d.erro ?? 'Falha ao desfazer' })
        return
      }
      toast({
        variant: 'success',
        title: 'Par desfeito',
        description: 'As 2 transações voltaram pra fila de revisão. Saldo intacto.',
      })
      setUnpairTarget(null)
      await reload()
    } finally {
      setActing(false)
    }
  }

  async function executarDelete() {
    if (!deleteTarget) return
    setActing(true)
    try {
      const res = await fetch(
        `/api/transferencias/${deleteTarget}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro', description: d.erro ?? 'Falha ao excluir' })
        return
      }
      toast({
        variant: 'success',
        title: 'Transferência excluída',
        description: 'As 2 transações foram apagadas. Saldos recalculados.',
      })
      setDeleteTarget(null)
      await reload()
    } finally {
      setActing(false)
    }
  }

  const filtered = transferencias.filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.fromAccount.name.toLowerCase().includes(q) ||
      t.toAccount.name.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    )
  })

  return (
    <div className="space-y-5">
      <Header
        title="Conciliadas"
        description={
          empresaNome
            ? `${empresaNome} · ${filtered.length} transferência${filtered.length !== 1 ? 's' : ''}`
            : `${filtered.length} transferências`
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/transferencias`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
        </Button>
      </Header>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por valor ou conta…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {loading && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            <p className="mt-2">Carregando…</p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length === 0 && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {transferencias.length === 0
                ? 'Nenhuma transferência conciliada ainda'
                : 'Nenhum resultado pra essa busca'}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && filtered.length > 0 && (
        <Card className="rounded-xl border-slate-200/70 dark:border-slate-800/70 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((t) => {
              const isExp = expanded.has(t.groupId)
              return (
                <div key={t.groupId}>
                  <div className="flex items-center gap-3 p-4">
                    <button
                      onClick={() => toggleExpand(t.groupId)}
                      className="text-muted-foreground hover:text-foreground"
                      title={isExp ? 'Recolher' : 'Expandir'}
                    >
                      {isExp ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <div className="text-xs text-muted-foreground tabular-nums w-16">
                      {fmtDateBR(t.date)}
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-0 text-sm">
                      <span className="font-medium truncate">{t.fromAccount.name}</span>
                      {t.fromAccount.accountKind && (
                        <AccountKindBadge kind={t.fromAccount.accountKind} />
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{t.toAccount.name}</span>
                      {t.toAccount.accountKind && (
                        <AccountKindBadge kind={t.toAccount.accountKind} />
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatBRL(t.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUnpairTarget(t.groupId)}
                      title="Desfazer par (seguro — não afeta saldo)"
                      className="text-xs text-muted-foreground hover:text-blue-600"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                      Desfazer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(t.groupId)}
                      title="Excluir transferência (apaga as tx, afeta saldo)"
                      className="text-xs text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {isExp && (
                    <div className="px-4 pb-4 ml-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-red-200/40 dark:border-red-900/30 bg-red-50/30 dark:bg-red-950/15 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold">
                          Saída
                        </p>
                        <p className="text-sm font-medium mt-1">{t.fromAccount.name}</p>
                        {t.fromAccount.bankName && (
                          <p className="text-xs text-muted-foreground">{t.fromAccount.bankName}</p>
                        )}
                        <p className="text-sm font-medium tabular-nums text-red-700 dark:text-red-400 mt-2">
                          − {formatBRL(t.amount)}
                        </p>
                        {t.fromDescription && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {t.fromDescription}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg border border-emerald-200/40 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-950/15 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
                          Entrada
                        </p>
                        <p className="text-sm font-medium mt-1">{t.toAccount.name}</p>
                        {t.toAccount.bankName && (
                          <p className="text-xs text-muted-foreground">{t.toAccount.bankName}</p>
                        )}
                        <p className="text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400 mt-2">
                          + {formatBRL(t.amount)}
                        </p>
                        {t.toDescription && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {t.toDescription}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-2 text-xs text-muted-foreground pt-1">
                        Transferência interna entre contas da empresa · fora do DRE
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Confirm Desfazer (seguro) */}
      <ConfirmDialog
        open={!!unpairTarget}
        onOpenChange={(o) => !o && setUnpairTarget(null)}
        title="Desfazer pareamento?"
        description={
          <>
            As 2 transações voltam a aparecer separadas na fila de revisão e o transferGroupId é
            removido. <strong>Saldo das contas não é alterado</strong> (as tx continuam
            existindo). Você pode pareá-las de novo depois.
          </>
        }
        confirmLabel={acting ? 'Desfazendo…' : 'Desfazer par'}
        variant="default"
        onConfirm={executarUnpair}
      />

      {/* Confirm Excluir (perigoso) */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir transferência?"
        description={
          <>
            <strong>⚠️ Isso APAGA as 2 transações</strong> (saída e entrada). O saldo das 2
            contas será recalculado e vai mudar. Use só se realmente foram lançadas errado.
            <br />
            <br />
            Se foi pareamento errado e quer só descasar mantendo as tx, use{' '}
            <strong>Desfazer par</strong> (a opção anterior).
          </>
        }
        confirmLabel={acting ? 'Excluindo…' : 'Excluir (afeta saldo)'}
        variant="destructive"
        onConfirm={executarDelete}
      />
    </div>
  )
}

function fmtDateBR(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
