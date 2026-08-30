'use client'

// ⭐ AÇÕES EM MASSA DA POSIÇÃO (29/08/2026) — mesclar duplicados · arquivar.
//
// Os checkboxes já existiam na Posição e não faziam nada. Agora: seleciona 2 iguais →
// MESCLAR (com prévia do antes/depois, escolhendo qual fica); seleciona N → ARQUIVAR
// (some das listas, histórico fica).
//
// ⚠️ A PRÉVIA É OBRIGATÓRIA na mescla — o dono vê saldo, valor e o que MIGRA junto
// (mapeamentos de nota, de venda, fichas que apontam) antes de confirmar. Mexer no ledger
// sem mostrar o antes/depois é o oposto do que este módulo faz.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Merge, Archive, X } from 'lucide-react'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface ItemSel { itemId: string; nome: string; saldo: number; valor: number; unidadeControle: string }

interface Previa {
  sobrevivente: { id: string; nome: string; saldo: number; valor: number; movimentos: number }
  absorvido: { id: string; nome: string; saldo: number; valor: number; movimentos: number }
  depois: { saldo: number; valor: number; custoMedio: number | null }
  unidadeControle: string
  mapasDeNota: number
  mapasDeVenda: number
  fichasQueApontam: { fichaId: string; nome: string }[]
  avisos: string[]
}

export function AcoesItens({ companyId, selecionados, onLimpar, onFeito }: {
  companyId: string
  selecionados: ItemSel[]
  onLimpar: () => void
  onFeito: () => void
}) {
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [inverter, setInverter] = useState(false) // qual dos 2 sobrevive
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [arquivando, setArquivando] = useState(false)

  if (selecionados.length === 0) return null
  const podeMesclar = selecionados.length === 2

  async function abrirPrevia(inverte = false) {
    setErro(null); setCarregando(true)
    const [a, b] = inverte ? [selecionados[1], selecionados[0]] : selecionados
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/mesclar?sobrevivente=${a.itemId}&absorvido=${b.itemId}`)
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não foi possível montar a prévia.'); return }
      setPrevia(j.previa); setInverter(inverte)
    } finally { setCarregando(false) }
  }

  async function confirmarMescla() {
    if (!previa) return
    setCarregando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/mesclar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sobreviventeId: previa.sobrevivente.id, absorvidoId: previa.absorvido.id }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não foi possível mesclar.'); return }
      setPrevia(null); onLimpar(); onFeito()
    } finally { setCarregando(false) }
  }

  async function arquivar() {
    setArquivando(true); setErro(null)
    try {
      for (const it of selecionados) {
        let r = await fetch(`/api/empresas/${companyId}/estoque/itens/${it.itemId}/arquivar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ arquivar: true }),
        })
        if (r.status === 409) {
          // ⚠️ 409 = precisa confirmar (tem saldo ou está em ficha ativa) — mostra o
          // motivo e pergunta, nunca arquiva por baixo do pano.
          const j = await r.json().catch(() => null)
          if (!window.confirm(`${it.nome}\n\n${j?.erro ?? ''}\n\nArquivar mesmo assim?`)) continue
          r = await fetch(`/api/empresas/${companyId}/estoque/itens/${it.itemId}/arquivar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arquivar: true, confirmado: true }),
          })
        }
        if (!r.ok) {
          const j = await r.json().catch(() => null)
          setErro(j?.erro ?? `Não foi possível arquivar "${it.nome}".`)
          return
        }
      }
      onLimpar(); onFeito()
    } finally { setArquivando(false) }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:left-60 dark:bg-slate-900/95 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-xs text-slate-500">
            <b className="text-slate-800 dark:text-slate-200">{selecionados.length}</b> selecionado(s)
          </span>
          {erro && <span className="text-xs text-rose-600">{erro}</span>}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={onLimpar}>limpar</Button>
            <Button
              variant="outline" size="sm" className="h-8"
              disabled={!podeMesclar || carregando}
              title={podeMesclar ? 'juntar dois itens duplicados' : 'selecione exatamente 2 itens'}
              onClick={() => abrirPrevia(false)}
            >
              {carregando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Merge className="h-3 w-3 mr-1" />}
              Mesclar
            </Button>
            <Button variant="outline" size="sm" className="h-8" disabled={arquivando} onClick={arquivar}>
              {arquivando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Archive className="h-3 w-3 mr-1" />}
              Arquivar
            </Button>
          </div>
        </div>
      </div>

      {previa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setPrevia(null)}>
          <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Mesclar itens</h3>
                <p className="text-xs text-slate-500">O saldo soma e o valor em estoque não muda.</p>
              </div>
              <button onClick={() => setPrevia(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-4 space-y-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Fica</p>
                <p className="font-medium">{previa.sobrevivente.nome}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {previa.sobrevivente.saldo} {previa.unidadeControle} · {brl(previa.sobrevivente.valor)} · {previa.sobrevivente.movimentos} movimento(s)
                </p>
              </div>
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">É absorvido (some das listas)</p>
                <p className="font-medium">{previa.absorvido.nome}</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  {previa.absorvido.saldo} {previa.unidadeControle} · {brl(previa.absorvido.valor)} · {previa.absorvido.movimentos} movimento(s)
                </p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => abrirPrevia(!inverter)}>
                trocar: deixar o outro sobreviver
              </Button>

              <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-medium">Depois</p>
                <p className="tabular-nums">
                  <b>{previa.depois.saldo} {previa.unidadeControle}</b> · <b>{brl(previa.depois.valor)}</b>
                  {previa.depois.custoMedio != null && <> · custo médio {brl(previa.depois.custoMedio)}</>}
                </p>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">
                  O valor é a soma dos dois — mesclar junta pilhas, não cria nem destrói estoque.
                </p>
              </div>

              {(previa.mapasDeNota > 0 || previa.mapasDeVenda > 0 || previa.fichasQueApontam.length > 0) && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Migram junto: {[
                    previa.mapasDeNota ? `${previa.mapasDeNota} mapeamento(s) de nota` : null,
                    previa.mapasDeVenda ? `${previa.mapasDeVenda} de venda` : null,
                    previa.fichasQueApontam.length ? `${previa.fichasQueApontam.length} ficha(s)` : null,
                  ].filter(Boolean).join(' · ')}.
                </p>
              )}
              {previa.avisos.map((a, i) => (
                <p key={i} className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-md p-2">⚠️ {a}</p>
              ))}
              {erro && <p className="text-xs text-rose-600">{erro}</p>}
            </div>

            <div className="border-t px-4 py-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrevia(null)}>Cancelar</Button>
              <Button size="sm" disabled={carregando} onClick={confirmarMescla}>
                {carregando ? 'Mesclando…' : 'Mesclar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
