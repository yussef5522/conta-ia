// Sprint Empréstimos UI — Cadastro novo empréstimo

'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calculator, Loader2, AlertCircle, Link2, CheckCircle2 } from 'lucide-react'
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
import { useToast } from '@/components/ui/use-toast'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface BankAccount {
  id: string
  name: string
  bankName: string | null
}

interface Candidate {
  id: string
  date: string
  amount: number
  description: string
  deltaDays: number
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

export default function NovoEmprestimoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: empresaId } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const [contas, setContas] = useState<BankAccount[]>([])
  const [submitting, setSubmitting] = useState(false)

  // 2 etapas: 1) form, 2) linkar liberação
  const [step, setStep] = useState<'FORM' | 'LINK_DISBURSEMENT'>('FORM')
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [linking, setLinking] = useState(false)

  const [form, setForm] = useState({
    bankAccountId: '',
    lender: '',
    contractNumber: '',
    principal: '',
    interestRateMonthly: '',
    termMonths: '12',
    amortizationSystem: 'PRICE' as 'PRICE' | 'SAC',
    firstDueDate: '',
    iof: '0',
    disbursementDate: '',
  })

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/contas-bancarias`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.contasBancarias) setContas(d.contasBancarias)
        else if (d?.contas) setContas(d.contas)
      })
  }, [empresaId])

  // Preview da primeira parcela (cálculo local, instantâneo)
  const preview = useMemo(() => {
    const p = parseFloat(form.principal)
    const i = parseFloat(form.interestRateMonthly) / 100
    const n = parseInt(form.termMonths, 10)
    if (!p || !n || isNaN(i)) return null
    if (form.amortizationSystem === 'PRICE') {
      const pmt = i === 0 ? p / n : (p * i) / (1 - Math.pow(1 + i, -n))
      return {
        parcela1: pmt,
        juros1: p * i,
        amort1: pmt - p * i,
        totalPago: pmt * n,
        totalJuros: pmt * n - p,
      }
    } else {
      const amort = p / n
      const juros1 = p * i
      const pmt1 = amort + juros1
      const totalJuros = (p * i * (n + 1)) / 2 // soma juros SAC simplificada
      return {
        parcela1: pmt1,
        juros1,
        amort1: amort,
        totalPago: p + totalJuros,
        totalJuros,
      }
    }
  }, [form.principal, form.interestRateMonthly, form.termMonths, form.amortizationSystem])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.bankAccountId || !form.lender || !form.principal || !form.firstDueDate || !form.disbursementDate) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios faltando',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/empresas/${empresaId}/emprestimos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: form.bankAccountId,
          lender: form.lender.trim(),
          contractNumber: form.contractNumber.trim() || null,
          principal: parseFloat(form.principal),
          interestRateMonthly: parseFloat(form.interestRateMonthly) / 100,
          termMonths: parseInt(form.termMonths, 10),
          amortizationSystem: form.amortizationSystem,
          firstDueDate: form.firstDueDate,
          iof: parseFloat(form.iof || '0'),
          disbursementDate: form.disbursementDate,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Falha ao criar empréstimo',
          description: body.erro ?? `HTTP ${res.status}`,
        })
        return
      }
      const loanId = body.loan.id
      setCreatedLoanId(loanId)

      // Buscar candidatos de liberação
      const cRes = await fetch(
        `/api/empresas/${empresaId}/emprestimos/${loanId}/linkar-liberacao`,
        { credentials: 'include' },
      )
      if (cRes.ok) {
        const cBody = await cRes.json()
        setCandidates(cBody.candidates ?? [])
      }
      setStep('LINK_DISBURSEMENT')
      toast({ title: 'Empréstimo criado', description: `${body.loan.installments.length} parcelas geradas` })
    } finally {
      setSubmitting(false)
    }
  }

  async function linkar(txId: string) {
    if (!createdLoanId) return
    setLinking(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/emprestimos/${createdLoanId}/linkar-liberacao`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txId }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Falha ao linkar', description: body.erro })
        return
      }
      toast({ title: 'Liberação vinculada', description: 'Tx não vai mais aparecer como receita no DRE' })
      router.push(`/empresas/${empresaId}/emprestimos/${createdLoanId}`)
    } finally {
      setLinking(false)
    }
  }

  function pular() {
    if (createdLoanId) router.push(`/empresas/${empresaId}/emprestimos/${createdLoanId}`)
  }

  if (step === 'LINK_DISBURSEMENT' && createdLoanId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Header title="Linkar liberação" description="Empréstimo criado · vincule o crédito do extrato">
          <Button variant="ghost" onClick={pular}>
            Pular por agora
          </Button>
        </Header>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Por que linkar?</p>
              <p className="text-amber-800/80 text-xs mt-0.5">
                A liberação aparece como CREDIT no extrato. Sem o vínculo, o DRE conta como receita
                fake. Linkando, o sistema sabe que é PASSIVO e tira do resultado.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Candidatos no extrato</p>
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum CREDIT encontrado com valor próximo do principal ±5% e data ±15 dias.
                <br />
                Importe o OFX da conta primeiro, ou linke manualmente depois pelo detalhe do
                empréstimo.
              </p>
            ) : (
              <div className="space-y-2">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => linkar(c.id)}
                    disabled={linking}
                    className="w-full text-left grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-3 rounded-md border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(c.date)} ·{' '}
                        <span className={c.deltaDays === 0 ? 'text-emerald-700' : ''}>
                          {c.deltaDays === 0 ? 'mesma data' : `Δ ${c.deltaDays}d`}
                        </span>
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatBRL(c.amount)}</span>
                    <Link2 className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Header title="Novo empréstimo" description="Cadastre o financiamento + cronograma">
        <Link href={`/empresas/${empresaId}/emprestimos`}>
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
      </Header>

      <form onSubmit={handleCreate} className="space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Dados do contrato</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Banco / Instituição *">
                <Input
                  value={form.lender}
                  onChange={(e) => setForm({ ...form, lender: e.target.value })}
                  placeholder="Ex: Banrisul, Sicredi"
                  maxLength={80}
                  required
                />
              </Field>
              <Field label="Nº do contrato">
                <Input
                  value={form.contractNumber}
                  onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
                  placeholder="Ex: 123456789"
                  maxLength={40}
                />
              </Field>
              <Field label="Conta bancária *">
                <Select
                  value={form.bankAccountId}
                  onValueChange={(v) => setForm({ ...form, bankAccountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sistema de amortização *">
                <Select
                  value={form.amortizationSystem}
                  onValueChange={(v) =>
                    setForm({ ...form, amortizationSystem: v as 'PRICE' | 'SAC' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRICE">PRICE (parcela fixa)</SelectItem>
                    <SelectItem value="SAC">SAC (amortização constante)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">Valores</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Valor liberado *">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.principal}
                  onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  placeholder="100000.00"
                  required
                />
              </Field>
              <Field label="Taxa % ao mês *">
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.interestRateMonthly}
                  onChange={(e) => setForm({ ...form, interestRateMonthly: e.target.value })}
                  placeholder="2.5"
                  required
                />
              </Field>
              <Field label="Nº de parcelas *">
                <Input
                  type="number"
                  step="1"
                  min="1"
                  max="480"
                  value={form.termMonths}
                  onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                  required
                />
              </Field>
              <Field label="Data da liberação *">
                <Input
                  type="date"
                  value={form.disbursementDate}
                  onChange={(e) => setForm({ ...form, disbursementDate: e.target.value })}
                  required
                />
              </Field>
              <Field label="1º vencimento *">
                <Input
                  type="date"
                  value={form.firstDueDate}
                  onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
                  required
                />
              </Field>
              <Field label="IOF (R$)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.iof}
                  onChange={(e) => setForm({ ...form, iof: e.target.value })}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2 col-span-2 md:col-span-4">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Pré-visualização ({form.amortizationSystem})
                </span>
              </div>
              <Box label="1ª parcela" value={formatBRL(preview.parcela1)} />
              <Box label="Juros (1ª)" value={formatBRL(preview.juros1)} tone="muted" />
              <Box label="Total pago" value={formatBRL(preview.totalPago)} />
              <Box label="Total juros" value={formatBRL(preview.totalJuros)} tone="muted" />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Link href={`/empresas/${empresaId}/emprestimos`}>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Criando…
              </>
            ) : (
              'Criar empréstimo + cronograma'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Box({ label, value, tone }: { label: string; value: string; tone?: 'muted' }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          tone === 'muted' ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
