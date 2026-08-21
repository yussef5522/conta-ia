'use client'

// ESTOQUE FASE 1 item 2 — CONFERÊNCIA em MODO TESTE (mobile-first). NÃO grava nada.
// O dono testa no celular os 3 fluxos com a NF golden: (1) item já mapeado só confere,
// (2) não mapeado → criar produto (unidade/categoria sugeridas, fator se difere),
// (3) divergência → motivo + foto. O botão CONFIRMAR fica DESLIGADO até ele aprovar.

import { useEffect, useMemo, useState, use } from 'react'
import {
  PackageOpen, Check, Search, Plus, Camera, AlertTriangle, FlaskConical, Store, X, Loader2, ChevronRight,
} from 'lucide-react'

type Unidade = 'KG' | 'UN' | 'LT'
type Categoria = 'MATERIA_PRIMA' | 'REVENDA' | 'EMBALAGEM' | 'LIMPEZA' | 'USO_INTERNO'
const CAT_LABEL: Record<Categoria, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }
const MOTIVOS = ['FALTOU', 'SOBROU', 'AVARIA', 'RECUSADO'] as const
type Motivo = (typeof MOTIVOS)[number]

interface PreviewItem {
  nfeItemId: string; xProd: string; cProd: string; ncm: string; uCom: string; qCom: number; vUnCom: number; vProd: number
  mapeado: { itemId: string; nome: string; unidadeControle: Unidade; fatorConversao: number } | null
  sugestao: { nome: string; unidade: Unidade | null; categoria: Categoria }
}
interface Preview {
  modoTeste: true; fornecedor: { nome: string; cnpj: string; uf: string; jaCadastrado: boolean }
  chave: string; dataEmissao: string; valorNota: number; itens: PreviewItem[]
}
interface ItemExistente { id: string; nome: string; unidadeControle: string; categoria: string }

interface Estado {
  mapeado: { itemId: string; nome: string; unidadeControle: Unidade; fatorConversao: number } | null
  qtdRecebida: number
  motivo: Motivo | null
  fotoBase64: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')

// comprime a foto no client (max 800px, jpeg 0.6) — não upload, só preview base64
async function comprimirFoto(file: File): Promise<string> {
  const img = document.createElement('img')
  const url = URL.createObjectURL(file)
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
  const max = 800
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', 0.6)
}

export default function ConferenciaPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{ preview: Preview; itensExistentes: ItemExistente[] } | null | undefined>(undefined)
  const [fornCadastrado, setFornCadastrado] = useState(false)
  const [estado, setEstado] = useState<Record<string, Estado>>({})
  const [sheetItem, setSheetItem] = useState<PreviewItem | null>(null)

  useEffect(() => {
    fetch(`/api/empresas/${id}/estoque/recebimentos/preview`).then((r) => r.json()).then((j) => {
      if (!j.preview) { setData(null); return }
      setData(j)
      setFornCadastrado(j.preview.fornecedor.jaCadastrado)
      const init: Record<string, Estado> = {}
      for (const it of j.preview.itens as PreviewItem[]) {
        init[it.nfeItemId] = { mapeado: it.mapeado, qtdRecebida: it.qCom * (it.mapeado?.fatorConversao ?? 1), motivo: null, fotoBase64: null }
      }
      setEstado(init)
    }).catch(() => setData(null))
  }, [id])

  const preview = data && data !== null ? data.preview : null
  const totalMapeado = useMemo(() => preview ? preview.itens.every((it) => estado[it.nfeItemId]?.mapeado) : false, [preview, estado])
  const divergencias = useMemo(() => {
    if (!preview) return 0
    return preview.itens.filter((it) => { const e = estado[it.nfeItemId]; return e && Math.abs(e.qtdRecebida - it.qCom * (e.mapeado?.fatorConversao ?? 1)) > 0.0001 }).length
  }, [preview, estado])

  if (data === undefined) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
  if (data === null || !preview) return <div className="p-6 text-sm text-slate-500">Não consegui carregar o preview.</div>

  const setItem = (id_: string, patch: Partial<Estado>) => setEstado((s) => ({ ...s, [id_]: { ...s[id_], ...patch } }))

