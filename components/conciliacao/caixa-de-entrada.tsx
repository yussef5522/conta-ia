'use client'

// ⭐⭐⭐ O BALCÃO ÚNICO — a caixa de entrada do banco, duas abas (15/09/2026).
//
// **O desenho aprovado pelo dono:** *"a Conciliação VIRA essa tela: duas abas, SAÍDAS e
// ENTRADAS. Toda linha confirmada e não-resolvida mora aqui — e SÓ aqui — com o menu do seu
// sentido."*
//
// ⛔ **ENTRADAS É ABA, NUNCA TELA NOVA** (voto dele, e é a lição do B1): duas telas sobre o
// mesmo extrato divergiriam no primeiro estado novo.
//
// ⛔⛔ **TODO GESTO EFETIVA.** O clique chama `/api/conciliacao/resolver`, que despacha pro
// motor real — e a linha **sai da caixa na hora**. As ações de VÍNCULO (casar, transferência)
// levam ao lugar onde o alvo se escolhe; elas nunca calam.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ArrowDownLeft, ArrowUpRight, Check, AlertTriangle } from 'lucide-react'
import { fetchComTimeout } from '@/lib/http/fetch-com-timeout'

interface AcaoDTO { acao: string; rotulo: string; pedeAlvo: string | null }
interface LinhaDTO {
  id: string; tipo: string; valor: number; data: string; descricao: string
  contraparte: string | null; conta: string | null
  sentido: 'SAIDA' | 'ENTRADA'; estacao: 'CAIXA' | 'ARQUIVO'
  resolvidaComo: string | null; acoes: AcaoDTO[]
}
interface CaixaDTO {
  contadores: { saidas: number; entradas: number; arquivo: number; total: number }
  linhas: LinhaDTO[]
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

export function CaixaDeEntrada({ empresaId }: { empresaId: string }) {
  const [caixa, setCaixa] = useState<CaixaDTO | null>(null)
  const [aba, setAba] = useState<'SAIDA' | 'ENTRADA'>('SAIDA')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [feito, setFeito] = useState<{ id: string; efeito: string } | null>(null)
  const [categorias, setCategorias] = useState<{ id: string; name: string; type: string }[]>([])
  const [cartoes, setCartoes] = useState<{ id: string; name: string }[]>([])

  const carregar = useCallback(async () => {
    // ⛔ COM TIMEOUT: spinner eterno é a ausência fingindo progresso (14/09)
    const r = await fetchComTimeout<CaixaDTO>(`/api/conciliacao/caixa?empresaId=${empresaId}`)
    if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui carregar a caixa de entrada.'); return }
    setErro(null); setCaixa(r.data)
  }, [empresaId])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => {
    void (async () => {
      const [c, k] = await Promise.all([
        fetchComTimeout<{ categories?: { id: string; name: string; type: string }[] }>(`/api/categorias?empresaId=${empresaId}`),
        fetchComTimeout<{ cards?: { id: string; name: string }[] }>(`/api/empresas/${empresaId}/cartoes`),
      ])
      if (c.ok && c.data?.categories) setCategorias(c.data.categories)
      if (k.ok && k.data?.cards) setCartoes(k.data.cards)
    })()
  }, [empresaId])

