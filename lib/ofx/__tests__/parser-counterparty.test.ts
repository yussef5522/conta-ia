// Sprint Contraparte PIX — FASE 2.1: parser captura NAME como contraparte SÓ
// quando difere do MEMO, e NUNCA altera o `memo` (=description → stableKey/cache).

import { describe, it, expect } from 'vitest'
import { parseOFX } from '../parser'

const wrap = (trns: string) =>
  `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>${trns}</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('parseOFX — contraparte (FASE 2.1)', () => {
  it('NAME diferente do MEMO → counterpartyName preenchido, memo INALTERADO', () => {
    const ofx = wrap(
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260706<TRNAMT>-1215.00<FITID>198074<MEMO>PIX ENVIADO<NAME>MARCOS ADRIEL</STMTTRN>',
    )
    const t = parseOFX(ofx).transactions[0]
    expect(t.memo).toBe('PIX ENVIADO') // description NÃO muda
    expect(t.counterpartyName).toBe('MARCOS ADRIEL')
  })

  it('NAME == MEMO (Banrisul) → counterpartyName undefined', () => {
    const ofx = wrap(
      '<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260706<TRNAMT>-12.50<FITID>008610<MEMO>PIX ENVIADO<NAME>PIX ENVIADO</STMTTRN>',
    )
    const t = parseOFX(ofx).transactions[0]
    expect(t.memo).toBe('PIX ENVIADO')
    expect(t.counterpartyName).toBeUndefined()
  })

  it('só NAME (sem MEMO) → NAME vira description, sem contraparte separada', () => {
    const ofx = wrap(
      '<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260709<TRNAMT>139.90<FITID>000000<NAME>GRUBERT E BRAGA</STMTTRN>',
    )
    const t = parseOFX(ofx).transactions[0]
    expect(t.memo).toBe('GRUBERT E BRAGA')
    expect(t.counterpartyName).toBeUndefined()
  })
})
