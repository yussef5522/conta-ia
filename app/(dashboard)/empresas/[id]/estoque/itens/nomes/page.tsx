'use client'

// ⭐⭐ REVISÃO DOS NOMES EM LOTE (09/09/2026) — molde do lote das seções do cardápio.
//
// **O dono:** *"EU reviso: edito na linha e confirmo em lote. Nada renomeia sozinho."*
//
// ⛔ Abrir esta tela NÃO grava nada. A sugestão é calculada na hora; só o CONFIRMAR escreve.

import { useEffect, useState, use, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tags, Loader2, ArrowLeft, Check, RotateCcw } from 'lucide-react'

interface Linha {
  itemId: string
  nomeAtual: string
  categoria: string
  saldo: number
  sugestao: string
  porque: string[]
  doCardapio: string | null
  apelidos: string[]
}

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export default function RevisarNomesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [linhas, setLinhas] = useState<Linha[] | null | undefined>(undefined)
  /** o que o dono decidiu por linha (editado); vazio = usar a sugestão */
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [marcado, setMarcado] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/itens/nomes`)
      .then((r) => r.json())
      .then((j) => {
        const ls: Linha[] = j.itens ?? []
        setLinhas(ls)
        // ⚠️ nasce TUDO DESMARCADO: "confirmar em lote" não pode virar "aceitei sem ler".
        setMarcado({})
      })
      .catch(() => setLinhas(null))
  }, [id])

  const valorDe = (l: Linha) => (edit[l.itemId] ?? l.sugestao)
  const selecionados = useMemo(
    () => (linhas ?? []).filter((l) => marcado[l.itemId] && valorDe(l).trim() && valorDe(l) !== l.nomeAtual),
    [linhas, marcado, edit],
  )

  const confirmar = async () => {
    setSalvando(true); setErro(null); setOk(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/itens/nomes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renomeios: selecionados.map((l) => ({ itemId: l.itemId, nomeNovo: valorDe(l) })) }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui renomear.'); return }
      setOk(`${j.aplicados?.length ?? 0} nome(s) atualizado(s)${j.pulados?.length ? ` · ${j.pulados.length} pulado(s)` : ''}`)
      const rr = await fetch(`/api/empresas/${id}/estoque/itens/nomes`).then((x) => x.json())
      setLinhas(rr.itens ?? []); setMarcado({}); setEdit({})
    } catch {
      setErro('Falha de rede. Tenta de novo.')
    } finally { setSalvando(false) }
  }

  if (linhas === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!linhas) return <div className="p-6 text-sm text-slate-500">Não consegui carregar os nomes.</div>

  return (
    <div className="space-y-3">
      <a href={`/empresas/${id}/estoque/itens`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-3.5 w-3.5" /> voltar pro catálogo
      </a>

      <div className="flex flex-wrap items-center gap-2.5">
        <Tags className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Limpar nomes de nota</h1>
        <p className="hidden flex-1 truncate text-xs text-slate-400 lg:block">
          a sugestão é da régua — você edita e confirma. Nada renomeia sozinho.
        </p>
        <button
          onClick={confirmar}
          disabled={!selecionados.length || salvando}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white disabled:opacity-40"
        >
          {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Confirmar {selecionados.length || ''}
        </button>
      </div>

      {erro && <p className="text-[13px] text-rose-600">{erro}</p>}
      {ok && <p className="text-[13px] font-medium text-emerald-700">✓ {ok}</p>}

      {linhas.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-slate-500">
          Nenhum nome com cara de nota. O catálogo está limpo.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="density-normal w-full min-w-[860px]">
            <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="w-8 px-3 py-2"></th>
              <th className="px-3 py-2 font-medium">Nome hoje (da nota)</th>
              <th className="px-3 py-2 font-medium">Vai ficar</th>
              <th className="px-3 py-2 font-medium">Atalhos</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
            </tr></thead>
            <tbody>
              {linhas.map((l) => {
                const v = valorDe(l)
                const mudou = v.trim() && v !== l.nomeAtual
                return (
                  <tr key={l.itemId} className={`border-b border-slate-50 last:border-0 ${marcado[l.itemId] ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-3 py-0">
                      <input
                        type="checkbox"
                        checked={!!marcado[l.itemId]}
                        disabled={!mudou}
                        onChange={(e) => setMarcado((m) => ({ ...m, [l.itemId]: e.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 accent-[#185FA5] disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-0 text-[13px] text-slate-500">
                      {l.nomeAtual}
                      {l.apelidos.length > 0 && (
                        <span className="ml-1.5 text-[11px] text-slate-400">· já busca por {l.apelidos.join(', ')}</span>
                      )}
                    </td>
                    <td className="px-3 py-0">
                      <input
                        value={v}
                        onChange={(e) => setEdit((x) => ({ ...x, [l.itemId]: e.target.value }))}
                        className="h-7 w-full min-w-[220px] rounded-lg border border-slate-300 px-2 text-[13px]"
                      />
                      {l.porque.length > 0 && (
                        <div className="pb-1 text-[10.5px] leading-tight text-slate-400">{l.porque.join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-3 py-0 text-[12px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {/* ⭐ o nome do PDV é ATALHO, não a sugestão: medido que ele às vezes
                            PERDE informação ("SUCO DELL VALE" esquece o UVA). */}
                        {l.doCardapio && l.doCardapio !== v && (
                          <button onClick={() => setEdit((x) => ({ ...x, [l.itemId]: l.doCardapio! }))}
                            className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11.5px] text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-100">
                            no cardápio: {l.doCardapio}
                          </button>
                        )}
                        {v !== l.sugestao && (
                          <button onClick={() => setEdit((x) => { const n = { ...x }; delete n[l.itemId]; return n })}
                            className="inline-flex items-center gap-1 text-[11.5px] text-slate-400 hover:text-slate-700">
                            <RotateCcw className="h-3 w-3" /> sugestão
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-0 text-right text-[13px] tabular-nums text-slate-600">{num(l.saldo)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      <p className="text-[11.5px] text-slate-400">
        ⚠️ Renomear não mexe no vínculo com o fornecedor (é por código do produto na nota), nem na ficha,
        nem no histórico — todos apontam pro item por id. E o nome antigo vira apelido de busca.
      </p>
    </div>
  )
}
