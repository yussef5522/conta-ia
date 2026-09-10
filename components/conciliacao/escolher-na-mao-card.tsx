'use client'

// ⭐⭐⭐ O CARD DO "ESCOLHER NA MÃO" (10/09/2026) — mock aprovado pelo dono.
//
// Segue a gramática da casa: **chão FRIO em cima é o extrato**, chão QUENTE embaixo é o que
// a gente deve, a tira do porquê é obrigatória, e **um primário só** (o roxo).
//
// ⛔⛔ AS TRÊS TRAVAS QUE MORAM AQUI, e nenhuma é enfeite:
//  1. **Conciliar só acende com diferença ZERO** — ou com ela resolvida com NOME, ou com a
//     baixa parcial ACEITA. Nunca com sobra solta.
//  2. **O atalho ⭐ só MARCA as caixas.** Ele não grava: *"o Conciliar continua sendo meu"*.
//  3. **Duas combinações que fecham = sem atalho.** O sistema não escolhe quais notas o
//     dono pagou — é a régua do lote, de 09/09.
//
// ⚠️ MOBILE PRIMEIRO: rodapé sticky, e a LINHA INTEIRA da nota é o alvo do dedo (não o
// quadradinho de 16px).

import { useState, useMemo, useCallback } from 'react'
import { Link2, Loader2, X, Sparkles, AlertTriangle, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { formatBRL } from '@/lib/format/money'

export interface NotaDoCardDTO {
  id: string
  descricao: string
  valor: number
  emAberto: number
  jaPago: number
  vencimento: string
  vencida: boolean
  sugerida: boolean
}

export interface CardDeEscolhaDTO {
  linha: { id: string; descricao: string; valor: number; data: string; conta: string | null; categoria: string | null }
  fornecedorId: string
  fornecedorNome: string
  vencidas: NotaDoCardDTO[]
  aVencer: NotaDoCardDTO[]
  atalho: { notasIds: string[]; resumo: string; ambiguo: boolean } | null
}

/** o teto do acerto com nome — o MESMO do servidor (`escolher-na-mao.ts`) */
const TETO = 25
const TOL = 0.02
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ⭐ os três nomes que a diferença pequena pode ter — o "Revisar valores" da Conta Azul */
const NOMES_DA_DIFERENCA = [
  { chave: 'JUROS', rotulo: 'juros/multa' },
  { chave: 'TARIFA', rotulo: 'tarifa' },
  { chave: 'DESCONTO', rotulo: 'desconto' },
] as const

interface Props {
  empresaId: string
  card: CardDeEscolhaDTO
  onConciliado: (extratoId: string) => void
  onFechar: () => void
}

export function EscolherNaMaoCard({ empresaId, card, onConciliado, onFechar }: Props) {
  const { toast } = useToast()
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set([...card.vencidas, ...card.aVencer].filter((n) => n.sugerida).map((n) => n.id)),
  )
  const [nomeDaDiferenca, setNomeDaDiferenca] = useState<string | null>(null)
  const [parcialAceita, setParcialAceita] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const todas = useMemo(() => [...card.vencidas, ...card.aVencer], [card])

  // ⚠️ a ORDEM importa: quem recebe a baixa parcial é a ÚLTIMA marcada (vencimento mais
  // distante), e a tela DIZ qual é — o dono desmarca se quiser outra.
  const marcadasOrdenadas = useMemo(
    () => todas.filter((n) => marcadas.has(n.id)),
    [todas, marcadas],
  )
  const selecionado = round2(marcadasOrdenadas.reduce((s, n) => s + n.emAberto, 0))
  const diferenca = round2(card.linha.valor - selecionado)
  const fecha = Math.abs(diferenca) <= TOL
  const falta = diferenca > TOL
  const passou = diferenca < -TOL
  const cabeNome = falta && diferenca <= TETO
  const ultima = marcadasOrdenadas[marcadasOrdenadas.length - 1]
  const sobra = round2(-diferenca)
  const parcial = passou && ultima && ultima.emAberto > sobra + TOL
    ? { nota: ultima, recebe: round2(ultima.emAberto - sobra), continuaEmAberto: sobra }
    : null

  const podeConciliar = fecha
    || (cabeNome && !!nomeDaDiferenca)
    || (!!parcial && parcialAceita)

  const alternar = useCallback((id: string) => {
    setParcialAceita(false)
    setMarcadas((m) => {
      const novo = new Set(m)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }, [])

  async function conciliar() {
    if (!podeConciliar) return
    setOcupado(true)
    try {
      // ⛔ a conta da PARCIAL não vai nas inteiras — o servidor recusa se for
      const inteiras = marcadasOrdenadas.filter((n) => n.id !== parcial?.nota.id).map((n) => n.id)
      const res = await fetch('/api/conciliacao/find-and-match/reconcile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ofxTransactionId: card.linha.id,
          candidateIds: inteiras,
          ...(parcial ? { parcial: { payableId: parcial.nota.id, valor: parcial.recebe } } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra conciliar', description: body?.erro ?? `HTTP ${res.status}` })
        return
      }
      toast({
        title: `${body.reconciled ?? inteiras.length} nota(s) quitada(s)`,
        description: parcial
          ? `${parcial.nota.descricao} recebeu ${formatBRL(parcial.recebe)} · ${formatBRL(parcial.continuaEmAberto)} continuam em aberto.`
          : 'Todas apontam pra a mesma linha do extrato.',
      })
      onConciliado(card.linha.id)
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setOcupado(false) }
  }

  const Nota = ({ n }: { n: NotaDoCardDTO }) => (
    <label className="flex cursor-pointer items-baseline gap-2.5 rounded-lg px-2 py-2 hover:bg-white/70 dark:hover:bg-slate-900/50">
      {/* ⭐ checkbox GRANDE e a linha inteira clicável — o card se usa no celular */}
      <input
        type="checkbox" checked={marcadas.has(n.id)} onChange={() => alternar(n.id)}
        className="h-[18px] w-[18px] shrink-0 translate-y-0.5 rounded border-slate-300 accent-[#534AB7]"
      />
      <span className="w-[92px] shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
        {formatBRL(n.emAberto)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-slate-700 dark:text-slate-200">{n.descricao}</span>
        {/* ⚠️ nota que já recebeu parte diz isso — o valor de face não é o que ela deve */}
        {n.jaPago > 0 && (
          <span className="block text-[11px] text-slate-400">
            de {formatBRL(n.valor)} · já baixados {formatBRL(n.jaPago)}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
        {n.vencida ? 'venceu' : 'vence'} {dia(n.vencimento)}
      </span>
    </label>
  )

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      {/* ── chão FRIO: a linha do banco ── */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-slate-50 px-4 py-3 dark:bg-slate-900/60">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          linha do extrato{card.linha.conta ? ` · ${card.linha.conta}` : ''}
        </span>
        <span className="w-full text-[19px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
          − {formatBRL(card.linha.valor)}
        </span>
        <span className="text-[12.5px] text-slate-600 dark:text-slate-300">{card.linha.descricao}</span>
        <span className="text-[11px] tabular-nums text-slate-400">
          {dia(card.linha.data)}{card.linha.categoria ? ` · ${card.linha.categoria}` : ''}
        </span>
      </div>

      {/* ⭐ O ATALHO — marca as caixas, não grava */}
      {card.atalho && !card.atalho.ambiguo && (
        <div className="flex flex-wrap items-center gap-2 border-y border-[#534AB7]/20 bg-[#534AB7]/[0.06] px-4 py-2 text-[12px] text-[#3d3688] dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>Existe uma combinação que crava: <b>{card.atalho.resumo}</b></span>
          <Button size="sm" variant="ghost"
            onClick={() => { setMarcadas(new Set(card.atalho!.notasIds)); setParcialAceita(false) }}
            className="ml-auto h-7 px-2.5 text-[11.5px] font-semibold text-[#534AB7] dark:text-indigo-300">
            aplicar
          </Button>
        </div>
      )}
      {card.atalho?.ambiguo && (
        <p className="border-y border-slate-200 bg-slate-50 px-4 py-2 text-[11.5px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
          ⚠️ <b>{card.atalho.resumo}</b> — o sistema não sabe qual foi, então não marca nada. A escolha é sua.
        </p>
      )}

      {/* ── chão QUENTE: as notas ── */}
      <div className="bg-amber-50/40 px-2 py-2 dark:bg-amber-950/10">
        {card.vencidas.length > 0 && (
          <>
            <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-600 dark:text-rose-400">
              vencidas · {card.fornecedorNome}
            </p>
            {card.vencidas.map((n) => <Nota key={n.id} n={n} />)}
          </>
        )}
        {card.aVencer.length > 0 && (
          <>
            {/* ⚠️ "a vencer" entra de propósito: o pagamento real leva junto a nota que
                ainda não venceu, e escondê-la faria o card nunca fechar nesses casos. */}
            <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              a vencer
            </p>
            {card.aVencer.map((n) => <Nota key={n.id} n={n} />)}
          </>
        )}
        {todas.length === 0 && (
          <p className="px-2 py-3 text-[12.5px] text-slate-500">
            Este fornecedor não tem nota em aberto — a linha não é pagamento de conta nossa.
          </p>
        )}
      </div>

      {/* ⭐ a diferença pequena fecha COM NOME */}
      {cabeNome && (
        <div className="flex flex-wrap items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <span>Sobra <b>{formatBRL(diferenca)}</b> — o que foi?</span>
          {NOMES_DA_DIFERENCA.map((o) => (
            <button key={o.chave} type="button" onClick={() => setNomeDaDiferenca(o.chave)}
              className={`rounded-md px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset transition-colors ${
                nomeDaDiferenca === o.chave
                  ? 'bg-amber-600 text-white ring-amber-600'
                  : 'bg-white text-amber-800 ring-amber-300 hover:bg-amber-100'}`}>
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
      {falta && !cabeNome && (
        <p className="flex items-start gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-[11.5px] leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          {/* ⛔ acima do teto não existe acerto rápido — a trava não é opinião */}
          Faltam <b className="mx-1">{formatBRL(diferenca)}</b>, acima do teto de {formatBRL(TETO)}:
          ou falta uma nota que não está no sistema, ou é baixa parcial, ou não é isso.
        </p>
      )}

      {/* ⭐⭐ BAIXA PARCIAL — o card explica ali mesmo */}
      {parcial && (
        <label className="flex cursor-pointer items-start gap-2 border-t border-[#534AB7]/20 bg-[#534AB7]/[0.06] px-4 py-2.5 text-[12px] leading-relaxed text-[#3d3688] dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          <input type="checkbox" checked={parcialAceita} onChange={(e) => setParcialAceita(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#534AB7]" />
          <span className="flex items-start gap-1.5">
            <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b>{parcial.nota.descricao}</b> recebe <b>{formatBRL(parcial.recebe)}</b> deste
              pagamento · <b>{formatBRL(parcial.continuaEmAberto)}</b> continuam em aberto no
              Contas a Pagar.
            </span>
          </span>
        </label>
      )}

      {/* ── RODAPÉ STICKY: a conta viva ── */}
      <div className={`sticky bottom-0 flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 text-[12.5px] tabular-nums ${
        fecha
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
          : passou
            ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300'
            : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
      }`}>
        <span>
          {fecha
            ? '✓ Diferença R$ 0,00'
            : falta
              ? <>selecionado <b>{formatBRL(selecionado)}</b> · faltam <b>{formatBRL(diferenca)}</b></>
              : parcial
                ? <>passou <b>{formatBRL(sobra)}</b> — a última nota recebe baixa parcial</>
                : <>passou <b>{formatBRL(sobra)}</b> — desmarca alguma</>}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Button size="sm" disabled={ocupado || !podeConciliar} onClick={conciliar}
            className="h-8 gap-1.5 px-3 text-xs">
            {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Conciliar
          </Button>
          <Button size="sm" variant="ghost" disabled={ocupado} onClick={onFechar}
            className="h-8 gap-1 px-2.5 text-xs text-slate-500 hover:text-rose-600">
            <X className="h-3.5 w-3.5" />
            não é isso
          </Button>
        </span>
      </div>
      <span className="hidden" data-empresa={empresaId} />
    </article>
  )
}
