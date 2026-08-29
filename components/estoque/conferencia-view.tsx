'use client'

// ESTOQUE FASE 1 item 2 — a tela de CONFERÊNCIA, UMA só (REGRA 4). Serve o preview
// (modo teste, dado ilustrativo) E a nota real (read-only enquanto o CONFIRMAR não
// liga). Mobile-first + desktop. Foto por webcam (desktop) OU câmera (celular).

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useEscape } from '@/lib/hooks/use-dismissivel'
import { Check, Search, Camera, AlertTriangle, FlaskConical, Store, X, ChevronRight, Eye, Loader2, PackageCheck, Keyboard, Receipt } from 'lucide-react'
import { sugerirFator, placeholderFator } from '@/lib/stock/unidade-fator'
import { ItensManuaisEditor } from './itens-manuais-editor'
import { EditorParcelas, type ParcelaEditavel } from './editor-parcelas'

export type Unidade = 'KG' | 'UN' | 'LT'
export type Categoria = 'MATERIA_PRIMA' | 'REVENDA' | 'EMBALAGEM' | 'LIMPEZA' | 'USO_INTERNO'
const CAT_LABEL: Record<Categoria, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno' }
const MOTIVOS = ['FALTOU', 'SOBROU', 'AVARIA', 'RECUSADO'] as const
type Motivo = (typeof MOTIVOS)[number]

