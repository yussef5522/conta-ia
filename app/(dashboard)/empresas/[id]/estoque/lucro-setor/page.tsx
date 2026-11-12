'use client'

// LUCRO POR SETOR — a tela real da lei docs/lucro-por-setor-referencia.html (v11, APROVADA 11/11/2026 23:54).
// Leis S0–S23 nos comentários da referência; tokens 1:1 com a casa (--prod-* / --fam-*), zero hex.
// S0 uma fábrica só (custo pela porta) · S15 tela muda: explicação SÓ atrás do ⓘ · S18 celular nunca
// esconde dinheiro · S19 todo número desce ao pedido · V8 ⛔ cliente não existe aqui.
// ⛔ Ficha se grava SÓ pela porta única do editor (FichaNaLinha → POST/PATCH /estoque/fichas).

import { Fragment, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { formatBRL } from '@/lib/format/money'
import type { TelaDTO, ItemDTO, SetorDTO, FaltaFicha, PedidoDoItemDTO } from '@/lib/lucro-setor/tela'
import { eseConta, vereditoDoEse, lerPreco, paineisDoDia } from '@/lib/lucro-setor/estudo'
import { FichaNaLinha, type AlvoDaFicha } from '@/components/estoque/ficha-na-linha'

const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const ddmm = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const rotuloDia = (d: string, hoje: string) => `${d === hoje ? 'HOJE · ' : ''}${SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${ddmm(d)}`
const pct = (m: number | null) => (m == null ? '' : `${m.toFixed(1).replace('.', ',')}%`)
const un = (q: number) => (Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, '').replace('.', ','))
const EMOJI: Record<string, string> = { XIS: '🍔', BURGERS: '🍔', LANCHES: '🥪', PRENSADOS: '🥙', PORCOES: '🍟', FRANGO_FRITO: '🍗', PRATOS: '🍽', PIZZAS: '🍕', BEBIDAS: '🥤', DOCES: '🍰' }
const nomeSetor = (s: { secao: string; nome: string }) => `${EMOJI[s.secao] ? `${EMOJI[s.secao]} ` : ''}${s.nome.toUpperCase()}`

