'use client'

// ESTOQUE FASE 1 item 2 — a tela de CONFERÊNCIA, UMA só (REGRA 4). Serve o preview
// (modo teste, dado ilustrativo) E a nota real (read-only enquanto o CONFIRMAR não
// liga). Mobile-first + desktop. Foto por webcam (desktop) OU câmera (celular).

import { useMemo, useState } from 'react'
import { Check, Search, Camera, AlertTriangle, FlaskConical, Store, X, ChevronRight, Eye, Loader2, PackageCheck } from 'lucide-react'

export type Unidade = 'KG' | 'UN' | 'LT'
export type Categoria = 'MATERIA_PRIMA' | 'REVENDA' | 'EMBALAGEM' | 'LIMPEZA' | 'USO_INTERNO'
const CAT_LABEL: Record<Categoria, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }
const MOTIVOS = ['FALTOU', 'SOBROU', 'AVARIA', 'RECUSADO'] as const
type Motivo = (typeof MOTIVOS)[number]

export interface ConfItem {
  nfeItemId: string; xProd: string; cProd: string; ncm: string; uCom: string; qCom: number; vUnCom: number; vProd: number
  mapeado: { itemId: string; nome: string; unidadeControle: Unidade; fatorConversao: number } | null
  sugestao: { nome: string; unidade: Unidade | null; categoria: Categoria }
}
export interface ConferenciaData {
  modoTeste: boolean
  fornecedor: { nome: string; cnpj: string; uf: string; jaCadastrado: boolean }
  dataEmissao: string | null
  valorNota: number | null
  itens: ConfItem[]
}
export interface ItemExistente { id: string; nome: string; unidadeControle: string; categoria: string }

export interface MapeadoSel { itemId: string; nome: string; unidadeControle: Unidade; categoria?: Categoria; fatorConversao: number; novo: boolean }

