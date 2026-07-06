'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, FileText, AlertCircle, Check, ArrowUpRight, ArrowDownRight, Loader2, Landmark, AlertTriangle, ArrowLeftRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'
import { PreviewV2Classificado } from '@/components/importar-ofx/PreviewV2Classificado'
import { PreviewV3Premium, type V3Decisions } from '@/components/importar-ofx/PreviewV3Premium'
import {
  EditablePreviewTable,
  type CategoryOption,
  type CategorySuggestion,
} from '@/components/importar-ofx/EditablePreviewTable'

interface PreviewItem {
  fitid: string
  dedupHash: string
  date: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  memo: string
}

interface BancoDetectado {
  codigo: string
  nome: string
  batePerfilConta: boolean | null // null = conta sem cadastro, true/false = bate ou não
}

interface PreviewResult {
  preview: PreviewItem[]
  total: number
  novas: number
  duplicadas: number
  errosParser: string[]
  banco: BancoDetectado | null
  // Sprint Import Categoria Editável (18/06/2026)
  categorySuggestions?: CategorySuggestion[]
  categoriesForUI?: CategoryOption[]
  // Sprint OFX V3 R7 (27/06/2026) — refs da empresa pra detector de TRANSFER.
  // Sprint Owner Detection (28/06/2026): inclui CPFs + nomes dos sócios.
  ownEntityRefs?: {
    cnpj: string | null
    names: string[]
    accountNames: string[]
    ownerCpfs: string[]
    ownerNames: string[]
  }
}

interface TransferSide {
  transactionId: string
  accountId: string
  accountName: string
  date: string // ISO
  amount: number
  description: string
  isPreview: boolean // true = lado vem do OFX importando agora; false = tx já no banco
}

interface TransferEvidence {
  sameDay: boolean
  deltaDays: number
  amountExact: boolean
  keywordMatched: string | null
}

interface TransferCandidate {
  fromTransactionId: string
  toTransactionId: string
  fromAccountId: string
  toAccountId: string
  fromAccountName: string
  toAccountName: string
  confidence: number
  confidenceLevel: 'HIGH' | 'MEDIUM'
  reason: string
  suggestedAction: 'AUTO_PAIR' | 'CONFIRM' | 'IGNORE'
  // Sprint Card-Transfer: 2 lados embarcados + evidência granular
  from: TransferSide
  to: TransferSide
  evidence: TransferEvidence
  // Sprint 0.5 Dia 4 refinamento — info da tx existente que será deletada
  existingTxId: string
  existingTxCategoryName: string | null
  existingTxHasNotes: boolean
}

