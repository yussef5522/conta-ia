'use client'

// ⭐⭐ RECEITAS — lei docs/producao-receitas-referencia.html (v2 APROVADA, R17–R19 + R24, 13/11/2026).
// R17: o catálogo que se vigia — ingredientes, custo/un, validade, última produção; o que falta se
//      declara na linha; filtros são CONTADORES VIVOS (a sujeira vira fila de trabalho).
// R18: a linha abre a ficha ALI MESMO — o que 1 unidade usa, custo, ⚠ no ingrediente sem preço (não
//      trava a soma: "≥"), rodapé "desconta do estoque ao concluir o lote".
// R19: custo por UN ou por KG conforme a receita rende. R24: excluir na ficha, sempre — o SERVIDOR
//      decide (sem lote apaga de vez; com lotes some de tudo) e a confirmação diz os números.
//      Desativar continua só pra sazonal (aparece no filtro Desativadas; excluída não aparece).
// ⚠️ Saíram com a lei v2 (decisão do dono): estrela de principal, "produzir" e "duplicar" na linha.

import { formatBRL } from '@/lib/format/money'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { CSS_COMUM, ChipsDaProducao, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import { fmtQ, fmtVal, rotCusto } from '@/lib/stock/producao/leis-r'
import { casaBusca } from '@/lib/busca-texto'
import { FILTROS_DO_CATALOGO, passaNoFiltro, type Catalogo, type FiltroDoCatalogo, type ReceitaDoCatalogo } from '@/lib/stock/producao/catalogo-regua'

const CSS = `
.rc-busca{display:flex;align-items:center;gap:8px;border:1px solid var(--esc-linha);background:var(--esc-card);border-radius:10px;height:36px;padding:0 12px;min-width:230px}
.rc-busca input{border:0;outline:0;font-size:13px;font-weight:600;color:var(--esc-tinta);font-family:inherit;width:100%;background:transparent}
.rc-busca .lupa{color:var(--esc-tinta3);font-size:13px}
.rc-filtros{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.rc-filtros button{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);border-radius:999px;height:32px;padding:0 13px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.rc-filtros button.on{background:var(--esc-tinta);border-color:var(--esc-tinta);color:var(--esc-on)}
.rc-filtros .n{background:var(--esc-trilho);color:var(--esc-tinta2);border-radius:999px;padding:1px 8px;font-size:10.5px;font-weight:800}
.rc-filtros button.on .n{background:var(--esc-n-on);color:var(--esc-n-on-t)}
.rc-filtros .amb{color:var(--esc-ambar-t)}
.rc-ghead,.rc-grow{display:grid;grid-template-columns:minmax(0,1.5fr) 96px minmax(0,1fr) 104px 120px 52px;gap:12px}
.rc-ghead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.rc-ghead .dir{text-align:right}
.rc-grow{align-items:center;padding:12px 0;border-bottom:1px solid var(--esc-linha2);cursor:pointer;width:100%;background:none;border-left:0;border-right:0;border-top:0;text-align:left;font:inherit;color:inherit}
.rc-grow .rn{font-size:13.5px;font-weight:700}
.rc-grow .ing{font-size:12.5px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.rc-grow .custo{font-size:13px;font-weight:800;text-align:right}
.rc-grow .custo small{font-size:10.5px;font-weight:800;color:var(--esc-tinta3)}
.rc-grow .custo .alerta{display:block;font-size:10px;font-weight:800;color:var(--esc-ambar-t);margin-top:2px}
.rc-grow .val,.rc-grow .up{font-size:12.5px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.rc-amb-t{color:var(--esc-ambar-t);font-weight:800}
.rc-grow .vercel{text-align:right}
.rc-rot2{display:none}
.rc-ficha{border-left:3px solid var(--esc-indigo);background:var(--esc-ficha);border-radius:0 10px 10px 0;margin:2px 0 10px;padding:12px 14px}
.rc-ficha .fhead,.rc-ficha .frow{display:grid;grid-template-columns:minmax(0,1fr) 92px 86px;gap:10px}
.rc-ficha .fhead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:0 0 6px;border-bottom:1px solid var(--esc-linha2)}
.rc-ficha .fhead .dir{text-align:right}
.rc-ficha .frow{align-items:center;padding:7px 0;border-bottom:1px solid var(--esc-trilho);font-size:12.5px}
.rc-ficha .fi{font-weight:700}
.rc-ficha .fq{font-weight:700;color:var(--esc-tinta2);text-align:right}
.rc-ficha .fc{font-weight:800;text-align:right}
.rc-ficha .ftot{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid var(--esc-linha2);margin-top:2px;padding-top:9px;font-size:12.5px;font-weight:800}
.rc-ficha .ftot .rot{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase}
.rc-ficha .fnota{font-size:11px;font-weight:700;color:var(--esc-tinta3);margin-top:8px}
.rc-ficha .fbts{display:flex;gap:8px;margin-top:11px;flex-wrap:wrap}
.rc-ficha .fbts .rx-btn.perigo{margin-left:auto}
.rc-confirma{border-left:3px solid var(--esc-perigo);background:var(--esc-perigo-bg);border-radius:0 10px 10px 0;margin:10px 0 0;padding:12px 14px}
.rc-confirma .ct{font-size:13.5px;font-weight:800;margin-bottom:5px}
.rc-confirma .cx{font-size:12.5px;font-weight:600;color:var(--esc-tinta2);line-height:1.55}
.rc-confirma .cbts{display:flex;gap:8px;margin-top:11px}
.rc-rever{display:inline-block;margin-top:9px;border-radius:8px;padding:5px 10px;font-size:11.5px;font-weight:800;color:var(--esc-ambar-t);background:var(--esc-ambar50);text-decoration:none}
.rc-msg{font-size:12.5px;font-weight:700;color:var(--esc-verde-t);background:var(--esc-verde50);border-radius:10px;padding:9px 12px;margin-bottom:14px}
@media (max-width:760px){
  .rc-ghead{display:none}
  .rc-rot2{display:inline;font-size:10px;font-weight:800;letter-spacing:.05em;color:var(--esc-tinta3);text-transform:uppercase}
  .rc-grow{grid-template-columns:minmax(0,1fr) 104px;grid-template-areas:"rn custo" "meta meta";row-gap:6px}
  .rc-grow .rn{grid-area:rn}
  .rc-grow .custo{grid-area:custo}
  .rc-grow .metawrap{grid-area:meta;display:flex;gap:12px;flex-wrap:wrap}
  .rc-grow .ing,.rc-grow .val,.rc-grow .up{text-align:left}
  .rc-grow .vercel{display:none}
  .rc-busca{min-width:0;width:100%}
}
@media (min-width:761px){ .rc-grow .metawrap{display:contents} }
`

const ROTULO: Record<FiltroDoCatalogo, { rot: string; amb?: boolean }> = {
  TODAS: { rot: 'Todas' },
  SEM_VALIDADE: { rot: '⚠ Sem validade', amb: true },
  CUSTO_INCOMPLETO: { rot: '⚠ Custo incompleto', amb: true },
  NUNCA_PRODUZIDAS: { rot: 'Nunca produzidas' },
  DESATIVADAS: { rot: 'Desativadas' },
}

/** a rota (API) que diz quais receitas esperam o rendimento — leitura, nunca link pra tela-fila aposentada */
const rotaDaConversao = (empresaId: string) => `/api/empresas/${empresaId}/estoque/fichas/conversao`

const qtdDaDose = (q: number) => (q >= 1 ? fmtQ(Math.round(q * 10) / 10) : String(Math.round(q * 1000) / 1000).replace('.', ','))

interface Previa { caso: 'EXCLUI' | 'DESATIVA'; lotes: number; frase: string }

function Ficha({ r, empresaId, aoMudar, esperam }: { r: ReceitaDoCatalogo; empresaId: string; aoMudar: (msg: string) => void; esperam: Record<string, string> }) {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const base = `/api/empresas/${empresaId}/estoque/fichas/${r.fichaId}`
  const cp = { custo: r.custo ?? 0, completo: r.completo }

  async function gesto(fn: () => Promise<Response>, ok: (j: { efeito?: string }) => string) {
    setOcupado(true); setErro(null)
    try {
      const resp = await fn()
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) { setErro(j.erro ?? 'Não consegui gravar — nada mudou.'); return }
      aoMudar(ok(j))
    } catch { setErro('Não consegui falar com o servidor — nada mudou.') } finally { setOcupado(false) }
  }

  return (
    <div className="rc-ficha" data-testid="ficha-aberta">
      <div className="fhead"><span>{r.porUnidade ? `1 ${r.un} usa` : `1 receita-base (${r.base}) usa`}</span><span className="dir">Quantidade</span><span className="dir">Custo</span></div>
      {r.ingredientes.length === 0 && <div className="frow"><span className="fi rc-amb-t">⚠ receita sem ingrediente</span><span /><span /></div>}
      {r.ingredientes.map((i, k) => (
        <div key={k} className="frow">
          <span className="fi">{i.nome}{i.custo == null && <> <span className="rc-amb-t">⚠ sem preço</span></>}</span>
          <span className="fq num">{qtdDaDose(i.qtd)} {i.unidade}</span>
          <span className="fc num">{i.custo != null ? formatBRL(i.custo) : '—'}</span>
        </div>
      ))}
      <div className="ftot"><span className="rot">custo por {r.porUnidade ? r.un : 'receita-base'}</span>
        <span className="num">{r.custo == null ? 'sem preço nos ingredientes' : rotCusto(cp, r.porUnidade ? r.un : 'receita').replace(/\/\S+$/, '')}</span></div>
      <div className="fnota">
        validade {fmtVal(r.validadeDias) ?? '—'} · desconta do estoque ao concluir o lote
        {!r.porUnidade && ' · rendimento ainda não medido — por isso a ficha mostra a receita-base, não 1 unidade'}
      </div>
      {/* ⭐ a MAÇANETA da conversão (12/09 → 13/11): a pendência DESTA receita, com o gesto que a resolve */}
      {esperam[r.fichaId] && (<a className="rc-rever" href={`/empresas/${empresaId}/estoque/producao/receitas/${r.fichaId}?foco=rendimento&voltar=${encodeURIComponent(`/empresas/${empresaId}/estoque/producao/receitas`)}`} style={{ border: '1px solid var(--esc-ambar)' }}>⚠ {esperam[r.fichaId]} · rever o rendimento →</a>)}
      {erro && <div className="fnota rc-amb-t" role="alert">{erro}</div>}
      <div className="fbts">
        <a className="rx-btn pri" href={`/empresas/${empresaId}/estoque/producao/receitas/${r.fichaId}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>editar receita</a>
        {r.ativa
          ? <button type="button" className="rx-btn" disabled={ocupado} onClick={() => gesto(() => fetch(base, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativo: false }) }), () => `"${r.nome}" desativada — volta no filtro Desativadas.`)}>desativar</button>
          : <button type="button" className="rx-btn" disabled={ocupado} onClick={() => gesto(() => fetch(base, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativo: true }) }), () => `"${r.nome}" reativada.`)}>reativar</button>}
        <button type="button" className="rx-btn perigo" disabled={ocupado} data-testid="excluir-receita"
          onClick={async () => {
            setErro(null)
            try { const resp = await fetch(base, { method: 'OPTIONS' }); const j = await resp.json(); if (!resp.ok) throw new Error(j.erro); setPrevia(j) } catch (e) { setErro(e instanceof Error && e.message ? e.message : 'Não consegui ler a história desta receita.') }
          }}>excluir receita</button>
      </div>
      {previa && (
        <div className="rc-confirma" data-testid="confirma-excluir-receita">
          <div className="ct">Excluir {r.nome}?</div>
          <div className="cx num">{previa.frase}</div>
          <div className="cbts">
            <button type="button" className="rx-btn mata" disabled={ocupado}
              onClick={() => gesto(() => fetch(`${base}?prometido=${previa.caso}`, { method: 'DELETE' }), (j) => j.efeito ?? `"${r.nome}" excluída.`)}>excluir</button>
            <button type="button" className="rx-btn" onClick={() => setPrevia(null)}>cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReceitasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cat, setCat] = useState<Catalogo | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [filtro, setFiltro] = useState<FiltroDoCatalogo>('TODAS')
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  /** ⭐ quais receitas esperam o rendimento do dono — fail-soft: sem isso a lista abre igual (nunca sem a lista) */
  const [esperam, setEsperam] = useState<Record<string, string>>({})

  const ler = useCallback(async () => {
    try { setCat(await lerJson<Catalogo>(`/api/empresas/${id}/estoque/producao/catalogo-receitas`)); setFalhou(false) } catch { setFalhou(true) }
  }, [id])
  useEffect(() => { ler() }, [ler])
  useEffect(() => {
    lerJson<{ esperamRendimento?: { fichaId: string; porQue: string }[] }>(rotaDaConversao(id))
      .then((j) => setEsperam(Object.fromEntries((j.esperamRendimento ?? []).map((e) => [e.fichaId, e.porQue]))))
      .catch(() => setEsperam({}))
  }, [id])

  // ⭐ a MESMA função que o servidor usou pra contar é a que filtra (contador que mente é pior que nenhum)
  const lista = useMemo(() => (cat?.receitas ?? []).filter((r) => passaNoFiltro(r, filtro) && (!busca.trim() || casaBusca(r.nome, busca))), [cat, filtro, busca])

  return (
    <div className="rx -m-4 p-4 lg:-m-6 lg:p-6" data-tela="producao-receitas">
      <style>{CSS_COMUM + CSS}</style>
      <main className="rx-wrap">
        <header className="rx-top">
          <h1>Produção</h1>
          <label className="rc-busca"><span className="lupa" aria-hidden>⌕</span>
            <input aria-label="buscar receita" placeholder="buscar receita" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        </header>
        <ChipsDaProducao empresaId={id} aba="receitas" />
        {falhou && <FalhouDeLer oQue="as receitas" onTentar={ler} />}
        {msg && <div className="rc-msg" role="status">{msg}</div>}
        {cat && (
          <div className="rc-filtros" data-testid="filtros-contadores">
            {FILTROS_DO_CATALOGO.map((f) => (
              <button key={f} type="button" className={filtro === f ? 'on' : undefined} onClick={() => { setFiltro(f); setAberta(null) }}>
                <span className={ROTULO[f].amb && filtro !== f ? 'amb' : undefined}>{ROTULO[f].rot}</span><span className="n num">{cat.contadores[f]}</span>
              </button>
            ))}
          </div>
        )}
        {!cat && !falhou && <div className="rx-vazio">lendo as receitas…</div>}
        {cat && (
          <div className="rx-card">
            <div className="rx-chead">Catálogo · {cat.contadores.TODAS} receitas
              <Info>A linha abre a ficha: o que 1 unidade usa e desconta do estoque ao concluir o lote. Ingrediente sem preço não trava a soma dos outros — o custo vira &quot;≥&quot; com aviso. Excluir receita nunca produzida apaga de vez; com lotes na história, ela some do catálogo e das ordens, e os lotes antigos continuam certos.</Info>
              <span className="sp" /><a href={`/empresas/${id}/estoque/producao/receitas/nova`}>nova receita →</a>
            </div>
            <div className="rc-ghead"><span>Receita</span><span className="dir">Ingredientes</span><span className="dir">Custo</span><span className="dir">Validade</span><span className="dir">Última produção</span><span /></div>
            {lista.length === 0 && <div className="rx-vazio">{busca.trim() ? `Nenhuma receita com “${busca.trim()}” neste filtro.` : 'Nenhuma receita neste filtro.'}</div>}
            {lista.map((r) => {
              const val = fmtVal(r.validadeDias)
              return (
                <div key={r.fichaId}>
                  <button type="button" className="rc-grow" data-testid="linha-receita" aria-expanded={aberta === r.fichaId} onClick={() => setAberta(aberta === r.fichaId ? null : r.fichaId)}>
                    <div className="rn">{r.nome}</div>
                    <div className="metawrap">
                      <div className="ing num">{r.ingredientes.length}<span className="rc-rot2"> ing</span></div>
                      <div className="custo num">
                        {r.custo == null ? <span className="rc-amb-t">sem preço</span> : <>{r.completo ? '' : '≥ '}{formatBRL(r.custo)} <small>/{r.porUnidade ? r.un : 'receita'}</small></>}
                        {!r.completo && r.faltam > 0 && <span className="alerta">⚠ {r.faltam} sem preço</span>}
                      </div>
                      <div className="val num">{val ?? <span className="rc-amb-t">⚠ sem validade</span>}</div>
                      <div className="up num">{r.ultimaProducao ?? <span className="rc-amb-t">nunca produzida</span>}</div>
                    </div>
                    <div className="vercel"><span className="rx-ver">{aberta === r.fichaId ? 'fechar' : 'abrir →'}</span></div>
                  </button>
                  {aberta === r.fichaId && <Ficha r={r} empresaId={id} esperam={esperam} aoMudar={(m) => { setMsg(m); setAberta(null); ler() }} />}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