  /**
   * ⭐⭐ O GESTO. ⛔ Ele não termina em "marquei": ou o servidor devolve o EFEITO no destino,
   * ou devolve o CAMINHO onde o alvo se escolhe. **Silêncio não é desfecho** (14/09).
   */
  async function gesto(linha: LinhaDTO, acao: string, alvo: Record<string, unknown> = {}) {
    setOcupado(linha.id); setErro(null)
    try {
      const r = await fetchComTimeout<{ efeito?: string; deepLink?: string }>(`/api/conciliacao/resolver`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ empresaId, txId: linha.id, acao, ...alvo }), timeoutMs: 30_000,
      })
      if (!r.ok || !r.data) { setErro(r.erro ?? 'Não consegui resolver esta linha.'); return }
      if (r.data.deepLink) { window.location.href = r.data.deepLink; return }
      setFeito({ id: linha.id, efeito: r.data.efeito ?? 'resolvida' })
      await carregar()   // ⭐ a linha sai da caixa NA HORA
    } finally { setOcupado(null) }
  }

  const visiveis = useMemo(() => (caixa?.linhas ?? []).filter((l) => l.sentido === aba), [caixa, aba])

  if (erro && !caixa) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
        {erro}
        <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
      </div>
    )
  }
  if (!caixa) return <div className="flex items-center gap-2 p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> abrindo a caixa de entrada…</div>

  const c = caixa.contadores
  const fecha = c.saidas + c.entradas + c.arquivo === c.total

  return (
    <div className="space-y-3">
      {/* ⭐ O FLUXO ESCRITO NO TOPO — o dono pediu: "BANCO → IMPORT → CAIXA → ARQUIVO" */}
      <p className="text-[11px] text-slate-400">
        BANCO → <b className="text-slate-600">IMPORT</b> (confirma) → <b className="text-[#534AB7]">CAIXA DE ENTRADA</b> (você resolve) → <b className="text-slate-600">MOVIMENTAÇÕES</b> (arquivo)
      </p>

      {/* ⭐⭐ AS DUAS ABAS — o sentido decide o menu, o menu decide a fila */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([['SAIDA', `Saídas: ${c.saidas}`, ArrowUpRight], ['ENTRADA', `Entradas: ${c.entradas}`, ArrowDownLeft]] as const).map(([k, rot, Icone]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold ${aba === k ? 'border-[#534AB7] bg-violet-50 text-[#534AB7]' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            <Icone className="h-4 w-4" /> {rot}
          </button>
        ))}
        {/* ⚠️ o ARQUIVO aparece no contador de propósito: é o invariante "uma linha, uma
            estação" ficando VISÍVEL. Número que fecha por fora é promessa. */}
        <span className="ml-auto text-[11px] text-slate-400">
          {c.arquivo} no arquivo · {c.total} no período
          {!fecha && <b className="ml-1 text-rose-600">⛔ a soma não fecha</b>}
          
        </span>
      </div>

      {erro && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {erro}
          <button type="button" onClick={() => { setErro(null); void carregar() }} className="ml-1.5 font-semibold underline">tentar de novo</button>
        </div>
      )}
      {feito && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">
          <Check className="h-4 w-4 shrink-0" /> {feito.efeito}
          <button type="button" onClick={() => setFeito(null)} className="ml-auto text-[11px] underline">ok</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        {visiveis.length === 0 && (
          <p className="px-3 py-6 text-center text-[13px] text-slate-500">
            {aba === 'SAIDA' ? 'Nenhuma saída esperando decisão.' : 'Nenhuma entrada esperando decisão.'}
          </p>
        )}
        {visiveis.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:flex-row sm:items-center sm:gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-medium text-slate-800">{l.descricao || '(sem descrição)'}</span>
              <span className="ml-1.5 text-[11px] text-slate-400">{dia(l.data)} · {l.conta}</span>
              {l.contraparte && <span className="block text-[11px] text-slate-500">{l.contraparte}</span>}
            </div>
            <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${l.sentido === 'ENTRADA' ? 'text-emerald-700' : 'text-slate-900'}`}>
              {l.sentido === 'ENTRADA' ? '+' : '−'} {brl(l.valor)}
            </span>

            {/* ⭐⭐ O MENU DO SENTIDO — a lista vem do SERVIDOR, que é quem conhece a lei */}
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {l.acoes.map((a) => {
                if (a.pedeAlvo === 'CATEGORIA') {
                  return (
                    <select key={a.acao} defaultValue="" disabled={ocupado === l.id}
                      onChange={(e) => e.target.value && gesto(l, a.acao, { categoryId: e.target.value })}
                      aria-label={a.rotulo}
                      className="h-7 max-w-[10rem] rounded-lg border border-slate-300 px-1.5 text-[11px] disabled:opacity-40">
                      <option value="">{a.rotulo}</option>
                      {categorias
                        .filter((c2) => (l.sentido === 'ENTRADA' ? c2.type === 'INCOME' : c2.type === 'EXPENSE'))
                        .map((c2) => <option key={c2.id} value={c2.id}>{c2.name}</option>)}
                    </select>
                  )
                }
                if (a.pedeAlvo === 'CARTAO') {
                  return (
                    <select key={a.acao} defaultValue="" disabled={ocupado === l.id}
                      onChange={(e) => e.target.value && gesto(l, a.acao, { cardId: e.target.value })}
                      aria-label={a.rotulo}
                      className="h-7 max-w-[9rem] rounded-lg border border-slate-300 px-1.5 text-[11px] disabled:opacity-40">
                      <option value="">{a.rotulo}</option>
                      {cartoes.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                    </select>
                  )
                }
                return (
                  <button key={a.acao} type="button" disabled={ocupado === l.id}
                    onClick={() => gesto(l, a.acao)}
                    className="inline-flex h-7 items-center rounded-lg border border-slate-300 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                    {ocupado === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : a.rotulo}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {(c.saidas + c.entradas) > 0 && (
        <p className="flex items-start gap-1.5 text-[12px] text-slate-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {c.saidas + c.entradas} linha(s) esperando decisão. Resolvida sai daqui na hora e vai pro arquivo, com o selo de COMO.
        </p>
      )}
    </div>
  )
}
