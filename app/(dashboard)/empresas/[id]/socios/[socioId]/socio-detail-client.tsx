'use client'

// Sprint Unificar Sócios — Detalhe do sócio com 3 abas.
//
// 🔒 PRIVACIDADE:
// - "Dados": público (todos da empresa)
// - "Suas pontes": só aparece se user tem pontes deste sócio (privado)
// - "Detecção Pix": público (mesma info que /transacoes mostra)

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, ArrowRight, Lock } from 'lucide-react'
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
            Suas pontes ({agregados.totalCount})
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

        {/* ABA SUAS PONTES (privado) */}
        <TabsContent value="suas-pontes">
          {!userTemPontes ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Lock className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Você não tem pontes registradas com este sócio.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Se você é dono do perfil PF correspondente, pode criar uma ponte na aba
                  &quot;Nova ponte&quot;.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3 text-left">Conta PF</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suasPontes.map((b) => {
                      const d = KIND_DEFAULTS[b.kind]
                      return (
                        <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">
                            {new Date(b.date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3">
                            {d.emoji} {d.label}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">
                            {formatBRL(b.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {b.pfBankAccountName ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/pontes/${b.id}`}>
                                <Button variant="ghost" size="sm">
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(b)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
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
