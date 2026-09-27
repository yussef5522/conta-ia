// Sprint 5.0.3.0a — Tests do payableVisualStatus (função pura).

import { describe, it, expect } from 'vitest'
import {
  payableVisualStatus,
  payableStatusLabel,
  PAYABLE_STATUS_COLOR,
} from '@/components/contas-pagar/payable-status'

const NOW = new Date('2026-05-27T12:00:00.000Z')

describe('payableVisualStatus', () => {
  it('paymentDate preenchida → paid (independe de status DB)', () => {
    expect(
      payableVisualStatus(
        {
          status: 'RECONCILED',
          dueDate: '2026-03-10',
          paymentDate: '2026-03-15',
        },
        NOW,
      ),
    ).toBe('paid')
  })

  it('paymentDate vazia + dueDate no passado → overdue', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-01', paymentDate: null },
        NOW,
      ),
    ).toBe('overdue')
  })

  // ⚠️⚠️ OS TRÊS TESTES ABAIXO FORAM INVERTIDOS EM 13/09, COM O MOTIVO ESCRITO.
  //
  // Eles afirmavam `warn` ("Vence em breve") como STATUS — e o dono matou o conceito:
  // *"'Vence em 2 dias' é informação da COLUNA de vencimento, nunca um status próprio"*.
  // Como status ele fazia duas coisas erradas: era SUBCONJUNTO de "a pagar" (a soma dos
  // 4 cards contava a mesma conta 2×) e discordava do KPI, que comparava por TIMESTAMP.
  // ⭐ O prazo não se perdeu: virou `textoDoPrazo` ("· em 2d") colado na data.
  /**
   * ⚠️⚠️ **INVERTIDO DE NOVO EM 26/09, e por um motivo diferente do de 13/09.** Em 13/09 só
   * existiam TRÊS estados, então *"vence hoje"* só podia ser `pending`; hoje ele tem estado
   * próprio (`today`, âmbar), que é **PARTIÇÃO** de a-pagar — nada de subconjunto: o que
   * vence hoje **sai** do a-pagar, nos dois andares.
   *
   * ⭐ **A metade que importava daquele dia continua sendo o que este teste prova:** o dia
   * não acabou, então **NÃO é VENCIDA**. Essa nunca mudou, e o 2º `expect` a trava.
   */
  it('⚠️ INVERTIDO 2×: dueDate hoje → VENCE HOJE (nunca "vencida", o dia não acabou)', () => {
    const hoje = { status: 'PENDING', dueDate: '2026-05-27', paymentDate: null }
    expect(payableVisualStatus(hoje, NOW)).toBe('today')
    expect(payableVisualStatus(hoje, NOW), 'o dia não acabou — cobrar como vencida é mentir')
      .not.toBe('overdue')
  })

  it('⚠️ INVERTIDO: dueDate em 2 dias → A PAGAR — o prazo é texto da data', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-29', paymentDate: null },
        NOW,
      ),
    ).toBe('pending')
  })

  it('paymentDate vazia + dueDate em 7 dias → pending', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-06-03', paymentDate: null },
        NOW,
      ),
    ).toBe('pending')
  })

  it('paymentDate vazia + dueDate null → pending (sem prazo)', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: null, paymentDate: null },
        NOW,
      ),
    ).toBe('pending')
  })

  it('aceita Date object e string', () => {
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: new Date('2026-05-01'),
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('overdue')
  })

  it('⚠️ INVERTIDO: 3 dias à frente → A PAGAR (não existe mais um degrau de 3 dias)', () => {
    // ⛔ o "3" era um número escolhido a dedo virando ESTADO — a mesma família do `TETO=25`
    // hardcoded e do `30` da janela do "a vencer": régua que mora na tela
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: '2026-05-30', // 3 dias após 2026-05-27 (NOW)
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('pending')
  })

  it('4 dias à frente → A PAGAR (segue igual — nunca foi warn)', () => {
    expect(
      payableVisualStatus(
        {
          status: 'PENDING',
          dueDate: '2026-05-31', // 4 dias após NOW
          paymentDate: null,
        },
        NOW,
      ),
    ).toBe('pending')
  })

  it('dueDate ONTEM (independente de horário) → overdue', () => {
    expect(
      payableVisualStatus(
        { status: 'PENDING', dueDate: '2026-05-26', paymentDate: null },
        NOW,
      ),
    ).toBe('overdue')
  })
})

describe('payableStatusLabel', () => {
  it.each([
    ['paid', 'Paga'],
    ['pending', 'A pagar'],
    ['overdue', 'Vencida'],
  ] as const)('%s → %s', (s, label) => {
    expect(payableStatusLabel(s)).toBe(label)
  })
})

describe('PAYABLE_STATUS_COLOR — safelist Tailwind', () => {
  it('todos os 4 status tem mapeamento completo', () => {
    // ⭐ 26/09 — `today` entrou como 4º (âmbar, entre o azul de a-pagar e o vermelho de vencida)
    for (const k of ['paid', 'pending', 'overdue', 'today'] as const) {
      expect(PAYABLE_STATUS_COLOR[k]).toBeDefined()
      expect(PAYABLE_STATUS_COLOR[k].stripe).toMatch(/^bg-/)
      expect(PAYABLE_STATUS_COLOR[k].badgeBg).toMatch(/^bg-/)
      expect(PAYABLE_STATUS_COLOR[k].badgeText).toMatch(/^text-/)
    }
  })

  it('cores semânticas distintas (não duplicadas)', () => {
    const stripes = new Set(
      Object.values(PAYABLE_STATUS_COLOR).map((c) => c.stripe),
    )
    /**
     * ⚠️ **INVERTIDO em 26/09:** eram 3 desde 13/09 (o `warn` âmbar saiu junto com o status
     * *"vence em breve"*, que era SUBCONJUNTO). Agora são **4** — o `today` é PARTIÇÃO e tem
     * cor própria, senão a conta que vence hoje se pinta igual à que vence em 20 dias.
     * ⭐ O que o teste continua provando é o que importa: **nenhuma cor repetida** — duas
     * faixas iguais fariam dois estados diferentes parecerem o mesmo na lista.
     */
    expect(stripes.size).toBe(4)
  })
})
