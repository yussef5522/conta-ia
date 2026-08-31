'use client'

// ⭐ O TRILHO — contexto sem distração (31/08/2026).
//
// No notebook sobra largura; um cartão sozinho no meio da tela desperdiça ela. O trilho
// mostra o que vem e o que já passou, e deixa PULAR pro item que a pessoa tem na mão —
// que é o atalho que "um item por vez" tira de quem conta.
//
// ⚠️⚠️ E ELE **NÃO MOSTRA O SALDO DO SISTEMA**. Nem nos já contados. Se mostrasse, a
// contagem cega morreria pela porta dos fundos: bastaria olhar de canto pra ver o número
// antes de digitar. O que aparece do que já passou é **o que ELA contou** — o trabalho
// dela, não o gabarito.
//
// ⚠️ ARRASTAR AQUI GRAVA O CAMINHO FÍSICO do estoque (câmara → freezer → seco). Ninguém
// preenche 91 campos à mão: a primeira contagem estabelece o caminho andando.

import { useState } from 'react'
import { GripVertical, Check, HelpCircle, SkipForward, Search } from 'lucide-react'

export interface ItemTrilho {
  itemId: string
  titulo: string
  especificacao: string
  unidadeControle: string
  estado: 'CONTADO' | 'NAO_SEI' | 'PULADO' | null
  contado: { qtdContada: number } | null
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function TrilhoFila({
  itens, atualId, onIr, onMover, podeReordenar,
}: {
  itens: ItemTrilho[]
  atualId: string | null
  onIr: (itemId: string) => void
  onMover: (de: number, para: number) => void
  /** reordenar o caminho é `stock.manage` — vale pra TODA contagem futura */
  podeReordenar: boolean
}) {
  const [busca, setBusca] = useState('')
  const [arrastando, setArrastando] = useState<number | null>(null)

  const q = busca.trim().toLowerCase()
  const visiveis = q
    ? itens.map((i, k) => ({ i, k })).filter(({ i }) => `${i.titulo} ${i.especificacao}`.toLowerCase().includes(q))
    : itens.map((i, k) => ({ i, k }))

  const pendentes = visiveis.filter(({ i }) => !i.estado)
  const passados = visiveis.filter(({ i }) => i.estado)

  const Linha = ({ i, k }: { i: ItemTrilho; k: number }) => (
    <li
      draggable={podeReordenar && !q}
      onDragStart={() => setArrastando(k)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (arrastando !== null) onMover(arrastando, k); setArrastando(null) }}
      onDragEnd={() => setArrastando(null)}
      className={`flex items-center gap-1 rounded-md px-1 py-1 text-[12px] ${
        i.itemId === atualId ? 'bg-sky-50 ring-1 ring-sky-300' : 'hover:bg-slate-50'
      } ${arrastando === k ? 'opacity-40' : ''}`}
    >
      {podeReordenar && !q && <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-slate-300" aria-hidden />}
      <button type="button" onClick={() => onIr(i.itemId)} className="min-w-0 flex-1 truncate text-left text-slate-700">
        {i.titulo}
      </button>
      {/* ⚠️ o que aparece é o que ELA contou — nunca o saldo do sistema (contagem cega) */}
      {i.estado === 'CONTADO' && i.contado && (
        <span className="shrink-0 tabular-nums text-[11px] text-emerald-700">
          <Check className="mr-0.5 inline h-3 w-3" />{num(i.contado.qtdContada)} {i.unidadeControle}
        </span>
      )}
      {i.estado === 'NAO_SEI' && (
        <span className="shrink-0 text-[11px] text-amber-600"><HelpCircle className="mr-0.5 inline h-3 w-3" />a apurar</span>
      )}
      {i.estado === 'PULADO' && (
        <span className="shrink-0 text-[11px] text-slate-400"><SkipForward className="mr-0.5 inline h-3 w-3" />pulado</span>
      )}
    </li>
  )

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="pular pro item que tenho na mão"
          className="h-8 w-full rounded-md border border-slate-300 pl-7 pr-2 text-[12px]" />
      </div>

      {pendentes.length > 0 && (
        <div>
          <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Próximos ({pendentes.length})
          </p>
          <ul className="space-y-px">{pendentes.slice(0, 40).map(({ i, k }) => <Linha key={i.itemId} i={i} k={k} />)}</ul>
        </div>
      )}

      {passados.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Já passaram ({passados.length}) — clica e volta
          </p>
          <ul className="space-y-px">{passados.slice(0, 40).map(({ i, k }) => <Linha key={i.itemId} i={i} k={k} />)}</ul>
        </div>
      )}

      {podeReordenar && !q && (
        <p className="px-1 text-[10px] leading-snug text-slate-400">
          Arraste pra deixar na ordem em que você <b>anda</b> pelo estoque. Fica guardado
          pras próximas contagens.
        </p>
      )}
    </div>
  )
}
