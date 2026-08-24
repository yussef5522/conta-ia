'use client'

// ESTOQUE ↔ FINANCEIRO — PONTE 1: aprovar em lote os boletos que estão esperando.
// Serve o retroativo (notas já conferidas antes da ponte existir) e o dia a dia de quem
// confere sem poder criar conta a pagar (o operador confere; o dono aprova aqui).
//
// Nada sai daqui sem o gesto do dono: checkbox por parcela + aceite pra cadastrar
// fornecedor que ainda não existe no financeiro.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Receipt, Loader2, Check, AlertTriangle, ArrowRight } from 'lucide-react'

interface Pendente {
  suggestionId: string; nfeId: string; chave: string; nDup: string | null
  fornecedorNome: string; fornecedorCnpj: string | null; fornecedorNoFinanceiro: boolean
  valor: number; dVenc: string | null; nNF: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')
const venceEm = (iso: string | null) => {
  if (!iso) return null
  const d = Math.ceil((new Date(iso.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86_400_000)
  return d
}

export default function PonteContasPagarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ps, setPs] = useState<Pendente[] | null | undefined>(undefined)
  const [marcados, setMarcados] = useState<string[]>([])
  const [cadastrar, setCadastrar] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ criadas: number; valorTotal: number; fornecedoresCadastrados: number; erros: { motivo: string }[] } | null>(null)

  const carregar = () => fetch(`/api/empresas/${id}/estoque/contas-a-pagar`)
    .then((r) => r.json()).then((j) => { setPs(j.pendentes ?? null); setMarcados((j.pendentes ?? []).map((p: Pendente) => p.suggestionId)) })
    .catch(() => setPs(null))
  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMarcado = useMemo(() => (ps ?? []).filter((p) => marcados.includes(p.suggestionId)).reduce((s, p) => s + p.valor, 0), [ps, marcados])
  const faltamCadastro = useMemo(() => {
    const nomes = new Set((ps ?? []).filter((p) => marcados.includes(p.suggestionId) && !p.fornecedorNoFinanceiro).map((p) => p.fornecedorNome))
    return [...nomes]
  }, [ps, marcados])

