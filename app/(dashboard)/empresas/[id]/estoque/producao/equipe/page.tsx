'use client'

// ⭐⭐ EQUIPE — lei docs/producao-equipe-referencia.html (v2 APROVADA, R20–R23, 13/11/2026).
// R20: conta e PIN, nada mais — criar, papel (cozinha · escritório · aparelho), trocar PIN, excluir.
//      O papel daqui alimenta o "fora da comparação" do DESEMPENHO.
// R21: o PIN NUNCA aparece — só "definido ✓"; digitado oculto (type=password), 4 dígitos.
// R22: "Nova conta" é cartão FIXO no topo, sem "+" repetido.
// R23: EXCLUIR em toda conta; a confirmação diz os números; o SERVIDOR decide (sem história apaga de
//      vez; com história some de tudo). "Desativar" NÃO existe aqui.

import { use, useCallback, useEffect, useState } from 'react'
import { CSS_COMUM, ChipsDaProducao, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import { iniciais, validaPin, ROTULO_DO_PAPEL, type PapelDaConta } from '@/lib/stock/producao/leis-r'
import type { ContaDaEquipe, PreviaDaExclusao } from '@/lib/stock/producao/contas-da-equipe'

const CSS = `
.eq-zcriar{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1.3fr) 150px 150px;gap:10px;align-items:end}
.eq-zcriar label{display:block;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;margin-bottom:5px}
.eq-zcriar input,.eq-pin input{width:100%;border:1px solid var(--esc-linha);border-radius:9px;height:36px;background:var(--esc-card);color:var(--esc-tinta);font-size:13px;font-weight:700;font-family:inherit;padding:0 11px;outline:none}
.eq-papeis{display:inline-flex;background:var(--esc-abas);border-radius:10px;padding:3px;width:100%}
.eq-papeis button{flex:1;border:0;background:transparent;color:var(--esc-tinta2);border-radius:7px;height:30px;font-size:11.5px;font-weight:800;cursor:pointer}
.eq-papeis button.on{background:var(--esc-card);color:var(--esc-tinta);box-shadow:0 1px 3px rgba(10,15,30,.12)}
.eq-btcriar{border:0;background:var(--esc-indigo);color:var(--esc-on);border-radius:10px;height:36px;font-size:13px;font-weight:800;cursor:pointer;padding:0 16px;width:100%}
.eq-btcriar:disabled{opacity:.55}
.eq-ehead,.eq-erow{display:grid;grid-template-columns:minmax(0,1.4fr) 120px 128px 128px 170px;gap:12px}
.eq-ehead{font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.eq-ehead .dir{text-align:right}
.eq-erow{align-items:center;padding:11px 0;border-bottom:1px solid var(--esc-linha2)}
.eq-erow .quem{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:700}
.eq-erow .rx-avt{width:30px;height:30px;font-size:11.5px}
.eq-papel{display:inline-block;border-radius:6px;padding:2px 9px;font-size:10.5px;font-weight:800;width:fit-content;border:0;cursor:pointer;font-family:inherit}
.eq-papel.cozinha{background:var(--esc-indigo50);color:var(--esc-indigo-t)}
.eq-papel.escritorio{background:var(--esc-trilho);color:var(--esc-tinta2)}
.eq-papel.aparelho{background:var(--esc-roxo50);color:var(--esc-roxo-t)}
.eq-erow .pin{font-size:12px;font-weight:800;color:var(--esc-verde-t)}
.eq-erow .pin.semp{color:var(--esc-ambar-t)}
.eq-erow .ult{font-size:12px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.eq-erow .acoes{display:flex;gap:7px;justify-content:flex-end}
.eq-erow .acoes .rx-btn{height:30px;padding:0 11px;font-size:11.5px;border-radius:8px}
.eq-confirma,.eq-pin{border-left:3px solid var(--esc-perigo);background:var(--esc-perigo-bg);border-radius:0 10px 10px 0;margin:2px 0 10px;padding:12px 14px}
.eq-pin{border-left-color:var(--esc-indigo);background:var(--esc-ficha);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.eq-pin input{width:120px}
.eq-confirma .ct{font-size:13.5px;font-weight:800;margin-bottom:5px}
.eq-confirma .cx{font-size:12.5px;font-weight:600;color:var(--esc-tinta2);line-height:1.55}
.eq-confirma .cbts{display:flex;gap:8px;margin-top:11px}
.eq-erro{font-size:12px;font-weight:700;color:var(--esc-ambar-t);margin-top:8px}
.eq-ok{font-size:12.5px;font-weight:700;color:var(--esc-verde-t);background:var(--esc-verde50);border-radius:10px;padding:9px 12px;margin-bottom:14px}
.eq-cpapel select{border:1px solid var(--esc-linha);border-radius:7px;height:26px;font-size:11px;font-weight:800;background:var(--esc-card);color:var(--esc-tinta)}
@media (max-width:760px){
  .eq-zcriar{grid-template-columns:minmax(0,1fr)}
  .eq-ehead{display:none}
  .eq-erow{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"quem papel" "meta meta" "acoes acoes";row-gap:8px}
  .eq-erow .quem{grid-area:quem}
  .eq-erow .eq-cpapel{grid-area:papel;text-align:right}
  .eq-erow .metawrap{grid-area:meta;display:flex;gap:14px;align-items:baseline}
  .eq-erow .ult{text-align:left}
  .eq-erow .acoes{grid-area:acoes;justify-content:flex-start}
}
@media (min-width:761px){ .eq-erow .metawrap{display:contents} .eq-erow .eq-cpapel{display:contents} }
`

const PAPEIS: PapelDaConta[] = ['cozinha', 'escritorio', 'aparelho']
const ROT_BOTAO: Record<PapelDaConta, string> = { cozinha: 'Cozinha', escritorio: 'Escritório', aparelho: 'Aparelho' }

async function enviar(url: string, method: string, body?: unknown): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    return { ok: r.ok, j: await r.json().catch(() => ({})) }
  } catch { return { ok: false, j: { erro: 'Não consegui falar com o servidor — nada mudou.' } } }
}

