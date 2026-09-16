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
import { V3, SOMBRA } from './mock-v3-tokens'
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
/** ⭐ "24/08 a 08/09" — e só o dia quando os N pagamentos caíram no mesmo */
const diaMes = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
function periodo(g: { linhas: CardDeEscolhaDTO[] }): string {
  const de = diaMes(g.linhas[0].linha.data)
  const ate = diaMes(g.linhas[g.linhas.length - 1].linha.data)
  return de === ate ? de : `${de} a ${ate}`
}

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
  /**
   * ⭐⭐ A PORTA DOS DOIS LADOS (10/09/2026) — *"na linha do extrato, 'casar com conta a
   * pagar' → abre O MESMO card; na conta a pagar vencida, 'procurar no extrato' → idem.
   * Fonte única — nada de segunda implementação."*
   *
   * ⛔ Por isso é DEEP-LINK e não um segundo componente: o card mora num lugar só, e as
   * outras telas mandam pra ele. Render duplicado divergiria na primeira regra nova —
   * é a lição do B1, e a do `GruposSugeridos` que virou duas listas do mesmo sabor.
   */
  abrirExtratoId?: string | null
  abrirContaId?: string | null
}

/** ⭐ as iniciais do avatar — 2 letras, como o mock ("CA" pra Casper) */
function iniciais(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

export function FilaEscolherNaMao({
  empresaId, cards, onConciliado, abrirExtratoId, abrirContaId,
}: Props) {
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
    // ⚠️⚠️ `a !== null`, NUNCA `a &&`: id de grupo pode ser string VAZIA, e falsy fechava
    // o grupo no mesmo render em que ele abria — foi assim que o card do PJBANK "não
    // existia" pro dono por três dias. O id agora nunca é vazio, e esta checagem é o
    // cinto: comparar com `null` não depende de o id ser "verdadeiro".
    setAberto((a) => (a !== null && grupos.some((g) => g.fornecedorId === a) ? a : null))
  }, [grupos])

  /**
   * ⭐ VEIO DE OUTRA TELA: abre o grupo certo e posiciona na LINHA certa.
   *
   * ⚠️ `?abrir=` é a linha do extrato (veio dos Pendentes); `?conta=` é a nota (veio do
   * Contas a Pagar) — e aí o grupo é o que tem aquela nota na lista. Nos dois casos quem
   * decide é o DADO que já está na tela, não uma segunda busca no servidor.
   */
  useEffect(() => {
    if (!abrirExtratoId && !abrirContaId) return
    for (const g of grupos) {
      const i = g.linhas.findIndex((l) =>
        (abrirExtratoId && l.linha.id === abrirExtratoId)
        || (abrirContaId && [...l.vencidas, ...l.aVencer].some((n) => n.id === abrirContaId)))
      if (i >= 0) {
        setAberto(g.fornecedorId)
        setIndice((m) => ({ ...m, [g.fornecedorId]: i }))
        return
      }
    }
  }, [grupos, abrirExtratoId, abrirContaId])

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
            className="mb-[12px] overflow-hidden rounded-[18px] border"
            style={{ background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }}
          >
            {/*
              ⭐⭐ O CABEÇALHO NO DESENHO DO MOCK v3 (16/09): **avatar** com as iniciais,
              nome + resumo à esquerda, **pílula de estado** à direita e a seta.
              ⛔ O COMPORTAMENTO NÃO MUDOU — continua UM card por fornecedor, FECHADO, e
              uma linha por vez lá dentro. Aquela trava é o que impede dois cards do mesmo
              fornecedor disputarem as MESMAS notas (o caso Cancian, 08/09).
            */}
            <button
              type="button" aria-expanded={estaAberto}
              onClick={() => setAberto(estaAberto ? null : g.fornecedorId)}
              className="flex w-full items-center gap-[13px] px-[18px] py-[14px] text-left"
            >
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] text-[15px] font-extrabold text-white"
                style={{ background: `linear-gradient(135deg,${V3.roxo},${V3.roxo2})` }}>
                {iniciais(g.fornecedorNome)}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[14.5px] font-extrabold" style={{ color: V3.ink }}>
                  {g.fornecedorNome}
                </b>
                <small className="text-[12px]" style={{ color: V3.sub }}>
                {/* ⛔⛔ A SOMA DOS PAGAMENTOS SAIU DAQUI (10/09/2026, ordem do dono):
                    *"6.332,25 não é valor que eu paguei em gesto nenhum; parece cobrança
                    e confunde. Datas contam mais que soma."* Fornecedor com N linhas são
                    N pagamentos separados — o total deles não é uma quantia que exista no
                    mundo, e número que não existe em gesto nenhum é o que esta casa chama
                    de número sem régua. Com UMA linha, o valor É o pagamento e fica. */}
                {g.linhas.length > 1
                  ? `${g.linhas.length} pagamentos · ${periodo(g)}`
                  : menos(g.total)}
                </small>
              </span>
              {/* ⭐ a pílula de estado — coral quando há vencida, cinza quando é só "a vencer" */}
              <span className="shrink-0 text-right">
                <span className="rounded-full px-2.5 py-[3px] text-[11px] font-extrabold"
                  style={vencidas > 0
                    ? { background: V3.coralBg, color: V3.coral }
                    : { background: '#eef2f6', color: '#475569' }}>
                  {vencidas > 0
                    ? `${vencidas} vencida${vencidas > 1 ? 's' : ''}`
                    : `${(linha?.aVencer.length ?? 0)} a vencer`}
                </span>
                <span className="mt-1 block text-[12px] font-semibold" style={{ color: V3.sub }}>
                  {estaAberto ? 'fechar o caso' : 'abrir o caso →'}
                </span>
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