  return (
    <div className="mx-auto max-w-md pb-28">
      {/* banner modo teste */}
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-800">
        <FlaskConical className="h-4 w-4 shrink-0" /> Modo teste — nada é gravado. Experimente o fluxo à vontade.
      </div>

      <div className="space-y-4 p-4">
        {/* fornecedor */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Store className="h-4 w-4 text-[#185FA5]" /> {preview.fornecedor.nome}</div>
          <p className="mt-0.5 text-xs text-slate-500">{fmtCnpj(preview.fornecedor.cnpj)} · {preview.fornecedor.uf} · {preview.itens.length} itens · {brl(preview.valorNota)}</p>
          {!fornCadastrado && (
            <button onClick={() => setFornCadastrado(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#185FA5] py-2.5 text-sm font-semibold text-white active:bg-[#0F4A8C]">
              <Plus className="h-4 w-4" /> Cadastrar fornecedor (1 toque)
            </button>
          )}
          {fornCadastrado && <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Fornecedor cadastrado</p>}
        </div>

        {/* itens */}
        <div className="space-y-3">
          {preview.itens.map((it) => {
            const e = estado[it.nfeItemId]
            const esperada = it.qCom * (e?.mapeado?.fatorConversao ?? 1)
            const diverge = e && Math.abs(e.qtdRecebida - esperada) > 0.0001
            return (
              <div key={it.nfeItemId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{it.xProd}</p>
                <p className="text-xs text-slate-500">Nota: {it.qCom} {it.uCom} · {brl(it.vUnCom)}/{it.uCom}</p>

                {/* mapeamento */}
                {e?.mapeado ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <Check className="h-4 w-4 shrink-0" /> <span className="font-medium">{e.mapeado.nome}</span>
                    {e.mapeado.fatorConversao !== 1 && <span className="text-xs text-emerald-600">(1 {it.uCom} = {e.mapeado.fatorConversao} {e.mapeado.unidadeControle})</span>}
                  </div>
                ) : (
                  <button onClick={() => setSheetItem(it)} className="mt-3 flex w-full items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 active:bg-amber-100">
                    <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Que produto é este?</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}

                {/* qtd recebida */}
                {e?.mapeado && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-slate-600">Quantidade recebida ({e.mapeado.unidadeControle})</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="number" inputMode="decimal" value={e.qtdRecebida}
                        onChange={(ev) => setItem(it.nfeItemId, { qtdRecebida: Number(ev.target.value) })}
                        className={`w-32 rounded-lg border px-3 py-2 text-base tabular-nums ${diverge ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`} />
                      <span className="text-xs text-slate-400">esperado {esperada}</span>
                    </div>
                    {diverge && (
                      <div className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3">
                        <p className="flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Veio diferente da nota — por quê?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MOTIVOS.map((m) => (
                            <button key={m} onClick={() => setItem(it.nfeItemId, { motivo: m })}
                              className={`rounded-full px-3 py-1 text-xs font-medium ${e.motivo === m ? 'bg-amber-600 text-white' : 'bg-white text-amber-700 border border-amber-300'}`}>{m}</button>
                          ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-amber-800">
                          <Camera className="h-4 w-4" /> {e.fotoBase64 ? 'Trocar foto' : 'Adicionar foto (opcional)'}
                          <input type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setItem(it.nfeItemId, { fotoBase64: await comprimirFoto(f) }) }} />
                        </label>
                        {e.fotoBase64 && <img src={e.fotoBase64} alt="foto" className="h-24 rounded-lg object-cover" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* rodapé fixo */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>{preview.itens.filter((it) => estado[it.nfeItemId]?.mapeado).length}/{preview.itens.length} itens mapeados</span>
          {divergencias > 0 && <span className="font-medium text-amber-600">{divergencias} divergência(s)</span>}
        </div>
        <button disabled title="Preview — desligado"
          className="w-full cursor-not-allowed rounded-xl bg-slate-200 py-3.5 text-sm font-semibold text-slate-400">
          {totalMapeado ? '✓ Pronto pra confirmar — botão liga após você aprovar o fluxo' : 'Mapeie todos os itens pra confirmar'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-400">No app real: gera os movimentos de estoque + contas a pagar sugerido + Confirmação na SEFAZ.</p>
      </div>

      {/* sheet: mapear produto */}
      {sheetItem && (
        <MapearSheet item={sheetItem} existentes={data.itensExistentes}
          onClose={() => setSheetItem(null)}
          onEscolher={(m) => { setItem(sheetItem.nfeItemId, { mapeado: m, qtdRecebida: sheetItem.qCom * m.fatorConversao }); setSheetItem(null) }} />
      )}
    </div>
  )
}

function MapearSheet({ item, existentes, onClose, onEscolher }: {
  item: PreviewItem; existentes: ItemExistente[]
  onClose: () => void
  onEscolher: (m: { itemId: string; nome: string; unidadeControle: Unidade; fatorConversao: number }) => void
}) {
  const [busca, setBusca] = useState('')
  const [modo, setModo] = useState<'buscar' | 'criar'>(existentes.length > 0 ? 'buscar' : 'criar')
  const [nome, setNome] = useState(item.sugestao.nome)
  const [unidade, setUnidade] = useState<Unidade>(item.sugestao.unidade ?? 'UN')
  const [categoria, setCategoria] = useState<Categoria>(item.sugestao.categoria)
  const [fator, setFator] = useState(1)
  const filtrados = existentes.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Que produto é este?</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Da nota: <b>{item.xProd}</b> · {item.qCom} {item.uCom}</p>

        <div className="mb-3 flex gap-2">
          <button onClick={() => setModo('buscar')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${modo === 'buscar' ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>Buscar existente</button>
          <button onClick={() => setModo('criar')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${modo === 'criar' ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>Criar novo</button>
        </div>

        {modo === 'buscar' ? (
          <div className="space-y-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar no estoque…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {filtrados.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Nenhum item ainda. Use "Criar novo".</p>}
            {filtrados.map((e) => (
              <button key={e.id} onClick={() => onEscolher({ itemId: e.id, nome: e.nome, unidadeControle: e.unidadeControle as Unidade, fatorConversao: 1 })}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm active:bg-slate-50">
                <span className="font-medium text-slate-800">{e.nome}</span><span className="text-xs text-slate-400">{e.unidadeControle}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Nome do produto <span className="text-slate-400">(sugerido)</span></label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Unidade de controle <span className="text-slate-400">~sugerido {item.sugestao.unidade ?? 'a definir'}</span></label>
              <div className="mt-1 flex gap-2">
                {(['KG', 'UN', 'LT'] as Unidade[]).map((u) => (
                  <button key={u} onClick={() => setUnidade(u)} className={`flex-1 rounded-lg py-2 text-sm font-medium ${unidade === u ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>{u}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Categoria <span className="text-slate-400">~sugerido</span></label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {(Object.keys(CAT_LABEL) as Categoria[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </div>
            {item.uCom.toUpperCase() !== unidade && (
              <div className="rounded-lg bg-sky-50 p-3">
                <label className="text-xs font-medium text-sky-800">A nota veio em <b>{item.uCom}</b>, você controla em <b>{unidade}</b>. Quantas {unidade} tem 1 {item.uCom}?</label>
                <input type="number" inputMode="decimal" value={fator} onChange={(e) => setFator(Number(e.target.value))} className="mt-1 w-28 rounded-lg border border-sky-300 px-3 py-2 text-base tabular-nums" />
                <p className="mt-1 text-[11px] text-sky-600">1 {item.uCom} = {fator} {unidade} · {item.qCom} {item.uCom} = {item.qCom * fator} {unidade}</p>
              </div>
            )}
            <button onClick={() => onEscolher({ itemId: `novo-${item.nfeItemId}`, nome, unidadeControle: unidade, fatorConversao: item.uCom.toUpperCase() !== unidade ? fator : 1 })}
              className="w-full rounded-xl bg-[#185FA5] py-3 text-sm font-semibold text-white active:bg-[#0F4A8C]">Usar este produto</button>
          </div>
        )}
      </div>
    </div>
  )
}
