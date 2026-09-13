'use client'

// ⭐⭐ A FILA DAS NOTAS SEM VENCIMENTO — o F5 virando TELA (13/09/2026).
//
// **O dono:** *"lista das notas SEM_CONTA em Recebimentos — fornecedor · nº · total · data
// de entrada — cada uma abre no recibo pro gesto. É meu roteiro pra zerar as 21."*
//
// ⛔⛔ E ela é a metade que faltava do card: o card já dizia *"N notas sem data"* desde
// 04/09 e levava pra uma tela que **não listava nenhuma** — o dono via o número e não
// tinha por onde começar. É a "porta sem maçaneta" do outro lado, a 6ª volta da família.
//
// ⚠️ FRONTEIRA DE PAPEL: definir vencimento cria obrigação financeira → `stock.manage`.
// A operadora não vê a fila (e a rota por trás recusa, que é a trava de verdade).

import { useEffect, useState } from 'react'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { usePermissoes } from '@/lib/hooks/use-permissoes'

interface Nota {
  nfeId: string; nNF: string | null; fornecedor: string | null
  total: number; entrouEm: string; conferenceId: string | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function ListaNotasSemVencimento({ empresaId }: { empresaId: string }) {
  const { pode, carregando } = usePermissoes(empresaId)
  const [notas, setNotas] = useState<Nota[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/empresas/${empresaId}/estoque/notas-sem-vencimento`)
      .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
      .then(({ ok, j }) => { if (!vivo) return; if (!ok) { setErro(true); return } setNotas(j?.notas ?? []) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [empresaId])

  if (carregando || !pode('stock.manage')) return null

  // ⛔ ERRO NUNCA VIRA VAZIO: "nenhuma nota sem vencimento" é uma afirmação, e quando a
  // carga falha o sistema NÃO SABE. Foi assim que a tela da equipe disse "ninguém
  // cadastrado" com 17 pessoas no banco (09/09).
  if (erro) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
        Não consegui carregar as notas sem vencimento — a ausência aqui não é prova de que não existem.
      </div>
    )
  }
  if (!notas || notas.length === 0) return null // ⭐ fila zerada = zero tela

  const total = notas.reduce((s, n) => s + n.total, 0)

  return (
    <div id="sem-vencimento" className="rounded-xl border border-amber-200 bg-amber-50/60">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5">
        <CalendarClock className="h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-[13px] font-semibold text-amber-900">
          {notas.length} {notas.length === 1 ? 'nota entrou sem vencimento' : 'notas entraram sem vencimento'}
          <span className="ml-1.5 tabular-nums font-bold">{brl(total)}</span>
        </span>
        {/* ⚠️ a frase diz o EFEITO, não o estado: "sem data" sozinho não explica por que
            isso é urgente. O que dói é o dinheiro fora do fluxo de caixa. */}
        <span className="w-full text-[11px] text-amber-700 sm:w-auto sm:ml-1">
          · elas não viraram conta a pagar e não aparecem no fluxo de caixa
        </span>
      </div>

      <div className="border-t border-amber-200/70">
        {notas.map((n) => {
          const conteudo = (
            <>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">
                {n.fornecedor ?? 'fornecedor não identificado'}
              </span>
              <span className="shrink-0 text-xs text-slate-500">NF {n.nNF ?? '—'}</span>
              <span className="shrink-0 text-xs text-slate-400">entrou {dia(n.entrouEm)}</span>
              <span className="shrink-0 tabular-nums text-[13px] font-semibold text-slate-900">{brl(n.total)}</span>
            </>
          )
          // ⚠️ nota sem conferência não tem recibo pra abrir — em vez de um link morto
          // (que é pior que nenhum), a linha aparece cinza dizendo o porquê
          return n.conferenceId ? (
            <a
              key={n.nfeId}
              href={`/empresas/${empresaId}/estoque/recibos/${n.conferenceId}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-100 px-3.5 py-2 last:border-0 hover:bg-amber-100/50"
            >
              {conteudo}
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            </a>
          ) : (
            <div key={n.nfeId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-100 px-3.5 py-2 opacity-60 last:border-0">
              {conteudo}
              <span className="shrink-0 text-[11px] text-slate-500">confira a nota primeiro</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
