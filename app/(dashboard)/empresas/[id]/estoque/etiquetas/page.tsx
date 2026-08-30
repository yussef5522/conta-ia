'use client'

// ⭐⭐ ETIQUETAS — A CASA DA COZINHA (30/08/2026).
//
// A fila e o agente são o CANO; esta é a TORNEIRA. **3 toques do início ao fim:**
// produto → confere a prévia → imprimir. É a tela que o Cristian abre no celular.
//
// ⚠️ A PRÉVIA É EM TAMANHO REAL e sai da MESMA fonte do ZPL (`camposParaPrevia`), então o
// que ele vê é o que sai da Zebra. Etiqueta impressa errada só se descobre depois de
// colada no pacote, dentro da câmara — a conferência tem que ser ANTES.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tag, Loader2, Search, Printer, Check, AlertTriangle, X } from 'lucide-react'
import { PreviaEtiqueta } from '@/components/estoque/previa-etiqueta'
import { ESTADOS, calcularValidade, diasAte, type EstadoConservacao } from '@/lib/stock/etiquetas/modelo'
import { filtrarPorBusca } from '@/lib/busca-texto'

interface Produto {
  itemId: string; nome: string; categoria: string; unidade: string
  dias: Record<EstadoConservacao, number | null>
  temValidadePropria: boolean
  saldo: number
}

const SUGESTAO: Record<EstadoConservacao, number> = { CONGELADO: 90, RESFRIADO: 3, AMBIENTE: 1 }
const CAT_LABEL: Record<string, string> = {
  INTERMEDIARIO: 'produzido', PRODUTO_FINAL: 'produto final', MATERIA_PRIMA: 'matéria-prima',
}

