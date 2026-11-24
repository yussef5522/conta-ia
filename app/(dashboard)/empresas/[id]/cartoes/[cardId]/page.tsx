// ⭐⭐⭐ CARTÕES v3 — A FATURA (docs/cartoes-referencia.html, R46–R50/R52 · 24/11/2026).
//
// Navegação de mês por setas, linha do tempo do ciclo (abriu → fechou → vence → paga), a faixa da
// conciliação com desfazer, lançamentos com círculo de categoria, filtros com contador e busca,
// "já comprometido · próximos meses", por categoria em barras de escala única e fatura por mês.
// ⚠️ Consulta SÓ este cartão (`lerFatura`). ⛔ PRESERVADOS da tela velha: categorizar por linha e
// em massa pela MESMA porta (`/despesas/recategorizar`), o otimista que reverte na falha, o "salvo ✓",
// a categoria salva dita em texto, o tratamento do cartão e a fila A CLASSIFICAR em lote.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { valorDoSeletor, opcoesDoSeletor } from '@/lib/credit-card-pj/valor-do-seletor'
import type { FaturaDetalhe, LinhaDaFatura } from '@/lib/credit-card-pj/fatura-detalhe'
import { rotuloFatura, rotuloMes, diasAte, excessoDoPagamento } from '@/lib/credit-card-pj/ciclo'
import { MOTIVOS_DA_DIFERENCA, textoDoMotivo, type MotivoDaDiferenca } from '@/lib/conciliacao/regua-da-diferenca'
import { extractAnchorWord } from '@/lib/categorization/extract-anchor-word'
import { Chip, Selo, Trilho, PainelFuturo, PorCategoria, FaturaPorMes, corDaCategoria, SOMBRA, ROT } from '@/components/cartoes/visual'

type Filtro = 'todas' | 'parceladas' | 'estornos' | 'sem'
type Aba = 'lanc' | 'parc' | 'graf'
const ddmmm = (iso: string) => `${iso.slice(8, 10)}/${rotuloMes(iso.slice(0, 7))}`

