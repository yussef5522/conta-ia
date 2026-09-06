'use client'

// ESTOQUE FASE 2 item 2.0 — cadastros mínimos da produção: SETORES (só COZINHA por ora) e
// COLABORADORES (só nome). Lista simples + adicionar. A produção (2.1+) usa isto.

import { useEffect, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2, Plus, Factory, Users, KeyRound, Check } from 'lucide-react'

interface Row { id: string; nome: string; ativo: boolean }

export default function CadastrosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <a href={`/empresas/${id}/estoque/producao`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"><ArrowLeft className="h-3.5 w-3.5" /> voltar pra Produção</a>
      <h1 className="text-xl font-semibold text-slate-900">Setores e colaboradores</h1>
      <p className="text-sm text-slate-500">Cadastros mínimos que a produção vai usar. Comece só com a Cozinha e os nomes de quem produz.</p>
      <Cadastro companyId={id} titulo="Setores de produção" icone={<Factory className="h-4 w-4" />} rota="setores" chave="setores" chaveItem="setor" placeholder="ex: Cozinha" sugestao="Cozinha" />
      <Cadastro companyId={id} titulo="Colaboradores" icone={<Users className="h-4 w-4" />} rota="colaboradores" chave="colaboradores" chaveItem="colaborador" placeholder="nome de quem produz" comPin />
    </div>
  )
}

function Cadastro({ companyId, titulo, icone, rota, chave, chaveItem, placeholder, sugestao, comPin }: { companyId: string; titulo: string; icone: React.ReactNode; rota: string; chave: string; chaveItem: string; placeholder: string; sugestao?: string; comPin?: boolean }) {
  const [rows, setRows] = useState<Row[] | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [busy, setBusy] = useState(false)
  // ⭐ quem TEM PIN — nunca o PIN em si. A tela mostra o estado, não o segredo.
  const [comPinIds, setComPinIds] = useState<Set<string>>(new Set())
  const [editandoPin, setEditandoPin] = useState<string | null>(null)
  const [pinNovo, setPinNovo] = useState('')
  const [erroPin, setErroPin] = useState<string | null>(null)

  const carregar = () => {
    if (comPin) {
      fetch(`/api/empresas/${companyId}/estoque/producao/cadastros/pin`).then((r) => r.json())
        .then((j) => setComPinIds(new Set(j.comPin ?? []))).catch(() => {})
    }
    return fetch(`/api/empresas/${companyId}/estoque/${rota}`).then((r) => r.json()).then((j) => setRows(j[chave] ?? [])).catch(() => setRows(null))
  }

  const salvarPin = async (colaboradorId: string, pin?: string) => {
    setBusy(true); setErroPin(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/producao/cadastros/pin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pin ? { colaboradorId, pin } : { colaboradorId }),
      })
      const j = await r.json().catch(() => null)
      // ⚠️ o motivo da recusa vai INTEIRO pra tela ("esse PIN é fácil demais", "outra pessoa
      // já usa"): sem ele o gestor tenta o mesmo número de novo achando que é bug.
      if (!r.ok) { setErroPin(j?.erro ?? 'Não consegui salvar o PIN.'); return }
      setEditandoPin(null); setPinNovo(''); carregar()
    } finally { setBusy(false) }
  }
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
          {(rows ?? []).map((r) => (
            <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{r.nome}</span>
                {comPin && (editandoPin === r.id ? (
                  <span className="flex items-center gap-1.5">
                    <input value={pinNovo} onChange={(e) => setPinNovo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      inputMode="numeric" placeholder="4 dígitos" autoFocus
                      className="h-7 w-24 rounded border border-slate-300 px-2 text-center text-xs tabular-nums" />
                    <button onClick={() => salvarPin(r.id, pinNovo)} disabled={busy || pinNovo.length !== 4}
                      className="rounded bg-[#185FA5] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-40">salvar</button>
                    <button onClick={() => { setEditandoPin(null); setPinNovo(''); setErroPin(null) }} className="text-[11px] text-slate-400">cancelar</button>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-[11px]">
                    {comPinIds.has(r.id)
                      ? <span className="flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" /> tem PIN</span>
                      : <span className="text-slate-400">sem PIN</span>}
                    <button onClick={() => { setEditandoPin(r.id); setPinNovo(''); setErroPin(null) }}
                      className="flex items-center gap-1 text-[#185FA5] hover:underline"><KeyRound className="h-3 w-3" /> {comPinIds.has(r.id) ? 'trocar' : 'definir'}</button>
                    {comPinIds.has(r.id) && <button onClick={() => salvarPin(r.id)} className="text-slate-400 hover:text-rose-600">remover</button>}
                  </span>
                ))}
              </div>
              {comPin && editandoPin === r.id && erroPin && <p className="mt-1 text-[11px] text-rose-600">{erroPin}</p>}
            </div>
          ))}
        </div>
      )}
      {comPin && (
        // ⛔ a explicação fica ONDE o PIN é definido: sem ela, "PIN" num sistema financeiro
        // parece senha de acesso — e não é. Ele só diz quem apertou o botão na cozinha.
        <p className="rounded-lg bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-500">
          O PIN <strong>identifica</strong> quem inicia e finaliza tarefa no tablet da cozinha — não abre nada além
          disso. Tela de dinheiro continua exigindo login. Ele fica guardado embaralhado: nem você nem eu conseguimos
          ver o PIN de alguém depois de salvo.
        </p>
      )}
      <div className="flex items-center gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={placeholder} className="flex-1 rounded-lg border border-slate-300 py-2 px-3 text-sm" />
        <button onClick={() => add()} disabled={busy || !nome.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#185FA5] px-3 py-2 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50"><Plus className="h-4 w-4" /> add</button>
      </div>
    </CardContent></Card>
  )
}
