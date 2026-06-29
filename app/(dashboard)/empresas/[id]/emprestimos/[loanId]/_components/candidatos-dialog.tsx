// Sprint Pagamento Parcela Redesign (28/06/2026, nível Xero/QuickBooks).
//
// 2 estados num modal:
//   1. Lista de candidatos: cards com selo IA + confidence
//   2. Confirmação do candidato escolhido: comparação Esperado→Pago,
//      banner CDI (pos-fixado), breakdown "Como fica nos livros", confirmar
//
// Endpoint GET /candidatos retorna confidence + split por candidato (FASE 1).
// POST /parcelas/[n] recalcula split contábil server-side (FASE 3).

'use client'

import { useEffect, useState } from 'react'
import {
  CircleCheck,
  Loader2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  X,
  ChevronLeft,
  Receipt,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface Confidence {
  score: number
  label: 'Tenho certeza' | 'Confira' | 'Confira com atenção'
  evidences: string[]
}

interface Split {
  realPayment: number
  interest: number
  correcao: number
  closingBalance: number
  totalDespesaFinanceira: number
}

interface Candidate {
  id: string
  date: string
  amount: number
  description: string
  origin: string
  amountDiff: number
  daysDiff: number
  confidence: Confidence
  split: Split
}

interface CandidatosResponse {
  installmentNumber: number
  contractNumber: string | null
  lender: string
  dueDate: string
  payment: number
  interest: number
  amortization: number
  openingBalance: number
  isEstimate: boolean
  rateMonthly: number
  candidates: Candidate[]
}

interface Props {
  empresaId: string
  loanId: string
  parcelaNumber: number
  onClose: () => void
  onConfirmed: () => void
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

export function CandidatosDialog({
  empresaId,
  loanId,
  parcelaNumber,
  onClose,
  onConfirmed,
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CandidatosResponse | null>(null)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(
      `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}/candidatos`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [empresaId, loanId, parcelaNumber])

  async function confirmar() {
    if (!selected) return
    setConfirming(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/emprestimos/${loanId}/parcelas/${parcelaNumber}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: selected.id }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Falha', description: body.erro })
        return
      }
      const result = await res.json()
      const splitMsg = result.split
        ? `Juros ${formatBRL(result.split.interest)}` +
          (result.split.correcao > 0 ? ` + Correção CDI ${formatBRL(result.split.correcao)}` : '')
        : ''
      toast({
        variant: 'success',
        title: `Parcela #${parcelaNumber} conciliada`,
        description: splitMsg || undefined,
      })
      onConfirmed()
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Buscando candidatos…
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!data) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <div className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar.
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (selected) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <ConfirmaSelecaoView
            installment={data}
            candidate={selected}
            confirming={confirming}
            onBack={() => setSelected(null)}
            onConfirm={confirmar}
            onCancel={onClose}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pagamento da parcela #{parcelaNumber}
            {data.isEstimate && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                pós-fix
              </span>
            )}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {data.lender}
            {data.contractNumber && ` · ${data.contractNumber}`} · Vence{' '}
            <strong>{fmtDate(data.dueDate)}</strong> · Valor planejado{' '}
            <strong>{formatBRL(data.payment)}</strong>
          </p>
        </DialogHeader>

        {data.candidates.length === 0 ? (
          <div className="py-6 flex items-start gap-3 bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/50 dark:border-amber-900/30 rounded-md px-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">
                Nenhum débito do extrato bate
              </p>
              <p className="text-amber-800/80 dark:text-amber-300/80 text-xs mt-0.5">
                Janela ±7 dias do vencimento + valor{' '}
                {data.isEstimate ? 'até 25% acima (CDI/IPCA)' : '±R$ 1'}. Talvez o pagamento ainda não importou (OFX/PDF).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              {data.candidates.length === 1 ? '1 candidato encontrado' : `${data.candidates.length} candidatos encontrados`} · Escolha o pagamento real
            </p>
            {data.candidates.map((c) => (
              <CandidatoCard key={c.id} candidate={c} onSelect={() => setSelected(c)} />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CandidatoCard({ candidate, onSelect }: { candidate: Candidate; onSelect: () => void }) {
  const c = candidate
  const conf = c.confidence
  const tone =
    conf.label === 'Tenho certeza'
      ? 'emerald'
      : conf.label === 'Confira'
        ? 'amber'
        : 'slate'
  const toneCls = {
    emerald: 'border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/15',
    amber: 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/15',
    slate: 'border-slate-200/60 dark:border-slate-800/60 bg-card',
  }[tone]
  const sealCls = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  }[tone]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-all hover:ring-2 hover:ring-blue-300/60 ${toneCls}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${sealCls}`}>
              IA · {Math.round(conf.score * 100)}% · {conf.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              {c.origin}
            </span>
          </div>
          <p className="text-sm font-medium mt-1 truncate">{c.description}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {fmtDate(c.date)}
            {c.daysDiff === 0 ? ' · mesma data' : ` · Δ ${Math.abs(c.daysDiff)}d`}
            {c.amountDiff !== 0 && (
              <span className={c.amountDiff > 0 ? 'ml-2 text-amber-700 dark:text-amber-400' : 'ml-2 text-red-700 dark:text-red-400'}>
                · Δ {c.amountDiff > 0 ? '+' : ''}{formatBRL(c.amountDiff)}
              </span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">{formatBRL(c.amount)}</p>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground inline-block mt-1" />
        </div>
      </div>
      {conf.evidences.length > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1.5 pl-5">
          {conf.evidences.slice(0, 2).join(' · ')}
        </p>
      )}
    </button>
  )
}

function ConfirmaSelecaoView({
  installment,
  candidate,
  confirming,
  onBack,
  onConfirm,
  onCancel,
}: {
  installment: CandidatosResponse
  candidate: Candidate
  confirming: boolean
  onBack: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const c = candidate
  const split = c.split
  const isPosFix = installment.isEstimate
  const diffPositivo = c.amountDiff > 0.5
  const showCDIBanner = isPosFix && diffPositivo

  return (
    <div>
      <div className="px-6 pt-5 pb-3 border-b border-slate-200/70 dark:border-slate-800/70">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center mb-2"
        >
          <ChevronLeft className="h-3 w-3 mr-1" />
          Voltar pros candidatos
        </button>
        <h2 className="text-base font-medium flex items-center gap-2">
          Confirmar pagamento da parcela #{installment.installmentNumber}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {installment.lender}
          {installment.contractNumber && ` · ${installment.contractNumber}`}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-400">
            IA · {Math.round(c.confidence.score * 100)}% · {c.confidence.label}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        <section>
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5">
            Transação encontrada no extrato
          </p>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.description}</p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtDate(c.date)} · origem {c.origin}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(c.amount)}</span>
            </div>
          </div>
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5">
            Comparação
          </p>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-card p-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Esperado</p>
              <p className="text-sm font-semibold tabular-nums">{formatBRL(installment.payment)}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pago</p>
              <p className="text-sm font-semibold tabular-nums">{formatBRL(c.amount)}</p>
            </div>
            {c.amountDiff !== 0 && (
              <span
                className={`ml-auto text-[11px] font-semibold px-2 py-1 rounded ${
                  c.amountDiff > 0
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    : 'bg-red-500/15 text-red-700 dark:text-red-400'
                }`}
              >
                {c.amountDiff > 0 ? '+' : ''}
                {formatBRL(c.amountDiff)}
              </span>
            )}
          </div>
        </section>

        {showCDIBanner && (
          <div className="rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  A diferença é correção do CDI (parcela pós-fixada)
                </p>
                <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Pelo STJ, isso é juros na essência → vai pro DRE como{' '}
                  <strong>Despesa Financeira</strong> junto com os juros do contrato.
                </p>
              </div>
            </div>
          </div>
        )}

        <section>
          <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Receipt className="h-3 w-3" /> Como fica nos livros
          </p>
          <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-card divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
            <BookLine
              label="Amortização do principal"
              value={installment.amortization}
              hint="Abate dívida no balanço · fora do DRE"
              tone="muted"
            />
            <BookLine
              label="Juros do contrato"
              value={split.interest}
              hint="Despesa Financeira no DRE"
              tone="red"
            />
            {split.correcao > 0 && (
              <BookLine
                label="Correção CDI"
                value={split.correcao}
                hint="Despesa Financeira no DRE (STJ: juros na essência)"
                tone="red"
              />
            )}
            <BookLine
              label="Total despesa financeira"
              value={split.totalDespesaFinanceira}
              hint={`Vai pra "Juros sobre Empréstimos"`}
              tone="bold"
            />
            <BookLine
              label="Total pago"
              value={split.realPayment}
              hint={`Saldo devedor após: ${formatBRL(split.closingBalance)}`}
              tone="bold"
            />
          </div>
        </section>
      </div>

      <div className="px-6 py-3 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/30">
        <Button variant="ghost" onClick={onCancel} disabled={confirming}>
          Não é esta
        </Button>
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 mr-1.5" />
          )}
          Confirmar pagamento
        </Button>
      </div>
    </div>
  )
}

function BookLine({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint?: string
  tone: 'muted' | 'red' | 'bold'
}) {
  const valueCls =
    tone === 'red'
      ? 'text-red-700 dark:text-red-400'
      : tone === 'bold'
        ? 'font-semibold'
        : 'text-muted-foreground'
  return (
    <div className="flex items-baseline justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className={`text-sm ${tone === 'bold' ? 'font-medium' : ''}`}>{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <span className={`tabular-nums ${valueCls}`}>{formatBRL(value)}</span>
    </div>
  )
}
