// Sprint Empréstimos UI — Cadastro novo empréstimo

'use client'

import { useEffect, useState, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Calculator,
  Loader2,
  AlertCircle,
  Link2,
  CheckCircle2,
  Sparkles,
  Upload,
  History,
} from 'lucide-react'
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
import { fmtPercentValue, cleanFloat } from '@/lib/loans/format'

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

  // Modo "EM_ANDAMENTO" quando AI detectou parcelas pagas OU user marca manual
  const [modo, setModo] = useState<'NOVO' | 'EM_ANDAMENTO'>('NOVO')
  const [aiExtracting, setAiExtracting] = useState(false)
  const [aiWarnings, setAiWarnings] = useState<string[]>([])
  // Sprint Fix-Previa: lista de parcelas futuras com payment LÍQUIDO (após
  // desconto). Vem do PDF e é enviada como paymentOverrides ao salvar.
  const [paymentOverrides, setPaymentOverrides] = useState<
    Array<{ number: number; payment: number }>
  >([])

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
    tarifas: '0',
    disbursementDate: '',
    // EM_ANDAMENTO
    outstandingBalanceInitial: '',
    installmentsPaidBefore: '0',
    amortizationConstant: '',
    rateType: 'PRE' as 'PRE' | 'POS',
    indexer: '' as '' | 'CDI' | 'SELIC' | 'IPCA',
    indexerPercent: '100',
    estimatedCorrectionMonthly: '0',
    futureCount: '',
    trackingStartDate: '',
    carencia: '0',
  })

  async function handleUploadPdf(file: File) {
    setAiExtracting(true)
    setAiWarnings([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/empresas/${empresaId}/emprestimos/extrair-contrato`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const body = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Não consegui ler o contrato',
          description: body.erro,
        })
        return
      }
      const e = body.extraction
      // Pré-preenche
      const next = { ...form }
      if (e.bank) next.lender = e.bank
      if (e.contractNumber) next.contractNumber = e.contractNumber
      if (e.amortizationSystem) next.amortizationSystem = e.amortizationSystem
      if (e.principal) next.principal = String(e.principal)
      if (e.iof !== null) next.iof = String(e.iof)
      if (e.tarifas !== null) next.tarifas = String(e.tarifas)
      // Sprint Fix-Arredondamento: cleanFloat elimina lixo de float
      // (0.0035 * 100 = 0.35000000000000003 → 0.35)
      if (e.taxaPreMensal !== null)
        next.interestRateMonthly = String(cleanFloat(e.taxaPreMensal * 100))
      if (e.nParcelas) next.termMonths = String(e.nParcelas)
      if (e.carencia !== null) next.carencia = String(e.carencia)
      if (e.amortizacaoConstante !== null) next.amortizationConstant = String(e.amortizacaoConstante)
      if (e.rateType) next.rateType = e.rateType
      if (e.indexer) next.indexer = e.indexer
      if (e.indexerPercent !== null) next.indexerPercent = String(e.indexerPercent)
      // Modo EM_ANDAMENTO se há parcelas pagas
      if (e.parcelasPagas !== null && e.parcelasPagas > 0) {
        setModo('EM_ANDAMENTO')
        next.installmentsPaidBefore = String(e.parcelasPagas)
        if (e.saldoDevedorAtual) next.outstandingBalanceInitial = String(e.saldoDevedorAtual)
        if (e.parcelasAPagar) next.futureCount = String(e.parcelasAPagar)
        // 1ª parcela futura = primeira da lista (se veio)
        if (e.parcelasAPagarLista && e.parcelasAPagarLista.length > 0) {
          next.firstDueDate = e.parcelasAPagarLista[0].dueDate
          next.trackingStartDate = e.parcelasAPagarLista[0].dueDate
          // Sprint Fix-Previa: payment LÍQUIDO (após desconto) — o que realmente
          // debita. Casa melhor no extrato. Quando o PDF traz `discount`, o
          // líquido = payment − discount; senão usa payment direto.
          const overrides = e.parcelasAPagarLista.map(
            (p: { number: number; payment: number; discount?: number | null }) => ({
              number: p.number,
              payment: p.discount ? p.payment - p.discount : p.payment,
            }),
          )
          setPaymentOverrides(overrides)
        } else {
          setPaymentOverrides([])
        }
      } else {
        setModo('NOVO')
        setPaymentOverrides([])
        if (e.primeiraParcela) next.firstDueDate = e.primeiraParcela
      }
      setForm(next)
      if (e.warnings && e.warnings.length > 0) setAiWarnings(e.warnings)
      toast({
        title: 'Contrato lido pela IA',
        description:
          e.parcelasPagas > 0
            ? `Empréstimo em andamento detectado: ${e.parcelasPagas} pagas, ${e.parcelasAPagar} a pagar. Confira antes de salvar.`
            : 'Pré-preenchido. Confira antes de salvar.',
      })
    } finally {
      setAiExtracting(false)
    }
  }

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}/contas-bancarias`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.contasBancarias) setContas(d.contasBancarias)
        else if (d?.contas) setContas(d.contas)
      })
  }, [empresaId])

  // 2 previews distintas — Sprint Fix-Previa (17/06/2026):
  //   1) NOVO: SAC/PRICE pré-fixado clássico (calculado do principal)
  //   2) EM_ANDAMENTO / POS: realidade futura — saldo devedor real, futuras,
  //      amortização constante, juros pré ESTIMADO. NÃO mostra "total juros"
  //      fixo porque pós-fixado tem correção CDI variável.
  const preview = useMemo(() => {
    const i = parseFloat(form.interestRateMonthly) / 100

    if (modo === 'EM_ANDAMENTO') {
      const saldo = parseFloat(form.outstandingBalanceInitial)
      const futuras = parseInt(form.futureCount, 10)
      const amortConst =
        form.amortizationSystem === 'SAC' && form.amortizationConstant
          ? parseFloat(form.amortizationConstant)
          : saldo && futuras
            ? saldo / futuras
            : 0
      if (!saldo || !futuras) return null
      const juros1Estimado = isFinite(i) ? saldo * i : 0
      // Soma estimada de juros PRÉ ao longo das parcelas futuras (informativa).
      // Pra SAC: soma de saldo decrescente × i. Pra PRICE: já fica embutida no PMT.
      let jurosPreFuturoEstimado = 0
      let s = saldo
      for (let k = 0; k < futuras; k++) {
        if (!isFinite(i)) break
        jurosPreFuturoEstimado += s * i
        s = Math.max(0, s - amortConst)
      }
      return {
        kind: 'EM_ANDAMENTO' as const,
        saldoDevedor: saldo,
        futuras,
        amortConst,
        juros1Estimado,
        jurosPreFuturoEstimado,
        isPosFixed: form.rateType === 'POS',
      }
    }

    // NOVO (pré-fixado)
    const p = parseFloat(form.principal)
    const n = parseInt(form.termMonths, 10)
    if (!p || !n || isNaN(i)) return null
    if (form.amortizationSystem === 'PRICE') {
      const pmt = i === 0 ? p / n : (p * i) / (1 - Math.pow(1 + i, -n))
      return {
        kind: 'NOVO' as const,
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
      const totalJuros = (p * i * (n + 1)) / 2
      return {
        kind: 'NOVO' as const,
        parcela1: pmt1,
        juros1,
        amort1: amort,
        totalPago: p + totalJuros,
        totalJuros,
      }
    }
  }, [
    modo,
    form.principal,
    form.interestRateMonthly,
    form.termMonths,
    form.amortizationSystem,
    form.outstandingBalanceInitial,
    form.futureCount,
    form.amortizationConstant,
    form.rateType,
  ])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.bankAccountId || !form.lender) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios faltando' })
      return
    }
    if (modo === 'NOVO' && (!form.principal || !form.firstDueDate || !form.disbursementDate)) {
      toast({ variant: 'destructive', title: 'Faltam dados do empréstimo novo' })
      return
    }
    if (modo === 'EM_ANDAMENTO' && (!form.outstandingBalanceInitial || !form.futureCount || !form.firstDueDate)) {
      toast({
        variant: 'destructive',
        title: 'Faltam dados do empréstimo em andamento',
        description: 'Saldo devedor atual + parcelas a pagar + 1ª parcela futura',
      })
      return
    }
    setSubmitting(true)
    try {
      const payload =
        modo === 'NOVO'
          ? {
              modo: 'NOVO' as const,
              bankAccountId: form.bankAccountId,
              lender: form.lender.trim(),
              contractNumber: form.contractNumber.trim() || null,
              principal: parseFloat(form.principal),
              interestRateMonthly: parseFloat(form.interestRateMonthly) / 100,
              termMonths: parseInt(form.termMonths, 10),
              amortizationSystem: form.amortizationSystem,
              firstDueDate: form.firstDueDate,
              iof: parseFloat(form.iof || '0'),
              tarifas: parseFloat(form.tarifas || '0'),
              disbursementDate: form.disbursementDate,
              rateType: form.rateType,
              indexer: form.indexer || null,
              indexerPercent: form.indexer ? parseFloat(form.indexerPercent) : null,
              carencia: parseInt(form.carencia || '0', 10),
            }
          : {
              modo: 'EM_ANDAMENTO' as const,
              bankAccountId: form.bankAccountId,
              lender: form.lender.trim(),
              contractNumber: form.contractNumber.trim() || null,
              outstandingBalanceInitial: parseFloat(form.outstandingBalanceInitial),
              termMonths: parseInt(form.termMonths, 10),
              installmentsPaidBefore: parseInt(form.installmentsPaidBefore, 10),
              interestRateMonthly: parseFloat(form.interestRateMonthly) / 100,
              amortizationSystem: form.amortizationSystem,
              amortizationConstant: form.amortizationConstant
                ? parseFloat(form.amortizationConstant)
                : null,
              rateType: form.rateType,
              indexer: form.indexer || null,
              indexerPercent: form.indexer ? parseFloat(form.indexerPercent) : null,
              estimatedCorrectionMonthly: parseFloat(form.estimatedCorrectionMonthly) / 100,
              firstDueDate: form.firstDueDate,
              trackingStartDate: form.trackingStartDate || form.firstDueDate,
              disbursementDate: form.disbursementDate || form.firstDueDate,
              iof: parseFloat(form.iof || '0'),
              tarifas: parseFloat(form.tarifas || '0'),
              carencia: parseInt(form.carencia || '0', 10),
              futureCount: parseInt(form.futureCount, 10),
              paymentOverrides:
                paymentOverrides.length > 0 ? paymentOverrides : undefined,
            }
      const res = await fetch(`/api/empresas/${empresaId}/emprestimos`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

      {/* Upload PDF — AI extrai e pré-preenche */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-semibold">Tem o PDF do contrato?</p>
            <p className="text-xs text-muted-foreground">
              A IA extrai banco, taxa, sistema, saldo devedor atual e parcelas restantes
              automaticamente. Você confere antes de salvar.
            </p>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-background hover:bg-primary/10 cursor-pointer transition-colors">
              {aiExtracting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Lendo contrato com IA…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Enviar contrato (PDF)
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={aiExtracting}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUploadPdf(f)
                }}
              />
            </label>
            {aiWarnings.length > 0 && (
              <ul className="text-xs text-amber-700 space-y-0.5 pt-1">
                {aiWarnings.map((w, idx) => (
                  <li key={idx}>⚠ {w}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs NOVO / EM_ANDAMENTO */}
      <div className="inline-flex bg-muted/50 rounded-md p-1 text-sm">
        <button
          type="button"
          onClick={() => setModo('NOVO')}
          className={`px-3 py-1.5 rounded ${modo === 'NOVO' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
        >
          Empréstimo novo
        </button>
        <button
          type="button"
          onClick={() => setModo('EM_ANDAMENTO')}
          className={`px-3 py-1.5 rounded inline-flex items-center gap-1 ${modo === 'EM_ANDAMENTO' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
        >
          <History className="h-3.5 w-3.5" />
          Em andamento
        </button>
      </div>

      {modo === 'EM_ANDAMENTO' && (
        <Card className="border-amber-300 bg-amber-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900">Confira antes de salvar</p>
              <p className="text-amber-800/80 text-xs mt-0.5">
                Empréstimo em andamento entra pelo <strong>SALDO DEVEDOR ATUAL</strong>, NÃO pelo
                principal original. Parcelas já pagas ficam só como histórico — não viram lançamento
                novo, não poluem o DRE com juros passados. Confira saldo + taxa antes de salvar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

        {/* Card EM_ANDAMENTO específico — destaque saldo devedor */}
        {modo === 'EM_ANDAMENTO' && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Estado atual (campo destacado = revise SEMPRE)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Saldo devedor ATUAL *">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.outstandingBalanceInitial}
                    onChange={(e) =>
                      setForm({ ...form, outstandingBalanceInitial: e.target.value })
                    }
                    placeholder="40295.17"
                    className="border-primary/50 focus-visible:ring-primary text-base font-semibold"
                    required
                  />
                </Field>
                <Field label="Parcelas já pagas (histórico)">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={form.installmentsPaidBefore}
                    onChange={(e) =>
                      setForm({ ...form, installmentsPaidBefore: e.target.value })
                    }
                  />
                </Field>
                <Field label="Parcelas a pagar (futuras) *">
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={form.futureCount}
                    onChange={(e) => setForm({ ...form, futureCount: e.target.value })}
                    required
                  />
                </Field>
                {form.amortizationSystem === 'SAC' && (
                  <Field label="Amortização constante (SAC)">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amortizationConstant}
                      onChange={(e) =>
                        setForm({ ...form, amortizationConstant: e.target.value })
                      }
                      placeholder="1898.69"
                    />
                  </Field>
                )}
                <Field label="Data 1ª parcela futura *">
                  <Input
                    type="date"
                    value={form.firstDueDate}
                    onChange={(e) => setForm({ ...form, firstDueDate: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Pré ou pós-fixado">
                  <Select
                    value={form.rateType}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        rateType: v as 'PRE' | 'POS',
                        indexer: v === 'PRE' ? '' : form.indexer || 'CDI',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRE">Pré-fixado</SelectItem>
                      <SelectItem value="POS">Pós-fixado (indexado)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.rateType === 'POS' && (
                  <>
                    <Field label="Indexador">
                      <Select
                        value={form.indexer || 'CDI'}
                        onValueChange={(v) =>
                          setForm({ ...form, indexer: v as 'CDI' | 'SELIC' | 'IPCA' })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CDI">CDI</SelectItem>
                          <SelectItem value="SELIC">SELIC</SelectItem>
                          <SelectItem value="IPCA">IPCA</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="% indexador (100 = 100%)">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.indexerPercent}
                        onChange={(e) => setForm({ ...form, indexerPercent: e.target.value })}
                      />
                    </Field>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-medium">
              {modo === 'NOVO' ? 'Valores' : 'Contrato original (informativo)'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field
                label={
                  modo === 'NOVO'
                    ? 'Valor liberado *'
                    : 'Valor original (informativo)'
                }
              >
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.principal}
                  onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  placeholder="100000.00"
                  required={modo === 'NOVO'}
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

        {preview && preview.kind === 'NOVO' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="flex items-center gap-2 col-span-2 md:col-span-4">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Pré-visualização ({form.amortizationSystem}) — empréstimo novo
                </span>
              </div>
              <Box label="1ª parcela" value={formatBRL(preview.parcela1)} />
              <Box label="Juros (1ª)" value={formatBRL(preview.juros1)} tone="muted" />
              <Box label="Total pago" value={formatBRL(preview.totalPago)} />
              <Box label="Total juros" value={formatBRL(preview.totalJuros)} tone="muted" />
            </CardContent>
          </Card>
        )}

        {preview && preview.kind === 'EM_ANDAMENTO' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground">
                  Pré-visualização — empréstimo em andamento ({form.amortizationSystem}
                  {preview.isPosFixed ? ' · pós-fixado' : ' · pré-fixado'})
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Box label="Saldo devedor" value={formatBRL(preview.saldoDevedor)} />
                <Box label="Parcelas futuras" value={String(preview.futuras)} tone="muted" />
                <Box label="Amortização constante" value={formatBRL(preview.amortConst)} />
                <Box
                  label={preview.isPosFixed ? 'Juros pré (1ª, estimado)' : 'Juros (1ª)'}
                  value={formatBRL(preview.juros1Estimado)}
                  tone="muted"
                />
              </div>
              {preview.isPosFixed ? (
                <div className="rounded border border-amber-200 bg-amber-50/40 px-3 py-2 text-xs text-amber-900 space-y-1">
                  <p className="font-medium">⚠ Pós-fixado — não dá pra prever o total</p>
                  <p className="text-amber-800/80">
                    A parcela <strong>varia com o {form.indexer || 'CDI'}</strong>. A taxa pré (
                    <strong>{fmtPercentValue(form.interestRateMonthly)}% a.m.</strong>) é só o spread fixo; a
                    correção {form.indexer || 'CDI'} entra por cima e <strong>só é conhecida
                    quando a parcela debita no extrato</strong>. Estimativa de juros pré pra todas
                    as {preview.futuras} parcelas futuras: ~
                    <strong>{formatBRL(preview.jurosPreFuturoEstimado)}</strong> + correção{' '}
                    {form.indexer || 'CDI'} variável.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Estimativa de juros pré pra todas as {preview.futuras} parcelas futuras: ~
                  <strong>{formatBRL(preview.jurosPreFuturoEstimado)}</strong>
                </p>
              )}
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
