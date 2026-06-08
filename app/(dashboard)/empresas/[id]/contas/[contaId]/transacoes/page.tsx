'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Plus, ArrowUpRight, ArrowDownRight, MoreVertical,
  Pencil, Trash2, Filter, ChevronLeft, ChevronRight, Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { DeleteDialog } from '@/components/empresas/delete-dialog'
import { OrphanWithdrawalCard } from '@/components/withdrawals/OrphanWithdrawalCard'
import { isOrphanWithdrawal } from '@/lib/withdrawals/is-orphan'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  RECONCILED: 'Conciliado',
  IGNORED: 'Ignorado',
}

const STATUS_VARIANTS: Record<string, 'outline' | 'secondary' | 'destructive'> = {
  PENDING: 'outline',
  RECONCILED: 'secondary',
  IGNORED: 'destructive',
}

interface Category { id: string; name: string; color: string; type: string; dreGroup?: string | null }

interface Transacao {
  id: string
  description: string
  amount: number
  type: string
  date: string
  status: string
  origin: string
  notes: string | null
  categoryId: string | null
  category: Category | null
  // Sprint Fluxo-Único-Retirada (08/06/2026) — campos pra detectar orfã
  lifecycle?: string | null
  isInternalTransfer?: boolean | null
  transferGroupId?: string | null
  bridge?: { id: string } | null
}

interface Conta { id: string; name: string; bankName: string | null; balance: number; accountType: string }

interface Paginacao { total: number; page: number; limit: number; totalPages: number }

export default function TransacoesPage() {
  const params = useParams<{ id: string; contaId: string }>()
  const { id: empresaId, contaId } = params
  const { toast } = useToast()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [conta, setConta] = useState<Conta | null>(null)
  const [paginacao, setPaginacao] = useState<Paginacao>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Filtros
  const now = new Date()
  const [inicio, setInicio] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [fim, setFim] = useState(now.toISOString().split('T')[0])
  const [tipo, setTipo] = useState('TODOS')
  const [status, setStatus] = useState('TODOS')
  const [page, setPage] = useState(1)

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ contaId, page: String(page), limit: '50' })
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      if (status !== 'TODOS') qs.set('status', status)

      const res = await fetch(`/api/transacoes?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data.transacoes)
        setConta(data.conta)
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }, [contaId, page, inicio, fim, tipo, status])

  useEffect(() => { fetchTransacoes() }, [fetchTransacoes])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/transacoes/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTransacoes((p) => p.filter((t) => t.id !== deleteTarget.id))
        toast({ variant: 'success', title: 'Sucesso', description: 'Transação excluída.' })
        fetchTransacoes()
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const entradas = transacoes.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const saidas = transacoes.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <Header
        title={conta ? `Transações — ${conta.name}` : 'Transações'}
        description={conta?.bankName ?? ''}
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/contas`}>← Contas</Link>
        </Button>
        {/* Sprint Caixa: Caixa não tem extrato OFX */}
        {conta?.accountType !== 'CASH' && (
          <Button variant="outline" asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/importar`}>
              <Upload className="mr-2 h-4 w-4" />Importar OFX
            </Link>
          </Button>
        )}
        <Button asChild>
          <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes/nova`}>
            <Plus className="mr-2 h-4 w-4" />Novo Lançamento
          </Link>
        </Button>
      </Header>

      {/* Cards de resumo */}
      {conta && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Saldo atual</p>
              <p className={`text-2xl font-bold ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatBRL(conta.balance)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Entradas no período</p>
              <p className="text-2xl font-bold text-green-600">{formatBRL(entradas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Saídas no período</p>
              <p className="text-2xl font-bold text-red-600">{formatBRL(saidas)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-auto mb-1 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">De</p>
              <Input type="date" className="h-8 w-36 text-sm" value={inicio} onChange={(e) => { setInicio(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Até</p>
              <Input type="date" className="h-8 w-36 text-sm" value={fim} onChange={(e) => { setFim(e.target.value); setPage(1) }} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo</p>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="CREDIT">Entradas</SelectItem>
                  <SelectItem value="DEBIT">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="RECONCILED">Conciliado</SelectItem>
                  <SelectItem value="IGNORED">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : transacoes.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowUpRight className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma transação no período</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Altere os filtros ou lance uma nova transação.</p>
          <Button asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes/nova`}>
              <Plus className="mr-2 h-4 w-4" />Novo Lançamento
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {transacoes.map((t, i) => {
            // Sprint Fluxo-Único-Retirada (08/06/2026): detecta órfã
            const isOrfaRetirada = isOrphanWithdrawal({
              lifecycle: t.lifecycle ?? '',
              type: t.type,
              isInternalTransfer: t.isInternalTransfer ?? false,
              transferGroupId: t.transferGroupId ?? null,
              categoryDreGroup: t.category?.dreGroup ?? null,
              hasBridge: !!t.bridge,
            })
            return (
            <div key={t.id} className={`group flex flex-col px-4 py-3 hover:bg-muted/50 ${i > 0 ? 'border-t' : ''}`}>
            <div className="flex items-center gap-3">
              {/* Ícone entrada/saída */}
              <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
                t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>

              {/* Descrição e categoria */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString('pt-BR')}
                  </span>
                  {t.category && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.category.color }} />
                      {t.category.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <Badge variant={STATUS_VARIANTS[t.status] ?? 'outline'} className="hidden sm:inline-flex text-xs">
                {STATUS_LABELS[t.status] ?? t.status}
              </Badge>

              {/* Valor */}
              <span className={`shrink-0 font-semibold text-sm ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
              </span>

              {/* Ações */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes/${t.id}/editar`} className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" />Editar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive flex items-center gap-2"
                    onClick={() => setDeleteTarget({ id: t.id, nome: t.description })}>
                    <Trash2 className="h-4 w-4" />Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Sprint Fluxo-Único-Retirada: convite âmbar */}
            {isOrfaRetirada && (
              <OrphanWithdrawalCard
                empresaId={empresaId}
                pjTransactionId={t.id}
                pjAmount={t.amount}
                pjDescription={t.description}
                categoryDreGroup={t.category?.dreGroup ?? null}
                onCompleted={() => {
                  // Update OTIMISTA — marca a row como tendo ponte
                  setTransacoes((prev) =>
                    prev.map((x) =>
                      x.id === t.id
                        ? { ...x, bridge: { id: '__just-created__' } }
                        : x,
                    ),
                  )
                }}
              />
            )}
            </div>
          )})}
        </div>
      )}

      {/* Paginação */}
      {paginacao.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {paginacao.total} transaç{paginacao.total !== 1 ? 'ões' : 'ão'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {paginacao.totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= paginacao.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        empresaNome={deleteTarget?.nome ?? ''}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
