'use client'

// ESTOQUE PARTE C — modal "Registrar saída" (perda/uso interno). item → quantidade → MOTIVO
// obrigatório → foto opcional → movimento PERDA|USO_INTERNO com custo real. Sem motivo, não
// grava (o botão fica travado). Busca de item embutida. Mesmo padrão dos outros modais.

import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Search, Camera, AlertTriangle } from 'lucide-react'

interface ItemBusca { id: string; nome: string; unidadeControle: string; custoMedio: number | null }
const MOTIVOS: { v: string; label: string }[] = [
  { v: 'VENCEU', label: 'Venceu' }, { v: 'ESTRAGOU', label: 'Estragou' }, { v: 'CAIU_QUEBROU', label: 'Caiu / quebrou' },
  { v: 'ERRO_PREPARO', label: 'Erro de preparo' }, { v: 'CONSUMO_FUNCIONARIO', label: 'Consumo funcionário' },
  { v: 'USO_INTERNO', label: 'Uso interno' }, { v: 'CORTESIA', label: 'Cortesia' }, { v: 'OUTRO', label: 'Outro' },
]
const brl = (n: number | null) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
const parseNum = (s: string) => { const n = Number((s ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }

export function SaidaModal({ companyId, itemInicial, onClose, onSalvo }: { companyId: string; itemInicial?: ItemBusca; onClose: () => void; onSalvo: () => void }) {
  const [item, setItem] = useState<ItemBusca | null>(itemInicial ?? null)
  const [busca, setBusca] = useState('')
  const [res, setRes] = useState<ItemBusca[]>([])
  const [qtd, setQtd] = useState('')
  const [motivo, setMotivo] = useState<string>('')
  const [motivoTexto, setMotivoTexto] = useState('')
  const [foto, setFoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (item) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { fetch(`/api/empresas/${companyId}/estoque/itens?busca=${encodeURIComponent(busca)}`).then((r) => r.json()).then((j) => setRes(j.itens ?? [])).catch(() => setRes([])) }, 200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [busca, companyId, item])

  const q = parseNum(qtd)
  const custoSaida = item?.custoMedio != null ? item.custoMedio * q : null

  const salvar = async () => {
    setErro(null)
    if (!item) return setErro('Escolha o item.')
    if (!(q > 0)) return setErro('Informe a quantidade.')
    if (!motivo) return setErro('Escolha o motivo.')
    setBusy(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/saida`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: item.id, quantidade: q, motivo, motivoTexto: motivo === 'OUTRO' ? motivoTexto : null, fotoBase64: foto }) })
      const j = await r.json().catch(() => null)
      if (!r.ok) { setErro(j?.erro ?? 'Não consegui registrar.'); return }
      onSalvo()
    } catch { setErro('Falha de conexão.') } finally { setBusy(false) }
  }

  const comprimir = (f: File) => new Promise<string>((resolve) => { const img = new Image(); const rd = new FileReader(); rd.onload = () => { img.onload = () => { const c = document.createElement('canvas'); const mx = 800; const sc = Math.min(1, mx / Math.max(img.width, img.height)); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.6)) }; img.src = String(rd.result) }; rd.readAsDataURL(f) })

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-semibold text-slate-900">Registrar saída</h3><button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>

        {/* item */}
        {item ? (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="font-medium text-slate-800">{item.nome}</span><button onClick={() => setItem(null)} className="text-xs text-[#185FA5]">trocar</button></div>
        ) : (
          <div className="mb-3">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item…" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" autoFocus /></div>
            {res.length > 0 && <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200">{res.map((it) => <button key={it.id} onClick={() => setItem(it)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="text-slate-700">{it.nome}</span><span className="text-xs text-slate-400">{it.unidadeControle}</span></button>)}</div>}
          </div>
        )}

        {/* quantidade */}
        <label className="text-xs font-medium text-slate-600">Quantidade{item ? ` (${item.unidadeControle})` : ''}
          <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" className="mt-1 block w-32 rounded-lg border border-slate-300 py-2 px-3 text-sm tabular-nums" />
        </label>
        {custoSaida != null && q > 0 && <p className="mt-1 text-[11px] text-slate-400">custo da saída: {brl(custoSaida)}</p>}

        {/* motivo obrigatório */}
        <p className="mt-3 text-xs font-medium text-slate-600">Motivo <span className="text-rose-500">*</span></p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {MOTIVOS.map((m) => <button key={m.v} onClick={() => setMotivo(m.v)} className={`rounded-full px-3 py-1 text-xs font-medium ${motivo === m.v ? 'bg-[#185FA5] text-white' : 'border border-slate-300 bg-white text-slate-600'}`}>{m.label}</button>)}
        </div>
        {motivo === 'OUTRO' && <input value={motivoTexto} onChange={(e) => setMotivoTexto(e.target.value)} placeholder="qual o motivo?" className="mt-2 w-full rounded-lg border border-slate-300 py-2 px-3 text-sm" />}

        {/* foto opcional */}
        <label className="mt-3 flex w-fit items-center gap-2 text-xs font-medium text-slate-600">
          <Camera className="h-4 w-4" /> {foto ? 'trocar foto' : 'adicionar foto (opcional)'}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFoto(await comprimir(f)) }} />
        </label>
        {foto && <img src={foto} alt="foto" className="mt-2 h-24 rounded-lg object-cover" />}

        {erro && <p className="mt-3 flex items-center gap-1 text-sm text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</p>}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={salvar} disabled={busy || !item || !(q > 0) || !motivo} className="inline-flex items-center gap-2 rounded-lg bg-[#185FA5] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0F4A8C] disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Registrar saída</button>
          <button onClick={onClose} className="text-sm text-slate-500">cancelar</button>
        </div>
      </div>
    </div>
  )
}
