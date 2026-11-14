'use client'

// ⭐⭐ ROTINAS — lei docs/rotinas-referencia.html (v1 APROVADA, R25–R31, 13/11/2026).
// R25: rotina salva SEMEIA sozinha as tarefas do dia (todo dia · dias da semana · toda semana num dia · dia N do mês).
// R26: 1 ou N itens — na Janela o grupo é UM cartão com tiques.
// R27: "até HH:MM" opcional; passou sem concluir → "atrasada" ÂMBAR (nunca vermelho).
// R28: quem faz é por rotina — pessoa fixa ou livre.
// R29: pausar · retomar · excluir (o SERVIDOR decide: sem história apaga de vez; com história some daqui).
// R30: a coluna HOJE viva — "N/M", "terminou HH:MM", "atrasada", "próxima DD/MM".
// R31: esta tela NÃO cria tarefa avulsa (essa é a mão do Painel). O Painel chega aqui pela ponte "isso repete →".

import { use, useCallback, useEffect, useState } from 'react'
import { CSS_COMUM, ChipsDaProducao, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import type { RotinaDaLista, PreviaExclusaoRotina } from '@/lib/stock/producao/rotinas-do-banco'
import type { RegraRotina } from '@/lib/stock/producao/rotinas'

const CSS = `
.ro-zr{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.1fr) 128px minmax(0,1fr) 140px;gap:10px;align-items:end}
.ro-zr label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;margin-bottom:5px}
.ro-zr input,.ro-zr select{width:100%;border:1px solid var(--esc-linha);border-radius:9px;height:36px;background:var(--esc-card);color:var(--esc-tinta);font-size:13px;font-weight:700;font-family:inherit;padding:0 11px;outline:none}
.ro-btpri{border:0;background:var(--esc-indigo);color:var(--esc-on);border-radius:10px;height:36px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;padding:0 16px;width:100%}
.ro-btpri:disabled{opacity:.55;cursor:default}
.ro-sub{grid-column:1 / -1;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;font-weight:700;color:var(--esc-tinta2)}
.ro-sub button{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);border-radius:8px;height:30px;min-width:44px;padding:0 9px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit}
.ro-sub button.on{background:var(--esc-indigo);border-color:var(--esc-indigo);color:var(--esc-on)}
.ro-sub select,.ro-sub input{border:1px solid var(--esc-linha);border-radius:8px;height:30px;font-size:12px;font-weight:800;background:var(--esc-card);color:var(--esc-tinta);padding:0 8px;font-family:inherit}
.ro-itens{grid-column:1 / -1;border:1px dashed var(--esc-linha);border-radius:10px;padding:10px 12px}
.ro-itens .irow{display:flex;align-items:center;gap:9px;padding:3px 0;font-size:13px;font-weight:700}
.ro-itens .irow .ponto{width:7px;height:7px;border-radius:50%;background:var(--esc-indigo);flex:none}
.ro-itens .irow input{flex:1;border:0;border-bottom:1px solid transparent;background:transparent;color:var(--esc-tinta);font-size:13px;font-weight:700;font-family:inherit;padding:4px 0;outline:none}
.ro-itens .irow input:focus{border-bottom-color:var(--esc-linha)}
.ro-itens .irow .tira{border:0;background:none;color:var(--esc-tinta3);font-size:15px;font-weight:800;cursor:pointer;padding:0 4px}
.ro-itens .add{color:var(--esc-indigo);font-size:12px;font-weight:800;cursor:pointer;background:none;border:0;font-family:inherit;padding:5px 0 0}
.ro-rhead,.ro-rrow{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.85fr) 58px 86px minmax(0,.95fr) 212px;gap:12px}
.ro-rhead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.ro-rhead .dir{text-align:right}
.ro-rrow{align-items:center;padding:12px 0;border-bottom:1px solid var(--esc-linha2)}
.ro-rrow.pausada{opacity:.55}
.ro-rrow .rn{font-size:13.5px;font-weight:700}
.ro-rrow .rn small{display:block;font-size:11px;color:var(--esc-tinta3);font-weight:700;margin-top:2px}
.ro-rrow .rep{font-size:12.5px;font-weight:700;color:var(--esc-tinta2)}
.ro-rrow .hl,.ro-rrow .qf{font-size:12.5px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.ro-rrow .hoje{font-size:12.5px;font-weight:800;text-align:right}
.ro-rrow .hoje .ok{color:var(--esc-verde-t)}
.ro-rrow .hoje .amb{color:var(--esc-ambar-t)}
.ro-rrow .hoje .mut{color:var(--esc-tinta3)}
.ro-rrow .hoje .prox{color:var(--esc-tinta2)}
.ro-rrow .hoje small{display:block;font-size:10.5px;font-weight:700;color:var(--esc-tinta3);margin-top:2px}
.ro-rrow .acoes{display:flex;gap:7px;justify-content:flex-end}
.ro-rrow .acoes .rx-btn{height:30px;padding:0 10px;font-size:11.5px;border-radius:8px}
.ro-chip-p{display:inline-block;background:var(--esc-trilho);color:var(--esc-tinta2);border-radius:6px;padding:1px 8px;font-size:10px;font-weight:800;margin-left:7px;vertical-align:1px}
.ro-rot2{display:none}
.ro-confirma{border-left:3px solid var(--esc-perigo);background:var(--esc-perigo-bg);border-radius:0 10px 10px 0;margin:2px 0 10px;padding:12px 14px}
.ro-confirma .ct{font-size:13.5px;font-weight:800;margin-bottom:5px}
.ro-confirma .cx{font-size:12.5px;font-weight:600;color:var(--esc-tinta2);line-height:1.55}
.ro-confirma .cbts{display:flex;gap:8px;margin-top:11px}
.ro-erro{font-size:12px;font-weight:700;color:var(--esc-ambar-t);margin-top:8px}
.ro-ok{font-size:12.5px;font-weight:700;color:var(--esc-verde-t);background:var(--esc-verde50);border-radius:10px;padding:9px 12px;margin-bottom:14px}
.ro-aviso{font-size:11px;font-weight:700;color:var(--esc-ambar-t);display:block;margin-top:2px}
@media (max-width:760px){
  .ro-rot2{display:inline}
  .ro-zr{grid-template-columns:minmax(0,1fr)}
  .ro-rhead{display:none}
  .ro-rrow{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"rn hoje" "meta meta" "acoes acoes";row-gap:7px}
  .ro-rrow .rn{grid-area:rn}
  .ro-rrow .hoje{grid-area:hoje}
  .ro-rrow .metawrap{grid-area:meta;display:flex;gap:14px;flex-wrap:wrap;align-items:baseline}
  .ro-rrow .hl,.ro-rrow .qf{text-align:left}
  .ro-rrow .acoes{grid-area:acoes;justify-content:flex-start}
}
@media (min-width:761px){ .ro-rrow .metawrap{display:contents} }
`

type TipoRepete = RegraRotina['tipo']
const OPCOES_REPETE: { tipo: TipoRepete; rotulo: string }[] = [
  { tipo: 'diaria', rotulo: 'todo dia' },
  { tipo: 'dias', rotulo: 'dias da semana…' },
  { tipo: 'semanal', rotulo: 'toda semana (escolher dia)' },
  { tipo: 'mensal', rotulo: 'dia do mês…' },
]
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

interface Pessoa { id: string; nome: string; ativo?: boolean }
interface Rascunho { nome: string; tipo: TipoRepete; dows: number[]; dow: number; dia: number; ate: string; quem: string; itens: string[] }
const VAZIO: Rascunho = { nome: '', tipo: 'diaria', dows: [1, 2, 3, 4, 5], dow: 1, dia: 1, ate: '', quem: 'LIVRE', itens: [''] }

function regraDo(r: Rascunho): RegraRotina {
  if (r.tipo === 'dias') return { tipo: 'dias', dows: r.dows }
  if (r.tipo === 'semanal') return { tipo: 'semanal', dow: r.dow }
  if (r.tipo === 'mensal') return { tipo: 'mensal', dia: r.dia }
  return { tipo: 'diaria' }
}
function rascunhoDa(x: RotinaDaLista): Rascunho {
  const g = x.regra
  return {
    nome: x.nome, tipo: g.tipo, dows: g.tipo === 'dias' ? g.dows : VAZIO.dows, dow: g.tipo === 'semanal' ? g.dow : 1, dia: g.tipo === 'mensal' ? g.dia : 1,
    ate: x.ate ?? '', quem: x.colaboradorId ?? 'LIVRE', itens: [...x.itens],
  }
}

async function enviar(url: string, method: string, body?: unknown): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    return { ok: r.ok, j: await r.json().catch(() => ({})) }
  } catch { return { ok: false, j: { erro: 'Não consegui falar com o servidor — nada mudou.' } } }
}

