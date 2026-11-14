'use client'

// ⭐⭐ AO VIVO — lei docs/producao-ao-vivo-referencia.html (v3 APROVADA, R1–R8, 13/11/2026).
// R2: duas perguntas, nesta ordem — quem tá na mão agora? · o que acabou de acontecer? Nenhum KPI do
// Painel, nenhum pódio. R3: tempo contra a mediana da MESMA etapa, âmbar só > 1,5×, barra trava em 100%.
// R4: < 30s = "tempo não mediu", sem barra. R5/R6 VETADAS (nada de validade nem previsão aqui).
// R7: concluídas com a mesma língua visual + pulso do dia. Atualiza a cada 30s pela leitura LEVE.

import { use, useCallback, useEffect, useState } from 'react'
import { CSS_COMUM, ChipsDaProducao, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import { fmtDur, iniciais } from '@/lib/stock/producao/leis-r'
import type { AoVivo } from '@/lib/stock/producao/ao-vivo'

const CSS = `
.av-agora{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--esc-tinta2)}
.av-agora .dot{width:8px;height:8px;border-radius:50%;background:var(--esc-verde);animation:avpulsa 2s infinite}
@keyframes avpulsa{0%{box-shadow:0 0 0 0 rgba(14,159,110,.45)}70%{box-shadow:0 0 0 7px rgba(14,159,110,0)}100%{box-shadow:0 0 0 0 rgba(14,159,110,0)}}
.av-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;align-items:start}
.av-lhead,.av-mao{display:grid;grid-template-columns:34px minmax(0,1.5fr) 72px minmax(0,1fr);gap:12px}
.av-lhead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.av-lhead .dir{text-align:right}
.av-mao{align-items:center;padding:12px 0;border-bottom:1px solid var(--esc-linha2)}
.av-mao:last-child{border-bottom:0}
.av-mao.tarefa{border-left:3px solid var(--esc-roxo);padding-left:10px;margin-left:-13px}
.av-mao .prod{font-size:14px;font-weight:700}
.av-mao .prod a:hover{text-decoration:underline}
.av-mao .sub{font-size:12px;color:var(--esc-tinta2);font-weight:600;margin-top:2px}
.av-mao .ini{font-size:12px;color:var(--esc-tinta3);font-weight:700;text-align:right}
.av-mao .ini b{display:block;color:var(--esc-tinta2);font-size:12.5px}
.av-tempo .t{font-size:19px;font-weight:800;letter-spacing:-.01em}
.av-tempo.ambar .t{color:var(--esc-ambar)}
.av-tempo .med{font-size:11px;color:var(--esc-tinta3);font-weight:700;margin-top:2px}
.av-tempo .chip-a{display:inline-block;background:var(--esc-ambar50);color:var(--esc-ambar-t);border-radius:6px;padding:1px 7px;font-size:10px;font-weight:800;margin-left:6px;vertical-align:2px}
.av-tempo.ambar .rx-bar i{background:var(--esc-ambar)}
.av-pulso{position:relative;height:46px;margin:10px 2px 6px}
.av-pulso .eixo{position:absolute;left:0;right:0;top:15px;height:2px;background:var(--esc-trilho);border-radius:2px}
.av-pulso .pt{position:absolute;top:10px;width:12px;height:12px;border-radius:50%;background:var(--esc-indigo);border:2px solid var(--esc-card);box-shadow:0 0 0 1px var(--esc-pt-borda);transform:translateX(-50%)}
.av-pulso .pt.conf{background:var(--esc-verde)}
.av-pulso .hr{position:absolute;top:31px;font-size:9.5px;font-weight:800;color:var(--esc-tinta3);transform:translateX(-50%)}
.av-ev{display:grid;grid-template-columns:36px minmax(0,1fr) minmax(0,104px);gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--esc-linha2)}
.av-ev:last-child{border-bottom:0}
.av-ev.slim{grid-template-columns:36px minmax(0,1fr)}
.av-ev.slim .txt{font-size:12px;font-weight:600;color:var(--esc-tinta2)}
.av-ev.slim .txt b{color:var(--esc-tinta)}
.av-ev.slim .vok{color:var(--esc-verde-t);font-weight:800}
.av-avt2{width:28px;height:28px;border-radius:50%;background:var(--esc-indigo50);color:var(--esc-indigo-t);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;margin:0 auto}
.av-ev .h{font-size:9.5px;font-weight:800;color:var(--esc-tinta3);text-align:center;margin-top:3px}
.av-ev .prod{font-size:13px;font-weight:700}
.av-ev .sub{font-size:11.5px;color:var(--esc-tinta2);font-weight:600;margin-top:1px}
.av-chip-v,.av-chip-m{display:inline-block;border-radius:6px;padding:1px 7px;font-size:10px;font-weight:800;margin-top:4px;margin-right:4px;white-space:nowrap}
.av-chip-v{background:var(--esc-verde50);color:var(--esc-verde-t)}
.av-chip-m{background:var(--esc-ambar50);color:var(--esc-ambar-t)}
.av-t2{text-align:right}
.av-t2 .t{font-size:16.5px;font-weight:800;letter-spacing:-.01em}
.av-t2.ambar .t{color:var(--esc-ambar)}
.av-t2 .med{font-size:10.5px;color:var(--esc-tinta3);font-weight:700;margin-top:1px}
.av-t2 .rx-bar{margin-left:auto;max-width:104px}
.av-t2.ambar .rx-bar i{background:var(--esc-ambar)}
@media (max-width:760px){
  .av-grid{grid-template-columns:minmax(0,1fr)}
  .av-lhead{display:none}
  .av-mao{grid-template-columns:34px minmax(0,1fr) minmax(0,92px);grid-template-areas:"av oq tempo" "av ini tempo"}
  .av-mao .rx-avt{grid-area:av}
  .av-mao .oq{grid-area:oq}
  .av-mao .ini{grid-area:ini;text-align:left;display:flex;gap:5px}
  .av-mao .ini b{display:inline}
  .av-mao .av-tempo{grid-area:tempo;text-align:right}
  .av-mao .rx-bar{margin-left:auto;max-width:92px}
}
`

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
function rotuloDoAgora(iso: string, dia: string) {
  const hh = new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  const d = new Date(`${dia}T12:00:00.000Z`)
  return `agora ${hh} · ${DIAS[d.getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

export default function AoVivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [dado, setDado] = useState<AoVivo | null>(null)
  const [falhou, setFalhou] = useState(false)

  const ler = useCallback(async () => {
    try {
      setDado(await lerJson<AoVivo>(`/api/empresas/${id}/estoque/producao/ao-vivo`)); setFalhou(false)
    } catch { setFalhou(true) }
  }, [id])

  useEffect(() => {
    ler()
    const t = setInterval(ler, 30_000) // ⭐ 30s, leitura leve (dia + em andamento)
    return () => clearInterval(t)
  }, [ler])

  return (
    <div className="rx -m-4 p-4 lg:-m-6 lg:p-6" data-tela="producao-ao-vivo">
      <style>{CSS_COMUM + CSS}</style>
      <main className="rx-wrap">
        <header className="rx-top">
          <h1>Produção</h1>
          {dado && <div className="av-agora num"><span className="dot" /> {rotuloDoAgora(dado.agora, dado.dia)}</div>}
        </header>
        <ChipsDaProducao empresaId={id} aba="ao-vivo" />
        {falhou && <FalhouDeLer oQue="a produção ao vivo" onTentar={ler} />}
        {!dado && !falhou && <div className="rx-vazio">lendo a produção…</div>}
        {dado && (
          <div className="av-grid">
            <section>
              <div className="rx-card" data-testid="na-mao-agora">
                <div className="rx-chead">Na mão agora <span className="n num">{dado.naMao.length}</span>
                  <Info>O tempo de cada etapa é comparado com a mediana da própria etapa (mínimo 5 medições). Fica âmbar só acima de 1,5× a mediana. Conclusões em menos de 30 segundos não entram na mediana.</Info>
                  <span className="sp" /><a href={`/cozinha/${id}`}>abrir janela da cozinha →</a>
                </div>
                <div className="av-lhead"><span /><span>Quem · o quê</span><span className="dir">Começou</span><span className="dir">Tempo</span></div>
                {dado.naMao.length === 0 && <div className="rx-vazio">Ninguém com etapa em andamento agora.</div>}
                {dado.naMao.map((r) => (
                  <div key={r.etapaId} className={`av-mao${r.ehTarefa ? ' tarefa' : ''}`}>
                    <div className="rx-avt">{iniciais(r.quem)}</div>
                    <div className="oq"><div className="prod">{r.ehTarefa ? <><span className="rx-badge-t">TAREFA</span>{r.oQue}</> : <a href={`/empresas/${id}/estoque/producao/${r.ordemId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.oQue}</a>}</div><div className="sub">{r.sub}</div></div>
                    <div className="ini num">começou <b>{r.comecou}</b></div>
                    <div className={`av-tempo ${r.cor} num`}>
                      <span className="t">{fmtDur(r.seg)}</span>{r.cor === 'ambar' && <span className="chip-a">acima do normal</span>}{r.atrasada && <span className="chip-a" data-testid="rotina-atrasada">atrasada</span>}
                      <div className="med">{r.medSeg != null ? `mediana ${fmtDur(r.medSeg)}` : 'ainda sem mediana'}</div>
                      {r.pct != null && <div className="rx-bar"><i style={{ width: `${r.pct}%` }} /></div>}
                    </div>
                  </div>
                ))}
                {/* ⭐ R27 (Rotinas, 13/11) — rotina de hoje que passou do "até" sem ninguém com ela na mão: âmbar, nunca vermelho */}
                {dado.rotinasAtrasadas.map((r) => (
                  <div key={r.tarefaId} className="av-mao tarefa" data-testid="rotina-atrasada-fora">
                    <div className="rx-avt">{r.quem === 'livre' ? '—' : iniciais(r.quem)}</div>
                    <div className="oq"><div className="prod"><span className="rx-badge-t">TAREFA</span>{r.oQue}</div><div className="sub num">rotina · {r.quem} · {r.progresso}</div></div>
                    <div className="ini num">até <b>{r.limite}</b></div>
                    <div className="av-tempo ambar num"><span className="chip-a" data-testid="rotina-atrasada">atrasada</span></div>
                  </div>
                ))}
              </div>
            </section>
            <aside>
              <div className="rx-card" data-testid="concluidas-hoje">
                <div className="rx-chead">Concluídas hoje <span className="n num">{dado.concluidas}</span></div>
                {dado.eventos.length > 0 && (
                  <div className="av-pulso" data-testid="pulso-do-dia">
                    <div className="eixo" />
                    {dado.pulso.marcas.map((m, k) => (
                      <span key={k} className="hr num" style={{ left: `${m.pos}%`, transform: m.pos === 0 ? 'translateX(0)' : m.pos === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{m.rot}</span>
                    ))}
                    {dado.pulso.pontos.map((p, k) => <span key={k} className={`pt${p.tipo === 'conferiu' ? ' conf' : ''}`} style={{ left: `${p.pos}%` }} />)}
                  </div>
                )}
                {dado.eventos.length === 0 && <div className="rx-vazio">Nada concluído hoje ainda.</div>}
                {dado.eventos.map((e) => e.tipo === 'conferiu' ? (
                  <div key={e.id} className="av-ev slim">
                    <div><div className="av-avt2">{iniciais(e.quem)}</div><div className="h num">{e.hhmm}</div></div>
                    <div className="txt"><b>{e.quem}</b> · conferiu <b>{e.oQue}</b> <span className="vok">✓</span></div>
                  </div>
                ) : (
                  <div key={e.id} className="av-ev">
                    <div><div className="av-avt2">{iniciais(e.quem)}</div><div className="h num">{e.hhmm}</div></div>
                    <div className="oq">
                      <div className="prod">{e.tipo === 'tarefa' && <span className="rx-badge-t">TAREFA</span>}{e.oQue}</div>
                      <div className="sub">{e.sub}</div>
                      {e.aguardaConferencia && <span className="av-chip-v">aguarda conferência</span>}
                      {e.mentira && <span className="av-chip-m">tempo não mediu</span>}
                      {e.semTempo && <span className="av-chip-m">finalizada pelo gerente</span>}
                    </div>
                    <div className={`av-t2 ${e.cor} num`}>
                      <span className="t">{e.seg != null ? fmtDur(e.seg) : '·'}</span>
                      <div className="med">{e.medSeg != null ? `mediana ${fmtDur(e.medSeg)}` : 'sem mediana'}</div>
                      {e.pct != null && <div className="rx-bar"><i style={{ width: `${e.pct}%` }} /></div>}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
