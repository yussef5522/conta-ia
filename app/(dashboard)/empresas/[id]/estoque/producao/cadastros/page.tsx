'use client'

// ESTOQUE FASE 2 item 2.0 — cadastros mínimos da produção: SETORES (só COZINHA por ora) e
// COLABORADORES (só nome). Lista simples + adicionar. A produção (2.1+) usa isto.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Plus, Factory, Users } from 'lucide-react'

interface Row { id: string; nome: string; ativo: boolean }

export default function CadastrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/fichas`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pras fichas</a>
      <h1 className="text-xl font-semibold text-slate-900">Setores e colaboradores</h1>
      <p className="text-sm text-slate-500">Cadastros mínimos que a produção vai usar. Comece só com a Cozinha e os nomes de quem produz.</p>
      <Cadastro companyId={id} titulo="Setores de produção" icone={<Factory className="h-4 w-4" />} rota="setores" chave="setores" chaveItem="setor" placeholder="ex: Cozinha" sugestao="Cozinha" />
      <Cadastro companyId={id} titulo="Colaboradores" icone={<Users className="h-4 w-4" />} rota="colaboradores" chave="colaboradores" chaveItem="colaborador" placeholder="nome de quem produz" />
    </div>
  )
}

function Cadastro({ companyId, titulo, icone, rota, chave, chaveItem, placeholder, sugestao }: { companyId: string; titulo: string; icone: React.ReactNode; rota: string; chave: string; chaveItem: string; placeholder: string; sugestao?: string }) {
  const [rows, setRows] = useState<Row[] | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [busy, setBusy] = useState(false)

  const carregar = () => fetch(`/api/empresas/${companyId}/estoque/${rota}`).then((r) => r.json()).then((j) => setRows(j[chave] ?? [])).catch(() => setRows(null))
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (valor?: string) => {
    const n = (valor ?? nome).trim()
    if (!n) return
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: n }) })
      if (r.ok) { setNome(''); carregar() }
    } finally { setBusy(false) }
  }

  return (
    <Card><CardContent className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">{icone} {titulo}</p>
      {rows === undefined ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : (
        <div className="space-y-1">
          {(rows ?? []).length === 0 && <p className="text-xs text-slate-400">Nenhum ainda.{sugestao && <button onClick={() => add(sugestao)} className="ml-1 text-[#185FA5] hover:underline">adicionar {sugestao}</button>}</p>}
          {(rows ?? []).map((r) => <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700">{r.nome}</div>)}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={placeholder} className="flex-1 rounded-lg border border-slate-300 py-2 px-3 text-sm" />
        <button onClick={() => add()} disabled={busy || !nome.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#185FA5] px-3 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50"><Plus className="h-4 w-4" /> add</button>
      </div>
    </CardContent></Card>
  )
}
