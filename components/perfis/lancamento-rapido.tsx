'use client'

// ⭐⭐⭐ O FAB QUE ENTENDE FRASE (13/09) — estilo "Meu Assessor".
//
// **O dono:** *"digito 'mercado 280,50' (…) → o sistema monta o lançamento (…) confiro num
// preview de 1 tela e salvo. Errei a categoria, troco e a regra aprende. Frase que não
// parseia = formulário normal preenchido com o que deu (nunca trava, NUNCA inventa valor)."*
//
// ⛔ O parse mora em `lib/pf-dashboard/frase.ts` (puro, testado) — aqui é só a tela. Regra
// que mora num componente é regra que ninguém prova (a lição do prefill do cardápio).

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '@/lib/http/fetch-json'

interface Lido {
  valor: number | null; descricao: string; sentido: 'ENTRADA' | 'SAIDA'; montou: boolean; porQue: string | null
  sugestao: { id: string; porQue: string } | null
  categorias: { id: string; name: string; type: string }[]
}

const M = { roxo: '#534AB7', sub: '#7a8095', verde: '#16a34a', coral: '#e5484d', ambar: '#d97706', line: '#ebebf2' }

export function LancamentoRapido({ profileId, contas, aoFechar, aoSalvar }: {
  profileId: string; contas: { id: string; name: string }[]; aoFechar: () => void; aoSalvar: () => void
}) {
  // ⚠️ REGRA 9: todo hook antes de qualquer early return
  const [frase, setFrase] = useState('')
  const [l, setL] = useState<Lido | null>(null)
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [sentido, setSentido] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')
  const [categoriaId, setCategoriaId] = useState('')
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [trocou, setTrocou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ler = useCallback(async () => {
    const r = await fetchJson<Lido>(`/api/perfis/${profileId}/lancamento-rapido?frase=${encodeURIComponent(frase)}`)
    if (!r.ok || !r.data) return
    setL(r.data)
    // ⭐ o que deu pra ler PRÉ-PREENCHE — e o que não deu fica vazio, nunca chutado
    setValor(r.data.valor != null ? String(r.data.valor).replace('.', ',') : '')
    setDescricao(r.data.descricao)
    setSentido(r.data.sentido)
    setCategoriaId(r.data.sugestao?.id ?? '')
    setTrocou(false)
  }, [profileId, frase])

  useEffect(() => {
    const t = setTimeout(() => { if (frase.trim()) void ler() }, 350)
    return () => clearTimeout(t)
  }, [frase, ler])

  async function salvar() {
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    // ⛔ SEM VALOR, SEM LANÇAMENTO — a régua do parser vale igual na tela
    if (!Number.isFinite(v) || v <= 0) return setErro('Falta o valor.')
    if (!descricao.trim()) return setErro('Falta a descrição.')
    setSalvando(true); setErro(null)
    const r = await fetchJson(`/api/perfis/${profileId}/lancamento-rapido`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valor: v, descricao: descricao.trim(), sentido, categoriaId: categoriaId || null, contaId: contaId || null,
        // ⭐ "errei a categoria, troco e a regra aprende"
        aprender: trocou && !!categoriaId,
      }),
    })
    setSalvando(false)
    if (!r.ok) return setErro(r.message ?? 'não consegui salvar')
    aoSalvar()
  }

  const cats = (l?.categorias ?? []).filter((c) => c.type === (sentido === 'ENTRADA' ? 'INCOME' : 'EXPENSE'))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={aoFechar}>
      <div className="w-full max-w-[480px] rounded-t-[24px] bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: M.line }} />

        {/* ⭐ O CAMPO DE FRASE EM CIMA — é o gesto principal */}
        <input autoFocus value={frase} onChange={(e) => setFrase(e.target.value)}
          placeholder='ex: "mercado 280,50" ou "recebi 500 pix"'
          className="mb-1 h-12 w-full rounded-xl border px-3.5 text-[15px] outline-none"
          style={{ borderColor: M.roxo }} />
        {l?.porQue && (
          <p className="mb-2 text-[12px]" style={{ color: l.montou ? M.sub : M.ambar }}>{l.porQue}</p>
        )}

        {/* ── O PREVIEW DE 1 TELA ─────────────────────────────────────────── */}
        <div className="mb-3 flex gap-2">
          {(['SAIDA', 'ENTRADA'] as const).map((s) => (
            <button key={s} onClick={() => { setSentido(s); setCategoriaId(''); setTrocou(true) }}
              className="h-9 flex-1 rounded-lg border text-[13px] font-semibold"
              style={sentido === s
                ? { background: s === 'ENTRADA' ? M.verde : M.coral, color: '#fff', borderColor: 'transparent' }
                : { borderColor: M.line, color: M.sub }}>
              {s === 'ENTRADA' ? '📈 entrou' : '📉 saiu'}
            </button>
          ))}
        </div>

        <div className="mb-2 flex gap-2">
          <div className="w-[132px]">
            <label className="mb-0.5 block text-[11px] font-semibold" style={{ color: M.sub }}>Valor *</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00"
              className="h-10 w-full rounded-lg border px-2.5 text-[15px] font-bold tabular-nums" style={{ borderColor: M.line }} />
          </div>
          <div className="min-w-0 flex-1">
            <label className="mb-0.5 block text-[11px] font-semibold" style={{ color: M.sub }}>Descrição *</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="o que foi"
              className="h-10 w-full rounded-lg border px-2.5 text-[14px]" style={{ borderColor: M.line }} />
          </div>
        </div>

        <label className="mb-0.5 block text-[11px] font-semibold" style={{ color: M.sub }}>Categoria</label>
        <select value={categoriaId} onChange={(e) => { setCategoriaId(e.target.value); setTrocou(true) }}
          className="mb-1 h-10 w-full rounded-lg border px-2 text-[14px]" style={{ borderColor: M.line }}>
          <option value="">— sem categoria (classifico depois) —</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* ⭐ a IA SUGERE e DIZ por quê — nunca um palpite mudo */}
        {l?.sugestao && categoriaId === l.sugestao.id && !trocou && (
          <p className="mb-2 text-[11.5px]" style={{ color: M.roxo }}>sugerida: {l.sugestao.porQue}</p>
        )}
        {trocou && categoriaId && (
          <p className="mb-2 text-[11.5px]" style={{ color: M.verde }}>⭐ vou aprender: da próxima vez já venho classificado</p>
        )}

        {contas.length > 0 && (
          <>
            <label className="mb-0.5 block text-[11px] font-semibold" style={{ color: M.sub }}>Conta</label>
            <select value={contaId} onChange={(e) => setContaId(e.target.value)}
              className="mb-3 h-10 w-full rounded-lg border px-2 text-[14px]" style={{ borderColor: M.line }}>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}

        {erro && <p className="mb-2 text-[12.5px]" style={{ color: M.coral }}>{erro}</p>}

        <div className="flex gap-2">
          <button onClick={aoFechar} className="h-11 rounded-xl border px-4 text-[14px]" style={{ borderColor: M.line, color: M.sub }}>cancelar</button>
          <button onClick={() => void salvar()} disabled={salvando}
            className="h-11 flex-1 rounded-xl text-[14px] font-bold text-white disabled:opacity-40"
            style={{ background: M.roxo }}>
            {salvando ? 'salvando…' : 'Salvar lançamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
