'use client'

// ⭐⭐ BANCADA DE VÍNCULOS — lei docs/bancada-referencia.html (v1 APROVADA, R32–R35, 19/11/2026).
// R32: fila ÚNICA (produtos sem vínculo + complementos sem ficha), aba própria do Cardápio.
// R33: placar do vazamento — R$ sem baixar 30d · ~custo/dia ESTIMADO · N na fila; "ver a conta →" prova.
//      O placar é derivado das linhas (`placarDe`): cada ligação desconta na hora.
// R34: maior R$ primeiro; R$ 0 (incluso) pelas ocorrências. Filtros com contador.
// R35: apontar ficha · criar ficha · ignorar · desfazer — as MESMAS rotas das abas Produtos/Complementos.
//      Sugestão clicável, NUNCA automática.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CSS_COMUM, FalhouDeLer, Info, lerJson } from '@/components/estoque/producao-telas'
import {
  aplicarDecisao, brl0, contarFiltros, filaVisivel, placarDe, FILTROS_DA_BANCADA,
  type Bancada, type FiltroDaBancada, type LinhaDaBancada,
} from '@/lib/stock/cardapio/bancada-regras'

const CSS = `
.bc-top{display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.bc-busca{display:flex;align-items:center;gap:8px;border:1px solid var(--esc-linha);background:var(--esc-card);border-radius:10px;height:36px;padding:0 12px;min-width:230px}
.bc-busca input{border:0;outline:0;font-size:13px;font-weight:600;color:var(--esc-tinta);font-family:inherit;width:100%;background:transparent}
.bc-busca .lupa{color:var(--esc-tinta3);font-size:13px}
.bc-placar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
.bc-pk{background:var(--esc-card);border:1px solid var(--esc-linha);border-radius:14px;padding:13px 16px}
.bc-pk .rot{font-size:9.5px;font-weight:800;letter-spacing:.08em;color:var(--esc-tinta3);text-transform:uppercase}
.bc-pk .v{font-size:21px;font-weight:800;letter-spacing:-.01em;margin-top:3px}
.bc-pk .v.amb{color:var(--esc-ambar)}
.bc-pk .sub{font-size:11px;font-weight:700;color:var(--esc-tinta3);margin-top:2px}
.bc-pk .sub button{color:var(--esc-indigo);font-weight:800;background:none;border:0;padding:0;cursor:pointer;font-size:11px;font-family:inherit}
.bc-conta{font-size:12px;font-weight:600;color:var(--esc-tinta2);line-height:1.6}
.bc-conta table{width:100%;border-collapse:collapse;margin-top:8px}
.bc-conta td{padding:3px 0;border-bottom:1px solid var(--esc-linha2)}
.bc-conta td.d{text-align:right;font-variant-numeric:tabular-nums;font-weight:800}
.bc-filtros{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}
.bc-filtros button{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta2);border-radius:999px;height:30px;padding:0 12px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.bc-filtros button.on{background:var(--esc-tinta);border-color:var(--esc-tinta);color:var(--esc-on)}
.bc-filtros .fn{background:var(--esc-trilho);color:var(--esc-tinta2);border-radius:999px;padding:1px 7px;font-size:10px;font-weight:800}
.bc-filtros button.on .fn{background:var(--esc-n-on);color:var(--esc-n-on-t)}
.bc-bhead{display:grid;grid-template-columns:minmax(0,1.6fr) 104px 96px minmax(0,1.5fr);gap:12px;font-size:9.5px;font-weight:800;letter-spacing:.07em;color:var(--esc-tinta3);text-transform:uppercase;padding:8px 0 6px;border-bottom:1px solid var(--esc-linha2)}
.bc-bhead .dir{text-align:right}
.bc-brow{display:grid;grid-template-columns:minmax(0,1.6fr) 104px 96px minmax(0,1.5fr);gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--esc-linha2)}
.bc-brow:last-child{border-bottom:0}
.bc-brow .nm{font-size:13.5px;font-weight:700;min-width:0;overflow-wrap:anywhere}
.bc-tipo{display:inline-block;border-radius:6px;padding:1px 8px;font-size:10px;font-weight:800;margin-left:7px;vertical-align:1px}
.bc-tipo.p{background:var(--esc-indigo50);color:var(--esc-indigo-t)}
.bc-tipo.c{background:var(--esc-roxo50);color:var(--esc-roxo-t)}
.bc-brow .nm .sug{display:block;font-size:11px;font-weight:700;color:var(--esc-tinta3);margin-top:3px}
.bc-brow .nm .sug button{color:var(--esc-indigo);font-weight:800;background:none;border:0;padding:0;cursor:pointer;font-size:11px;font-family:inherit;text-align:left}
.bc-brow .nm .feito{display:block;font-size:11px;font-weight:700;color:var(--esc-verde-t);margin-top:3px}
.bc-brow .qt{font-size:13px;font-weight:700;color:var(--esc-tinta2);text-align:right}
.bc-brow .qt small{font-size:10.5px;font-weight:800;color:var(--esc-tinta3)}
.bc-brow .rs{font-size:13.5px;font-weight:800;text-align:right}
.bc-brow .rs .inc{font-size:11px;font-weight:700;color:var(--esc-tinta3)}
.bc-brow .acoes{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap;position:relative}
.bc-brow .acoes button,.bc-brow .acoes a{border:1px solid var(--esc-linha);background:var(--esc-card);color:var(--esc-tinta);border-radius:8px;height:30px;padding:0 11px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;text-decoration:none}
.bc-brow .acoes .pri{background:var(--esc-indigo);border-color:var(--esc-indigo);color:var(--esc-on)}
.bc-brow .acoes button:disabled{opacity:.5;cursor:default}
.bc-apontar{position:absolute;right:0;top:36px;z-index:8;width:280px;max-width:86vw;background:var(--esc-card);border:1px solid var(--esc-linha);border-radius:10px;padding:8px}
.bc-apontar input{width:100%;border:1px solid var(--esc-linha);border-radius:8px;height:32px;padding:0 10px;font-size:12.5px;font-weight:700;font-family:inherit;color:var(--esc-tinta);background:var(--esc-card);outline:none}
.bc-apontar ul{list-style:none;margin:6px 0 0;padding:0;max-height:240px;overflow:auto}
.bc-apontar li button{width:100%;text-align:left;border:0;background:none;padding:6px 8px;border-radius:6px;font-size:12.5px;font-weight:700;color:var(--esc-tinta);cursor:pointer;font-family:inherit}
.bc-apontar li button:hover{background:var(--esc-indigo50)}
.bc-apontar .vz{font-size:11.5px;font-weight:600;color:var(--esc-tinta3);padding:6px 8px}
@media (max-width:760px){
  .bc-placar{grid-template-columns:minmax(0,1fr)}
  .bc-bhead{display:none}
  .bc-brow{grid-template-columns:minmax(0,1fr) 104px;grid-template-areas:"nm rs" "meta meta" "acoes acoes";row-gap:7px}
  .bc-brow .nm{grid-area:nm}
  .bc-brow .rs{grid-area:rs}
  .bc-brow .metawrap{grid-area:meta}
  .bc-brow .qt{text-align:left}
  .bc-brow .acoes{grid-area:acoes;justify-content:flex-start}
  .bc-busca{min-width:0;width:100%}
}
@media (min-width:761px){ .bc-brow .metawrap{display:contents} }
`

