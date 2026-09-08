'use client'

// ⭐⭐⭐ A REVISÃO EM LOTE DAS SEÇÕES (08/09/2026) — decisão do dono.
//
// *"A CLASSIFICAÇÃO INICIAL não pode ser 156 cliques meus: sugestão POR PALAVRA no nome,
// numa TELA DE REVISÃO EM LOTE: os 156 agrupados pela sugestão, eu corro o olho, corrijo
// os errados e confirmo tudo de uma vez. Heurística sugere, eu bato o martelo — **mas num
// gesto, não em 156**."*
//
// ⛔ O GET não grava nada. A sugestão que esta tela mostra é calculada na hora; nada entra
// no banco antes do CONFIRMAR. Abrir a tela não pode ter classificado o cardápio inteiro.
//
// ⚠️ E a correção é POR PRODUTO, num select ao lado dele — não um "mover grupo inteiro".
// O grupo existe pra o olho correr rápido; o martelo continua sendo por item, porque é o
// item que pode estar errado.

import { use, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

interface ItemDoLote {
  chave: string; nome: string; nomesSuitable: string[]
  secaoSugerida: string; porQue: string | null; vendasQtd: number
}
interface Lote {
  lote: { grupos: { secao: string; itens: ItemDoLote[] }[]; total: number; semRegra: number }
  secoes: { chave: string; nome: string; ordem: number }[]
  jaConfirmados: number
}

export default function RevisarSecoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { toast } = useToast()
  const [d, setD] = useState<Lote | null | undefined>(undefined)
  // ⭐ as correções do dono, por produto — o resto segue a sugestão
  const [corrigido, setCorrigido] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/cardapio/secoes/lote`)
      .then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null))
  }, [id])

  const nomeDaSecao = useMemo(
    () => new Map((d?.secoes ?? []).map((s) => [s.chave, s.nome])), [d])

  const corrigidos = Object.keys(corrigido).length

  async function confirmar() {
    if (!d) return
    setSalvando(true)
    try {
      const itens = d.lote.grupos.flatMap((g) => g.itens.map((i) => ({
        nomesSuitable: i.nomesSuitable,
        secao: corrigido[i.chave] ?? i.secaoSugerida,
      })))
      const r = await fetch(`/api/empresas/${id}/estoque/cardapio/secoes/lote`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens }),
      })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast({ variant: 'destructive', title: 'Não deu pra confirmar', description: b?.erro ?? `HTTP ${r.status}` })
        return
      }
      toast({ title: 'Cardápio classificado', description: `${b.produtos} produtos em seções.` })
      window.location.href = `/empresas/${id}/estoque/cardapio`
    } finally { setSalvando(false) }
  }

  if (d === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (d === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o lote.</div>

  if (d.lote.total === 0) {
    return (
      <div className="space-y-4">
        <a href={`/empresas/${id}/estoque/cardapio`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Cardápio
        </a>
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Check className="h-9 w-9 text-emerald-500" />
          <p className="text-sm font-semibold text-slate-800">Tudo classificado ✓</p>
          <p className="max-w-md text-xs text-slate-500">
            {d.jaConfirmados} produtos já têm seção confirmada. Produto novo que entrar por
            import aparece aqui com a seção sugerida, esperando seu martelo.
          </p>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <a href={`/empresas/${id}/estoque/cardapio`} className="flex items-center gap-1 self-center text-xs text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Cardápio
        </a>
        <h1 className="text-[22px] font-semibold text-slate-900">Classificar o cardápio</h1>
        <span className="text-[13px] text-slate-500">
          a régua sugeriu por palavra no nome — corrija o que estiver errado e confirme de uma vez
        </span>
      </div>

      {/* ⛔ o número honesto do que a régua NÃO soube: some em Outros, à vista */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px]">
        <Sparkles className="h-4 w-4 text-[#534AB7]" />
        <span><b className="tabular-nums">{d.lote.total}</b> produtos a classificar</span>
        {d.lote.semRegra > 0 && (
          <span className="text-slate-500">
            · <b className="tabular-nums text-slate-700">{d.lote.semRegra}</b> a régua não soube — caíram em Outros
          </span>
        )}
        {corrigidos > 0 && <span className="text-[#534AB7]">· {corrigidos} corrigido{corrigidos > 1 ? 's' : ''} por você</span>}
        <button onClick={confirmar} disabled={salvando}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#534AB7] px-3 text-xs font-semibold text-white hover:bg-[#453D9C] disabled:opacity-40">
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar {d.lote.total} produtos
        </button>
      </div>

      {d.lote.grupos.map((g) => (
        <Card key={g.secao} className="overflow-hidden">
          <div className="flex items-baseline gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
            <span className="text-[13px] font-semibold text-slate-800">{nomeDaSecao.get(g.secao) ?? g.secao}</span>
            <span className="text-[11px] tabular-nums text-slate-400">{g.itens.length} produtos</span>
          </div>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-50">
              {g.itens.map((i) => {
                const atual = corrigido[i.chave] ?? i.secaoSugerida
                const mudou = atual !== i.secaoSugerida
                return (
                  <li key={i.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                    <span className="min-w-0 flex-1 text-[13px] text-slate-800">{i.nome}</span>
                    <span className="text-[11px] tabular-nums text-slate-400">{i.vendasQtd} un</span>
                    {/* ⛔ o PORQUÊ da sugestão fica visível — sugestão sem motivo é adivinhação */}
                    <span className="w-[130px] text-right text-[11px] text-slate-400">
                      {i.porQue ? <>palavra “{i.porQue}”</> : <span className="text-amber-700">sem regra</span>}
                    </span>
                    <select
                      aria-label={`seção de ${i.nome}`}
                      value={atual}
                      onChange={(e) => setCorrigido((c) => ({ ...c, [i.chave]: e.target.value }))}
                      className={`h-8 rounded-lg border px-2 text-[12px] ${
                        mudou ? 'border-[#534AB7] bg-indigo-50 font-medium text-[#534AB7]' : 'border-slate-300 text-slate-700'
                      }`}>
                      {d.secoes.map((s) => <option key={s.chave} value={s.chave}>{s.nome}</option>)}
                    </select>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end pb-6">
        <button onClick={confirmar} disabled={salvando}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#534AB7] px-4 text-[13px] font-semibold text-white hover:bg-[#453D9C] disabled:opacity-40">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Confirmar {d.lote.total} produtos
        </button>
      </div>
    </div>
  )
}
