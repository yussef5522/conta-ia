'use client'

// ⭐⭐⭐ A CATEGORIA DO ITEM É EDITÁVEL (12/09/2026) — ordem do dono.
//
// **Caso real:** *"VINAGRE CBS VINHO TINTO 750ML marquei USO INTERNO por engano — o certo é
// MATÉRIA-PRIMA. **Não existe onde trocar**."*
//
// ⚠️ **A ROTA JÁ ACEITAVA `categoria` desde sempre** — medido antes de escrever qualquer
// coisa. O que faltava era **a tela**, exatamente como o "sumir com o item" de 09/09, em que
// a régua existia há dez dias e o menu não oferecia o gesto.
//
// ⭐ **A troca vale na LEITURA, daqui pra frente** — nenhum movimento é reescrito. Medido:
// a categoria **não pesa em CMV/DRE**; `seContaFisicamente` exclui só SABOR e PRODUTO_FINAL
// (trocar entre MATERIA_PRIMA e USO_INTERNO não mexe na Posição nem na contagem); quem muda
// é a busca de ingrediente da receita e a etiqueta — que é o efeito que o dono quer.

import { useState } from 'react'
import { Loader2, Check, Tag } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

/** ⚠️ as mesmas do `patchSchema` da rota — divergir aqui viraria 400 na cara do dono */
const CATEGORIAS = [
  { valor: 'MATERIA_PRIMA', rotulo: 'Matéria-prima' },
  { valor: 'REVENDA', rotulo: 'Revenda' },
  { valor: 'EMBALAGEM', rotulo: 'Embalagem' },
  { valor: 'LIMPEZA', rotulo: 'Limpeza' },
  { valor: 'USO_INTERNO', rotulo: 'Uso interno' },
] as const

export function CategoriaEditavel({ companyId, itemId, categoria, onSalvo }: {
  companyId: string; itemId: string; categoria: string
  onSalvo?: (nova: string) => void
}) {
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)
  // ⛔ item produzido (SABOR/PRODUTO_FINAL/INTERMEDIARIO) NÃO troca por aqui: a categoria
  // dele vem da FICHA, e mexer soltaria o item da receita que o produz.
  const daFicha = ['SABOR', 'PRODUTO_FINAL', 'INTERMEDIARIO'].includes(categoria)

  async function trocar(nova: string) {
    if (nova === categoria || salvando) return
    setSalvando(true)
    try {
      const r = await fetch(`/api/empresas/${companyId}/estoque/itens/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: nova }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) { toast({ variant: 'destructive', title: 'Não deu pra trocar', description: j?.erro ?? `HTTP ${r.status}` }); return }
      // ⭐ o check nasce do que o SERVIDOR devolveu, nunca do clique — dizer "salvo" a partir
      // do próprio clique afirma uma gravação que pode não ter acontecido (a lição de 08/09).
      setOk(true); setTimeout(() => setOk(false), 2000)
      onSalvo?.(j?.item?.categoria ?? nova)
    } catch {
      toast({ variant: 'destructive', title: 'Falha de rede', description: 'Tenta de novo.' })
    } finally { setSalvando(false) }
  }

  if (daFicha) {
    return <span className="text-sm text-slate-500">{categoria} · definida pela ficha que produz este item</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Tag className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {/* ⚠️ rótulo FIXO em cima do controle seria redundante aqui: o próprio valor
          selecionado é o rótulo, e ele não some quando se digita (não há digitação). */}
      <select
        value={categoria}
        onChange={(e) => trocar(e.target.value)}
        disabled={salvando}
        aria-label="Categoria do item"
        className="h-7 rounded-lg border border-slate-200 bg-white px-1.5 text-[13px] text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
      </select>
      {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      {ok && <Check className="h-3.5 w-3.5 text-emerald-600" />}
    </span>
  )
}
