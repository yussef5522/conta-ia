'use client'

// ⭐⭐ EDITOR DE MODELO DE ETIQUETA (30/08/2026) — o dono DESENHA, não só configura.
//
// A SuFlex deixa ligar/desligar campo. Aqui dá pra renomear o rótulo, reordenar, mudar
// fonte, pôr negrito, adicionar linha de texto livre e ter vários modelos.
//
// ⚠️ A PRÉVIA AO LADO É A MESMA da tela de imprimir e do ZPL (`previaDosBlocos` /
// `zplDosBlocos` sobre os MESMOS blocos). Mexeu, viu — e o que se vê é o que sai.
//
// ⚠️ SETINHAS EM VEZ DE ARRASTAR: no celular — que é onde o dono vai mexer — arrastar
// dentro de uma lista que rola briga com o scroll da página e vira frustração. ↑↓ faz a
// mesma coisa, funciona no dedo frio e não depende de biblioteca.

import { useEffect, useMemo, useState, use } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  LayoutTemplate, Loader2, Plus, Trash2, ChevronUp, ChevronDown, Printer, Check, AlertTriangle, Star,
} from 'lucide-react'
import { PreviaEtiqueta } from '@/components/estoque/previa-etiqueta'
import {
  BLOCOS_PADRAO, novoBlocoTexto, avisosDoModelo, type Bloco,
} from '@/lib/stock/etiquetas/blocos'
import type { DadosEtiqueta } from '@/lib/stock/etiquetas/modelo'

interface Modelo { id: string; nome: string; padrao: boolean; blocos: Bloco[] }

const NOME_BLOCO: Record<string, string> = {
  produto: 'Nome do produto', validade: 'Validade', estado: 'Estado de conservação',
  fabricacao: 'Fabricação / manipulação', quantidade: 'Quantidade', lote: 'Lote',
  colaborador: 'Quem manipulou', empresa: 'Nome da empresa',
}

/** dados de exemplo — a prévia precisa de conteúdo pra mostrar o desenho */
const EXEMPLO: DadosEtiqueta = {
  produto: 'Porção de carne 100g',
  lote: 'A1B2C3D4',
  fabricacao: new Date(),
  validadeAte: new Date(Date.now() + 3 * 86_400_000),
  estado: 'RESFRIADO',
  quantidade: 25,
  unidade: 'UN',
  colaborador: 'Cristian',
  empresa: 'Caçula Mix',
}

