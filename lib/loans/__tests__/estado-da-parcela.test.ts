/**
 * ⛔⛔⛔ UMA RÉGUA PRAS TRÊS TELAS — A PARCELA 22 DO C41033828 (02/10/2026).
 *
 * **O caso real:** os dois pagamentos vinculados somam **exatamente** o devido
 * (`7.568,91 + 2.665,44 = 10.234,35`) e as telas davam três respostas:
 *
 * ```
 * LISTA           → EM DIA     (procurava `status === 'OPEN'` e PULAVA a PARTIAL)
 * CONTRATO        → EM DIA     (mesma régua)
 * A PARCELA 22    → ATRASADA + "Marcar paga"   ⛔ com as duas mordidas desenhadas abaixo
 * ```
 *
 * ⚠️ **Os números deste arquivo são de PROD**, inclusive os 3 casos que a régua ingênua
 * rebaixaria — fixture inventada testaria o mundo que eu imaginei.
 */
import { describe, it, expect } from 'vitest'
import {
  estadoDaParcela,
  quantoFoiPago,
  ofereceMarcarPaga,
  rotuloDoGesto,
} from '../estado-da-parcela'

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)
const HOJE = d('2026-10-02')
const normal = { flexible: false, hoje: HOJE }

/** ⭐ A PARCELA 22 REAL: devido 10.234,35, dois vínculos, `paidTotal` gravado ERRADO */
const P22 = {
  dueDate: d('2026-09-25'),
  payment: 10234.35,
  status: 'PARTIAL',
  paidTotal: 2665.44, // ⛔ o campo que o gesto sobrescreveu — só o ÚLTIMO pagamento
  pagamentos: [{ amount: 7568.91 }, { amount: 2665.44 }],
}

describe('⛔⛔⛔ a parcela 22: os números dizem QUITADA, e as 3 telas passam a concordar', () => {
  it('⛔⛔⛔ Σ dos vínculos == devido → PAGA, mesmo com `status: PARTIAL` gravado', () => {
    const v = estadoDaParcela(P22, normal)
    expect(v.pago, 'o pago voltou a sair do campo gravado').toBe(10234.35)
    expect(v.estado, 'a parcela quitada continua sendo chamada de atrasada').toBe('PAGA')
    expect(v.falta).toBe(0)
    expect(v.mordidas).toBe(2)
    expect(v.selo).toBe('paga em 2 pagamentos')
  })

  it('⛔⛔ o `paidTotal` gravado NUNCA ganha dos vínculos', () => {
    /**
     * ⭐ É o coração: *o valor pago é a SOMA das baixas* (a doutrina da baixa parcial,
     * 10/09). Campo gravado envelhece — foi assim que a `CreditCardInvoice.status` ficou
     * eternamente OPEN, e foi assim que esta parcela ficou PARTIAL.
     */
    expect(quantoFoiPago(P22).pago).toBe(10234.35)
    // e o campo sozinho, sem vínculo, é o ÚLTIMO recurso (as 180 pagas por documento)
    expect(quantoFoiPago({ ...P22, pagamentos: [] }).pago).toBe(2665.44)
  })

  it('⛔⛔⛔ o botão "Marcar paga" SOME na quitada — era a porta da dupla contagem', () => {
    const v = estadoDaParcela(P22, normal)
    expect(ofereceMarcarPaga(v), 'o botão voltou a aparecer numa parcela já paga').toBe(false)
  })
})

describe('⛔⛔⛔ PROMOVE, NUNCA REBAIXA — os 3 casos REAIS que a régua ingênua quebraria', () => {
  /**
   * ⚠️⚠️ Estes três foram **MEDIDOS contra as 353 parcelas da empresa antes de a régua ser
   * escrita**. A versão ingênua (*"PAGA ⟺ Σ >= devido"*) rebaixaria os três — e
   * *invariante que falha no caso legítimo é pior que invariante nenhum: alguém "conserta" o
   * DADO pra bater com a régua errada.*
   */
  it('⭐⭐ Banrisul #58: PAID com 4,46 a menos continua PAGA (ninguém deve R$ 4,46)', () => {
    const v = estadoDaParcela(
      { dueDate: d('2026-08-26'), payment: 2449.08, status: 'PAID', paidTotal: 2444.62, pagamentos: [{ amount: 2444.62 }] },
      normal,
    )
    expect(v.estado, 'uma parcela paga foi rebaixada por 4,46').toBe('PAGA')
    expect(v.falta).toBe(0)
  })

  it('⭐⭐ Banrisul #59: idem com 8,76', () => {
    const v = estadoDaParcela(
      { dueDate: d('2026-09-26'), payment: 2422.62, status: 'PAID', paidTotal: 2413.86, pagamentos: [{ amount: 2413.86 }] },
      normal,
    )
    expect(v.estado).toBe('PAGA')
  })

  it('⭐⭐ as 180 PAID SEM vínculo nenhum (pagas por documento) continuam PAGAS', () => {
    const v = estadoDaParcela(
      { dueDate: d('2024-05-10'), payment: 3000, status: 'PAID', paidTotal: null, pagamentos: [] },
      normal,
    )
    expect(v.estado, 'o histórico pago por documento foi rebaixado').toBe('PAGA')
    expect(v.pago).toBe(0) // ⚠️ e ele é HONESTO: não há soma pra mostrar
  })

  it('⛔⛔ mútuo FLEXIBLE: devolução de 40.000 num nominal de 41.428,57 NÃO é "parcial"', () => {
    /**
     * ⛔ A agenda de 7× do mútuo Arafat é **só referência** — a devolução é conforme caixa.
     * Dizer *"faltam 1.428,57"* inventaria uma dívida de parcela que não existe, e dizer
     * *"atrasada"* seria pior ainda.
     */
    const v = estadoDaParcela(
      { dueDate: d('2026-07-06'), payment: 41428.57, status: 'OPEN', paidTotal: 40000, valorDoVinculo11: 40000 },
      { flexible: true, hoje: HOJE },
    )
    expect(v.estado, 'o mútuo FLEXIBLE virou parcial/atrasada pelo nominal').toBe('A_VENCER')
    expect(v.selo).toMatch(/devolvido/)
  })
})

