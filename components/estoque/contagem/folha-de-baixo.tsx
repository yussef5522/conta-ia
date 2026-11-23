'use client'
// ⭐ R39 — CELULAR É A TELA PRINCIPAL (lei v3, docs/contagem-referencia.html): busca, zonas e
// próximos numa FOLHA DE BAIXO — o que no computador é o trilho ao lado, no celular sobe do
// rodapé sem tirar o cartão de contar do lugar.
import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { casaBusca } from '@/lib/busca-texto'
import type { CartaoDeZona } from '@/lib/stock/contagem/direcao-dados'

interface LinhaFolha { itemId: string; nome: string; estado: string | null; unidadeControle: string }

export function FolhaDeBaixo({ aba, onAba, onFechar, linhas, todas, atualId, zonas, escopo, onIr, onEscopo }: {
  aba: 'busca' | 'zonas' | 'proximos'
  onAba: (a: 'busca' | 'zonas' | 'proximos') => void
  onFechar: () => void
  /** as linhas do ESCOPO (próximos) */
  linhas: LinhaFolha[]
  /** todas as linhas (a busca alcança qualquer item) */
  todas: LinhaFolha[]
  atualId: string | null
  zonas: CartaoDeZona[]
  escopo: string
  onIr: (itemId: string) => void
  onEscopo: (escopo: string) => void
}) {
  const [termo, setTermo] = useState('')
  const proximos = linhas.filter((l) => !l.estado && l.itemId !== atualId)
  const achados = termo.trim() ? todas.filter((l) => casaBusca(l.nome, termo)).slice(0, 30) : []
  const abaCls = (a: string) => `h-8 flex-1 rounded-lg text-xs font-extrabold ${aba === a ? '' : ''}`
  const abaSty = (a: string) => (aba === a
    ? { background: 'var(--prod-acao-bg)', color: 'var(--prod-acao-ink)' }
    : { color: 'var(--prod-muted)' })
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onFechar} data-testid="folha-de-baixo">
      <div className="max-h-[78vh] w-full overflow-y-auto rounded-t-2xl p-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]"
        style={{ background: 'var(--prod-surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-1">
          <button className={abaCls('busca')} style={abaSty('busca')} onClick={() => onAba('busca')}>buscar</button>
          <button className={abaCls('zonas')} style={abaSty('zonas')} onClick={() => onAba('zonas')}>zonas</button>
          <button className={abaCls('proximos')} style={abaSty('proximos')} onClick={() => onAba('proximos')}>próximos ({proximos.length})</button>
          <button onClick={onFechar} aria-label="fechar" className="ml-1 h-8 w-8 shrink-0 rounded-lg" style={{ color: 'var(--prod-muted)' }}><X className="mx-auto h-4 w-4" /></button>
        </div>

        {aba === 'busca' && (
          <>
            <input autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="buscar o item pelo nome…"
              className="h-10 w-full rounded-lg border px-3 text-sm" style={{ borderColor: 'var(--prod-line-strong)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
            <ul className="mt-2">
              {achados.map((l) => (
                <li key={l.itemId}>
                  <button onClick={() => onIr(l.itemId)} className="flex w-full items-center gap-2 border-b px-1 py-2.5 text-left text-[13px] font-bold" style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-primary)' }}>
                    {l.estado ? <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fam-verde-mid)' }} /> : <span className="w-3.5" />}
                    <span className="flex-1">{l.nome}</span><span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>{l.unidadeControle}</span>
                  </button>
                </li>
              ))}
              {termo.trim() && achados.length === 0 && <li className="px-1 py-3 text-xs" style={{ color: 'var(--prod-muted)' }}>nada com “{termo}”.</li>}
            </ul>
          </>
        )}

        {aba === 'zonas' && (
          <ul>
            <li>
              <button onClick={() => onEscopo('hoje')} className="flex w-full items-center justify-between border-b px-1 py-2.5 text-left text-[13px] font-extrabold" style={{ borderColor: 'var(--prod-line)', color: escopo === 'hoje' ? 'var(--fam-indigo-ink)' : 'var(--prod-primary)' }}>
                o que conta hoje
              </button>
            </li>
            {zonas.map((z) => (
              <li key={z.chave}>
                <button onClick={() => onEscopo(`zona:${z.chave}`)} disabled={z.hoje === 0} className="flex w-full items-center justify-between border-b px-1 py-2.5 text-left text-[13px] font-bold disabled:opacity-50"
                  style={{ borderColor: 'var(--prod-line)', color: escopo === `zona:${z.chave}` ? 'var(--fam-indigo-ink)' : 'var(--prod-primary)' }}>
                  <span>{z.nome}{z.aoVivo ? ` · ${z.aoVivo} contando` : ''}</span>
                  <span className="tabular-nums text-xs" style={{ color: 'var(--prod-muted)' }}>{z.hoje === 0 ? 'nada pra hoje' : `${z.feitos}/${z.hoje}`}{z.assinada ? ' · fechada' : ''}</span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => onEscopo('tudo')} className="flex w-full items-center justify-between px-1 py-2.5 text-left text-[13px] font-bold" style={{ color: escopo === 'tudo' ? 'var(--fam-indigo-ink)' : 'var(--prod-secondary)' }}>
                contar tudo ({todas.length})
              </button>
            </li>
          </ul>
        )}

        {aba === 'proximos' && (
          <ul>
            {proximos.slice(0, 40).map((l) => (
              <li key={l.itemId}>
                <button onClick={() => onIr(l.itemId)} className="flex w-full items-center justify-between border-b px-1 py-2.5 text-left text-[13px] font-bold" style={{ borderColor: 'var(--prod-line)', color: 'var(--prod-primary)' }}>
                  <span>{l.nome}</span><span className="text-[11px]" style={{ color: 'var(--prod-muted)' }}>{l.unidadeControle}</span>
                </button>
              </li>
            ))}
            {proximos.length === 0 && <li className="px-1 py-3 text-xs" style={{ color: 'var(--prod-muted)' }}>nenhum outro pendente aqui ✓</li>}
          </ul>
        )}
      </div>
    </div>
  )
}
