'use client'

// Sprint PF Fatia 4 — Lista de pontes do perfil PF (lado PF).
// Foca em "de qual empresa veio" (coluna EMPRESA).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus, Trash2, ArrowRight, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import { BridgeDeleteModal } from '@/components/bridges/BridgeDeleteModal'
import type { BridgeKind, BridgeListItem, BridgeDeleteMode } from '@/lib/bridges/types'

export default function PerfilPontesPage() {
  const { id } = useParams<{ id: string }>()
  const profileId = id
  const { toast } = useToast()

  const [bridges, setBridges] = useState<BridgeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [profileName, setProfileName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BridgeListItem | null>(null)
  const [filterKind, setFilterKind] = useState<BridgeKind | ''>('')

  async function fetchBridges() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterKind) params.set('kind', filterKind)
      const res = await fetch(`/api/perfis/${profileId}/pontes?${params}`)
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

  async function fetchProfile() {
    try {
      const res = await fetch(`/api/perfis/${profileId}`)
      if (res.ok) {
        const json = await res.json()
        setProfileName(json.profile?.name ?? '')
      }
    } catch {}
  }

  useEffect(() => {
    fetchBridges()
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, filterKind])

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

  const totalAmount = bridges.reduce((s, b) => s + b.amount, 0)
  const empresas = new Set(bridges.map((b) => b.companyId))

  return (
    <main className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div>
        <Link
          href={`/perfis/${profileId}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Voltar pro perfil
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Pontes PJ → PF
            </h1>
            <p className="text-sm text-slate-600">
              Dinheiro que entrou em <strong>{profileName}</strong> vindo de
              empresas onde sou sócio
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Recebido</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {formatBRL(totalAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{bridges.length} pontes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Empresas</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {empresas.size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-slate-500">Por tipo</p>
            <div className="mt-1 space-y-1 text-sm">
              {Object.entries(KIND_DEFAULTS).map(([k, d]) => {
                const count = bridges.filter((b) => b.kind === k).length
                if (count === 0) return null
                return (
                  <div key={k} className="flex items-center justify-between">
                    <span>{d.label}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                )
              })}
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Carregando…</div>
          ) : bridges.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mb-3 text-4xl">🌉</div>
              <h2 className="mb-2 text-lg font-semibold text-slate-900">
                Sem pontes neste perfil
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                Quando você criar pontes vindas de empresas onde é sócio, elas
                aparecem aqui.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Empresa</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-left">Conta</th>
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
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          {b.companyName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {d.emoji} {d.label}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        +{formatBRL(b.amount)}
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
    </main>
  )
}