describe('⭐⭐ O PARCIAL DE VERDADE continua dizendo "falta R$ X"', () => {
  it('⭐⭐ uma mordida só, sem fechar → PARCIAL com o resto NOMEADO', () => {
    /**
     * ⭐ É o cenário do 1º gesto da própria #22, antes do 2º débito entrar: a honestidade
     * aqui é o que impede a cura de virar *"tudo pago"*.
     */
    const v = estadoDaParcela({ ...P22, status: 'PARTIAL', pagamentos: [{ amount: 7568.91 }] }, normal)
    expect(v.estado).toBe('PARCIAL')
    expect(v.pago).toBe(7568.91)
    expect(v.falta).toBe(2665.44)
    expect(v.selo).toContain('faltam')
    expect(v.selo).toContain('2.665,44')
  })

  it('⛔ e o gesto dela COMPLETA a diferença, não recomeça', () => {
    const v = estadoDaParcela({ ...P22, status: 'PARTIAL', pagamentos: [{ amount: 7568.91 }] }, normal)
    expect(ofereceMarcarPaga(v)).toBe(true)
    expect(rotuloDoGesto(v), 'o rótulo voltou a dizer "marcar paga" numa parcial').toMatch(/completar/)
    expect(rotuloDoGesto(v)).toContain('2.665,44')
  })

  it('⛔⛔ parcial vencida NÃO é "atrasada" — já entrou dinheiro nela', () => {
    const v = estadoDaParcela({ ...P22, status: 'PARTIAL', pagamentos: [{ amount: 100 }] }, normal)
    expect(v.estado).toBe('PARCIAL')
  })
})

describe('⛔⛔ ATRASADA é POR DIA, nunca por instante (a cicatriz de fuso)', () => {
  /**
   * ⚠️ A LISTA já comparava por DIA, com o motivo escrito (*"parcela vencendo HOJE não está
   * atrasada; o débito cai ao longo do dia"*); o CONTRATO e o `statusUI` comparavam por
   * INSTANTE. Divergiam no PRÓPRIO dia do vencimento — o bug que já custou o card do cartão
   * (09/09) e o Contas a Pagar (13/09).
   */
  const semPagamento = { payment: 1000, status: 'OPEN', paidTotal: null, pagamentos: [] }

  it('⭐ vence HOJE, mesmo às 23h, NÃO está atrasada', () => {
    const v = estadoDaParcela(
      { ...semPagamento, dueDate: new Date('2026-10-02T00:00:00.000Z') },
      { flexible: false, hoje: new Date('2026-10-02T23:59:00.000Z') },
    )
    expect(v.estado, 'o dia do vencimento voltou a contar como atrasado').toBe('VENCE_HOJE')
  })

  it('⛔ ontem-pra-trás é atrasada', () => {
    const v = estadoDaParcela(
      { ...semPagamento, dueDate: new Date('2026-10-01T00:00:00.000Z') },
      { flexible: false, hoje: new Date('2026-10-02T00:30:00.000Z') },
    )
    expect(v.estado).toBe('ATRASADA')
  })

  it('⭐ futuro é a vencer', () => {
    expect(estadoDaParcela({ ...semPagamento, dueDate: d('2026-11-25') }, normal).estado).toBe('A_VENCER')
  })

  it('⛔ e FLEXIBLE nunca é atrasada, nem com vencimento nominal no passado', () => {
    const v = estadoDaParcela(
      { ...semPagamento, dueDate: d('2026-05-01') },
      { flexible: true, hoje: HOJE },
    )
    expect(v.estado).not.toBe('ATRASADA')
  })
})