/** R30 — a célula HOJE, pelas funções da lei (calculadas no servidor) */
function Hoje({ r }: { r: RotinaDaLista }) {
  if (r.pausada) return <span className="mut">—</span>
  if (!r.hoje) return <span className="prox num">{r.proxima ? `próxima ${dm(r.proxima)}` : '—'}</span>
  if (r.hoje.cancelada) return <><span className="mut">cancelada</span><small>pelo escritório</small></>
  const fim = r.hoje.feitas === r.hoje.total
  return (
    <>
      <span className={`${fim ? 'ok' : r.hoje.atrasada ? 'amb' : ''} num`}>{r.hoje.feitas}/{r.hoje.total}{fim ? ' ✓' : ''}</span>
      {r.hoje.fim ? <small className="num">terminou {r.hoje.fim}</small> : r.hoje.atrasada ? <small className="amb" data-testid="rotina-atrasada">atrasada</small> : null}
    </>
  )
}

export default function RotinasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const base = `/api/empresas/${id}/estoque/producao/rotinas`
  const [rotinas, setRotinas] = useState<RotinaDaLista[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [rasc, setRasc] = useState<Rascunho>(VAZIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erroCriar, setErroCriar] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<{ id: string; previa: PreviaExclusaoRotina } | null>(null)
  const [erroLinha, setErroLinha] = useState<{ id: string; msg: string } | null>(null)

  const ler = useCallback(async () => {
    try { setRotinas((await lerJson<{ rotinas: RotinaDaLista[] }>(base)).rotinas); setFalhou(false) } catch { setFalhou(true) }
  }, [base])
  useEffect(() => { ler() }, [ler])
  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/colaboradores`).then((r) => (r.ok ? r.json() : null)).then((j) => setPessoas((j?.colaboradores ?? []).filter((p: Pessoa) => p.ativo !== false))).catch(() => {})
  }, [id])
  // ⭐ R31 — a ponte do Painel chega com os campos carregados (?nome=&item=&quem=)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const nome = q.get('nome'), item = q.get('item'), quem = q.get('quem')
    if (nome || item || quem) setRasc((r) => ({ ...r, nome: nome ?? r.nome, itens: item ? [item] : r.itens, quem: quem ?? r.quem }))
  }, [])

  const set = (p: Partial<Rascunho>) => setRasc((r) => ({ ...r, ...p }))
  const itensValidos = rasc.itens.map((i) => i.trim()).filter(Boolean)
  const podeSalvar = rasc.nome.trim().length > 0 && itensValidos.length > 0 && (rasc.tipo !== 'dias' || rasc.dows.length > 0) && !ocupado

  async function salvar() {
    setOcupado(true); setErroCriar(null); setOk(null)
    const corpo = { nome: rasc.nome.trim(), regra: regraDo(rasc), ate: rasc.ate || null, quem: rasc.quem, itens: itensValidos }
    const r = await enviar(editando ? `${base}/${editando}` : base, editando ? 'PATCH' : 'POST', corpo)
    setOcupado(false)
    if (!r.ok) { setErroCriar(String(r.j.erro ?? 'Não consegui salvar a rotina.')); return }
    const caiu = Number(r.j.semeadasHoje ?? 0)
    setOk(editando ? `Rotina ${corpo.nome.toUpperCase()} salva — vale a partir da próxima vez que cair.` : `Rotina ${corpo.nome.toUpperCase()} criada${caiu ? ' — já caiu na Janela da Cozinha hoje.' : '.'}`)
    setRasc(VAZIO); setEditando(null)
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
    ler()
  }

  return (
    <div className="rx -m-4 p-4 lg:-m-6 lg:p-6" data-tela="producao-rotinas">
      <style>{CSS_COMUM + CSS}</style>
      <main className="rx-wrap">
        <header className="rx-top"><h1>Produção</h1></header>
        <ChipsDaProducao empresaId={id} aba="rotinas" />

        <div className="rx-card" data-testid="nova-rotina">
          <div className="rx-chead">{editando ? 'Editar rotina' : 'Nova rotina'}
            <Info>A rotina cai sozinha na Janela da Cozinha nos dias da regra — ninguém cria tarefa manual. Grupo com vários itens vira UM cartão com tiques; cada tique grava quem fez e quando. Hora limite é opcional: passou, fica &quot;atrasada&quot; em âmbar.</Info>
          </div>
          <form className="ro-zr" onSubmit={(e) => { e.preventDefault(); if (podeSalvar) salvar() }}>
            <div><label htmlFor="ro-nome">Nome</label><input id="ro-nome" placeholder="ex.: ABERTURA DA COZINHA" maxLength={80} value={rasc.nome} onChange={(e) => set({ nome: e.target.value })} /></div>
            <div><label htmlFor="ro-rep">Repete</label>
              <select id="ro-rep" value={rasc.tipo} onChange={(e) => set({ tipo: e.target.value as TipoRepete })}>
                {OPCOES_REPETE.map((o) => <option key={o.tipo} value={o.tipo}>{o.rotulo}</option>)}
              </select></div>
            <div><label htmlFor="ro-ate">Até · opcional</label><input id="ro-ate" type="time" className="num" value={rasc.ate} onChange={(e) => set({ ate: e.target.value })} /></div>
            <div><label htmlFor="ro-quem">Quem faz</label>
              <select id="ro-quem" value={rasc.quem} onChange={(e) => set({ quem: e.target.value })}>
                <option value="LIVRE">livre — quem pegar</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select></div>
            <div><button type="submit" className="ro-btpri" disabled={!podeSalvar} data-testid="salvar-rotina">{editando ? 'Salvar rotina' : 'Criar rotina'}</button></div>
            {rasc.tipo === 'dias' && (
              <div className="ro-sub" role="group" aria-label="dias da semana">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <button key={d} type="button" className={rasc.dows.includes(d) ? 'on' : undefined} aria-pressed={rasc.dows.includes(d)}
                    onClick={() => set({ dows: rasc.dows.includes(d) ? rasc.dows.filter((x) => x !== d) : [...rasc.dows, d].sort() })}>{CURTO[d]}</button>
                ))}
              </div>
            )}
            {rasc.tipo === 'semanal' && (
              <div className="ro-sub">toda
                <select aria-label="dia da semana" value={rasc.dow} onChange={(e) => set({ dow: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}
                </select></div>
            )}
            {rasc.tipo === 'mensal' && (
              <div className="ro-sub">dia
                <input aria-label="dia do mês" type="number" min={1} max={31} className="num" style={{ width: 64 }} value={rasc.dia}
                  onChange={(e) => set({ dia: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} /> do mês</div>
            )}
            <div className="ro-itens" data-testid="itens-da-rotina">
              {rasc.itens.map((it, k) => (
                <div key={k} className="irow"><span className="ponto" />
                  <input aria-label={`item ${k + 1}`} placeholder={k === 0 ? 'o que fazer (1 item = cartão normal; 2+ = grupo com tiques)' : 'mais um item'} maxLength={60} value={it}
                    onChange={(e) => set({ itens: rasc.itens.map((x, j) => (j === k ? e.target.value : x)) })} />
                  {rasc.itens.length > 1 && <button type="button" className="tira" aria-label={`tirar item ${k + 1}`} onClick={() => set({ itens: rasc.itens.filter((_, j) => j !== k) })}>×</button>}
                </div>
              ))}
              <button type="button" className="add" onClick={() => set({ itens: [...rasc.itens, ''] })}>+ item</button>
            </div>
          </form>
          {editando && <div style={{ marginTop: 8 }}><button type="button" className="rx-btn" onClick={() => { setEditando(null); setRasc(VAZIO) }}>cancelar edição</button></div>}
          {erroCriar && <div className="ro-erro" role="alert">{erroCriar}</div>}
        </div>

        {falhou && <FalhouDeLer oQue="as rotinas" onTentar={ler} />}
        {ok && <div className="ro-ok" role="status">{ok}</div>}
        {!rotinas && !falhou && <div className="rx-vazio">lendo as rotinas…</div>}
        {rotinas && (
          <div className="rx-card" data-testid="lista-rotinas">
            <div className="rx-chead">Rotinas <span className="n num">{rotinas.length}</span></div>
            <div className="ro-rhead"><span>Rotina</span><span>Repete</span><span className="dir">Até</span><span className="dir">Quem</span><span className="dir">Hoje</span><span className="dir" /></div>
            {rotinas.length === 0 && <div className="rx-vazio">Nenhuma rotina ainda — crie a primeira no cartão acima. Ela cai sozinha na Janela da Cozinha nos dias da regra.</div>}
            {rotinas.map((r) => (
              <div key={r.id}>
                <div className={`ro-rrow${r.pausada ? ' pausada' : ''}`} data-testid="linha-rotina">
                  <div className="rn">{r.nome}{r.pausada && <span className="ro-chip-p">pausada</span>}
                    <small className="num">{r.itens.length} {r.itens.length === 1 ? 'item' : 'itens'}</small>
                    {r.pessoaInativa && <span className="ro-aviso">a pessoa saiu da equipe — escolha outra pra voltar a cair</span>}
                  </div>
                  <div className="metawrap">
                    <div className="rep">{r.repete}</div>
                    <div className="hl num">{r.ate ? <><span className="ro-rot2">até </span>{r.ate}</> : '—'}</div>
                    <div className="qf">{r.quem}</div>
                  </div>
                  <div className="hoje"><Hoje r={r} /></div>
                  <div className="acoes">
                    {!r.pausada && <button type="button" className="rx-btn" onClick={() => { setEditando(r.id); setRasc(rascunhoDa(r)); setConfirmando(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>editar</button>}
                    <button type="button" className="rx-btn" onClick={async () => {
                      const q = await enviar(`${base}/${r.id}`, 'PATCH', { pausar: !r.pausada })
                      if (!q.ok) setErroLinha({ id: r.id, msg: String(q.j.erro ?? 'Não consegui.') }); else { setErroLinha(null); ler() }
                    }}>{r.pausada ? 'retomar' : 'pausar'}</button>
                    <button type="button" className="rx-btn perigo" data-testid="excluir-rotina" onClick={async () => {
                      setErroLinha(null)
                      try { setConfirmando({ id: r.id, previa: await lerJson<PreviaExclusaoRotina>(`${base}/${r.id}`) }) }
                      catch { setErroLinha({ id: r.id, msg: 'Não consegui ler a história desta rotina.' }) }
                    }}>excluir</button>
                  </div>
                </div>
                {confirmando?.id === r.id && (
                  <div className="ro-confirma" data-testid="confirma-excluir-rotina">
                    <div className="ct">Excluir {r.nome}?</div>
                    <div className="cx num">{confirmando.previa.frase}</div>
                    <div className="cbts">
                      <button type="button" className="rx-btn mata" onClick={async () => {
                        const q = await enviar(`${base}/${r.id}`, 'DELETE')
                        if (!q.ok) { setErroLinha({ id: r.id, msg: String(q.j.erro ?? 'Não consegui excluir.') }); return }
                        setConfirmando(null)
                        setOk(q.j.destino === 'apagar' ? `${r.nome} foi apagada de vez.` : `${r.nome} saiu das rotinas — as ${q.j.semeadas} tarefas que ela semeou ficam na história.`)
                        ler()
                      }}>excluir</button>
                      <button type="button" className="rx-btn" onClick={() => setConfirmando(null)}>cancelar</button>
                    </div>
                  </div>
                )}
                {erroLinha?.id === r.id && <div className="ro-erro" role="alert">{erroLinha.msg}</div>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
