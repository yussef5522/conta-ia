'use client'

// ⭐⭐⭐ A FILA DO FIND & MATCH — UM CARD POR FORNECEDOR, FECHADO (10/09/2026).
//
// **O dono, navegando em prod:** *"a APRESENTAÇÃO virou parede: 16 cards abertos, Ivan
// aparece 3×, Casper 5×. O mock era outra coisa: a fila mostra cards COLAPSADOS
// (fornecedor · N linhas · valor total), eu abro UM de cada vez."*
//
// ⛔⛔ **E NÃO É SÓ ARRUMAÇÃO — É A TRAVA.** N cards do mesmo fornecedor mostram AS MESMAS
// notas e disputam entre si; marcar uma nota num card e outra no vizinho é o caminho pra
// vincular a errada (foi assim que a NF do Cancian foi conciliada em 08/09). A faixa de
// disputa existe pro caso 1:1, mas aqui *"o desenho certo é nem criar a disputa visual"*:
// **com um grupo aberto e uma linha por vez, o estado ruim é inalcançável** (REGRA 5).

import { useState, useMemo, useCallback, useEffect } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import { formatBRL } from '@/lib/format/money'
import { EscolherNaMaoCard, type CardDeEscolhaDTO } from './escolher-na-mao-card'

/** ⚠️ o DTO chega com data em string (JSON) — o agrupador da lib trabalha com Date */
interface Grupo {
  fornecedorId: string
  fornecedorNome: string
  linhas: CardDeEscolhaDTO[]
  total: number
  maisAntiga: number
}

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⚠️ MESMA REGRA da `agruparPorFornecedor` da lib, sobre o DTO serializado. A lib é a
 * dona da decisão e tem os testes; aqui é a tradução de `string` pra `number` do tempo.
 */
export function agruparDTO(cards: CardDeEscolhaDTO[]): Grupo[] {
  const porId = new Map<string, CardDeEscolhaDTO[]>()
  for (const c of cards) {
    const atual = porId.get(c.fornecedorId)
    if (atual) atual.push(c); else porId.set(c.fornecedorId, [c])
  }
  return [...porId.entries()]
    .map(([fornecedorId, linhas]) => {
      const ordenadas = [...linhas].sort(
        (a, b) => +new Date(a.linha.data) - +new Date(b.linha.data),
      )
      return {
        fornecedorId,
        fornecedorNome: ordenadas[0].fornecedorNome,
        linhas: ordenadas,
        total: round2(ordenadas.reduce((s, l) => s + l.linha.valor, 0)),
        maisAntiga: +new Date(ordenadas[0].linha.data),
      }
    })
    .sort((a, b) => a.maisAntiga - b.maisAntiga)
}

interface Props {
  empresaId: string
  cards: CardDeEscolhaDTO[]
  onConciliado: (extratoId: string) => void
}

export function FilaEscolherNaMao({ empresaId, cards, onConciliado }: Props) {
  const grupos = useMemo(() => agruparDTO(cards), [cards])
  /** ⛔ UM aberto por vez — é a trava, não uma preferência de layout */
  const [aberto, setAberto] = useState<string | null>(null)
  const [indice, setIndice] = useState<Record<string, number>>({})

  // ⚠️ o grupo encolhe quando uma linha é conciliada; sem isto o índice apontaria pro
  // vazio e o card sumiria com o grupo ainda aberto — parecendo defeito.
  useEffect(() => {
    setIndice((m) => {
      const novo: Record<string, number> = {}
      for (const g of grupos) novo[g.fornecedorId] = Math.min(m[g.fornecedorId] ?? 0, g.linhas.length - 1)
      return novo
    })
    setAberto((a) => (a && grupos.some((g) => g.fornecedorId === a) ? a : null))
  }, [grupos])

  const irPara = useCallback((fornecedorId: string, i: number) => {
    setIndice((m) => ({ ...m, [fornecedorId]: i }))
  }, [])

  if (!grupos.length) return null

  const linhasTotais = grupos.reduce((n, g) => n + g.linhas.length, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2.5 px-1">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          <b className="text-slate-700 dark:text-slate-200">
            {grupos.length} fornecedor{grupos.length > 1 ? 'es' : ''} · {linhasTotais} pagamento{linhasTotais > 1 ? 's' : ''} esperando você dizer quais notas {linhasTotais > 1 ? 'foram' : 'foi'}.
          </b>{' '}
          {/* ⚠️ o motivo fica escrito: quase sempre é pagamento parcial ou pagamento de
              nota que nem está no sistema. */}
          Nenhuma combinação fecha sozinha na soma — costuma ser <b>pagamento parcial</b> ou
          nota que não está no sistema. Abra um, marque as notas: o rodapé soma ao vivo e o
          Conciliar só acende quando a conta fecha.
        </p>
      </div>

      {grupos.map((g) => {
        const i = Math.min(indice[g.fornecedorId] ?? 0, g.linhas.length - 1)
        const estaAberto = aberto === g.fornecedorId
        const linha = g.linhas[i]
        return (
          <div key={g.fornecedorId}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            {/* ── o cabeçalho COLAPSADO: fornecedor · N linhas · total ── */}
            <button type="button" aria-expanded={estaAberto}
              onClick={() => setAberto(estaAberto ? null : g.fornecedorId)}
              className="flex w-full flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {g.fornecedorNome}
              </span>
              <span className="text-[11.5px] tabular-nums text-slate-400">
                {g.linhas.length} pagamento{g.linhas.length > 1 ? 's' : ''} · desde {dia(g.linhas[0].linha.data)}
              </span>
              <span className="ml-auto flex items-baseline gap-2">
                <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  {formatBRL(g.total)}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${estaAberto ? 'rotate-180' : ''}`} />
              </span>
            </button>

            {estaAberto && linha && (
              <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                <EscolherNaMaoCard
                  key={linha.linha.id}
                  empresaId={empresaId}
                  card={linha}
                  navegacao={{
                    indice: i, total: g.linhas.length,
                    onIr: (n) => irPara(g.fornecedorId, n),
                  }}
                  onFechar={() => setAberto(null)}
                  onConciliado={onConciliado}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
