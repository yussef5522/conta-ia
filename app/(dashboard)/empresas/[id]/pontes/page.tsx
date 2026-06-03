'use client'

// Sprint PF Fatia 4 — Lista de pontes da empresa (lado PJ).
//
// 🔒 PRIVACIDADE: lista mostra SÓ as pontes do user logado
// (decisão A do plano §0.b). Banner explicativo no topo.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ArrowRight, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import { BridgeDeleteModal } from '@/components/bridges/BridgeDeleteModal'
import type { BridgeKind, BridgeListItem, BridgeDeleteMode } from '@/lib/bridges/types'

export default function EmpresaPontesPage() {
  const { id } = useParams<{ id: string }>()
  const empresaId = id
  const { toast } = useToast()

  const [bridges, setBridges] = useState<BridgeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [empresaName, setEmpresaName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BridgeListItem | null>(null)
  const [filterKind, setFilterKind] = useState<BridgeKind | ''>('')

  async function fetchBridges() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterKind) params.set('kind', filterKind)
      const res = await fetch(`/api/empresas/${empresaId}/pontes?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar pontes')
      const json = await res.json()
      setBridges(json.bridges ?? [])
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function fetchEmpresa() {
    try {
      const res = await fetch(`/api/empresas/${empresaId}`)
      if (res.ok) {
        const json = await res.json()
        setEmpresaName(json.empresa?.name ?? '')
      }
    } catch {}
  }

  useEffect(() => {
    fetchBridges()
    fetchEmpresa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, filterKind])

  async function handleDelete(mode: BridgeDeleteMode) {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/pontes/${deleteTarget.id}?mode=${mode}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.erro ?? 'Erro ao excluir ponte')
      }
      toast({
        title: 'Ponte excluída',
        description: mode === 'WITH_PF_TX' ? 'Tx PF também removida' : 'Tx mantidas',
      })
      setDeleteTarget(null)
      fetchBridges()
    } catch (err) {
      toast({
        title: 'Erro',
        description: (err as Error).message,
        variant: 'destructive',
      })
    }
  }

  // Stats agregados (das que o user vê — privadas)
  const totalCount = bridges.length
  const totalAmount = bridges.reduce((s, b) => s + b.amount, 0)
  const byKind = bridges.reduce<Record<string, { count: number; amount: number }>>(
    (acc, b) => {
      const k = b.kind
      acc[k] = acc[k] ?? { count: 0, amount: 0 }
      acc[k].count++
      acc[k].amount += b.amount
      return acc
    },
    {},
  )

  return (
    <>
      <Header title={`Pontes PJ → PF · ${empresaName || 'Empresa'}`}>
        <Link href={`/empresas/${empresaId}/pontes/nova`}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova ponte
          </Button>
        </Link>
      </Header>

      <main className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div>
          <Link
            href={`/empresas/${empresaId}`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Voltar pra empresa
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Minhas pontes nesta empresa
          </h1>
          <p className="text-sm text-slate-600">
            Pró-labore, distribuição de lucros e reembolsos pagos para você
          </p>
        </div>

        {/* Banner de privacidade — decisão A do plano §0.b */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Privacidade</p>
              <p className="text-blue-800">
                Você vê apenas <strong>suas</strong> pontes. As retiradas de outros
                sócios são privadas — assim como as suas são privadas pra eles. O DRE
                da empresa mostra os totais agregados (visíveis a todos os sócios).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-slate-500">Suas pontes</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-slate-500">Você recebeu</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {formatBRL(totalAmount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-slate-500">Por tipo</p>
              <div className="mt-1 space-y-1 text-sm">
                {Object.entries(byKind).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span>{KIND_DEFAULTS[k as BridgeKind].label}</span>
                    <span className="font-medium">{v.count}</span>
                  </div>
                ))}
                {Object.keys(byKind).length === 0 && (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-sm font-medium text-slate-700">Tipo:</span>
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value as BridgeKind | '')}
              className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(KIND_DEFAULTS).map(([k, d]) => (
                <option key={k} value={k}>
                  {d.label}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Carregando…</div>
            ) : bridges.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mb-3 text-4xl">🌉</div>
                <h2 className="mb-2 text-lg font-semibold text-slate-900">
                  Nenhuma ponte criada ainda
                </h2>
                <p className="mb-4 text-sm text-slate-600">
                  Pontes conectam saídas da empresa (pró-labore, distribuição de
                  lucros, reembolsos) com a entrada no seu perfil pessoal.
                </p>
                <Link href={`/empresas/${empresaId}/pontes/nova`}>
                  <Button>+ Criar primeira ponte</Button>
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">Meu perfil PF</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-left">Conta PF</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {bridges.map((b) => {
                    const d = KIND_DEFAULTS[b.kind]
                    return (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700">
                          {new Date(b.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {b.profileName}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1">
                            <span>{d.emoji}</span>
                            <span>{d.label}</span>
                          </span>
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
            )}
          </CardContent>
        </Card>
      </main>

      {deleteTarget && (
        <BridgeDeleteModal
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          pjCompanyName={deleteTarget.companyName}
          pfAccountName={deleteTarget.pfBankAccountName ?? 'conta PF'}
          amount={deleteTarget.amount}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
