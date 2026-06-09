'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus, Landmark, MoreVertical, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Scale, Wallet, Upload } from 'lucide-react'
import {
  freshnessLabel,
  FRESHNESS_TONE_CLASSES,
} from '@/lib/contas-bancarias/freshness'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { DeleteDialog } from '@/components/empresas/delete-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { computeBalanceBadgeStatus, type BadgeVariant } from '@/lib/balance/badge-status'
import { NovaTransferenciaModal } from '@/components/transferencias/NovaTransferenciaModal'
import { AjustarSaldoModal } from '@/components/contas-bancarias/AjustarSaldoModal'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TIPO_LABELS: Record<string, string> = {
  CHECKING: 'Corrente',
  SAVINGS: 'Poupança',
  INVESTMENT: 'Investimento',
  CASH: 'Caixa',
}

interface Conta {
  id: string
  name: string
  bankName: string | null
  bankCode: string | null
  agency: string | null
  accountNumber: string | null
  accountType: string
  cashKind: string | null
  balance: number
  isActive: boolean
  allowNegativeBalance: boolean
  creditLimit: number
  lowBalanceThreshold: number | null
  // Sprint Unificar-Contas (08/06/2026) — herdado do endpoint
  lastSuccessfulImportAt: string | null
}

const VARIANT_STYLES: Record<BadgeVariant, { dot: string; label: string; text: string; percent: string }> = {
  green: {
    dot: 'bg-emerald-500',
    label: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    percent: 'text-emerald-600',
  },
  yellow: {
    dot: 'bg-amber-500',
    label: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    percent: 'text-amber-600',
  },
  red: {
    dot: 'bg-rose-500',
    label: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-800',
    text: 'text-rose-700 dark:text-rose-400',
    percent: 'text-rose-600',
  },
}

export default function ContasPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()

  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [transferenciaModal, setTransferenciaModal] = useState<{ fromAccountId?: string } | null>(null)
  const [ajustarSaldoTarget, setAjustarSaldoTarget] = useState<{ id: string; name: string; balance: number } | null>(null)

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
        {contas.length >= 2 && (
          <Button
            variant="outline"
            onClick={() => setTransferenciaModal({})}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />Nova Transferência
          </Button>
        )}
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
          {contas.map((conta) => {
            const isCash = conta.accountType === 'CASH'
            const status = computeBalanceBadgeStatus({
              balance: conta.balance,
              creditLimit: conta.creditLimit,
              lowBalanceThreshold: conta.lowBalanceThreshold,
            })
            const styles = VARIANT_STYLES[status.variant]
            return (
              <Card
                key={conta.id}
                className={`group ${isCash ? 'border-amber-200 bg-amber-50/40' : ''}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isCash ? 'bg-amber-100' : 'bg-primary/10'
                        }`}
                      >
                        {isCash ? (
                          <Wallet className="h-5 w-5 text-amber-700" />
                        ) : (
                          <Landmark className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{conta.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isCash
                            ? 'Dinheiro físico'
                            : (
                                <>
                                  {conta.bankName ?? 'Banco não informado'}
                                  {conta.agency && ` • Ag. ${conta.agency}`}
                                  {conta.accountNumber && ` • ${conta.accountNumber}`}
                                </>
                              )}
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
                        {contas.length >= 2 && (
                          <DropdownMenuItem
                            className="flex items-center gap-2"
                            onClick={() => setTransferenciaModal({ fromAccountId: conta.id })}
                          >
                            <ArrowLeftRight className="h-4 w-4" />Transferir desta conta
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/empresas/${empresaId}/contas/${conta.id}/editar`} className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" />Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2"
                          onClick={() => setAjustarSaldoTarget({ id: conta.id, name: conta.name, balance: conta.balance })}
                        >
                          <Scale className="h-4 w-4" />Ajustar saldo
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive flex items-center gap-2"
                          onClick={() => setDeleteTarget({ id: conta.id, nome: conta.name })}>
                          <Trash2 className="h-4 w-4" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0">
                        {TIPO_LABELS[conta.accountType] ?? conta.accountType}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles.label}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                        {status.label}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 font-bold text-lg shrink-0 ${styles.text}`}>
                      {conta.balance >= 0
                        ? <ArrowUpRight className="h-4 w-4" />
                        : <ArrowDownRight className="h-4 w-4" />}
                      {formatBRL(conta.balance)}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    {status.usagePercent !== null && status.percentColor ? (
                      <>
                        {status.subtext.split('(')[0]}(
                        <span className={`font-semibold ${VARIANT_STYLES[status.percentColor].percent}`}>
                          {status.usagePercent}%
                        </span>
                        )
                      </>
                    ) : (
                      status.subtext
                    )}
                  </p>

                  {/* Sprint Unificar-Contas (08/06/2026): freshness badge +
                      botão direto "Importar OFX" — herdados da /bancos antiga.
                      Em CASH não aparecem (dinheiro físico não tem extrato). */}
                  {!isCash && (() => {
                    const fresh = freshnessLabel(
                      conta.lastSuccessfulImportAt
                        ? new Date(conta.lastSuccessfulImportAt)
                        : null,
                    )
                    return (
                      <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${FRESHNESS_TONE_CLASSES[fresh.tone]}`}
                          title="Última importação OFX bem-sucedida"
                        >
                          <Upload className="h-2.5 w-2.5" />
                          {fresh.label}
                        </span>
                        <Button asChild variant="outline" size="sm" className="h-7">
                          <Link
                            href={`/empresas/${empresaId}/contas/${conta.id}/importar`}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Importar OFX
                          </Link>
                        </Button>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        empresaNome={deleteTarget?.nome ?? ''}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <NovaTransferenciaModal
        empresaId={empresaId}
        open={!!transferenciaModal}
        onOpenChange={(o) => !o && setTransferenciaModal(null)}
        defaultFromAccountId={transferenciaModal?.fromAccountId}
        onSuccess={() => {
          setTransferenciaModal(null)
          fetchContas()
        }}
      />

      <AjustarSaldoModal
        open={!!ajustarSaldoTarget}
        onOpenChange={(o) => !o && setAjustarSaldoTarget(null)}
        conta={ajustarSaldoTarget}
        onSuccess={() => {
          setAjustarSaldoTarget(null)
          fetchContas()
        }}
      />
    </div>
  )
}
