'use client'

// Sprint PF Fatia 4 — Detalhe da ponte.
// 🔒 PRIVACIDADE: GET /pontes/[id] retorna 404 se user não é dono nem criador.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { KIND_DEFAULTS } from '@/lib/bridges/kind-defaults'
import { BridgeDeleteModal } from '@/components/bridges/BridgeDeleteModal'
import type { BridgeDeleteMode, BridgeKind } from '@/lib/bridges/types'

interface BridgeDetailData {
  bridge: {
    id: string
    kind: string
    amount: number
    date: string
    createdVia: string
    createdAt: string
    companyId: string
    profileId: string
    notes: string | null
  }
  pjTransaction: {
    id: string
    description: string
    amount: number
    date: string
    bankAccountId: string | null
  }
  pfTransaction: {
    id: string
    description: string
    amount: number
    date: string
    bankAccountId: string | null
  }
  socioPF: { id: string; nome: string; cpf: string | null; papel: string } | null
}

export default function PonteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<BridgeDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    fetch(`/api/pontes/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        if (!r.ok) throw new Error('Erro')
        return r.json()
      })
      .then((j) => {
        if (j) setData(j)
      })
      .catch(() =>
        toast({ title: 'Erro ao carregar', variant: 'destructive' }),
      )
      .finally(() => setLoading(false))
  }, [id, toast])

  async function handleDelete(mode: BridgeDeleteMode) {
    try {
      const res = await fetch(`/api/pontes/${id}?mode=${mode}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.erro ?? 'Erro ao excluir')
      }
      toast({ title: 'Ponte excluída' })
      router.push('/dashboard')
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
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <p className="text-center text-slate-500">Carregando…</p>
      </main>
    )
  }

  if (notFound || !data) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-6">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mb-3 text-4xl">🌉</div>
            <h2 className="mb-2 text-lg font-semibold">Ponte não encontrada</h2>
            <p className="mb-4 text-sm text-slate-600">
              Pode ter sido excluída, ou pertence a outro sócio (privacidade).
            </p>
            <Link href="/dashboard">
              <Button variant="outline">Voltar pro dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  const d = KIND_DEFAULTS[data.bridge.kind as BridgeKind]

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-3xl">🌉</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Ponte · {new Date(data.bridge.date).toLocaleDateString('pt-BR')} ·{' '}
              {formatBRL(data.bridge.amount)}
            </h1>
            <p className="text-sm text-slate-600">
              {d.emoji} <strong>{d.label}</strong>{' '}
              <span className="ml-2 text-xs text-slate-500">
                ({d.affectsDre ? 'afeta DRE' : 'fora do DRE'})
              </span>
            </p>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Criada em{' '}
          {new Date(data.bridge.createdAt).toLocaleString('pt-BR')} via{' '}
          {data.bridge.createdVia === 'CREATED_FROM_DETECTION'
            ? 'detecção automática'
            : 'criação manual'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Lado PJ */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-xs uppercase text-slate-500">🏢 Lado PJ</h3>
            <p className="font-medium text-slate-900">{data.pjTransaction.description}</p>
            <p className="text-sm text-red-600">
              −{formatBRL(data.pjTransaction.amount)} (DEBIT)
            </p>
            <p className="text-xs text-slate-500">
              {new Date(data.pjTransaction.date).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-xs text-slate-600">
              dreGroup sugerido: <code>{d.suggestedPjDreGroup ?? 'manual'}</code>
            </p>
            <Link
              href={`/empresas/${data.bridge.companyId}/transacoes/${data.pjTransaction.id}`}
            >
              <Button variant="outline" size="sm" className="mt-2">
                Abrir tx PJ →
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Lado PF */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <h3 className="text-xs uppercase text-slate-500">👤 Lado PF</h3>
            <p className="font-medium text-slate-900">{data.pfTransaction.description}</p>
            <p className="text-sm text-emerald-600">
              +{formatBRL(data.pfTransaction.amount)} (CREDIT)
            </p>
            <p className="text-xs text-slate-500">
              {new Date(data.pfTransaction.date).toLocaleDateString('pt-BR')}
            </p>
            <Link href={`/perfis/${data.bridge.profileId}/transacoes`}>
              <Button variant="outline" size="sm" className="mt-2">
                Ver transações PF →
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Sócio rastreado */}
      {data.socioPF && (
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <h3 className="text-xs uppercase text-slate-500">Sócio rastreado</h3>
            <p className="font-medium text-slate-900">
              👤 {data.socioPF.nome} (SocioPF)
            </p>
            <p className="text-slate-600">
              CPF{' '}
              {data.socioPF.cpf
                ? '***.' + data.socioPF.cpf.slice(3, 6) + '.***-' + data.socioPF.cpf.slice(-2)
                : '—'}{' '}
              · papel {data.socioPF.papel}
            </p>
          </CardContent>
        </Card>
      )}

      {data.bridge.notes && (
        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <h3 className="text-xs uppercase text-slate-500">Observações</h3>
            <p className="text-slate-800">{data.bridge.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <Button variant="destructive" onClick={() => setShowDelete(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </Button>
      </div>

      <BridgeDeleteModal
        open={showDelete}
        onOpenChange={setShowDelete}
        pjCompanyName="esta empresa"
        pfAccountName="o perfil PF"
        amount={data.bridge.amount}
        onConfirm={handleDelete}
      />
    </main>
  )
}
