'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, ArrowUpRight, ArrowDownRight, Filter,
  ChevronLeft, ChevronRight, Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
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

interface Category { id: string; name: string; color: string; type: string }

interface ContaInfo {
  id: string
  name: string
  bankName: string | null
  balance: number
  accountType: string
  companyId: string
  company: { name: string; tradeName: string | null }
}

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
  bankAccountId: string
  category: Category | null
  bankAccount: ContaInfo
}

interface Paginacao { total: number; page: number; limit: number; totalPages: number }

export default function TransacoesPage() {
  const { toast } = useToast()

  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [contas, setContas] = useState<ContaInfo[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [contasReady, setContasReady] = useState(false)

  const now = new Date()
  const [inicio, setInicio] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`)
  const [fim, setFim] = useState(now.toISOString().split('T')[0])
  const [tipo, setTipo] = useState('TODOS')
  const [status, setStatus] = useState('TODOS')
  const [contaFiltro, setContaFiltro] = useState('TODAS')
  const [page, setPage] = useState(1)

  // Carrega lista de contas para o filtro e para o botão Nova Transação
  useEffect(() => {
    async function fetchContas() {
      const res = await fetch('/api/contas-bancarias')
      if (res.ok) {
        const data = await res.json()
        setContas(data.contas)
      }
      setContasReady(true)
    }
    fetchContas()
  }, [])

  const fetchTransacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '50' })
      if (contaFiltro !== 'TODAS') qs.set('contaId', contaFiltro)
      if (inicio) qs.set('inicio', inicio)
      if (fim) qs.set('fim', fim)
      if (tipo !== 'TODOS') qs.set('tipo', tipo)
      if (status !== 'TODOS') qs.set('status', status)

      const res = await fetch(`/api/transacoes?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setTransacoes(data.transacoes)
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }, [contaFiltro, page, inicio, fim, tipo, status])

  useEffect(() => { fetchTransacoes() }, [fetchTransacoes])

  const entradas = transacoes.filter((t) => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const saidas = transacoes.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <Header
        title="Transações"
        description={`${paginacao.total} lançamento${paginacao.total !== 1 ? 's' : ''} no período`}
      >
        {!contasReady ? (
          <Button size="sm" disabled>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
          </Button>
        ) : contas.length === 0 ? (
          <Button size="sm" asChild>
            <Link href="/contas-bancarias">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
            </Link>
          </Button>
        ) : contas.length === 1 ? (
          <Button size="sm" asChild>
            <Link href={`/empresas/${contas[0].companyId}/contas/${contas[0].id}/transacoes/nova`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
            </Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Nova Transação
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {contas.map((c) => (
                <DropdownMenuItem key={c.id} asChild>
                  <Link href={`/empresas/${c.companyId}/contas/${c.id}/transacoes/nova`}>
                    {c.company.tradeName ?? c.company.name} · {c.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Header>

      {/* Cards resumo */}
      <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="text-xs text-muted-foreground">Conta</p>
              <Select value={contaFiltro} onValueChange={(v) => { setContaFiltro(v); setPage(1) }}>
                <SelectTrigger className="h-8 w-48 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company.tradeName ?? c.company.name} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <p className="text-sm text-muted-foreground mt-1 mb-6">Altere os filtros ou acesse uma conta para lançar transações.</p>
          <Button asChild>
            <Link href="/contas-bancarias">
              <Building2 className="mr-2 h-4 w-4" />Ver Contas Bancárias
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          {transacoes.map((t, i) => (
            <div key={t.id} className={`group flex items-center gap-3 px-4 py-3 hover:bg-muted/50 ${i > 0 ? 'border-t' : ''}`}>
              {/* Ícone */}
              <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full ${
                t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>

              {/* Descrição */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    · {t.bankAccount.company.tradeName ?? t.bankAccount.company.name} / {t.bankAccount.name}
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

              {/* Link para conta */}
              <Link
                href={`/empresas/${t.bankAccount.companyId}/contas/${t.bankAccountId}/transacoes/${t.id}/editar`}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition-all"
              >
                Editar
              </Link>
            </div>
          ))}
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
    </div>
  )
}
