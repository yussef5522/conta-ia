'use client'

// VENDAS AO VIVO — a tela real da lei docs/vendas-ao-vivo-referencia.html (v3, APROVADA 11/11/2026).
// Leis V0–V11 nos comentários da referência; tokens 1:1 com a casa (--prod-* / --fam-*), zero hex.
// V0 fonte única = o espelho suit_* (via /vendas/ao-vivo) · V1 ao vivo honesto (polling 45s,
// "atualizado HH:MM" = o último ciclo REAL do sincronizador) · V8 ⛔ cliente não existe aqui.
// No topo, quando há: a decisão "manter ou atualizar" (pedido que mudou depois do dia entrar).

import { useCallback, useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'
import type { AoVivoDTO, PedidoDTO } from '@/lib/suit/ao-vivo'

type Evento = { id: string; dia: string; tipo: string; pedido: string; hora: string | null; totalCent: number; deltaCent: number }
type EstadoSuit = { eventos: Evento[] }

const POLL_MS = 45_000
const fmt = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const brl = (c: number) => `R$ ${fmt(c)}`
const diaBr = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
const SEMANA_CURTA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const diaDaSemana = (d: string) => SEMANA_CURTA[new Date(`${d}T12:00:00Z`).getUTCDay()]
const NOME_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const tipicoDe = (d: string) => `${NOME_SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]} típic${new Date(`${d}T12:00:00Z`).getUTCDay() === 0 || new Date(`${d}T12:00:00Z`).getUTCDay() === 6 ? 'o' : 'a'}`
const CLASSE_ST: Record<string, string> = { accepted: 'aceito', ready: 'preparo', delivered: 'entregue', cancelled: 'cancelado', transferred: 'transferido', abandoned: 'transferido', apagado: 'cancelado' }

function Info({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  return (<><button type="button" className="i" aria-label="explicação" onClick={() => setAberto((v) => !v)}>i</button>{aberto && <span className="pop">{children}</span>}</>)
}

export default function VendasAoVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [d, setD] = useState<AoVivoDTO | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [canalSel, setCanalSel] = useState<string | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)
  const [novos, setNovos] = useState<Set<number>>(new Set())
  const [fechando, setFechando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [popFechar, setPopFechar] = useState(false)
  const vistos = useRef<Set<number> | null>(null)

  const carregar = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([fetch(`/api/empresas/${id}/estoque/vendas/ao-vivo`, { cache: 'no-store' }), fetch(`/api/empresas/${id}/estoque/vendas/suit`, { cache: 'no-store' })])
      const j = (await r.json().catch(() => null)) as AoVivoDTO | null
      if (!r.ok || !j) { setErro('Não consegui ler as vendas agora.'); return }
      // V3 · pedido NOVO pulsa 1 vez (só o que chegou depois da 1ª carga)
      const ids = new Set(j.feed.map((p) => p.id))
      if (vistos.current) setNovos(new Set([...ids].filter((x) => !vistos.current!.has(x))))
      vistos.current = ids
      setD(j); setErro(null)
      const ej = (await e.json().catch(() => null)) as EstadoSuit | null
      setEventos(ej?.eventos ?? [])
    } catch { setErro('Sem conexão — tento de novo em instantes.') }
  }, [id])
  useEffect(() => {
    void carregar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void carregar() }, POLL_MS)
    return () => clearInterval(t)
  }, [carregar])

  async function fecharDia() {
    if (fechando) return // trava anti-duplo-clique (a do servidor é a de verdade)
    setFechando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/ao-vivo/fechar`, { method: 'POST' })
      const j = await r.json().catch(() => null)
      if (!r.ok) setErro(j?.erro ?? 'Não consegui fechar o dia.')
      await carregar()
    } finally { setFechando(false) }
  }

  async function decidir(dia: string, decisao: 'MANTER' | 'ATUALIZAR') {
    setOcupado(`${dia}:${decisao}`)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/vendas/suit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dia, decisao }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) setErro(j?.erro ?? 'Não consegui aplicar a decisão.')
      await carregar()
    } finally { setOcupado(null) }
  }

  const diasComEvento = [...new Set(eventos.map((e) => e.dia))]
  const feed = d ? d.feed.filter((p) => canalSel == null || p.canal === canalSel) : []
  const tipico = d ? tipicoDe(d.dia) : ''

  return (
    <div className="vv">
      <style>{CSS}</style>
      <div className="topo">
        <h1>
          Vendas <span className="data">{d ? `${diaDaSemana(d.dia).toLowerCase()} ${diaBr(d.dia)}` : ''}</span>
          {d && <span className="vivo" data-testid="ao-vivo"><span className="dot" /> AO VIVO · {d.atualizado ? `atualizado ${d.atualizado}` : 'sem leitura da Suit'}</span>}
        </h1>
        <span>
          {d && (d.fechado
            ? <span className="fechado" data-testid="carimbo-dia">✓ dia fechado às {d.fechado.hora} · {d.fechado.por === 'dono' ? 'por você' : 'automático 03:10'} · contagem liberada</span>
            : <button type="button" className="fechar" data-testid="fechar-o-dia" disabled={fechando} onClick={() => void fecharDia()}>{fechando ? 'Fechando…' : 'Fechar o dia'}</button>)}
          <button type="button" className="i" aria-label="explicação" onClick={() => setPopFechar((v) => !v)}>i</button>
        </span>
      </div>
      {popFechar && <span className="pop">fechou o caixa na Suit, fecha aqui: o sistema puxa o dia inteiro agora (produtos e sabores), dá as baixas no estoque e libera a contagem · sem clicar, fecha sozinho às 03:10 · a guarda re-confere às 03:10 e avisa se algum pedido mudar, sumir ou chegar depois</span>}
      <Link href={`/empresas/${id}/estoque/vendas`} className="central">central de vendas ›</Link>
      {erro && <div className="alerta">{erro}</div>}

      {diasComEvento.map((dia) => {
        const evs = eventos.filter((e) => e.dia === dia)
        const delta = evs.reduce((t, e) => t + e.deltaCent, 0)
        return (
          <div key={dia} className="painel decidir" data-testid={`decidir-${dia}`}>
            <h2>{diaBr(dia)} · {evs.length} pedido{evs.length > 1 ? 's' : ''} mudou na Suit depois de o dia entrar <span className="hcount">{brl(delta)}</span></h2>
            {evs.map((e) => (
              <div key={e.id} className="lin"><span>#{e.pedido} · {e.hora ? new Date(e.hora).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'} · {e.tipo === 'APAGADO' ? 'apagado na Suit' : e.tipo === 'NOVO' ? 'chegou depois do fechamento' : 'itens mudaram'}</span><span>{brl(e.deltaCent)}</span></div>
            ))}
            <div className="acoes">
              <button type="button" className="canal" disabled={!!ocupado} onClick={() => void decidir(dia, 'MANTER')}>Manter o dia como entrou</button>
              <button type="button" className="canal on" disabled={!!ocupado} onClick={() => void decidir(dia, 'ATUALIZAR')}>Atualizar o dia com a Suit</button>
            </div>
          </div>
        )
      })}

      {!d ? <div className="painel">carregando…</div> : (
        <>
          <div className="kpis">
            <div className="kpi hero">
              <span className="r">{d.fechado ? 'vendeu hoje · fechado' : `vendeu até ${d.agora}`}</span>
              <b data-testid="vendido">{brl(d.vendidoCent)}</b>
              {d.regua.ritmoPct != null
                ? <span className={`ritmo ${d.regua.ritmoPct >= 0 ? 'up' : 'down'}`}>{d.regua.ritmoPct >= 0 ? '+' : ''}{d.regua.ritmoPct.toFixed(0)}% vs {tipico} até {d.agora.slice(0, 2)}h</span>
                : <span className="sub">régua em formação: {d.regua.semanas} de 4 semanas</span>}
              {d.taxaDia && <span className="sub">taxa {brl(d.taxaDia.taxaCent)} · líquido {brl(d.taxaDia.liquidoCent)}</span>}
            </div>
            <div className="kpi"><span className="r">pedidos</span><b>{d.pedidos}</b><span className="sub">{d.naCozinha} aceitos · {d.prontos} prontos</span></div>
            <div className="kpi"><span className="r">ticket médio</span><b>{d.ticketCent != null ? brl(d.ticketCent) : '—'}</b></div>
            <div className="kpi"><span className="r">{tipico} até {d.agora.slice(0, 2)}h</span><b>{d.regua.tipicoCent != null ? brl(d.regua.tipicoCent) : '…'}</b><span className="sub">{d.regua.tipicoCent != null ? 'mediana dos 4 anteriores' : `em formação · ${d.regua.semanas} de 4 semanas`}</span></div>
          </div>
          {d.regua.alerta && d.regua.ritmoPct != null && d.regua.tipicoCent != null && (
            <div className="alerta">⚠ Dia {Math.abs(d.regua.ritmoPct).toFixed(0)}% abaixo do teu {tipico} até agora ({brl(d.vendidoCent)} × {brl(d.regua.tipicoCent)})</div>
          )}

          <div className="painel">
            <h2>A curva do dia<Info>barras = hoje, hora a hora (a hora atual fica mais clara: ainda está pela metade) · linha com pontos = teu {tipico} (mediana dos 4 anteriores, quando houver 4) · o traço marca &quot;agora&quot;</Info></h2>
            <Curva d={d} />
          </div>

          <div className="painel">
            <h2>Pedidos<span className="hcount">{d.feed.length} no dia</span><Info>pedido por pedido, direto da Suit (~2 min de atraso) · status ativo mostra há quantos minutos desde o último horário que a Suit informa · cancelado fica riscado, nunca some · abandonado e apagado aparecem e ficam fora dos totais (régua provada); transferido entra · cliente não aparece nesta tela</Info></h2>
            <div className="canais">
              <button type="button" className={`canal ${canalSel == null ? 'on' : ''}`} onClick={() => { setCanalSel(null); setAberto(null) }}>Todos</button>
              {d.canais.map((c) => (
                <button type="button" key={c.chave} className={`canal ${canalSel === c.chave ? 'on' : ''}`} onClick={() => { setCanalSel(c.chave); setAberto(null) }}>{c.rotulo} <b>{c.pedidos}</b> · {brl(c.cent)}</button>
              ))}
            </div>
            <div className="head"><span>Nº</span><span>HORA</span><span>ITENS</span><span className="r">STATUS</span><span className="r">VALOR</span><span /></div>
            <div data-testid="feed">
              {feed.map((p) => <Linha key={p.id} p={p} canal={d.canais.find((c) => c.chave === p.canal)?.rotulo ?? p.canal} aberto={aberto === p.id} novo={novos.has(p.id)} onClick={() => setAberto(aberto === p.id ? null : p.id)} />)}
              {feed.length === 0 && <div className="vazio">nenhum pedido ainda</div>}
            </div>
          </div>

          <div className="painel">
            <h2>A semana<Info>cada dia contra a própria régua quando ela existir (4 mesmos dias-da-semana) · ✓ conferido = a guarda bateu Suit × CAIXAOS ao centavo, produto e sabor · hoje só ganha valor depois de fechado</Info></h2>
            <div className="semana">
              {d.semana.map((s) => (
                <div key={s.dia} className={`dia ${s.hoje ? 'hj' : ''}`}>
                  <span className="d">{diaDaSemana(s.dia)} {diaBr(s.dia).slice(0, 2)}{s.hoje ? ' · hoje' : ''}</span>
                  <b>{s.totalCent == null ? 'R$ …' : brl(s.totalCent)}</b>
                  {s.selo === 'conferido' && <span className="ok">✓ conferido</span>}
                  {s.selo === 'fechado' && <span className="ok">✓ fechado às {d.fechado?.hora}</span>}
                  {s.selo === 'divergiu' && <span className="div">⚠ não bateu</span>}
                  {s.selo === 'conferindo' && <span className="pend">conferindo…</span>}
                  {s.selo === 'em andamento' && <span className="pend">em andamento</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Linha({ p, canal, aberto, novo, onClick }: { p: PedidoDTO; canal: string; aberto: boolean; novo: boolean; onClick: () => void }) {
  const prim = p.itens[0]
  const cls = CLASSE_ST[p.status] ?? 'transferido'
  const riscado = p.status === 'cancelled' || p.status === 'apagado'
  return (
    <div className={`row ${riscado ? 'cancelado' : ''} ${novo ? 'novo' : ''}`} onClick={onClick}>
      <div className="cab">
        <span className="num">{p.num}<span className="cbadge">{canal}</span></span>
        <span className="sH"><span className="hora"><span className="rot">hora</span>{p.hora}{p.aberta && <span className="aberta" data-testid="aberta"> · {p.aberta}</span>}</span></span>
        <span className="itens">{prim ? `${prim.q}× ${prim.nome}` : '—'}{p.itens.length > 1 && <span className="mais"> +{p.itens.length - 1}</span>}</span>
        <span className={`st ${cls}`}>{p.rotulo}{p.minutos != null ? ` · ${p.minutos}min` : ''}</span>
        <span className="sV"><span className="val"><span className="rot">valor</span>{brl(p.valorCent)}</span></span>
        <span className="chev">{aberto ? '▲' : '▼'}</span>
      </div>
      {aberto && (
        <div className="det" onClick={(e) => e.stopPropagation()}>
          <div className="bloco">ITENS</div>
          {p.itens.map((i, k) => (
            <div key={k}>
              <div className="lin"><span>{i.q}× {i.nome}</span><span>{brl(i.cent)}</span></div>
              {i.sabores.map((s, j) => <div key={j} className="sab">— {s}</div>)}
            </div>
          ))}
          <div className="bloco">LINHA DO TEMPO</div>
          <div className="tl">{p.linhaDoTempo.map((t, k) => <span key={k}>{k > 0 && <em>→</em>}{t.rotulo} {t.hora}</span>)}</div>
          <div className="bloco">PAGAMENTO</div>
          {p.pagamento.length
            ? p.pagamento.map((g, k) => <div key={k} className="lin"><span>{g.tipo}</span><span>{brl(g.valorCent)}</span></div>)
            : <div className="lin"><span>{riscado ? 'sem cobrança' : 'sem forma de pagamento informada'}</span><span /></div>}
          {!p.conta && <div className="lin"><span>fora dos totais do dia</span><span /></div>}
        </div>
      )}
    </div>
  )
}

function Curva({ d }: { d: AoVivoDTO }) {
  const W = 1000, H = 206, base = 160
  const n = Math.max(1, d.curva.length), bw = W / n
  const max = Math.max(1, ...d.curva.map((c) => Math.max(c.hojeCent ?? 0, c.reguaCent ?? 0))) * 1.1
  const iAg = d.curva.findIndex((c) => c.atual)
  const minutoAgora = Number(d.agora.slice(3, 5))
  const temRegua = d.curva.some((c) => c.reguaCent != null)
  const pts = d.curva.map((c, i) => [i * bw + bw / 2, base - ((c.reguaCent ?? 0) / max) * 150] as const)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="vendas por hora">
      {[0.5, 1].map((f) => { const y = base - 150 * f; return (
        <g key={f}><line x1="0" y1={y} x2={W} y2={y} stroke="var(--prod-line)" strokeWidth="1" /><text x={W - 4} y={y + 13} fontSize="10" fill="var(--prod-muted)" textAnchor="end">R$ {Math.round((max * f) / 100 / 50) * 50}</text></g>
      ) })}
      {d.curva.map((c, i) => {
        const hj = ((c.hojeCent ?? 0) / max) * 150
        return (
          <g key={c.hora}>
            {c.hojeCent != null && <rect x={i * bw + 5} y={base - hj} width={Math.max(1, bw - 10)} height={hj} rx="5" fill="var(--prod-acao-bg)" opacity={c.atual ? 0.45 : 1} />}
            <text x={i * bw + bw / 2} y={base + 20} fontSize="11" fill="var(--prod-muted)" textAnchor="middle" fontWeight={c.atual ? 800 : 400}>{c.hora}</text>
          </g>
        )
      })}
      {temRegua && <polyline points={pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill="none" stroke="var(--prod-muted)" strokeWidth="2" strokeLinejoin="round" opacity=".85" />}
      {temRegua && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="var(--prod-muted)" />)}
      {iAg >= 0 && (() => { const x = iAg * bw + bw * (minutoAgora / 60); const ancora = x > W - 60 ? 'end' : x < 60 ? 'start' : 'middle'; return (
        <g><line x1={x} y1="4" x2={x} y2={base} stroke="var(--prod-coral)" strokeWidth="1.5" strokeDasharray="4 4" /><text x={x} y={base + 38} fontSize="10" fontWeight="800" fill="var(--fam-coral-ink)" textAnchor={ancora} data-testid="rotulo-agora">agora {d.agora}</text></g>
      ) })()}
    </svg>
  )
}

/* a folha da lei, com os tokens DA CASA (1:1) — ver docs/vendas-ao-vivo-referencia.html */
const CSS = `
.vv{--card:var(--prod-surface);--card-2:var(--prod-surface-1);--linha:var(--prod-line);--linha-forte:var(--prod-line-strong);
  --tinta:var(--prod-primary);--tinta-2:var(--prod-secondary);--tinta-3:var(--prod-muted);
  --acao:var(--prod-acao-bg);--acao-quente:var(--prod-acao-quente);--acao-50:var(--prod-surface-2);--acao-tinta:var(--fam-indigo-ink);
  --verde:var(--prod-verde);--verde-50:var(--prod-verde-bg);--verde-tinta:var(--fam-verde-ink);
  --coral:var(--prod-coral);--coral-50:var(--prod-coral-bg);--coral-tinta:var(--fam-coral-ink);
  --ambar:var(--prod-ambar);--ambar-50:var(--prod-ambar-bg);--ambar-tinta:var(--fam-ambar-ink);
  --r-painel:var(--prod-r-painel);--r-cartao:var(--prod-r-cartao);--r-pilula:999px;--sombra:var(--prod-sombra);
  background:var(--prod-bg);color:var(--tinta);padding:0 0 60px} /* E1 (11/11): preenche a área útil do app; o respiro lateral é o do shell */
.vv h1{font-size:21px;margin:4px 0 2px;letter-spacing:-.02em;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.vv .topo{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.vv .central{font-size:11.5px;color:var(--tinta-3);text-decoration:none}
.vv .fechar{font-size:12.5px;font-weight:800;background:var(--acao);color:var(--prod-acao-ink);border:0;border-radius:var(--r-pilula);padding:9px 18px;cursor:pointer;box-shadow:var(--sombra)}
.vv .fechar:hover{background:var(--acao-quente)} .vv .fechar:disabled{opacity:.6;cursor:wait}
.vv .fechado{font-size:11.5px;font-weight:800;color:var(--verde-tinta);background:var(--verde-50);border-radius:var(--r-pilula);padding:6px 13px;display:inline-flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.vv .vivo{font-size:11px;font-weight:800;color:var(--verde-tinta);background:var(--verde-50);border-radius:var(--r-pilula);padding:4px 11px;display:inline-flex;align-items:center;gap:6px}
.vv .vivo .dot{width:7px;height:7px;border-radius:50%;background:var(--verde);animation:vvpulsa 2s infinite}
@keyframes vvpulsa{50%{opacity:.35}}
.vv .painel{background:var(--card);border:1px solid var(--linha-forte);border-radius:var(--r-painel);box-shadow:var(--sombra);padding:16px;margin-top:14px}
.vv .painel h2{font-size:15px;margin:0 0 10px}
.vv .decidir{border-color:var(--ambar)} .vv .acoes{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.vv .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-top:14px}
.vv .kpi{background:var(--card);border:1px solid var(--linha-forte);border-radius:var(--r-painel);box-shadow:var(--sombra);padding:13px 15px}
.vv .kpi .r{font-size:10px;font-weight:800;letter-spacing:.07em;color:var(--tinta-3);text-transform:uppercase}
.vv .kpi b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;margin-top:4px;font-variant-numeric:tabular-nums}
.vv .kpi.hero b{font-size:32px;letter-spacing:-.03em}
.vv .kpi .sub{display:block;font-size:11.5px;color:var(--tinta-3);margin-top:2px;font-variant-numeric:tabular-nums}
.vv .ritmo{font-size:12px;font-weight:800;border-radius:var(--r-pilula);padding:4px 11px;display:inline-block;margin-top:6px}
.vv .ritmo.up{background:var(--verde-50);color:var(--verde-tinta)} .vv .ritmo.down{background:var(--coral-50);color:var(--coral-tinta)}
.vv .alerta{display:flex;gap:10px;align-items:center;background:var(--ambar-50);border:1px solid var(--ambar);border-radius:var(--r-cartao);padding:10px 14px;margin-top:12px;font-size:13px;color:var(--ambar-tinta);font-weight:700}
.vv .canais{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;margin-bottom:10px}
.vv .canal{border:1px solid var(--linha-forte);background:var(--card);border-radius:var(--r-pilula);padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--tinta-2)}
.vv .canal b{color:var(--tinta);font-variant-numeric:tabular-nums}
.vv .canal.on{background:var(--acao);border-color:var(--acao);color:var(--prod-acao-ink)} .vv .canal.on b{color:var(--prod-acao-ink)}
.vv svg{width:100%;height:auto;display:block;font-family:inherit}
.vv .head{display:grid;gap:10px;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--tinta-3);text-transform:uppercase;padding:0 0 6px;border-bottom:2px solid var(--linha-forte);grid-template-columns:150px 50px 1fr 128px 96px 18px}
.vv .head span.r{text-align:right}
.vv .row{border-bottom:1px solid var(--linha);cursor:pointer} .vv .row:last-child{border-bottom:0}
.vv .row:hover>.cab{background:var(--card-2)}
.vv .hcount{font-size:11px;font-weight:700;color:var(--tinta-3);margin-left:8px;font-variant-numeric:tabular-nums}
.vv .data{font-size:12px;font-weight:700;color:var(--tinta-3)}
.vv .cab{display:grid;gap:10px;align-items:center;padding:9px 0;grid-template-columns:150px 50px 1fr 128px 96px 18px;transition:background .12s}
.vv .num{font-weight:800;font-size:13px;font-variant-numeric:tabular-nums}
.vv .hora{font-size:12px;color:var(--tinta-3);font-variant-numeric:tabular-nums}
.vv .aberta{font-weight:600;color:var(--tinta-3)} /* E3: neutro, nunca pílula */
.vv .itens{font-size:13px;font-weight:600;line-height:1.3}
.vv .itens .mais{color:var(--tinta-3);font-weight:600;font-size:12px}
.vv .st{justify-self:end;font-size:10.5px;font-weight:800;border-radius:var(--r-pilula);padding:3px 10px;letter-spacing:.02em}
.vv .st.aceito{background:var(--acao-50);color:var(--acao-tinta)} .vv .st.preparo{background:var(--ambar-50);color:var(--ambar-tinta)}
.vv .st.entregue{background:var(--verde-50);color:var(--verde-tinta)} .vv .st.cancelado{background:var(--coral-50);color:var(--coral-tinta)}
.vv .st.transferido{background:var(--card-2);color:var(--tinta-2);border:1px solid var(--linha-forte)}
.vv .val{font-weight:800;font-size:13.5px;text-align:right;font-variant-numeric:tabular-nums}
.vv .chev{color:var(--tinta-3);font-size:10px;text-align:right}
.vv .row.cancelado .itens,.vv .row.cancelado .val{text-decoration:line-through;color:var(--tinta-3)}
.vv .row.novo{animation:vvchega 1.6s ease-out 1}
@keyframes vvchega{0%{background:var(--acao-50)}100%{background:transparent}}
.vv .cbadge{font-size:10px;font-weight:800;border-radius:6px;padding:2px 7px;background:var(--card-2);border:1px solid var(--linha);color:var(--tinta-2);margin-left:7px;vertical-align:1px}
.vv .det{background:var(--card-2);border:1px dashed var(--linha-forte);border-radius:var(--r-cartao);margin:7px 0 8px;padding:10px 12px;cursor:default}
.vv .lin{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--linha);font-variant-numeric:tabular-nums}
.vv .sab{color:var(--tinta-3);font-size:11.5px;padding-left:16px}
.vv .bloco{font-size:10px;font-weight:800;letter-spacing:.07em;color:var(--tinta-3);text-transform:uppercase;margin:9px 0 3px}
.vv .tl{display:flex;flex-wrap:wrap;margin-top:4px}
.vv .tl span{font-size:11px;font-weight:700;color:var(--tinta-2);display:flex;align-items:center;font-variant-numeric:tabular-nums}
.vv .tl span em{font-style:normal;color:var(--tinta-3);margin:0 7px;font-size:10px}
.vv .vazio{font-size:12.5px;color:var(--tinta-3);padding:12px 0}
.vv .semana{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;margin-top:4px}
.vv .dia{background:var(--card-2);border:1px solid var(--linha);border-radius:var(--r-cartao);padding:9px 11px}
.vv .dia .d{font-size:10.5px;font-weight:800;color:var(--tinta-3);text-transform:uppercase;letter-spacing:.05em}
.vv .dia b{display:block;font-size:14.5px;font-weight:800;margin-top:3px;font-variant-numeric:tabular-nums}
.vv .dia .ok{display:block;font-size:10px;font-weight:800;color:var(--verde-tinta);margin-top:3px}
.vv .dia .div{display:block;font-size:10px;font-weight:800;color:var(--coral-tinta);margin-top:3px}
.vv .dia .pend{display:block;font-size:10px;font-weight:700;color:var(--tinta-3);margin-top:3px}
.vv .dia.hj{outline:2px solid var(--acao);outline-offset:1px}
.vv .i{width:17px;height:17px;border-radius:50%;border:1px solid var(--linha-forte);background:var(--card-2);color:var(--tinta-3);font-size:11px;font-weight:700;cursor:pointer;vertical-align:2px;margin-left:6px;line-height:1}
.vv .pop{display:block;font-size:11.5px;color:var(--tinta-2);background:var(--card-2);border:1px solid var(--linha);border-radius:var(--r-cartao);padding:8px 11px;margin:6px 0 2px;line-height:1.6;font-weight:400}
.vv .rot{display:none}
@media(max-width:640px){
  .vv{padding:0 0 50px}
  .vv .head{display:none}
  .vv .cab{grid-template-columns:auto 1fr auto;gap:5px 10px;grid-template-areas:"num itens ch" "h stp v"}
  .vv .num{grid-area:num}.vv .itens{grid-area:itens}.vv .chev{grid-area:ch}
  .vv .sH{grid-area:h;display:flex;align-items:center}
  .vv .st{grid-area:stp;justify-self:start;align-self:center}
  .vv .sV{grid-area:v;display:flex;justify-content:flex-end;align-items:center}
  .vv .rot{display:inline;font-size:9px;font-weight:800;letter-spacing:.06em;color:var(--tinta-3);text-transform:uppercase;margin-right:4px}
}
@media(min-width:641px){ .vv .sH,.vv .sV{display:contents} }
`