  async function enviar() {
    setEnviando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/contas-a-pagar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: marcados, cadastrarFornecedores: cadastrar }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui enviar.'); return }
      setResultado(j)
      await carregar()
    } catch { setErro('Falha de rede ao enviar.') } finally { setEnviando(false) }
  }

  if (ps === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (!ps) return <div className="p-6 text-sm text-slate-500">Não consegui carregar as parcelas.</div>

  return (
    <div className="space-y-3 pb-24">
      <div className="flex flex-wrap items-center gap-2.5">
        <Receipt className="h-5 w-5 shrink-0 text-[#185FA5]" />
        <h1 className="text-base font-semibold text-slate-900">Boletos pro Contas a Pagar</h1>
        <p className="hidden min-w-[18rem] flex-1 truncate text-xs text-slate-400 lg:block">Parcelas das notas conferidas, esperando sua aprovação — viram conta a pagar de verdade</p>
        <a href={`/contas-a-pagar?empresaId=${id}`} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50">
          ver Contas a Pagar <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {resultado && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-900">
            <b>{resultado.criadas} {resultado.criadas === 1 ? 'conta criada' : 'contas criadas'}</b> · {brl(resultado.valorTotal)}
            {resultado.fornecedoresCadastrados > 0 && ` · ${resultado.fornecedoresCadastrados} fornecedor(es) cadastrado(s) no financeiro`}
            {resultado.erros.length > 0 && <span className="block text-amber-800">{resultado.erros.length} não foram: {resultado.erros[0].motivo}</span>}
          </p>
        </div>
      )}

      {ps.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Receipt className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-700">Nenhum boleto esperando.</p>
          <p className="max-w-md text-xs text-slate-500">Quando você conferir uma nota com duplicatas, as parcelas aparecem aqui (ou vão direto, se você marcar no bloco da conferência).</p>
        </CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="p-0">
            <table className="density-normal hidden w-full sm:table">
              <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={marcados.length === ps.length} onChange={(e) => setMarcados(e.target.checked ? ps.map((p) => p.suggestionId) : [])} className="h-4 w-4" />
                </th>
                <th className="px-3 py-2 font-medium">Fornecedor</th>
                <th className="px-3 py-2 font-medium">Nota</th>
                <th className="px-3 py-2 font-medium">Parcela</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 text-right font-medium">Vencimento</th>
              </tr></thead>
              <tbody>
                {ps.map((p) => {
                  const m = marcados.includes(p.suggestionId)
                  const d = venceEm(p.dVenc)
                  return (
                    <tr key={p.suggestionId} className={`border-b border-slate-50 last:border-b-0 ${m ? '' : 'opacity-50'}`}>
                      <td className="px-3 py-1">
                        <input type="checkbox" checked={m} onChange={() => setMarcados((x) => m ? x.filter((y) => y !== p.suggestionId) : [...x, p.suggestionId])} className="h-4 w-4" />
                      </td>
                      <td className="px-3 py-1 text-[13px] font-medium text-slate-800">
                        {p.fornecedorNome}
                        {!p.fornecedorNoFinanceiro && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">novo no financeiro</span>}
                      </td>
                      <td className="px-3 py-1 text-[13px] tabular-nums text-slate-500">{p.nNF ? `nº ${p.nNF}` : '—'}</td>
                      <td className="px-3 py-1 text-[13px] text-slate-500">{p.nDup ?? '—'}</td>
                      <td className="px-3 py-1 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(p.valor)}</td>
                      <td className={`whitespace-nowrap px-3 py-1 text-right text-[13px] tabular-nums ${d != null && d < 0 ? 'font-semibold text-rose-600' : d != null && d <= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {dia(p.dVenc)}{d != null && d < 0 ? ' (vencido)' : d != null && d <= 3 ? ` (${d}d)` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="divide-y divide-slate-50 sm:hidden">
              {ps.map((p) => {
                const m = marcados.includes(p.suggestionId)
                return (
                  <label key={p.suggestionId} className={`flex items-start gap-3 p-4 ${m ? '' : 'opacity-50'}`}>
                    <input type="checkbox" checked={m} onChange={() => setMarcados((x) => m ? x.filter((y) => y !== p.suggestionId) : [...x, p.suggestionId])} className="mt-0.5 h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{p.fornecedorNome}</p>
                      <p className="text-xs text-slate-500">{p.nNF ? `NF ${p.nNF} · ` : ''}parcela {p.nDup ?? '—'} · vence {dia(p.dVenc)}</p>
                      {!p.fornecedorNoFinanceiro && <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">novo no financeiro</span>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{brl(p.valor)}</span>
                  </label>
                )
              })}
            </div>
          </CardContent></Card>

          {faltamCadastro.length > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <input type="checkbox" checked={cadastrar} onChange={(e) => setCadastrar(e.target.checked)} className="mt-0.5 h-4 w-4" />
              <span className="text-xs text-amber-900">
                Cadastrar {faltamCadastro.length} fornecedor(es) no financeiro: <b>{faltamCadastro.join(', ')}</b>
                <span className="block text-[11px] text-amber-700">Razão social e CNPJ vêm do XML da nota (dado assinado pela SEFAZ). Sem isso essas parcelas não podem virar conta a pagar.</span>
              </span>
            </label>
          )}

          {erro && <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{erro}</p>}
        </>
      )}

      {ps.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:left-60">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs tabular-nums text-slate-500"><b className="text-slate-800">{marcados.length}/{ps.length}</b> marcados · <b className="text-slate-800">{brl(totalMarcado)}</b></span>
            {marcados.length > 0 && faltamCadastro.length > 0 && !cadastrar && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> sem cadastrar o fornecedor, essas parcelas serão recusadas</span>
            )}
            <button onClick={enviar} disabled={enviando || marcados.length === 0}
              className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:bg-slate-200 disabled:text-slate-400">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Enviar {marcados.length} {marcados.length === 1 ? 'conta' : 'contas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