export interface ConfItem {
  nfeItemId: string; xProd: string; cProd: string; ncm: string; uCom: string; qCom: number; vUnCom: number; vProd: number
  mapeado: { itemId: string; nome: string; unidadeControle: Unidade; fatorConversao: number } | null
  sugestao: { nome: string; unidade: Unidade | null; categoria: Categoria }
  uTrib?: string; fatorNota?: number | null // dupla unidade da NF-e (o fator vem da nota)
}
export interface Duplicata { nDup: string | null; valor: number; dVenc: string | null; jaEnviada: boolean }
export interface ConferenciaData {
  modoTeste: boolean
  fornecedor: { nome: string; cnpj: string; uf: string; jaCadastrado: boolean }
  dataEmissao: string | null
  valorNota: number | null
  itens: ConfItem[]
  /** PONTE 1 — boletos da nota (podem não existir: nota sem duplicata é compra à vista) */
  duplicatas?: Duplicata[]
  /** ⭐ o combinado difere da nota? (renegociação pós-nota, 29/08) */
  renegociada?: boolean
  motivoRenegociacao?: string | null
  /** o que a NOTA diz — referência ao lado do combinado, nunca editável */
  duplicatasXml?: Array<{ nDup: string | null; valor: number; dVenc: string | null }>
  /** o fornecedor já existe no FINANCEIRO? (o do estoque é `fornecedor.jaCadastrado`) */
  fornecedorNoFinanceiro?: boolean
  /** o usuário pode criar conta a pagar? (stock.manage) */
  podeEnviarBoletos?: boolean
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
  // nota só-resumo: o dono opta por digitar os itens do DANFE de papel
  const [digitando, setDigitando] = useState(false)
  // PONTE 1 — boletos: marcados por default (o dono VÊ e confirma; nada entra às cegas)
  const dupsPendentes = (data.duplicatas ?? []).filter((d) => !d.jaEnviada)
  const [boletos, setBoletos] = useState<string[]>(() => dupsPendentes.map((d) => d.nDup ?? ''))
  // ⭐ ajustar parcelas (renegociação pós-nota) — REGRA 9: hook no topo, longe do JSX
  const [editandoParcelas, setEditandoParcelas] = useState(false)
  const [salvandoParcelas, setSalvandoParcelas] = useState(false)
  const [cadastrarForn, setCadastrarForn] = useState(true)

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
        body: JSON.stringify({
          fornecedor: { cnpj: data.fornecedor.cnpj, nome: data.fornecedor.nome, uf: data.fornecedor.uf },
          itens,
          enviarBoletos: boletos.length > 0,
          boletosSelecionados: boletos,
          cadastrarFornecedor: cadastrarForn,
        }),
      })
      const j = await r.json().catch(() => ({ erro: 'Resposta inválida' }))
      if (!r.ok) { setErro(j.erro ?? 'Erro ao confirmar'); return }
      setRecibo(j.resultado)
    } catch { setErro('Falha de rede ao confirmar.') } finally { setEnviando(false) }
  }

  if (recibo) return <Recibo recibo={recibo} companyId={companyId} />

  const nMapeados = data.itens.filter((it) => estado[it.nfeItemId]?.mapeado).length

  return (
    // Passe de densidade (23/08/2026): era `mx-auto max-w-md` — a tela inteira
    // (mobile-first) espremida em 448px centralizados, com o rodapé fixo TAMBÉM
    // em max-w-md. No desktop virava cabeçalho à esquerda, rodapé deslocado e
    // cards soltos cada um com sua largura. Agora: largura total + TABELA de
    // recebimento no desktop (padrão MarketMan/Apicbase), cards no mobile.
    <div className="space-y-3 pb-24">
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${data.modoTeste ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
        {data.modoTeste ? <><FlaskConical className="h-4 w-4 shrink-0" /> Modo teste — nada é gravado. Experimente à vontade.</>
          : <><Eye className="h-4 w-4 shrink-0" /> Visualização da nota real — o CONFIRMAR liga em breve. Nada é gravado ainda.</>}
      </div>

      {/* CABEÇALHO DA NOTA — uma linha só (era card de 3 blocos empilhados) */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <Store className="h-4 w-4 shrink-0 text-[#185FA5]" />
        <span className="text-sm font-semibold text-slate-900">{data.fornecedor.nome}</span>
        <span className="text-xs tabular-nums text-slate-400">
          {fmtCnpj(data.fornecedor.cnpj)}{data.fornecedor.uf ? ` · ${data.fornecedor.uf}` : ''} · {data.itens.length} {data.itens.length === 1 ? 'item' : 'itens'}{data.valorNota != null ? ` · ${brl(data.valorNota)}` : ''} · emitida {fmtDia(data.dataEmissao)}
        </span>
        {!fornCadastrado ? (
          <button onClick={() => setFornCadastrado(true)} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">Cadastrar fornecedor</button>
        ) : <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> Fornecedor cadastrado</span>}
      </div>

      {/* NOTA SÓ-RESUMO. ⚠️ O texto anterior afirmava "a Ciência já foi enviada; o XML chega
       * na próxima consulta" — MENTIRA que custou 2 dias de nota presa (23/08): nada
       * disparava a Ciência, então o XML não vinha nunca. Agora o cron horário manda a
       * Ciência sozinho, e o dono NÃO fica refém disso: digita do papel e segue. */}
      {data.itens.length === 0 ? (
        digitando && companyId && nfeId ? (
          <ItensManuaisEditor companyId={companyId} nfeId={nfeId} valorNota={data.valorNota}
            onCancelar={() => setDigitando(false)} onSalvo={() => location.reload()} />
        ) : (
          <div className="flex flex-wrap items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
            <Eye className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div className="min-w-[16rem] flex-1">
              <p className="text-sm font-medium text-sky-900">Essa nota veio só como resumo — a SEFAZ ainda não liberou os itens.</p>
              <p className="mt-0.5 text-xs text-sky-700">
                A Ciência da operação é o que destrava o XML completo, e ela vai automaticamente na consulta de hora em hora — normalmente o detalhe aparece aqui em pouco tempo.
                <b> Se o caminhão já chegou, não espere:</b> digite os itens do DANFE de papel e confira agora. Quando o XML vier, ele só é guardado pra auditoria — não refaz nem duplica o que você conferiu.
              </p>
            </div>
            {companyId && nfeId && (
              <button onClick={() => setDigitando(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#185FA5] px-3 text-xs font-semibold text-white hover:bg-[#0F4A8C]">
                <Keyboard className="h-4 w-4" /> Digitar itens da nota (do papel)
              </button>
            )}
          </div>
        )
      ) : (
      <>
      {/* ===== DESKTOP: tabela de recebimento ===== */}
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white sm:block">
        <table className="density-normal w-full">
          <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">Item da nota</th>
            <th className="px-3 py-2 text-right font-medium">Qtd nota</th>
            <th className="px-3 py-2 font-medium">Destino no estoque</th>
            <th className="px-3 py-2 text-right font-medium">Qtd recebida</th>
            <th className="px-3 py-2 text-right font-medium">Divergência</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {data.itens.map((it) => {
              const e = estado[it.nfeItemId]
              const esperada = it.qCom * (e?.mapeado?.fatorConversao ?? 1)
              const diverge = !!e && Math.abs(e.qtdRecebida - esperada) > 0.0001
              const delta = e ? e.qtdRecebida - esperada : 0
              const precisaFator = !!e?.mapeado && it.uCom.toUpperCase() !== e.mapeado.unidadeControle.toUpperCase()
              const setF = (nf: number) => { if (nf > 0 && e?.mapeado) setItem(it.nfeItemId, { mapeado: { ...e.mapeado, fatorConversao: nf }, qtdRecebida: it.qCom * nf }) }
              return (
                <Fragment key={it.nfeItemId}>
                  <tr className={`border-b border-slate-50 ${diverge ? 'bg-amber-50/40' : ''} ${!e?.mapeado ? 'bg-amber-50/60' : ''}`}>
                    <td className="px-3 py-1 text-[13px]">
                      <p className="font-medium text-slate-800">{it.xProd}</p>
                      <p className="text-[11px] text-slate-400">cód. {it.cProd} · {brl(it.vUnCom)}/{it.uCom}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1 text-right text-[13px] tabular-nums text-slate-600">{it.qCom} {it.uCom}</td>
                    <td className="px-3 py-1 text-[13px]">
                      {e?.mapeado ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button onClick={() => setSheetItem(it)} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100">
                            <Check className="h-3 w-3" /> {e.mapeado.nome}
                          </button>
                          {/* fator inline — só quando a unidade da nota difere da de controle */}
                          {precisaFator && (() => {
                            // a sugestão é da unidade DESTE item (cheddar em KG = 18,16; em UN = 8)
                            const sug = sugerirFator({ xProd: it.xProd, unidadeControle: e.mapeado!.unidadeControle, uCom: it.uCom, fatorNota: it.fatorNota, vUnCom: it.vUnCom })
                            const difere = sug.fator != null && Math.abs(sug.fator - e.mapeado!.fatorConversao) > 0.0001
                            return (
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${e.mapeado!.fatorConversao <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                                1 {it.uCom} =
                                <input type="number" inputMode="decimal" value={e.mapeado!.fatorConversao || ''} placeholder={placeholderFator(e.mapeado!.unidadeControle, it.uCom)}
                                  onChange={(ev) => setF(Number(ev.target.value))} className="w-16 rounded border border-slate-300 px-1 py-0 text-right tabular-nums" />
                                {e.mapeado!.unidadeControle}
                                {difere && (
                                  <button onClick={() => setF(sug.fator!)} title={sug.explicacao ?? ''}
                                    className="rounded-full border border-sky-300 bg-sky-50 px-1.5 text-[10px] font-medium text-sky-700">
                                    {sug.origem === 'nota' ? 'nota diz' : 'sugestão'} {sug.fator}
                                  </button>
                                )}
                                {sug.explicacao && <span className="text-slate-400">{sug.explicacao}</span>}
                                {e.mapeado!.fatorConversao <= 1 && <AlertTriangle className="h-3 w-3" />}
                              </span>
                            )
                          })()}
                        </div>
                      ) : (
                        <button onClick={() => setSheetItem(it)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-medium text-amber-800 hover:bg-amber-100">
                          <Search className="h-3.5 w-3.5" /> Que produto é este?
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-1 text-right">
                      {e?.mapeado ? (
                        <span className="inline-flex items-center gap-1.5">
                          <input type="number" inputMode="decimal" value={e.qtdRecebida} onChange={(ev) => setItem(it.nfeItemId, { qtdRecebida: Number(ev.target.value) })}
                            className={`h-8 w-24 rounded-lg border px-2 text-right text-[13px] tabular-nums ${diverge ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`} />
                          <span className="text-[11px] text-slate-400">{e.mapeado.unidadeControle}</span>
                        </span>
                      ) : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-1 text-right text-[13px] tabular-nums ${diverge ? 'font-semibold text-amber-700' : 'text-slate-300'}`}>
                      {diverge ? `${delta > 0 ? '+' : ''}${Number(delta.toFixed(3))}` : '—'}
                    </td>
                    <td className="px-3 py-1">
                      {!e?.mapeado ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">mapear</span>
                        : diverge ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">divergência</span>
                        : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">confere</span>}
                    </td>
                  </tr>
                  {/* a divergência EXPANDE a linha — só quando existe */}
                  {diverge && (
                    <tr className="border-b border-slate-50 bg-amber-50/60">
                      <td colSpan={6} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> Veio diferente da nota — por quê?</span>
                          {MOTIVOS.map((m) => <button key={m} onClick={() => setItem(it.nfeItemId, { motivo: m })} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${e!.motivo === m ? 'bg-amber-600 text-white' : 'border border-amber-300 bg-white text-amber-700'}`}>{m}</button>)}
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                            <Camera className="h-3 w-3" /> {e!.fotoBase64 ? 'trocar foto' : 'foto'}
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (ev) => { const f = ev.target.files?.[0]; if (f) setItem(it.nfeItemId, { fotoBase64: await comprimirFoto(f) }) }} />
                          </label>
                          {e!.fotoBase64 && <img src={e!.fotoBase64} alt="foto da divergência" className="h-10 rounded object-cover" />}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ===== MOBILE: cards empilhados (INTOCADO — o dono confere no celular) ===== */}
      <div className="space-y-3 sm:hidden">
          {data.itens.map((it) => {
            const e = estado[it.nfeItemId]
            const esperada = it.qCom * (e?.mapeado?.fatorConversao ?? 1)
            const diverge = e && Math.abs(e.qtdRecebida - esperada) > 0.0001
            return (
              <div key={it.nfeItemId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{it.xProd}</p>
                <p className="text-xs text-slate-500">Nota: {it.qCom} {it.uCom} · {brl(it.vUnCom)}/{it.uCom}</p>
                {e?.mapeado ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4 shrink-0" /> <span className="font-medium">{e.mapeado.nome}</span>
                    </div>
                    {/* fator SEMPRE visível e editável quando a unidade da nota difere da de controle */}
                    {it.uCom.toUpperCase() !== e.mapeado.unidadeControle.toUpperCase() && (() => {
                      const f = e.mapeado.fatorConversao
                      const setF = (nf: number) => { if (nf > 0) setItem(it.nfeItemId, { mapeado: { ...e.mapeado!, fatorConversao: nf }, qtdRecebida: it.qCom * nf }) }
                      return (
                        <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs ${f <= 1 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'}`}>
                          <span>1 {it.uCom} =</span>
                          <input type="number" inputMode="decimal" value={f} onChange={(ev) => setF(Number(ev.target.value))} className="w-16 rounded border border-slate-300 px-2 py-1 text-right tabular-nums" />
                          <span>{e.mapeado.unidadeControle}</span>
                          <span className="text-slate-400">→ {it.qCom} {it.uCom} = {it.qCom * f} {e.mapeado.unidadeControle} · {brl(it.vUnCom / (f || 1))}/{e.mapeado.unidadeControle}</span>
                          {it.fatorNota && it.fatorNota !== f && <button onClick={() => setF(it.fatorNota!)} className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">a nota diz {it.fatorNota}</button>}
                          {f <= 1 && <span className="flex items-center gap-1 font-medium"><AlertTriangle className="h-3 w-3" /> a nota veio em {it.uCom} — confira o fator</span>}
                        </div>
                      )
                    })()}
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
      </>
      )}

      {/* ===== PONTE 1 — BOLETOS DA NOTA ===== */}
      {data.itens.length > 0 && dupsPendentes.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Receipt className="h-4 w-4 shrink-0 text-[#185FA5]" />
            <h3 className="text-sm font-semibold text-slate-900">Boletos da nota ({dupsPendentes.length} {dupsPendentes.length === 1 ? 'parcela' : 'parcelas'})</h3>
            {/* ⭐ SELO — o combinado ≠ a nota. Sem ele, o dono ajusta as parcelas, volta e
                não tem como saber se pegou (foi exatamente o que aconteceu). */}
            {data.renegociada && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200" title={data.motivoRenegociacao ?? 'combinado ajustado com o fornecedor'}>
                renegociado
              </span>
            )}
            <p className="hidden flex-1 text-xs text-slate-400 lg:block">
              {data.podeEnviarBoletos === false
                ? 'Ficam esperando aprovação de quem cuida do financeiro'
                : 'Enviar pro Contas a Pagar? Você confirma; nada entra às cegas'}
            </p>
            {/* ⭐ O COMBINADO ≠ A NOTA (29/08) — o fornecedor cancelou os boletos da nota e
                mandou outros. A lista do XML é a SUGESTÃO; quem manda é o combinado. */}
            {data.podeEnviarBoletos !== false && (
              <button
                type="button"
                onClick={() => setEditandoParcelas(true)}
                className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                ajustar parcelas
              </button>
            )}
          </div>

          {data.podeEnviarBoletos === false ? (
            <p className="px-3 py-2 text-xs text-slate-500">
              Você confere a nota e o estoque entra normal — mas criar conta a pagar é do dono.
              Estas {dupsPendentes.length} parcelas ficam esperando em <b>Estoque → Contas a pagar</b>.
            </p>
          ) : (
            <>
              <table className="density-normal hidden w-full sm:table">
                <tbody>
                  {dupsPendentes.map((d) => {
                    const k = d.nDup ?? ''
                    const marcado = boletos.includes(k)
                    return (
                      <tr key={k} className="border-b border-slate-50 last:border-b-0">
                        <td className="w-10 px-3 py-1">
                          <input type="checkbox" checked={marcado} onChange={() => setBoletos((b) => marcado ? b.filter((x) => x !== k) : [...b, k])} className="h-4 w-4" />
                        </td>
                        <td className="px-3 py-1 text-[13px] text-slate-600">parcela {d.nDup ?? '—'}</td>
                        <td className="px-3 py-1 text-right text-[13px] font-medium tabular-nums text-slate-900">{brl(d.valor)}</td>
                        <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-500">vence {fmtDia(d.dVenc)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="divide-y divide-slate-50 sm:hidden">
                {dupsPendentes.map((d) => {
                  const k = d.nDup ?? ''
                  const marcado = boletos.includes(k)
                  return (
                    <label key={k} className="flex items-center gap-3 p-3">
                      <input type="checkbox" checked={marcado} onChange={() => setBoletos((b) => marcado ? b.filter((x) => x !== k) : [...b, k])} className="h-5 w-5" />
                      <span className="flex-1 text-sm text-slate-700">parcela {d.nDup ?? '—'} · vence {fmtDia(d.dVenc)}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-900">{brl(d.valor)}</span>
                    </label>
                  )
                })}
              </div>

              {/* fornecedor: o dado vem do XML, assinado pela SEFAZ — cadastro mais limpo que digitação */}
              {data.fornecedorNoFinanceiro === false && boletos.length > 0 && (
                <label className="flex items-start gap-2 border-t border-slate-100 bg-amber-50/60 px-3 py-2">
                  <input type="checkbox" checked={cadastrarForn} onChange={(e) => setCadastrarForn(e.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span className="text-xs text-amber-900">
                    <b>{data.fornecedor.nome}</b> ainda não existe no financeiro — cadastrar como fornecedor também?
                    <span className="block text-[11px] text-amber-700">CNPJ e razão social vêm do XML da nota (dado da SEFAZ). Sem isso a conta a pagar não pode ser criada.</span>
                  </span>
                </label>
              )}
              {/* ⚠️ a NOTA continua visível como referência — os dois na tela, nenhum
                  sobrescrevendo o outro (a nota é da SEFAZ e não muda). */}
              {data.renegociada && (data.duplicatasXml?.length ?? 0) > 0 && (
                <p className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-500">
                  A <b>nota</b> diz {data.duplicatasXml!.length} {data.duplicatasXml!.length === 1 ? 'parcela' : 'parcelas'}:{' '}
                  {data.duplicatasXml!.map((d) => `${brl(d.valor)} (${fmtDia(d.dVenc)})`).join(' · ')}
                  {data.motivoRenegociacao ? ` — motivo do ajuste: ${data.motivoRenegociacao}` : ''}
                </p>
              )}
              <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
                {boletos.length === 0
                  ? 'Nenhum boleto marcado — nada vai pro Contas a Pagar.'
                  : `${boletos.length} de ${dupsPendentes.length} marcados · ${brl(dupsPendentes.filter((d) => boletos.includes(d.nDup ?? '')).reduce((s2, d) => s2 + d.valor, 0))} irão pro Contas a Pagar ao confirmar.`}
              </p>
            </>
          )}

          {/* ⭐ EDITOR DO COMBINADO — mesmo componente da tela de boletos (REGRA 4) */}
          {companyId && nfeId && (
            <EditorParcelas
              aberto={editandoParcelas}
              onFechar={() => setEditandoParcelas(false)}
              xml={(data.duplicatas ?? []).map((d) => ({ numero: d.nDup ?? '—', valor: d.valor, dVenc: d.dVenc ?? null }))}
              totalNota={data.valorNota ?? 0}
              inicial={dupsPendentes.map((d) => ({
                valor: String(d.valor).replace('.', ','),
                dVenc: (d.dVenc ?? '').slice(0, 10),
              }))}
              salvando={salvandoParcelas}
              onSalvar={async (parcelas: ParcelaEditavel[], motivo: string | null) => {
                setSalvandoParcelas(true)
                try {
                  const res = await fetch(`/api/empresas/${companyId}/estoque/notas/${nfeId}/parcelas`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      parcelas: parcelas.map((p: ParcelaEditavel) => ({
                        valor: Number(p.valor.replace(/\./g, '').replace(',', '.')),
                        dVenc: p.dVenc,
                      })),
                      motivo,
                    }),
                  })
                  const j = await res.json().catch(() => null)
                  if (!res.ok) {
                    alert(j?.erro ?? 'Não foi possível salvar as parcelas.')
                    return
                  }
                  setEditandoParcelas(false)
                  window.location.reload() // recarrega com o combinado novo
                } finally {
                  setSalvandoParcelas(false)
                }
              }}
            />
          )}
        </div>
      )}

      {/* BARRA FIXA de largura total (era bloco `mx-auto max-w-md` = solto no meio
       * da tela no desktop). `md:left-60` = largura da sidebar (w-60). */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:left-60">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs tabular-nums text-slate-500"><b className="text-slate-800">{nMapeados}/{data.itens.length}</b> mapeados</span>
          {divergencias > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> {divergencias} divergência{divergencias > 1 ? 's' : ''}</span>}
          <span className="hidden text-[11px] text-slate-400 lg:block">Gera os movimentos de estoque + contas a pagar sugerido + Confirmação na SEFAZ.</span>
          {erro && <span className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{erro}</span>}
          <div className="ml-auto">
            {podeConfirmar ? (
              <button onClick={confirmar} disabled={!totalMapeado || enviando}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto">
                {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirmando…</> : totalMapeado ? <><PackageCheck className="h-4 w-4" /> Confirmar recebimento</> : 'Mapeie todos os itens pra confirmar'}
              </button>
            ) : (
              <button disabled className="h-10 w-full cursor-not-allowed rounded-xl bg-slate-200 px-5 text-sm font-semibold text-slate-400 sm:w-auto">
                {totalMapeado ? '✓ Pronto — modo teste (não grava)' : 'Mapeie todos os itens'}
              </button>
            )}
          </div>
        </div>
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
  // ORDEM: qTrib/uTrib da nota → COMPOSTO ("2,27 KG CX/08 PC") → pack simples ("12UN") →
  // perguntar. A sugestão DEPENDE da unidade de controle: a mesma caixa de cheddar vale
  // 18,16 se o controle é KG e 8 se é UN — por isso ela é recalculada quando a unidade
  // muda, e nunca é decidida em silêncio.
  const sugestaoPara = (un: string) => sugerirFator({ xProd: item.xProd, unidadeControle: un, uCom: item.uCom, fatorNota: item.fatorNota, vUnCom: item.vUnCom })
  const sugestao = useMemo(() => sugestaoPara(unidade), [unidade]) // eslint-disable-line react-hooks/exhaustive-deps
  const [fator, setFator] = useState(sugestao.fator ?? 1)
  // trocar a unidade re-decide a conversão (é outra pergunta, outra resposta)
  useEffect(() => { setFator(sugestaoPara(unidade).fator ?? 1) }, [unidade]) // eslint-disable-line react-hooks/exhaustive-deps
  // item existente selecionado que precisa de conversão (unidade da nota ≠ unidade do item)
  const [selExistente, setSelExistente] = useState<ItemExistente | null>(null)
  const [sugExist, setSugExist] = useState<ReturnType<typeof sugerirFator> | null>(null)
  const [fatorExist, setFatorExist] = useState(1)
  const filtrados = existentes.filter((e) => e.nome.toLowerCase().includes(busca.toLowerCase()))
  const difUnidade = item.uCom.toUpperCase() !== unidade
  // fecha no ESC (o backdrop e o X já fechavam). Mesma família do dropdown de ingredientes.
  useEscape(true, onClose)

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
            {!selExistente && filtrados.map((e) => {
              const dif = item.uCom.toUpperCase() !== e.unidadeControle.toUpperCase()
              return (
                <button key={e.id} onClick={() => (dif ? (setSelExistente(e), (() => { const sg = sugestaoPara(e.unidadeControle); setSugExist(sg); setFatorExist(sg.fator ?? 1) })()) : onEscolher({ itemId: e.id, nome: e.nome, unidadeControle: e.unidadeControle as Unidade, categoria: e.categoria as Categoria, fatorConversao: 1, novo: false }))} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm active:bg-slate-50">
                  <span className="font-medium text-slate-800">{e.nome}</span>
                  <span className="text-xs text-slate-400">{e.unidadeControle}{dif && <span className="ml-1 text-amber-600">· converter de {item.uCom}</span>}</span>
                </button>
              )
            })}
            {/* item existente com unidade diferente da nota → pergunta o fator UMA vez */}
            {selExistente && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">{selExistente.nome} <span className="text-xs text-slate-400">({selExistente.unidadeControle})</span></p>
                <label className="text-xs font-medium text-sky-800">A nota veio em <b>{item.uCom}</b>, você controla em <b>{selExistente.unidadeControle}</b>. Quantas {selExistente.unidadeControle} tem 1 {item.uCom}?</label>
                <input type="number" inputMode="decimal" value={fatorExist || ''} placeholder={placeholderFator(selExistente.unidadeControle, item.uCom)} onChange={(ev) => setFatorExist(Number(ev.target.value))} className="mt-1 block w-full rounded-lg border border-sky-300 px-3 py-2 text-base tabular-nums" />
                {sugExist?.explicacao && <p className="mt-1 rounded bg-white/70 px-2 py-1 text-[11px] font-medium text-sky-800">sugestão: {sugExist.explicacao}</p>}
                <p className="mt-1 text-[11px] text-sky-600">1 {item.uCom} = {fatorExist} {selExistente.unidadeControle} · {item.qCom} {item.uCom} = {item.qCom * fatorExist} {selExistente.unidadeControle} · {brl(item.vUnCom / (fatorExist || 1))}/{selExistente.unidadeControle}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setSelExistente(null)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">voltar</button>
                  <button disabled={!(fatorExist > 0)} onClick={() => onEscolher({ itemId: selExistente.id, nome: selExistente.nome, unidadeControle: selExistente.unidadeControle as Unidade, categoria: selExistente.categoria as Categoria, fatorConversao: fatorExist, novo: false })} className="flex-1 rounded-lg bg-[#185FA5] py-2 text-sm font-semibold text-white disabled:opacity-50">Usar (1 {item.uCom} = {fatorExist} {selExistente.unidadeControle})</button>
                </div>
              </div>
            )}
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
                <input type="number" inputMode="decimal" value={fator || ''} placeholder={placeholderFator(unidade, item.uCom)} onChange={(e) => setFator(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-sky-300 px-3 py-2 text-base tabular-nums" />
                {sugestao.explicacao && <p className="mt-1 rounded bg-white/70 px-2 py-1 text-[11px] font-medium text-sky-800">sugestão: {sugestao.explicacao}</p>}
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
