'use client'

// Sprint Unificar Sócios — Detalhe do sócio com 3 abas.
//
// 🔒 PRIVACIDADE:
// - "Dados": público (todos da empresa)
// - "Suas pontes": só aparece se user tem pontes deste sócio (privado)
// - "Detecção Pix": público (mesma info que /transacoes mostra)

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Lock, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import { BridgeBadge } from '@/components/bridges/BridgeBadge'
import { BridgeDeleteModal } from '@/components/bridges/BridgeDeleteModal'
import { NovaPonteForm } from '@/components/bridges/NovaPonteForm'
import type { BridgeKind, BridgeListItem, BridgeDeleteMode } from '@/lib/bridges/types'

const BRIDGE_KINDS_ORDER: BridgeKind[] = [
  'DISTRIBUICAO',
  'PRO_LABORE',
  'ADIANTAMENTO',
  'REEMBOLSO',
  'RETIRADA_SOCIOS',
]

// Sprint Tela-Retiradas: rótulo fiscal curto por kind (mostrado no card-resumo).
const FISCAL_LABEL: Record<BridgeKind, string> = {
  PRO_LABORE: 'INSS + IR',
  DISTRIBUICAO: 'isento',
  ADIANTAMENTO: 'a devolver',
  REEMBOLSO: 'reembolso',
  RETIRADA_SOCIOS: 'genérica',
}

// Sprint Tela-Retiradas: períodos pré-definidos pro filtro.
const PERIODOS = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'mes', label: 'Este mês' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: '12m', label: '12 meses' },
] as const

type PeriodoValue = (typeof PERIODOS)[number]['value']

function startOfPeriod(periodo: PeriodoValue, now: Date): Date | null {
  const d = new Date(now)
  switch (periodo) {
    case 'tudo':
      return null
    case 'mes':
      return new Date(d.getFullYear(), d.getMonth(), 1)
    case '3m':
      return new Date(d.getFullYear(), d.getMonth() - 2, 1)
    case '6m':
      return new Date(d.getFullYear(), d.getMonth() - 5, 1)
    case '12m':
      return new Date(d.getFullYear(), d.getMonth() - 11, 1)
  }
}

interface SocioData {
  id: string
  nome: string
  cpf: string | null
  papel: string
  pixKeys: string
  createdAt: string
}

interface DetectedTx {
  id: string
  date: string
  description: string
  amount: number
  bankAccountName: string | null
  hasBridge: boolean
}

interface AggregatedData {
  socio: SocioData
  suasPontes: BridgeListItem[]
  agregados: {
    totalCount: number
    totalAmount: number
    byKind: Record<string, { count: number; amount: number }>
  }
  txPixDetected: DetectedTx[]
}

interface Props {
  empresaId: string
  empresaNome: string
  socioId: string
}

