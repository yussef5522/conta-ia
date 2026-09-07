'use client'

// ⭐⭐ A SUGESTÃO DE VÍNCULO NA FILA DE PENDENTES (07/09/2026).
//
// *"Eu olhando uma conta a pagar casável e sem gesto pra casar."* — o dono.
//
// Segue o desenho que a tela já usa pra sugestão de fornecedor (ZONA 2 separada
// da linha crua) e a regra que a casa já aplica na detecção de empréstimo:
// **sugestão NUNCA remove a saída padrão** — o dropdown de categoria continua ali.
//
// ⛔ RÉGUA DE HONESTIDADE (a do dono, três partes):
//   1. o motivo da sugestão está SEMPRE visível — nunca "confie em mim";
//   2. nunca vincula sozinha — são DOIS botões, e o verde não é o único;
//   3. "não é isso" ENSINA: o par recusado não volta a ser sugerido.

import { useState } from 'react'
import { Link2, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface VinculoSugerido {
  extratoId: string
  contaId: string
  score: number
  confianca: 'alta' | 'media' | 'baixa'
  porQue: string
  diferenca: number
  fornecedorPeloNome: string | null
  rotulo: string
  outroLado: {
    id: string
    descricao: string
    valor: number
    data: string
    tipo: 'CREDIT' | 'DEBIT'
  }
}

interface Props {
  empresaId: string
  /** a linha da fila que está sendo olhada */
  transacaoId: string
  sugestoes: VinculoSugerido[]
  /** o caller tira a linha da lista sem refetch (preserva o scroll) */
  onVinculada: (transacaoId: string) => void
  onRecusada: (transacaoId: string, contaId: string, extratoId: string) => void
}

const CORES = {
  alta: 'border-emerald-300 bg-emerald-50/60 text-emerald-900',
  media: 'border-amber-300 bg-amber-50/60 text-amber-900',
  baixa: 'border-slate-300 bg-slate-50 text-slate-800',
} as const

const GRAU = { alta: 'muito provável', media: 'provável', baixa: 'possível' } as const

export function SugestaoDeVinculoBanner({
  empresaId, transacaoId, sugestoes, onVinculada, onRecusada,
}: Props) {
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState<string | null>(null)

  if (!sugestoes.length) return null

  async function vincular(s: VinculoSugerido) {
    setOcupado(s.contaId)
    try {
      const res = await fetch('/api/conciliacao/confirmar', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: s.extratoId,
          candidateId: s.contaId,
          // ⛔ a diferença vai EXPLÍCITA e tem que bater ao centavo no servidor —
          // é o dono confirmando o número que ele viu, não um "force".
          ...(Math.abs(s.diferenca) >= 0.01 ? { diferencaAceita: s.diferenca } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra vincular', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({ title: 'Vinculado', description: 'O pagamento e a conta viraram uma linha só.' })
      onVinculada(transacaoId)
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally {
      setOcupado(null)
    }
  }

  async function recusar(s: VinculoSugerido) {
    setOcupado(s.contaId)
    try {
      const res = await fetch('/api/conciliacao/recusar', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresaId, extratoId: s.extratoId, contaId: s.contaId }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra registrar a recusa' })
        return
      }
      onRecusada(transacaoId, s.contaId, s.extratoId)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="mx-4 mb-3 space-y-2">
      {sugestoes.map((s) => (
        <div key={`${s.extratoId}|${s.contaId}`} className={`rounded-md border px-3 py-2 ${CORES[s.confianca]}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-medium">
                Parece o pagamento de <span className="font-semibold">{s.outroLado.descricao}</span>
              </p>
              <p className="text-[11px] tabular-nums opacity-90">
                {s.rotulo} · {formatBRL(Math.abs(s.outroLado.valor))} ·{' '}
                {new Date(s.outroLado.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                {Math.abs(s.diferenca) >= 0.01 && (
                  <> · <b>{formatBRL(Math.abs(s.diferenca))} de diferença</b> (juros/tarifa)</>
                )}
              </p>
              {/* ⛔ o PORQUÊ é obrigatório: sugestão sem motivo visível não existe */}
              <p className="text-[11px] opacity-75 mt-0.5">{GRAU[s.confianca]} — {s.porQue}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="outline" disabled={!!ocupado} onClick={() => vincular(s)}
                className="gap-1.5 bg-white/70 h-7 text-xs">
                {ocupado === s.contaId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Vincular
              </Button>
              <Button size="sm" variant="ghost" disabled={!!ocupado} onClick={() => recusar(s)}
                className="gap-1 h-7 text-xs opacity-70 hover:opacity-100"
                title="não sugere mais este par">
                <X className="h-3.5 w-3.5" />
                Não é isso
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
