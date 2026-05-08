'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Filter, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/sidebar/breadcrumb'
import { buildBreadcrumb } from '@/lib/sidebar/breadcrumb-helper'
import { AuditLogEntry } from './audit-log-entry'

interface Props {
  empresaId: string
  empresaNome: string
  canExport: boolean
}

interface AuditLog {
  id: string
  timestamp: string
  userId: string | null
  userName: string
  userEmail: string
  action: string
  entityType: string
  entityId: string
  fieldsChanged: Record<string, { before: unknown; after: unknown }> | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
}

interface MetaInfo {
  users: { id: string | null; name: string; email: string }[]
  actions: string[]
  entityTypes: string[]
}

interface ApiResponse {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
  meta: MetaInfo
}

const PERIODS = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Tudo' },
]

function periodToDates(period: string): { startDate?: string; endDate?: string } {
  const now = new Date()
  const end = now.toISOString()

  if (period === 'all') return {}
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return { startDate: start.toISOString(), endDate: end }
  }

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return { startDate: start.toISOString(), endDate: end }
}

export function AuditoriaClient({ empresaId, empresaNome, canExport }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [meta, setMeta] = useState<MetaInfo>({ users: [], actions: [], entityTypes: [] })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const [period, setPeriod] = useState('30d')
  const [userFilter, setUserFilter] = useState<string>('')
  const [actionFilter, setActionFilter] = useState<string>('')
  const [entityFilter, setEntityFilter] = useState<string>('')
  const [search, setSearch] = useState('')

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')

      const dates = periodToDates(period)
      if (dates.startDate) params.set('startDate', dates.startDate)
      if (dates.endDate) params.set('endDate', dates.endDate)

      if (userFilter) params.set('userId', userFilter)
      if (actionFilter) params.set('action', actionFilter)
      if (entityFilter) params.set('entityType', entityFilter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/empresas/${empresaId}/audit-log?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.erro ?? 'Erro ao carregar auditoria')
      }

      const data = (await res.json()) as ApiResponse
      setLogs(data.logs)
      setMeta(data.meta)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [empresaId, page, period, userFilter, actionFilter, entityFilter, search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  function clearFilters() {
    setPeriod('30d')
    setUserFilter('')
    setActionFilter('')
    setEntityFilter('')
    setSearch('')
    setPage(1)
  }

  async function handleExport() {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      const dates = periodToDates(period)
      if (dates.startDate) params.set('startDate', dates.startDate)
      if (dates.endDate) params.set('endDate', dates.endDate)
      if (userFilter) params.set('userId', userFilter)
      if (actionFilter) params.set('action', actionFilter)
      if (entityFilter) params.set('entityType', entityFilter)
      if (search.trim()) params.set('search', search.trim())

      const res = await fetch(`/api/empresas/${empresaId}/audit-log/export?${params}`)

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.erro ?? 'Erro ao exportar')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `auditoria-${empresaId}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setIsExporting(false)
    }
  }

  const hasActiveFilters =
    period !== '30d' || userFilter || actionFilter || entityFilter || search

  const pathname = usePathname()
  const breadcrumbItems = buildBreadcrumb({
    pathname,
    empresaName: empresaNome,
    empresaId,
  })

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">🔍 Auditoria</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {empresaNome} · Histórico completo de alterações
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          {canExport && (
            <Button onClick={handleExport} disabled={isExporting || total === 0} size="sm">
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="ml-auto h-7 text-xs"
            >
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Select
            value={period}
            onValueChange={(v) => {
              setPeriod(v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={userFilter || '__all__'}
            onValueChange={(v) => {
              setUserFilter(v === '__all__' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos usuários</SelectItem>
              {meta.users.map((u) =>
                u.id ? (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ) : null,
              )}
            </SelectContent>
          </Select>

          <Select
            value={actionFilter || '__all__'}
            onValueChange={(v) => {
              setActionFilter(v === '__all__' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas ações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas ações</SelectItem>
              {meta.actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={entityFilter || '__all__'}
            onValueChange={(v) => {
              setEntityFilter(v === '__all__' ? '' : v)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas entidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas entidades</SelectItem>
              {meta.entityTypes.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">
          {total} {total === 1 ? 'registro' : 'registros'}
        </Badge>
        {hasActiveFilters && <span>com filtros aplicados</span>}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-16 animate-pulse rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="font-semibold">Nenhum registro encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'Tente ajustar os filtros ou ampliar o período.'
              : 'Comece a usar o sistema — todas alterações aparecerão aqui.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <AuditLogEntry key={log.id} log={log} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1 || isLoading}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages || isLoading}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