export default function ModeloEtiquetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [modelos, setModelos] = useState<Modelo[] | null | undefined>(undefined)
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [nome, setNome] = useState('Padrão')
  const [blocos, setBlocos] = useState<Bloco[]>(BLOCOS_PADRAO)
  const [padrao, setPadrao] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'ok' | 'erro'; texto: string } | null>(null)

  const avisos = useMemo(() => avisosDoModelo(blocos), [blocos])

  const carregar = () =>
    fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`).then((r) => r.json()).then((j) => {
      setModelos(j.modelos ?? [])
      const atual = (j.modelos ?? []).find((m: Modelo) => m.padrao) ?? (j.modelos ?? [])[0]
      if (atual) { setModeloId(atual.id); setNome(atual.nome); setBlocos(atual.blocos); setPadrao(atual.padrao) }
    }).catch(() => setModelos(null))

  useEffect(() => { carregar() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const mexer = (i: number, patch: Partial<Bloco>) =>
    setBlocos((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))

  const mover = (i: number, dir: -1 | 1) =>
    setBlocos((bs) => {
      const j = i + dir
      if (j < 0 || j >= bs.length) return bs
      const copia = [...bs]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })

  async function salvar() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modeloId, nome, blocos, padrao }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setMsg({ tom: 'erro', texto: j?.erro ?? 'Não consegui salvar.' }); return }
      setModeloId(j.modeloId)
      setMsg({ tom: 'ok', texto: 'Modelo salvo.' })
      await carregar()
    } finally { setBusy(false) }
  }

  async function testar() {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/empresas/${id}/estoque/etiquetas/modelos`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocos }),
      })
      const j = await r.json().catch(() => null)
      setMsg(r.ok
        ? { tom: 'ok', texto: 'Teste na fila — o agente imprime em segundos.' }
        : { tom: 'erro', texto: j?.erro ?? 'Não consegui enfileirar o teste.' })
    } finally { setBusy(false) }
  }

  function novoModelo() {
    setModeloId(null); setNome('Novo modelo'); setBlocos(BLOCOS_PADRAO); setPadrao(false); setMsg(null)
  }

  if (modelos === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutTemplate className="h-5 w-5 text-[#185FA5]" />
        <h1 className="text-base font-semibold">Modelo de etiqueta</h1>
        <p className="hidden lg:block text-xs text-slate-400">mexeu, viu — é exatamente o que sai na Zebra</p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={modeloId ?? 'novo'}
            onChange={(e) => {
              if (e.target.value === 'novo') return novoModelo()
              const m = (modelos ?? []).find((x) => x.id === e.target.value)
              if (m) { setModeloId(m.id); setNome(m.nome); setBlocos(m.blocos); setPadrao(m.padrao) }
            }}
            className="h-8 rounded-md border px-2 text-xs"
          >
            {(modelos ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}{m.padrao ? ' ★' : ''}</option>)}
            <option value="novo">+ novo modelo</option>
          </select>
          <Button size="sm" variant="outline" className="h-8" onClick={testar} disabled={busy}>
            <Printer className="h-3 w-3 mr-1" /> imprimir teste
          </Button>
          <Button size="sm" className="h-8" onClick={salvar} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null} salvar
          </Button>
        </div>
      </div>

      {msg && (
        <p className={`flex items-center gap-1 text-xs ${msg.tom === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.tom === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {msg.texto}
        </p>
      )}

      {/* ⚠️ O MÍNIMO SANITÁRIO — avisa, não trava. Travar empurraria o dono a escrever a
          validade à mão numa fita crepe, que é pior: sai do sistema. */}
      {avisos.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-3">
            {avisos.map((a, i) => (
              <p key={i} className="flex items-start gap-1.5 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
              </p>
            ))}
            <p className="mt-1 text-[11px] text-amber-700">Dá pra salvar assim mesmo — a decisão é sua.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        {/* OS BLOCOS */}
        <Card>
          <CardContent className="py-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500">Nome do modelo
                <input value={nome} onChange={(e) => setNome(e.target.value)}
                  className="ml-2 h-8 w-48 rounded-md border px-2 text-sm" />
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} className="h-4 w-4" />
                <Star className="h-3 w-3" /> usar como padrão da empresa
              </label>
            </div>

            <div className="space-y-2">
              {blocos.map((b, i) => (
                <div key={b.id} className={`rounded-lg border p-2 ${b.ativo ? 'border-slate-200' : 'border-dashed border-slate-200 bg-slate-50/60 opacity-60'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" checked={b.ativo} onChange={(e) => mexer(i, { ativo: e.target.checked })} className="h-4 w-4" />
                    <span className="text-[13px] font-medium">
                      {b.tipo === 'qr' ? 'QR do lote' : b.tipo === 'texto' ? 'Texto livre' : NOME_BLOCO[b.campo ?? ''] ?? b.campo}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button onClick={() => mover(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                      <button onClick={() => mover(i, 1)} disabled={i === blocos.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                      {b.tipo === 'texto' && (
                        <button onClick={() => setBlocos((bs) => bs.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>

                  {b.ativo && b.tipo !== 'qr' && (
                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      {b.tipo === 'texto' ? (
                        <label className="min-w-[200px] flex-1 text-[11px] text-slate-500">Texto
                          <input value={b.texto ?? ''} onChange={(e) => mexer(i, { texto: e.target.value })}
                            className="mt-0.5 block h-8 w-full rounded-md border px-2 text-sm" />
                        </label>
                      ) : (
                        <label className="text-[11px] text-slate-500">Rótulo
                          <input value={b.rotulo} onChange={(e) => mexer(i, { rotulo: e.target.value })}
                            placeholder="(sem rótulo)"
                            className="mt-0.5 block h-8 w-32 rounded-md border px-2 text-sm" />
                        </label>
                      )}
                      <label className="text-[11px] text-slate-500">Tamanho
                        <input type="range" min={14} max={72} value={b.fonte}
                          onChange={(e) => mexer(i, { fonte: Number(e.target.value) })}
                          className="mt-0.5 block w-28" />
                      </label>
                      <span className="text-[11px] tabular-nums text-slate-400">{b.fonte}</span>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input type="checkbox" checked={!!b.negrito} onChange={(e) => mexer(i, { negrito: e.target.checked })} className="h-3.5 w-3.5" /> negrito
                      </label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-600">
                        <input type="checkbox" checked={!!b.destaque} onChange={(e) => mexer(i, { destaque: e.target.checked })} className="h-3.5 w-3.5" /> destaque
                      </label>
                    </div>
                  )}
                  {b.ativo && b.tipo === 'qr' && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Fica ancorado no canto inferior direito — não entra na ordem das linhas (ocuparia 1/5 da etiqueta).
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" className="mt-3 h-8"
              onClick={() => setBlocos((bs) => [...bs, novoBlocoTexto()])}>
              <Plus className="h-3 w-3 mr-1" /> adicionar linha de texto
            </Button>
            <p className="mt-1 text-[11px] text-slate-400">
              ex: “Mantenha congelado”, telefone da loja, CNPJ — o que você quiser, onde quiser na ordem.
            </p>
          </CardContent>
        </Card>

        {/* A PRÉVIA — grudada no topo pra acompanhar a edição */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="flex flex-col items-center py-4">
              <PreviaEtiqueta dados={EXEMPLO} blocos={blocos} lado={280} />
              <p className="mt-2 max-w-[280px] text-center text-[11px] text-slate-400">
                Dados de exemplo. O que muda aqui é exatamente o que muda na etiqueta impressa.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
