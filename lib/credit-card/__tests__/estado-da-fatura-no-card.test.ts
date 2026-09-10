// ⭐⭐ O ESTADO DA FATURA NO CARD — com os três cartões REAIS do dono (09/09/2026).
//
// Medido em prod no dia do sprint:
//   magazine luiza (2971)  fatura 2026-09  vence 09/09 (HOJE)  R$ 4.491,18  pago 0
//   nubank        (1564)   fatura 2026-09  vence 15/09         R$ 6.210,30  pago 0
//   banrisul      (9113)   fatura 2026-07  vence 10/08         R$ 18.348,72 pago 0

import { describe, it, expect } from 'vitest'
import {
  estadoDaFaturaNoCard, estaPaga, diasEntre, hojeNoBrasil, type FaturaConhecida,
} from '../estado-da-fatura-no-card'
import type { CardConfig } from '../calculate-invoice-reference'

/**
 * ⚠️⚠️ O CALENDÁRIO DESTE TESTE É CONGELADO E RELATIVO A SI MESMO.
 *
 * O guard `sem-data-fixa-no-futuro` pegou a 1ª versão deste arquivo: eu passava
 * `hoje: new Date('2026-09-13')` — data fixa no FUTURO na posição de "agora", que é a
 * assinatura da bomba-relógio que aquele guard existe pra impedir.
 *
 * ⭐ Aqui nada compara com o relógio real (`estadoDaFaturaNoCard` só compara `hoje` com as
 * datas das faturas que eu passo), mas a FORMA importava: derivar os dias a partir da
 * âncora deixa a independência do relógio **visível**, em vez de depender de alguém
 * reparar nela. Mexer no dia é `maisDias(N)`, nunca uma data solta.
 */
const HOJE = new Date('2026-09-09T12:00:00.000Z')
const DIA = 86_400_000
const maisDias = (n: number) => new Date(HOJE.getTime() + n * DIA)
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

/** ⚠️ o `toLocaleString('pt-BR')` põe ESPAÇO NÃO-QUEBRÁVEL depois do "R$" — comparar com
 *  um espaço normal falha com as duas strings parecendo idênticas na tela do erro. */
const limpo = (s: string) => s.replace(/\u00A0/g, ' ')

const fatura = (o: Partial<FaturaConhecida> & { reference: string }): FaturaConhecida => ({
  id: `inv-${o.reference}`, closingDate: d('2026-09-02'), dueDate: d('2026-09-09'),
  totalAmount: 0, paidAmount: 0, status: 'OPEN', pagoEm: null, ...o,
})

const MAGALU: CardConfig = { closingDay: 2, dueDay: 9, closingDayRule: 'ATUAL' }
const NUBANK: CardConfig = { closingDay: 8, dueDay: 15, closingDayRule: 'ATUAL' }
const BANRISUL: CardConfig = { closingDay: 29, dueDay: 10, closingDayRule: 'PROXIMA' }

describe('⭐⭐ O CASO DE HOJE — o Magalu vence HOJE e tem que gritar', () => {
  const faturas = [fatura({
    reference: '2026-09', closingDate: d('2026-09-02'), dueDate: d('2026-09-09'),
    totalAmount: 4491.18,
  })]

  it('⛔ "vence HOJE" em tom de alerta, com o valor', () => {
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas, hoje: HOJE })
    expect(e.estado).toBe('VENCE_HOJE')
    expect(e.tom).toBe('alerta')
    expect(limpo(e.frase)).toContain('4.491,18')
    expect(e.frase).toContain('vence HOJE')
    expect(e.valor).toBeCloseTo(4491.18, 2)
    expect(e.diasPraVencer).toBe(0)
  })

  it('⭐⭐ e vira PAGA sozinho quando o pagamento for REGISTRADO', () => {
    // ⚠️ nada muda no card além do vínculo: `paidAmount` cresce e o estado é derivado.
    // ⚠️ o pagamento é um INSTANTE, e a aplicação nunca grava 00:00 UTC: o import usa
    // meio-dia UTC e o `payInvoice` usa o relógio. Datar a fixture à meia-noite criava um
    // caso que produção não produz — e escondia o fuso em vez de testá-lo.
    const pagas = [{
      ...faturas[0], paidAmount: 4491.18, status: 'PAID',
      pagoEm: new Date('2026-09-09T12:00:00.000Z'),
    }]
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas: pagas, hoje: HOJE })
    expect(e.estado).toBe('PAGA')
    expect(e.tom).toBe('ok')
    expect(e.frase).toBe('paga ✓ em 09/09')
  })

  it('⛔⛔ PAGO POR FORA NÃO CONTA — sem registro, continua cobrando', () => {
    // a régua do dono: *"se não tem registro, a tela não adivinha"*. Um status PAID
    // gravado sem dinheiro amarrado não pode pintar de verde.
    const mentira = [{ ...faturas[0], status: 'PAID', paidAmount: 0 }]
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas: mentira, hoje: HOJE })
    expect(e.estado).toBe('VENCE_HOJE')
    expect(estaPaga(mentira[0])).toBe(false)
  })

  it('⭐ pagamento PARCIAL também não é paga', () => {
    const parcial = [{ ...faturas[0], paidAmount: 2000, status: 'PARTIAL' }]
    expect(estaPaga(parcial[0])).toBe(false)
    expect(estadoDaFaturaNoCard({ card: MAGALU, faturas: parcial, hoje: HOJE }).estado)
      .toBe('VENCE_HOJE')
  })
})

