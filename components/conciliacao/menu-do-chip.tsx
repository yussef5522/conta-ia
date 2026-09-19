'use client'

// ⭐⭐⭐ O MENU DO CHIP — ABRE SÓ AO TOCAR, COMO O MOCK DESENHOU (17/09/2026).
//
// **O dono, no celular:** *"«pagamento de fatura» lista os 4 cartões SEMPRE abertos inline
// (Carter banrisul / caixa / MP / sicredi), tomando o card inteiro. Vira submenu/dropdown
// que abre só ao tocar no chip, como o mock desenhou."*
//
// ⛔ **O QUE ELE VIA ERA O `<select>` NATIVO.** Os chips de alvo eram `<select>` do sistema
// operacional: no iOS a lista sobe cobrindo a tela, o rótulo trunca, e o widget não tem
// nada da pílula do mock. Pior no chip de CATEGORIA, que tem **50 opções** — lista chapada,
// sem busca, sem dizer que cinco delas são de outra classe de dinheiro.
//
// ⭐ Aqui o chip é a **pílula do mock**; tocar abre um painel ancorado com **seções** e,
// quando passa de 8 opções, **busca** (a régua da casa: palavra em qualquer ordem, sem
// caixa e sem acento). ⚠️ Dispensável por **ESC e clique-fora** pelo hook ÚNICO da casa
// (`useDismissivel`, 28/08) — dropdown novo nasce dispensável, não reinventa o gesto.

import { useMemo, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { useDismissivel } from '@/lib/hooks/use-dismissivel'
import { filtrarPorBusca } from '@/lib/busca-texto'

export interface OpcaoDoMenu {
  id: string
  nome: string
  /** linha fina embaixo do nome (vencimento, valor, banco) */
  detalhe?: string
}

export interface SecaoDoChip {
  titulo: string
  ajuda?: string
  itens: OpcaoDoMenu[]
}

/** a partir de quantas opções a busca aparece — abaixo disso ela é ruído */
const BUSCA_A_PARTIR_DE = 8

export function MenuDoChip({
  rotulo, icone, secoes, ocupado, vazio, onEscolher, className, style,
}: {
  rotulo: string
  icone?: string
  secoes: SecaoDoChip[]
  ocupado?: boolean
  /** ⛔ o que dizer quando NÃO há nenhuma opção — vazio mudo é a porta pintada de novo */
  vazio?: string
  onEscolher: (id: string) => void
  className?: string
  style?: React.CSSProperties
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useDismissivel<HTMLDivElement>(aberto, () => { setAberto(false); setBusca('') })

  const total = useMemo(() => secoes.reduce((n, s) => n + s.itens.length, 0), [secoes])

  /** ⭐ a busca corre DENTRO de cada seção — a classe da opção não se perde ao filtrar */
  const filtradas = useMemo(() => {
    if (!busca.trim()) return secoes
    return secoes
      .map((s) => ({ ...s, itens: filtrarPorBusca(s.itens, busca, (o) => `${o.nome} ${o.detalhe ?? ''}`) }))
      .filter((s) => s.itens.length > 0)
  }, [secoes, busca])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={ocupado}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className={className}
        style={style}
      >
        {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{icone ? `${icone} ` : ''}{rotulo} ▾</>}
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[min(60vh,22rem)] w-[min(20rem,calc(100vw-3rem))] overflow-y-auto rounded-2xl border bg-white p-1.5 shadow-xl dark:bg-slate-900"
          style={{ borderColor: '#e6e4ef' }}
        >
          {total === 0 && (
            // ⛔ vazio que DIZ o motivo — "nenhuma opção" faria o dono achar que o gesto quebrou
            <p className="px-2.5 py-3 text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
              {vazio ?? 'Nada pra escolher aqui ainda.'}
            </p>
          )}

          {total >= BUSCA_A_PARTIR_DE && (
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="filtrar…"
              aria-label={`filtrar ${rotulo}`}
              className="mb-1 w-full rounded-xl border px-2.5 py-1.5 text-[12.5px] outline-none dark:bg-slate-800"
              style={{ borderColor: '#e6e4ef' }}
            />
          )}

          {filtradas.map((s) => (
            <div key={s.titulo} className="mb-0.5">
              <div className="px-2.5 pb-0.5 pt-2 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-slate-400">
                {s.titulo}
              </div>
              {s.ajuda && (
                <div className="px-2.5 pb-1 text-[11px] leading-snug text-slate-400">{s.ajuda}</div>
              )}
              {s.itens.map((o) => (
                <button
                  key={o.id}
                  role="menuitem"
                  type="button"
                  onClick={() => { setAberto(false); setBusca(''); onEscolher(o.id) }}
                  className="flex w-full items-start gap-2 rounded-xl px-2.5 py-[7px] text-left hover:bg-violet-50 dark:hover:bg-slate-800"
                >
                  <Check className="mt-[3px] h-3 w-3 shrink-0 opacity-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{o.nome}</span>
                    {o.detalhe && <span className="block truncate text-[11.5px] text-slate-500">{o.detalhe}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {busca.trim() && filtradas.length === 0 && (
            <p className="px-2.5 py-3 text-[12px] text-slate-500">Nada com «{busca}» aqui.</p>
          )}
        </div>
      )}
    </div>
  )
}
