'use client'
// ⭐⭐ R43 — GERENCIAR ZONAS (do dono). Lei v3: docs/contagem-referencia.html.
// Criar, renomear, EXCLUIR (⛔ nunca apaga item: os itens ficam "sem zona" e a confirmação diz
// QUANTOS); adicionar item pela busca, remover na linha, ARRASTAR a ordem (o caminho que a
// equipe anda), e o GRUPO A/B/C do item ali mesmo. "Sem zona" fica no fim, pra realocar.
// O ritmo por grupo (padrão A todo dia · B semanal · C mensal) também se edita aqui.
import { use, useEffect, useState } from 'react'
import { Loader2, GripVertical, X } from 'lucide-react'
import { casaBusca } from '@/lib/busca-texto'
import { usePermissoes } from '@/lib/hooks/use-permissoes'
import type { ZonasDoDono } from '@/lib/stock/contagem/zonas'
import type { Posto } from '@/lib/stock/contagem/direcao-dados'

type G = 'A' | 'B' | 'C' | null
const btn = 'h-[29px] rounded-lg border px-2.5 text-[11px] font-extrabold disabled:opacity-50'
const btnSty = { borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }

function Grupo({ g, onG, desabilitado }: { g: G; onG: (g: 'A' | 'B' | 'C') => void; desabilitado: boolean }) {
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-md border" style={{ borderColor: 'var(--prod-line-strong)' }} data-testid="grupo-do-item">
      {(['A', 'B', 'C'] as const).map((x) => (
        <button key={x} type="button" disabled={desabilitado} onClick={() => onG(x)} aria-pressed={g === x}
          className="h-6 w-6 text-[11px] font-extrabold" style={g === x ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' } : { color: 'var(--prod-muted)' }}>{x}</button>
      ))}
    </span>
  )
}

