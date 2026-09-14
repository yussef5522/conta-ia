'use client'

// ⭐⭐ O CABEÇALHO DIZ O RECORTE (14/09/2026) — *"setembro · mudar", com ‹ › de navegar*.
//
// ⚠️ É o MESMO gesto do dashboard PF (‹ mês ›), de propósito: dois jeitos de navegar mês
// no mesmo sistema seriam duas coisas pra aprender.
//
// ⛔ E ele diz **o que o recorte alcança**: *"pagas em setembro · vencidas e a pagar
// mostram tudo em aberto"*. Sem essa frase, o dono vê "setembro" no topo e conclui que as
// vencidas de agosto sumiram — que é exatamente a mentira que a régua dos dois tempos
// existe pra impedir.

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { mesVizinho, rotuloDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'

export function NavegadorDeMes({ mes, onMudar, frase }: {
  mes: string
  onMudar: (m: string) => void
  /** ⚠️ cada tela DIZ o que o mês dela alcança — a frase genérica mentiria na outra */
  frase?: string
}) {
  const corrente = mesCorrente()
  return (
    <div className="-mt-1 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMudar(mesVizinho(mes, -1))}
          className="rounded p-0.5 hover:bg-slate-100"
          aria-label="mês anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[92px] text-center text-[13px] font-semibold capitalize text-slate-800">
          {rotuloDoMes(mes)}
        </span>
        <button
          type="button"
          onClick={() => onMudar(mesVizinho(mes, 1))}
          className="rounded p-0.5 hover:bg-slate-100"
          aria-label="mês seguinte"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ⚠️ "voltar pro mês" só aparece FORA do corrente — botão que não faz nada é ruído */}
      {mes !== corrente && (
        <button type="button" onClick={() => onMudar(corrente)} className="font-medium text-violet-700 hover:underline">
          voltar pra {rotuloDoMes(corrente)}
        </button>
      )}

      <span className="w-full text-[11px] text-slate-400 sm:w-auto">
        {frase ?? '· o mês recorta as pagas; vencidas e a pagar mostram tudo que está em aberto'}
      </span>
    </div>
  )
}
