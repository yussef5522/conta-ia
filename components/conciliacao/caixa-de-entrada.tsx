'use client'

// ⭐⭐⭐ A CAIXA DE ENTRADA DO BANCO — o desenho do mock v3 (16/09/2026).
//
// **A régua:** `docs/mocks/conciliacao-caixa-mock-v3.html`, lido pelo guard
// `__tests__/regras-ui/caixa-bate-com-o-mock-v3.test.ts`. *Divergência do mock = defeito.*
//
// ⛔⛔ **ROUPA NOVA, MOTOR INTACTO.** Nenhuma régua de negócio mudou aqui: os degraus, a
// contenção, o corte de época e o "uma linha, uma estação" seguem onde estavam. O botão
// verde é o **mesmo confirmar** de ontem — o que mudou é que o rótulo agora diz **o
// efeito**, e os menus do sentido viraram **chips**.
//
// ⭐ **O CARTÃO ≍ é a estrela** (padrão Xero): à esquerda **O BANCO DIZ** (o fato bruto),
// à direita **MELHOR PALPITE** (o que o matcher achou, com a diferença SEMPRE nomeada), e
// no meio o conector. Quem não tem palpite abre direto nos chips — *ausência de palpite
// não pode virar linha morta*.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ArrowDownLeft, ArrowUpRight, Check } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'
import { V3, SOMBRA, CONECTOR } from './mock-v3-tokens'

interface AcaoDTO { acao: string; rotulo: string; pedeAlvo: string | null }
interface PalpiteDTO {
  acao: string; familia: string; titulo: string; detalhe: string
  diferenca: string; botao: string; alvo: Record<string, unknown>
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA'
}
interface LinhaDTO {
  id: string; tipo: string; valor: number; data: string; descricao: string
  contraparte: string | null; conta: string | null
  sentido: 'SAIDA' | 'ENTRADA'; estacao: 'CAIXA' | 'ARQUIVO'
  resolvidaComo: string | null; acoes: AcaoDTO[]
  palpite: PalpiteDTO | null
}
interface CaixaDTO {
  contadores: { saidas: number; entradas: number; arquivo: number; total: number }
  progresso: { pct: number; resolvidas: number; naCaixa: number; frase: string }
  corte: string | null
  linhas: LinhaDTO[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string) => d.split('-').reverse().join('/')

/** ⭐ o emoji de cada ação — o mock põe um em cada chip */
const ICONE: Record<string, string> = {
  CASAR_PAGAR: '🧾', PGTO_CARTAO: '💳', PARCELA_EMPRESTIMO: '🏦',
  TRANSFERENCIA_ENVIADA: '⇄', TRANSFERENCIA_RECEBIDA: '⇄',
  CASAR_RECEBER: '🧾', RECEBIMENTO_VENDA: '💰', ESTORNO: '↩',
  CATEGORIA: '🏷', IGNORAR: '⌫',
}

export function CaixaDeEntrada({ empresaId }: { empresaId: string }) {
  const [caixa, setCaixa] = useState<CaixaDTO | null>(null)
  const [aba, setAba] = useState<'SAIDA' | 'ENTRADA'>('SAIDA')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ id: string; titulo: string; selo: string } | null>(null)
  const [categorias, setCategorias] = useState<{ id: string; name: string; type: string }[]>([])
  const [cartoes, setCartoes] = useState<{ id: string; name: string }[]>([])

  const carregar = useCallback(async () => {
    // ⛔ COM TIMEOUT: spinner eterno é a ausência fingindo progresso (14/09)
    const r = await fetchComTimeout<CaixaDTO>(`/api/conciliacao/caixa?empresaId=${empresaId}`)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar a caixa de entrada.'); return }
    setErro(null); setCaixa(r.data)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    void (async () => {
      const [c, k] = await Promise.all([
        fetchComTimeout<{ categories?: { id: string; name: string; type: string }[] }>(`/api/categorias?empresaId=${empresaId}`),
        fetchComTimeout<{ cards?: { id: string; name: string }[] }>(`/api/empresas/${empresaId}/cartoes`),
      ])
      if (c.ok && c.data?.categories) setCategorias(c.data.categories)
      if (k.ok && k.data?.cards) setCartoes(k.data.cards)
    })()
  }, [empresaId])

  // ⚠️ a faixa some sozinha — feedback que fica vira móvel fixo e se aprende a ignorar
  useEffect(() => {
    if (!feito) return
    const t = setTimeout(() => setFeito(null), 6000)
    return () => clearTimeout(t)
  }, [feito])

