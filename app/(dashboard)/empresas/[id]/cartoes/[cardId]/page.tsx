// Sprint Cartao Credito PJ — dashboard do cartao (visao Mercury-like)

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { CreditCard, Upload, Loader2, ArrowLeft, Repeat, Link2, CheckCircle2, Undo2, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { formatBRL } from '@/lib/format/money'

interface DashboardData {
  card: {
    id: string
    name: string
    bankName: string | null
    brand: string | null
    lastDigits: string | null
    creditLimit: number
    closingDay: number
    dueDay: number
    monthSpend: number
    monthTxCount: number
    utilizationPct: number
    latestInvoiceMonth: string | null
    defaultTreatment: string
    socioPFId: string | null
    availableLimit: number
  }
  monthTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: string
    installmentNumber: number | null
    installmentTotal: number | null
    categoryId: string | null
    categoryName: string | null
    suggestedCategoryId: string | null
    isCardPayment: boolean
  }>
  expenseCategories: Array<{ id: string; name: string }>
  spendByCategory: Array<{
    categoryId: string | null
    categoryName: string
    amount: number
  }>
  matchedPayments: Array<{
    id: string
    date: string
    description: string
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
  }>
  availableInvoices: string[]
  currentInvoiceMonth: string | null
  paymentCandidates: Array<{
    id: string
    date: string
    description: string
    amount: number
    bankAccountId: string | null
    bankAccountName: string | null
    currentCategoryId: string | null
    currentCategoryName: string | null
    matchScore: number
    matchLabel: string
    isAlreadyMarkedPayment: boolean
  }>
}

