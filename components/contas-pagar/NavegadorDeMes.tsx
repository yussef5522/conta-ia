'use client'

// ⭐⭐ O CABEÇALHO DIZ O RECORTE (14/09/2026) — *"setembro · mudar", com ‹ › de navegar*.
//
// ⚠️ É o MESMO gesto do dashboard PF (‹ mês ›), de propósito: dois jeitos de navegar mês
// no mesmo sistema seriam duas coisas pra aprender.
//
// ⛔ E ele diz **o que o recorte alcança**. Sem essa frase, o dono vê "setembro" no topo e
// conclui que as vencidas de agosto sumiram — a mentira que a régua dos dois tempos existe
// pra impedir. ⚠️ Por isso a `frase` é **obrigatória** desde 26/09 (ver abaixo).

// ⭐ 06/10/2026 — A ROUPA VIROU TOKEN (`var(--prod-*)`), e os dois temas saem de graça.
// ⚠️ Ele é compartilhado por 4 telas (Contas a Pagar, Recebimentos, Lançamentos PF e Custos
// fixos): escrever um 2º navegador "só pro v4" seria dois jeitos de navegar mês no mesmo
// sistema — exatamente o que o comentário acima proíbe. **O gesto não mudou; só a tinta.**
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { mesVizinho, rotuloDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'

export function NavegadorDeMes({ mes, onMudar, frase }: {
  mes: string
  onMudar: (m: string) => void
  /**
   * ⚠️⚠️ **OBRIGATÓRIA desde 26/09.** O default era *"· o mês recorta as pagas; vencidas e a
   * pagar mostram tudo que está em aberto"* — uma frase **específica de Contas a Pagar**
   * servindo de padrão pra qualquer tela. Com o navegador saindo daquela tela (o dono:
   * *"um controle por pergunta, não dois"*), o default ficou **sem chamador**: os outros
   * dois callers sempre passaram a frase deles.
   *
   * ⛔ Obrigatória e não "removida": tela nova que use o navegador **tem que dizer o que o
   * mês dela alcança**, senão o dono vê "setembro" e conclui que o resto sumiu. *Disciplina
   * virou impossibilidade* (REGRA 5).
   */
  frase: string
}) {
  const corrente = mesCorrente()
  return (
    <div className="-mt-1 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--prod-secondary)' }}>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMudar(mesVizinho(mes, -1))}
          className="rounded p-0.5"
          style={{ color: 'var(--prod-secondary)' }}
          aria-label="mês anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[92px] text-center text-[13px] font-semibold capitalize" style={{ color: 'var(--prod-primary)' }}>
          {rotuloDoMes(mes)}
        </span>
        <button
          type="button"
          onClick={() => onMudar(mesVizinho(mes, 1))}
          className="rounded p-0.5"
          style={{ color: 'var(--prod-secondary)' }}
          aria-label="mês seguinte"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ⚠️ "voltar pro mês" só aparece FORA do corrente — botão que não faz nada é ruído */}
      {mes !== corrente && (
        <button type="button" onClick={() => onMudar(corrente)} className="font-medium hover:underline" style={{ color: 'var(--prod-accent)' }}>
          voltar pra {rotuloDoMes(corrente)}
        </button>
      )}

      <span className="w-full text-[11px] sm:w-auto" style={{ color: 'var(--prod-muted)' }}>
        {frase}
      </span>
    </div>
  )
}
