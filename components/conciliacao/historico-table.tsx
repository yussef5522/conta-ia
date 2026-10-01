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
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

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

/** ⭐ 30/09: a linha arquivada por DECISÃO do dono ("não tem nota") — não por par */
interface AvulsaItem extends Omit<HistoricoItem, 'ofx'> {
  ofx: null
  /** ⚠️ `type` não está no `HistoricoItem` (a lista de pares não precisa dele) — mas aqui
   *  ele DECIDE o sinal na tela, e sem o campo a avulsa de entrada apareceria como saída. */
  type: string
  avulsa: { criadoEm: string; motivo: string | null }
  bankAccount?: { name: string; bankName: string | null } | null
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
  /**
   * ⭐⭐⭐ AS AVULSAS (30/09) — o arquivo que era INENCONTRÁVEL.
   *
   * **A queixa do dono:** *"as duas SUMIRAM e NÃO estão em «Já conciliadas»"*. Era literal:
   * esta tela lista pares (`reconciledWithId`), e a avulsa arquiva por **decisão**, sem
   * vínculo nenhum. Ela saía da caixa e não aparecia em lugar nenhum do sistema.
   *
   * ⛔ Seção SEPARADA, não misturada na lista de pares: *"eu disse que não tem nota"* e
   * *"casou com uma nota"* são fatos diferentes, e colapsar os dois no mesmo balde é a
   * mistura que escondeu R$ 16.201,01 em 24/09.
   */
  const [avulsas, setAvulsas] = useState<AvulsaItem[]>([])
  const [voltandoId, setVoltandoId] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  /** ⛔ erro NUNCA vira lista vazia — e ele carrega o gesto de tentar de novo */
  const [erro, setErro] = useState<string | null>(null)
  const [undoingId, setUndoingId] = useState<string | null>(null)
  const limit = 25

  /**
   * ⛔⛔ **CARREGAMENTO REFÉM — a mesma família da lixeira (20/09).** Este `if (!empresaId)
   * return` saía **antes de tocar no `loading`**, que nasce `true`: sem empresa, a tabela
   * dizia *"Carregando..."* pra sempre. ***Fetch que não SAI é spinner eterno com outro
   * nome*** — e nenhum timeout alcança uma requisição que não aconteceu.
   *
   * ⚠️ E ela engolia a falha: `if (res.ok)` **sem else** (o padrão banido em 06/08) fazia
   * um 500 virar lista vazia — *erro disfarçado de vazio*.
   */
  const fetchData = useCallback(async () => {
    if (!empresaId) { setLoading(false); setErro('Escolha uma empresa pra ver o histórico.'); return }
    setLoading(true); setErro(null)
    const qs = new URLSearchParams({
      empresaId,
      page: String(page),
      limit: String(limit),
    })
    if (busca.trim()) qs.set('busca', busca.trim())
    const r = await fetchComTimeout<{ items: HistoricoItem[]; total: number; avulsas?: AvulsaItem[] }>(
      `/api/conciliacao/historico?${qs}`, { credentials: 'include' },
    )
    setLoading(false)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar o histórico.'); return }
    setItems(r.data.items)
    setTotal(r.data.total)
    setAvulsas(r.data.avulsas ?? [])
  }, [empresaId, page, busca])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /**
   * ⭐⭐ TRAZER DE VOLTA PRA CAIXA — pela porta ÚNICA do balcão (`/resolver`), nunca por uma
   * rota nova. *Uma tela nova não pode significar um motor novo.*
   *
   * ⚠️ Sem `confirm()` nativo (ele falhou em silêncio no Safari em fluxo async, 22/08): o
   * gesto é reversível e leve, então o clique é o gesto — e o efeito é DITO no toast.
   */
  async function trazerDeVolta(item: AvulsaItem) {
    setVoltandoId(item.id)
    try {
      const r = await fetchComTimeout<{ efeito?: string }>(`/api/conciliacao/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ empresaId, txId: item.id, acao: 'DESFAZER_AVULSA' }),
      })
      if (!r.ok) {
        toast({ variant: 'destructive', title: 'Não trouxe de volta', description: r.erro ?? 'Falha ao desfazer.' })
        return
      }
      toast({ variant: 'success', title: 'De volta na caixa', description: r.data?.efeito ?? 'a linha voltou pra caixa de entrada' })
      await fetchData()
      onAfterUndo?.()
    } finally {
      setVoltandoId(null)
    }
  }

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
      ) : erro ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-amber-800">
            {erro}
            <button type="button" onClick={() => void fetchData()} className="ml-2 font-semibold underline">
              tentar de novo
            </button>
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

          {/* ⭐⭐ A SEÇÃO DAS AVULSAS — o arquivo da DECISÃO do dono, com a volta */}
          {avulsas.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
                Arquivadas como despesa avulsa ({avulsas.length})
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                você disse que estas não têm nota a casar — elas não têm par, então moram aqui
              </p>
              <div className="mt-2 space-y-1.5">
                {avulsas.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/70 bg-white px-3 py-2 dark:border-amber-900/40 dark:bg-slate-950">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {a.description || '(sem descrição)'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(a.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        {' · '}
                        {a.type === 'CREDIT' ? '+' : '−'} R$ {a.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {a.bankAccount?.name ? ` · ${a.bankAccount.name}` : ''}
                        {/* ⛔ a categoria aparece: avulsa SEM categoria era o furo que saía do DRE */}
                        {' · '}
                        {a.category?.name ?? <span className="text-rose-600 dark:text-rose-400">sem categoria</span>}
                      </p>
                      {a.avulsa.motivo && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">motivo: {a.avulsa.motivo}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs"
                      onClick={() => trazerDeVolta(a)} disabled={voltandoId === a.id}>
                      {voltandoId === a.id ? 'voltando…' : '↩ trazer de volta'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
