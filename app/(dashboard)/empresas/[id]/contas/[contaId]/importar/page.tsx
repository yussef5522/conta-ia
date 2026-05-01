'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Upload, FileText, AlertCircle, Check, ArrowUpRight, ArrowDownRight, Loader2, Landmark, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

interface PreviewItem {
  fitid: string
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

  async function handleFile(file: File) {
    setArquivo(file)
    setPreview(null)
    setBancoSalvo(false)
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
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ler o arquivo.' })
    } finally {
      setLoadingPreview(false)
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
                      <div key={t.fitid} className="flex items-center gap-3 px-4 py-3">
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
    </div>
  )
}