export default function CartaoDashboardPage() {
  const params = useParams<{ id: string; cardId: string }>()
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [casandoId, setCasandoId] = useState<string | null>(null)
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
  const [socios, setSocios] = useState<Array<{ id: string; nome: string }>>([])
  const [savingTreatment, setSavingTreatment] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<{ count: number; sum: number; ids: string[] } | null>(null)
  const [expenseCats, setExpenseCats] = useState<Array<{ id: string; name: string }>>([])
  /**
   * ⭐⭐ CATEGORIZAR NA TELA DA FATURA (17/09/2026) — *"não tem como categorizar"*, e o dono
   * chamou pelo nome: **porta sem maçaneta**. As 33 linhas entraram sem categoria (é decisão
   * dele) e não havia onde decidir.
   *
   * ⚠️ REGRA 4: grava pelo **`/despesas/recategorizar`**, a MESMA porta que o "mover em lote"
   * desta tela já usava — inclusive pra UMA linha. Um segundo caminho de escrita aqui seria
   * a doença que este projeto mais paga.
   */
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  /**
   * ⭐⭐ O FEEDBACK DE SALVO (17/09) — **o botão que ele procurava não existe de propósito:
   * cada escolha grava na hora.** Mas então a tela TEM que dizer. ⛔ Silêncio depois do
   * clique é o sucesso-disfarçado (ou, como estava, o fracasso-disfarçado).
   *
   * `otimista` faz o seletor seguir o dedo na hora (o `value` vem de `data`, que só muda
   * depois do reload — sem isto o select **volta pra "sem categoria"** na frente dele);
   * `salvos` acende o selo ✓; e a FALHA **reverte** o otimista e mostra o motivo do servidor.
   */
  const [otimista, setOtimista] = useState<Record<string, string>>({})
  const [salvos, setSalvos] = useState<Set<string>>(new Set())
  const [batchTarget, setBatchTarget] = useState('')
  const [movingBatch, setMovingBatch] = useState(false)

  function loadReviewQueue() {
    fetch(`/api/empresas/${params.id}/cartoes/review-queue?cardId=${params.cardId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => setReviewQueue(q))
      .catch(() => {})
  }
  useEffect(() => {
    loadReviewQueue()
    fetch(`/api/empresas/${params.id}/categorias`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.categories ?? res?.categorias ?? [])
        // exclui a própria fila "A CLASSIFICAR" como destino
        setExpenseCats(list.filter((c: { dreGroup?: string }) => c.dreGroup !== 'A_CLASSIFICAR').map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.cardId])

  function alternar(id: string) {
    setMarcadas((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  async function categorizar(ids: string[], categoriaId: string | null) {
    // ⛔ "sem categoria" não é um destino: o endpoint exige categoria de verdade.
    if (!categoriaId || ids.length === 0) return
    setSalvando(true)
    // ⭐ o seletor segue o dedo AGORA — o `data` só volta depois do reload
    setOtimista((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, categoriaId])) }))
    try {
      const resp = await fetch(`/api/empresas/${params.id}/despesas/recategorizar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids, novaCategoriaId: categoriaId }),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        // ⛔ FALHA REVERTE — deixar a escolha na tela seria dizer que gravou
        setOtimista((p) => {
          const n = { ...p }
          for (const id of ids) delete n[id]
          return n
        })
        toast({
          title: 'Não consegui categorizar',
          description: [j.erro, j.saida?.rotulo].filter(Boolean).join(' · ') || 'tente de novo',
          variant: 'destructive',
        })
        return
      }
      const nome = (data?.expenseCategories ?? expenseCats).find((c) => c.id === categoriaId)?.name ?? 'categoria'
      toast({ title: `Salvo · ${ids.length} lançamento(s) em “${nome}”` })
      setSalvos((p) => new Set([...p, ...ids]))
      setMarcadas(new Set())
      loadReviewQueue()
      reload()
    } finally {
      setSalvando(false)
    }
  }

  async function moverLote() {
    if (!batchTarget || !reviewQueue?.ids.length) return
    setMovingBatch(true)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/despesas/recategorizar`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionIds: reviewQueue.ids, novaCategoriaId: batchTarget }),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        toast({ title: 'Erro', description: j.erro ?? 'Não deu pra mover', variant: 'destructive' })
        return
      }
      toast({ title: 'Movidas em lote', description: `${reviewQueue.count} compras reclassificadas.` })
      setBatchTarget('')
      loadReviewQueue()
      reload()
    } finally {
      setMovingBatch(false)
    }
  }

  useEffect(() => {
    fetch(`/api/empresas/${params.id}/socios-pf`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.socios ?? res?.sociosPF ?? [])
        setSocios(list.map((s: { id: string; nome: string }) => ({ id: s.id, nome: s.nome })))
      })
      .catch(() => {})
  }, [params.id])

  async function saveTreatment(defaultTreatment: string, socioPFId: string | null) {
    setSavingTreatment(true)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/cartoes/${params.cardId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultTreatment, socioPFId }),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        toast({ title: 'Erro', description: j.erro ?? 'Não deu pra salvar', variant: 'destructive' })
        return
      }
      toast({
        title: 'Tratamento do cartão salvo',
        description: defaultTreatment === 'PESSOAL_SOCIO'
          ? 'Compras importadas nascem como Retirada (fora do DRE).'
          : 'Compras importadas são despesa operacional.',
      })
      reload()
    } finally {
      setSavingTreatment(false)
    }
  }

  function reload() {
    setLoading(true)
    const dashUrl = selectedInvoice
      ? `/api/empresas/${params.id}/cartoes/${params.cardId}?fatura=${encodeURIComponent(selectedInvoice)}`
      : `/api/empresas/${params.id}/cartoes/${params.cardId}`
    // R5: paymentCandidates vem agora dentro do dashboard payload (substitui
    // o endpoint /pagamentos-pendentes que so retornava isCardPayment=true).
    fetch(dashUrl, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((dashRes) => setData(dashRes))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.cardId, selectedInvoice])

  async function casarPagamento(txId: string) {
    setCasandoId(txId)
    try {
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          // amarra o pagamento à fatura que está sendo vista (competência ativa)
          body: JSON.stringify({ txId, invoiceMonth: data?.currentInvoiceMonth ?? undefined }),
        },
      )
      const json = await resp.json()
      if (!resp.ok) {
        toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' })
        return
      }
      toast({
        title: 'Pagamento casado',
        description: `Saiu do DRE como despesa (R$ ${json.deltaDespesaRemovidoDoDRE.toFixed(2)})`,
      })
      reload()
    } finally {
      setCasandoId(null)
    }
  }

  async function desfazerCasamento(txId: string) {
    setDesfazendoId(txId)
    try {
      const resp = await fetch(
        `/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento?txId=${encodeURIComponent(txId)}`,
        { method: 'DELETE', credentials: 'include' },
      )
      const json = await resp.json()
      if (!resp.ok) {
        toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' })
        return
      }
      toast({
        title: 'Casamento desfeito',
        description: 'Volta a "aguardando casar" — você pode casar de novo se quiser.',
      })
      reload()
    } finally {
      setDesfazendoId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
        Carregando…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Cartão não encontrado.</p>
        <Link href={`/empresas/${params.id}/cartoes`}>
          <Button variant="outline">← Voltar</Button>
        </Link>
      </div>
    )
  }

  const { card, monthTransactions, spendByCategory } = data
  const linhasDaFatura = monthTransactions.filter((t) => !t.isCardPayment)
  // ⭐ a conta que o cabeçalho da fatura faz: débitos menos estornos
  const somaDebitos = linhasDaFatura.filter((t) => t.type !== 'CREDIT').reduce((a, t) => a + t.amount, 0)
  const somaEstornos = linhasDaFatura.filter((t) => t.type === 'CREDIT').reduce((a, t) => a + t.amount, 0)
  const limiteUsado = card.monthSpend
  const limiteDisp = Math.max(0, card.creditLimit - limiteUsado)
  const purchasesCount = monthTransactions.filter((t) => !t.isCardPayment).length

  // R6 — Status da fatura: paga se há matchedPayments na competência ativa
  const faturaPaga = data.matchedPayments.length > 0
  const topMatchedPayment = data.matchedPayments[0] ?? null
  const topCandidate = data.paymentCandidates[0] ?? null

  return (
    <div className="space-y-6">
      <Header
        title={card.name}
        description={
          [card.bankName, card.brand, card.lastDigits ? `final ${card.lastDigits}` : null]
            .filter(Boolean)
            .join(' · ') || 'Cartão de crédito PJ'
        }
      >
        <div className="flex gap-2">
          <Link href={`/empresas/${params.id}/cartoes`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Cartões
            </Button>
          </Link>
          <Link href={`/empresas/${params.id}/cartoes/${card.id}/importar-fatura`}>
            <Button>
              <Upload className="h-4 w-4 mr-1" />
              Importar fatura PDF
            </Button>
          </Link>
        </div>
      </Header>

      {/* R6 — HEADER PREMIUM DA FATURA (estilo Mercury) */}
      <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
        {/* Top row: mini cartão + selo + seletor */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-14 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 flex items-end justify-end p-1.5 shadow-sm">
              <CreditCard className="h-3.5 w-3.5 text-white/80 dark:text-slate-900/80" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {card.brand ?? 'Cartão'} {card.lastDigits ? `· •••• ${card.lastDigits}` : ''}
              </p>
              <p className="text-sm font-medium truncate">{card.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {data.availableInvoices.length > 0 && (
              <select
                value={data.currentInvoiceMonth ?? ''}
                onChange={(e) => setSelectedInvoice(e.target.value || null)}
                className="border border-border bg-background rounded-full h-8 px-3 text-xs font-medium hover:border-foreground/30 transition-colors"
                aria-label="Selecionar fatura"
              >
                {data.availableInvoices.map((m) => (
                  <option key={m} value={m}>{fmtInvoiceLabel(m)}</option>
                ))}
              </select>
            )}
            <StatusPill paga={faturaPaga} />
          </div>
        </div>

        {/* Valor central + métricas */}
        <div className="px-6 pb-5 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Fatura {data.currentInvoiceMonth ? fmtInvoiceLabel(data.currentInvoiceMonth) : 'pendente'}
            </p>
            <p className="text-[38px] leading-tight font-medium tabular-nums tracking-[-0.02em]">
              {formatBRL(limiteUsado)}
            </p>
          </div>

          {/* Barra de limite */}
          <div className="space-y-1.5">
            <div className="h-[5px] bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  card.utilizationPct >= 0.9
                    ? 'bg-red-500'
                    : card.utilizationPct >= 0.7
                      ? 'bg-amber-500'
                      : 'bg-emerald-500/80'
                }`}
                style={{ width: `${Math.min(100, card.utilizationPct * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{Math.round(card.utilizationPct * 100)}%</span> do limite ·{' '}
              <span className="font-medium text-foreground tabular-nums">{formatBRL(limiteDisp)}</span> disponível
            </p>
          </div>

          {/* 3 métricas com divisores */}
          <div className="grid grid-cols-3 divide-x divide-border border-t border-border pt-4 -mx-6 px-6">
            <Metric label="Vencimento" value={`dia ${card.dueDay}`} />
            <Metric label="Lançamentos" value={String(purchasesCount)} centered />
            <Metric label="Fechamento" value={`dia ${card.closingDay}`} rightAligned />
          </div>
        </div>

        {/* Linha de pagamento integrada — paga (verde) OU candidato (azul) OU aviso (âmbar) */}
        {faturaPaga && topMatchedPayment && (
          <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-t border-emerald-200/60 dark:border-emerald-900/40 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="h-7 w-7 rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Repeat className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="text-emerald-900 dark:text-emerald-100">
                Paga em <span className="font-medium">{fmtDateBR(topMatchedPayment.date)}</span>
                {topMatchedPayment.bankAccountName && (
                  <> pela <span className="font-medium">{topMatchedPayment.bankAccountName}</span></>
                )}
                {' · '}
                <span className="font-medium tabular-nums">{formatBRL(topMatchedPayment.amount)}</span>
              </div>
            </div>
            <button
              type="button"
              disabled={desfazendoId === topMatchedPayment.id}
              onClick={() => desfazerCasamento(topMatchedPayment.id)}
              className="text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 font-medium inline-flex items-center gap-1 disabled:opacity-50"
            >
              {desfazendoId === topMatchedPayment.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Undo2 className="h-3 w-3" />
              )}
              desfazer
            </button>
          </div>
        )}

        {!faturaPaga && topCandidate && (
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border-t border-blue-200/60 dark:border-blue-900/40 px-6 py-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm">
              <div className="h-7 w-7 rounded-full bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Link2 className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="text-blue-900 dark:text-blue-100">
                Achei pagamento{' '}
                <span className="font-medium tabular-nums">{formatBRL(topCandidate.amount)}</span>{' '}
                em <span className="font-medium">{fmtDateBR(topCandidate.date)}</span>
                {topCandidate.bankAccountName && (
                  <> · <span className="font-medium">{topCandidate.bankAccountName}</span></>
                )}
                {topCandidate.matchLabel && (
                  <span className="text-blue-700 dark:text-blue-300"> · {topCandidate.matchLabel}</span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              disabled={casandoId === topCandidate.id}
              onClick={() => casarPagamento(topCandidate.id)}
              className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
            >
              {casandoId === topCandidate.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Link2 className="h-3 w-3 mr-1" />
              )}
              Casar pagamento
            </Button>
          </div>
        )}

        {!faturaPaga && !topCandidate && data.currentInvoiceMonth && purchasesCount > 0 && (
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border-t border-amber-200/60 dark:border-amber-900/40 px-6 py-3.5 flex items-center gap-2.5 text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Fatura em aberto. Quando o pagamento aparecer no extrato, dá pra casar aqui.</span>
          </div>
        )}
      </Card>

      {/* Sprint Cartao-Uso-Pessoal: tratamento padrão das compras no import */}
      <Card className="rounded-xl border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tratamento das compras (no import)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={data.card.defaultTreatment}
              disabled={savingTreatment}
              onChange={(e) => saveTreatment(e.target.value, e.target.value === 'PESSOAL_SOCIO' ? data.card.socioPFId : null)}
              className="border rounded h-9 px-2 text-sm"
            >
              <option value="OPERACIONAL">Despesa operacional da empresa</option>
              <option value="PESSOAL_SOCIO">Uso pessoal do sócio (retirada)</option>
            </select>
            {data.card.defaultTreatment === 'PESSOAL_SOCIO' && (
              <select
                value={data.card.socioPFId ?? ''}
                disabled={savingTreatment}
                onChange={(e) => saveTreatment('PESSOAL_SOCIO', e.target.value || null)}
                className="border rounded h-9 px-2 text-sm"
              >
                <option value="">— qual sócio —</option>
                {socios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.card.defaultTreatment === 'PESSOAL_SOCIO'
              ? 'As compras importadas nascem em "A CLASSIFICAR — cartão" (fila de revisão, fora do DRE, não aprendida). Você classifica depois com o contador, em lote.'
              : 'As compras importadas são despesa da empresa (entram no DRE). Se este cartão é de uso pessoal do sócio, troque acima.'}
          </p>
        </CardContent>
      </Card>

      {/* Fila "A CLASSIFICAR" deste cartão — reclassificação EM LOTE (esvaziar) */}
      {reviewQueue && reviewQueue.count > 0 && (
        <Card className="rounded-xl border-purple-300 bg-purple-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-900">
              {reviewQueue.count} compras aguardando classificação ({formatBRL(reviewQueue.sum)}) — fora do DRE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-purple-800">Mover todas para:</span>
              <select
                value={batchTarget}
                disabled={movingBatch}
                onChange={(e) => setBatchTarget(e.target.value)}
                className="border rounded h-9 px-2 text-sm min-w-[180px]"
              >
                <option value="">— categoria final —</option>
                {(data?.expenseCategories ?? expenseCats).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button size="sm" className="h-9" disabled={!batchTarget || movingBatch} onClick={moverLote}>
                {movingBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Mover ${reviewQueue.count}`}
              </Button>
            </div>
            <p className="text-xs text-purple-700">
              Decidiu com o contador? Escolha a categoria final (Distribuição, despesa real, etc.) e mova as {reviewQueue.count} de uma vez.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Candidatos extras (quando há > 1) — só lista se top já mostrado no header e ainda restam outros */}
      {data.paymentCandidates.length > 1 && (
        <Card className="rounded-xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outros possíveis pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {data.paymentCandidates.slice(1).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{fmtDateBR(p.date)} · {p.description}</span>
                    <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                    {p.bankAccountName && (
                      <span className="text-muted-foreground">· {p.bankAccountName}</span>
                    )}
                    {p.matchLabel && (
                      <span className="text-[11px] text-muted-foreground">· {p.matchLabel}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={casandoId === p.id}
                  onClick={() => casarPagamento(p.id)}
                  className="h-7 text-xs"
                >
                  {casandoId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Casar'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pagamentos casados anteriores (só lista quando há > 1 — o atual ja ta no header) */}
      {data.matchedPayments.length > 1 && (
        <Card className="rounded-xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pagamentos anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {data.matchedPayments.slice(1).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0 text-sm"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  <span>{fmtDateBR(p.date)} · {p.description}</span>
                  <span className="font-medium tabular-nums">{formatBRL(p.amount)}</span>
                  {p.bankAccountName && (
                    <span className="text-muted-foreground">· {p.bankAccountName}</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={desfazendoId === p.id}
                  onClick={() => desfazerCasamento(p.id)}
                  className="h-7 text-xs text-muted-foreground"
                >
                  {desfazendoId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'desfazer'}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend by category */}
        <Card className="lg:col-span-1 rounded-xl border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {spendByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem compras nesta fatura.</p>
            ) : (
              <div className="space-y-2.5">
                {spendByCategory.map((c) => (
                  <div key={c.categoryId ?? 'no-cat'} className="flex justify-between text-sm">
                    <span className="truncate flex-1 text-muted-foreground">{c.categoryName}</span>
                    <span className="tabular-nums font-medium">{formatBRL(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card className="lg:col-span-2 rounded-xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              Lançamentos da fatura {data.currentInvoiceMonth ? fmtInvoiceLabel(data.currentInvoiceMonth) : ''}
            </CardTitle>
            {/* ⭐⭐ O TOTAL COM A CONTA À VISTA — débitos menos estornos. Sem ele, uma lista
                com 14 créditos parece somar muito mais do que a fatura cobra. */}
            {linhasDaFatura.length > 0 && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatBRL(somaDebitos)} − {formatBRL(somaEstornos)} ={' '}
                <span className="font-semibold text-foreground">{formatBRL(somaDebitos - somaEstornos)}</span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            {monthTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem compras importadas ainda. Importe a fatura PDF pra ver tudo aqui.
              </p>
            ) : (
              <div className="space-y-0">
                {/* ⭐⭐ CATEGORIZAR EM MASSA — as 15 MERCADOLIVRE de uma vez.
                    ⚠️ REGRA 4: grava pelo `/api/transacoes/lote`, a MESMA porta que o
                    financeiro já usa (e que dispara o gatilho de vendas). Nenhum caminho
                    de escrita novo nasce aqui. */}
                {marcadas.size > 0 && (
                  <div className="sticky top-0 z-10 -mx-2 mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2 py-2">
                    <span className="text-xs font-medium">{marcadas.size} selecionada(s)</span>
                    <select
                      className="h-8 flex-1 min-w-[160px] rounded border px-1 text-xs"
                      value=""
                      onChange={(e) => e.target.value && categorizar([...marcadas], e.target.value)}
                      disabled={salvando}
                    >
                      <option value="">— categorizar as {marcadas.size} como… —</option>
                      {(data?.expenseCategories ?? expenseCats).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" onClick={() => setMarcadas(new Set())}>limpar</Button>
                  </div>
                )}
                {linhasDaFatura.map((t) => {
                  const credito = t.type === 'CREDIT'
                  return (
                  <div
                    key={t.id}
                    className="flex items-start justify-between py-2.5 border-t border-border first:border-0 text-sm gap-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={marcadas.has(t.id)}
                      onChange={() => alternar(t.id)}
                      aria-label={`selecionar ${t.description}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate">{t.description}</span>
                        {credito && (
                          <Badge variant="outline" className="text-[10px] py-0 font-normal bg-emerald-50 text-emerald-700 border-emerald-200">
                            estorno (crédito)
                          </Badge>
                        )}
                        {salvos.has(t.id) && (
                          <span className="text-[10px] text-emerald-700 font-medium">salvo ✓</span>
                        )}
                        {t.installmentNumber && t.installmentTotal && (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 font-normal"
                          >
                            {t.installmentNumber}/{t.installmentTotal}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDateBR(t.date)}</p>
                      {/* ⭐ a categoria é editável ALI — era o gesto que não existia */}
                      <select
                        className={`mt-1 h-7 w-full max-w-[260px] rounded border px-1 text-[11px] ${
                          (otimista[t.id] ?? t.categoryId) ? '' : 'border-amber-400 bg-amber-50/40'
                        }`}
                        value={otimista[t.id] ?? t.categoryId ?? ''}
                        onChange={(e) => categorizar([t.id], e.target.value || null)}
                        disabled={salvando}
                      >
                        <option value="">— sem categoria —</option>
                        {(data?.expenseCategories ?? expenseCats).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {!t.categoryId && t.suggestedCategoryId && (
                        <button
                          type="button"
                          className="mt-0.5 block text-[10px] text-primary hover:underline"
                          onClick={() => categorizar([t.id], t.suggestedCategoryId!)}
                        >
                          🧠 usar “{(data?.expenseCategories ?? expenseCats).find((c) => c.id === t.suggestedCategoryId)?.name}” (regra aprendida)
                        </button>
                      )}
                    </div>
                    {/* ⭐⭐ ESTORNO É CRÉDITO: sai com − e em verde. O dado sempre esteve
                        certo (amount positivo + type CREDIT, a convenção da casa); quem
                        mentia era a tela, que imprimia tudo positivo. */}
                    <span className={`tabular-nums font-medium shrink-0 ${credito ? 'text-emerald-700' : 'text-foreground'}`}>
                      {credito ? `− ${formatBRL(t.amount)}` : formatBRL(t.amount)}
                    </span>
                  </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatusPill({ paga }: { paga: boolean }) {
  if (paga) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/60 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Fatura paga
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/60 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
      <AlertCircle className="h-3 w-3" />
      Em aberto
    </span>
  )
}

function Metric({
  label,
  value,
  centered = false,
  rightAligned = false,
}: {
  label: string
  value: string
  centered?: boolean
  rightAligned?: boolean
}) {
  const align = rightAligned ? 'text-right pr-0 pl-4' : centered ? 'text-center px-4' : 'text-left pl-0 pr-4'
  return (
    <div className={align}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-[15px] font-medium tabular-nums mt-0.5">{value}</p>
    </div>
  )
}

function fmtDateBR(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function fmtInvoiceLabel(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym
  const [y, m] = ym.split('-')
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1))
  return `${MESES_PT[idx]}/${y}`
}