export default function EtiquetasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [dados, setDados] = useState<{ produtos: Produto[]; colaboradores: { id: string; nome: string }[] } | null | undefined>(undefined)
  const [busca, setBusca] = useState('')
  const [sel, setSel] = useState<Produto | null>(null)
  const [estado, setEstado] = useState<EstadoConservacao>('RESFRIADO')
  const [copias, setCopias] = useState('1')
  const [colaborador, setColaborador] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ lote: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/etiquetas`).then((r) => r.json()).then(setDados).catch(() => setDados(null))
  }, [id])

  // ⚠️ busca no APP, sobre a mesma lista que a tela mostra (a lição do "PAO DE XIS":
  // `contains` do Postgres é case-sensitive e o filtro do banco não achava nada).
  const lista = useMemo(
    () => filtrarPorBusca(dados?.produtos ?? [], busca, (p) => p.nome),
    [dados, busca],
  )

  const diasVigentes = sel ? (sel.dias[estado] ?? SUGESTAO[estado]) : null
  const ehSugestao = sel ? sel.dias[estado] == null : false
  const agora = new Date()
  const validade = calcularValidade(agora, diasVigentes)
  const faltam = diasAte(validade, agora)

  async function imprimir() {
    if (!sel) return
    setEnviando(true); setErro(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/etiquetas`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: sel.itemId, estado, copias: Number(copias) || 1,
          dias: diasVigentes, colaborador: colaborador || null,
        }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui imprimir.'); return }
      setFeito({ lote: j.lote })
    } catch {
      setErro('Sem conexão com o servidor.')
    } finally { setEnviando(false) }
  }

  if (dados === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (dados === null) return <div className="p-6 text-sm text-slate-500">Não consegui carregar.</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-[#185FA5]" />
        <h1 className="text-base font-semibold">Etiquetas</h1>
        <p className="hidden lg:block text-xs text-slate-400">escolha o produto, confira e imprima</p>
      </div>

      {/* BUSCA GRANDE — é a primeira coisa que a mão encontra no celular */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="buscar produto…"
          className="h-12 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-base"
        />
      </div>

      {/* GRID DE PRODUTOS */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {lista.map((p) => (
          <button
            key={p.itemId}
            onClick={() => { setSel(p); setFeito(null); setErro(null) }}
            className={`rounded-xl border p-3 text-left transition-colors ${
              sel?.itemId === p.itemId ? 'border-[#185FA5] bg-sky-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <p className="text-sm font-medium leading-tight text-slate-900">{p.nome}</p>
            <p className="mt-1 text-[11px] text-slate-500">{CAT_LABEL[p.categoria] ?? p.categoria}</p>
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">
              {p.temValidadePropria
                ? Object.entries(p.dias).filter(([, d]) => d != null).map(([e, d]) => `${e[0]}${d}d`).join(' · ')
                : 'validade sugerida'}
            </p>
          </button>
        ))}
        {lista.length === 0 && <p className="col-span-full text-sm text-slate-500">Nenhum produto encontrado.</p>}
      </div>

      {/* PAINEL DO PRODUTO — prévia em tamanho real + estado + quantidade */}
      {sel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setSel(null)}>
          <div className="w-full sm:max-w-lg max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <h2 className="text-sm font-semibold">{sel.nome}</h2>
              <button onClick={() => setSel(null)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-4 p-4">
              {/* ⭐ A PRÉVIA — o que se vê é o que sai */}
              <div className="flex justify-center">
                <PreviaEtiqueta
                  dados={{
                    produto: sel.nome,
                    lote: 'PREVIA',
                    fabricacao: agora,
                    validadeAte: validade,
                    estado,
                    quantidade: null,
                    unidade: sel.unidade,
                    colaborador: colaborador || null,
                    empresa: null,
                  }}
                  lado={240}
                />
              </div>

              {/* ESTADO DE CONSERVAÇÃO — muda a validade na hora */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Como vai ser guardado</p>
                <div className="mt-1 flex gap-2">
                  {ESTADOS.map((e) => (
                    <button key={e.id} onClick={() => setEstado(e.id)}
                      className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                        estado === e.id ? 'border-[#185FA5] bg-sky-50 text-[#185FA5]' : 'border-slate-200 text-slate-600'
                      }`}>
                      {e.label}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {sel.dias[e.id] ?? SUGESTAO[e.id]} dias{sel.dias[e.id] == null ? ' (sug.)' : ''}
                      </span>
                    </button>
                  ))}
                </div>
                {ehSugestao && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    ⚠️ {diasVigentes} dias é <b>sugestão</b> — quantos dias este produto dura é decisão sua.
                    Defina em <b>Catálogo → o produto</b> pra a etiqueta parar de sugerir.
                  </p>
                )}
                {validade && faltam != null && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Vence em <b>{faltam} dia{faltam === 1 ? '' : 's'}</b> ({validade.toLocaleDateString('pt-BR')}).
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-slate-500">Quantas etiquetas
                  <input value={copias} onChange={(e) => setCopias(e.target.value)} inputMode="numeric"
                    className="mt-1 block h-10 w-24 rounded-lg border border-slate-300 px-3 text-base tabular-nums" />
                </label>
                <label className="min-w-[160px] flex-1 text-xs text-slate-500">Quem manipulou
                  <select value={colaborador} onChange={(e) => setColaborador(e.target.value)}
                    className="mt-1 block h-10 w-full rounded-lg border border-slate-300 px-2 text-sm">
                    <option value="">—</option>
                    {dados.colaboradores.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </label>
              </div>

              {erro && <p className="flex items-center gap-1 text-xs text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
              {feito && (
                <p className="flex items-center gap-1 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
                  <Check className="h-3.5 w-3.5" /> Na fila — lote <b>{feito.lote}</b>. O agente imprime em segundos.
                </p>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t bg-white px-4 py-3">
              <Button variant="outline" onClick={() => setSel(null)} className="flex-1">Fechar</Button>
              <Button onClick={imprimir} disabled={enviando} className="flex-[2]">
                {enviando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                Imprimir {Number(copias) > 1 ? `${copias} etiquetas` : 'etiqueta'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