export default function ImportarOFXPage() {
  const params = useParams<{ id: string; contaId: string }>()
  const { id: empresaId, contaId } = params
  const router = useRouter()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingImport, setLoadingImport] = useState(false)
  // Sprint Unificar-Pipelines-Import (01/07/2026): modal de confirmação
  // antes do POST. Força o user a ver o TOTAL exato ("39 tx") antes de
  // commitar — contrato explícito. Contra-medida ao caso "vi 23, entraram 39".
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  // Sprint OFX V3 (27/06/2026)
  const [v3Enabled, setV3Enabled] = useState(false)
  const [v3Cards, setV3Cards] = useState<Array<{ id: string; name: string; lastDigits: string | null }>>([])
  const [v3Loans, setV3Loans] = useState<Array<{ id: string; lender: string; contractNumber: string | null; pendingInstallments: Array<{ number: number; dueDate: string; payment: number }> }>>([])
  const [v3PendingDecisions, setV3PendingDecisions] = useState<V3Decisions | null>(null)
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [bancoSalvo, setBancoSalvo] = useState(false)
  // Detecção de transferências entre contas (Sprint 0.5 Dia 4)
  const [candidatos, setCandidatos] = useState<TransferCandidate[]>([])
  const [detectandoTransfers, setDetectandoTransfers] = useState(false)
  const [pareados, setPareados] = useState<Set<string>>(new Set()) // keys = fromTxId
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set())
  const [confirmReplace, setConfirmReplace] = useState<TransferCandidate | null>(null)
  // Sprint Import Categoria Editável (18/06/2026)
  const [overrides, setOverrides] = useState<Record<string, string | null>>({})
  const [newRules, setNewRules] = useState<Array<{ tipoMatch: 'EXACT' | 'CONTAINS' | 'CNPJ'; padrao: string; categoryId: string }>>([])

  // Sprint OFX V3 — checa flag e carrega cards/loans pra dropdowns
  useEffect(() => {
    let cancelled = false
    async function bootV3() {
      try {
        const flagRes = await fetch('/api/feature-flags/ofx-v3', { credentials: 'include' })
        if (!flagRes.ok || cancelled) return
        const flag = await flagRes.json().catch(() => ({ enabled: false }))
        if (cancelled || !flag.enabled) return
        setV3Enabled(true)
        const [cardsR, loansR] = await Promise.all([
          fetch(`/api/empresas/${empresaId}/cartoes`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { cards: [] })),
          fetch(`/api/empresas/${empresaId}/emprestimos`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { loans: [] })),
        ])
        if (cancelled) return
        setV3Cards(
          (cardsR.cards ?? []).map((c: { id: string; name: string; lastDigits: string | null }) => ({
            id: c.id, name: c.name, lastDigits: c.lastDigits,
          })),
        )
        // mapear loans: pegar parcelas OPEN futuras
        // Sprint Fix Installments Path (27/06/2026): endpoint
        // /api/empresas/[id]/emprestimos/[loanId] retorna installments NO
        // TOP-LEVEL ({loan, agregados, installments, chartPoints}), NAO
        // dentro de data.loan. O acesso antigo `data.loan?.installments`
        // resolvia pra undefined em 100% dos casos -> pending=[] -> match
        // de empréstimo no preview V3 NUNCA disparava (cosmético, mas
        // tirava sugestão). Tipagem explícita do shape pra evitar regressão.
        interface LoanDetailResponse {
          loan: { id: string; lender: string; contractNumber: string | null }
          installments: Array<{
            number: number
            dueDate: string
            payment: number
            status: 'OPEN' | 'LATE' | 'PAID'
          }>
        }
        const loansOut = await Promise.all(
          (loansR.loans ?? []).slice(0, 50).map(async (l: { id: string; lender: string; contractNumber: string | null }) => {
            try {
              const det = await fetch(`/api/empresas/${empresaId}/emprestimos/${l.id}`, { credentials: 'include' })
              if (!det.ok) return { id: l.id, lender: l.lender, contractNumber: l.contractNumber, pendingInstallments: [] }
              const data: LoanDetailResponse = await det.json()
              // Cap 60 cobre BNDES parcela #56 etc (Sprint R7).
              const pending = (data.installments ?? [])
                .filter((p) => p.status === 'OPEN' || p.status === 'LATE')
                .slice(0, 60)
                .map((p) => ({
                  number: p.number,
                  dueDate: p.dueDate,
                  payment: p.payment,
                }))
              return { id: l.id, lender: l.lender, contractNumber: l.contractNumber, pendingInstallments: pending }
            } catch {
              return { id: l.id, lender: l.lender, contractNumber: l.contractNumber, pendingInstallments: [] }
            }
          }),
        )
        if (!cancelled) setV3Loans(loansOut)
      } catch {
        // V3 silent — preview V2 segue como fallback
      }
    }
    bootV3()
    return () => { cancelled = true }
  }, [empresaId])

  // Sprint OFX V3 — pós-import, aplica as marcações via /apply-marks.
  // Sprint Pending Transfer State (27/06/2026): nao perder mark em silencio.
  //   - Retry do map dedupHash->txId se vier incompleto (race pos-commit)
  //   - Toast EXPLICITO com nao-aplicadas (ex: "3 nao aplicadas, revise")
  async function applyV3MarksAfterImport(importId: string, decisions: V3Decisions) {
    if (decisions.marks.size === 0) return

    const novasGenuinas = (preview as unknown as { classificacao: { novasGenuinas: Array<{ ofxIndex: number; dedupHash: string }> } } | null)
      ?.classificacao?.novasGenuinas ?? []
    const hashByOfxIndex = new Map(novasGenuinas.map((n) => [n.ofxIndex, n.dedupHash]))
    const expectedHashes = new Set<string>()
    decisions.marks.forEach((_mark, ofxIndex) => {
      const h = hashByOfxIndex.get(ofxIndex)
      if (h) expectedHashes.add(h)
    })

    // Retry pra resolver race: ledger pode estar commitando ainda.
    // 3 tentativas com backoff 0/400/1200ms.
    async function fetchTxMap(): Promise<Map<string, string>> {
      const delays = [0, 400, 1200]
      let lastMap = new Map<string, string>()
      for (const d of delays) {
        if (d > 0) await new Promise((r) => setTimeout(r, d))
        try {
          const txRes = await fetch(`/api/transacoes?empresaId=${empresaId}&importId=${importId}&limit=2000`, {
            credentials: 'include',
          })
          if (!txRes.ok) continue
          const txData = await txRes.json()
          const m = new Map<string, string>()
          for (const tx of (txData.transacoes ?? []) as Array<{ id: string; dedupHash: string | null }>) {
            if (tx.dedupHash) m.set(tx.dedupHash, tx.id)
          }
          lastMap = m
          // Map cobre todas as expectedHashes? entao pode usar.
          let allFound = true
          for (const h of expectedHashes) {
            if (!m.has(h)) { allFound = false; break }
          }
          if (allFound) return m
        } catch {
          // continue retry
        }
      }
      return lastMap // melhor effort
    }

    try {
      const txByDedupHash = await fetchTxMap()

      const marks: Array<{ transactionId: string; kind: string; params?: Record<string, unknown> }> = []
      const notMappedCount = { value: 0 }
      decisions.marks.forEach((mark, ofxIndex) => {
        const dedupHash = hashByOfxIndex.get(ofxIndex)
        if (!dedupHash) { notMappedCount.value += 1; return }
        const txId = txByDedupHash.get(dedupHash)
        if (!txId) { notMappedCount.value += 1; return }
        marks.push({ transactionId: txId, kind: mark.kind, params: mark.params as Record<string, unknown> | undefined })
      })

      if (marks.length === 0) {
        if (notMappedCount.value > 0) {
          toast({
            variant: 'destructive',
            title: '⚠️ Marcações não aplicadas',
            description: `${notMappedCount.value} marcação(ões) ficaram sem aplicar (tx não encontrada). Revise em /transacoes.`,
          })
        }
        return
      }

      const applyRes = await fetch(`/api/contas-bancarias/${contaId}/importar-ofx/apply-marks`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ marks }),
      })
      if (applyRes.ok) {
        const r = await applyRes.json()
        const failed = r.failed?.length ?? 0
        const totalNotApplied = failed + notMappedCount.value
        if (totalNotApplied > 0) {
          toast({
            variant: 'destructive',
            title: `⚠️ ${r.applied} aplicadas · ${totalNotApplied} não aplicadas`,
            description: 'Revise as marcações na lista /transacoes ou em /transferencias > Aguardando par.',
          })
        } else {
          toast({
            title: `✨ ${r.applied} marcações aplicadas`,
            description: 'Tudo certo!',
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha ao aplicar marcações',
          description: 'Verifique /transacoes — pode precisar marcar manualmente.',
        })
      }
    } catch (err) {
      console.error('[V3 apply-marks]', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao aplicar marcações',
        description: err instanceof Error ? err.message : 'Erro desconhecido — revise em /transacoes.',
      })
    }
  }

  async function handleFile(file: File) {
    setArquivo(file)
    setPreview(null)
    setBancoSalvo(false)
    setCandidatos([])
    setPareados(new Set())
    setIgnorados(new Set())
    setLoadingPreview(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/contas-bancarias/${contaId}/importar-ofx?preview=true`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro ao ler arquivo', description: data.erro })
        return
      }
      setPreview(data)
      // Sprint Fix-Import-Vazio (05/07/2026): quando o backend detecta que
      // todas as tx do arquivo já foram importadas antes (re-import), ele
      // retorna preview=[] + mensagem informativa. Mostra toast neutro pra
      // o user entender por que o preview está vazio.
      if (data.mensagem && (!data.preview || data.preview.length === 0)) {
        toast({ title: 'Nada novo pra importar', description: data.mensagem })
      }
      // Dispara detecção de transferências em background (não bloqueia)
      detectarTransferencias(data.preview)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ler o arquivo.' })
    } finally {
      setLoadingPreview(false)
    }
  }

  async function detectarTransferencias(itens: PreviewItem[]) {
    if (itens.length === 0) return
    setDetectandoTransfers(true)
    try {
      const res = await fetch(`/api/contas-bancarias/${contaId}/detectar-transferencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transacoesPreview: itens.map((t) => ({
            id: t.dedupHash,
            description: t.memo,
            amount: t.amount,
            type: t.type,
            date: t.date,
          })),
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setCandidatos(data.candidates ?? [])
    } finally {
      setDetectandoTransfers(false)
    }
  }

  function parearCandidato(c: TransferCandidate) {
    // Se a tx existente tem categoria ou observações, abre dialog de confirmação
    // antes do Replace (pra não deletar dados que o user já preencheu).
    if (c.existingTxCategoryName || c.existingTxHasNotes) {
      setConfirmReplace(c)
      return
    }
    return executarParear(c)
  }

  async function executarParear(c: TransferCandidate) {
    // A tx do PREVIEW é a que tem accountId = contaId (a importada).
    // Identifica: se contaId == c.fromAccountId, o lado importing é "from"; senão "to".
    const importingIsFrom = c.fromAccountId === contaId
    const previewTxDedupHash = importingIsFrom ? c.fromTransactionId : c.toTransactionId
    const ofxTx = preview?.preview.find((t) => t.dedupHash === previewTxDedupHash)
    if (!ofxTx) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Transação do preview não encontrada.',
      })
      return
    }

    try {
      const res = await fetch('/api/transferencias/from-ofx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importingAccountId: contaId,
          ofxTransaction: {
            amount: ofxTx.amount,
            date: ofxTx.date,
            description: ofxTx.memo,
            type: ofxTx.type,
            dedupHash: ofxTx.dedupHash,
            fitid: ofxTx.fitid,
          },
          existingTransactionId: c.existingTxId,
        }),
      })

      if (res.status === 422) {
        const data = await res.json()
        toast({
          variant: 'destructive',
          title: 'Saldo insuficiente',
          description: data.erro ?? 'Limite de cheque especial excedido.',
        })
        return
      }
      if (!res.ok) {
        const data = await res.json()
        toast({
          variant: 'destructive',
          title: 'Erro ao parear',
          description: data.erro ?? 'Falha no pareamento',
        })
        return
      }

      setPareados((p) => new Set(p).add(c.fromTransactionId))
      toast({
        variant: 'success',
        title: 'Pareamento realizado',
        description:
          'Tx existente substituída por par TRANSFER. Definitivo — pra desfazer: /transferencias delete + reimportar OFX.',
      })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao parear.' })
    }
  }

  function ignorarCandidato(c: TransferCandidate) {
    setIgnorados((p) => new Set(p).add(c.fromTransactionId))
  }

  async function parearTodosAltaConfianca() {
    // Batch HIGH só pareia candidatos SEM categoria/notes (pra não soterrar
    // o user com dialogs em sequência). Os que têm dados ficam pra revisão manual.
    const altaConfianca = candidatos.filter(
      (c) =>
        c.confidenceLevel === 'HIGH' &&
        !pareados.has(c.fromTransactionId) &&
        !ignorados.has(c.fromTransactionId) &&
        !c.existingTxCategoryName &&
        !c.existingTxHasNotes,
    )
    for (const c of altaConfianca) {
      await executarParear(c)
    }
  }

  async function salvarBancoNoCadastro() {
    if (!preview?.banco) return
    setSalvandoBanco(true)
    try {
      // Busca dados atuais da conta para preservar campos não relacionados
      const getRes = await fetch(`/api/contas-bancarias/${contaId}`)
      if (!getRes.ok) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ler a conta atual.' })
        return
      }
      const { conta } = await getRes.json()

      // PUT espera o schema completo da conta — preservamos tudo, só sobrescrevemos banco
      const putRes = await fetch(`/api/contas-bancarias/${contaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: conta.name,
          accountType: conta.accountType,
          balance: conta.balance,
          agency: conta.agency ?? '',
          accountNumber: conta.accountNumber ?? '',
          bankName: preview.banco.nome,
          bankCode: preview.banco.codigo,
        }),
      })
      if (!putRes.ok) {
        const data = await putRes.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro ao salvar banco', description: data.erro ?? 'Tente novamente.' })
        return
      }
      setBancoSalvo(true)
      toast({ variant: 'success', title: 'Banco salvo no cadastro', description: `${preview.banco.nome} (${preview.banco.codigo}) vinculado à conta.` })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar banco no cadastro.' })
    } finally {
      setSalvandoBanco(false)
    }
  }

  async function handleImport(
    decisions?: Array<{
      dedupHash: string
      action: 'CREATE_NEW' | 'SKIP' | 'REPLACE_MANUAL' | 'CONCILIATE_PAYABLE'
    }>,
    // Sprint Fix-V3-Overrides (01/07/2026): variante robusta pra V3.
    // Quando explicitOverrides é passado, ele SOBRESCREVE o state 'overrides'
    // (que só é populado pelo V2 legacy EditablePreviewTable). Evita race
    // condition de setState React (setOverrides + POST no mesmo tick não
    // funciona porque state React é assíncrono).
    //
    // V2 legacy continua usando o state 'overrides' normalmente (não passa
    // explicitOverrides → cai no branch antigo).
    explicitOverrides?: Record<string, string | null>,
  ) {
    if (!arquivo) return
    setLoadingImport(true)
    try {
      const fd = new FormData()
      fd.append('file', arquivo)
      // Sprint Import Categoria Editável (18/06/2026): envia overrides + regras
      // Sprint Fix-V3-Overrides (01/07/2026): fonte é explicitOverrides quando
      // fornecido (V3), senão o state 'overrides' (V2).
      const overridesSource = explicitOverrides ?? overrides
      const overridesArr = Object.entries(overridesSource)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([dedupHash, categoryId]) => ({ dedupHash, categoryId }))
      if (overridesArr.length > 0) {
        fd.append('categoryOverrides', JSON.stringify(overridesArr))
      }
      if (newRules.length > 0) {
        fd.append('newRules', JSON.stringify(newRules))
      }
      // Sprint Preview-Truth (29/06/2026): envia decisões declarativas
      // (SKIP/CREATE_NEW por dedupHash). Resolve "o que aparece no
      // preview ≠ o que entra no DB".
      if (decisions && decisions.length > 0) {
        fd.append('decisions', JSON.stringify(decisions))
      }
      const res = await fetch(`/api/contas-bancarias/${contaId}/importar-ofx`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro na importação', description: data.erro })
        return
      }
      toast({ variant: 'success', title: 'Importação concluída', description: data.mensagem })

      // Sprint OFX V3 — após criar as tx, aplica marcações declarativas
      if (data.importId && v3PendingDecisions) {
        await applyV3MarksAfterImport(data.importId, v3PendingDecisions)
        setV3PendingDecisions(null)
      }

      // Sprint 4.0.3 — pós-import, escaneia sugestões de conciliação.
      // Se houver ≥1 → wizard de conciliação (UX premium).
      // Senão → fluxo Sprint 3.0.2 (conferência da classificação IA).
      if (data.importId) {
        let temSugestoes = false
        try {
          const scanRes = await fetch('/api/conciliacao/scan-by-import', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ importId: data.importId }),
          })
          if (scanRes.ok) {
            const scanData = await scanRes.json()
            temSugestoes = (scanData.suggestions?.length ?? 0) > 0
            if (temSugestoes) {
              toast({
                title: `${scanData.suggestions.length} sugestão${scanData.suggestions.length === 1 ? '' : 'es'} de conciliação`,
                description: 'Redirecionando pro wizard…',
              })
            }
          }
        } catch {
          // scan é best-effort — se falhar, segue fluxo normal
        }

        if (temSugestoes) {
          router.push(`/conciliacao/wizard?importId=${data.importId}`)
        } else {
          router.push(
            `/transacoes?empresaId=${empresaId}&importId=${data.importId}&conferencia=true`,
          )
        }
      } else {
        router.push(`/empresas/${empresaId}/contas/${contaId}/transacoes`)
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha na importação.' })
    } finally {
      setLoadingImport(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Importar Extrato OFX" description="Importe transações a partir de um arquivo .ofx ou .qfx">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/importar-pdf-extrato`}>
              <FileText className="h-4 w-4 mr-1" />
              Importar por PDF
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes`}>← Transações</Link>
          </Button>
        </div>
      </Header>

      {/* Drop zone */}
      <Card>
        <CardHeader><CardTitle className="text-base">Selecionar Arquivo</CardTitle></CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 px-6 py-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) handleFile(f)
            }}
          >
            {loadingPreview ? (
              <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-3" />
            ) : arquivo ? (
              <FileText className="h-10 w-10 text-primary mb-3" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            )}
            <p className="font-medium">
              {arquivo ? arquivo.name : 'Clique ou arraste o arquivo aqui'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Formatos suportados: .ofx, .qfx</p>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.qfx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {/* Sub-fase 2C (Yussef 12/06/2026) — Tela V2 quando payload vem com `classificacao`.
          Detecta pelo shape: se IMPORT_PREVIEW_V2=true em prod, backend manda V2 → renderiza
          tela nova. Senão renderiza a UI legada. /confirm legado (handleImport) inalterado. */}
      {preview && 'classificacao' in (preview as unknown as Record<string, unknown>) && !v3Enabled && (
        <PreviewV2Classificado
          payload={preview as unknown}
          onConfirmar={handleImport}
          onCancelar={() => { setArquivo(null); setPreview(null) }}
          loading={loadingImport}
        />
      )}

      {/* Sprint OFX V3 Premium (27/06/2026) — preview com seletor de tipo +
          IA explica. Ativa via OFX_IMPORT_V3_ENABLED=true em prod. */}
      {preview && 'classificacao' in (preview as unknown as Record<string, unknown>) && v3Enabled && (
        <PreviewV3Premium
          payload={preview as unknown as import('@/lib/ofx/preview-v2').V2PreviewPayload}
          categories={(preview.categoriesForUI ?? []).map((c) => ({
            id: c.id, name: c.name, type: c.type,
          }))}
          cards={v3Cards}
          loans={v3Loans}
          categorySuggestions={(preview.categorySuggestions ?? []).map((s) => ({
            dedupHash: s.dedupHash,
            categoryId: s.categoryId,
            categoryName: s.categoryName,
            // confidence string 'ALTA' | 'REVISAR' → número aproximado
            confidence: s.confidence === 'ALTA' ? 0.95 : 0.75,
            rulePattern: s.source === 'RULE' ? 'RULE' : null,
          }))}
          ownEntityRefs={preview.ownEntityRefs}
          onConfirmar={async (decisions) => {
            setV3PendingDecisions(decisions)
            // Sprint Fix-V3-Overrides (01/07/2026): bug pré-existente da Sprint
            // OFX V3 — o CategoryCombobox por linha do V3 monta decisions.
            // categoryOverrides corretamente, mas o onConfirmar chamava
            // handleImport() sem propagar, e a categoryOverrides ficava
            // apenas em v3PendingDecisions que era usado só pelas marks
            // pós-import. Resultado: saídas sem regra automática entravam
            // PENDING sem categoria (Cacula 01/07 · 6 tx).
            //
            // Fix: constrói o Record e passa EXPLICIT pra handleImport (via
            // parâmetro, não via setState assíncrono). O POST leva os
            // categoryOverrides e o backend applyCategoryOverrides sobrescreve
            // como MANUAL/RECONCILED com a categoria escolhida.
            const explicitOverrides: Record<string, string | null> = {}
            for (const o of decisions.categoryOverrides) {
              explicitOverrides[o.dedupHash] = o.categoryId
            }
            await handleImport(undefined, explicitOverrides)
          }}
          onCancelar={() => { setArquivo(null); setPreview(null); setV3PendingDecisions(null) }}
          loading={loadingImport}
        />
      )}

      {/* Sprint Import Categoria Editável (18/06/2026): tabela editável
          quando o preview vier com suggestions + categorias. Renderiza
          ENTRE banco detectado e CTA de confirmação. */}
      {preview && !('classificacao' in (preview as unknown as Record<string, unknown>))
        && preview.categorySuggestions
        && preview.categoriesForUI
        && preview.novas > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Conferir categorias antes de confirmar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditablePreviewTable
                novas={preview.preview.map((p) => ({
                  fitid: p.fitid,
                  dedupHash: p.dedupHash,
                  date: p.date,
                  amount: p.amount,
                  type: p.type,
                  memo: p.memo,
                }))}
                transferencias={candidatos.map((c) => ({
                  dedupHash: c.fromTransactionId,
                  date: c.from.date,
                  amount: c.from.amount,
                  memo: c.from.description,
                  pareadoCom: c.toAccountName,
                }))}
                duplicadas={preview.duplicadas}
                suggestions={preview.categorySuggestions}
                categories={preview.categoriesForUI}
                overrides={overrides}
                setOverrides={setOverrides}
                newRules={newRules}
                setNewRules={setNewRules}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {preview && !('classificacao' in (preview as unknown as Record<string, unknown>)) && (
        <>
          {/* Banco detectado */}
          {preview.banco && (
            <Card
              className={
                preview.banco.batePerfilConta === false
                  ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20'
                  : preview.banco.batePerfilConta === true || bancoSalvo
                  ? 'border-green-300 bg-green-50 dark:bg-green-950/20'
                  : ''
              }
            >
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  {preview.banco.batePerfilConta === false ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                  ) : preview.banco.batePerfilConta === true || bancoSalvo ? (
                    <Check className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <Landmark className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      Banco detectado: {preview.banco.nome}{' '}
                      <span className="font-normal text-muted-foreground">({preview.banco.codigo})</span>
                    </p>
                    {preview.banco.batePerfilConta === false ? (
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                        Não bate com o banco cadastrado nesta conta. Confira se você está importando o arquivo correto.
                      </p>
                    ) : preview.banco.batePerfilConta === true ? (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Confere com o cadastro da conta.
                      </p>
                    ) : bancoSalvo ? (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                        Banco vinculado ao cadastro da conta.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Esta conta ainda não tem banco cadastrado. Quer salvar?
                      </p>
                    )}
                  </div>
                </div>
                {preview.banco.batePerfilConta === null && !bancoSalvo && (
                  <Button size="sm" variant="outline" onClick={salvarBancoNoCadastro} disabled={salvandoBanco}>
                    {salvandoBanco ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Salvando...</> : 'Salvar no cadastro'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transferências detectadas (Sprint 0.5 Dia 4) */}
          {(detectandoTransfers || candidatos.length > 0) && (
            <Card className="border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  {detectandoTransfers
                    ? 'Detectando possíveis transferências...'
                    : `${candidatos.length} possível${candidatos.length !== 1 ? 'is' : ''} transferência${candidatos.length !== 1 ? 's' : ''} detectada${candidatos.length !== 1 ? 's' : ''}`}
                </CardTitle>
                {!detectandoTransfers && candidatos.length > 0 && (
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Heurística baseada em data, valor e descrição comparando contra suas outras contas da mesma empresa.
                  </p>
                )}
              </CardHeader>
              {!detectandoTransfers && candidatos.length > 0 && (
                <CardContent className="space-y-3">
                  {candidatos.some((c) => c.confidenceLevel === 'HIGH' && !pareados.has(c.fromTransactionId) && !ignorados.has(c.fromTransactionId)) && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={parearTodosAltaConfianca}>
                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                        Parear todas as Alta confiança
                      </Button>
                    </div>
                  )}
                  {candidatos.map((c) => {
                    const isPareado = pareados.has(c.fromTransactionId)
                    const isIgnorado = ignorados.has(c.fromTransactionId)
                    const isMuted = isPareado || isIgnorado
                    const fromDate = new Date(c.from.date).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })
                    const toDate = new Date(c.to.date).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })
                    return (
                      <div
                        key={c.fromTransactionId + c.toTransactionId}
                        className={`rounded-md border bg-card p-3 space-y-3 ${isMuted ? 'opacity-60' : ''}`}
                      >
                        {/* Header: ícone + accounts + badge confiança + ações */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <ArrowLeftRight className="h-4 w-4 text-blue-600 shrink-0" />
                            <span className="font-medium text-sm truncate">{c.fromAccountName}</span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="font-medium text-sm truncate">{c.toAccountName}</span>
                            <Badge
                              variant="outline"
                              className={
                                c.confidenceLevel === 'HIGH'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 text-xs dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'border-amber-300 bg-amber-50 text-amber-700 text-xs dark:bg-amber-950 dark:text-amber-300'
                              }
                            >
                              {c.confidenceLevel === 'HIGH' ? 'Alta' : 'Média'} ({Math.round(c.confidence * 100)}%)
                            </Badge>
                          </div>
                          {isPareado ? (
                            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 shrink-0 self-start">
                              <Check className="h-3 w-3 mr-1" />
                              Pareada
                            </Badge>
                          ) : isIgnorado ? (
                            <Badge variant="outline" className="shrink-0 self-start">Ignorada</Badge>
                          ) : (
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="default" onClick={() => parearCandidato(c)}>
                                Parear
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => ignorarCandidato(c)}>
                                Ignorar
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Grid 2-col: SAÍDA (esq, vermelha) + ENTRADA (dir, verde) */}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {/* SAÍDA */}
                          <div className="rounded border border-red-200 bg-red-50/50 p-2.5 dark:border-red-900 dark:bg-red-950/20">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
                              <ArrowUpRight className="h-3 w-3" />
                              Saída · {c.from.accountName}
                            </div>
                            <div className="mt-1 text-sm font-mono tabular-nums text-red-700 dark:text-red-300">
                              −{formatBRL(c.from.amount)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{fromDate}</div>
                            <div className="mt-1 text-xs font-mono break-words text-foreground/80" title={c.from.description}>
                              {c.from.description}
                            </div>
                            <Badge variant="outline" className="mt-1.5 text-[9px] px-1.5 py-0">
                              {c.from.isPreview ? 'Do extrato (novo)' : 'Já no sistema'}
                            </Badge>
                          </div>

                          {/* ENTRADA */}
                          <div className="rounded border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/20">
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              <ArrowDownRight className="h-3 w-3" />
                              Entrada · {c.to.accountName}
                            </div>
                            <div className="mt-1 text-sm font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                              +{formatBRL(c.to.amount)}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{toDate}</div>
                            <div className="mt-1 text-xs font-mono break-words text-foreground/80" title={c.to.description}>
                              {c.to.description}
                            </div>
                            <Badge variant="outline" className="mt-1.5 text-[9px] px-1.5 py-0">
                              {c.to.isPreview ? 'Do extrato (novo)' : 'Já no sistema'}
                            </Badge>
                          </div>
                        </div>

                        {/* Evidência granular */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            {c.evidence.sameDay ? 'Mesmo dia' : `D+${c.evidence.deltaDays}`}
                          </span>
                          {c.evidence.amountExact && (
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <Check className="h-3 w-3" />
                              Valor exato
                            </span>
                          )}
                          {c.evidence.keywordMatched && (
                            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <Check className="h-3 w-3" />
                              Contém &quot;{c.evidence.keywordMatched}&quot;
                            </span>
                          )}
                          {/* Avisos sobre tx existente que será substituída no Parear */}
                          {(c.existingTxCategoryName || c.existingTxHasNotes) && !isMuted && (
                            <span className="text-amber-700 dark:text-amber-400 text-[11px]">
                              ⚠ Tx existente tem
                              {c.existingTxCategoryName && ` categoria "${c.existingTxCategoryName}"`}
                              {c.existingTxCategoryName && c.existingTxHasNotes && ' e'}
                              {c.existingTxHasNotes && ' anotação'} — será preservado no audit
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {pareados.size > 0 && (
                    <div className="text-xs rounded-md bg-emerald-50 border border-emerald-300 p-3 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
                      <strong>✓ {pareados.size} pareamento{pareados.size !== 1 ? 's' : ''}</strong>{' '}
                      realizado{pareados.size !== 1 ? 's' : ''}. As transações existentes foram substituídas
                      pelo par TRANSFER e a transação correspondente do extrato será ignorada
                      automaticamente no import (slot UNIQUE reservado).{' '}
                      <Link href={`/empresas/${empresaId}/transferencias`} className="underline">
                        Ver em /transferencias →
                      </Link>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">Total no arquivo</p>
                <p className="text-2xl font-bold">{preview.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">Novas (serão importadas)</p>
                <p className="text-2xl font-bold text-green-600">{preview.novas}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs text-muted-foreground">Duplicadas (ignoradas)</p>
                <p className="text-2xl font-bold text-muted-foreground">{preview.duplicadas}</p>
              </CardContent>
            </Card>
          </div>

          {preview.errosParser.length > 0 && (
            <Card className="border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Avisos do parser</p>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 space-y-0.5">
                      {preview.errosParser.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.novas === 0 ? (
            <Card className="border-green-300 bg-green-50 dark:bg-green-950/20">
              <CardContent className="flex items-center gap-3 py-4">
                <Check className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-300 font-medium">
                  Todas as transações deste extrato já foram importadas anteriormente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Pré-visualização ({preview.novas} transações)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-96 overflow-y-auto">
                    {preview.preview.map((t) => (
                      <div key={t.dedupHash} className="flex items-center gap-3 px-4 py-3">
                        <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-full ${
                          t.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                        }`}>
                          {t.type === 'CREDIT' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{t.memo}</p>
                          <p className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{t.fitid}</Badge>
                        <span className={`shrink-0 font-semibold text-sm ${t.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'CREDIT' ? '+' : '−'} {formatBRL(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setArquivo(null); setPreview(null) }}>Cancelar</Button>
                {/* Sprint Unificar-Pipelines-Import (01/07/2026): abre modal
                    de confirmação em vez de disparar POST direto. Contrato
                    explícito do total. */}
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={loadingImport}
                >
                  {loadingImport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : `Confirmar importação (${preview.novas})`}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* Sprint Unificar-Pipelines-Import (01/07/2026): modal de confirmação
          do import. Mostra breakdown TOTAL antes do POST — user vê o número
          exato do que vai entrar (contra o padrão "vi 23, entraram 39"). */}
      <ConfirmDialog
        open={showConfirmModal}
        onOpenChange={setShowConfirmModal}
        title={preview ? `Criar ${preview.novas} ${preview.novas === 1 ? 'transação' : 'transações'}?` : 'Confirmar'}
        description={
          preview ? (
            <>
              Você está prestes a criar{' '}
              <strong className="tabular-nums">{preview.novas}</strong> transaç
              {preview.novas === 1 ? 'ão' : 'ões'} no seu banco de dados. Elas
              vão aparecer no extrato e no DRE.
              <br />
              <br />
              <span className="text-sm text-slate-500">
                Preview e confirm usam a MESMA função de classificação — o que
                você viu na tela é exatamente o que vai entrar. Nenhuma
                transação adicional.
              </span>
              <br />
              <br />
              Continuar?
            </>
          ) : ''
        }
        confirmLabel={preview ? `Sim, criar ${preview.novas}` : 'Sim'}
        onConfirm={async () => {
          setShowConfirmModal(false)
          await handleImport()
        }}
      />

      <ConfirmDialog
        open={!!confirmReplace}
        onOpenChange={(o) => !o && setConfirmReplace(null)}
        title="Confirmar pareamento?"
        description={
          confirmReplace ? (
            <>
              A transação existente em <strong>{confirmReplace.fromAccountId === contaId ? confirmReplace.toAccountName : confirmReplace.fromAccountName}</strong>{' '}
              {confirmReplace.existingTxCategoryName && (
                <>
                  está categorizada como <strong>{confirmReplace.existingTxCategoryName}</strong>
                </>
              )}
              {confirmReplace.existingTxCategoryName && confirmReplace.existingTxHasNotes && ' e '}
              {confirmReplace.existingTxHasNotes && <>tem observações preenchidas</>}.
              <br />
              <br />
              O pareamento vai <strong>excluir</strong> essa transação e criar um par de transferência no lugar.
              A categoria e observações serão perdidas (mas ficam registradas no audit log pra rastreabilidade).
              <br />
              <br />
              Continuar?
            </>
          ) : ''
        }
        confirmLabel="Sim, parear e excluir"
        variant="destructive"
        onConfirm={async () => {
          if (confirmReplace) await executarParear(confirmReplace)
          setConfirmReplace(null)
        }}
      />
    </div>
  )
}
