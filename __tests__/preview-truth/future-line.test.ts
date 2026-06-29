// Sprint Preview-Truth (29/06/2026) — corte de linha futura + BRT.

import { describe, it, expect } from 'vitest'
import {
  endOfTodayBrazil,
  isFutureLineBrazil,
  lifecycleFromDate,
} from '@/lib/ofx/future-line'

describe('endOfTodayBrazil', () => {
  it('"hoje" no fim do dia BRT cobre tx de 29/06 BRT (mesmo se UTC já é 30/06)', () => {
    // 29/06/2026 às 22h BRT (= 30/06/2026 01h UTC) — sistema está em UTC
    const now = new Date('2026-06-30T01:00:00.000Z') // 29/06 22h BRT
    const eot = endOfTodayBrazil(now)
    // Fim do dia 29/06 BRT = 30/06 02:59:59.999 UTC
    expect(eot.toISOString()).toBe('2026-06-30T02:59:59.999Z')
  })

  it('"hoje" às 10h BRT (UTC 13h) ainda fecha em 29/06 BRT', () => {
    const now = new Date('2026-06-29T13:00:00.000Z') // 29/06 10h BRT
    const eot = endOfTodayBrazil(now)
    expect(eot.toISOString()).toBe('2026-06-30T02:59:59.999Z')
  })

  it('virada de dia BRT: 30/06 00:30 BRT (UTC 03:30) → fim de 30/06 BRT', () => {
    const now = new Date('2026-06-30T03:30:00.000Z') // 30/06 00:30 BRT
    const eot = endOfTodayBrazil(now)
    expect(eot.toISOString()).toBe('2026-07-01T02:59:59.999Z')
  })
})

describe('isFutureLineBrazil', () => {
  // Cenário Yussef: tx CONSORCIO 09/07 importada no dia 29/06 BRT
  const tx09jul = new Date('2026-07-09T03:00:00.000Z') // BRT = 09/07 00h
  const tx29jun_meiodia = new Date('2026-06-29T15:00:00.000Z') // 29/06 12h BRT
  const tx29jun_23h = new Date('2026-06-30T02:00:00.000Z') // 29/06 23h BRT
  const now = new Date('2026-06-29T13:00:00.000Z') // 29/06 10h BRT

  it('CONSORCIO 09/07 é genuinamente futuro (entrou no dia 29/06)', () => {
    expect(isFutureLineBrazil(tx09jul, now)).toBe(true)
  })

  it('tx 29/06 ao meio-dia BRT NÃO é futura (mesmo dia)', () => {
    expect(isFutureLineBrazil(tx29jun_meiodia, now)).toBe(false)
  })

  it('tx 29/06 às 23h BRT NÃO é futura (timezone bug seria falso positivo)', () => {
    expect(isFutureLineBrazil(tx29jun_23h, now)).toBe(false)
  })

  it('tx do passado nunca é futura', () => {
    const ontem = new Date('2026-06-28T15:00:00.000Z')
    expect(isFutureLineBrazil(ontem, now)).toBe(false)
  })
})

describe('lifecycleFromDate', () => {
  const now = new Date('2026-06-29T13:00:00.000Z') // 29/06 10h BRT

  it('passado → EFFECTED (CREDIT)', () => {
    const passada = new Date('2026-06-20T15:00:00.000Z')
    expect(lifecycleFromDate(passada, 'CREDIT', now)).toBe('EFFECTED')
  })

  it('passado → EFFECTED (DEBIT)', () => {
    const passada = new Date('2026-06-20T15:00:00.000Z')
    expect(lifecycleFromDate(passada, 'DEBIT', now)).toBe('EFFECTED')
  })

  it('futuro DEBIT → PAYABLE (Conta a Pagar)', () => {
    const futura = new Date('2026-07-09T03:00:00.000Z')
    expect(lifecycleFromDate(futura, 'DEBIT', now)).toBe('PAYABLE')
  })

  it('futuro CREDIT → RECEIVABLE (Conta a Receber)', () => {
    const futura = new Date('2026-07-09T03:00:00.000Z')
    expect(lifecycleFromDate(futura, 'CREDIT', now)).toBe('RECEIVABLE')
  })

  it('CENÁRIO YUSSEF: CONSORCIO 09/07 R$1.478,51 DEBIT vira PAYABLE', () => {
    // Antes desta sprint, virava EFFECTED inflando saldo Banrisul errado.
    expect(
      lifecycleFromDate(
        new Date('2026-07-09T03:00:00.000Z'),
        'DEBIT',
        new Date('2026-06-29T20:00:00.000Z'), // 29/06 17h BRT (hora do import)
      ),
    ).toBe('PAYABLE')
  })

  it('FALSO POSITIVO TIMEZONE: tx 29/06 23h BRT (UTC 30/06 02h) fica EFFECTED', () => {
    // O bug que o diagnóstico identificou: 73 tx 29/06 seriam classificadas
    // como "futuras" se o cálculo fosse cego em UTC.
    const tx29 = new Date('2026-06-30T02:00:00.000Z') // 29/06 23h BRT
    const now = new Date('2026-06-29T20:00:00.000Z')
    expect(lifecycleFromDate(tx29, 'CREDIT', now)).toBe('EFFECTED')
  })
})
