/**
 * ⭐⭐⭐ O ALARME QUE LISTA E LEVA (04/11/2026)
 *
 * ⛔⛔ **O defeito que ele cura, visto em prod:** o card da Conciliação dizia *"EM DUPLA
 * CONTAGEM — R$ 408,65 — 1 conta paga sem vínculo"* e **mais nada**. Sem nome, sem valor por
 * linha, sem link. O dono lia o número e **não tinha como chegar na linha** — e a lista já
 * vinha no payload (`fila.contas`), jogada fora pela tela. *Porta sem maçaneta.*
 *
 * ⭐ **Um componente pros DOIS alarmes, não dois quase iguais** (REGRA 4): a dupla contagem e
 * a paga-por-fora têm o mesmo corpo (lista + link) e diferem no tom e no texto. Duas cópias
 * divergiriam no primeiro ajuste, e seria a cópia esquecida que o dono veria.
 *
 * ⚠️ `ocultas` existe pra que *remoção sem realocação* não aconteça: a conta que entrou num
 * lote sai desta lista (o card do lote explica o pagamento inteiro), e o alarme **diz** que
 * ela está lá em vez de encolher o número em silêncio.
 */
'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
// ⚠️ o DTO da TELA (datas em ISO, porque atravessaram JSON), não o tipo do servidor —
// tipar contra `ContaEsperandoPagamento` compilava e mentia sobre `conta.data` ser Date.
import type { ContaDaFilaDTO } from '@/components/conciliacao/par-sugerido'

/** ⚠️ as duas paletas vivem como objeto porque classe montada por template o Tailwind não vê */
const TONS = {
  rose: {
    caixa: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
    icone: 'text-rose-600 dark:text-rose-400',
    linha: 'border-rose-200/70 hover:bg-rose-100/60 dark:border-rose-900/60 dark:hover:bg-rose-900/30',
  },
  amber: {
    caixa: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
    icone: 'text-amber-600 dark:text-amber-400',
    linha: 'border-amber-200/70 hover:bg-amber-100/60 dark:border-amber-900/60 dark:hover:bg-amber-900/30',
  },
} as const

export interface AlarmeDeContasProps {
  tom: keyof typeof TONS
  contas: ContaDaFilaDTO[]
  /** quantas o número do servidor tem a mais que esta lista (ex.: já estão num lote) */
  ocultas: number
  empresaId: string
  titulo: (n: number) => string
  explicacao: (n: number) => string
}

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

/**
 * ⭐ O LINK — só com parâmetros que a tela de Contas a Pagar REALMENTE lê (`empresaId`,
 * `escopo`, `q`), lidos de `app/(dashboard)/contas-a-pagar/page.tsx` e de
 * `lib/contas-pagar/escopo.ts`. ⛔ *Deep-link com param inventado abre a tela no lugar
 * errado e parece que funcionou.*
 */
export function linkDaConta(empresaId: string, c: ContaDaFilaDTO): string {
  const p = new URLSearchParams({ empresaId, escopo: 'PAGA' })
  const busca = c.fornecedor ?? c.conta.descricao
  if (busca) p.set('q', busca)
  return `/contas-a-pagar?${p.toString()}`
}

export function AlarmeDeContas({
  tom, contas, ocultas, empresaId, titulo, explicacao,
}: AlarmeDeContasProps) {
  const total = contas.length + Math.max(0, ocultas)
  // ⛔ ZERO NÃO DESENHA CARD. Era isto que mantinha o alarme vivo depois de resolvido.
  if (total === 0) return null

  const t = TONS[tom]
  const soma = contas.reduce((s, c) => s + c.conta.valor, 0)

  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${t.caixa}`}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${t.icone}`} />
        <span>
          <b>{titulo(total)}</b> {explicacao(total)}
        </span>
      </div>

      {contas.length > 0 && (
        <ul className="mt-2 space-y-px">
          {contas.map((c) => (
            <li key={c.conta.id}>
              <Link
                href={linkDaConta(empresaId, c)}
                data-testid="alarme-conta-link"
                className={`flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 transition-colors ${t.linha}`}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {c.fornecedor ?? c.conta.descricao}
                </span>
                <span className="shrink-0 opacity-70">{dia(c.conta.data)}</span>
                <span className="shrink-0 font-semibold tabular-nums">{reais(c.conta.valor)}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ o rodapé só existe quando há o que ele explica — rótulo não promete o que não entrega */}
      {(contas.length > 1 || ocultas > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 px-2 text-[11.5px] opacity-80">
          {contas.length > 1 && <span className="tabular-nums">soma desta lista: {reais(soma)}</span>}
          {ocultas > 0 && (
            <span>
              + {ocultas} já {ocultas > 1 ? 'estão' : 'está'} num pagamento em lote, logo abaixo
            </span>
          )}
        </div>
      )}
    </div>
  )
}
