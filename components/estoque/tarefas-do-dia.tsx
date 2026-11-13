'use client'

// ⭐⭐ NOVA TAREFA (lei v7 M2 → v9 M7, docs/producao-referencia.html).
// "o que fazer?" + instrução ("5 LATAS") + quem faz (pessoa ou "liberada pra equipe") + prazo →
// Criar tarefa → cai na hora na Janela da Cozinha. ⛔ Sem estoque. ⛔ Zero prosa na tela (S15).
// ⭐ v9: o cartão mora FIXO na zona de criar do painel, ao lado da "Nova ordem". A LISTA das
// tarefas saiu daqui — elas aparecem em «Em aberto» e «Concluídas», com linha própria
// (`lib/stock/producao/linha-da-tarefa.ts`), e o "cancelar" vai junto, na linha aberta.
// ⚠️ As classes (`pp-painel`, `pp-cria`, `bt`) vêm do CSS da página do painel.

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

interface Pessoa { id: string; nome: string; ativo?: boolean }

export function NovaTarefa({ id, podeLiberar, nomes, onCriada }: {
  id: string; podeLiberar: boolean; nomes: string[]; onCriada: () => void
}) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [nome, setNome] = useState('')
  const [instr, setInstr] = useState('')
  const [quem, setQuem] = useState('')
  const [dia, setDia] = useState(() => diaEmSaoPaulo())
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/colaboradores`).then((r) => (r.ok ? r.json() : null)).then((j) => setPessoas((j?.colaboradores ?? []).filter((p: Pessoa) => p.ativo !== false))).catch(() => {})
  }, [id])

  const criar = async () => {
    if (!nome.trim() || !quem) return
    setBusy(true); setErro(null); setOk(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/tarefas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, instrucao: instr || null, quem, dia }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui criar a tarefa.'); return }
      const n = nome.trim().toUpperCase(), i = instr.trim().toUpperCase()
      setOk(`✓ “${n}${i ? ` · ${i}` : ''}” → tablet ${quem === 'EQUIPE' ? '(liberada pra equipe)' : `de ${pessoas.find((p) => p.id === quem)?.nome ?? ''}`}`)
      setNome(''); setInstr('')
      onCriada()
    } finally { setBusy(false) }
  }

  return (
    <div className="pp-painel pp-zc" data-testid="nova-tarefa">
      <h3>Nova tarefa</h3>
      <div className="pp-cria">
        <input value={nome} onChange={(e) => setNome(e.target.value)} list="nomes-de-tarefa" maxLength={80} aria-label="o que fazer?"
          placeholder="o que fazer? ex.: ABRIR LATAS DE MILHO" className="longo" />
        <datalist id="nomes-de-tarefa">{nomes.map((n) => <option key={n} value={n} />)}</datalist>
        <input value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={60} aria-label="instrução"
          placeholder="instrução, ex.: 3 LATAS" className="medio" />
        <select value={quem} onChange={(e) => setQuem(e.target.value)} aria-label="quem faz?">
          <option value="">quem faz?</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          {podeLiberar && <option value="EQUIPE">liberada pra equipe</option>}
        </select>
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="prazo" />
        <button type="button" onClick={criar} disabled={busy || !nome.trim() || !quem} className="bt verde2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar tarefa'}
        </button>
      </div>
      {ok && <span className="pp-pill verde pp-msg" data-testid="tarefa-criada">{ok}</span>}
      {erro && <span className="pp-pill coral pp-msg">{erro}</span>}
    </div>
  )
}
