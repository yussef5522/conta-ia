'use client'

// Sprint A-effected Fase 1 — Tabela de conciliações já feitas.
//
// Lista paginada com par OFX↔candidato + botão Desfazer (chama endpoint
// existente POST /api/conciliacao/desfazer/[id]).

import { useEffect, useState, useCallback, useMemo } from 'react'
import { ArrowLeftRight, RotateCcw, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface HistoricoItem {
  id: string
  description: string
  amount: number
  paymentDate: string | null
  dueDate: string | null
  date: string
  origin: string
  lifecycle: string
  status: string
  reconciledWithId: string | null
  // Sprint A-effected Fase B.3 — undo agrupado N:1
  reconcileGroupId: string | null
  updatedAt: string
  category: { id: string; name: string; color: string } | null
  supplier: { id: string; razaoSocial: string; nomeFantasia: string | null } | null
  ofx: {
    id: string
    description: string
    amount: number
    date: string
    type: string
    bankAccount: { name: string; bankName: string | null } | null
  } | null
}

interface GroupedEntry {
  type: 'single' | 'group'
  // pra single
  item?: HistoricoItem
  // pra group
  groupId?: string
  items?: HistoricoItem[]
  // OFX compartilhada (vinda do 1º item do grupo)
  sharedOfx?: HistoricoItem['ofx']
  groupTotalAmount?: number
}

interface Props {
  empresaId: string
  onAfterUndo?: () => void
}

export function HistoricoTable({ empresaId, onAfterUndo }: Props) {
  const { toast } = useToast()
  const [items, setItems] = useState<HistoricoItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const limit = 25

  const fetchData = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    const qs = new URLSearchParams({
      empresaId,
      page: String(page),
      limit: String(limit),
    })
    if (busca.trim()) qs.set('busca', busca.trim())
    try {
      const res = await fetch(`/api/conciliacao/historico?${qs}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, page, busca])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function desfazer(item: HistoricoItem) {
    const par = `${item.description} ↔ ${item.ofx?.description ?? 'OFX'}`
    if (!confirm(`Desfazer conciliação?\n\n${par}\nR$ ${item.amount.toFixed(2)}\n\nA tx volta pra fila de pendentes.`)) return
    setUndoingId(item.id)
    try {
      const res = await fetch(`/api/conciliacao/desfazer/${item.id}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao desfazer',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Desconciliada', description: item.description })
      await fetchData()
      onAfterUndo?.()
    } finally {
      setUndoingId(null)
    }
  }

  // Sprint A-effected Fase B.3 — Desfazer grupo N:1
  async function desfazerGrupo(groupId: string, count: number, totalAmount: number) {
    if (
      !confirm(
        `Desfazer grupo N:1?\n\n${count} notas (total R$ ${totalAmount.toFixed(2)}) voltam pra fila de pendentes. A OFX volta a estar disponível pra novo reconcile.\n\nTem certeza?`,
      )
    )
      return
    setUndoingId(`group:${groupId}`)
    try {
      const res = await fetch(`/api/conciliacao/desfazer-grupo/${groupId}`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao desfazer grupo',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      if (data.failed > 0) {
        toast({
          variant: 'destructive',
          title: `${data.undone}/${data.total} desfeitas, ${data.failed} falharam`,
          description: data.errors?.[0]?.error ?? '',
        })
      } else {
        toast({
          title: `Grupo desfeito (${data.undone} notas)`,
          description: 'As notas voltam pra pendentes.',
        })
      }
      await fetchData()
      onAfterUndo?.()
    } finally {
      setUndoingId(null)
    }
  }

  // Agrupa items por reconcileGroupId. Singles (sem groupId) ficam como
  // GroupedEntry tipo 'single'. Items com mesmo groupId viram 1 entry 'group'.
  const groupedEntries = useMemo<GroupedEntry[]>(() => {
    const result: GroupedEntry[] = []
    const groupMap = new Map<string, HistoricoItem[]>()
    for (const item of items) {
      if (item.reconcileGroupId) {
        const list = groupMap.get(item.reconcileGroupId) ?? []
        list.push(item)
        groupMap.set(item.reconcileGroupId, list)
      } else {
        result.push({ type: 'single', item })
      }
    }
    for (const [groupId, groupItems] of groupMap) {
      result.push({
        type: 'group',
        groupId,
        items: groupItems,
        sharedOfx: groupItems[0]?.ofx ?? null,
        groupTotalAmount: groupItems.reduce(
          (acc, i) => acc + Math.abs(i.amount),
          0,
        ),
      })
    }
    // Ordena por updatedAt mais recente
    return result.sort((a, b) => {
      const ta = (a.type === 'single' ? a.item! : a.items![0]).updatedAt
      const tb = (b.type === 'single' ? b.item! : b.items![0]).updatedAt
      return new Date(tb).getTime() - new Date(ta).getTime()
    })
  }, [items])

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—'

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => {
            setPage(1)
            setBusca(e.target.value)
          }}
          className="pl-9"
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Carregando...
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma conciliação encontrada.
            {busca && (
              <p className="mt-2 text-xs">Tente limpar o filtro de busca.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="text-xs text-muted-foreground">
            {total} conciliação{total === 1 ? '' : 'ões'} no total
          </div>
          <div className="border rounded-lg bg-card divide-y">
            {groupedEntries.map((entry) => {
              if (entry.type === 'single' && entry.item) {
                const item = entry.item
                return (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-muted-foreground">
                          Conciliada{' '}
                          {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                        {item.category && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: item.category.color }}
                              />
                              {item.category.name}
                            </span>
                          </>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => desfazer(item)}
                        disabled={undoingId === item.id}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {undoingId === item.id ? 'Desfazendo...' : 'Desfazer'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">
                          Conta a {item.amount > 0 ? 'pagar' : 'receber'} (sistema)
                        </p>
                        <p className="text-sm font-medium truncate">
                          {item.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          vence {fmtDate(item.dueDate)} · pago {fmtDate(item.paymentDate)}
                        </div>
                      </div>
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">
                          Extrato bancário (OFX)
                        </p>
                        <p className="text-sm font-medium truncate">
                          {item.ofx?.description ?? '— sem OFX linkada —'}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {item.ofx
                            ? `${fmtDate(item.ofx.date)} · ${item.ofx.bankAccount?.bankName ?? item.ofx.bankAccount?.name ?? '—'}`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {item.origin === 'IMPORT_EXCEL'
                          ? '📄 Excel'
                          : item.origin === 'MANUAL'
                            ? '✋ Manual'
                            : item.origin}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        R$ {item.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              }

              // GROUP — N:1 conciliação consolidada
              if (entry.type === 'group' && entry.items && entry.groupId) {
                const groupId = entry.groupId
                const groupItems = entry.items
                const ofx = entry.sharedOfx
                const totalAmount = entry.groupTotalAmount ?? 0
                const undoingThis = undoingId === `group:${groupId}`
                return (
                  <div
                    key={groupId}
                    className="p-4 space-y-2 bg-blue-50/30 border-l-4 border-blue-400"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-semibold text-blue-900">
                          Grupo N:1 · {groupItems.length} notas
                        </span>
                        <span className="text-muted-foreground">
                          ·{' '}
                          {new Date(groupItems[0].updatedAt).toLocaleDateString(
                            'pt-BR',
                          )}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          desfazerGrupo(groupId, groupItems.length, totalAmount)
                        }
                        disabled={undoingThis}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        {undoingThis
                          ? 'Desfazendo grupo...'
                          : `Desfazer grupo (${groupItems.length})`}
                      </Button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Extrato bancário (OFX):{' '}
                      <span className="font-medium text-foreground">
                        {ofx?.description ?? '—'}
                      </span>
                      {ofx &&
                        ` · ${fmtDate(ofx.date)} · ${ofx.bankAccount?.bankName ?? ofx.bankAccount?.name ?? '—'} · R$ ${ofx.amount.toFixed(2)}`}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Soma das {groupItems.length} notas:{' '}
                      <strong className="text-foreground tabular-nums">
                        R$ {totalAmount.toFixed(2)}
                      </strong>
                    </div>

                    <div className="border rounded bg-card divide-y mt-2">
                      {groupItems.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between px-3 py-1.5 text-xs"
                        >
                          <span className="truncate flex-1">{sub.description}</span>
                          <span className="text-muted-foreground mr-3 hidden md:inline">
                            vence {fmtDate(sub.dueDate)}
                          </span>
                          <span className="tabular-nums font-semibold">
                            R$ {sub.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }

              return null
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