export default function EquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const base = `/api/empresas/${id}/estoque/producao/equipe`
  const [contas, setContas] = useState<ContaDaEquipe[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState<PapelDaConta>('cozinha')
  const [pin, setPin] = useState('')
  const [erroCriar, setErroCriar] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [trocando, setTrocando] = useState<string | null>(null)
  const [novoPin, setNovoPin] = useState('')
  const [confirmando, setConfirmando] = useState<{ id: string; previa: PreviaDaExclusao } | null>(null)
  const [erroLinha, setErroLinha] = useState<{ id: string; msg: string } | null>(null)

  const ler = useCallback(async () => {
    try { setContas((await lerJson<{ contas: ContaDaEquipe[] }>(base)).contas); setFalhou(false) } catch { setFalhou(true) }
  }, [base])
  useEffect(() => { ler() }, [ler])

  const podeCriar = nome.trim().length > 0 && (papel === 'aparelho' || validaPin(pin)) && !ocupado

  async function criar() {
    setOcupado(true); setErroCriar(null); setOk(null)
    const r = await enviar(base, 'POST', { nome: nome.trim(), papel, ...(papel === 'aparelho' ? {} : { pin }) })
    setOcupado(false)
    if (!r.ok) { setErroCriar(String(r.j.erro ?? 'Não consegui criar a conta.')); return }
    setOk(`Conta de ${nome.trim()} criada.`); setNome(''); setPin(''); setPapel('cozinha'); ler()
  }

  return (
    <div className="rx -m-4 p-4 lg:-m-6 lg:p-6" data-tela="producao-equipe">
      <style>{CSS_COMUM + CSS}</style>
      <main className="rx-wrap">
        <header className="rx-top"><h1>Produção</h1></header>
        <ChipsDaProducao empresaId={id} aba="equipe" />

        <div className="rx-card" data-testid="nova-conta">
          <div className="rx-chead">Nova conta
            <Info>O PIN tem 4 dígitos e é a assinatura da pessoa na Janela da Cozinha. Papel &quot;escritório&quot; fica fora dos rankings da cozinha; &quot;aparelho&quot; é a conta do tablet, não de uma pessoa.</Info>
          </div>
          <form className="eq-zcriar" onSubmit={(e) => { e.preventDefault(); if (podeCriar) criar() }}>
            <div><label htmlFor="eq-nome">Nome</label><input id="eq-nome" placeholder="nome de quem produz" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} /></div>
            <div><label>Papel</label>
              <div className="eq-papeis" role="radiogroup" aria-label="papel">
                {PAPEIS.map((p) => <button key={p} type="button" role="radio" aria-checked={papel === p} className={papel === p ? 'on' : undefined} onClick={() => setPapel(p)}>{ROT_BOTAO[p]}</button>)}
              </div>
            </div>
            <div><label htmlFor="eq-pin">PIN · 4 dígitos</label>
              <input id="eq-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder={papel === 'aparelho' ? 'sem PIN' : '••••'}
                disabled={papel === 'aparelho'} value={papel === 'aparelho' ? '' : pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /></div>
            <div><button type="submit" className="eq-btcriar" disabled={!podeCriar}>Criar conta</button></div>
          </form>
          {erroCriar && <div className="eq-erro" role="alert">{erroCriar}</div>}
        </div>

        {falhou && <FalhouDeLer oQue="a equipe" onTentar={ler} />}
        {ok && <div className="eq-ok" role="status">{ok}</div>}
        {!contas && !falhou && <div className="rx-vazio">lendo a equipe…</div>}
        {contas && (
          <div className="rx-card" data-testid="lista-contas">
            <div className="rx-chead">Contas <span className="n num">{contas.length}</span></div>
            <div className="eq-ehead"><span>Pessoa</span><span>Papel</span><span>PIN</span><span className="dir">Último lote</span><span className="dir" /></div>
            {contas.length === 0 && <div className="rx-vazio">Nenhuma conta ainda — crie a primeira no cartão acima.</div>}
            {contas.map((c) => (
              <div key={c.colaboradorId}>
                <div className="eq-erow" data-testid="linha-conta">
                  <div className="quem"><span className="rx-avt">{iniciais(c.nome)}</span>{c.nome}</div>
                  <div className="eq-cpapel">
                    <label style={{ position: 'relative' }}>
                      <span className={`eq-papel ${c.papel}`}>{ROTULO_DO_PAPEL[c.papel]}</span>
                      <select aria-label={`papel de ${c.nome}`} value={c.papel} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        onChange={async (e) => {
                          const r = await enviar(`${base}/${c.colaboradorId}`, 'PATCH', { papel: e.target.value })
                          if (!r.ok) setErroLinha({ id: c.colaboradorId, msg: String(r.j.erro ?? 'Não consegui trocar o papel.') }); else { setErroLinha(null); ler() }
                        }}>
                        {PAPEIS.map((p) => <option key={p} value={p}>{ROTULO_DO_PAPEL[p]}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="metawrap">
                    <div className={`pin${c.temPin || c.papel === 'aparelho' ? '' : ' semp'}`}>{c.papel === 'aparelho' && !c.temPin ? '—' : c.temPin ? 'PIN definido ✓' : '⚠ sem PIN'}</div>
                    <div className="ult num">{c.ultimoLote ?? '—'}</div>
                  </div>
                  <div className="acoes">
                    {c.papel !== 'aparelho' && <button type="button" className="rx-btn" onClick={() => { setTrocando(trocando === c.colaboradorId ? null : c.colaboradorId); setNovoPin(''); setConfirmando(null) }}>trocar PIN</button>}
                    <button type="button" className="rx-btn perigo" data-testid="excluir-conta" onClick={async () => {
                      setTrocando(null); setErroLinha(null)
                      try { setConfirmando({ id: c.colaboradorId, previa: await lerJson<PreviaDaExclusao>(`${base}/${c.colaboradorId}`) }) }
                      catch { setErroLinha({ id: c.colaboradorId, msg: 'Não consegui ler a história desta conta.' }) }
                    }}>excluir</button>
                  </div>
                </div>
                {trocando === c.colaboradorId && (
                  <form className="eq-pin" onSubmit={async (e) => {
                    e.preventDefault()
                    const r = await enviar(`${base}/${c.colaboradorId}`, 'PATCH', { pin: novoPin })
                    if (!r.ok) { setErroLinha({ id: c.colaboradorId, msg: String(r.j.erro ?? 'Não consegui trocar o PIN.') }); return }
                    setTrocando(null); setNovoPin(''); setOk(`PIN de ${c.nome} trocado.`); ler()
                  }}>
                    <input type="password" inputMode="numeric" autoComplete="new-password" aria-label={`novo PIN de ${c.nome}`} maxLength={4} placeholder="novo PIN"
                      value={novoPin} onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                    <button type="submit" className="rx-btn pri" disabled={!validaPin(novoPin)}>gravar PIN</button>
                    <button type="button" className="rx-btn" onClick={() => setTrocando(null)}>cancelar</button>
                  </form>
                )}
                {confirmando?.id === c.colaboradorId && (
                  <div className="eq-confirma" data-testid="confirma-excluir-conta">
                    <div className="ct">Excluir {c.nome}?</div>
                    <div className="cx num">{confirmando.previa.frase}</div>
                    <div className="cbts">
                      <button type="button" className="rx-btn mata" onClick={async () => {
                        const r = await enviar(`${base}/${c.colaboradorId}`, 'DELETE')
                        if (!r.ok) { setErroLinha({ id: c.colaboradorId, msg: String(r.j.erro ?? 'Não consegui excluir.') }); return }
                        setConfirmando(null)
                        setOk(r.j.destino === 'apaga' ? `${c.nome} foi apagada de vez.` : `${c.nome} saiu da equipe — ${r.j.lotes} lotes e ${r.j.tarefas} tarefas ficam na história.`)
                        ler()
                      }}>excluir</button>
                      <button type="button" className="rx-btn" onClick={() => setConfirmando(null)}>cancelar</button>
                    </div>
                  </div>
                )}
                {erroLinha?.id === c.colaboradorId && <div className="eq-erro" role="alert">{erroLinha.msg}</div>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
