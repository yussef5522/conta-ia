// Sprint Transferências Redesign (28/06/2026, Mercury/Ramp).
//
// /transferencias/revisar — Fila unificada de revisão.
//
// Substitui a confusão de 2 abas (Sugeridas + Aguardando par) por uma fila
// única. Mostra cada item UMA vez:
//   - Se tem sugestão de par: card AZUL "Achei o par" com botão Confirmar
//   - Se sem par: card AMBAR "Procurando o par" com botão Marcar manual
//
// Reusa o AguardandoParTab existente (ja unificado pelo endpoint
// aguardando-par que retorna pendentes + sugestoes).

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { useToast } from '@/components/ui/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { AguardandoParTab } from '../_components/AguardandoParTab'

export default function RevisarPage() {
  const params = useParams<{ id: string }>()
  const empresaId = params.id
  const { toast } = useToast()
  const [empresaNome, setEmpresaNome] = useState<string>('')
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)
  const [batchPreview, setBatchPreview] = useState<Array<{ txId: string; pairTxId: string }>>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    fetch(`/api/empresas/${empresaId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEmpresaNome(d?.empresa?.tradeName ?? d?.empresa?.name ?? ''))
      .catch(() => {})
  }, [empresaId])

  // Pré-monta os pares "seguros" pra confirmar em lote: pega cada pendingTransfer
  // que tem >=1 sugestão e usa a 1a (mais próxima na data).
  async function prepareBatch() {
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/transferencias/aguardando-par`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erro ao carregar' })
        return
      }
      const d = await res.json()
      const items = (d.items ?? []) as Array<{
        id: string
        sugestoes: Array<{ candidateId: string }>
      }>
      const pares: Array<{ txId: string; pairTxId: string }> = items
        .filter((i) => i.sugestoes.length > 0)
        .map((i) => ({ txId: i.id, pairTxId: i.sugestoes[0].candidateId }))
      if (pares.length === 0) {
        toast({ title: 'Nada pra confirmar em lote', description: 'Nenhuma sugestão segura.' })
        return
      }
      setBatchPreview(pares)
      setBatchConfirmOpen(true)
    } catch {
      toast({ variant: 'destructive', title: 'Erro' })
    }
  }

  async function executarBatch() {
    setBatchLoading(true)
    try {
      const res = await fetch(
        `/api/empresas/${empresaId}/transferencias/confirmar-em-lote`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pares: batchPreview }),
        },
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast({ variant: 'destructive', title: 'Erro', description: d.erro ?? 'Falhou' })
        return
      }
      const d = await res.json()
      const partsMsg: string[] = [`${d.paired} pareadas`]
      if (d.skipped > 0) partsMsg.push(`${d.skipped} pulados`)
      if (d.failed?.length > 0) partsMsg.push(`${d.failed.length} falharam`)
      toast({
        variant: 'success',
        title: 'Confirmação em lote concluída',
        description: partsMsg.join(' · '),
      })
      setBatchConfirmOpen(false)
      setBatchPreview([])
      setReloadKey((k) => k + 1)
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="Revisar transferências"
        description={
          empresaNome
            ? `${empresaNome} · Fila unificada`
            : 'Fila unificada de revisão'
        }
      >
        <Button variant="outline" asChild>
          <Link href={`/empresas/${empresaId}/transferencias`}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Dashboard
          </Link>
        </Button>
        <Button onClick={prepareBatch} variant="default">
          <Zap className="h-4 w-4 mr-1.5" />
          Confirmar todas seguras
        </Button>
      </Header>

      <Card className="rounded-xl border-blue-200/40 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-950/15">
        <CardContent className="py-3 flex items-start gap-3">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Cards azuis com par sugerido: confirme em 1 clique. Cards ambar sem par: aguarde
              o lado oposto chegar ou marque como aporte/retirada/não é transferência.
            </p>
            <p className="text-blue-700/80 dark:text-blue-300/80 mt-1">
              Nenhum item aparece em duas filas ao mesmo tempo. Tudo que aparece aqui está fora
              do DRE até você decidir.
            </p>
          </div>
        </CardContent>
      </Card>

      <AguardandoParTab key={reloadKey} empresaId={empresaId} />

      <ConfirmDialog
        open={batchConfirmOpen}
        onOpenChange={setBatchConfirmOpen}
        title={`Confirmar ${batchPreview.length} ${batchPreview.length === 1 ? 'transferência' : 'transferências'}?`}
        description={
          <>
            Vamos casar os pares sugeridos automaticamente. Cada par com 2 contas PJ vira
            transferência interna; PJ↔PF vira aporte/retirada (patrimônio).
            <br />
            <br />
            <strong>Reversível</strong>: cada par pode ser desfeito depois em "Conciliadas".
          </>
        }
        confirmLabel={batchLoading ? 'Confirmando…' : 'Confirmar todas'}
        onConfirm={executarBatch}
      />
    </div>
  )
}
