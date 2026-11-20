'use client'
// ⭐⭐ A FILA DE CASAMENTO ASSISTIDO (16/11/2026) — par a par, o dono responde: "juntar" (é o mesmo item:
// funde com a prova de saldo) ou "são diferentes" (nunca mais pergunta daquele par). A máquina não funde
// nada sozinha por semelhança. Estado vazio honesto; celular empilha.
import { PerguntaNoTopo } from '@/components/perguntas/pergunta-no-topo'
import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { ANCORAS } from '@/components/perguntas/ancoras'

interface Lado { id: string; nome: string; categoria: string; unidadeControle: string; saldo: number }
interface Par { a: Lado; b: Lado }
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function FilaDeGemeosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const base = `/api/empresas/${id}/estoque/itens/gemeos`
  const [pares, setPares] = useState<Par[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ chave: string; texto: string; erro: boolean } | null>(null)
  const ler = useCallback(async () => {
    try { const r = await fetch(base, { cache: 'no-store' }); if (!r.ok) throw new Error(); setPares((await r.json()).pares); setFalhou(false) } catch { setFalhou(true) }
  }, [base])
  useEffect(() => { ler() }, [ler])

  async function responder(p: Par, decisao: 'JUNTAR' | 'DIFERENTES') {
    const chave = `${p.a.id}|${p.b.id}`
    setOcupado(chave); setMsg(null)
    try {
      const r = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemXId: p.a.id, itemYId: p.b.id, decisao }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ chave, texto: j.erro ?? 'Não consegui gravar.', erro: true }); return }
      setMsg({ chave: 'topo', texto: decisao === 'JUNTAR' ? `Juntados — saldo ${num(j.saldoAntes)} antes, ${num(j.saldoDepois)} no item que ficou.` : `“${p.a.nome}” e “${p.b.nome}” ficam separados — não pergunto de novo.`, erro: false })
      ler()
    } catch { setMsg({ chave, texto: 'Não consegui falar com o servidor — nada mudou.', erro: true }) } finally { setOcupado(null) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4" data-tela="fila-de-gemeos">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Itens parecidos</h1>
          <p className="text-sm text-slate-500">Nome quase igual pode ser o mesmo produto cadastrado duas vezes. Você decide — nada é juntado sozinho.</p>
        </div>
        <Link href={`/empresas/${id}/estoque/itens`} className="text-sm font-medium text-[var(--prod-acao-bg)] hover:underline">← itens</Link>
      </div>
      {falhou && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Não consegui ler a fila agora. <button type="button" onClick={ler} className="font-semibold underline">tentar de novo</button></div>}
      {msg?.chave === 'topo' && <div role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{msg.texto}</div>}
      {!pares && !falhou && <p className="text-sm text-slate-500">lendo a fila…</p>}
      {pares && pares.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600" data-testid="fila-vazia">Nenhum par parecido esperando resposta.</p>}
      {/* ⭐ LEI DA PERGUNTA NO TOPO (19/11): os pares são perguntas do sistema — cartão com contador, âncora do sininho */}
      <PerguntaNoTopo id={ANCORAS.GEMEOS} titulo="Estes itens são o mesmo produto?" quantas={pares?.length ?? 0} singular="par" plural="pares">
      <div className="space-y-3">
      {pares?.map((p) => {
        const chave = `${p.a.id}|${p.b.id}`
        return (
          <div key={chave} className="rounded-xl border border-slate-200 bg-white p-4" data-testid="par-suspeito">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[p.a, p.b].map((l) => (
                <div key={l.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-900">{l.nome}</p>
                  <p className="text-xs tabular-nums text-slate-500">{l.categoria.toLowerCase().replace('_', ' ')} · saldo {num(l.saldo)} {l.unidadeControle}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={ocupado === chave} onClick={() => responder(p, 'JUNTAR')} data-testid="juntar"
                className="inline-flex h-9 items-center rounded-lg bg-[var(--prod-acao-bg)] px-4 text-sm font-semibold text-[var(--prod-acao-ink)] hover:opacity-90 disabled:opacity-60">
                {ocupado === chave ? <Loader2 className="h-4 w-4 animate-spin" /> : 'juntar — é o mesmo item'}
              </button>
              <button type="button" disabled={ocupado === chave} onClick={() => responder(p, 'DIFERENTES')} data-testid="sao-diferentes"
                className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">são diferentes</button>
            </div>
            {msg?.chave === chave && <p className={`mt-2 text-xs font-semibold ${msg.erro ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.texto}</p>}
          </div>
        )
      })}
      </div>
      </PerguntaNoTopo>
    </div>
  )
}