interface FichaDaLista { id: string; nomeProduzido: string; tipoProduto: string; ativo?: boolean }
type Decisao = { acao: 'FICHA'; fichaId: string; nomeFicha: string } | { acao: 'IGNORAR' } | { acao: 'DESFAZER' }

/** ⭐ R35 — as MESMAS gravações das abas: produto pelo `vendas/mapear`, complemento pelo `complementos/mapear` */
async function gravar(id: string, l: LinhaDaBancada, d: Decisao): Promise<string | null> {
  const [url, body] = l.tipo === 'PRODUTO'
    ? [`/api/empresas/${id}/estoque/vendas/mapear`, d.acao === 'FICHA' ? { nomeSuitable: l.nome, alvoTipo: 'FICHA', fichaId: d.fichaId }
      : d.acao === 'IGNORAR' ? { nomeSuitable: l.nome, alvoTipo: 'IGNORAR' } : { nomeSuitable: l.nome, alvoTipo: 'REMOVER' }]
    : [`/api/empresas/${id}/estoque/vendas/complementos/mapear`, d.acao === 'FICHA' ? { nomeSuitable: l.nome, destino: 'FICHA', fichaId: d.fichaId }
      : { nomeSuitable: l.nome, destino: d.acao === 'IGNORAR' ? 'IGNORAR' : 'LIMPAR' }]
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) return null
    const j = await r.json().catch(() => null) as { erro?: string } | null
    return j?.erro ?? 'Não consegui gravar agora.'
  } catch { return 'Não consegui gravar agora.' }
}

