'use client'

// ⭐⭐ REDESIGNAR NA FILA, PELO HOJE (08/09/2026) — decisão do dono.
//
// *"Na FILA (ninguém começou): REDESIGNAR inline (trocar/tirar quem faz) — remanejo é decisão
// de manhã e a tela é o lugar dela."*
//
// ⛔ SÓ QUANDO NINGUÉM COMEÇOU. Etapa em andamento não se redesigna: o relógio já está
// correndo no nome de alguém, e trocar o nome por baixo do tempo medido seria escrever o
// trabalho de uma pessoa na conta de outra. Quem precisa mexer numa etapa iniciada usa os
// dois gestos do gerente, que registram o que aconteceu em vez de reescrever.
//
// ⚠️ E o teto de 2 vem de graça: a rota chama `designarParticipantes`, que valida na
// GRAVAÇÃO. A tela não repete a regra — ela só não oferece um terceiro campo.

import { useState } from 'react'
import { Check, Loader2, Users } from 'lucide-react'

export interface ColaboradorRef { id: string; nome: string }

interface Props {
  empresaId: string
  ordemId: string
  etapaId: string
  colaboradores: ColaboradorRef[]
  /** quem está designado hoje (0, 1 ou 2) — vem do SERVIDOR, não deduzido da tela */
  atuais: string[]
  onFeito: () => void
}

export function RedesignarInline({ empresaId, ordemId, etapaId, colaboradores, atuais, onFeito }: Props) {
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState<string[]>(atuais)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async () => {
    setBusy(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${empresaId}/estoque/producao/ordens/${ordemId}/etapas`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaId, colaboradorIds: sel.filter(Boolean) }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui redesignar.'); return }
      setAberto(false)
      onFeito()
    } finally { setBusy(false) }
  }

  if (!aberto) {
    return (
      <button onClick={() => { setSel(atuais); setAberto(true) }}
        className="shrink-0 text-[11.5px] text-slate-400 underline underline-offset-2 hover:text-slate-700">
        redesignar
      </button>
    )
  }

  // ⭐ dois campos, e só dois: o teto do desenho aprovado aparece como AUSÊNCIA de um
  // terceiro, não como aviso depois do clique.
  const campo = (i: number) => (
    <select
      key={i}
      value={sel[i] ?? ''}
      onChange={(e) => {
        const v = e.target.value
        setSel((s) => {
          const n = [...s]
          if (v) n[i] = v; else n.splice(i, 1)
          return n.filter(Boolean)
        })
      }}
      className="h-7 rounded-lg border border-slate-300 px-1.5 text-[12px]"
    >
      <option value="">{i === 0 ? '— ninguém' : '— sem segunda pessoa'}</option>
      {colaboradores
        // ⚠️ a mesma pessoa nos dois campos seria uma dupla de um — o select já não oferece
        .filter((c) => c.id === sel[i] || !sel.includes(c.id))
        .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  )

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Users className="h-3.5 w-3.5 text-slate-400" />
      {campo(0)}
      {campo(1)}
      <button onClick={salvar} disabled={busy}
        className="inline-flex h-7 items-center gap-1 rounded-lg bg-[#534AB7] px-2 text-[11.5px] font-semibold text-white disabled:opacity-40">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} salvar
      </button>
      <button onClick={() => setAberto(false)} className="text-[11.5px] text-slate-400 hover:text-slate-600">cancelar</button>
      {erro && <span className="text-[11.5px] text-rose-600">{erro}</span>}
    </span>
  )
}
