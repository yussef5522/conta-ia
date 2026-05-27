'use client'

// Sprint 4.0.1.a — Contas a Pagar (PAYABLE).
// Lista paginada + KPIs no header + filtros + ações efetivar/cancelar.

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { formatBRL } from '@/lib/format/money'
import { isEmpresaZerada } from '@/lib/contas-pagar/empty-state'

interface Conta {
  id: string
  description: string
  amount: number
  dueDate: string | null
  status: string
  notes: string | null
  category: { id: string; name: string; color: string } | null
  supplier: { id: string; razaoSocial: string; nomeFantasia: string | null } | null
  bankAccount: { id: string; name: string; bankName: string | null } | null
}

interface Empresa { id: string; name: string; tradeName: string | null }
interface BankAccount { id: string; name: string; bankName: string | null; companyId: string }

interface KPIs {
  totalPendente: number
  countPendente: number
  totalVencido: number
  countVencido: number
  // Sprint 5.0.2.4 — KPI Pagas (3º card)
  totalPagas: number
  countPagas: number
}

interface Paginacao { total: number; page: number; limit: number; totalPages: number }

export default function ContasAPagarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando…</div>}>
      <ContasAPagarInner />
    </Suspense>
  )
}

function ContasAPagarInner() {
  const router = useRouter()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState<string>(searchParams.get('empresaId') ?? '')
  const [items, setItems] = useState<Conta[]>([])
  const [kpis, setKpis] = useState<KPIs>({
    totalPendente: 0,
    countPendente: 0,
    totalVencido: 0,
    countVencido: 0,
    totalPagas: 0,
    countPagas: 0,
  })
  const [paginacao, setPaginacao] = useState<Paginacao>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('PENDING')
  const [vencidasOnly, setVencidasOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [efetivar, setEfetivar] = useState<Conta | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [efetivarBankId, setEfetivarBankId] = useState('')
  const [efetivarDate, setEfetivarDate] = useState(new Date().toISOString().slice(0, 10))
  const [efetivarLoading, setEfetivarLoading] = useState(false)

  // Carrega empresas
  useEffect(() => {
    fetch('/api/empresas')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.empresas) {
          setEmpresas(data.empresas)
          if (!empresaId && data.empresas.length === 1) {
            setEmpresaId(data.empresas[0].id)
          }
        }
      })
      .catch(() => {})
  }, [empresaId])

  // Carrega contas bancárias da empresa (pra modal efetivar)
  useEffect(() => {
    if (!empresaId) return
    fetch('/api/contas-bancarias')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.contas) {
          setBankAccounts(data.contas.filter((c: BankAccount) => c.companyId === empresaId))
        }
      })
      .catch(() => {})
  }, [empresaId])

  const fetchItems = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        empresaId,
        page: String(page),
        limit: '50',
      })
      if (status !== 'TODOS') qs.set('status', status)
      if (vencidasOnly) qs.set('vencidas', 'true')

      const res = await fetch(`/api/contas-a-pagar?${qs}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items)
        setKpis(data.kpis)
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }, [empresaId, page, status, vencidasOnly])

  useEffect(() => { fetchItems() }, [fetchItems])

  // Sync URL com empresa selecionada
  useEffect(() => {
    if (!empresaId) return
    const sp = new URLSearchParams()
    sp.set('empresaId', empresaId)
    router.replace(`?${sp}`, { scroll: false })
  }, [empresaId, router])

  async function executarEfetivacao() {
    if (!efetivar || !efetivarBankId || !efetivarDate) return
    setEfetivarLoading(true)
    try {
      const res = await fetch(`/api/transacoes/${efetivar.id}/efetivar`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: efetivarDate,
          bankAccountId: efetivarBankId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({
          variant: 'destructive',
          title: 'Falha ao efetivar',
          description: data.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      toast({ title: 'Efetivada', description: efetivar.description })
      setEfetivar(null)
      setEfetivarBankId('')
      void fetchItems()
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha de rede.' })
    } finally {
      setEfetivarLoading(false)
    }
  }

  function vencimentoCor(dueDate: string | null): string {
    if (!dueDate) return 'text-muted-foreground'
    const due = new Date(dueDate)
    const now = new Date()
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'text-red-600 font-semibold'
    if (diff <= 3) return 'text-amber-600 font-medium'
    return 'text-muted-foreground'
  }

  function vencimentoLabel(dueDate: string | null): string {
    if (!dueDate) return '—'
    const due = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const fmt = due.toLocaleDateString('pt-BR')
    if (diffDays < 0) return `${fmt} · vencida há ${Math.abs(diffDays)}d`
    if (diffDays === 0) return `${fmt} · vence hoje`
    if (diffDays <= 3) return `${fmt} · vence em ${diffDays}d`
    return fmt
  }

  return (
    <div className="space-y-6">
      <Header
        title="Contas a Pagar"
        description={
          empresaId
            ? `${paginacao.total} conta${paginacao.total !== 1 ? 's' : ''} no filtro`
            : 'Selecione uma empresa pra ver as contas a pagar'
        }
      >
        <Button size="sm" variant="outline" asChild disabled={!empresaId}>
          <Link href={empresaId ? `/empresas/${empresaId}/contas-pagar/import` : '#'}>
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Importar Excel
          </Link>
        </Button>
        <Button size="sm" asChild disabled={!empresaId}>
          <Link href={`/contas-a-pagar/nova${empresaId ? `?empresaId=${empresaId}` : ''}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nova conta a pagar
          </Link>
        </Button>
      </Header>

      {/* Empresa selector quando há múltiplas */}
      {empresas.length > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Empresa:</span>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="w-auto min-w-[280px]">
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.tradeName ?? e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {empresaId && (
        <>
          {/* KPIs — Sprint 5.0.2.4 adiciona 3º card "Pagas" */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">A pagar pendente</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1">{formatBRL(kpis.totalPendente)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {kpis.countPendente} conta{kpis.countPendente !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <CalendarClock className="h-8 w-8 text-muted-foreground/30" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Vencidas</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1 text-red-600">
                      {formatBRL(kpis.totalVencido)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {kpis.countVencido} conta{kpis.countVencido !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-300" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Pagas</p>
                    <p className="text-2xl font-semibold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                      {formatBRL(kpis.totalPagas)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {kpis.countPagas} conta{kpis.countPagas !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
                  <SelectTrigger className="w-auto min-w-[150px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendentes</SelectItem>
                    <SelectItem value="RECONCILED">Conciliadas</SelectItem>
                    <SelectItem value="IGNORED">Ignoradas</SelectItem>
                    <SelectItem value="TODOS">Todos status</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Input
                    type="checkbox"
                    className="w-3.5 h-3.5"
                    checked={vencidasOnly}
                    onChange={(e) => { setVencidasOnly(e.target.checked); setPage(1) }}
                  />
                  Só vencidas
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Lista */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            isEmpresaZerada({ status, vencidasOnly, kpis }) ? (
              // Sprint 5.0.2.1 — Empresa sem nenhuma conta cadastrada:
              // empty state primary com CTA de import (descoberta da feature)
              <Card>
                <CardContent className="py-12 text-center">
                  <FileSpreadsheet
                    className="h-15 w-15 mx-auto mb-3 text-primary/40"
                    style={{ width: 60, height: 60 }}
                  />
                  <h3 className="text-lg font-medium text-foreground mb-1">
                    Comece importando a planilha do seu contador
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                    A IA cadastra fornecedores, funcionários e categorias
                    automaticamente — você só revisa e confirma.
                  </p>
                  <div className="flex flex-col items-center gap-2">
                    <Button asChild>
                      <Link href={`/empresas/${empresaId}/contas-pagar/import`}>
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        Importar planilha Excel
                      </Link>
                    </Button>
                    <Link
                      href={`/contas-a-pagar/nova?empresaId=${empresaId}`}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ou cadastrar conta manualmente
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Filtro aplicado mas vazio (empresa TEM contas, mas nenhuma bate)
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-600" />
                  <p className="text-sm">Nenhuma conta a pagar no filtro atual.</p>
                </CardContent>
              </Card>
            )
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              {items.map((t, i) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 ${i > 0 ? 'border-t' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
                      <span className={vencimentoCor(t.dueDate)}>
                        {vencimentoLabel(t.dueDate)}
                      </span>
                      {t.supplier && (
                        <span>· {t.supplier.nomeFantasia ?? t.supplier.razaoSocial}</span>
                      )}
                      {t.category && (
                        <span className="flex items-center gap-1">
                          ·
                          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.category.color }} />
                          {t.category.name}
                        </span>
                      )}
                      {t.bankAccount && (
                        <span>· {t.bankAccount.bankName ?? t.bankAccount.name}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="hidden sm:inline-flex text-xs">
                    {t.status === 'PENDING' ? 'Pendente' : t.status === 'RECONCILED' ? 'Conciliada' : 'Ignorada'}
                  </Badge>
                  <span className="shrink-0 font-semibold text-sm text-red-600">
                    − {formatBRL(t.amount)}
                  </span>
                  {t.status === 'PENDING' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEfetivar(t)
                        setEfetivarBankId(t.bankAccount?.id ?? bankAccounts[0]?.id ?? '')
                      }}
                    >
                      Efetivar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Paginação */}
          {paginacao.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {paginacao.total} conta{paginacao.total !== 1 ? 's' : ''}
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
        </>
      )}

      {/* Modal Efetivar */}
      <Dialog open={!!efetivar} onOpenChange={(o) => !o && setEfetivar(null)}>
        <DialogContent className="max-w-md">
          {efetivar && (
            <>
              <DialogHeader>
                <DialogTitle>Efetivar pagamento</DialogTitle>
                <DialogDescription>
                  Marca como paga (lifecycle EFFECTED) e atualiza saldo da conta.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <p className="text-sm font-medium">{efetivar.description}</p>
                <div className="space-y-1.5">
                  <label className="text-xs">Data do pagamento</label>
                  <Input
                    type="date"
                    value={efetivarDate}
                    onChange={(e) => setEfetivarDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs">Conta bancária</label>
                  <Select value={efetivarBankId} onValueChange={setEfetivarBankId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione conta…" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bankName ?? b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Valor: <strong className="tabular-nums">{formatBRL(efetivar.amount)}</strong>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEfetivar(null)} disabled={efetivarLoading}>
                  Cancelar
                </Button>
                <Button
                  onClick={executarEfetivacao}
                  disabled={!efetivarBankId || !efetivarDate || efetivarLoading}
                >
                  {efetivarLoading ? 'Efetivando…' : 'Efetivar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
