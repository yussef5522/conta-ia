'use client'

// Página de transferências entre contas — Sprint 0.5 Dia 4.
// Lista paginada agrupada por transferGroupId, com filtros (período + conta).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeftRight, ArrowRight, Trash2, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { NovaTransferenciaModal } from '@/components/transferencias/NovaTransferenciaModal'

interface Conta {
  id: string
  name: string
}

interface Transferencia {
  groupId: string
  date: string
  amount: number
  fromAccount: { id: string; name: string; bankName: string | null }
  toAccount: { id: string; name: string; bankName: string | null }
  description: string
  notes: string | null
}

interface Paginacao {
  total: number
  page: number
  limit: number
  totalPages: number
}

const ITEMS_PER_PAGE = 25

export default function TransferenciasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()

  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [paginacao, setPaginacao] = useState<Paginacao | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Transferencia | null>(null)

  // Filtros
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [contaFiltro, setContaFiltro] = useState<string>('ALL')

  async function fetchTransferencias() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/transferencias?empresaId=${empresaId}&page=${page}&limit=${ITEMS_PER_PAGE}`,
      )
      if (res.ok) {
        const data = await res.json()
        setTransferencias(data.transferencias ?? [])
        setPaginacao(data.paginacao)
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchContas() {
    const res = await fetch(`/api/contas-bancarias?empresaId=${empresaId}`)
    if (res.ok) {
      const data = await res.json()
      setContas(
        (data.contas ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        })),
      )
    }
  }

  useEffect(() => {
    fetchContas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchTransferencias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Filtros aplicados client-side (sobre o page atual da API).
  // Filtro de conta cobre AMBOS os lados (origem OU destino).
  const transferenciasFiltradas = useMemo(() => {
    return transferencias.filter((t) => {
      if (dataInicio && t.date < dataInicio) return false
      if (dataFim && t.date > dataFim + 'T23:59:59Z') return false
      if (
        contaFiltro !== 'ALL' &&
        t.fromAccount.id !== contaFiltro &&
        t.toAccount.id !== contaFiltro
      )
        return false
      return true
    })
  }, [transferencias, dataInicio, dataFim, contaFiltro])

  const temFiltros = dataInicio || dataFim || contaFiltro !== 'ALL'

  function clearFiltros() {
    setDataInicio('')
    setDataFim('')
    setContaFiltro('ALL')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    const res = await fetch(`/api/transferencias/${target.groupId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setTransferencias((p) => p.filter((t) => t.groupId !== target.groupId))
      toast({
        variant: 'success',
        title: 'Transferência excluída',
        description: 'Saldos das contas foram revertidos.',
      })
    } else {
      const data = await res.json()
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: data.erro ?? 'Falha ao excluir',
      })
    }
    setDeleteTarget(null)
  }

  function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Transferências entre Contas"
        description={
          paginacao
            ? `${paginacao.total} transferência${paginacao.total !== 1 ? 's' : ''} no total`
            : 'Movimentação entre contas da empresa'
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}`}>← Empresa</Link>
        </Button>
        <Button onClick={() => setModalOpen(true)} disabled={contas.length < 2}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Nova Transferência
        </Button>
      </Header>

      {contas.length < 2 && !loading && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            Você precisa de pelo menos 2 contas bancárias cadastradas pra criar transferências.{' '}
            <Link
              href={`/empresas/${empresaId}/contas`}
              className="underline text-primary"
            >
              Gerenciar contas →
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filtros
            </div>
            <div className="space-y-1">
              <Label htmlFor="dataInicio" className="text-xs">Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dataFim" className="text-xs">Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contaFiltro" className="text-xs">Conta (origem ou destino)</Label>
              <Select value={contaFiltro} onValueChange={setContaFiltro}>
                <SelectTrigger id="contaFiltro" className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {temFiltros && (
              <Button variant="ghost" size="sm" onClick={clearFiltros}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      ) : transferenciasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">
            {temFiltros
              ? 'Nenhuma transferência com esses filtros'
              : 'Nenhuma transferência ainda'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {temFiltros
              ? 'Tente ajustar ou limpar os filtros.'
              : 'Crie a primeira transferência entre contas da empresa.'}
          </p>
          {!temFiltros && (
            <Button
              onClick={() => setModalOpen(true)}
              disabled={contas.length < 2}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Criar primeira transferência
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-left font-medium">Origem → Destino</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Descrição</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {transferenciasFiltradas.map((t) => (
                  <tr
                    key={t.groupId}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{t.fromAccount.name}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{t.toAccount.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatBRL(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-[280px]">
                      {t.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(t)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {paginacao && paginacao.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {paginacao.page} de {paginacao.totalPages} ({paginacao.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= paginacao.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <NovaTransferenciaModal
        empresaId={empresaId}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={() => {
          setModalOpen(false)
          fetchTransferencias()
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir transferência?"
        description={
          deleteTarget
            ? `Esta ação remove o par completo e reverte os saldos das contas ${deleteTarget.fromAccount.name} e ${deleteTarget.toAccount.name}. Não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