describe('⛔ O BANRISUL — venceu há 30 dias e ninguém avisava', () => {
  const faturas = [fatura({
    reference: '2026-07', closingDate: d('2026-07-29'), dueDate: d('2026-08-10'),
    totalAmount: 18348.72,
  })]

  it('mostra VENCIDA com o dia, em alerta', () => {
    const e = estadoDaFaturaNoCard({ card: BANRISUL, faturas, hoje: HOJE })
    expect(e.estado).toBe('VENCIDA')
    expect(e.tom).toBe('alerta')
    expect(limpo(e.frase)).toContain('18.348,72')
    expect(e.frase).toContain('VENCEU dia 10/08')
    expect(e.diasPraVencer).toBe(-30)
  })

  it('⭐⭐ e AO MESMO TEMPO diz que o ciclo de agora não foi importado', () => {
    // ⛔ as duas coisas são verdade: há uma vencida de julho E não há a de setembro.
    // Mostrar só a vencida deixaria o dono achando que o resto está em dia.
    const e = estadoDaFaturaNoCard({ card: BANRISUL, faturas, hoje: HOJE })
    expect(e.cicloCorrenteSemFatura).toBe(true)
  })

  it('⚠️ a MAIS ANTIGA vencida é a que aparece — ela é a que dói', () => {
    const duas = [
      ...faturas,
      fatura({ reference: '2026-08', closingDate: d('2026-08-29'), dueDate: d('2026-09-10'), totalAmount: 999 }),
    ]
    expect(estadoDaFaturaNoCard({ card: BANRISUL, faturas: duas, hoje: HOJE }).referencia)
      .toBe('2026-07')
  })
})

describe('⭐ O NUBANK — fechada esperando pagamento', () => {
  const faturas = [fatura({
    reference: '2026-09', closingDate: d('2026-09-08'), dueDate: d('2026-09-15'),
    totalAmount: 6210.30,
  })]

  it('vence em 6 dias → tom neutro, ainda não é urgência', () => {
    const e = estadoDaFaturaNoCard({ card: NUBANK, faturas, hoje: HOJE })
    expect(e.estado).toBe('FECHADA')
    expect(e.tom).toBe('neutro')
    expect(limpo(e.frase)).toBe('R$ 6.210,30 · vence em 6 dias')
  })

  it('⭐ e vira ÂMBAR quando falta pouco', () => {
    const e = estadoDaFaturaNoCard({
      card: NUBANK, faturas, hoje: maisDias(4),
    })
    expect(e.tom).toBe('atencao')
    expect(e.frase).toContain('vence em 2 dias')
  })
})

describe('⭐ FATURA ABERTA — o ciclo corrente', () => {
  it('com lançamentos importados, mostra o acumulado', () => {
    const faturas = [fatura({
      reference: '2026-10', closingDate: d('2026-10-02'), dueDate: d('2026-10-09'),
      totalAmount: 320.5,
    })]
    const e = estadoDaFaturaNoCard({
      card: MAGALU, faturas, hoje: maisDias(11),
    })
    expect(e.estado).toBe('ABERTA')
    expect(limpo(e.frase)).toContain('R$ 320,50 até agora')
    expect(e.frase).toContain('fecha em 12 dias')
  })

  it('⛔ sem lançamento nenhum, NÃO mostra "R$ 0,00" — isso afirmaria que não se gastou', () => {
    const faturas = [fatura({
      reference: '2026-10', closingDate: d('2026-10-02'), dueDate: d('2026-10-09'),
      totalAmount: 0,
    })]
    const e = estadoDaFaturaNoCard({
      card: MAGALU, faturas, hoje: maisDias(11),
    })
    expect(e.estado).toBe('ABERTA')
    expect(e.frase).not.toContain('0,00')
    expect(e.frase).toBe('aberta · fecha em 12 dias')
  })
})