export default function ZonasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { pode } = usePermissoes(id)
  const dono = pode('stock.manage')
  const [d, setD] = useState<ZonasDoDono | null>(null)
  const [ritmo, setRitmo] = useState<{ A: number; B: number; C: number } | null>(null)
  const [nova, setNova] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null)
  const [excluindo, setExcluindo] = useState<{ id: string; nome: string; itens: number } | null>(null)
  const [busca, setBusca] = useState('')
  const [buscaSem, setBuscaSem] = useState('')
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/contagem/zonas`).then((r) => r.json()).then(setD).catch(() => setErro('A rede falhou ao carregar as zonas.'))
  useEffect(() => {
    carregar()
    fetch(`/api/empresas/${id}/estoque/contagem/posto`).then((r) => (r.ok ? r.json() : null)).then((j: { posto?: Posto } | null) => { if (j?.posto) setRitmo(j.posto.ritmo) }).catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function chamar(url: string, method: string, body?: unknown) {
    setOcupado(true); setErro(null)
    try {
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'O sistema falhou e não devolveu o motivo — isso é defeito nosso, não seu.'); return null }
      await carregar()
      return j
    } catch { setErro('A rede falhou — nada mudou; tente de novo.'); return null } finally { setOcupado(false) }
  }
  const base = `/api/empresas/${id}/estoque/contagem`
  const criar = async () => { if ((await chamar(`${base}/zonas`, 'POST', { nome: nova }))) setNova('') }
  const grupo = (itemId: string, g: 'A' | 'B' | 'C') => chamar(`${base}/grupo`, 'PUT', { itemId, grupo: g })
  const adicionar = (zonaId: string, itemId: string) => { setBusca(''); return chamar(`${base}/zonas/${zonaId}/itens`, 'POST', { itemId }) }
  const remover = (zonaId: string, itemId: string) => chamar(`${base}/zonas/${zonaId}/itens`, 'DELETE', { itemId })
  async function pedirExclusao(z: { id: string; nome: string }) {
    // ⭐ a confirmação diz QUANTOS itens ficam sem zona — contado pelo servidor, na hora
    const j = await fetch(`${base}/zonas/${z.id}`).then((r) => r.json()).catch(() => null)
    setExcluindo({ ...z, itens: j?.itens ?? 0 })
  }
  async function mover(zonaId: string, de: number, para: number) {
    const z = d?.zonas.find((x) => x.id === zonaId)
    if (!z || de === para) return
    const ids = z.itens.map((i) => i.itemId)
    const [m] = ids.splice(de, 1)
    ids.splice(para, 0, m)
    setD((s) => s && { ...s, zonas: s.zonas.map((x) => x.id === zonaId ? { ...x, itens: ids.map((i) => x.itens.find((y) => y.itemId === i)!) } : x) })
    await chamar(`${base}/zonas/${zonaId}/itens`, 'PUT', { itemIds: ids })
  }

  if (!d) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--prod-muted)' }} /></div>
  const zonaNome = new Map(d.zonas.map((z) => [z.id, z.nome]))

  return (
    <div className="space-y-3 pb-8" data-testid="gerenciar-zonas">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-[21px] font-extrabold" style={{ color: 'var(--prod-primary)' }}>Zonas e grupos</h1>
        <a href={`/empresas/${id}/estoque/contagem`} className="ml-auto text-xs font-extrabold" style={{ color: 'var(--fam-indigo-ink)' }}>← contagem</a>
      </div>
      <p className="text-xs" style={{ color: 'var(--prod-muted)' }}>
        Criar, renomear e excluir zonas é teu. Excluir zona nunca apaga item: os itens dela ficam “sem zona” e
        aparecem no fim pra realocar. A ordem dos itens é a ordem em que vocês andam pelo estoque — arrasta pra ajustar.
      </p>
      {erro && <p className="rounded-md px-3 py-2 text-xs" style={{ background: 'var(--fam-coral-bg)', color: 'var(--fam-coral-ink)' }}>{erro}</p>}

      {/* ritmo por grupo (R36/R43) */}
      {ritmo && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] border px-3 py-2.5 text-xs font-bold" style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-secondary)' }} data-testid="ritmo">
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: 'var(--prod-muted)' }}>Ritmo</span>
          {(['A', 'B', 'C'] as const).map((g) => (
            <label key={g} className="inline-flex items-center gap-1">grupo {g}: a cada
              <input type="text" inputMode="numeric" value={ritmo[g]} disabled={!dono}
                onChange={(e) => setRitmo({ ...ritmo, [g]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                className="h-7 w-12 rounded-md border text-center tabular-nums" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
              dia(s)
            </label>
          ))}
          {dono && <button className={btn} style={btnSty} disabled={ocupado} onClick={() => chamar(`${base}/ritmo`, 'PUT', ritmo)}>salvar ritmo</button>}
        </div>
      )}

      {dono && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="nova-zona" className="text-[9.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: 'var(--prod-muted)' }}>Nova zona</label>
          <input id="nova-zona" value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nova.trim()) criar() }} placeholder="nome da nova zona"
            className="h-9 flex-1 rounded-[9px] border px-3 text-[13px] font-bold" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
          <button onClick={criar} disabled={!nova.trim() || ocupado} className="h-9 rounded-[10px] px-4 text-[13px] font-extrabold disabled:opacity-50" style={{ background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }}>Criar zona</button>
        </div>
      )}

      {d.zonas.map((z) => (
        <div key={z.id} className="overflow-hidden rounded-[12px] border" style={{ borderColor: 'var(--prod-line-strong)' }} data-zona={z.nome}>
          <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
            {renomeando?.id === z.id ? (
              <>
                <input autoFocus value={renomeando.nome} onChange={(e) => setRenomeando({ ...renomeando, nome: e.target.value })}
                  className="h-8 min-w-0 flex-1 rounded-md border px-2 text-[13px] font-bold" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
                <button className={btn} style={btnSty} disabled={ocupado} onClick={async () => { if (await chamar(`${base}/zonas/${z.id}`, 'PATCH', { nome: renomeando.nome })) setRenomeando(null) }}>salvar</button>
                <button className={btn} style={btnSty} onClick={() => setRenomeando(null)}>cancelar</button>
              </>
            ) : (
              <>
                <button className="text-[13.5px] font-extrabold" style={{ color: 'var(--prod-primary)' }} onClick={() => setAberta(aberta === z.id ? null : z.id)}>{z.nome}</button>
                <span className="text-[11.5px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>{z.itens.length} {z.itens.length === 1 ? 'item' : 'itens'}</span>
                <span className="flex-1" />
                <button className={btn} style={btnSty} onClick={() => setAberta(aberta === z.id ? null : z.id)}>{aberta === z.id ? 'fechar' : 'itens'}</button>
                {dono && <button className={btn} style={btnSty} onClick={() => setRenomeando({ id: z.id, nome: z.nome })}>renomear</button>}
                {dono && <button className={btn} style={{ ...btnSty, color: 'var(--fam-coral-ink)' }} onClick={() => pedirExclusao(z)} data-testid="excluir-zona">excluir</button>}
              </>
            )}
          </div>
          {aberta === z.id && (
            <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
              {dono && (
                <div className="relative mb-2">
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="⌕ adicionar item à zona…"
                    className="h-[34px] w-full rounded-[9px] border px-3 text-[12.5px] font-bold" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
                  {busca.trim() && (
                    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border shadow" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)' }}>
                      {d.itens.filter((i) => i.zonaId !== z.id && casaBusca(i.nome, busca)).slice(0, 20).map((i) => (
                        <li key={i.itemId}>
                          <button onClick={() => adicionar(z.id, i.itemId)} className="flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] font-bold" style={{ color: 'var(--prod-primary)' }}>
                            {i.nome}<span className="text-[10.5px]" style={{ color: 'var(--prod-muted)' }}>{i.zonaId ? `mora em ${zonaNome.get(i.zonaId)} — muda pra cá` : 'sem zona'}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {z.itens.length === 0 && <p className="py-2 text-xs" style={{ color: 'var(--prod-muted)' }}>nenhum item ainda — busque acima pra adicionar.</p>}
              {z.itens.map((i, k) => (
                <div key={i.itemId} className="flex items-center gap-2.5 border-b py-[7px] text-[13px] font-bold last:border-b-0" style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-primary)', opacity: arrastando === k ? 0.5 : 1 }}
                  draggable={dono} onDragStart={() => setArrastando(k)} onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (arrastando != null) mover(z.id, arrastando, k); setArrastando(null) }} onDragEnd={() => setArrastando(null)}>
                  {dono && <GripVertical className="h-4 w-4 shrink-0 cursor-grab" style={{ color: 'var(--prod-muted)' }} />}
                  <span className="flex-1">{i.nome}</span>
                  <Grupo g={i.grupo} onG={(g) => grupo(i.itemId, g)} desabilitado={!dono || ocupado} />
                  {dono && <button aria-label={`tirar ${i.nome} da zona`} onClick={() => remover(z.id, i.itemId)} style={{ color: 'var(--prod-muted)' }}><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
              {z.itens.length > 1 && dono && <p className="pt-2 text-[11px] font-bold" style={{ color: 'var(--prod-muted)' }}>arrasta pra mudar a ordem</p>}
            </div>
          )}
        </div>
      ))}

      {/* ⛔ R43 — SEM ZONA: nunca some; entra no fim do "conta hoje" até ganhar casa */}
      <div className="overflow-hidden rounded-[12px] border border-dashed" style={{ borderColor: 'var(--prod-line-strong)' }} data-testid="sem-zona">
        <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
          <span className="text-[13.5px] font-extrabold" style={{ color: 'var(--fam-ambar-ink)' }}>sem zona</span>
          <span className="text-[11.5px] font-bold tabular-nums" style={{ color: 'var(--prod-muted)' }}>{d.semZona.length} itens</span>
          <span className="flex-1" />
          <span className="text-[10.5px] font-bold" style={{ color: 'var(--prod-muted)' }}>entram no fim do “conta hoje” até ganhar casa</span>
        </div>
        {d.semZona.length > 0 && (
          <div className="border-t px-3 py-2.5" style={{ borderColor: 'var(--prod-line)', background: 'var(--prod-surface-1)' }}>
            <input value={buscaSem} onChange={(e) => setBuscaSem(e.target.value)} placeholder="⌕ procurar nos sem zona…"
              className="mb-2 h-[34px] w-full rounded-[9px] border px-3 text-[12.5px] font-bold" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
            {d.semZona.filter((i) => casaBusca(i.nome, buscaSem)).slice(0, 40).map((i) => (
              <div key={i.itemId} className="flex flex-wrap items-center gap-2.5 border-b py-[7px] text-[13px] font-bold last:border-b-0" style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-primary)' }}>
                <span className="flex-1">{i.nome}</span>
                <Grupo g={i.grupo} onG={(g) => grupo(i.itemId, g)} desabilitado={!dono || ocupado} />
                {dono && d.zonas.length > 0 && (
                  <select defaultValue="" onChange={(e) => { if (e.target.value) adicionar(e.target.value, i.itemId) }} aria-label={`zona de ${i.nome}`}
                    className="h-7 rounded-md border px-1 text-[11px] font-bold" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }}>
                    <option value="">mover pra…</option>
                    {d.zonas.map((z) => <option key={z.id} value={z.id}>{z.nome}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⛔ a confirmação de EXCLUIR diz QUANTOS itens ficam sem zona — e que nenhum é apagado */}
      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setExcluindo(null)}>
          <div className="w-full rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl" style={{ background: 'var(--prod-surface)' }} onClick={(e) => e.stopPropagation()} data-testid="confirmar-excluir-zona">
            <p className="text-sm font-semibold" style={{ color: 'var(--prod-primary)' }}>
              Excluir a zona “{excluindo.nome}”? {excluindo.itens === 0 ? 'Ela não tem itens.' : `Os ${excluindo.itens} ${excluindo.itens === 1 ? 'item dela fica' : 'itens dela ficam'} “sem zona”`} — nenhum item é apagado.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="h-10 flex-1 rounded-lg border text-sm" style={{ borderColor: 'var(--prod-line-strong)', color: 'var(--prod-primary)' }} onClick={() => setExcluindo(null)}>cancelar</button>
              <button className="h-10 flex-1 rounded-lg text-sm font-semibold disabled:opacity-50" disabled={ocupado} style={{ background: 'var(--fam-coral-solid)', color: 'var(--fam-coral-on)' }}
                onClick={async () => { if (await chamar(`${base}/zonas/${excluindo.id}`, 'DELETE')) setExcluindo(null) }}>excluir a zona</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
