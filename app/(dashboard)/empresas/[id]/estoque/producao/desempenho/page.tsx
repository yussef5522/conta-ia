'use client'

// ⭐⭐ DESEMPENHO — lei docs/producao-desempenho-referencia.html (v2 APROVADA, R9–R16, 13/11/2026).
// R9: Pessoas · Receitas; período Hoje · 7 dias · 30 dias · qualquer dia (input de data nativo); o
//     título do bloco repete o período. Sem faixa de KPI, sem pódio: a lista ordenada É o ranking.
// R10: nunca soma UN de produtos diferentes nem UN com KG. R11: barra em ESCALA ÚNICA (maior = 100%).
// R12: rendimento contra 70–130% com "N fora". R13: escritório/aparelho em "fora da comparação".
// R14: cada receita na sua unidade. R15: custo real × ficha, > 10% âmbar. R16: todo número tem "ver →".

import { formatBRL } from '@/lib/format/money'
import { use, useCallback, useEffect, useState } from 'react'
import { CSS_COMUM, ChipsDaProducao, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import { custoFlag, fmtDur, fmtH, fmtQ, iniciais, motivoDeFora, rendCor, rotuloPeriodo, type Periodo } from '@/lib/stock/producao/leis-r'
import type { Desempenho, LinhaPessoa } from '@/lib/stock/producao/desempenho-da-producao'

const CSS = `
.dp-per{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dp-per button{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);border-radius:999px;height:30px;padding:0 13px;font-size:12px;font-weight:800;cursor:pointer}
.dp-per button.on{background:var(--esc-tinta);border-color:var(--esc-tinta);color:var(--esc-on)}
.dp-per input[type=date]{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);border-radius:999px;height:30px;padding:0 11px;font-size:12px;font-weight:800;font-family:inherit}
.dp-per input.on{background:var(--esc-tinta);border-color:var(--esc-tinta);color:var(--esc-on);color-scheme:dark}
.dp-abas{display:inline-flex;background:var(--esc-abas);border-radius:11px;padding:3px;margin-bottom:14px}
.dp-abas button{border:0;background:transparent;color:var(--esc-tinta2);border-radius:8px;height:32px;padding:0 18px;font-size:12.5px;font-weight:800;cursor:pointer}
.dp-abas button.on{background:var(--esc-card);color:var(--esc-tinta);box-shadow:0 1px 3px rgba(10,15,30,.12)}
.dp .rx-bar{height:5px;background:var(--esc-trilho2);margin-top:4px}
.dp-phead,.dp-prow{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 66px minmax(0,1fr) 92px 46px;gap:12px}
.dp-phead,.dp-rhead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.dp-phead .dir,.dp-rhead .dir{text-align:right}
.dp-prow{align-items:center;padding:11px 0;border-bottom:1px solid var(--esc-linha2)}
.dp-prow .quem{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:700}
.dp-prow .rx-avt{width:30px;height:30px;font-size:11.5px}
.dp-prow .cv{font-size:14px;font-weight:800}
.dp-prow .tar{font-size:13px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.dp-prow .rit{text-align:right}
.dp-prow .rit .v{font-size:14px;font-weight:800}
.dp-prow .rit .st{display:block;font-size:10px;font-weight:800;color:var(--esc-ambar-t);margin-top:2px}
.dp-vercel{text-align:right}
.dp-fora{font-size:11.5px;font-weight:700;color:var(--esc-tinta3);padding:10px 0 2px}
.dp-fora b{color:var(--esc-tinta2)}
.dp-rot,.dp-rot2,.dp-tar-m{display:none}
.dp-rhead,.dp-rrow{display:grid;grid-template-columns:minmax(0,1.35fr) 52px minmax(0,1fr) minmax(0,1.15fr) 88px minmax(0,1.05fr) 46px;gap:12px}
.dp-rrow{align-items:center;padding:11px 0;border-bottom:1px solid var(--esc-linha2)}
.dp-rrow .rn{font-size:13.5px;font-weight:700}
.dp-rrow .lot{font-size:13.5px;font-weight:800;text-align:right}
.dp-rrow .pf{font-size:12.5px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.dp-rrow .pf b{color:var(--esc-tinta);font-weight:800}
.dp-rrow .pf small,.dp-rrow .mini{font-size:10.5px;font-weight:800;color:var(--esc-tinta3)}
.dp-rrow .tmed{font-size:13.5px;font-weight:800;text-align:right}
.dp-rrow .custo{font-size:12.5px;font-weight:800;text-align:right}
.dp-rrow .custo small{display:block;font-size:10.5px;font-weight:700;color:var(--esc-tinta3);margin-top:1px}
.dp-rrow .custo.ambar{color:var(--esc-ambar)}
.dp-rend .v{font-size:13px;font-weight:800}
.dp-rend .fora-n{font-size:10px;font-weight:800;color:var(--esc-ambar-t);margin-left:5px}
.dp-rend.ambar .v{color:var(--esc-ambar)}
.dp-gau{position:relative;height:6px;border-radius:99px;background:var(--esc-trilho2);margin-top:5px;overflow:hidden}
.dp-gau .faixa{position:absolute;top:0;bottom:0;left:50%;width:42.9%;background:var(--esc-faixa)}
.dp-gau .fill{position:absolute;top:0;bottom:0;left:0;background:var(--esc-indigo);border-radius:99px}
.dp-rend.ambar .dp-gau .fill{background:var(--esc-ambar)}
.dp-tras{background:var(--esc-ficha);border-left:3px solid var(--esc-indigo);border-radius:0 10px 10px 0;margin:2px 0 10px;padding:8px 12px;font-size:12px;font-weight:600;color:var(--esc-tinta2)}
.dp-tras div{display:flex;gap:10px;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--esc-trilho)}
.dp-tras div:last-child{border-bottom:0}
.dp-tras b{color:var(--esc-tinta)}
.dp-tras .amb{color:var(--esc-ambar-t);font-weight:800}
@media (max-width:760px){
  .dp-phead,.dp-rhead{display:none}
  .dp-prow{grid-template-columns:minmax(0,1fr) 92px;grid-template-areas:"quem rit" "lotes lotes" "horas horas";row-gap:7px}
  .dp-prow .quem{grid-area:quem}
  .dp-prow .rit{grid-area:rit}
  .dp-prow .c-lotes{grid-area:lotes}
  .dp-prow .c-horas{grid-area:horas}
  .dp-prow .tar{display:none}
  .dp-prow .dp-vercel{grid-column:1 / -1;text-align:left}
  .dp-tar-m{display:inline;font-size:11.5px;font-weight:700;color:var(--esc-tinta3)}
  .dp-rot,.dp-rot2{display:inline;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;margin-right:6px}
  .dp-rrow{grid-template-columns:minmax(0,1fr) 104px;grid-template-areas:"rn custo" "pf pf" "rend rend" "ver ver";row-gap:7px}
  .dp-rrow .rn{grid-area:rn}
  .dp-rrow .custo{grid-area:custo}
  .dp-rrow .pfwrap{grid-area:pf;display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
  .dp-rrow .pf,.dp-rrow .lot,.dp-rrow .tmed{text-align:left}
  .dp-rrow .dp-rend{grid-area:rend}
  .dp-rrow .dp-vercel{grid-area:ver;text-align:left}
}
@media (min-width:761px){ .dp-rrow .pfwrap{display:contents} }
`

const URL_PERIODO = (p: Periodo) => p.tipo === 'dia' ? `periodo=dia&dia=${p.dia}` : `periodo=${p.tipo}`

function LinhaDaPessoa({ p, aberta, abrir }: { p: LinhaPessoa; aberta: boolean; abrir: () => void }) {
  return (
    <>
      <div className="dp-prow" data-testid="linha-pessoa">
        <div className="quem"><span className="rx-avt">{iniciais(p.quem)}</span><span>{p.quem}<span className="dp-tar-m num"> · {p.tarefas} tarefa{p.tarefas === 1 ? '' : 's'}</span></span></div>
        <div className="cv num c-lotes"><span className="dp-rot">Lotes</span>{p.lotes}
          <div className="rx-bar"><i style={{ width: `${p.barLotes}%` }} /></div></div>
        <div className="tar num">{p.tarefas}</div>
        <div className="cv num c-horas"><span className="dp-rot">Horas</span>{fmtH(p.min)}
          <div className="rx-bar"><i style={{ width: `${p.barMin}%` }} /></div></div>
        <div className="rit num"><span className="v">{p.ritmo != null ? `${p.ritmo}%` : '—'}</span>{p.semTempo > 0 && <span className="st">{p.semTempo} sem tempo</span>}</div>
        <div className="dp-vercel"><button type="button" className="rx-ver" onClick={abrir}>{aberta ? 'fechar' : 'ver →'}</button></div>
      </div>
      {aberta && (
        <div className="dp-tras" data-testid="por-tras-pessoa">
          {p.etapas.length === 0 && <div>nenhuma etapa concluída no período</div>}
          {p.etapas.map((e, k) => (
            <div key={k}><span className="num">{e.quando}</span><span><b>{e.ehTarefa ? 'TAREFA · ' : ''}{e.oQue}</b>{e.ehTarefa ? '' : ` · ${e.etapa}`}</span>
              <span className={`num${e.mentira || e.seg == null ? ' amb' : ''}`}>{e.seg == null ? 'sem tempo' : e.mentira ? `${fmtDur(e.seg)} · não mediu` : fmtDur(e.seg)}</span></div>
          ))}
        </div>
      )}
    </>
  )
}

export default function DesempenhoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: '7d' })
  const [aba, setAba] = useState<'pessoas' | 'receitas'>('pessoas')
  const [dado, setDado] = useState<Desempenho | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)

  const ler = useCallback(async () => {
    try {
      setDado(await lerJson<Desempenho>(`/api/empresas/${id}/estoque/producao/desempenho?${URL_PERIODO(periodo)}`)); setFalhou(false)
    } catch { setFalhou(true) }
  }, [id, periodo])
  useEffect(() => { setDado(null); setAberta(null); ler() }, [ler])

  const rot = dado ? rotuloPeriodo(dado.periodo) : rotuloPeriodo(periodo)

  return (
    <div className="rx dp -m-4 p-4 lg:-m-6 lg:p-6" data-tela="producao-desempenho">
      <style>{CSS_COMUM + CSS}</style>
      <main className="rx-wrap">
        <header className="rx-top">
          <h1>Produção</h1>
          <div className="dp-per" data-testid="periodo">
            {(['hoje', '7d', '30d'] as const).map((t) => (
              <button key={t} type="button" className={periodo.tipo === t ? 'on' : undefined} onClick={() => setPeriodo({ tipo: t })}>{t === 'hoje' ? 'Hoje' : t === '7d' ? '7 dias' : '30 dias'}</button>
            ))}
            <input type="date" aria-label="escolher dia" className={periodo.tipo === 'dia' ? 'on' : undefined}
              value={periodo.tipo === 'dia' ? periodo.dia : ''}
              onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setPeriodo({ tipo: 'dia', dia: e.target.value, rot: e.target.value }) }} />
          </div>
        </header>
        <ChipsDaProducao empresaId={id} aba="desempenho" />
        <div className="dp-abas">
          <button type="button" className={aba === 'pessoas' ? 'on' : undefined} onClick={() => { setAba('pessoas'); setAberta(null) }}>Pessoas</button>
          <button type="button" className={aba === 'receitas' ? 'on' : undefined} onClick={() => { setAba('receitas'); setAberta(null) }}>Receitas</button>
        </div>
        {falhou && <FalhouDeLer oQue="o desempenho" onTentar={ler} />}
        {!dado && !falhou && <div className="rx-vazio">lendo o desempenho…</div>}

        {dado && aba === 'pessoas' && (
          <section className="rx-card" data-testid="aba-pessoas">
            <div className="rx-chead">Quem fez o quê · <span>{rot}</span>
              <Info>NO RITMO = % das etapas concluídas em até 1,25× a mediana da própria etapa. Conclusões de menos de 30 segundos não contam no ritmo nem nas horas — aparecem como &quot;sem tempo&quot;. Unidades de produtos diferentes nunca se somam.</Info>
            </div>
            <div className="dp-phead"><span>Pessoa</span><span>Lotes</span><span className="dir">Tarefas</span><span>Horas medidas</span><span className="dir">No ritmo</span><span /></div>
            {dado.pessoas.length === 0 && <div className="rx-vazio">Nenhum lote nem tarefa concluída da cozinha neste período.</div>}
            {dado.pessoas.map((p) => (
              <LinhaDaPessoa key={p.colaboradorId} p={p}
                aberta={aberta === p.colaboradorId} abrir={() => setAberta(aberta === p.colaboradorId ? null : p.colaboradorId)} />
            ))}
            {dado.fora.length > 0 && (
              <div className="dp-fora" data-testid="fora-da-comparacao">
                fora da comparação: {dado.fora.map((f, k) => (
                  <span key={f.colaboradorId}>{k > 0 && ' · '}<b>{f.quem}</b> · {f.lotes} lote{f.lotes === 1 ? '' : 's'}{f.tarefas ? ` e ${f.tarefas} tarefa${f.tarefas === 1 ? '' : 's'}` : ''} · {motivoDeFora(f.papel)}</span>
                ))}
              </div>
            )}
          </section>
        )}

        {dado && aba === 'receitas' && (
          <section className="rx-card" data-testid="aba-receitas">
            <div className="rx-chead">Receita por receita · <span>{rot}</span>
              <Info>Rendimento = feito ÷ pedido, contra a faixa saudável 70–130%. Custo real por unidade ao lado do custo de ficha; diferença acima de 10% fica âmbar. Cada receita na própria unidade — nada se converte nem se soma entre receitas.</Info>
            </div>
            <div className="dp-rhead"><span>Receita</span><span className="dir">Lotes</span><span className="dir">Pedido → feito</span><span>Rendimento</span><span className="dir">Tempo mediano</span><span className="dir">Custo/un · ficha</span><span /></div>
            {dado.receitas.length === 0 && <div className="rx-vazio">Nenhum lote fechado neste período.</div>}
            {dado.receitas.map((r) => {
              const c = r.rend != null ? rendCor(r.rend) : 'neutro'
              const cf = r.custo != null && r.fichaCompleta ? custoFlag(r.custo, r.ficha) : 'neutro'
              const k = `r:${r.itemId}`
              return (
                <div key={r.itemId}>
                  <div className="dp-rrow" data-testid="linha-receita">
                    <div className="rn">{r.r}</div>
                    <div className="pfwrap">
                      <div className="lot num"><span className="dp-rot2">lotes </span>{r.lotes}</div>
                      <div className="pf num">{r.ped > 0 ? <>{fmtQ(r.ped)} → <b>{fmtQ(r.feito)}</b> <small>{r.un}</small></> : <span className="mini">sem pedido</span>}
                        {r.semPedido > 0 && r.ped > 0 && <div className="mini">{r.semPedido} sem pedido</div>}</div>
                    </div>
                    <div className={`dp-rend ${c}`}>
                      <span className="v num">{r.rend != null ? `${r.rend}%` : '—'}{r.fora > 0 && <span className="fora-n">⚠ {r.fora} fora</span>}</span>
                      {r.rend != null && <div className="dp-gau"><span className="faixa" /><span className="fill" style={{ width: `${Math.min(100, (r.rend / 140) * 100)}%` }} /></div>}
                    </div>
                    <div className="tmed num"><span className="dp-rot2">tempo </span>{r.tmedSeg != null ? fmtDur(r.tmedSeg) : '—'}</div>
                    <div className={`custo num${cf === 'ambar' ? ' ambar' : ''}`}>
                      {r.custo != null ? formatBRL(r.custo) : 'sem custo'}
                      <small>{r.ficha != null ? `ficha ${r.fichaCompleta ? '' : '≥ '}${formatBRL(r.ficha)}` : 'ficha sem custo/un'}{r.semCusto > 0 ? ` · ${r.semCusto} lote${r.semCusto === 1 ? '' : 's'} sem custo` : ''}</small>
                    </div>
                    <div className="dp-vercel"><button type="button" className="rx-ver" onClick={() => setAberta(aberta === k ? null : k)}>{aberta === k ? 'fechar' : 'ver →'}</button></div>
                  </div>
                  {aberta === k && (
                    <div className="dp-tras" data-testid="por-tras-receita">
                      {r.lotesPorTras.map((l) => (
                        <div key={l.conclusaoId}><span className="num">{l.quando}</span>
                          <span className="num">{l.pedido != null ? `${fmtQ(l.pedido)} → ` : 'sem pedido → '}<b>{fmtQ(l.feito)} {r.un}</b></span>
                          <span className={`num${l.rend != null && rendCor(l.rend) === 'ambar' ? ' amb' : ''}`}>{l.rend != null ? `${l.rend}%` : '—'}</span>
                          <span className="num">{l.custoUn != null ? `${formatBRL(l.custoUn)}/${r.un}` : 'sem custo'}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}
