'use client'

// ⭐⭐⭐ O CARD DO PAGAMENTO EM LOTE (09/09/2026) — 1 PIX liquida N notas.
//
// **O dono:** *"fornecedor pequeno com VÁRIAS notinhas — eu pago JUNTO, num PIX só."*
//
// Segue a MESMA gramática do card 1:1 (`par-sugerido.tsx`): chão FRIO à esquerda é o
// extrato, chão QUENTE à direita é o que a gente devia, e a tira do porquê é obrigatória.
// A diferença é que o lado quente é uma LISTA com caixas de marcar.
//
// ⛔⛔ AS CAIXAS COMEÇAM TODAS MARCADAS **e a soma é recalculada a cada clique** — o botão
// só habilita quando a soma bate com a linha ao centavo. Não existe caminho em que o dono
// confirme um lote que não fecha: o servidor recusaria de todo jeito (a validação de soma
// do `/find-and-match/reconcile`), e deixar o botão vivo seria prometer o que não vai
// acontecer.

import { useState, useMemo } from 'react'
import { Link2, Loader2, Search, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

/** o que a tela precisa saber da linha do extrato pra desenhar o lado frio */
export interface LinhaDoLoteDTO {
  descricao: string
  data: string
  conta: string | null
  categoria: string | null
}

export interface NotaDoLoteDTO {
  id: string
  descricao: string
  valor: number
  vencimento: string
}

export interface LoteDTO {
  extratoId: string
  /** ⭐ a linha do extrato vem ECOADA do servidor — a tela não busca de novo */
  linha: LinhaDoLoteDTO
  fornecedorId: string
  fornecedorNome: string
  notas: NotaDoLoteDTO[]
  soma: number
  valorDaLinha: number
  diferenca: number
  porQue: string
  abertasDoFornecedor: number
}


const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
/** a mesma tolerância do endpoint que grava — tela e servidor com a mesma régua */
const TOLERANCIA = 0.02

interface Props {
  lote: LoteDTO
  linha: LinhaDoLoteDTO
  onVinculado: (extratoId: string, notasIds: string[]) => void
  onProcurar: (extratoId: string, busca: string) => void
}

export function LoteSugerido({ lote, linha, onVinculado, onProcurar }: Props) {
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState(false)
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(lote.notas.map((n) => n.id)),
  )

  const soma = useMemo(
    () => Math.round(lote.notas.filter((n) => marcadas.has(n.id))
      .reduce((s, n) => s + n.valor, 0) * 100) / 100,
    [lote.notas, marcadas],
  )
  const diferenca = Math.round((lote.valorDaLinha - soma) * 100) / 100
  const bate = Math.abs(diferenca) <= TOLERANCIA && marcadas.size > 0

  async function vincular() {
    setOcupado(true)
    try {
      const res = await fetch('/api/conciliacao/find-and-match/reconcile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: lote.extratoId,
          candidateIds: [...marcadas],
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra vincular o lote', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({
        title: `${body.reconciled ?? marcadas.size} notas liquidadas`,
        description: `Todas apontam pra a mesma linha do extrato — o pagamento do ${lote.fornecedorNome}.`,
      })
      onVinculado(lote.extratoId, [...marcadas])
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setOcupado(false) }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-[#534AB7]/30 bg-white shadow-sm transition-shadow hover:shadow dark:border-indigo-900 dark:bg-slate-950">
      <div className="flex items-center gap-2 border-b border-[#534AB7]/20 bg-[#534AB7]/[0.06] px-4 py-2 text-[12px] text-[#3d3688] dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
        <Layers className="h-3.5 w-3.5 shrink-0" />
        <span>
          <b>Um pagamento, {lote.notas.length} notas.</b> Parece o PIX que liquidou várias
          notinhas do {lote.fornecedorNome} de uma vez.
        </span>
      </div>

      <div className="grid md:grid-cols-[1fr_36px_1.4fr]">
        {/* ── lado FRIO: a linha do banco ── */}
        <div className="flex min-w-0 flex-col gap-1 bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            linha do extrato{linha.conta ? ` · ${linha.conta}` : ''}
          </span>
          <span className="text-[19px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
            − {formatBRL(lote.valorDaLinha)}
          </span>
          <span className="break-words text-[12.5px] leading-snug text-slate-600 dark:text-slate-300">
            {linha.descricao}
          </span>
          <span className="text-[11px] tabular-nums text-slate-400">
            {dia(linha.data)}{linha.categoria ? ` · ${linha.categoria}` : ' · sem categoria'}
          </span>
        </div>

        <div className="flex h-7 items-center justify-center border-y border-slate-200 bg-white text-slate-300 dark:border-slate-800 dark:bg-slate-950 md:h-auto md:flex-col md:border-x md:border-y-0">
          <Link2 className="h-3.5 w-3.5" />
        </div>

        {/* ── lado QUENTE: as notas ── */}
        <div className="min-w-0 bg-amber-50/40 px-4 py-3 dark:bg-amber-950/10">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            {lote.notas.length} contas a pagar em aberto · {lote.fornecedorNome}
          </span>
          <ul className="mt-1.5 space-y-1">
            {lote.notas.map((n) => (
              <li key={n.id}>
                {/* ⭐ a linha inteira é clicável — o alvo do dedo no celular é a linha,
                    não um quadradinho de 16px */}
                <label className="flex cursor-pointer items-baseline gap-2 rounded-md px-1 py-0.5 hover:bg-white/70 dark:hover:bg-slate-900/50">
                  <input
                    type="checkbox"
                    checked={marcadas.has(n.id)}
                    onChange={(e) => setMarcadas((m) => {
                      const novo = new Set(m)
                      if (e.target.checked) novo.add(n.id); else novo.delete(n.id)
                      return novo
                    })}
                    className="h-3.5 w-3.5 shrink-0 translate-y-0.5 rounded border-slate-300 accent-[#534AB7]"
                  />
                  <span className="w-[86px] shrink-0 text-right text-[12.5px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {formatBRL(n.valor)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-slate-600 dark:text-slate-300">
                    {n.descricao}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
                    vence {dia(n.vencimento)}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {/* ⛔ A CONTA À VISTA: o dono confere a soma contra a linha ANTES de confirmar,
              e ela muda a cada caixa desmarcada. */}
          <div className={`mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border px-2.5 py-1.5 text-[12px] tabular-nums ${
            bate
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
          }`}>
            <span>
              {marcadas.size} marcada{marcadas.size === 1 ? '' : 's'}: <b>{formatBRL(soma)}</b>
            </span>
            <span>
              {bate
                ? '✓ bate com a linha do extrato'
                : `falta ${formatBRL(Math.abs(diferenca))} pra fechar${diferenca < 0 ? ' (passou)' : ''}`}
            </span>
          </div>
        </div>
      </div>

      {/* ⛔ A TIRA DO PORQUÊ — sem ela a sugestão não pode existir */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
        <span className="shrink-0 rounded-full bg-[#534AB7]/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#534AB7] dark:bg-indigo-950/50 dark:text-indigo-300">
          pagamento em lote
        </span>
        <span className="min-w-[180px] flex-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          {lote.porQue}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" disabled={ocupado || !bate} onClick={vincular} className="h-8 gap-1.5 px-3 text-xs">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Vincular {marcadas.size} nota{marcadas.size === 1 ? '' : 's'}
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado}
            onClick={() => onProcurar(lote.extratoId, lote.fornecedorNome)}
            className="h-8 gap-1 px-2.5 text-xs text-slate-500"
            title="escolher as notas na mão, com a soma conferida">
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Escolher na mão</span>
          </Button>
        </span>
      </div>
    </article>
  )
}
