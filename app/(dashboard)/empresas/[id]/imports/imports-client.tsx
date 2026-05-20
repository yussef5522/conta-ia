'use client'

// UI histórico de imports OFX — Sprint 2.3 Onda 2.

import { useCallback, useEffect, useState } from 'react'
import {
  Upload,
  FileText,
  Loader2,
  RotateCcw,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  importStatusLabel,
  importStatusColor,
  formatFileSize,
  formatPeriod,
} from '@/lib/ofx/format-imports'

interface ImportRow {
  id: string
  status: string
  fileName: string
  fileSize: number
  totalTransactions: number
  newTransactions: number
  duplicates: number
  autoClassified: number
  periodStart: string | null
  periodEnd: string | null
  errorMessage: string | null
  revertedAt: string | null
  createdAt: string
  bankAccount: { id: string; name: string; bankName: string | null }
  user: { id: string; name: string; email: string }
  revertedBy: { id: string; name: string } | null
}

interface Conta {
  id: string
  name: string
  bankName: string | null
}

interface Props {
  empresaId: string
  empresaNome: string
  contas: Conta[]
}

export function ImportsClient({ empresaId, empresaNome, contas }: Props) {
  const { toast } = useToast()

  const [items, setItems] = useState<ImportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<{
    total: number
    page: number
    totalPages: number
  } | null>(null)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('ALL')
  const [bankAccountId, setBankAccountId] = useState('ALL')

  const [viewing, setViewing] = useState<ImportRow | null>(null)
  const [confirmRevert, setConfirmRevert] = useState<ImportRow | null>(null)

  const fetchData = useCallback(
    async (resetPage = false) => {
      setLoading(true)
      const nextPage = resetPage ? 1 : page
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          status,
        })
        if (bankAccountId !== 'ALL') params.set('bankAccountId', bankAccountId)
        const res = await fetch(
          `/api/empresas/${empresaId}/imports?${params.toString()}`,
        )
        const json = await res.json()
        if (!res.ok) {
          toast({
            variant: 'destructive',
            title: 'Erro',
            description: json.erro ?? 'Falha.',
          })
          return
        }
        setItems(json.items)
        setPagination(json.pagination)
        if (resetPage) setPage(1)
      } finally {
        setLoading(false)
      }
    },
    [empresaId, page, status, bankAccountId, toast],
  )

  useEffect(() => {
    void fetchData(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    void fetchData(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bankAccountId])

  async function revertImport(imp: ImportRow) {
    const res = await fetch(
      `/api/empresas/${empresaId}/imports/${imp.id}/revert`,
      { method: 'POST' },
    )
    const json = await res.json()
    if (!res.ok) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: json.erro ?? 'Falha ao reverter.',
      })
      return
    }
    toast({
      title: 'Import revertido',
      description: `${json.transacoesDeletadas} transação${json.transacoesDeletadas === 1 ? '' : 'ões'} deletadas. Saldo ajustado.`,
    })
    setConfirmRevert(null)
    void fetchData(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {empresaNome}
        </p>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" />
          Histórico de Imports OFX
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Auditoria de todos os extratos importados. Reverter remove as
          transações e ajusta saldo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="SUCCESS">Concluídos</SelectItem>
              <SelectItem value="PROCESSING">Processando</SelectItem>
              <SelectItem value="FAILED">Falhados</SelectItem>
              <SelectItem value="REVERTED">Revertidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label className="text-xs">Conta</Label>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.bankName ? `${c.bankName} · ` : ''}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        {loading && items.length === 0 ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum import encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-3 py-2">Data</th>
                <th className="text-left px-3 py-2">Arquivo</th>
                <th className="text-left px-3 py-2">Conta</th>
                <th className="text-left px-3 py-2">Período</th>
                <th className="text-right px-3 py-2 tabular-nums">Tx (nov/dup/auto)</th>
                <th className="text-left px-3 py-2">Por</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((imp) => {
                const sc = importStatusColor(imp.status)
                return (
                  <tr
                    key={imp.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {new Date(imp.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate max-w-[180px] font-mono text-xs">
                            {imp.fileName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatFileSize(imp.fileSize)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <p className="font-medium">{imp.bankAccount.name}</p>
                      {imp.bankAccount.bankName && (
                        <p className="text-[10px] text-muted-foreground">
                          {imp.bankAccount.bankName}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums">
                      {formatPeriod(imp.periodStart, imp.periodEnd)}
                    </td>
                    <td className="px-3 py-2 text-xs text-right font-mono tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {imp.newTransactions}
                      </span>
                      {' / '}
                      <span className="text-muted-foreground">
                        {imp.duplicates}
                      </span>
                      {' / '}
                      <span className="text-blue-600 dark:text-blue-400">
                        {imp.autoClassified}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs truncate max-w-[120px]">
                      {imp.user.name}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${sc.bg} ${sc.text}`}
                      >
                        {imp.status === 'SUCCESS' && (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {imp.status === 'FAILED' && (
                          <XCircle className="h-3 w-3" />
                        )}
                        {imp.status === 'REVERTED' && (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        {imp.status === 'PROCESSING' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {importStatusLabel(imp.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          aria-label="Detalhes"
                          onClick={() => setViewing(imp)}
                          className="h-7 w-7 rounded hover:bg-muted inline-flex items-center justify-center"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {imp.status === 'SUCCESS' && (
                          <button
                            aria-label="Reverter"
                            onClick={() => setConfirmRevert(imp)}
                            className="h-7 w-7 rounded hover:bg-destructive/10 hover:text-destructive inline-flex items-center justify-center"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
            <span>
              Página {pagination.page} de {pagination.totalPages} ·{' '}
              {pagination.total} imports
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {viewing && (
        <Dialog open onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-mono text-base">
                {viewing.fileName}
              </DialogTitle>
              <DialogDescription>
                {new Date(viewing.createdAt).toLocaleString('pt-BR')} ·{' '}
                {viewing.user.name}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2 text-sm">
              <DetailRow label="Conta" value={viewing.bankAccount.name} />
              <DetailRow label="Banco" value={viewing.bankAccount.bankName ?? '—'} />
              <DetailRow
                label="Período"
                value={formatPeriod(viewing.periodStart, viewing.periodEnd)}
              />
              <DetailRow label="Tamanho" value={formatFileSize(viewing.fileSize)} />
              <DetailRow
                label="Total lidas"
                value={String(viewing.totalTransactions)}
              />
              <DetailRow
                label="Novas"
                value={String(viewing.newTransactions)}
                hl="emerald"
              />
              <DetailRow
                label="Duplicadas"
                value={String(viewing.duplicates)}
              />
              <DetailRow
                label="Auto-classificadas"
                value={String(viewing.autoClassified)}
                hl="blue"
              />
              <DetailRow label="Status" value={importStatusLabel(viewing.status)} />
              {viewing.revertedAt && viewing.revertedBy && (
                <DetailRow
                  label="Revertido"
                  value={`${new Date(viewing.revertedAt).toLocaleDateString('pt-BR')} · ${viewing.revertedBy.name}`}
                  hl="amber"
                />
              )}
            </div>

            {viewing.errorMessage && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                <p className="font-mono text-rose-600 dark:text-rose-400">
                  {viewing.errorMessage}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setViewing(null)}
                className="w-full"
              >
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmRevert && (
        <ConfirmDialog
          open={!!confirmRevert}
          onOpenChange={(o) => !o && setConfirmRevert(null)}
          title="Reverter este import?"
          description={
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p>
                    <strong>{confirmRevert.newTransactions}</strong> transações
                    serão deletadas. O saldo da conta será ajustado.
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Esta operação é IRREVERSÍVEL.
                  </p>
                </div>
              </div>
              <p className="text-xs">
                Após reverter, você pode re-importar o mesmo arquivo
                (deduplicação fica liberada).
              </p>
            </div>
          }
          confirmLabel="Reverter"
          variant="destructive"
          onConfirm={async () => {
            await revertImport(confirmRevert)
          }}
        />
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  hl,
}: {
  label: string
  value: string
  hl?: 'emerald' | 'blue' | 'amber'
}) {
  const colorClass =
    hl === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : hl === 'blue'
        ? 'text-blue-600 dark:text-blue-400'
        : hl === 'amber'
          ? 'text-amber-600 dark:text-amber-400'
          : ''
  return (
    <div className="rounded border p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-semibold tabular-nums mt-0.5 ${colorClass}`}>
        {value}
      </p>
    </div>
  )
}