interface Estado {
  mapeado: MapeadoSel | null
  qtdRecebida: number
  motivo: Motivo | null
  fotoBase64: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtCnpj = (c: string) => (c ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—')
// TZ-safe: formata do próprio texto (YYYY-MM-DD…) sem new Date (evita rolar o dia).
const fmtDia = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—')

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

export function ConferenciaView({ data, itensExistentes, companyId, nfeId, podeConfirmar }: {
  data: ConferenciaData; itensExistentes: ItemExistente[]
  companyId?: string; nfeId?: string; podeConfirmar?: boolean
}) {
  const [fornCadastrado, setFornCadastrado] = useState(data.fornecedor.jaCadastrado)
  const [estado, setEstado] = useState<Record<string, Estado>>(() => {
    const init: Record<string, Estado> = {}
    for (const it of data.itens) init[it.nfeItemId] = { mapeado: it.mapeado ? { ...it.mapeado, novo: false } : null, qtdRecebida: it.qCom * (it.mapeado?.fatorConversao ?? 1), motivo: null, fotoBase64: null }
    return init
  })
  const [sheetItem, setSheetItem] = useState<ConfItem | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [recibo, setRecibo] = useState<any | null>(null)

  const totalMapeado = useMemo(() => data.itens.length > 0 && data.itens.every((it) => estado[it.nfeItemId]?.mapeado), [data.itens, estado])
  const divergencias = useMemo(() => data.itens.filter((it) => { const e = estado[it.nfeItemId]; return e && Math.abs(e.qtdRecebida - it.qCom * (e.mapeado?.fatorConversao ?? 1)) > 0.0001 }).length, [data.itens, estado])
  const setItem = (id_: string, patch: Partial<Estado>) => setEstado((s) => ({ ...s, [id_]: { ...s[id_], ...patch } }))

  async function confirmar() {
    if (!companyId || !nfeId) return
    setEnviando(true); setErro(null)
    try {
      const itens = data.itens.map((it) => {
        const e = estado[it.nfeItemId]!
        return { nfeItemId: it.nfeItemId, cProd: it.cProd, xProd: it.xProd, uCom: it.uCom, qtdNota: it.qCom, vUnCom: it.vUnCom, qtdRecebida: e.qtdRecebida, motivo: e.motivo, fotoBase64: e.fotoBase64, mapeado: e.mapeado }
      })
      const r = await fetch(`/api/empresas/${companyId}/estoque/recebimentos/${nfeId}/confirmar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornecedor: { cnpj: data.fornecedor.cnpj, nome: data.fornecedor.nome, uf: data.fornecedor.uf }, itens }),
      })
      const j = await r.json().catch(() => ({ erro: 'Resposta inválida' }))
      if (!r.ok) { setErro(j.erro ?? 'Erro ao confirmar'); return }
      setRecibo(j.resultado)
    } catch { setErro('Falha de rede ao confirmar.') } finally { setEnviando(false) }
  }

  if (recibo) return <Recibo recibo={recibo} companyId={companyId} />

  return (
    <div className="mx-auto max-w-md pb-28">
      <div className={`sticky top-0 z-10 flex items-center gap-2 px-4 py-2 text-xs font-medium ${data.modoTeste ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
        {data.modoTeste ? <><FlaskConical className="h-4 w-4 shrink-0" /> Modo teste — nada é gravado. Experimente à vontade.</>
          : <><Eye className="h-4 w-4 shrink-0" /> Visualização da nota real — o CONFIRMAR liga em breve. Nada é gravado ainda.</>}
      </div>

      <div className="space-y-4 p-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Store className="h-4 w-4 text-[#185FA5]" /> {data.fornecedor.nome}</div>
          <p className="mt-0.5 text-xs text-slate-500">{fmtCnpj(data.fornecedor.cnpj)}{data.fornecedor.uf ? ` · ${data.fornecedor.uf}` : ''} · {data.itens.length} itens{data.valorNota != null ? ` · ${brl(data.valorNota)}` : ''} · emitida {fmtDia(data.dataEmissao)}</p>
          {!fornCadastrado ? (
            <button onClick={() => setFornCadastrado(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#185FA5] py-2.5 text-sm font-semibold text-white active:bg-[#0F4A8C]">Cadastrar fornecedor (1 toque)</button>
          ) : <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Fornecedor cadastrado</p>}
        </div>

        {data.itens.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Essa nota veio só resumo (sem itens ainda). A Ciência libera o detalhe na próxima consulta à SEFAZ.
          </div>
        )}

        <div className="space-y-3">
          {data.itens.map((it) => {
            const e = estado[it.nfeItemId]
            const esperada = it.qCom * (e?.mapeado?.fatorConversao ?? 1)
            const diverge = e && Math.abs(e.qtdRecebida - esperada) > 0.0001
            return (
              <div key={it.nfeItemId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{it.xProd}</p>
                <p className="text-xs text-slate-500">Nota: {it.qCom} {it.uCom} · {brl(it.vUnCom)}/{it.uCom}</p>
                {e?.mapeado ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <Check className="h-4 w-4 shrink-0" /> <span className="font-medium">{e.mapeado.nome}</span>
                    {e.mapeado.fatorConversao !== 1 && <span className="text-xs text-emerald-600">(1 {it.uCom} = {e.mapeado.fatorConversao} {e.mapeado.unidadeControle})</span>}
                  </div>
                ) : (
                  <button onClick={() => setSheetItem(it)} className="mt-3 flex w-full items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800 active:bg-amber-100">
                    <span className="flex items-center gap-2"><Search className="h-4 w-4" /> Que produto é este?</span><ChevronRight className="h-4 w-4" />
                  </button>
                )}
                {e?.mapeado && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-slate-600">Quantidade recebida ({e.mapeado.unidadeControle})</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="number" inputMode="decimal" value={e.qtdRecebida} onChange={(ev) => setItem(it.nfeItemId, { qtdRecebida: Number(ev.target.value) })}
                        className={`w-32 rounded-lg border px-3 py-2 text-base tabular-nums ${diverge ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`} />
                      <span className="text-xs text-slate-400">esperado {esperada}</span>
                    </div>
                    {diverge && (
                      <div className="mt-3 space-y-2 rounded-lg bg-amber-50 p-3">
                        <p className="flex items-center gap-1 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Veio diferente da nota — por quê?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MOTIVOS.map((m) => <button key={m} onClick={() => setItem(it.nfeItemId, { motivo: m })} className={`rounded-full px-3 py-1 text-xs font-medium ${e.motivo === m ? 'bg-amber-600 text-white' : 'border border-amber-300 bg-white text-amber-700'}`}>{m}</button>)}
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-amber-800">
                          <Camera className="h-4 w-4" /> {e.fotoBase64 ? 'Trocar foto' : 'Adicionar foto (webcam/câmera)'}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setItem(it.nfeItemId, { fotoBase64: await comprimirFoto(f) }) }} />
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

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
          <span>{data.itens.filter((it) => estado[it.nfeItemId]?.mapeado).length}/{data.itens.length} itens mapeados</span>
          {divergencias > 0 && <span className="font-medium text-amber-600">{divergencias} divergência(s)</span>}
        </div>
        {erro && <p className="mb-2 rounded-md bg-rose-50 p-2 text-xs text-rose-700">{erro}</p>}
        {podeConfirmar ? (
          <button onClick={confirmar} disabled={!totalMapeado || enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#185FA5] py-3.5 text-sm font-semibold text-white active:bg-[#0F4A8C] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
            {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</> : totalMapeado ? <><PackageCheck className="h-4 w-4" /> Confirmar recebimento</> : 'Mapeie todos os itens pra confirmar'}
          </button>
        ) : (
          <button disabled className="w-full cursor-not-allowed rounded-xl bg-slate-200 py-3.5 text-sm font-semibold text-slate-400">
            {totalMapeado ? '✓ Pronto — modo teste (não grava)' : 'Mapeie todos os itens'}
          </button>
        )}
        <p className="mt-2 text-center text-[11px] text-slate-400">Gera os movimentos de estoque + contas a pagar sugerido + Confirmação na SEFAZ.</p>
      </div>

      {sheetItem && <MapearSheet item={sheetItem} existentes={itensExistentes} onClose={() => setSheetItem(null)}
        onEscolher={(m) => { setItem(sheetItem.nfeItemId, { mapeado: m, qtdRecebida: sheetItem.qCom * m.fatorConversao }); setSheetItem(null) }} />}
    </div>
  )
}

function MapearSheet({ item, existentes, onClose, onEscolher }: {
  item: ConfItem; existentes: ItemExistente[]; onClose: () => void
  onEscolher: (m: MapeadoSel) => void
}) {
  const [busca, setBusca] = useState('')
  const [modo, setModo] = useState<'buscar' | 'criar'>(existentes.length > 0 ? 'buscar' : 'criar')
  const [nome, setNome] = useState(item.sugestao.nome)
  const [unidade, setUnidade] = useState<Unidade>(item.sugestao.unidade ?? 'UN')
  const [categoria, setCategoria] = useState<Categoria>(item.sugestao.categoria)
  const [fator, setFator] = useState(1)
  const filtrados = existentes.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()))
  const difUnidade = item.uCom.toUpperCase() !== unidade

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:mx-auto sm:mb-8 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Que produto é este?</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Da nota: <b>{item.xProd}</b> · {item.qCom} {item.uCom}</p>
        <div className="mb-3 flex gap-2">
          <button onClick={() => setModo('buscar')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${modo === 'buscar' ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>Buscar existente</button>
          <button onClick={() => setModo('criar')} className={`flex-1 rounded-lg py-2 text-sm font-medium ${modo === 'criar' ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>Criar novo</button>
        </div>
        {modo === 'buscar' ? (
          <div className="space-y-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar no estoque…" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            {filtrados.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Nenhum item ainda. Use "Criar novo".</p>}
            {filtrados.map((e) => <button key={e.id} onClick={() => onEscolher({ itemId: e.id, nome: e.nome, unidadeControle: e.unidadeControle as Unidade, categoria: e.categoria as Categoria, fatorConversao: 1, novo: false })} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm active:bg-slate-50"><span className="font-medium text-slate-800">{e.nome}</span><span className="text-xs text-slate-400">{e.unidadeControle}</span></button>)}
          </div>
        ) : (
          <div className="space-y-3">
            <div><label className="text-xs font-medium text-slate-600">Nome do produto <span className="text-slate-400">(sugerido)</span></label><input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></div>
            <div><label className="text-xs font-medium text-slate-600">Unidade de controle <span className="text-slate-400">~sugerido {item.sugestao.unidade ?? 'a definir'}</span></label>
              <div className="mt-1 flex gap-2">{(['KG', 'UN', 'LT'] as Unidade[]).map((u) => <button key={u} onClick={() => setUnidade(u)} className={`flex-1 rounded-lg py-2 text-sm font-medium ${unidade === u ? 'bg-[#185FA5] text-white' : 'bg-slate-100 text-slate-600'}`}>{u}</button>)}</div>
            </div>
            <div><label className="text-xs font-medium text-slate-600">Categoria <span className="text-slate-400">~sugerido</span></label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{(Object.keys(CAT_LABEL) as Categoria[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}</select></div>
            {difUnidade && (
              <div className="rounded-lg bg-sky-50 p-3">
                <label className="text-xs font-medium text-sky-800">A nota veio em <b>{item.uCom}</b>, você controla em <b>{unidade}</b>. Quantas {unidade} tem 1 {item.uCom}?</label>
                <input type="number" inputMode="decimal" value={fator} onChange={(e) => setFator(Number(e.target.value))} className="mt-1 w-28 rounded-lg border border-sky-300 px-3 py-2 text-base tabular-nums" />
                <p className="mt-1 text-[11px] text-sky-600">1 {item.uCom} = {fator} {unidade} · {item.qCom} {item.uCom} = {item.qCom * fator} {unidade}</p>
              </div>
            )}
            <button onClick={() => onEscolher({ itemId: `novo-${item.nfeItemId}`, nome, unidadeControle: unidade, categoria, fatorConversao: difUnidade ? fator : 1, novo: true })} className="w-full rounded-xl bg-[#185FA5] py-3 text-sm font-semibold text-white active:bg-[#0F4A8C]">Usar este produto</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Recibo({ recibo, companyId }: { recibo: any; companyId?: string }) {
  const brlL = (n: number) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <PackageCheck className="mx-auto h-12 w-12 text-emerald-600" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">Recebimento confirmado</h2>
        <p className="mt-1 text-sm text-slate-600">{recibo.movimentos} {recibo.movimentos === 1 ? 'item entrou' : 'itens entraram'} no estoque · {brlL(recibo.valorEntrada)}</p>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"><span className="text-slate-500">Movimentos gerados</span><span className="font-medium tabular-nums">{recibo.movimentos}</span></div>
        {recibo.itensCadastrados > 0 && <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"><span className="text-slate-500">Produtos cadastrados agora</span><span className="font-medium tabular-nums">{recibo.itensCadastrados}</span></div>}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"><span className="text-slate-500">Contas a pagar sugeridas</span><span className="font-medium tabular-nums">{recibo.payableSugeridas} parcela(s)</span></div>
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <span className="text-slate-500">Confirmação na SEFAZ</span>
          {recibo.sefaz?.ok ? <span className="font-medium text-emerald-600">✓ cStat {recibo.sefaz.cStat}</span>
            : <span className="font-medium text-amber-600">{recibo.sefaz?.cStat ?? '—'} (o cron reenvia)</span>}
        </div>
        {recibo.divergente && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Conferência com divergência registrada — o estoque entrou pela quantidade RECEBIDA.</p>}
      </div>
      {companyId && (
        <div className="mt-6 flex gap-2">
          <a href={`/empresas/${companyId}/estoque/posicao`} className="flex-1 rounded-xl bg-[#185FA5] py-3 text-center text-sm font-semibold text-white">Ver posição de estoque</a>
          <a href={`/empresas/${companyId}/estoque/recebimentos`} className="flex-1 rounded-xl border border-slate-300 py-3 text-center text-sm font-medium text-slate-700">Voltar pra fila</a>
        </div>
      )}
    </div>
  )
}
