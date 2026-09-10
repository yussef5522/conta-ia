'use client'

// ⭐⭐⭐ A FILA DO FIND & MATCH — O MOCK, AO PIXEL (`docs/mocks/conciliacao-mock.html`).
//
// **O dono:** *"basta de descrição em palavras: o arquivo do mock é a régua; divergência
// do mock = defeito. Eu abro o mock e a tela LADO A LADO no celular e não distingo qual é
// qual no card do fornecedor."*
//
// O que este arquivo reproduz, medido NO arquivo (não "parecido"):
//   `.card`    borda 1px #e8e6e0 · raio 16px · margem 12px · overflow hidden
//   `.card-h`  flex · gap 10px · padding 14px 16px · chip · nome 700/15px · valor 700/15px
//   `.seta`    ▶ que gira 90° quando abre
//   `.secao-t` caps 13px/700 · letter-spacing .03em · cor --sub
//   `.fech`    padding 14px 16px · 13.5px · cor --sub · space-between
//
// ⛔ O COMPORTAMENTO NÃO MUDA (ordem do dono: *"NÃO MEXE NO MOTOR"*): um grupo aberto por
// vez, uma linha por vez da mais antiga — a trava que faz a disputa entre cards pelas
// mesmas notas ser inalcançável.

import { useState, useMemo, useCallback, useEffect } from 'react'
import { formatBRL } from '@/lib/format/money'
import { EscolherNaMaoCard, type CardDeEscolhaDTO } from './escolher-na-mao-card'
import { MOCK, chip } from './mock-tokens'

interface Grupo {
  fornecedorId: string
  fornecedorNome: string
  linhas: CardDeEscolhaDTO[]
  total: number
  maisAntiga: number
}

const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
/** ⚠️ o mock usa o MENOS de verdade (U+2212), não hífen */
const menos = (v: number) => `− ${formatBRL(v)}`

/**
 * ⚠️ MESMA REGRA da `agruparPorFornecedor` da lib, sobre o DTO serializado. A lib é a
 * dona da decisão e tem os testes; aqui é só a tradução de `string` pra tempo.
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

  return (
    // ⚠️ o `main` do app é `bg-zinc-50` (#fafafa) e o mock é #faf9f6 — quase igual, mas o
    // mock é a régua. O fundo entra NA SEÇÃO, não no shell: trocar o shell mudaria todas
    // as telas do sistema por causa de uma, o que ninguém pediu.
    <section style={{ background: MOCK.bg }}>
      {/* `.secao-t` — caps 13px/700, ls .03em, cor --sub, margem 20px 0 8px */}
      <h2
        className="mb-[8px] mt-[20px] text-[13px] font-bold uppercase tracking-[.03em]"
        style={{ color: MOCK.sub }}
      >
        Pra tua mão — o pagamento existe, você diz o que ele pagou
      </h2>

      {grupos.map((g) => {
        const i = Math.min(indice[g.fornecedorId] ?? 0, g.linhas.length - 1)
        const estaAberto = aberto === g.fornecedorId
        const linha = g.linhas[i]
        // ⚠️ o chip conta as VENCIDAS da linha em foco — é o que o mock mostra
        const vencidas = linha?.vencidas.length ?? 0
        return (
          <article
            key={g.fornecedorId}
            className="mb-[12px] overflow-hidden rounded-[16px] border"
            style={{ background: MOCK.card, borderColor: MOCK.line }}
          >
            {/* ── `.card-h` ── */}
            <button
              type="button" aria-expanded={estaAberto}
              onClick={() => setAberto(estaAberto ? null : g.fornecedorId)}
              className="flex w-full items-center gap-[10px] px-[16px] py-[14px] text-left"
            >
              <span style={vencidas > 0
                ? chip(MOCK.coralFraco, MOCK.coral)
                : chip(MOCK.slateFraco, MOCK.slate)}>
                {vencidas > 0
                  ? `${vencidas} vencida${vencidas > 1 ? 's' : ''}`
                  : `${(linha?.aVencer.length ?? 0)} a vencer`}
              </span>
              <span className="flex-1 text-[15px] font-bold" style={{ color: MOCK.ink }}>
                {g.fornecedorNome}
              </span>
              <span className="text-[15px] font-bold tabular-nums" style={{ color: MOCK.ink }}>
                {/* o mock: "5 linhas · − R$ 10.885,97" com N>1; só o valor com N=1 */}
                {g.linhas.length > 1
                  ? `${g.linhas.length} linhas · ${menos(g.total)}`
                  : menos(g.total)}
              </span>
              <span
                className="text-[11px] transition-transform duration-200"
                style={{ color: MOCK.sub, transform: estaAberto ? 'rotate(90deg)' : undefined }}
              >
                ▶
              </span>
            </button>

            {/* ── `.card-corpo` ── */}
            {estaAberto && linha && (
              <div className="border-t" style={{ borderColor: MOCK.line }}>
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
          </article>
        )
      })}

      {/* ⛔⛔ AQUI MORAVA UM PARÁGRAFO DE 4 LINHAS ("N pagamentos esperando você dizer
          quais notas foram… Marque as notas: o rodapé soma ao vivo…"). Ordem do dono:
          *"MORRE inteiro — a seção já se chama 'Pra tua mão' e o card ensina fazendo (o
          rodapé vivo É a instrução). Título de seção + cards, nada de aula em cima."* */}
    </section>
  )
}
