// Sprint PF Fatia 3 — Upload OFX + escolha cartão.

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Upload,
  Loader2,
  CreditCard as CardIcon,
  FileText,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CardItem {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
}

export default function ImportarPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const search = useSearchParams()
  const preselectedCard = search.get('cartao')

  const [cards, setCards] = useState<CardItem[]>([])
  const [selectedCard, setSelectedCard] = useState<string>(preselectedCard ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Sprint Fatia 3.5
  const [pdfAllowed, setPdfAllowed] = useState<boolean>(false)
  const [pdfStatusMsg, setPdfStatusMsg] = useState<string>('')

  useEffect(() => {
    fetch(`/api/perfis/${id}/cartoes`)
      .then((r) => r.json())
      .then((d) => setCards(d.cards ?? []))
    fetch(`/api/perfis/${id}/pdf-import/status`)
      .then((r) => r.json())
      .then((d) => {
        setPdfAllowed(d?.allowed === true)
        if (d?.message) setPdfStatusMsg(d.message)
      })
      .catch(() => setPdfAllowed(false))
  }, [id])

  function isPdf(f: File): boolean {
    return f.name.toLowerCase().endsWith('.pdf') || f.type.includes('pdf')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) {
      setError('Selecione um arquivo')
      return
    }
    if (!selectedCard) {
      setError('Selecione um cartão')
      return
    }
    const usingPdf = isPdf(file)
    if (usingPdf && !pdfAllowed) {
      setError(pdfStatusMsg || 'Import de PDF não está disponível no momento. Use OFX.')
      return
    }
    setSubmitting(true)
    try {
      if (usingPdf) {
        // PDF: extrai via Claude Vision, depois redireciona pro preview
        const form = new FormData()
        form.append('file', file)
        form.append('creditCardId', selectedCard)
        const r = await fetch(`/api/perfis/${id}/pdf-import/preview`, {
          method: 'POST',
          body: form,
        })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          setError(d.erro ?? 'Falha ao ler PDF')
          return
        }
        const data = await r.json()
        // Cache preview no sessionStorage (sem rawContent — PDF não re-parsea)
        try {
          sessionStorage.setItem(`pdf-preview:${data.importId}`, JSON.stringify(data))
        } catch {
          // quota
        }
        router.push(`/perfis/${id}/importar/preview/${data.importId}?source=pdf`)
        return
      }

      // OFX: caminho existente
      const rawContent = await file.text()
      const form = new FormData()
      form.append('file', file)
      form.append('creditCardId', selectedCard)
      const r = await fetch(`/api/perfis/${id}/ofx-import/preview`, {
        method: 'POST',
        body: form,
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.erro ?? 'Falha no upload')
        return
      }
      const data = await r.json()
      try {
        sessionStorage.setItem(`ofx-content:${data.importId}`, rawContent)
      } catch {
        // quota
      }
      router.push(`/perfis/${id}/importar/preview/${data.importId}`)
    } catch {
      setError('Sem conexão')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/perfis/${id}`}
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 mb-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Upload className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Importar fatura</h1>
          <p className="text-sm text-zinc-600">
            OFX do cartão (Nubank, Itaú, Bradesco…) — IA categoriza sozinha
          </p>
        </div>
      </div>

      {pdfAllowed && (
        <Card className="mb-4 border-purple-200 bg-purple-50/40">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-purple-900">
                Novo: aceita PDF da fatura (IA Vision lê automaticamente)
              </p>
              <p className="text-xs text-purple-700 mt-0.5">
                Bancos sem OFX: C6, Inter, Will, faturas antigas em PDF — IA
                extrai as transações. Revisão obrigatória antes de importar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-2">
                1. Arquivo {pdfAllowed ? 'OFX ou PDF' : 'OFX'} *
              </label>
              <input
                type="file"
                accept={pdfAllowed ? '.ofx,.qfx,.pdf' : '.ofx,.qfx'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {pdfAllowed
                  ? 'Aceita .ofx, .qfx ou .pdf · máx 5MB · até 500 transações'
                  : 'Aceita .ofx ou .qfx · máx 5MB · até 500 transações'}
              </p>
              {file && isPdf(file) && (
                <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  PDF detectado — vai usar IA Vision pra ler (~10-20s)
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-2">
                2. Cartão de destino *
              </label>
              {cards.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <CardIcon className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-600 mb-3">
                    Você não tem cartões cadastrados ainda
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/perfis/${id}/cartoes/novo`}>
                      Criar cartão primeiro
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {cards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCard(c.id)}
                      className={`text-left rounded-lg border p-3 transition-all ${
                        selectedCard === c.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-zinc-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CardIcon
                          className={`h-4 w-4 ${
                            selectedCard === c.id ? 'text-emerald-700' : 'text-zinc-600'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-zinc-900 truncate">
                            {c.name}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">
                            {c.bankName}
                            {c.brand && ` · ${c.brand}`}
                            {c.lastDigits && ` · ****${c.lastDigits}`}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={submitting || !file || !selectedCard}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Próximo: categorizar com IA →
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={`/perfis/${id}`}>Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