/** o link de "criar ficha →", pré-preenchido com o nome e já levando o vínculo */
function linkCriarFicha(id: string, l: LinhaDaBancada): string {
  const voltar = encodeURIComponent(`/empresas/${id}/estoque/cardapio?aba=bancada`)
  const nome = encodeURIComponent(l.nome)
  return l.tipo === 'PRODUTO'
    ? `/empresas/${id}/estoque/fichas/nova?tipo=PRODUTO_FINAL&nome=${nome}&mapear=${nome}&voltar=${voltar}`
    : `/empresas/${id}/estoque/fichas/nova?tipo=SABOR&nome=${nome}&complemento=${nome}&voltar=${voltar}`
}

export function BancadaDeVinculos({ id, onContagem }: { id: string; onContagem?: (n: number) => void }) {
  const [dados, setDados] = useState<Bancada | null | undefined>(undefined)
  const [linhas, setLinhas] = useState<LinhaDaBancada[]>([])
  const [filtro, setFiltro] = useState<FiltroDaBancada>('TUDO')
  const [busca, setBusca] = useState('')
  const [verConta, setVerConta] = useState(false)
  const [apontando, setApontando] = useState<string | null>(null)
  const [termo, setTermo] = useState('')
  const [fichas, setFichas] = useState<FichaDaLista[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(() => {
    lerJson<Bancada>(`/api/empresas/${id}/estoque/cardapio/bancada`)
      .then((b) => { setDados(b); setLinhas(b.linhas) })
      .catch(() => setDados(null))
  }, [id])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    lerJson<{ fichas: FichaDaLista[] }>(`/api/empresas/${id}/estoque/fichas`)
      .then((j) => setFichas((j.fichas ?? []).filter((f) => f.ativo !== false))).catch(() => {})
  }, [id])

  const razao = dados?.razao.razao ?? null
  const placar = useMemo(() => placarDe(linhas, razao), [linhas, razao])
  const contagem = useMemo(() => contarFiltros(linhas), [linhas])
  const visiveis = useMemo(() => filaVisivel(linhas, filtro, busca), [linhas, filtro, busca])
  const pendentes = useMemo(() => filaVisivel(linhas, 'TUDO', ''), [linhas])
  useEffect(() => { if (dados) onContagem?.(placar.total) }, [dados, placar.total, onContagem])

  const decidir = async (l: LinhaDaBancada, d: Decisao) => {
    setOcupado(l.chave); setErro(null)
    const falhou = await gravar(id, l, d)
    setOcupado(null)
    if (falhou) { setErro(`${l.nome}: ${falhou}`); return }
    setApontando(null); setTermo('')
    // ⭐ R33: desconta NA HORA (o placar é derivado das linhas) — e o servidor confirma em seguida
    setLinhas((ls) => aplicarDecisao(ls, l.chave, d.acao === 'FICHA'
      ? { estado: 'RESOLVIDO', fichaId: d.fichaId, nomeFicha: d.nomeFicha }
      : { estado: d.acao === 'IGNORAR' ? 'IGNORADO' : 'PENDENTE' }))
    carregar()
  }

  if (dados === undefined) return <div className="rx"><style>{CSS_COMUM + CSS}</style><p className="rx-vazio">carregando a bancada…</p></div>
  if (dados === null) return <div className="rx"><style>{CSS_COMUM + CSS}</style><FalhouDeLer oQue="a bancada" onTentar={carregar} /></div>

  const fichasPara = (l: LinhaDaBancada) => fichas
    .filter((f) => (l.tipo === 'PRODUTO' ? f.tipoProduto === 'PRODUTO_FINAL' : true))
    .filter((f) => !termo.trim() || f.nomeProduzido.toLowerCase().includes(termo.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <div className="rx" data-testid="bancada">
      <style>{CSS_COMUM + CSS}</style>
      <div className="bc-top">
        <div className="bc-busca"><span className="lupa">⌕</span><input placeholder="buscar nome" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
      </div>

      <div className="bc-placar">
        <div className="bc-pk"><div className="rot">Vendido sem baixar · 30 dias</div>
          <div className="v amb num" data-testid="placar-fat">{brl0(placar.fat30)}</div>
          <div className="sub num"><button type="button" onClick={() => setVerConta((v) => !v)}>{verConta ? 'fechar a conta' : 'ver a conta →'}</button></div></div>
        <div className="bc-pk"><div className="rot">Custo vazando · estimado</div>
          <div className="v amb num" data-testid="placar-dia">{placar.custoDia == null ? 'a definir' : `~${brl0(placar.custoDia)}/dia`}</div>
          <div className="sub">pela razão custo/faturamento do que baixa</div></div>
        <div className="bc-pk"><div className="rot">Na fila</div>
          <div className="v num" data-testid="placar-fila">{placar.total} {placar.total === 1 ? 'nome' : 'nomes'}</div>
          <div className="sub num">{placar.produtos} {placar.produtos === 1 ? 'produto' : 'produtos'} · {placar.complementos} {placar.complementos === 1 ? 'complemento' : 'complementos'}</div></div>
      </div>

      {verConta && (
        <div className="rx-card bc-conta" data-testid="a-conta">
          <div className="rx-chead">A conta · {dados.periodo.de.split('-').reverse().join('/')} a {dados.periodo.ate.split('-').reverse().join('/')}</div>
          <div>Vendido sem baixar = soma do R$ vendido nos {dados.periodo.dias} dias pelos {placar.total} nomes da fila: <b className="num">{brl0(placar.fat30)}</b>.</div>
          <div>Custo/dia estimado = {brl0(placar.fat30)} × razão ÷ {dados.periodo.dias}. A razão é o custo do que baixou (<b className="num">{brl0(dados.razao.custoBaixado)}</b>) ÷ o faturamento dos nomes que baixam (<b className="num">{brl0(dados.razao.faturamentoQueBaixa)}</b>) = <b className="num">{razao == null ? 'a definir' : `${(razao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}</b>. É uma estimativa: nome sem ficha não tem custo próprio.</div>
          <table><tbody>
            {pendentes.map((l) => (
              <tr key={l.chave}><td>{l.nome} <span className={`bc-tipo ${l.tipo === 'PRODUTO' ? 'p' : 'c'}`}>{l.tipo === 'PRODUTO' ? 'produto' : 'complemento'}</span></td>
                <td className="d">{l.qt.toLocaleString('pt-BR')} {l.tipo === 'COMPLEMENTO' ? 'ocorr.' : 'un'}</td>
                <td className="d">{l.rs > 0 ? brl0(l.rs) : 'incluso no preço'}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}

      {erro && <div className="rx-falhou" role="alert">{erro}<button type="button" onClick={() => setErro(null)}>ok</button></div>}

      <div className="rx-card">
        <div className="rx-chead">Fila · maior vazamento primeiro
          <Info>Cada nome ligado a uma ficha passa a baixar estoque na hora e sai da fila — o placar desconta na frente do dono. &quot;Ignorar&quot; é pra o que não baixa mesmo (taxa de entrega, embalagem). A sugestão aparece quando existe ficha com nome igual ou apelido — clicável, nunca automática.</Info>
        </div>
        <div className="bc-filtros">
          {FILTROS_DA_BANCADA.map((f) => (
            <button key={f.chave} type="button" className={filtro === f.chave ? 'on' : ''} onClick={() => setFiltro(f.chave)}>{f.rotulo}<span className="fn num">{contagem[f.chave]}</span></button>
          ))}
        </div>
        <div className="bc-bhead"><span>Nome</span><span className="dir">Vendido 30d</span><span className="dir">R$ 30d</span><span className="dir"></span></div>
        {visiveis.length === 0 && <p className="rx-vazio">{filtro === 'TUDO' && !busca ? 'Fila vazia — todo nome vendido nos 30 dias baixa estoque ou foi ignorado.' : 'Nada neste filtro.'}</p>}
        {visiveis.map((l) => (
          <div className="bc-brow" key={l.chave} data-testid="bancada-linha">
            <div className="nm">{l.nome}<span className={`bc-tipo ${l.tipo === 'PRODUTO' ? 'p' : 'c'}`}>{l.tipo === 'PRODUTO' ? 'produto' : 'complemento'}</span>
              {l.estado === 'PENDENTE' && l.sugestao && (
                <span className="sug">parece com <button type="button" disabled={ocupado === l.chave}
                  onClick={() => decidir(l, { acao: 'FICHA', fichaId: l.sugestao!.fichaId, nomeFicha: l.sugestao!.nomeFicha })}>mapear na ficha “{l.sugestao.nomeFicha}” →</button> <small>({l.sugestao.motivo})</small></span>
              )}
              {l.estado === 'PENDENTE' && l.casca && (
                <span className="sug">casca: os sabores {l.casca.sabores.join(', ')} já baixam — <button type="button" disabled={ocupado === l.chave}
                  onClick={() => decidir(l, { acao: 'IGNORAR' })}>ignorar esta casca →</button></span>
              )}
              {l.estado === 'RESOLVIDO' && <span className="feito">baixa pela ficha “{l.nomeFicha ?? 'ficha'}”</span>}
              {l.estado === 'IGNORADO' && <span className="sug">ignorado — não baixa estoque</span>}
            </div>
            <div className="metawrap">
              <div className="qt num">{l.qt.toLocaleString('pt-BR')} <small>{l.tipo === 'COMPLEMENTO' ? 'ocorr.' : 'un'}</small></div>
              <div className="rs num">{l.rs > 0 ? brl0(l.rs) : <span className="inc">incluso no preço</span>}</div>
            </div>
            <div className="acoes">
              {l.estado === 'PENDENTE' ? <>
                <button type="button" className="pri" disabled={ocupado === l.chave} onClick={() => { setApontando(apontando === l.chave ? null : l.chave); setTermo('') }}>apontar ficha…</button>
                <a href={linkCriarFicha(id, l)}>criar ficha →</a>
                <button type="button" disabled={ocupado === l.chave} onClick={() => decidir(l, { acao: 'IGNORAR' })}>ignorar</button>
              </> : (
                <button type="button" disabled={ocupado === l.chave} onClick={() => decidir(l, { acao: 'DESFAZER' })}>desfazer</button>
              )}
              {apontando === l.chave && (
                <div className="bc-apontar" role="dialog" aria-label="apontar ficha">
                  <input autoFocus placeholder="buscar ficha" value={termo} onChange={(e) => setTermo(e.target.value)} />
                  <ul>
                    {fichasPara(l).map((f) => (
                      <li key={f.id}><button type="button" onClick={() => decidir(l, { acao: 'FICHA', fichaId: f.id, nomeFicha: f.nomeProduzido })}>{f.nomeProduzido}</button></li>
                    ))}
                    {fichasPara(l).length === 0 && <li className="vz">nenhuma ficha com esse nome — use “criar ficha →”</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