const PAPEL_LABELS: Record<string, string> = {
  SOCIO: 'Sócio',
  ADMINISTRADOR: 'Administrador',
  FAMILIAR: 'Familiar',
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

function parsePixKeys(raw: string): string[] {
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

export function SocioDetailClient({ empresaId, empresaNome, socioId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [data, setData] = useState<AggregatedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState(
    searchParams.get('action') === 'nova-ponte' ? 'nova-ponte' : 'dados',
  )
  const [deleteTarget, setDeleteTarget] = useState<BridgeListItem | null>(null)
  // Sprint Tela-Retiradas: filtros
  const [filtroTipo, setFiltroTipo] = useState<BridgeKind | 'todos'>('todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoValue>('tudo')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/socios/${socioId}/aggregated`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Erro ao carregar sócio')
      const json = await res.json()
      setData(json)
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [empresaId, socioId, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleDeleteBridge(mode: BridgeDeleteMode) {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/pontes/${deleteTarget.id}?mode=${mode}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao excluir')
      }
      toast({
        title: 'Ponte excluída',
        description: mode === 'WITH_PF_TX' ? 'Tx PF também removida' : 'Tx mantidas',
      })
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <p className="text-center text-slate-500">Carregando…</p>
      </main>
    )
  }

  if (notFound || !data) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-lg font-semibold">Sócio não encontrado</h2>
            <Link href={`/empresas/${empresaId}/socios`}>
              <Button variant="outline">← Voltar pra Sócios</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { socio, suasPontes, agregados, txPixDetected } = data
  const pixKeys = parsePixKeys(socio.pixKeys)
  const userTemPontes = agregados.totalCount > 0

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div>
        <Link
          href={`/empresas/${empresaId}/socios`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar pra Sócios
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">👤</span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{socio.nome}</h1>
              <p className="text-sm text-slate-600">
                {maskCpf(socio.cpf)} ·{' '}
                <Badge variant="outline" className="text-[10px]">
                  {PAPEL_LABELS[socio.papel] ?? socio.papel}
                </Badge>{' '}
                · {pixKeys.length} chave{pixKeys.length === 1 ? '' : 's'} Pix · {empresaNome}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats (privadas — filtradas por user) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Suas pontes</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {agregados.totalCount}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">deste sócio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Seu total</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {agregados.totalCount > 0 ? formatBRL(agregados.totalAmount) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Por tipo</p>
            <div className="mt-1 space-y-0.5 text-xs">
              {Object.entries(agregados.byKind).length === 0 ? (
                <span className="text-slate-400">—</span>
              ) : (
                Object.entries(agregados.byKind).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span>{KIND_DEFAULTS[k as BridgeKind]?.label ?? k}</span>
                    <span className="font-medium">{v.count}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="suas-pontes">
            💸 Retiradas ({agregados.totalCount})
          </TabsTrigger>
          <TabsTrigger value="deteccao">
            Detecção Pix ({txPixDetected.length})
          </TabsTrigger>
          <TabsTrigger value="nova-ponte">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nova ponte
          </TabsTrigger>
        </TabsList>

        {/* ABA DADOS (público) */}
        <TabsContent value="dados">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <div>
                <p className="text-xs uppercase text-slate-500">Nome</p>
                <p className="font-medium text-slate-900">{socio.nome}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">CPF</p>
                <p className="text-slate-700">{maskCpf(socio.cpf)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Papel</p>
                <Badge variant="outline" className="text-[10px]">
                  {PAPEL_LABELS[socio.papel] ?? socio.papel}
                </Badge>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Chaves Pix</p>
                {pixKeys.length === 0 ? (
                  <p className="text-slate-400">—</p>
                ) : (
                  <ul className="list-inside list-disc">
                    {pixKeys.map((k, i) => (
                      <li key={i} className="text-slate-700">{k}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Cadastrado em</p>
                <p className="text-slate-700">
                  {new Date(socio.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA RETIRADAS (privado) — resumo no topo + lista 2-sided embaixo */}
        <TabsContent value="suas-pontes">
          {!userTemPontes ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Lock className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Você não tem retiradas registradas com este sócio.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Se você é dono do perfil PF correspondente, crie uma na aba
                  &quot;Nova ponte&quot;.
                </p>
              </CardContent>
            </Card>
          ) : (
            <RetiradasTab
              suasPontes={suasPontes}
              filtroTipo={filtroTipo}
              setFiltroTipo={setFiltroTipo}
              filtroPeriodo={filtroPeriodo}
              setFiltroPeriodo={setFiltroPeriodo}
              onDelete={setDeleteTarget}
            />
          )}
        </TabsContent>

        {/* ABA DETECÇÃO PIX (público) */}
        <TabsContent value="deteccao">
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-slate-600">
                Transações PJ identificadas pela detecção automática (Sprint 5.0.2.h)
                como vindo pra este sócio. Visíveis a todos da empresa (mesma info que
                /movimentações mostra).
              </p>
              {txPixDetected.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Nenhuma transação detectada ainda.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 text-left">Data</th>
                      <th className="py-2 text-left">Descrição</th>
                      <th className="py-2 text-left">Conta</th>
                      <th className="py-2 text-right">Valor</th>
                      <th className="py-2 text-left">Ponte?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txPixDetected.map((t) => (
                      <tr key={t.id} className="border-b border-slate-100">
                        <td className="py-2 text-slate-700">
                          {new Date(t.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 text-slate-900">{t.description}</td>
                        <td className="py-2 text-slate-700">{t.bankAccountName ?? '—'}</td>
                        <td className="py-2 text-right font-medium text-red-600">
                          −{formatBRL(t.amount)}
                        </td>
                        <td className="py-2">
                          <BridgeBadge
                            hasBridge={t.hasBridge}
                            belongsToMe={false}
                            bridgeId={null}
                            compact
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA NOVA PONTE */}
        <TabsContent value="nova-ponte">
          <NovaPonteForm
            empresaId={empresaId}
            socioPFId={socioId}
            redirectTo={`/empresas/${empresaId}/socios/${socioId}`}
            cancelHref={`/empresas/${empresaId}/socios/${socioId}`}
            onCreated={() => {
              setActiveTab('suas-pontes')
              load()
            }}
          />
        </TabsContent>
      </Tabs>

      {deleteTarget && (
        <BridgeDeleteModal
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          pjCompanyName={deleteTarget.companyName}
          pfAccountName={deleteTarget.pfBankAccountName ?? 'conta PF'}
          amount={deleteTarget.amount}
          onConfirm={handleDeleteBridge}
        />
      )}
    </main>
  )
}

// ============================================================================
// Sprint Tela-Retiradas — Aba "💸 Retiradas"
// ============================================================================
// Layout aprovado pelo Yussef:
// - Resumo bate-olho no topo: total + 5 cards por kind (valor + count + etiqueta fiscal)
// - Filtros: tipo + período
// - Lista cardificada com 2 lados: ↑ saída PJ (conta + categoria) · ↓ entrada PF (conta + categoria)
// - Desfazer reusa o flow existente (BridgeDeleteModal)

interface RetiradasTabProps {
  suasPontes: BridgeListItem[]
  filtroTipo: BridgeKind | 'todos'
  setFiltroTipo: (v: BridgeKind | 'todos') => void
  filtroPeriodo: PeriodoValue
  setFiltroPeriodo: (v: PeriodoValue) => void
  onDelete: (b: BridgeListItem) => void
}

function RetiradasTab({
  suasPontes,
  filtroTipo,
  setFiltroTipo,
  filtroPeriodo,
  setFiltroPeriodo,
  onDelete,
}: RetiradasTabProps) {
  // Filtra por período + tipo (client-side — universo já é ≤100 itens)
  const filtered = useMemo(() => {
    const startDate = startOfPeriod(filtroPeriodo, new Date())
    return suasPontes.filter((b) => {
      if (filtroTipo !== 'todos' && b.kind !== filtroTipo) return false
      if (startDate && new Date(b.date) < startDate) return false
      return true
    })
  }, [suasPontes, filtroTipo, filtroPeriodo])

  // Agrega filtered por kind pro resumo
  const summary = useMemo(() => {
    const byKind: Record<string, { count: number; amount: number }> = {}
    let total = 0
    for (const b of filtered) {
      byKind[b.kind] = byKind[b.kind] ?? { count: 0, amount: 0 }
      byKind[b.kind].count++
      byKind[b.kind].amount += b.amount
      total += b.amount
    }
    return { byKind, total, count: filtered.length }
  }, [filtered])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500">Tipo:</span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setFiltroTipo('todos')}
                className={`rounded-full px-3 py-1 text-xs ${
                  filtroTipo === 'todos'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Todos
              </button>
              {BRIDGE_KINDS_ORDER.map((k) => {
                const d = KIND_DEFAULTS[k]
                const active = filtroTipo === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFiltroTipo(k)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {d.emoji} {d.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase text-slate-500">Período:</span>
            <div className="flex gap-1">
              {PERIODOS.map((p) => {
                const active = filtroPeriodo === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFiltroPeriodo(p.value)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo: total + 5 cards por kind */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs uppercase text-slate-500">Resumo</h3>
          <span className="text-xs text-slate-500">
            {summary.count} retirada{summary.count === 1 ? '' : 's'} ·{' '}
            <strong className="text-emerald-700">{formatBRL(summary.total)}</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {BRIDGE_KINDS_ORDER.map((k) => {
            const d = KIND_DEFAULTS[k]
            const stat = summary.byKind[k] ?? { count: 0, amount: 0 }
            const zero = stat.count === 0
            return (
              <Card key={k} className={zero ? 'opacity-50' : ''}>
                <CardContent className="space-y-1 p-3">
                  <p className="flex items-center gap-1 text-xs text-slate-600">
                    <span>{d.emoji}</span>
                    <span className="truncate">{d.label}</span>
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {zero ? '—' : formatBRL(stat.amount)}
                  </p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">
                      {stat.count} retirada{stat.count === 1 ? '' : 's'}
                    </span>
                    <Badge variant="outline" className="text-[9px]">
                      {FISCAL_LABEL[k]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Lista 2-sided */}
      <div>
        <h3 className="mb-2 text-xs uppercase text-slate-500">Detalhes</h3>
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              Nenhuma retirada nos filtros atuais.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => (
              <RetiradaCard
                key={b.id}
                bridge={b}
                onDelete={() => onDelete(b)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface RetiradaCardProps {
  bridge: BridgeListItem
  onDelete: () => void
}

function RetiradaCard({ bridge, onDelete }: RetiradaCardProps) {
  const d = KIND_DEFAULTS[bridge.kind]
  const dateStr = new Date(bridge.date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{d.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{d.label}</p>
              <p className="text-xs text-slate-500">{dateStr}</p>
            </div>
            <Badge variant="outline" className="ml-1 text-[10px]">
              {FISCAL_LABEL[bridge.kind]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tabular-nums text-emerald-700">
              {formatBRL(bridge.amount)}
            </span>
            <Link
              href={`/pontes/${bridge.id}`}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              Detalhes
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              title="Desfazer"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>

        {bridge.pjDescription && (
          <p className="mb-3 truncate text-xs text-slate-600">{bridge.pjDescription}</p>
        )}

        {/* 2 lados */}
        <div className="grid gap-2 sm:grid-cols-2">
          {/* ↑ Saída PJ */}
          <div className="rounded border border-red-100 bg-red-50/40 p-2">
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase text-red-700">
              <ArrowUpFromLine className="h-3 w-3" />
              Saída PJ ({bridge.companyName})
            </p>
            <p className="text-xs text-slate-700">
              <span className="text-slate-500">Conta:</span>{' '}
              <span className="font-medium">{bridge.pjBankAccountName ?? '—'}</span>
            </p>
            <p className="text-xs text-slate-700">
              <span className="text-slate-500">Categoria:</span>{' '}
              <span className="font-medium">{bridge.pjCategoryName ?? '—'}</span>
            </p>
          </div>

          {/* ↓ Entrada PF */}
          <div className="rounded border border-emerald-100 bg-emerald-50/40 p-2">
            <p className="mb-1 flex items-center gap-1 text-[10px] uppercase text-emerald-700">
              <ArrowDownToLine className="h-3 w-3" />
              Entrada PF ({bridge.profileName})
            </p>
            <p className="text-xs text-slate-700">
              <span className="text-slate-500">Conta:</span>{' '}
              <span className="font-medium">{bridge.pfBankAccountName ?? '—'}</span>
            </p>
            <p className="text-xs text-slate-700">
              <span className="text-slate-500">Categoria:</span>{' '}
              <span className="font-medium">{bridge.pfCategoryName ?? '—'}</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

