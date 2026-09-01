'use client'

// ESTOQUE — digitar os itens do DANFE de PAPEL quando o XML ainda não veio.
// O caminhão não espera a SEFAZ. Depois de salvar, a tela de conferência roda o fluxo
// NORMAL em cima destes itens (mapear, fator, divergência, confirmar).
//
// A soma é conferida contra o vNF que a SEFAZ já confirmou — AVISA, nunca trava: a
// diferença costuma ser ICMS-ST/frete/IPI (entram no total e não no preço do item).
//
// ⭐⭐ E AGORA A DESCRIÇÃO BUSCA NO CATÁLOGO (31/08/2026). Antes eram DOIS trabalhos:
// digitar tudo, salvar, e mapear item por item de novo ("0/0 mapeados"). Escolher o
// produto enquanto digita já cria o vínculo.
//
// ⚠️⚠️ A DISTINÇÃO QUE NÃO PODE MORRER: o campo é **"descrição DO DANFE"**, não "meu
// produto". A nota diz `TOMATE LONGA VIDA CX 20KG` e no catálogo é `Tomate` — escolher
// **cria o VÍNCULO, não substitui a descrição**. O texto do papel continua sendo gravado
// como veio, e o vínculo vira linha no mapa aprendido (que a próxima nota do mesmo
// fornecedor consulta, inclusive quando ela vier COM XML).
//
// ⚠️ O FATOR NUNCA É ADIVINHADO — a régua está em `lib/stock/itens-manuais/vinculo.ts`.

import { useMemo, useState } from 'react'
import { Plus, Trash2, Loader2, Check, AlertTriangle, X, Link2, Unlink } from 'lucide-react'
import { BuscaItem } from './busca-item'
import {
  linhaVazia, estadoDoFator, fatorEfetivo, linhaBloqueada,
  aplicarItemEscolhido, limparVinculo, type LinhaManual,
} from '@/lib/stock/itens-manuais/vinculo'

type Linha = LinhaManual

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (s: string) => Number(String(s).replace(',', '.'))
const vazia = linhaVazia

