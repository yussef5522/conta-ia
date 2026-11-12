'use client'

// ⭐⭐ NOVA TAREFA (lei v7 M2, docs/producao-referencia.html, 12/11/2026).
// "o que fazer?" + instrução ("5 LATAS") + quem faz (pessoa ou "liberada pra equipe") + dia →
// CRIAR TAREFA → cai na hora na Janela da Cozinha. ⛔ Sem estoque. ⛔ Zero prosa na tela (S15).
// Abaixo, as tarefas do dia, com "cancelar" (como nas ordens) pra quem opera.

import { useEffect, useState } from 'react'
import { Loader2, ListChecks } from 'lucide-react'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import type { TarefaDoEscritorio } from '@/lib/stock/producao/tarefa'

interface Pessoa { id: string; nome: string; ativo?: boolean }

const ROTULO: Record<TarefaDoEscritorio['estado'], string> = {
  AGUARDANDO: 'na fila', EM_ANDAMENTO: 'fazendo', FEITA: 'feita', CANCELADA: 'cancelada',
  FINALIZADA_PELO_GERENTE: 'finalizada pelo gerente', ENCERRADA_SEM_FINALIZAR: 'encerrada',
} as Record<TarefaDoEscritorio['estado'], string>

export function TarefasDoDia({ id, podeOperar, podeLiberar }: { id: string; podeOperar: boolean; podeLiberar: boolean }) {
  const [tarefas, setTarefas] = useState<TarefaDoEscritorio[]>([])
  const [nomes, setNomes] = useState<string[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [nome, setNome] = useState('')
  const [instr, setInstr] = useState('')
  const [quem, setQuem] = useState('')
  const [dia, setDia] = useState(() => diaEmSaoPaulo())
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const carregar = async () => {
    const r = await fetch(`/api/empresas/${id}/estoque/producao/tarefas`).catch(() => null)
    const j = await r?.json().catch(() => null)
    if (r?.ok && j) { setTarefas(j.tarefas ?? []); setNomes(j.nomes ?? []) }
  }
  useEffect(() => {
    void carregar()
    fetch(`/api/empresas/${id}/estoque/colaboradores`).then((r) => (r.ok ? r.json() : null)).then((j) => setPessoas((j?.colaboradores ?? []).filter((p: Pessoa) => p.ativo !== false))).catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      await carregar()
    } finally { setBusy(false) }
  }

  const cancelar = async (t: TarefaDoEscritorio) => {
    setBusy(true); setErro(null); setOk(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/producao/tarefas/${t.tarefaId}/cancelar`, { method: 'POST' })
      const j = await r.json().catch(() => null)
      if (!r.ok) setErro(j?.erro ?? 'Não consegui cancelar.')
      await carregar()
    } finally { setBusy(false) }
  }

  if (!podeOperar && tarefas.length === 0) return null
  const campo = 'h-[42px] rounded-[10px] border px-[11px] text-[13px] font-bold'
  const estiloCampo = { borderColor: 'var(--prod-line)', background: 'var(--prod-surface)', color: 'var(--prod-primary)' }
  return (
    <section data-testid="tarefas-do-dia">
      <h2 className="mb-1.5 flex items-center gap-1.5 text-[13.5px] font-medium" style={{ color: 'var(--prod-primary)' }}>
        <ListChecks className="h-3.5 w-3.5" /> Nova tarefa
      </h2>
      <div className="rounded-xl p-3.5" style={{ background: 'var(--prod-surface)', boxShadow: 'var(--prod-sombra)' }}>
        {podeOperar && (
          <div className="flex flex-wrap items-center gap-2">
            <input value={nome} onChange={(e) => setNome(e.target.value)} list="nomes-de-tarefa" maxLength={80} aria-label="o que fazer?"
              placeholder="o que fazer? ex.: ABRIR LATAS DE MILHO" className={`${campo} min-w-0 flex-[1_1_200px]`} style={estiloCampo} />
            <datalist id="nomes-de-tarefa">{nomes.map((n) => <option key={n} value={n} />)}</datalist>
            <input value={instr} onChange={(e) => setInstr(e.target.value)} maxLength={60} aria-label="instrução"
              placeholder="instrução, ex.: 3 LATAS" className={`${campo} w-[140px]`} style={estiloCampo} />
            <select value={quem} onChange={(e) => setQuem(e.target.value)} className={`${campo} px-2 text-[12.5px]`} style={estiloCampo} aria-label="quem faz?">
              <option value="">quem faz?</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              {podeLiberar && <option value="EQUIPE">liberada pra equipe</option>}
            </select>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="dia" className={`${campo} px-2 text-[12.5px]`} style={estiloCampo} />
            <button onClick={criar} disabled={busy || !nome.trim() || !quem}
              className="h-[42px] rounded-[10px] px-[15px] text-[13px] font-extrabold disabled:opacity-50" style={{ background: 'var(--fam-verde-solid)', color: 'var(--fam-verde-on)' }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'CRIAR TAREFA'}
            </button>
          </div>
        )}
        {ok && <span className="mt-2 inline-block rounded-full px-3 py-1.5 text-[12.5px] font-extrabold" style={{ background: 'var(--fam-verde-bg)', color: 'var(--fam-verde-ink)' }} data-testid="tarefa-criada">{ok}</span>}
        {erro && <p className="mt-2 text-[12.5px]" style={{ color: 'var(--fam-coral-ink)' }}>{erro}</p>}
        {tarefas.length > 0 && (
          <ul className={podeOperar ? 'mt-3' : ''}>
            {tarefas.map((t, i) => {
              const viva = t.estado === 'AGUARDANDO' || t.estado === 'EM_ANDAMENTO'
              return (
                <li key={t.tarefaId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px]"
                  style={i > 0 ? { borderTop: '1px solid var(--prod-line)' } : undefined}>
                  <span className="min-w-0 flex-[1_1_180px] font-bold" style={{ color: 'var(--prod-primary)', ...(t.estado === 'CANCELADA' ? { textDecoration: 'line-through', opacity: 0.6 } : {}) }}>
                    {t.nome}{t.instrucao && <span style={{ color: 'var(--fam-ambar-ink)' }}> · {t.instrucao}</span>}
                  </span>
                  <span style={{ color: 'var(--prod-muted)' }}>{t.quem.length ? t.quem.join(' e ') : t.liberada ? 'liberada pra equipe' : '—'}</span>
                  {t.dia !== diaEmSaoPaulo() && <span className="num" style={{ color: 'var(--prod-muted)' }}>{t.dia.split('-').reverse().slice(0, 2).join('/')}</span>}
                  <span className="num" style={{ color: 'var(--prod-secondary)' }}>{ROTULO[t.estado] ?? t.estado}</span>
                  {viva && podeOperar && (
                    <button onClick={() => cancelar(t)} disabled={busy} className="text-[12px] underline underline-offset-2 disabled:opacity-50" style={{ color: 'var(--prod-muted)' }}>cancelar</button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