describe('⛔⛔ AUSÊNCIA DE DADO NUNCA VIRA CARA DE "TUDO CERTO"', () => {
  it('cartão sem fatura nenhuma diz que não tem, e diz quando fecha', () => {
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas: [], hoje: HOJE })
    expect(e.estado).toBe('SEM_FATURA')
    expect(e.frase).toContain('sem fatura importada deste ciclo')
    expect(e.cicloCorrenteSemFatura).toBe(true)
    // ⛔ e não inventa valor
    expect(e.valor).toBeNull()
  })

  it('⛔ o estado SEM_FATURA nunca é "ok" — verde é só pra pagamento registrado', () => {
    expect(estadoDaFaturaNoCard({ card: MAGALU, faturas: [], hoje: HOJE }).tom).not.toBe('ok')
  })
})

describe('⚠️ dias em UTC — "vence em 2 dias" não pode virar 1 por causa do fuso', () => {
  it('conta dias de calendário, não de relógio', () => {
    expect(diasEntre(new Date('2026-09-09T23:00:00.000Z'), new Date('2026-09-10T01:00:00.000Z'))).toBe(1)
    expect(diasEntre(new Date('2026-09-09T00:00:00.000Z'), new Date('2026-09-09T23:59:00.000Z'))).toBe(0)
  })
})

describe('⛔⛔⛔ O "HOJE" É O DIA DO BRASIL — pego na prova em prod (09/09/2026)', () => {
  // O servidor marcava 2026-09-10 02:32 UTC e em São Paulo ainda era 23:32 de 09/09.
  // O card do Magalu (vence 09/09) já dizia "VENCEU dia 09/09" com o dono no prazo.
  const NOITE_NO_BRASIL = new Date('2026-09-10T02:32:00.000Z')
  const faturas = [fatura({
    reference: '2026-09', closingDate: d('2026-09-02'), dueDate: d('2026-09-09'),
    totalAmount: 4491.18,
  })]

  it('⛔ às 23h32 de 09/09 no Brasil, a fatura de hoje NÃO está vencida', () => {
    const e = estadoDaFaturaNoCard({
      card: MAGALU, faturas, hoje: hojeNoBrasil(NOITE_NO_BRASIL),
    })
    expect(e.estado).toBe('VENCE_HOJE')
  })

  it('⛔ e o UTC cru diria VENCIDA — o contrafactual', () => {
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas, hoje: NOITE_NO_BRASIL })
    expect(e.estado).toBe('VENCIDA')
  })

  it('⭐ e no dia seguinte de verdade ela vence, sim', () => {
    // 03:00 UTC do dia 11 = meia-noite e pouco de 11/09 no Brasil
    const e = estadoDaFaturaNoCard({
      card: MAGALU, faturas, hoje: hojeNoBrasil(new Date('2026-09-11T03:00:00.000Z')),
    })
    expect(e.estado).toBe('VENCIDA')
  })
})

describe('⚠️ a DATA DO PAGAMENTO é um instante — o vencimento é uma data de calendário', () => {
  it('⛔ pagou 23:35 de 09/09 no Brasil → "paga ✓ em 09/09", não 10/09', () => {
    // o instante gravado é 2026-09-10T02:35Z; foi assim que o card do banrisul dizia 10/09
    const pagas = [fatura({
      reference: '2026-09', closingDate: d('2026-09-02'), dueDate: d('2026-09-09'),
      totalAmount: 4491.18, paidAmount: 4491.18, status: 'PAID',
      pagoEm: new Date('2026-09-10T02:35:00.000Z'),
    })]
    const e = estadoDaFaturaNoCard({ card: MAGALU, faturas: pagas, hoje: HOJE })
    expect(e.frase).toBe('paga ✓ em 09/09')
  })

  it('⛔ e o VENCIMENTO continua em UTC — formatá-lo no fuso o puxaria pro dia anterior', () => {
    const vencida = [fatura({
      reference: '2026-07', closingDate: d('2026-07-29'), dueDate: d('2026-08-10'),
      totalAmount: 100,
    })]
    const e = estadoDaFaturaNoCard({ card: BANRISUL, faturas: vencida, hoje: HOJE })
    expect(e.frase).toContain('VENCEU dia 10/08') // ⛔ nunca 09/08
  })
})
