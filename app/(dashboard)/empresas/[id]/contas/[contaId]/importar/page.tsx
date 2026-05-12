'use client'

import { useState, useRef } from 'react'
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
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [bancoSalvo, setBancoSalvo] = useState(false)
  // Detecção de transferências entre contas (Sprint 0.5 Dia 4)
  const [candidatos, setCandidatos] = useState<TransferCandidate[]>([])
  const [detectandoTransfers, setDetectandoTransfers] = useState(false)
  const [pareados, setPareados] = useState<Set<string>>(new Set()) // keys = fromTxId
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set())
  const [confirmReplace, setConfirmReplace] = useState<TransferCandidate | null>(null)

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

  async function handleImport() {
    if (!arquivo) return
    setLoadingImport(true)
    try {
      const fd = new FormData()
      fd.append('file', arquivo)
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
      router.push(`/empresas/${empresaId}/contas/${contaId}/transacoes`)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha na importação.' })
    } finally {
      setLoadingImport(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header title="Importar Extrato OFX" description="Importe transações a partir de um arquivo .ofx ou .qfx">
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/contas/${contaId}/transacoes`}>← Transações</Link>
        </Button>
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
      {preview && (
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
                    return (
                      <div
                        key={c.fromTransactionId + c.toTransactionId}
                        className={`rounded-md border bg-card p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${isMuted ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <ArrowLeftRight className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
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
                            <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>
                          </div>
                        </div>
                        {isPareado ? (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 shrink-0">
                            <Check className="h-3 w-3 mr-1" />
                            Pareada
                          </Badge>
                        ) : isIgnorado ? (
                          <Badge variant="outline" className="shrink-0">Ignorada</Badge>
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
                <Button onClick={handleImport} disabled={loadingImport}>
                  {loadingImport ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</> : `Confirmar importação (${preview.novas})`}
                </Button>
              </div>
            </>
          )}
        </>
      )}

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