  /**
   * ⭐⭐ O GESTO — **o mesmo de ontem**. ⛔ Ele não termina em "marquei": ou o servidor
   * devolve o EFEITO no destino, ou devolve o CAMINHO onde o alvo se escolhe.
   * **Silêncio não é desfecho** (14/09).
   */
  const gesto = useCallback(async (linha: LinhaDTO, acao: string, alvo: Record<string, unknown> = {}) => {
    setOcupado(linha.id); setErro(null)
    try {
      const r = await fetchComTimeout<{ efeito?: string; deepLink?: string }>(`/api/conciliacao/resolver`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ empresaId, txId: linha.id, acao, ...alvo }), timeoutMs: 30_000,
      })
      if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui resolver esta linha.'); return }
      if (r.data.deepLink) { window.location.href = r.data.deepLink; return }
      // ⭐ a faixa verde carrega O SELO DO COMO — a linha nunca sai em silêncio
      setFeito({
        id: linha.id,
        titulo: `${linha.descricao || '(sem descrição)'} ${brl(linha.valor)}`,
        selo: `${r.data.efeito ?? 'resolvida'} · no arquivo`,
      })
      await carregar()   // ⭐ a linha sai da caixa NA HORA
    } finally { setOcupado(null) }
  }, [empresaId, carregar])

  const visiveis = useMemo(() => (caixa?.linhas ?? []).filter((l) => l.sentido === aba), [caixa, aba])

  if (erro && !caixa) {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-[13px]"
        style={{ borderColor: V3.ambar, background: V3.ambarBg, color: V3.ambar }}>
        {erro}
        <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
      </div>
    )
  }
  if (!caixa) {
    return <div className="flex items-center gap-2 p-4 text-sm" style={{ color: V3.sub }}><Loader2 className="h-4 w-4 animate-spin" /> abrindo a caixa de entrada…</div>
  }

  const c = caixa.contadores
  const fecha = c.saidas + c.entradas + c.arquivo === c.total
  const p = caixa.progresso

  return (
    <div className="space-y-3">
      {/* ══════════ 1. CABEÇALHO — título, fluxo em pílulas, anel do mês ══════════ */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.01em]" style={{ color: V3.ink }}>Caixa de entrada do banco</h2>
          <p className="mt-0.5 text-[13px]" style={{ color: V3.sub }}>o banco diz o que aconteceu · você diz o que cada linha é</p>
        </div>

        {/* ⭐ o fluxo com a estação ACESA — o dono sempre sabe onde está */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" style={{ color: V3.sub }}>
          {(['BANCO', 'IMPORT', 'CAIXA', 'ARQUIVO'] as const).map((e, i) => (
            <span key={e} className="flex items-center gap-1.5">
              {i > 0 && <span className="opacity-55">→</span>}
              <b className="rounded-full px-2.5 py-[3px] font-extrabold"
                style={e === 'CAIXA' ? { background: V3.roxo, color: '#fff' } : { background: V3.roxoBg, color: V3.roxo }}>
                {e}
              </b>
            </span>
          ))}
        </div>

        {/*
          ⭐⭐ O ANEL DO MÊS — derivado dos MESMOS contadores das abas e do badge do menu.
          ⛔ Consulta própria pro anel seria a terceira derivação da mesma pergunta (o B1).
        */}
        <div className="flex items-center gap-2.5 rounded-2xl border px-3.5 py-2"
          style={{ background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(${V3.verde2} 0 ${p.pct}%, #e8e7f1 ${p.pct}% 100%)` }}>
            <i className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[10px] font-extrabold not-italic"
              style={{ background: V3.card, color: V3.verde }}>{p.pct}%</i>
          </div>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: V3.sub }}>no período</div>
            <div className="text-[13.5px] font-extrabold" style={{ color: V3.ink }}>{p.frase}</div>
          </div>
        </div>
      </div>

      {/* ══════════ 3. ABAS — segmented control com badge ══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-2xl p-1" style={{ background: '#e9e8f3' }}>
          {([['SAIDA', 'Saídas', c.saidas, ArrowUpRight], ['ENTRADA', 'Entradas', c.entradas, ArrowDownLeft]] as const).map(([k, rot, n, Icone]) => {
            const on = aba === k
            return (
              <button key={k} type="button" onClick={() => setAba(k)}
                className="flex items-center gap-2 rounded-[11px] px-4 py-2 text-[13.5px] font-bold"
                style={on ? { background: V3.card, color: V3.ink, boxShadow: '0 2px 8px rgba(23,26,38,.10)' } : { color: V3.sub }}>
                <Icone className="h-4 w-4" /> {rot}
                {/* ⚠️ badge CINZA quando zero — coral em zero seria alarme sem causa */}
                <span className="rounded-full px-2 py-[1px] text-[11px] font-extrabold text-white"
                  style={{ background: n === 0 ? '#d6d5e3' : on ? V3.roxo : V3.coral }}>{n}</span>
              </button>
            )
          })}
        </div>
        <div className="text-[12px]" style={{ color: V3.sub }}>
          {caixa.corte && <>conciliando a partir de <b>{dia(caixa.corte)}</b> · </>}
          <span>{c.arquivo} no arquivo · {c.total} no período</span>
          {/* ⛔ o invariante VISÍVEL: número que fecha por fora é promessa */}
          {!fecha && <b className="ml-1.5" style={{ color: V3.coral }}>⛔ a soma não fecha</b>}
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: V3.ambar, background: V3.ambarBg, color: V3.ambar }}>
          {erro}
          <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
        </div>
      )}

      {/* ══════════ 5. FEEDBACK — a linha nunca sai em silêncio ══════════ */}
      {feito && (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-[13px] duration-300 animate-in fade-in slide-in-from-top-2"
          style={{ background: V3.verdeBg, borderColor: '#cdebd9', color: V3.ink }}>
          <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-white" style={{ background: V3.verde }}>
            <Check className="h-4 w-4" />
          </span>
          <div><b className="font-extrabold">{feito.titulo}</b> resolvida agora</div>
          <span className="ml-auto whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-extrabold"
            style={{ background: '#fff', color: V3.verde }}>{feito.selo}</span>
        </div>
      )}

      {/* ══════════ 4. OS CARTÕES ≍ ══════════ */}
      {visiveis.map((l) => (
        <CartaoDaLinha key={l.id} linha={l} ocupado={ocupado === l.id}
          categorias={categorias} cartoes={cartoes} onGesto={gesto} />
      ))}

      {/* ══════════ 7. INBOX ZERO ══════════ */}
      {visiveis.length === 0 && (
        <div className="rounded-[22px] border-[1.5px] border-dashed p-8 text-center" style={{ background: V3.card, borderColor: '#d9d7ea' }}>
          <div className="text-[34px]">🎉</div>
          <b className="mb-1 mt-2 block text-[16px]" style={{ color: V3.ink }}>É assim que a caixa fica quando você termina</b>
          <span className="text-[13px]" style={{ color: V3.sub }}>
            tudo resolvido e no arquivo, com o selo de como · amanhã o banco traz mais
          </span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ O CARTÃO ≍ — banco à esquerda, palpite à direita, chips embaixo
// ═══════════════════════════════════════════════════════════════════════════════

function CartaoDaLinha({ linha: l, ocupado, categorias, cartoes, onGesto }: {
  linha: LinhaDTO; ocupado: boolean
  categorias: { id: string; name: string; type: string }[]
  cartoes: { id: string; name: string }[]
  onGesto: (l: LinhaDTO, acao: string, alvo?: Record<string, unknown>) => void
}) {
  const credito = l.sentido === 'ENTRADA'
  const chip = 'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-[7px] text-[12.5px] font-bold disabled:opacity-40'

  return (
    <div className="overflow-hidden rounded-[22px] border" style={{ background: V3.card, borderColor: V3.line, boxShadow: SOMBRA }}>
      {/*
        ⭐ REGRA 12 — o mock manda: desktop lado a lado (1fr 64px 1fr), celular EMPILHA.
        A media query do mock é 900px; aqui é a variante arbitrária do Tailwind, pra a
        medida sair do MESMO número que o guard lê no arquivo.
      */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_64px_1fr]">
        {/* ── O BANCO DIZ ─────────────────────────────────────────────── */}
        <div className="px-5 py-[18px]">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            O BANCO DIZ
            {l.conta && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                style={{ background: '#f2f1f8', color: V3.ink }}>
                <i className="h-4 w-4 rounded-full not-italic" style={{ background: 'linear-gradient(135deg,#7ac142,#4a8f2a)' }} />
                {l.conta}
              </span>
            )}
          </div>
          <div className="text-[14.5px] font-bold leading-[1.35]" style={{ color: V3.ink }}>
            {l.descricao || '(sem descrição)'}
            <small className="mt-0.5 block text-[12px] font-medium" style={{ color: V3.sub }}>
              {dia(l.data)}{l.contraparte ? ` · ${l.contraparte}` : ''}
            </small>
          </div>
          {/* ⭐ o valor GIGANTE — coral débito, verde crédito */}
          <div className="mt-2 text-[28px] font-extrabold tracking-[-0.01em] tabular-nums"
            style={{ color: credito ? V3.verde : V3.coral }}>
            {credito ? '+' : '−'} {brl(l.valor)}
          </div>
        </div>

        {/* ── O CONECTOR ──────────────────────────────────────────────── */}
        <div className="flex flex-row items-center justify-center gap-1.5 px-4 pb-1 min-[900px]:flex-col min-[900px]:px-0 min-[900px]:py-3">
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold"
            style={{ background: V3.roxoBg, color: V3.roxo }}>{CONECTOR}</div>
          <div className="h-[2px] w-full flex-1 rounded-sm min-[900px]:h-auto min-[900px]:min-h-[34px] min-[900px]:w-[2px]"
            style={{ background: `linear-gradient(${V3.line},${V3.roxoBg},${V3.line})` }} />
        </div>

        {/* ── MELHOR PALPITE (ou direto nos chips) ────────────────────── */}
        <div className="px-5 py-[18px]">
          <div className="mb-2.5 text-[10px] font-extrabold tracking-[0.07em]" style={{ color: V3.sub }}>
            {l.palpite ? 'MELHOR PALPITE' : 'O QUE ESTA LINHA É?'}
          </div>

          {l.palpite && (
            <div className="rounded-2xl border-[1.5px] px-4 py-3.5"
              style={{ background: `linear-gradient(160deg,#fbfbff,${V3.verdeBg})`, borderColor: '#cdebd9' }}>
              <div className="text-[10px] font-extrabold tracking-[0.06em]" style={{ color: V3.verde }}>{l.palpite.familia}</div>
              <div className="mb-[1px] mt-1.5 text-[14.5px] font-extrabold" style={{ color: V3.ink }}>{l.palpite.titulo}</div>
              <div className="text-[12px]" style={{ color: V3.sub }}>{l.palpite.detalhe}</div>
              {/* ⛔ A DIFERENÇA SEMPRE NOMEADA — mesmo quando é zero */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold"
                style={{ background: V3.ambarBg, color: V3.ambar }}>{l.palpite.diferenca}</div>
              {/* ⭐ o botão diz O EFEITO — e é o MESMO confirmar de ontem */}
              <button type="button" disabled={ocupado} onClick={() => onGesto(l, l.palpite!.acao, l.palpite!.alvo)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-[13px] text-[15px] font-extrabold text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${V3.verde},${V3.verde2})`, boxShadow: '0 6px 18px rgba(15,157,88,.35)' }}>
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : l.palpite.botao}
              </button>
            </div>
          )}

          {l.palpite && (
            <div className="my-2 text-center text-[10.5px] font-bold tracking-[0.05em]" style={{ color: V3.sub }}>
              OU ESCOLHA OUTRO CAMINHO
            </div>
          )}

          {/* ⭐ OS CHIPS — são os MENUS DO SENTIDO que já existiam, com outra roupa */}
          <div className="flex flex-wrap gap-[7px]">
            {l.acoes.filter((a) => a.acao !== l.palpite?.acao).map((a) => {
              const cor = { background: V3.card, borderColor: V3.line, color: a.acao === 'IGNORAR' ? V3.sub : V3.ink }

              if (a.pedeAlvo === 'CATEGORIA') {
                return (
                  <select key={a.acao} defaultValue="" disabled={ocupado} aria-label={a.rotulo}
                    onChange={(e) => e.target.value && onGesto(l, a.acao, { categoryId: e.target.value })}
                    className={`${chip} max-w-[12rem]`} style={cor}>
                    <option value="">{ICONE[a.acao] ?? ''} {a.rotulo}</option>
                    {categorias
                      .filter((c2) => (credito ? c2.type === 'INCOME' : c2.type === 'EXPENSE'))
                      .map((c2) => <option key={c2.id} value={c2.id}>{c2.name}</option>)}
                  </select>
                )
              }
              if (a.pedeAlvo === 'CARTAO') {
                return (
                  <select key={a.acao} defaultValue="" disabled={ocupado} aria-label={a.rotulo}
                    onChange={(e) => e.target.value && onGesto(l, a.acao, { cardId: e.target.value })}
                    className={`${chip} max-w-[11rem]`} style={cor}>
                    <option value="">{ICONE[a.acao] ?? ''} {a.rotulo}</option>
                    {cartoes.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                )
              }
              return (
                <button key={a.acao} type="button" disabled={ocupado} onClick={() => onGesto(l, a.acao)} className={chip} style={cor}>
                  {ocupado ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{ICONE[a.acao] ?? ''} {a.rotulo}</>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