export default function FaturaDoCartaoPage() {
  const params = useParams<{ id: string; cardId: string }>()
  const router = useRouter()
  const busca = useSearchParams()
  const { toast } = useToast()
  const [data, setData] = useState<FaturaDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [naoAchou, setNaoAchou] = useState(false)
  const selectedInvoice = busca.get('fatura')
  const [casandoId, setCasandoId] = useState<string | null>(null)
  const [desfazendoId, setDesfazendoId] = useState<string | null>(null)
  const [socios, setSocios] = useState<Array<{ id: string; nome: string }>>([])
  const [savingTreatment, setSavingTreatment] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<{ count: number; sum: number; ids: string[] } | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [termo, setTermo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [aba, setAba] = useState<Aba>('lanc')
  const [verTodasParcelas, setVerTodasParcelas] = useState(false)
  /** R49 — "lembrar pra próxima?" de 1 toque, depois que o dono escolhe a categoria de UMA linha */
  const [lembrar, setLembrar] = useState<{ txId: string; padrao: string; categoriaId: string; nome: string } | null>(null)
  /**
   * ⭐⭐ CATEGORIZAR NA TELA DA FATURA (17/09/2026) — ⚠️ REGRA 4: grava pelo
   * **`/despesas/recategorizar`**, a MESMA porta do "mover em lote" — inclusive pra UMA linha.
   */
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [salvando, setSalvando] = useState(false)
  /** ⭐⭐ o otimista faz o seletor seguir o dedo; `salvos` acende o ✓; a FALHA reverte (17/09) */
  const [otimista, setOtimista] = useState<Record<string, string>>({})
  const [salvos, setSalvos] = useState<Set<string>>(new Set())
  const [batchTarget, setBatchTarget] = useState('')
  const [movingBatch, setMovingBatch] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    const url = selectedInvoice
      ? `/api/empresas/${params.id}/cartoes/${params.cardId}?fatura=${encodeURIComponent(selectedInvoice)}`
      : `/api/empresas/${params.id}/cartoes/${params.cardId}`
    fetch(url, { credentials: 'include' })
      .then((r) => { if (r.status === 404) setNaoAchou(true); return r.ok ? r.json() : null })
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [params.id, params.cardId, selectedInvoice])

  function loadReviewQueue() {
    fetch(`/api/empresas/${params.id}/cartoes/review-queue?cardId=${params.cardId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then((q) => setReviewQueue(q)).catch(() => {})
  }
  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    loadReviewQueue()
    fetch(`/api/empresas/${params.id}/socios-pf`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.socios ?? res?.sociosPF ?? [])
        setSocios(list.map((s: { id: string; nome: string }) => ({ id: s.id, nome: s.nome })))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.cardId])

  function irPara(mes: string) {
    router.replace(`/empresas/${params.id}/cartoes/${params.cardId}?fatura=${mes}`, { scroll: false })
  }

  function alternar(id: string) {
    setMarcadas((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s })
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
      const nome = (data?.expenseCategories ?? []).find((c) => c.id === categoriaId)?.name ?? 'categoria'
      toast({ title: `Salvo · ${ids.length} lançamento(s) em “${nome}”` })
      setSalvos((p) => new Set([...p, ...ids]))
      setMarcadas(new Set())
      // ⭐ R49 — a escolha do dono pode VIRAR regra: pergunta em 1 toque (nunca grava sozinha)
      if (ids.length === 1) {
        const linha = data?.linhas.find((l) => l.id === ids[0])
        const padrao = linha ? extractAnchorWord(linha.description) : null
        setLembrar(padrao ? { txId: ids[0], padrao, categoriaId, nome } : null)
      }
      loadReviewQueue()
      reload()
    } finally {
      setSalvando(false)
    }
  }

  /** R49 — "lembrar pra próxima?": a regra nasce pela porta que já cria regra (`/rules/create-and-apply`) */
  async function lembrarRegra() {
    if (!lembrar) return
    const r = await fetch(`/api/empresas/${params.id}/rules/create-and-apply`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      // ⚠️ applyToExisting: false — a regra vale pra PRÓXIMA; o que já está na tela o dono decide
      body: JSON.stringify({ padrao: lembrar.padrao, tipoMatch: 'CONTAINS', categoryId: lembrar.categoriaId, type: 'DEBIT', applyToExisting: false }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { toast({ title: 'Não consegui lembrar', description: j.erro ?? 'tente de novo', variant: 'destructive' }); return }
    toast({ title: `Lembrado: “${lembrar.padrao}” vai sugerir “${lembrar.nome}”` })
    setLembrar(null)
  }

  async function moverLote() {
    if (!batchTarget || !reviewQueue?.ids.length) return
    setMovingBatch(true)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/despesas/recategorizar`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
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

  async function saveTreatment(defaultTreatment: string, socioPFId: string | null) {
    setSavingTreatment(true)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/cartoes/${params.cardId}`, {
        method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultTreatment, socioPFId }),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}))
        toast({ title: 'Erro', description: j.erro ?? 'Não deu pra salvar', variant: 'destructive' })
        return
      }
      toast({
        title: 'Tratamento do cartão salvo',
        description: defaultTreatment === 'PESSOAL_SOCIO' ? 'Compras importadas nascem como Retirada (fora do DRE).' : 'Compras importadas são despesa operacional.',
      })
      reload()
    } finally {
      setSavingTreatment(false)
    }
  }

  /** ⭐ 24/11 — pagamento MAIOR que o que falta: o dono declara o que são os R$ a mais (a porta exige) */
  const [aMaior, setAMaior] = useState<{ txId: string; excesso: number } | null>(null)
  const [motivoAMaior, setMotivoAMaior] = useState<MotivoDaDiferenca | null>(null)
  const [livreAMaior, setLivreAMaior] = useState('')
  function pedirCasar(txId: string, valor: number) {
    const excesso = data?.fatura ? excessoDoPagamento(valor, data.fatura.falta) : 0
    if (excesso > 0) { setMotivoAMaior(null); setLivreAMaior(''); setAMaior({ txId, excesso }); return }
    casarPagamento(txId)
  }

  async function casarPagamento(txId: string, diferencaAMaior?: { valor: number; motivo: string }) {
    setCasandoId(txId)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento`, {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        // amarra o pagamento à fatura que está sendo vista (competência ativa)
        body: JSON.stringify({ txId, invoiceMonth: data?.fatura?.mes ?? undefined, ...(diferencaAMaior ? { diferencaAMaior } : {}) }),
      })
      const json = await resp.json()
      if (!resp.ok) { toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' }); return }
      // ⭐ R48 — a fatura sai do gesto Paga/Parcial NA HORA, e a tela diz qual
      toast({ title: json.fatura?.estado === 'paga' ? 'Pagamento casado · fatura Paga' : json.fatura?.estado === 'parcial' ? `Pagamento casado · fatura Parcial (faltam ${formatBRL(json.fatura.total - json.fatura.pago)})` : 'Pagamento casado' })
      reload()
    } finally {
      setCasandoId(null)
    }
  }

  async function desfazerCasamento(txId: string) {
    setDesfazendoId(txId)
    try {
      const resp = await fetch(`/api/empresas/${params.id}/cartoes/${params.cardId}/casar-pagamento?txId=${encodeURIComponent(txId)}`, { method: 'DELETE', credentials: 'include' })
      const json = await resp.json()
      if (!resp.ok) { toast({ title: 'Erro', description: json.erro || 'Tente novamente', variant: 'destructive' }); return }
      toast({
        title: 'Casamento desfeito',
        description: json.categoriaDevolvida ? 'O lançamento voltou pro extrato com a categoria que tinha antes.' : 'O lançamento voltou pro extrato (sem categoria registrada antes do casamento).',
      })
      reload()
    } finally {
      setDesfazendoId(null)
    }
  }

  const linhas = useMemo(() => data?.linhas ?? [], [data])
  const contagem = useMemo(() => ({
    todas: linhas.length,
    parceladas: linhas.filter((l) => (l.installmentTotal ?? 0) > 1).length,
    estornos: linhas.filter((l) => l.type === 'CREDIT').length,
    sem: linhas.filter((l) => !l.categoryId && !otimista[l.id]).length,
  }), [linhas, otimista])
  const rankDaCategoria = useMemo(() => new Map((data?.porCategoria ?? []).filter((c) => c.valor > 0).map((c, i) => [c.categoryId ?? 'sem', i])), [data])
  const visiveis = useMemo(() => {
    const q = termo.trim().toLowerCase()
    return linhas.filter((l) => {
      if (filtro === 'parceladas' && !((l.installmentTotal ?? 0) > 1)) return false
      if (filtro === 'estornos' && l.type !== 'CREDIT') return false
      if (filtro === 'sem' && (l.categoryId || otimista[l.id])) return false
      return !q || l.description.toLowerCase().includes(q)
    })
  }, [linhas, filtro, termo, otimista])

  if (loading && !data) {
    return <div className="flex h-64 items-center justify-center" style={{ color: 'var(--esc-tinta3)' }}><Loader2 className="mr-2 h-5 w-5 animate-spin" />Carregando…</div>
  }
  if (!data) {
    return (
      <div className="space-y-4 p-4">
        <p className="text-sm">{naoAchou ? 'Cartão não encontrado (ou arquivado).' : 'Não consegui abrir a fatura.'}</p>
        <Link href={`/empresas/${params.id}/cartoes`} className="font-bold" style={{ color: 'var(--esc-indigo)' }}>← Voltar pros cartões</Link>
      </div>
    )
  }

  const { cartao: card, fatura, ciclo } = data
  const banco = card.bankName ?? card.name
  const meses = card.faturas.map((f) => f.mes) // mais recente primeiro
  const idx = fatura ? meses.indexOf(fatura.mes) : -1
  const anterior = idx >= 0 && idx < meses.length - 1 ? meses[idx + 1] : null
  const proxima = idx > 0 ? meses[idx - 1] : null
  const linhasDaFatura = linhas
  // ⭐ a conta que o cabeçalho da fatura faz: débitos menos estornos
  const somaDebitos = linhasDaFatura.filter((t) => t.type !== 'CREDIT').reduce((a, t) => a + t.amount, 0)
  const somaEstornos = linhasDaFatura.filter((t) => t.type === 'CREDIT').reduce((a, t) => a + t.amount, 0)
  const topCandidate = data.candidatos[0] ?? null
  const pagou = fatura && fatura.pagamentos.length > 0

  // R46 — o trilho do ciclo: abriu → fechou → vence → paga (posição pela data)
  const eventosCiclo = ciclo ? (() => {
    const ini = Date.parse(ciclo.abriu), fim = Math.max(Date.parse(ciclo.vence), ciclo.paga ? Date.parse(ciclo.paga) : 0) + 2 * 86_400_000
    const pos = (iso: string) => 4 + ((Date.parse(iso) - ini) / (fim - ini || 1)) * 90
    const ev = [
      { tx: `abriu ${ddmmm(ciclo.abriu)}`, cls: 'ok' as const, p: pos(ciclo.abriu) },
      { tx: `fechou ${ddmmm(ciclo.fechou)}`, cls: 'ok' as const, p: pos(ciclo.fechou) },
      ...(ciclo.paga ? [{ tx: `${fatura?.estado === 'paga' ? 'paga' : 'pago em parte'} ${ddmmm(ciclo.paga)} ✓`, cls: 'ok' as const, p: pos(ciclo.paga) }] : []),
      { tx: `${diasAte(data.hoje, ciclo.vence) < 0 ? 'vencia' : 'vence'} ${ddmmm(ciclo.vence)}`, cls: (fatura?.estado === 'paga' ? 'ok' : 'vc') as 'ok' | 'vc', p: pos(ciclo.vence) },
    ].sort((a, b) => a.p - b.p)
    return ev.map((e) => ({ ...e, dia: 0 }))
  })() : []

  const painel = (qual: Aba) => `${aba === qual ? 'block' : 'hidden'} lg:block`

  return (
    <div className="min-h-full pb-10" style={{ color: 'var(--esc-tinta)' }}>
      {/* ⛔ S24 — a LARGURA DA ÁREA ÚTIL do app: nenhum max-w próprio; o respiro lateral é o do shell */}
      <div>
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[12px] font-extrabold">
          <Link href={`/empresas/${params.id}/cartoes`} style={{ color: 'var(--esc-indigo)' }}>← Cartões</Link>
          <span className="ml-auto" />
          <Link href={`/empresas/${params.id}/cartoes/${card.id}/importar-fatura`} className="inline-flex h-9 items-center rounded-[10px] px-3 text-[12.5px] font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>Importar fatura PDF</Link>
        </div>

        {/* ── o cabeçalho da fatura: chip · banco · ‹ mês › · selo · total ── */}
        <div className="mt-3 flex flex-wrap items-center gap-[13px]">
          <Chip bankName={card.bankName} brand={card.brand} lastDigits={card.lastDigits} pequeno />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold">{banco}</div>
            <div className="truncate text-[11px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>{card.name !== banco ? card.name : `fecha dia ${card.closingDay} · vence dia ${card.dueDay}`}</div>
          </div>
          {fatura && (
            <div data-testid="nav-mes" className="inline-flex h-[38px] items-center gap-[9px] rounded-[12px] px-2" style={{ background: 'var(--esc-trilho)' }}>
              <button type="button" aria-label="fatura anterior" disabled={!anterior} onClick={() => anterior && irPara(anterior)} className="w-[26px] text-[14px] font-extrabold disabled:opacity-30" style={{ color: 'var(--esc-tinta2)' }}>‹</button>
              <span className="num text-[12.5px] font-extrabold">{rotuloFatura(fatura.mes)}</span>
              <button type="button" aria-label="próxima fatura" disabled={!proxima} onClick={() => proxima && irPara(proxima)} className="w-[26px] text-[14px] font-extrabold disabled:opacity-30" style={{ color: 'var(--esc-tinta2)' }}>›</button>
            </div>
          )}
          {fatura && <Selo estado={fatura.estado} />}
          <div className="ml-auto text-right">
            <div className={ROT} style={{ color: 'var(--esc-tinta3)' }}>Total da fatura</div>
            <div className="num text-[26px] font-extrabold tracking-[-0.015em] sm:text-[30px]">{fatura ? formatBRL(fatura.total) : '—'}</div>
          </div>
        </div>

        {!fatura && (
          <div className="mt-4 rounded-[20px] px-5 py-8 text-center text-sm" style={{ ...SOMBRA, background: 'var(--esc-card)', color: 'var(--esc-tinta3)' }}>
            Sem compras importadas ainda. Importe a fatura PDF pra ver tudo aqui.
          </div>
        )}

        {/* ── R46 ciclo + R48 a faixa da conciliação (uma porta; desfazer devolve tudo) ── */}
        {fatura && ciclo && (
          <div className="mt-[13px] rounded-[20px] px-4 py-[14px]" style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
            <Trilho id="trilho-fat" eventos={eventosCiclo} posicao={(e) => (e as unknown as { p: number }).p} altura={50} />
            {pagou && fatura.pagamentos.map((p) => (
              <div key={p.id} data-testid="faixa-conciliacao" className="num mt-[11px] flex flex-wrap items-center gap-[10px] rounded-[11px] px-[13px] py-[10px] text-[12px] font-extrabold" style={{ background: 'var(--esc-verde50)', color: 'var(--esc-verde-t)' }}>
                <span className="min-w-0 flex-1">✓ pagamento casado: −{formatBRL(p.valor)} em {ddmmm(p.data)}{p.conta ? ` · conta ${p.conta}` : ''}{fatura.estado === 'parcial' ? ` · faltam ${formatBRL(fatura.total - fatura.pago)}` : ''}</span>
                <button type="button" disabled={desfazendoId === p.id} onClick={() => desfazerCasamento(p.id)} className="text-[11.5px] font-extrabold underline disabled:opacity-50">
                  {desfazendoId === p.id ? '…' : 'desfazer'}
                </button>
              </div>
            ))}
            {fatura.estado !== 'paga' && topCandidate && (
              <div className="num mt-[11px] flex flex-wrap items-center gap-[10px] rounded-[11px] px-[13px] py-[10px] text-[12px] font-extrabold" style={{ background: 'var(--esc-indigo50)', color: 'var(--esc-indigo-t)' }}>
                <span className="min-w-0 flex-1">Achei pagamento {formatBRL(topCandidate.amount)} em {ddmmm(topCandidate.date)}{topCandidate.bankAccountName ? ` · ${topCandidate.bankAccountName}` : ''}{topCandidate.matchLabel ? ` · ${topCandidate.matchLabel}` : ''}</span>
                <button type="button" disabled={casandoId === topCandidate.id} onClick={() => pedirCasar(topCandidate.id, topCandidate.amount)} className="h-7 rounded-[8px] px-3 text-[11.5px] font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>
                  {casandoId === topCandidate.id ? '…' : 'Casar pagamento'}
                </button>
              </div>
            )}
            {aMaior && (
              <div data-testid="quadro-a-maior" className="mt-[11px] rounded-[11px] px-[13px] py-[10px] text-[12px] font-bold" style={{ background: 'var(--esc-ambar50)', color: 'var(--esc-ambar-t)' }}>
                <p className="font-extrabold">O pagamento passa {formatBRL(aMaior.excesso)} do que falta na fatura ({formatBRL(fatura.falta)}) — o que são os {formatBRL(aMaior.excesso)} a mais?</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MOTIVOS_DA_DIFERENCA.filter((m) => m.chave !== 'DESCONTO').map((m) => (
                    <button key={m.chave} type="button" onClick={() => setMotivoAMaior(m.chave)} className="rounded-full border px-2.5 py-[4px] text-[11.5px] font-extrabold"
                      style={motivoAMaior === m.chave ? { background: 'var(--esc-ambar)', borderColor: 'var(--esc-ambar)', color: 'var(--esc-on)' } : { borderColor: 'var(--esc-ambar)', color: 'var(--esc-ambar-t)' }}>{m.rotulo}</button>
                  ))}
                </div>
                {motivoAMaior === 'OUTRO' && <input value={livreAMaior} onChange={(e) => setLivreAMaior(e.target.value)} maxLength={80} aria-label="o que são os R$ a mais?" className="mt-1.5 h-8 w-full min-w-0 rounded-[8px] border px-2 text-[12px]" style={{ borderColor: 'var(--esc-ambar)', background: 'var(--esc-card)', color: 'var(--esc-tinta)' }} />}
                <p className="mt-1 text-[11px]">fica no histórico da conta e na fatura — ela vira PAGA com a diferença guardada</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={!motivoAMaior || (motivoAMaior === 'OUTRO' && livreAMaior.trim().length < 2) || casandoId === aMaior.txId}
                    onClick={() => { const d = { valor: aMaior.excesso, motivo: textoDoMotivo(motivoAMaior, livreAMaior) }; setAMaior(null); casarPagamento(aMaior.txId, d) }}
                    className="h-7 rounded-[8px] px-3 text-[11.5px] font-extrabold disabled:opacity-40" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>Casar e guardar a diferença</button>
                  <button type="button" onClick={() => setAMaior(null)} className="text-[11.5px] font-extrabold">cancelar</button>
                </div>
              </div>
            )}
            {fatura.acrescimo > 0 && (
              <div className="num mt-[11px] rounded-[11px] px-[13px] py-[8px] text-[11.5px] font-bold" style={{ background: 'var(--esc-trilho)', color: 'var(--esc-tinta2)' }}>
                + {formatBRL(fatura.acrescimo)} declarados a mais{fatura.acrescimoMotivo ? ` — ${fatura.acrescimoMotivo}` : ''}
              </div>
            )}
            {!pagou && !topCandidate && (
              <div className="mt-[11px] rounded-[11px] px-[13px] py-[10px] text-[12px] font-extrabold" style={{ background: 'var(--esc-ambar50)', color: 'var(--esc-ambar-t)' }}>
                Fatura em aberto. Quando o pagamento aparecer no extrato, dá pra casar aqui.
              </div>
            )}
            {data.candidatos.length > 1 && fatura.estado !== 'paga' && (
              <div className="mt-2">
                <div className={`${ROT} mb-1`} style={{ color: 'var(--esc-tinta3)' }}>Outros possíveis pagamentos</div>
                {data.candidatos.slice(1).map((p) => (
                  <div key={p.id} className="num flex flex-wrap items-center gap-2 py-1.5 text-[12px] font-bold" style={{ borderTop: '1px solid var(--esc-linha2)' }}>
                    <span className="min-w-0 flex-1 truncate">{ddmmm(p.date)} · {p.description} · <b>{formatBRL(p.amount)}</b>{p.bankAccountName ? ` · ${p.bankAccountName}` : ''}</span>
                    <button type="button" disabled={casandoId === p.id} onClick={() => pedirCasar(p.id, p.amount)} className="text-[11.5px] font-extrabold" style={{ color: 'var(--esc-indigo)' }}>{casandoId === p.id ? '…' : 'Casar'}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fila "A CLASSIFICAR" deste cartão — reclassificação EM LOTE (esvaziar) */}
        {reviewQueue && reviewQueue.count > 0 && (
          <div className="mt-[13px] rounded-[16px] px-4 py-3" style={{ background: 'var(--esc-roxo50)', color: 'var(--esc-roxo-t)' }}>
            <p className="text-[13px] font-extrabold">{reviewQueue.count} compras aguardando classificação ({formatBRL(reviewQueue.sum)}) — fora do DRE</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span>Mover todas para:</span>
              <select value={batchTarget} disabled={movingBatch} onChange={(e) => setBatchTarget(e.target.value)} className="h-9 min-w-0 max-w-full rounded border px-2 text-sm" style={{ background: 'var(--esc-card)', color: 'var(--esc-tinta)' }}>
                <option value="">— categoria final —</option>
                {(data?.expenseCategories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" className="h-9 rounded-[10px] px-3 text-[12.5px] font-extrabold" style={{ background: 'var(--esc-roxo-t)', color: 'var(--esc-on)' }} disabled={!batchTarget || movingBatch} onClick={moverLote}>
                {movingBatch ? '…' : `Mover ${reviewQueue.count}`}
              </button>
            </div>
            <p className="mt-1 text-xs">Decidiu com o contador? Escolha a categoria final (Distribuição, despesa real, etc.) e mova as {reviewQueue.count} de uma vez.</p>
          </div>
        )}

        {/* ── R52 — no celular a fatura vira ABAS (Lançamentos · Parcelas · Gráfico) ── */}
        {fatura && (
          <div role="tablist" data-testid="abas-da-fatura" className="mt-[14px] grid grid-cols-3 gap-1 rounded-[12px] p-1 lg:hidden" style={{ background: 'var(--esc-abas)' }}>
            {([['lanc', 'Lançamentos'], ['parc', 'Parcelas'], ['graf', 'Gráfico']] as [Aba, string][]).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={aba === k} type="button" onClick={() => setAba(k)} className="h-8 rounded-[9px] text-[12px] font-extrabold"
                style={aba === k ? { background: 'var(--esc-card)', color: 'var(--esc-tinta)' } : { color: 'var(--esc-tinta2)' }}>{t}</button>
            ))}
          </div>
        )}

        {fatura && (
          <div className="mt-[14px] grid grid-cols-1 items-start gap-[14px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] 2xl:gap-5">
            {/* ── R49 lançamentos ── */}
            <div className={`${painel('lanc')} min-w-0 rounded-[20px] px-[18px] py-4`} style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
              <div className={`${ROT} mb-[6px] flex flex-wrap items-center gap-2`} style={{ color: 'var(--esc-tinta3)' }}>
                Lançamentos · {linhasDaFatura.length}
                <span className="flex-1" />
                {/* ⭐⭐ O TOTAL COM A CONTA À VISTA — débitos menos estornos */}
                <span className="num normal-case tracking-normal">{formatBRL(somaDebitos)} − {formatBRL(somaEstornos)} = <b style={{ color: 'var(--esc-tinta)' }}>{formatBRL(somaDebitos - somaEstornos)}</b></span>
                <button type="button" onClick={() => setBuscando((b) => !b)} className="text-[11px] font-extrabold normal-case tracking-normal" style={{ color: 'var(--esc-indigo)' }}>⌕ buscar</button>
              </div>
              {buscando && (
                <input autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="buscar na fatura…" className="mb-2 h-9 w-full min-w-0 rounded-[10px] border px-3 text-[13px] font-bold" style={{ borderColor: 'var(--esc-linha)', background: 'var(--esc-card)', color: 'var(--esc-tinta)' }} />
              )}
              <div data-testid="filtros" className="mb-2 mt-1 flex flex-wrap gap-[7px]">
                {([['todas', 'Todas'], ['parceladas', 'Parceladas'], ['estornos', 'Estornos'], ['sem', 'Sem categoria']] as [Filtro, string][]).map(([k, t]) => (
                  <button key={k} type="button" onClick={() => setFiltro(k)} className="inline-flex h-[29px] items-center gap-[5px] rounded-full border px-[11px] text-[11px] font-extrabold"
                    style={filtro === k ? { background: 'var(--esc-tinta)', borderColor: 'var(--esc-tinta)', color: 'var(--esc-on)' } : { background: 'var(--esc-card)', borderColor: 'var(--esc-linha)', color: 'var(--esc-tinta2)' }}>
                    {t} <span className="num rounded-full px-[6px] text-[9.5px] font-extrabold" style={filtro === k ? { background: 'var(--esc-n-on)', color: 'var(--esc-n-on-t)' } : { background: 'var(--esc-trilho)', color: 'var(--esc-tinta2)' }}>{contagem[k]}</span>
                  </button>
                ))}
              </div>

              {/* ⭐⭐ CATEGORIZAR EM MASSA — pela MESMA porta (`/despesas/recategorizar`) */}
              {marcadas.size > 0 && (
                <div className="sticky top-0 z-10 mb-1 flex flex-wrap items-center gap-2 rounded-lg px-2 py-2" style={{ background: 'var(--esc-indigo50)' }}>
                  <span className="text-xs font-bold">{marcadas.size} selecionada(s)</span>
                  <select className="h-8 min-w-0 flex-1 rounded border px-1 text-xs" value="" onChange={(e) => e.target.value && categorizar([...marcadas], e.target.value)} disabled={salvando} style={{ background: 'var(--esc-card)', color: 'var(--esc-tinta)' }}>
                    <option value="">— categorizar as {marcadas.size} como… —</option>
                    {(data?.expenseCategories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="text-xs font-bold" onClick={() => setMarcadas(new Set())}>limpar</button>
                </div>
              )}

              {/* o pagamento desta fatura com cara própria (✓) */}
              {fatura.pagamentos.map((p) => (
                <div key={p.id} className="my-[2px] grid items-center gap-3 rounded-[14px] px-3 py-[10px]" style={{ gridTemplateColumns: '42px minmax(0,1fr) auto', background: 'var(--esc-verde50)' }}>
                  <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: 'var(--esc-faixa)', color: 'var(--esc-verde-t)' }}>✓</div>
                  <div className="min-w-0"><div className="truncate text-[13.5px] font-bold">Pagamento desta fatura</div><div className="num text-[10.5px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>{ddmmm(p.data)}{p.conta ? ` · conta ${p.conta}` : ''}</div></div>
                  <div className="num whitespace-nowrap text-right text-[14.5px] font-extrabold" style={{ color: 'var(--esc-verde-t)' }}>−{formatBRL(p.valor)}</div>
                </div>
              ))}

              {fatura.quitacao && (
                <div data-testid="parcelas-da-quitacao" className="mb-2 rounded-[12px] px-3 py-2" style={{ background: 'var(--esc-trilho)' }}>
                  <p className="text-[11.5px] font-extrabold" style={{ color: 'var(--esc-tinta2)' }}>Fatura de quitação — o cartão foi encerrado; estas são as parcelas que caem neste mês:</p>
                  {data.parcelasDaQuitacao.map((p, i) => (
                    <div key={p.descricao + i} className="num flex items-baseline gap-2 py-1 text-[12.5px] font-bold">
                      <span className="min-w-0 flex-1 truncate">{p.descricao}</span>
                      <span className="rounded-[6px] px-[7px] py-[1px] text-[9.5px] font-extrabold" style={{ background: 'var(--esc-roxo50)', color: 'var(--esc-roxo-t)' }}>parcela {String(p.numero).padStart(2, '0')}/{String(p.total).padStart(2, '0')}</span>
                      <span className="whitespace-nowrap font-extrabold">{formatBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
              {!fatura.quitacao && visiveis.length === 0 && <p className="py-4 text-[12.5px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>Nada neste filtro.</p>}
              {visiveis.map((t: LinhaDaFatura) => {
                const credito = t.type === 'CREDIT'
                const catId = valorDoSeletor(otimista, t)
                const rank = rankDaCategoria.get(t.categoryId ?? 'sem')
                const nomeCat = (data?.expenseCategories ?? []).find((c) => c.id === catId)?.name ?? t.categoryName
                return (
                  <div key={t.id} data-testid="lancamento" className="grid items-start gap-3 py-[10px]" style={{ gridTemplateColumns: '42px minmax(0,1fr) auto', borderBottom: '1px solid var(--esc-linha2)' }}>
                    <label className="relative">
                      <input type="checkbox" className="absolute -left-1 -top-1 h-4 w-4 opacity-70" checked={marcadas.has(t.id)} onChange={() => alternar(t.id)} aria-label={`selecionar ${t.description}`} />
                      {credito
                        ? <div title="estorno (crédito)" className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: 'var(--esc-faixa)', color: 'var(--esc-verde-t)' }}>↩</div>
                        : catId
                          ? <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: corDaCategoria(rank ?? 5) }}>{(t.description.trim()[0] ?? '·').toUpperCase()}</div>
                          : <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: 'var(--esc-ambar50)', color: 'var(--esc-ambar-t)' }}>?</div>}
                    </label>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold">{t.description}</div>
                      <div className="mt-[3px] flex flex-wrap items-center gap-[6px]">
                        <span className="num text-[10.5px] font-bold" style={{ color: 'var(--esc-tinta3)' }}>{ddmmm(t.date)}</span>
                        {credito && <span className="rounded-[6px] px-[7px] py-[1px] text-[9.5px] font-extrabold" style={{ background: 'var(--esc-verde50)', color: 'var(--esc-verde-t)' }}>estorno</span>}
                        {t.installmentNumber && t.installmentTotal && t.installmentTotal > 1 && (
                          <span className="num rounded-[6px] px-[7px] py-[1px] text-[9.5px] font-extrabold" style={{ background: 'var(--esc-roxo50)', color: 'var(--esc-roxo-t)' }}>parcela {String(t.installmentNumber).padStart(2, '0')}/{String(t.installmentTotal).padStart(2, '0')}</span>
                        )}
                        {t.usd != null && (
                          <span className="num rounded-[6px] px-[7px] py-[1px] text-[9.5px] font-extrabold" style={{ background: 'var(--esc-indigo50)', color: 'var(--esc-indigo-t)' }}>US$ {t.usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{t.cotacaoDolar != null ? ` · ${t.cotacaoDolar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : ''}</span>
                        )}
                        {salvos.has(t.id) && <span className="text-[10px] font-extrabold" style={{ color: 'var(--esc-verde-t)' }}>salvo ✓</span>}
                      </div>
                      {/* ⛔⛔ o `key` CARREGA O VALOR — o nó é NOVO quando o valor chega (17/09) */}
                      <select
                        key={`cat-${t.id}-${valorDoSeletor(otimista, t)}`}
                        className="mt-1 h-7 w-full max-w-[260px] rounded border px-1 text-[11px]"
                        style={valorDoSeletor(otimista, t) ? { background: 'var(--esc-card)', color: 'var(--esc-tinta)', borderColor: 'var(--esc-linha)' } : { borderColor: 'var(--esc-ambar)', background: 'var(--esc-ambar50)', color: 'var(--esc-ambar-t)' }}
                        value={valorDoSeletor(otimista, t)}
                        onChange={(e) => categorizar([t.id], e.target.value || null)}
                        disabled={salvando}
                      >
                        <option value="">— sem categoria —</option>
                        {opcoesDoSeletor(data?.expenseCategories ?? [], t).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {/* ⭐⭐ A CATEGORIA GRAVADA, DITA EM TEXTO (17/09) */}
                      {t.categoryName && (
                        <p className="mt-0.5 text-[10px]" style={{ color: 'var(--esc-tinta3)' }}>
                          categoria salva: <span className="font-bold" style={{ color: 'var(--esc-tinta)' }}>{t.categoryName}</span>
                        </p>
                      )}
                      {!t.categoryId && t.suggestedCategoryId && (
                        <button type="button" className="mt-0.5 block rounded-[6px] px-[7px] py-[1px] text-[9.5px] font-extrabold" style={{ background: 'var(--esc-verde50)', color: 'var(--esc-verde-t)' }}
                          onClick={() => categorizar([t.id], t.suggestedCategoryId!)}>
                          🧠 usar “{(data?.expenseCategories ?? []).find((c) => c.id === t.suggestedCategoryId)?.name}” (regra aprendida)
                        </button>
                      )}
                      {lembrar?.txId === t.id && (
                        <div data-testid="lembrar-pra-proxima" className="mt-1 flex flex-wrap items-center gap-2 rounded-[8px] px-2 py-1 text-[11px] font-bold" style={{ background: 'var(--esc-indigo50)', color: 'var(--esc-indigo-t)' }}>
                          <span>lembrar “{nomeCat}” pra próxima vez que vier “{lembrar.padrao}”?</span>
                          <button type="button" onClick={lembrarRegra} className="rounded-[6px] px-2 py-0.5 font-extrabold" style={{ background: 'var(--esc-indigo)', color: 'var(--esc-on)' }}>lembrar</button>
                          <button type="button" onClick={() => setLembrar(null)} className="font-extrabold">agora não</button>
                        </div>
                      )}
                    </div>
                    {/* ⭐⭐ ESTORNO É CRÉDITO: sai com − e em verde */}
                    <span className="num whitespace-nowrap text-right text-[14.5px] font-extrabold" style={{ color: credito ? 'var(--esc-verde-t)' : 'var(--esc-tinta)' }}>
                      {credito ? `− ${formatBRL(t.amount)}` : formatBRL(t.amount)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="min-w-0 space-y-[14px]">
              {/* ── R47 o que já está comprometido ── */}
              <div className={`${painel('parc')} rounded-[20px] px-[18px] py-4`} style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
                <div className={`${ROT} mb-[6px]`} style={{ color: 'var(--esc-tinta3)' }}>Já comprometido · próximos meses</div>
                <PainelFuturo futuras={data.futuras} verTodas={verTodasParcelas} onVerTodas={() => setVerTodasParcelas((v) => !v)} />
              </div>
              {/* ── R50 o gráfico da casa ── */}
              <div className={`${painel('graf')} rounded-[20px] px-[18px] py-4`} style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
                <div className={`${ROT} mb-[6px]`} style={{ color: 'var(--esc-tinta3)' }}>Por categoria</div>
                <PorCategoria itens={data.porCategoria.map((c) => ({ nome: c.nome, valor: c.valor }))} />
              </div>
              <div className={`${painel('graf')} rounded-[20px] px-[18px] py-4`} style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
                <div className={`${ROT} mb-[6px]`} style={{ color: 'var(--esc-tinta3)' }}>Fatura por mês</div>
                <FaturaPorMes evolucao={data.evolucao} />
              </div>
            </div>
          </div>
        )}

        {/* Sprint Cartao-Uso-Pessoal: tratamento padrão das compras no import */}
        <div className="mt-[14px] rounded-[16px] px-4 py-3" style={{ ...SOMBRA, background: 'var(--esc-card)' }}>
          <div className={`${ROT} mb-2`} style={{ color: 'var(--esc-tinta3)' }}>Tratamento das compras (no import)</div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={card.defaultTreatment} disabled={savingTreatment} onChange={(e) => saveTreatment(e.target.value, e.target.value === 'PESSOAL_SOCIO' ? card.socioPFId : null)} className="h-9 min-w-0 max-w-full rounded border px-2 text-sm" style={{ background: 'var(--esc-card)', color: 'var(--esc-tinta)' }}>
              <option value="OPERACIONAL">Despesa operacional da empresa</option>
              <option value="PESSOAL_SOCIO">Uso pessoal do sócio (retirada)</option>
            </select>
            {card.defaultTreatment === 'PESSOAL_SOCIO' && (
              <select value={card.socioPFId ?? ''} disabled={savingTreatment} onChange={(e) => saveTreatment('PESSOAL_SOCIO', e.target.value || null)} className="h-9 min-w-0 max-w-full rounded border px-2 text-sm" style={{ background: 'var(--esc-card)', color: 'var(--esc-tinta)' }}>
                <option value="">— qual sócio —</option>
                {socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--esc-tinta3)' }}>
            {card.defaultTreatment === 'PESSOAL_SOCIO'
              ? 'As compras importadas nascem em "A CLASSIFICAR — cartão" (fila de revisão, fora do DRE, não aprendida). Você classifica depois com o contador, em lote.'
              : 'As compras importadas são despesa da empresa (entram no DRE). Se este cartão é de uso pessoal do sócio, troque acima.'}
          </p>
        </div>
      </div>
    </div>
  )
}
