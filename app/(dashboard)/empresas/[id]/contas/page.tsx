'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus, Landmark, MoreVertical, Pencil, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { DeleteDialog } from '@/components/empresas/delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
}

interface Conta {
  id: string
  name: string
  bankName: string | null
  bankCode: string | null
  agency: string | null
  accountNumber: string | null
  accountType: string
  balance: number
  isActive: boolean
}

export default function ContasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()

  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchContas() {
    try {
      const res = await fetch(`/api/contas-bancarias?empresaId=${empresaId}`)
      if (res.ok) {
        const data = await res.json()
        setContas(data.contas)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContas() }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/contas-bancarias/${deleteTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setContas((p) => p.filter((c) => c.id !== deleteTarget.id))
        toast({ variant: 'success', title: 'Sucesso', description: 'Conta excluída.' })
      }
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const saldoTotal = contas.filter(c => c.accountType !== 'INVESTMENT').reduce((s, c) => s + c.balance, 0)

  return (
    <div className="space-y-6">
      <Header title="Contas Bancárias" description={`${contas.length} conta${contas.length !== 1 ? 's' : ''} cadastrada${contas.length !== 1 ? 's' : ''}`}>
        <Button variant="outline" asChild><Link href={`/empresas/${empresaId}`}>← Empresa</Link></Button>
        <Button asChild>
          <Link href={`/empresas/${empresaId}/contas/nova`}>
            <Plus className="mr-2 h-4 w-4" />Nova Conta
          </Link>
        </Button>
      </Header>

      {/* Saldo total */}
      {contas.length > 0 && (
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm opacity-80">Saldo Total (contas corrente + poupança)</p>
              <p className="text-3xl font-bold">{formatBRL(saldoTotal)}</p>
            </div>
            <Landmark className="h-10 w-10 opacity-30" />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-28 rounded-lg border bg-muted animate-pulse" />)}
        </div>
      ) : contas.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">Nenhuma conta cadastrada</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Cadastre uma conta para começar a controlar o saldo.</p>
          <Button asChild>
            <Link href={`/empresas/${empresaId}/contas/nova`}>
              <Plus className="mr-2 h-4 w-4" />Cadastrar primeira conta
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contas.map((conta) => (
            <Card key={conta.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{conta.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {conta.bankName ?? 'Banco não informado'}
                        {conta.agency && ` • Ag. ${conta.agency}`}
                        {conta.accountNumber && ` • ${conta.accountNumber}`}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/empresas/${empresaId}/contas/${conta.id}/transacoes`} className="flex items-center gap-2">
                          <ArrowUpRight className="h-4 w-4" />Ver transações
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/empresas/${empresaId}/contas/${conta.id}/editar`} className="flex items-center gap-2">
                          <Pencil className="h-4 w-4" />Editar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive flex items-center gap-2"
                        onClick={() => setDeleteTarget({ id: conta.id, nome: conta.name })}>
                        <Trash2 className="h-4 w-4" />Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="outline">{TIPO_LABELS[conta.accountType] ?? conta.accountType}</Badge>
                  <div className={`flex items-center gap-1 font-bold text-lg ${conta.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {conta.balance >= 0
                      ? <ArrowUpRight className="h-4 w-4" />
                      : <ArrowDownRight className="h-4 w-4" />}
                    {formatBRL(conta.balance)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        empresaNome={deleteTarget?.nome ?? ''}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}