function Info({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (<><button type="button" className="i" aria-label="explicação" onClick={(e) => { e.stopPropagation(); setAberto((v) => !v) }}>i</button>{aberto && <span className="pop">{children}</span>}</>)
}

/** a chave da ficha aberta: base do item (`P:<chave>`) ou sabor (`S:<nome>`) */
const kP = (chave: string) => `P:${chave}`
const kS = (nome: string) => `S:${nome}`

export default function LucroPorSetorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [dia, setDia] = useState<string | null>(null)
  const [d, setD] = useState<TelaDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [setorAberto, setSetorAberto] = useState<string | null>(null)
  const [fichaAberta, setFichaAberta] = useState<string | null>(null)
  const [itemAberto, setItemAberto] = useState<string | null>(null)
  const [gaps, setGaps] = useState<string | null>(null)
  const [itemEstudo, setItemEstudo] = useState<string | null>(null)
  const [precoTxt, setPrecoTxt] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<Record<string, PedidoDoItemDTO[] | 'carregando'>>({})
  const detalheRef = useRef<HTMLDivElement>(null)
  const mesaRef = useRef<HTMLDivElement>(null)

  const carregar = useCallback(async (alvo: string | null) => {
    setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/lucro-setor${alvo ? `?dia=${alvo}` : ''}`, { cache: 'no-store' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j) throw new Error(j?.erro ?? 'Não consegui montar o dia.')
      setD(j as TelaDTO)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('dia') : null
    setDia(q)
    void carregar(q)
  }, [carregar])

  const trocaDia = (novo: string) => {
    setDia(novo); setFichaAberta(null); setItemAberto(null); setGaps(null); setItemEstudo(null); setPrecoTxt(null); setPedidos({})
    try { window.history.replaceState(null, '', `?dia=${novo}`) } catch { /* sem history: segue */ }
    void carregar(novo)
  }
  // ⭐ cascata: gravou a ficha → o servidor recalcula o dia inteiro (ficha → item → setor → estudo)
  const recarregar = () => { setPedidos({}); void carregar(d?.dia ?? dia) }

  // setor aberto: o escolhido, senão o da promo, senão o 1º com itens
  const setores = useMemo(() => d?.setores ?? [], [d])
  const sAberto: SetorDTO | null = useMemo(() => {
    if (!d?.temLaco) return null
    return setores.find((s) => s.secao === setorAberto) ?? setores.find((s) => s.secao === d.itens.find((i) => i.chave === d.promo?.chave)?.secao) ?? setores[0] ?? null
  }, [d, setores, setorAberto])
  const itensDe = (s: SetorDTO | null) => (s && d ? d.itens.filter((i) => i.secao === s.secao) : [])

  const abrirFicha = (k: string) => setFichaAberta((f) => (f === k ? null : k))
  const verPedidos = async (chave: string) => {
    if (!d) return
    if (pedidos[chave]) return setPedidos((p) => { const n = { ...p }; delete n[chave]; return n })
    setPedidos((p) => ({ ...p, [chave]: 'carregando' }))
    const r = await fetch(`/api/empresas/${id}/estoque/lucro-setor/pedidos?dia=${d.dia}&chave=${encodeURIComponent(chave)}`, { cache: 'no-store' })
    const j = await r.json().catch(() => null)
    setPedidos((p) => ({ ...p, [chave]: r.ok && j ? (j.pedidos as PedidoDoItemDTO[]) : [] }))
  }

  if (erro && !d) return <div className="ls"><style>{CSS}</style><h1>Lucro por Setor</h1><div className="painel">{erro}</div></div>
  if (!d) return <div className="ls"><style>{CSS}</style><h1>Lucro por Setor</h1><div className="painel carregando">…</div></div>

  const promoItem = d.promo ? d.itens.find((i) => i.chave === d.promo!.chave) ?? null : null
  // ⭐ E3 (12/11) · custo PARCIAL (ingrediente sem preço / sabor sem ficha): o número entra, com a marca —
  //    custo "≥" (pelo menos) e margem/lucro "≤" (no máximo). Parcial nunca se veste de completo.
  const baseParcial = (i: ItemDTO) => i.semPreco.some((f) => f.tipo === 'PRODUTO')
  const incompleto = (i: ItemDTO) => i.semPreco.length > 0 || i.semFicha.some((f) => f.tipo === 'SABOR')
  const peloMenos = (v: number, parcial: boolean) => `${parcial ? '≥ ' : ''}${formatBRL(v)}`
  const noMaximo = (txt: string, parcial: boolean) => `${parcial ? '≤ ' : ''}${txt}`

  // ─── ficha na linha (S13/S22) ───
  const alvoDoItem = (i: ItemDTO): AlvoDaFicha => ({ fichaId: i.fichaId, tipo: 'PRODUTO', nome: i.nome, nomesPdv: i.nomesSuitable, preco: i.preco })
  const alvoDoSabor = (nome: string, fichaId: string | null): AlvoDaFicha => ({ fichaId, tipo: 'SABOR', nome, nomesPdv: [nome], preco: null })
  const fichaDe = (k: string, alvo: AlvoDaFicha) => (fichaAberta === k ? <FichaNaLinha key={`${k}:${alvo.fichaId ?? 'nova'}`} companyId={id} alvo={alvo} aoGravar={recarregar} /> : null)
  /** o botão da linha sem custo: abrir (tem ficha, vazia/incompleta) · criar (sem vínculo) · nada (revenda sem custo médio) */
  const botaoSem = (k: string, temFicha: boolean, podeCriar: boolean) =>
    temFicha || podeCriar ? <button type="button" className="btn-mini" onClick={(e) => { e.stopPropagation(); abrirFicha(k) }}>{temFicha ? 'abrir ficha →' : 'criar ficha →'}</button> : null

  const criarFichaEm = (i: ItemDTO) => {
    setSetorAberto(i.secao); setFichaAberta(kP(i.chave))
    requestAnimationFrame(() => detalheRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  // ─── S4 · a lista do que ficou sem ficha (o selo âmbar abre) ───
  const listaGaps = (s: SetorDTO) => (
    <div className="dentro" data-testid="gaps">
      {s.semFicha.map((f: FaltaFicha) => {
        const k = f.tipo === 'PRODUTO' ? kP(d.itens.find((i) => i.nome === f.nome && i.secao === s.secao)?.chave ?? f.nome) : kS(f.nome)
        const it = f.tipo === 'PRODUTO' ? d.itens.find((i) => i.nome === f.nome && i.secao === s.secao) : null
        return (
          <Fragment key={`${f.tipo}:${f.nome}`}>
            <div className="lin2 sf"><span>⚠ {f.nome}<span className="q">× {un(f.q)}</span>
              {d.temLaco ? botaoSem(k, !!f.fichaId, f.tipo === 'SABOR' || (it ? it.destino == null : false)) : <Link className="btn-mini" href={`/empresas/${id}/estoque/cardapio`}>mapear →</Link>}
            </span><span>sem ficha</span></div>
            {d.temLaco && fichaDe(k, f.tipo === 'PRODUTO' && it ? alvoDoItem(it) : alvoDoSabor(f.nome, f.fichaId))}
          </Fragment>
        )
      })}
      {s.semPreco.map((f) => {
        const it = f.tipo === 'PRODUTO' ? d.itens.find((i) => i.nome === f.nome && i.secao === s.secao) : null
        const k = f.tipo === 'PRODUTO' ? kP(it?.chave ?? f.nome) : kS(f.nome)
        const fichaId = f.tipo === 'PRODUTO' ? it?.fichaId ?? null : d.itens.flatMap((i) => i.sabores).find((x) => x.nome === f.nome)?.fichaId ?? null
        return (
          <Fragment key={`P$:${f.tipo}:${f.nome}`}>
            <div className="lin2 sf" data-testid="gap-sem-preco"><span>⚠ {f.nome}<span className="q">× {un(f.q)} · sem preço: {f.faltantes.join(', ')}</span>
              {d.temLaco && fichaId ? botaoSem(k, true, false) : null}
            </span><span>custo parcial</span></div>
            {d.temLaco && fichaId && fichaDe(k, f.tipo === 'PRODUTO' && it ? alvoDoItem(it) : alvoDoSabor(f.nome, fichaId))}
          </Fragment>
        )
      })}
    </div>
  )

  // ─── S5 · detalhe do setor: camada 1 (o que vendeu) + camada 2 (sabores do dia) ───
  const renderDetalhe = (s: SetorDTO) => {
    const xs = itensDe(s)
    const sab = new Map<string, { q: number; custoUn: number | null; custo: number | null; fichaId: string | null; semPreco: boolean }>()
    for (const i of xs) {
      if (i.semBase) continue // item fora da conta (S22): os sabores dele não entram na camada do custo
      for (const sb of i.sabores) {
        const c = sab.get(sb.nome) ?? { q: 0, custoUn: sb.custoUn, custo: 0, fichaId: sb.fichaId, semPreco: sb.custoUn != null && sb.faltaPreco.length > 0 }
        c.q += sb.q
        c.custo = sb.custo != null && c.custo != null ? c.custo + sb.custo : null
        sab.set(sb.nome, c)
      }
    }
    const sabores = [...sab].sort((a, b) => b[1].q - a[1].q)
    const fora = s.vendeu - s.vendeuComCusto
    return (
      <div className="painel" ref={detalheRef} data-testid="detalhe">
        <h2>{nomeSetor(s)}<Info>custo do item = ficha do produto (na pizza: base do tamanho) + ficha de cada sabor que foi nele · clique numa linha pra abrir e ajustar a ficha · item sem ficha fica fora do lucro até a ficha nascer</Info></h2>
        {gaps === s.secao && (s.semFicha.length > 0 || s.semPreco.length > 0) && listaGaps(s)}
        <div className="camada g5"><div className="t">CAMADA 1 · O QUE VENDEU</div>
          <div className="head"><span>UN</span><span>ITEM</span><span className="r">VENDEU</span><span className="r">CUSTO FICHA</span><span></span></div>
          {xs.map((i) => {
            const k = kP(i.chave)
            const temFicha = !!i.fichaId
            const clicavel = temFicha || i.destino == null
            return (
              <div className={`row ${i.semBase ? 'sem' : ''}`} key={i.chave} onClick={() => clicavel && abrirFicha(k)} data-testid="linha-camada1">
                <div className="cab">
                  <span className="qtd">{un(i.q)}</span>
                  <span className="nm">{i.nome}{i.promo && <span className="tagp">PROMO</span>}{baseParcial(i) && <span className="aviso" data-testid="aviso-sem-preco"> ⚠</span>}{i.semBase && botaoSem(k, temFicha, i.destino == null)}</span>
                  <span className="stats">
                    <span className="apoio forte-2"><span className="rot">vendeu</span>{formatBRL(i.vendeu)}</span>
                    <span className="forte"><span className="rot">custo ficha</span>{i.custoBase == null ? 'sem ficha' : peloMenos(i.custoBase, baseParcial(i))}</span>
                  </span>
                  <span className="chev">{clicavel ? (fichaAberta === k ? '▲' : '▼') : ''}</span>
                </div>
                {clicavel && fichaDe(k, alvoDoItem(i))}
              </div>
            )
          })}
        </div>
        {sabores.length > 0 && (
          <div className="camada g5"><div className="t">CAMADA 2 · SABORES DO DIA</div>
            <div className="head"><span>UN</span><span>SABOR</span><span className="r">FICHA</span><span className="r">CUSTO</span><span></span></div>
            {sabores.map(([nome, c]) => {
              const k = kS(nome)
              return (
                <div className={`row ${c.custoUn == null ? 'sem' : ''}`} key={nome} onClick={() => abrirFicha(k)} data-testid="linha-camada2">
                  <div className="cab">
                    <span className="qtd">{un(c.q)}</span>
                    <span className="nm">{nome}{c.semPreco && <span className="aviso"> ⚠</span>}{c.custoUn == null && botaoSem(k, !!c.fichaId, true)}</span>
                    <span className="stats">
                      <span className="apoio"><span className="rot">ficha</span>{c.custoUn != null ? peloMenos(c.custoUn, c.semPreco) : ''}</span>
                      <span className="forte"><span className="rot">custo</span>{c.custo != null ? peloMenos(c.custo, c.semPreco) : 'sem ficha'}</span>
                    </span>
                    <span className="chev">{fichaAberta === k ? '▲' : '▼'}</span>
                  </div>
                  {fichaDe(k, alvoDoSabor(nome, c.fichaId))}
                </div>
              )
            })}
          </div>
        )}
        <div className="tot"><span>CUSTO TOTAL DO SETOR</span><span>{peloMenos(s.custo, s.unSemPreco > 0)}</span></div>
        <div className="tot sub"><span>VENDEU</span><span>{formatBRL(s.vendeu)}</span></div>
        {fora > 0.004 && <div className="tot sub sf"><span>FORA DA CONTA · SEM FICHA</span><span>{formatBRL(fora)}</span></div>}
        <div className="tot sub lucro"><span>LUCRO DO SETOR</span><span>{noMaximo(formatBRL(s.lucro), s.unSemPreco > 0)}</span></div>
        {s.orfaos && <div className="tot sub sf"><span>SABORES EM ITEM SEM SETOR</span><span>{un(s.orfaos.sabores)} un · {formatBRL(s.orfaos.custo)}</span></div>}
      </div>
    )
  }

  // ─── S17 · o que foi dentro do item (custo inteiro) + "ver pedidos →" (S19) ───
  const blocoDentro = (i: ItemDTO) => {
    const ps = pedidos[i.chave]
    return (
      <div className="dentro" onClick={(e) => e.stopPropagation()} data-testid="dentro">
        {i.semBase
          ? <div className="lin2 sf"><span>⚠ ficha de {i.nome}<span className="q">× {un(i.q)}</span>{i.destino == null || i.fichaId ? <button type="button" className="btn-mini" onClick={() => criarFichaEm(i)}>{i.fichaId ? 'abrir ficha →' : 'criar ficha →'}</button> : null}</span><span>sem ficha</span></div>
          : baseParcial(i)
            ? <div className="lin2 sf"><span>⚠ ficha {i.nome}<span className="q">× {un(i.q)} · sem preço: {i.semPreco.find((f) => f.tipo === 'PRODUTO')!.faltantes.join(', ')}</span></span><span>{peloMenos(i.custoBase ?? 0, true)}</span></div>
            : <div className="lin2"><span>ficha {i.nome}<span className="q">× {un(i.q)}</span></span><span>{formatBRL(i.custoBase ?? 0)}</span></div>}
        {i.sabores.map((s) => (s.custoUn == null
          ? <div className="lin2 sf" key={s.nome}><span>⚠ {s.nome}<span className="q">× {un(s.q)}</span><button type="button" className="btn-mini" onClick={() => { setSetorAberto(i.secao); setFichaAberta(kS(s.nome)); requestAnimationFrame(() => detalheRef.current?.scrollIntoView({ behavior: 'smooth' })) }}>{s.fichaId ? 'abrir ficha →' : 'criar ficha →'}</button></span><span>sem ficha</span></div>
          : s.faltaPreco.length
            ? <div className="lin2 sf" key={s.nome}><span>⚠ {s.nome}<span className="q">× {un(s.q)} · sem preço: {s.faltaPreco.join(', ')}</span></span><span>{peloMenos(s.custo ?? 0, true)}</span></div>
            : <div className="lin2" key={s.nome}><span>{s.nome}<span className="q">× {un(s.q)} · ficha {formatBRL(s.custoUn)}</span></span><span>{formatBRL(s.custo ?? 0)}</span></div>))}
        <div className="fecho"><span>VENDEU</span><span>{formatBRL(i.vendeu)}</span></div>
        <div className="fecho"><span>CUSTO</span><span>{i.semBase ? 'sem ficha' : peloMenos(i.custo, incompleto(i))}</span></div>
        <div className={`fecho lucro ${i.lucro != null && i.lucro < 0 ? 'neg' : ''}`}><span>LUCRO DO ITEM</span><span>{i.lucro == null ? '·' : noMaximo(formatBRL(i.lucro), incompleto(i))}</span></div>
        <div className="vp"><button type="button" className="btn-mini" onClick={() => void verPedidos(i.chave)} data-testid="ver-pedidos">ver pedidos →</button></div>
        {ps === 'carregando' && <div className="peds">…</div>}
        {Array.isArray(ps) && (
          <div className="peds" data-testid="pedidos">
            {ps.map((p, k) => <div className="ped" key={k}><b>{p.numero}</b><span>{p.hora}</span><span>{un(p.q)}× {i.nome}{p.sabores.length ? ` → ${p.sabores.join(', ')}` : ''}</span></div>)}
            <div className="ped tot-p"><span>{ps.length} pedidos · {un(ps.reduce((t, p) => t + p.q, 0))} un</span></div>
          </div>
        )}
      </div>
    )
  }

  const renderMesa = (s: SetorDTO) => {
    const xs = itensDe(s)
    return (
      <div className="painel" ref={mesaRef} data-testid="mesa">
        <h2>Itens do setor<Info>custo e margem aqui são INTEIROS: base + sabores que foram no item · clique no item pra abrir o que foi dentro dele · ⭐ vende muito e lucra bem · 🐴 vende muito, lucra pouco — cuidado em promoção · 💎 lucra muito, vende pouco — candidata a promoção · 🐶 nem um nem outro · corte nas medianas do setor no dia</Info></h2>
        <div className="camada g6">
          <div className="head"><span>UN</span><span>ITEM</span><span className="r">VENDEU</span><span className="r">CUSTO</span><span className="r">MARGEM</span><span></span></div>
          {xs.map((i) => (
            <div className="row" key={i.chave} onClick={() => setItemAberto((x) => (x === i.chave ? null : i.chave))} data-testid="linha-mesa">
              <div className="cab">
                <span className="qtd">{un(i.q)}</span>
                <span className="nm">{i.nome}{i.promo && <span className="tagp">PROMO</span>}{(i.semFicha.length > 0 || i.semPreco.length > 0) && <span className="aviso"> ⚠</span>}</span>
                <span className="stats">
                  <span className="apoio forte-2"><span className="rot">vendeu</span>{formatBRL(i.vendeu)}</span>
                  <span className="forte"><span className="rot">custo</span>{i.semBase ? 'sem ficha' : peloMenos(i.custo, incompleto(i))}</span>
                  {i.margem != null && <span className="mg"><span className="rot">margem</span>{noMaximo(pct(i.margem), incompleto(i))}</span>}
                </span>
                <span className="badge">{i.quadrante ?? ''} <span className="chev">{itemAberto === i.chave ? '▲' : '▼'}</span></span>
              </div>
              {itemAberto === i.chave && blocoDentro(i)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── S21/S23 · o estudo do item que o dono escolher ───
  const renderEstudo = () => {
    if (!d.itens.length) return null
    const e = d.itens.find((i) => i.chave === (itemEstudo ?? d.estudo.padrao)) ?? d.itens[0]
    const regua = d.estudo.reguas[e.chave]
    const grupos = setores.filter((s) => s.itens.length).map((s) => [s, d.itens.filter((i) => i.secao === s.secao)] as const)
    const sel = (
      <select className="selit" value={e.chave} onChange={(ev) => { setItemEstudo(ev.target.value); setPrecoTxt(null) }} data-testid="seletor-estudo">
        {grupos.map(([s, xs]) => <optgroup key={s.secao} label={nomeSetor(s)}>{xs.map((i) => <option key={i.chave} value={i.chave}>{i.nome}</option>)}</optgroup>)}
      </select>
    )
    const topo = <div className="t estudo-t">ESTUDO DO ITEM {sel}{e.promo && <span className="tagp">PROMO</span>}{paineis.seloParcial && <span className="selo-dia" data-testid="estudo-parcial">{paineis.seloParcial}</span>}</div>
    const vendeuHoje = <div className="v-cel">vendeu hoje{paineis.seloParcial ? ` · ${paineis.seloParcial}` : ''} · a {formatBRL(e.preco)}<b>{un(e.q)} un · {formatBRL(e.vendeu)}</b></div>
    if (e.semBase || e.lucro == null) {
      return (
        <div className="camada" data-testid="estudo">{topo}
          <div className="v-grid">{vendeuHoje}</div>
          <div className="selo-l">{e.destino == null || e.fichaId
            ? <span className="cob gap" onClick={() => criarFichaEm(e)}>⚠ item sem ficha — criar ficha pra estudar →</span>
            : <span className="cob gap">⚠ item sem custo</span>}</div>
        </div>
      )
    }
    const inc = e.semFicha.reduce((t, f) => t + f.q, 0)
    const incPreco = e.semPreco.reduce((t, f) => t + f.q, 0)
    const preco = lerPreco(precoTxt ?? String(e.preco).replace('.', ',')) ?? e.preco
    const base = { lucro: e.lucro, custoUn: e.custo / e.q, cheioUn: regua?.un ?? null }
    const r = eseConta(base, preco)
    const v = vereditoDoEse(e.promo, r)
    return (
      <div className="camada" data-testid="estudo">{topo}
        <div className="v-grid">
          {vendeuHoje}
          <div className="v-cel">custou (base + sabores)<b>{formatBRL(e.custo)}</b></div>
          <div className="v-cel">lucro de hoje<b>{formatBRL(e.lucro)}</b></div>
          <div className="v-cel">lucro por unidade<b>{formatBRL(e.lucro / e.q)}</b></div>
        </div>
        <div className="selo-l">{inc > 0 || incPreco > 0
          ? <span className="cob gap" onClick={() => { setSetorAberto(e.secao); setGaps(e.secao) }} data-testid="estudo-incompleto">⚠ {[inc > 0 ? `${un(inc)} un sem ficha` : '', incPreco > 0 ? `${un(incPreco)} un com ingrediente sem preço` : ''].filter(Boolean).join(' · ')} — custo incompleto, lucro é &quot;pelo menos&quot; →</span>
          : <span className="cob ok">fichas 100% ✓</span>}</div>
        <div className="ese">
          <span className="t2">e se vendesse a</span>
          <span className="money">R$ <input value={precoTxt ?? String(e.preco.toFixed(2)).replace('.', ',')} inputMode="decimal" onChange={(ev) => setPrecoTxt(ev.target.value)} data-testid="ese-preco" aria-label="preço" /></span>
          <span className="v-cel ese-c">lucro por un<b data-testid="ese-lucro-un">{r.lucroUn > 0 ? formatBRL(r.lucroUn) : 'não paga o custo'}</b></span>
          <span className="v-cel ese-c">pra empatar hoje<b data-testid="ese-empate">{r.empate != null ? `${r.empate} un` : '·'}</b></span>
          <span className="v-cel ese-c">régua dias normais{regua && regua.nomeCheio !== e.nome ? ` (${regua.nomeCheio})` : ''}<b data-testid="ese-regua">{regua?.un != null ? `${un(regua.un)} un` : 'em formação'}</b></span>
        </div>
        {v && r.lucroCheio != null && paineis.vereditoDoEse(regua?.un ?? null) && (
          <div className={`veredito ${v.ok ? 'ok' : 'ruim'}`} data-testid="ese-veredito">
            {v.titulo} — <b>+{formatBRL(v.valor)}{v.ok ? '' : ' a mais'}</b>
            <div className="vsub">{un(regua!.un!)} un a {formatBRL(preco)} dariam {formatBRL(r.lucroCheio)} · hoje deu {formatBRL(e.lucro)}</div>
          </div>
        )}
      </div>
    )
  }

  // ⭐ E1 (12/11) · veredito do setor e estudo do item são painéis SEPARADOS — a decisão é `paineisDoDia`
  const paineis = paineisDoDia(d)
  const renderVeredito = () => {
    // S7/S8 · o veredito do setor: só dia FECHADO, com régua (intocado)
    const vd = d.veredito
    const sv = vd ? setores.find((s) => s.secao === vd.secao) : null
    if (!paineis.vereditoSetor || !vd || !sv) return null
    return (
      <div className="painel" data-testid="promo">
        {(
          <>
            <h2>Veredito — {nomeSetor(sv)} {ddmm(d.dia)}<Info>comparado com a régua: a mediana dos 4 mesmos dias-da-semana anteriores, sem promoção · dia parcial não fecha veredito · no E SE, o custo é o custo real por unidade do item (base + sabores que saíram) e a régua é quantas unidades do produto a preço cheio saem num dia típico sem promo · lucro com sabor sem ficha é &quot;pelo menos&quot;: só muda quando a ficha nascer</Info></h2>
            <div className="v-grid">
              <div className="v-cel">vendeu<b>{un(vd.dia.un)} un {vd.regua && <span className="reg">(régua {un(vd.regua.un)})</span>}</b></div>
              <div className="v-cel">entrou<b>{formatBRL(vd.dia.vendeu)}</b></div>
              <div className="v-cel">custou<b>{formatBRL(vd.dia.custo)}</b></div>
              <div className="v-cel">lucro do dia<b>{formatBRL(vd.dia.lucro)}</b></div>
            </div>
            {vd.emFormacao || vd.delta == null || !vd.regua
              ? <div className="veredito neutro" data-testid="veredito">régua em formação</div>
              : (
                <div className={`veredito ${vd.delta >= 0 ? 'ok' : 'ruim'}`} data-testid="veredito">
                  {vd.delta >= 0 ? '✓ A PROMOÇÃO VALEU' : '✗ A PROMOÇÃO NÃO VALEU'} — <b>{vd.delta >= 0 ? '+' : ''}{formatBRL(vd.delta)}</b> de lucro vs um dia normal
                  <div className="vsub">vender pouco e caro (dia normal) daria {formatBRL(vd.regua.lucro)} · {vd.delta >= 0 ? 'a promo deu' : 'a promo deu só'} {formatBRL(vd.dia.lucro)}</div>
                </div>
              )}
          </>
        )}
      </div>
    )
  }
  // ⭐ E1 (12/11) · o ESTUDO aparece TODO dia com itens — parcial leva o selo "até HH:MM"
  const renderPainelEstudo = () => (paineis.estudo ? <div className="painel" data-testid="painel-estudo">{renderEstudo()}</div> : null)

  return (
    <div className="ls">
      <style>{CSS}</style>
      <h1>Lucro por Setor<Link className="edita" href={`/empresas/${id}/estoque/cardapio/secoes`} aria-label="editar setores" title="editar setores">✎</Link></h1>

      <div className="chips" data-testid="chips">
        {d.dias.map((x) => (
          <button key={x.dia} type="button" className={`chip ${x.dia === d.dia ? 'on' : ''}`} onClick={() => trocaDia(x.dia)}>
            {rotuloDia(x.dia, d.hoje)}{x.parcial && <span className="selo-parcial">· {x.parcial}</span>}
          </button>
        ))}
        {!d.dias.some((x) => x.dia === d.dia) && <button type="button" className="chip on">{rotuloDia(d.dia, d.hoje)}</button>}
        <label className="chip escolher">📅 escolher…<input type="date" max={d.hoje} value={d.dia} onChange={(e) => e.target.value && trocaDia(e.target.value)} aria-label="escolher dia" /></label>
      </div>

      {d.promo && promoItem && (
        <div className="promo-card" data-testid="promo-card" onClick={() => { setSetorAberto(promoItem.secao); setItemAberto(promoItem.chave); requestAnimationFrame(() => mesaRef.current?.scrollIntoView({ behavior: 'smooth' })) }}>
          <span className="tag">🏷 PROMO DETECTADA</span> {d.promo.nome} a {formatBRL(d.promo.preco)}
          {d.promo.usual != null && <span className="normal">(normal {formatBRL(d.promo.usual)})</span>} · {un(d.promo.q)} un — estudar ↓
        </div>
      )}

      {!d.temDado
        ? <div className="painel convite" data-testid="convite">sem dado nesse dia · <Link href={`/empresas/${id}/estoque/vendas`}>importa o dia →</Link></div>
        : (
          <div className="grid" data-testid="setores">
            {setores.map((s) => {
              const sel = d.temLaco && sAberto?.secao === s.secao
              return (
                <div key={s.secao} className={`setor ${sel ? 'sel' : ''} ${d.temLaco ? '' : 'semlaco'}`} onClick={() => { if (d.temLaco) { setSetorAberto(s.secao); setFichaAberta(null); setItemAberto(null); setGaps(null) } else setGaps((g) => (g === s.secao ? null : s.secao)) }} data-testid="card-setor">
                  <div className="nome">{nomeSetor(s)}</div>
                  <div className="lin"><span>vendeu</span><b>{formatBRL(s.vendeu)} · {un(s.un)} un</b></div>
                  <div className="lin"><span>custo (fichas)</span><b>{formatBRL(s.custo)}</b></div>
                  <div className={`lucro ${s.lucro >= 0 ? 'pos' : 'neg'}`}>{formatBRL(s.lucro)}</div>
                  {s.margem != null && <span className="pill marg">margem {pct(s.margem)}</span>}{' '}
                  {/* ⭐ E3 · a cobertura separa os DOIS casos: sem ficha × ficha com ingrediente sem preço */}
                  {s.unSemFicha > 0 && <span className="cob gap" data-testid="selo-sem-ficha" onClick={(e) => { e.stopPropagation(); if (d.temLaco) setSetorAberto(s.secao); setGaps((g) => (g === s.secao ? null : s.secao)) }}>⚠ {un(s.unSemFicha)} un sem ficha →</span>}
                  {s.unSemPreco > 0 && <span className="cob gap" data-testid="selo-sem-preco" onClick={(e) => { e.stopPropagation(); if (d.temLaco) setSetorAberto(s.secao); setGaps((g) => (g === s.secao ? null : s.secao)) }}>⚠ {un(s.unSemPreco)} un com ingrediente sem preço →</span>}
                  {s.unSemFicha === 0 && s.unSemPreco === 0 && <span className="cob ok">fichas 100% ✓</span>}
                  {!d.temLaco && <span className="cob nl">sem laço nesse dia</span>}
                  {!d.temLaco && gaps === s.secao && (s.semFicha.length > 0 || s.semPreco.length > 0) && listaGaps(s)}
                </div>
              )
            })}
          </div>
        )}

      {sAberto && renderDetalhe(sAberto)}
      {sAberto && renderMesa(sAberto)}
      {renderVeredito()}
      {renderPainelEstudo()}
      {erro && <div className="painel">{erro}</div>}
    </div>
  )
}

/* a folha da lei (docs/lucro-por-setor-referencia.html v11), com os tokens DA CASA (1:1) — sem teto do mock */
const CSS = `
.ls{--card:var(--prod-surface);--card-2:var(--prod-surface-1);--linha:var(--prod-line);--linha-forte:var(--prod-line-strong);
  --tinta:var(--prod-primary);--tinta-2:var(--prod-secondary);--tinta-3:var(--prod-muted);
  --acao:var(--prod-acao-bg);--acao-quente:var(--prod-acao-quente);--acao-50:var(--prod-surface-2);--acao-tinta:var(--fam-indigo-ink);
  --verde:var(--prod-verde);--verde-50:var(--prod-verde-bg);--verde-tinta:var(--fam-verde-ink);
  --coral:var(--prod-coral);--coral-50:var(--prod-coral-bg);--coral-tinta:var(--fam-coral-ink);
  --ambar:var(--prod-ambar);--ambar-50:var(--prod-ambar-bg);--ambar-tinta:var(--fam-ambar-ink);
  --r-painel:var(--prod-r-painel);--r-cartao:var(--prod-r-cartao);--r-pilula:999px;--sombra:var(--prod-sombra);
  background:var(--prod-bg);color:var(--tinta);padding:0 0 60px} /* área útil do app; o respiro lateral é o do shell */
.ls h1{font-size:21px;margin:4px 0 10px;letter-spacing:-.02em;display:flex;align-items:center;gap:8px}
.ls .edita{font-size:13px;color:var(--tinta-3);text-decoration:none;border:1px solid var(--linha-forte);border-radius:var(--r-pilula);padding:1px 8px}
.ls .chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 6px}
.ls .chip{border:1px solid var(--linha-forte);background:var(--card);color:var(--tinta-2);border-radius:var(--r-pilula);padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.ls .chip.on{background:var(--acao);border-color:var(--acao);color:var(--prod-acao-ink)}
.ls .chip.escolher{position:relative;overflow:hidden}
.ls .chip.escolher input{position:absolute;inset:0;opacity:0;cursor:pointer}
.ls .selo-parcial{font-size:10.5px;font-weight:800;margin-left:5px;opacity:.85}
.ls .promo-card{display:flex;align-items:center;gap:10px;background:var(--acao-50);border:1px solid var(--acao);border-radius:var(--r-cartao);padding:10px 14px;margin:8px 0 14px;font-size:13px;color:var(--acao-tinta);font-weight:700;cursor:pointer;flex-wrap:wrap}
.ls .promo-card .tag{background:var(--acao);color:var(--prod-acao-ink);border-radius:var(--r-pilula);padding:2px 10px;font-size:11px;font-weight:800}
.ls .promo-card .normal{font-weight:600;color:var(--tinta-2)}
.ls .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:12px}
.ls .setor{background:var(--card);border:1px solid var(--linha-forte);border-radius:var(--r-painel);box-shadow:var(--sombra);padding:13px 15px;cursor:pointer}
.ls .setor.sel{outline:2px solid var(--acao);outline-offset:1px}
.ls .setor .nome{font-size:13.5px;font-weight:800;display:flex;gap:7px}
.ls .setor .lin{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--tinta-2);margin-top:6px}
.ls .setor .lin b{color:var(--tinta);font-variant-numeric:tabular-nums;text-align:right}
.ls .setor .lucro{font-size:23px;font-weight:800;letter-spacing:-.02em;margin-top:8px;font-variant-numeric:tabular-nums}
.ls .setor .lucro.pos{color:var(--verde)} .ls .setor .lucro.neg{color:var(--coral)}
.ls .pill{font-size:11px;font-weight:800;border-radius:var(--r-pilula);padding:2px 9px;display:inline-block}
.ls .pill.marg{background:var(--acao-50);color:var(--acao-tinta)}
.ls .cob{margin-top:8px;font-size:11px;font-weight:700;border-radius:var(--r-pilula);padding:4px 10px;display:inline-block;cursor:pointer}
.ls .cob.ok{background:var(--verde-50);color:var(--verde-tinta);cursor:default}
.ls .cob.gap{background:var(--ambar-50);color:var(--ambar-tinta)}
.ls .cob.nl{background:var(--card-2);color:var(--tinta-3);cursor:default;margin-left:4px}
.ls .painel{background:var(--card);border:1px solid var(--linha-forte);border-radius:var(--r-painel);box-shadow:var(--sombra);padding:16px;margin-top:16px}
.ls .painel.convite{font-weight:700;color:var(--tinta-2)} .ls .painel.convite a{color:var(--acao-tinta)}
.ls .painel h2{font-size:15px;margin:0 0 10px}
.ls .camada{background:var(--card-2);border:1px solid var(--linha);border-radius:var(--r-cartao);padding:11px 13px;margin-top:10px}
.ls .camada .t{font-size:12px;font-weight:800;color:var(--tinta-2);letter-spacing:.04em;margin-bottom:7px}
.ls .estudo-t{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.ls .head{display:grid;gap:10px;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--tinta-3);text-transform:uppercase;padding:0 0 6px;border-bottom:2px solid var(--linha-forte)}
.ls .head span.r{text-align:right}
.ls .row{padding:0;border-bottom:1px solid var(--linha);cursor:pointer}
.ls .row:last-child{border-bottom:0}
.ls .cab{display:grid;gap:10px;align-items:center;padding:8px 0}
.ls .g5 .head,.ls .g5 .cab{grid-template-columns:46px 1fr 92px 96px 18px}
.ls .g6 .head,.ls .g6 .cab{grid-template-columns:46px 1fr 104px 100px 88px 34px}
.ls .qtd{font-weight:800;font-size:13.5px;background:var(--card);border:1px solid var(--linha-forte);border-radius:8px;text-align:center;padding:4px 0;font-variant-numeric:tabular-nums}
.ls .nm{font-weight:700;font-size:13.5px;letter-spacing:-.01em;line-height:1.25}
.ls .nm .aviso{color:var(--ambar-tinta);font-size:11px;font-weight:800}
.ls .apoio{font-size:12px;color:var(--tinta-3);text-align:right;font-variant-numeric:tabular-nums}
.ls .apoio.forte-2{font-weight:700;color:var(--tinta)}
.ls .forte{font-weight:800;font-size:13.5px;text-align:right;font-variant-numeric:tabular-nums}
.ls .mg{justify-self:end;font-size:11.5px;font-weight:800;border-radius:var(--r-pilula);padding:3px 10px;background:var(--acao-50);color:var(--acao-tinta);font-variant-numeric:tabular-nums}
.ls .badge{font-size:16px;text-align:center}
.ls .chev{color:var(--tinta-3);font-size:10px;text-align:right}
.ls .row.sem .qtd{background:var(--ambar-50);border-color:var(--ambar);color:var(--ambar-tinta)}
.ls .row.sem .nm,.ls .row.sem .forte{color:var(--ambar-tinta)}
.ls .tagp{background:var(--acao);color:var(--prod-acao-ink);border-radius:var(--r-pilula);padding:1px 8px;font-size:10px;font-weight:800;margin-left:7px;vertical-align:1px}
.ls .btn-mini{font-size:11px;font-weight:800;color:var(--acao-tinta);background:var(--acao-50);border:0;border-radius:var(--r-pilula);padding:3px 10px;cursor:pointer;margin-left:8px;text-decoration:none;font-family:inherit;display:inline-block}
.ls .btn-mini.on{background:var(--acao);color:var(--prod-acao-ink);margin-left:auto}
.ls .btn-mini:disabled{opacity:.6;cursor:wait}
.ls .ficha{background:var(--card);border:1px dashed var(--linha-forte);border-radius:var(--r-cartao);margin:7px 0 4px;padding:9px 11px;cursor:default}
.ls .ficha .q{color:var(--tinta-3);font-size:11px;margin-left:5px;font-weight:400}
.ls .ficha .v{font-weight:700;font-variant-numeric:tabular-nums;min-width:64px;text-align:right;font-size:12px}
.ls .ficha .ing{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--linha);flex-wrap:wrap}
.ls .ficha .dose{display:flex;align-items:center;gap:6px}
.ls .ficha .dose button{width:22px;height:22px;border-radius:6px;border:1px solid var(--linha-forte);background:var(--card-2);color:var(--tinta);font-weight:800;cursor:pointer;font-size:13px;padding:0}
.ls .ficha .dose b{min-width:70px;text-align:center;font-variant-numeric:tabular-nums;font-size:12px}
.ls .ficha .x{background:var(--coral-50)!important;color:var(--coral-tinta)!important;font-size:11px!important}
.ls .ficha .sp{color:var(--ambar-tinta);font-weight:700} .ls .ficha .sp-link{color:var(--ambar-tinta);text-decoration:underline;font-weight:700}
.ls .ficha .rodape{display:flex;justify-content:space-between;font-size:12px;font-weight:800;margin-top:7px;padding-top:6px;border-top:1px solid var(--linha-forte)}
.ls .ficha .add{margin-top:8px;padding-top:7px;border-top:1px dashed var(--linha-forte)}
.ls .ficha .grava{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}
.ls .ficha .erro{font-size:12px;font-weight:700;color:var(--coral-tinta)} .ls .ficha .erro a{color:var(--acao-tinta)}
.ls .dentro{background:var(--card);border:1px dashed var(--linha-forte);border-radius:var(--r-cartao);margin:7px 0 6px;padding:9px 11px;cursor:default}
.ls .dentro .lin2{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--linha);font-variant-numeric:tabular-nums}
.ls .dentro .lin2 .q{color:var(--tinta-3);font-size:11px;margin-left:5px}
.ls .dentro .lin2.sf{color:var(--ambar-tinta);font-weight:700}
.ls .dentro .fecho{display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;margin-top:6px;padding-top:6px;border-top:1px solid var(--linha-forte);font-variant-numeric:tabular-nums}
.ls .dentro .fecho.lucro{color:var(--verde);border:0;margin-top:2px;padding-top:0} .ls .dentro .fecho.lucro.neg{color:var(--coral)}
.ls .dentro .vp{margin-top:7px} .ls .dentro .vp .btn-mini{margin:0}
.ls .peds{margin-top:6px;font-size:12px;font-variant-numeric:tabular-nums}
.ls .ped{display:grid;grid-template-columns:64px 46px 1fr;gap:8px;padding:3px 0;border-bottom:1px solid var(--linha)}
.ls .ped.tot-p{display:block;border:0;color:var(--tinta-3);font-weight:700}
.ls .tot{display:flex;justify-content:space-between;font-size:14px;font-weight:800;margin-top:10px;padding-top:9px;border-top:2px solid var(--linha-forte);font-variant-numeric:tabular-nums}
.ls .tot.sub{border:0;margin-top:2px;padding-top:0} .ls .tot.lucro{color:var(--verde)} .ls .tot.sf{color:var(--ambar-tinta);font-size:12.5px}
.ls .i{width:17px;height:17px;border-radius:50%;border:1px solid var(--linha-forte);background:var(--card-2);color:var(--tinta-3);font-size:11px;font-weight:700;cursor:pointer;vertical-align:2px;margin-left:6px;line-height:1;padding:0}
.ls .pop{display:block;font-size:11.5px;color:var(--tinta-2);background:var(--card-2);border:1px solid var(--linha);border-radius:var(--r-cartao);padding:8px 11px;margin:6px 0 2px;line-height:1.6;font-weight:400}
.ls .veredito{border-radius:var(--r-cartao);padding:13px 15px;margin-top:12px;font-size:13.5px}
.ls .veredito.ok{background:var(--verde-50);border:1px solid var(--verde);color:var(--verde-tinta)}
.ls .veredito.ruim{background:var(--coral-50);border:1px solid var(--coral);color:var(--coral-tinta)}
.ls .veredito.neutro{background:var(--card-2);border:1px solid var(--linha);color:var(--tinta-3);font-weight:700}
.ls .veredito b{font-size:17px} .ls .veredito .vsub{font-size:12.5px;margin-top:5px}
.ls .v-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:9px;margin-top:10px}
.ls .v-cel{background:var(--card);border:1px solid var(--linha);border-radius:var(--r-cartao);padding:8px 10px;font-size:12px;color:var(--tinta-2)}
.ls .v-cel b{display:block;font-size:15px;color:var(--tinta);font-variant-numeric:tabular-nums}
.ls .v-cel .reg{font-size:12px;color:var(--tinta-3)}
.ls .selo-l{margin-top:9px}
.ls .ese{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px dashed var(--linha-forte)}
.ls .ese .t2{font-size:12px;font-weight:800;letter-spacing:.05em;color:var(--tinta-2);text-transform:uppercase}
.ls .ese .money{display:inline-flex;align-items:center;gap:5px;font-weight:800;font-size:15px;background:var(--card-2);border:1.5px solid var(--acao);border-radius:10px;padding:7px 11px}
.ls .ese input{width:76px;border:0;background:none;color:var(--tinta);font-family:inherit;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums;outline:none;text-align:right}
.ls .ese .ese-c{flex:1 1 120px}
.ls .selo-dia{font-size:10.5px;font-weight:800;color:var(--tinta-2);background:var(--card);border:1px solid var(--linha-forte);border-radius:var(--r-pilula);padding:2px 9px}
.ls .selit{border:1px solid var(--linha-forte);background:var(--card);color:var(--tinta);border-radius:10px;padding:6px 10px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;max-width:100%}
.ls .rot{display:none}
@media(max-width:620px){
  .ls{padding:0 0 50px}
  .ls .grid{grid-template-columns:1fr 1fr}
  .ls .setor{padding:11px 12px} .ls .setor .lucro{font-size:19px} .ls .setor .lin{flex-direction:column;gap:1px}
  .ls .g5 .head,.ls .g6 .head{display:none}
  .ls .g5 .cab{grid-template-columns:38px 1fr 18px;grid-template-areas:"un nm ch" "st st st"}
  .ls .g6 .cab{grid-template-columns:38px 1fr 34px;grid-template-areas:"un nm bg" "st st st"}
  .ls .g5 .qtd,.ls .g6 .qtd{grid-area:un}
  .ls .g5 .nm,.ls .g6 .nm{grid-area:nm}
  .ls .g5 .chev{grid-area:ch}
  .ls .g6 .badge{grid-area:bg}
  .ls .stats{grid-area:st;display:flex;gap:14px;flex-wrap:wrap;padding-top:2px}
  .ls .stats .apoio,.ls .stats .forte{text-align:left;font-size:12.5px}
  .ls .stats .mg{justify-self:start}
  .ls .rot{display:inline;font-size:9px;font-weight:800;letter-spacing:.06em;color:var(--tinta-3);text-transform:uppercase;margin-right:4px}
  .ls .ped{grid-template-columns:56px 40px 1fr}
}
@media(min-width:621px){ .ls .stats{display:contents} }
`
