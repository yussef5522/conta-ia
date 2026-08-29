'use client'

// ⭐ AJUSTAR PARCELAS — o combinado ≠ a nota (29/08/2026, caso BOX PAPER).
//
// UM editor, usado nos DOIS momentos (REGRA 4): na conferência (antes de mandar pro
// financeiro) e depois, na tela de boletos, quando o fornecedor renegocia o que já foi
// enviado. Dois editores divergiriam na primeira regra nova.
//
// ⚠️ A LISTA NASCE DAS DUPLICATAS DO XML — como SUGESTÃO, não como verdade travada. E o
// que a nota diz fica visível ao lado o tempo todo: o dono precisa ver as duas coisas pra
// saber o que está mudando.

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, X } from 'lucide-react'

export interface ParcelaEditavel {
  valor: string // texto: é o que se digita (a mesma lição do campo de quantidade)
  dVenc: string // YYYY-MM-DD
}

interface Props {
  aberto: boolean
  onFechar: () => void
  /** o que a NOTA diz — some da edição, mas nunca da tela */
  xml: Array<{ numero: string; valor: number; dVenc: string | null }>
  totalNota: number
  /** o combinado de hoje (parte daqui) */
  inicial: ParcelaEditavel[]
  motivoInicial?: string | null
  /** quantas contas a pagar serão CANCELADAS e recriadas (0 = nada foi enviado ainda) */
  contasQueSeraoCanceladas?: number
  salvando?: boolean
  onSalvar: (parcelas: ParcelaEditavel[], motivo: string | null) => void
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (t: string) => Number(String(t).replace(/\./g, '').replace(',', '.')) || 0
const dataBR = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

export function EditorParcelas(p: Props) {
  const [linhas, setLinhas] = useState<ParcelaEditavel[]>(p.inicial.length ? p.inicial : [{ valor: '', dVenc: '' }])
  const [motivo, setMotivo] = useState(p.motivoInicial ?? '')

  const soma = useMemo(() => linhas.reduce((s, l) => s + num(l.valor), 0), [linhas])
  const diferenca = Math.round((soma - p.totalNota) * 100) / 100
  const fecha = Math.abs(diferenca) <= 0.01
  const exigeMotivo = !fecha && linhas.length > 0
  const faltaData = linhas.some((l) => !l.dVenc)
  const faltaValor = linhas.some((l) => num(l.valor) <= 0)
  const podeSalvar = !faltaData && !faltaValor && linhas.length > 0 && (!exigeMotivo || motivo.trim().length > 0) && !p.salvando

  if (!p.aberto) return null

  const set = (i: number, campo: keyof ParcelaEditavel, v: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: v } : l)))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={p.onFechar}>
      <div className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Ajustar parcelas</h3>
            <p className="text-xs text-slate-500">O que foi combinado com o fornecedor pode ser diferente da nota.</p>
          </div>
          <button onClick={p.onFechar} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* ⭐ O QUE A NOTA DIZ — sempre visível, nunca editável (é da SEFAZ) */}
          <div className="rounded-lg border bg-slate-50 dark:bg-slate-800/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">A nota diz ({p.xml.length} {p.xml.length === 1 ? 'parcela' : 'parcelas'})</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {p.xml.map((x) => (
                <span key={x.numero}>{x.numero}: <strong>{brl(x.valor)}</strong> · {dataBR(x.dVenc)}</span>
              ))}
              {p.xml.length === 0 && <span>sem duplicata no XML</span>}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Total da nota: <strong className="tabular-nums">{brl(p.totalNota)}</strong> · esse dado é da SEFAZ e não muda.</p>
          </div>

          {/* O COMBINADO — editável */}
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">O combinado ({linhas.length})</p>
            {linhas.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 w-6 tabular-nums">{i + 1}</span>
                <div className="flex-1">
                  <input
                    inputMode="decimal"
                    value={l.valor}
                    onChange={(e) => set(i, 'valor', e.target.value)}
                    placeholder="valor"
                    className="w-full h-9 rounded-md border px-2 text-sm tabular-nums bg-white dark:bg-slate-800"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="date"
                    value={l.dVenc}
                    onChange={(e) => set(i, 'dVenc', e.target.value)}
                    className="w-full h-9 rounded-md border px-2 text-sm bg-white dark:bg-slate-800"
                  />
                </div>
                <button
                  onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}
                  className="p-2 text-slate-400 hover:text-rose-600"
                  title="remover parcela"
                ><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-8" onClick={() => setLinhas((ls) => [...ls, { valor: '', dVenc: '' }])}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar parcela
            </Button>
          </div>

          {/* A CONTA, ao vivo */}
          <div className={`rounded-lg border p-3 text-sm ${fecha ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'}`}>
            <div className="flex justify-between tabular-nums">
              <span>Soma das parcelas</span><strong>{brl(soma)}</strong>
            </div>
            <div className="flex justify-between tabular-nums text-slate-600 dark:text-slate-400">
              <span>Total da nota</span><span>{brl(p.totalNota)}</span>
            </div>
            {!fecha && (
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                {diferenca > 0 ? 'Passa' : 'Fica abaixo'} da nota em <strong>{brl(Math.abs(diferenca))}</strong>.
                Isso acontece em renegociação (desconto, juros) — escreva o motivo e siga.
              </p>
            )}
          </div>

          {exigeMotivo && (
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Motivo (curto)</label>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="ex.: juros da renegociação"
                className="mt-1 w-full h-9 rounded-md border px-2 text-sm bg-white dark:bg-slate-800"
              />
            </div>
          )}

          {/* ⚠️ o que vai acontecer no financeiro — dito ANTES, não depois */}
          {(p.contasQueSeraoCanceladas ?? 0) > 0 && (
            <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-md p-2">
              ⚠️ Esta nota já tem <strong>{p.contasQueSeraoCanceladas}</strong> conta(s) no Contas a Pagar.
              Ao salvar, elas são canceladas e recriadas com o combinado novo (o vínculo com a nota é preservado).
              Parcela já paga ou conciliada não é tocada — se houver, o sistema recusa e diz qual.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {faltaValor || faltaData ? 'Toda parcela precisa de valor e vencimento.' : `${linhas.length} parcela(s) · ${brl(soma)}`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={p.onFechar}>Cancelar</Button>
            <Button size="sm" disabled={!podeSalvar} onClick={() => p.onSalvar(linhas, motivo.trim() || null)}>
              {p.salvando ? 'Salvando…' : 'Salvar combinado'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
