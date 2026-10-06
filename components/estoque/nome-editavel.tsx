'use client'

// ESTOQUE — nome editável inline (lápis). O nome é do DONO, não da nota. UM componente
// (REGRA 4) pra ficha e posição. Salva via PATCH /estoque/itens/[id].

import { useState } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

export function NomeEditavel({ companyId, itemId, nome, onSalvo, className, comLink }: {
  companyId: string; itemId: string; nome: string; onSalvo?: (n: string) => void
  className?: string; comLink?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nome)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    const n = valor.trim()
    if (!n || n === nome) { setEditando(false); return }
    setSalvando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: n }) })
      if (r.ok) onSalvo?.(n)
    } finally { setSalvando(false); setEditando(false) }
  }

  if (editando) return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input autoFocus value={valor} onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') { setValor(nome); setEditando(false) } }}
        className={`w-full rounded-md px-2 py-1 font-medium focus:outline-none ${className ?? ''}`}
        style={{ border: '1px solid var(--prod-accent)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }} />
      <button onClick={salvar} disabled={salvando} className="rounded p-1" style={{ color: 'var(--prod-verde)' }}>{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>
      <button onClick={() => { setValor(nome); setEditando(false) }} className="rounded p-1" style={{ color: 'var(--prod-muted)' }}><X className="h-4 w-4" /></button>
    </div>
  )
  return (
    <span className="group inline-flex items-center gap-1.5">
      {comLink ? <a href={`/empresas/${companyId}/estoque/itens/${itemId}`} className={`font-medium hover:underline ${className ?? ''}`} style={{ color: 'var(--prod-accent)' }}>{nome}</a>
        : <span className={`font-medium ${className ?? ''}`} style={{ color: 'var(--prod-primary)' }}>{nome}</span>}
      <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditando(true) }} title="Renomear" className="opacity-0 transition group-hover:opacity-100">
        <Pencil className="h-3.5 w-3.5" style={{ color: 'var(--prod-muted)' }} />
      </button>
    </span>
  )
}
