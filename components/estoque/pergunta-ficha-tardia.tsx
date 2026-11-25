'use client'
// ⭐⭐ A FICHA QUE CHEGOU DEPOIS — a pergunta de acerto (25/11/2026), na LEI DA PERGUNTA NO TOPO.
//
// "PROMOO 3 PIZZAS vendeu 31 un sem ficha em 24/11 — baixar agora o que ficou pra trás?"
// ⛔ NUNCA sozinho: o botão é o SIM do dono. O que foi contado depois da venda fica FORA, e o cartão diz.
// ⚠️ Busca sozinha (GET) e recarrega quando `recarga` muda — a tela dona incrementa depois de salvar a ficha.
import { useCallback, useEffect, useState } from 'react'
import { PerguntaNoTopo } from '@/components/perguntas/pergunta-no-topo'
import { ANCORAS } from '@/components/perguntas/ancoras'
import { fraseDaPendencia } from '@/lib/stock/vendas/baixou-na-hora'

interface Item { itemId: string; nome: string; unidade: string; qtd: number }
interface Pendencia {
  importId: string
  dia: string
  nomeSuitable: string
  quantidade: number
  baixa: Item[]
  foraPorContagem: (Item & { contadoEm: string })[]
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const itens = (xs: Item[]) => xs.map((i) => `${i.nome} ${num(i.qtd)} ${i.unidade.toLowerCase()}`).join(' · ')

export function PerguntaFichaTardia({ companyId, fichaId, nomes, recarga = 0 }: {
  companyId: string
  /** restringe ao produto da tela (ficha ou nomes do PDV); sem nada = a empresa inteira */
  fichaId?: string | null
  nomes?: string[]
  recarga?: number
}) {
  const [pend, setPend] = useState<Pendencia[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [dispensadas, setDispensadas] = useState<Set<string>>(new Set())
  const [feito, setFeito] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const chaveNomes = (nomes ?? []).join('|')

  const carregar = useCallback(() => {
    const q = new URLSearchParams()
    if (fichaId) q.set('fichaId', fichaId)
    for (const n of chaveNomes ? chaveNomes.split('|') : []) q.append('nome', n)
    fetch(`/api/empresas/${companyId}/estoque/vendas/ficha-tardia?${q}`)
      .then((r) => (r.ok ? r.json() : { pendencias: [] }))
      .then((j) => setPend(j.pendencias ?? []))
      .catch(() => setPend([]))
  }, [companyId, fichaId, chaveNomes])
  useEffect(() => { carregar() }, [carregar, recarga])

  const acertar = async (p: Pendencia) => {
    const k = `${p.importId}|${p.nomeSuitable}`
    setOcupado(k); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/vendas/ficha-tardia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: p.importId, nomeSuitable: p.nomeSuitable }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui fazer o acerto.'); return }
      setFeito(`${p.nomeSuitable} (${ddmm(p.dia)}): baixado hoje — ${itens(j.baixados ?? []) || 'nada'}`)
      carregar()
    } finally { setOcupado(null) }
  }

  const visiveis = pend.filter((p) => !dispensadas.has(`${p.importId}|${p.nomeSuitable}`))
  return (
    <>
      {feito && <p data-testid="acerto-feito" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">✓ {feito}</p>}
      <PerguntaNoTopo id={ANCORAS.FICHA_TARDIA} titulo="Venda que saiu sem baixar estoque — a ficha foi criada depois"
        quantas={visiveis.length} singular="venda" plural="vendas">
        <ul className="space-y-2.5 text-xs">
          {visiveis.map((p) => {
            const k = `${p.importId}|${p.nomeSuitable}`
            return (
              <li key={k} data-testid="ficha-tardia-no-topo" className="space-y-1">
                <p className="font-semibold">{fraseDaPendencia(p)}</p>
                {p.baixa.length > 0
                  ? <p className="tabular-nums">sai agora (datado de hoje): {itens(p.baixa)}</p>
                  : <p>nada a baixar — tudo já foi contado depois da venda.</p>}
                {p.foraPorContagem.length > 0 && (
                  <p className="tabular-nums text-amber-800">
                    fica de fora — contado em {ddmm(p.foraPorContagem[0].contadoEm)}, a contagem já fixou a verdade: {itens(p.foraPorContagem)}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <button type="button" disabled={ocupado !== null} onClick={() => void acertar(p)}
                    className="rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50">
                    {ocupado === k ? 'Baixando…' : p.baixa.length ? 'Sim, baixar agora' : 'Sim, registrar o acerto'}
                  </button>
                  <button type="button" disabled={ocupado !== null} onClick={() => setDispensadas(new Set([...dispensadas, k]))}
                    className="rounded-md border border-amber-400 px-2.5 py-1 text-amber-900">
                    Agora não
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {erro && <p className="mt-2 text-xs font-semibold text-rose-700">{erro}</p>}
      </PerguntaNoTopo>
    </>
  )
}