export function ItensManuaisEditor({ companyId, nfeId, valorNota, onSalvo, onCancelar }: {
  companyId: string; nfeId: string; valorNota: number | null
  onSalvo: () => void; onCancelar: () => void
}) {
  const [linhas, setLinhas] = useState<Linha[]>([vazia(), vazia(), vazia()])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const preenchidas = useMemo(() => linhas.filter((l) => l.xProd.trim() !== ''), [linhas])
  const soma = useMemo(() => preenchidas.reduce((s, l) => s + (num(l.qCom) || 0) * (num(l.vUnCom) || 0), 0), [preenchidas])
  const dif = valorNota != null ? soma - valorNota : null
  // mesma tolerância do back (1 centavo por item + 1) — a tela não pode discordar do servidor
  const bate = dif == null || Math.abs(dif) <= 0.01 * preenchidas.length + 0.01

  const set = (i: number, patch: Partial<Linha>) => setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  async function salvar() {
    setErro(null)
    const itens = preenchidas.map((l) => ({
      xProd: l.xProd.trim(), qCom: num(l.qCom), uCom: l.uCom.trim(), vUnCom: num(l.vUnCom),
      // ⭐ o vínculo vai junto — é o que faz a nota já nascer mapeada
      itemId: l.itemId, fatorConversao: fatorEfetivo(l, estadoDoFator(l, null, null)),
    }))
    if (itens.length === 0) { setErro('Digite ao menos um item da nota.'); return }
    const ruim = itens.find((i) => !(i.qCom > 0) || !i.uCom || !(i.vUnCom >= 0))
    if (ruim) { setErro(`Confira "${ruim.xProd}": quantidade, unidade e preço unitário são obrigatórios.`); return }
    // ⛔ unidade diferente sem fator resolvido NÃO passa — é o bug da Skol travado
    const travada = preenchidas.map((l) => linhaBloqueada(l, estadoDoFator(l, null, null))).find(Boolean)
    if (travada) { setErro(travada); return }
    setSalvando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/recebimentos/${nfeId}/itens-manuais`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não consegui salvar os itens.'); return }
      onSalvo()
    } catch { setErro('Falha de rede ao salvar os itens.') } finally { setSalvando(false) }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-900">Itens do DANFE (papel)</h3>
        <p className="hidden flex-1 text-xs text-slate-400 lg:block">Copie do papel: descrição, quantidade, unidade e preço unitário. O resto do fluxo é o mesmo.</p>
        <button onClick={onCancelar} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><X className="h-3.5 w-3.5" /> cancelar</button>
      </div>

      <table className="density-normal hidden w-full sm:table">
        <thead><tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
          <th className="px-3 py-2 font-medium">Descrição (do DANFE)</th>
          <th className="px-3 py-2 text-right font-medium">Qtd</th>
          <th className="px-3 py-2 font-medium">Un.</th>
          <th className="px-3 py-2 text-right font-medium">Preço unit.</th>
          <th className="px-3 py-2 text-right font-medium">Total</th>
          <th className="px-3 py-2 w-10"></th>
        </tr></thead>
        <tbody>
          {linhas.map((l, i) => {
            const total = (num(l.qCom) || 0) * (num(l.vUnCom) || 0)
            return (
              <tr key={i} className="border-b border-slate-50 last:border-b-0">
                <td className="px-3 py-1">
                  <input value={l.xProd} onChange={(e) => set(i, { xProd: e.target.value })}
                    placeholder="ex: OLEO DE SOJA 900ML" className="h-8 w-full rounded-lg border border-slate-300 px-2 text-[13px]" />
                  <Vinculo companyId={companyId} l={l} i={i} setLinhas={setLinhas} />
                </td>
                <td className="px-3 py-1"><input value={l.qCom} onChange={(e) => set(i, { qCom: e.target.value })} inputMode="decimal" placeholder="0" className="h-8 w-20 rounded-lg border border-slate-300 px-2 text-right text-[13px] tabular-nums" /></td>
                <td className="px-3 py-1"><input value={l.uCom} onChange={(e) => set(i, { uCom: e.target.value })} placeholder="CX" className="h-8 w-16 rounded-lg border border-slate-300 px-2 text-[13px] uppercase" /></td>
                <td className="px-3 py-1"><input value={l.vUnCom} onChange={(e) => set(i, { vUnCom: e.target.value })} inputMode="decimal" placeholder="0,00" className="h-8 w-24 rounded-lg border border-slate-300 px-2 text-right text-[13px] tabular-nums" /></td>
                <td className="px-3 py-1 text-right text-[13px] tabular-nums text-slate-600">{total > 0 ? brl(total) : <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-1 text-center">
                  {linhas.length > 1 && <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* mobile: um bloco por item */}
      <div className="divide-y divide-slate-50 sm:hidden">
        {linhas.map((l, i) => (
          <div key={i} className="space-y-2 p-3">
            <input value={l.xProd} onChange={(e) => set(i, { xProd: e.target.value })} placeholder="descrição do DANFE" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm" />
            <Vinculo companyId={companyId} l={l} i={i} setLinhas={setLinhas} />
            <div className="flex items-center gap-2">
              <input value={l.qCom} onChange={(e) => set(i, { qCom: e.target.value })} inputMode="decimal" placeholder="qtd" className="h-11 w-20 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
              <input value={l.uCom} onChange={(e) => set(i, { uCom: e.target.value })} placeholder="un" className="h-11 w-16 rounded-lg border border-slate-300 px-2 text-sm uppercase" />
              <input value={l.vUnCom} onChange={(e) => set(i, { vUnCom: e.target.value })} inputMode="decimal" placeholder="preço" className="h-11 flex-1 rounded-lg border border-slate-300 px-2 text-right text-sm tabular-nums" />
              {linhas.length > 1 && <button onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))} className="shrink-0 text-slate-300"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-100 px-3 py-2">
        <button onClick={() => setLinhas((ls) => [...ls, vazia()])} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-600 hover:bg-slate-50"><Plus className="h-3.5 w-3.5" /> mais um item</button>

        {/* conferência contra o total que a SEFAZ já confirmou */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="tabular-nums text-slate-500">soma dos itens <b className="text-slate-800">{brl(soma)}</b></span>
          {valorNota != null && <span className="tabular-nums text-slate-500">total da nota (SEFAZ) <b className="text-slate-800">{brl(valorNota)}</b></span>}
          {valorNota != null && (bate
            ? <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><Check className="h-3.5 w-3.5" /> bate</span>
            : <span className="inline-flex items-center gap-1 font-medium text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> {dif! < 0 ? 'faltam' : 'sobram'} {brl(Math.abs(dif!))}</span>)}
        </div>
        {valorNota != null && !bate && preenchidas.length > 0 && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
            {dif! < 0
              ? 'Pode ser ICMS-ST, frete ou IPI — entram no total da nota e não no preço dos itens — ou pode faltar item. Dá pra seguir assim mesmo.'
              : 'Provavelmente há desconto na nota, item repetido ou preço digitado errado. Dá pra seguir assim mesmo.'}
          </p>
        )}
        {erro && <p className="rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">{erro}</p>}

        <button onClick={salvar} disabled={salvando || preenchidas.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#185FA5] px-5 text-sm font-semibold text-white hover:bg-[#0F4A8C] disabled:bg-slate-200 disabled:text-slate-400">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Usar estes {preenchidas.length} {preenchidas.length === 1 ? 'item' : 'itens'} e conferir
        </button>
      </div>
    </div>
  )
}

/**
 * ⭐ O VÍNCULO DA LINHA — busca no catálogo, chip do item escolhido, e o fator quando as
 * unidades diferem.
 *
 * ⚠️ Fica ABAIXO da descrição de propósito: a descrição é o que veio do papel (e continua
 * sendo gravada assim); o vínculo é outra coisa, e a tela precisa mostrar que são duas.
 */
function Vinculo({ companyId, l, i, setLinhas }: {
  companyId: string; l: LinhaManual; i: number
  setLinhas: React.Dispatch<React.SetStateAction<LinhaManual[]>>
}) {
  // ⚠️ aprendido/sugerido entram numa próxima volta (o back já sabe consultar o mapa);
  // hoje a régua resolve IDENTIDADE, PERGUNTA e o que o dono digitar.
  const estado = estadoDoFator(l, null, null)

  if (!l.itemId) {
    return (
      <div className="mt-1">
        <BuscaItem companyId={companyId} compacto escopoInicial=""
          placeholder="qual produto do catálogo é este? (ou crie)"
          onEscolher={(it) => setLinhas((ls) => aplicarItemEscolhido(ls, i, it))} />
      </div>
    )
  }

  return (
    <div className="mt-1 space-y-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200">
        <Link2 className="h-3 w-3" /> {l.itemNome}
        <span className="text-emerald-600">· {l.unidadeControle}</span>
        <button type="button" onClick={() => setLinhas((ls) => limparVinculo(ls, i))}
          title="desfazer o vínculo" className="ml-0.5 text-emerald-500 hover:text-rose-600">
          <Unlink className="h-3 w-3" />
        </button>
      </span>

      {/* ⛔ unidade diferente + fator desconhecido = campo VAZIO e linha bloqueada.
          Nunca 1 por omissão — foi o bug da Skol (a caixa de 20 entrou como 1). */}
      {estado.tipo === 'PERGUNTA' && (
        <div className="flex items-center gap-1.5">
          <input value={l.fatorTexto} inputMode="decimal"
            onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, fatorTexto: e.target.value } : x)))}
            placeholder={estado.pergunta}
            className={`h-7 w-full rounded-md border px-2 text-[12px] ${
              l.fatorTexto.trim() === '' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
            }`} />
        </div>
      )}
      {estado.tipo === 'PERGUNTA' && l.fatorTexto.trim() !== '' && (
        <p className="text-[10px] text-slate-500">
          {l.qCom || '1'} {l.uCom.toUpperCase()} = {(num(l.qCom) || 1) * (num(l.fatorTexto) || 0)} {l.unidadeControle}
        </p>
      )}
      {estado.tipo === 'IDENTIDADE' && l.uCom.trim() !== '' && (
        <p className="text-[10px] text-slate-400">mesma unidade da nota — sem conversão</p>
      )}
    </div>
  )
}
