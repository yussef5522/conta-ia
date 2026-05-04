'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/lib/categories/buildTree'
import { getDreColorClass, getDreLabel } from '@/lib/categories/dre-colors'
import { formatBRL } from '@/lib/format/money'

interface Props {
  empresaId: string
  selected: CategoryNode | null
}

interface Estatisticas {
  transactionCount: number
  totalAmount12m: number
  lastUsedAt: string | null
}

const TYPE_LABEL: Record<string, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  TRANSFER: 'Transferência',
}

const TYPE_BADGE_VARIANT: Record<string, 'success' | 'destructive' | 'secondary'> = {
  INCOME: 'success',
  EXPENSE: 'destructive',
  TRANSFER: 'secondary',
}

const REGIME_LABEL: Record<string, string> = {
  SIMPLES_NACIONAL_I: 'Simples I',
  SIMPLES_NACIONAL_II: 'Simples II',
  SIMPLES_NACIONAL_III: 'Simples III',
  SIMPLES_NACIONAL_IV: 'Simples IV',
  SIMPLES_NACIONAL_V: 'Simples V',
  LUCRO_PRESUMIDO: 'Lucro Presumido',
  LUCRO_REAL: 'Lucro Real',
  MEI: 'MEI',
}

function parseRegimes(json: string | null): string[] | null {
  if (!json) return null
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : null
  } catch {
    return null
  }
}

export function CategoryDetail({ empresaId, selected }: Props) {
  const [stats, setStats] = useState<Estatisticas | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [erroStats, setErroStats] = useState<string | null>(null)

  useEffect(() => {
    setStats(null)
    setErroStats(null)
    if (!selected) return

    let cancelado = false
    async function carregar() {
      try {
        setLoadingStats(true)
        const res = await fetch(`/api/empresas/${empresaId}/categorias/${selected!.id}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.erro ?? 'Erro ao carregar estatísticas')
        }
        const data = await res.json()
        if (!cancelado) setStats(data.estatisticas ?? null)
      } catch (e) {
        if (!cancelado) setErroStats(e instanceof Error ? e.message : 'Erro inesperado')
      } finally {
        if (!cancelado) setLoadingStats(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [empresaId, selected?.id])

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium">Selecione uma categoria à esquerda</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Os detalhes da categoria aparecem aqui. Edição entra na sub-etapa <strong>5.1.C</strong>.
        </p>
      </div>
    )
  }

  const regimes = parseRegimes(selected.visibleInRegimes)

  return (
    <div className="space-y-4">
      {/* Header da categoria */}
      <div className="flex items-start gap-3">
        <span
          className={cn('shrink-0 mt-1 h-3 w-3 rounded-full', getDreColorClass(selected.dreGroup))}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{selected.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={TYPE_BADGE_VARIANT[selected.type] ?? 'outline'} className="text-xs">
              {TYPE_LABEL[selected.type] ?? selected.type}
            </Badge>
            {selected.dreGroup && (
              <Badge variant="outline" className="text-xs gap-1.5">
                <span
                  className={cn('inline-block h-2 w-2 rounded-full', getDreColorClass(selected.dreGroup))}
                  aria-hidden="true"
                />
                {getDreLabel(selected.dreGroup)}
              </Badge>
            )}
            {selected.code && (
              <Badge variant="outline" className="text-xs font-mono">
                {selected.code}
              </Badge>
            )}
            <Badge variant={selected.isActive ? 'success' : 'destructive'} className="text-xs">
              {selected.isActive ? 'Ativa' : 'Inativa'}
            </Badge>
            {selected.isSystemDefault && (
              <Badge variant="outline" className="text-xs">
                Padrão do sistema
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Descrição */}
      {selected.description && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground mb-1">Descrição</p>
            <p className="text-sm">{selected.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Cor + Ícone */}
      <Card>
        <CardContent className="py-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Cor</p>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-5 w-5 rounded border"
                style={{ backgroundColor: selected.color }}
                aria-hidden="true"
              />
              <span className="text-sm font-mono">{selected.color}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ícone</p>
            <p className="text-sm font-mono">{selected.icon ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Visibilidade por regime */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground mb-2">Visibilidade por regime tributário</p>
          {regimes === null ? (
            <p className="text-sm text-muted-foreground">Visível em todos os regimes</p>
          ) : regimes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum regime selecionado</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {regimes.map((r) => (
                <Badge key={r} variant="secondary" className="text-xs">
                  {REGIME_LABEL[r] ?? r}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground mb-2">Estatísticas de uso</p>
          {loadingStats ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : erroStats ? (
            <p className="text-sm text-destructive">{erroStats}</p>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Transações vinculadas</p>
                <p className="text-sm font-semibold tabular-nums">{stats.transactionCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Movimentado (12m)</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatBRL(stats.totalAmount12m)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última usada</p>
                <p className="text-sm font-semibold">
                  {stats.lastUsedAt
                    ? new Date(stats.lastUsedAt).toLocaleDateString('pt-BR')
                    : 'Nunca'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer informativo */}
      <p className="text-xs text-muted-foreground italic">
        Edição da categoria (nome, cor, ícone, descrição, visibilidade) entra na sub-etapa{' '}
        <strong>5.1.C</strong>.
      </p>
    </div>
  )
}
