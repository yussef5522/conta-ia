// Sub-fase 2B — Extração do LEDGERBAL do OFX.
//
// Os 3 bancos do Yussef (Banrisul, Stone, Sicredi) exportam <LEDGERBAL>.
// Outros bancos podem não exportar — parser deve retornar null sem crashar.

import { describe, it, expect } from 'vitest'
import { parseOFX } from '../lib/ofx/parser'

function ofxWith(body: string): string {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>041</BANKID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260612</DTPOSTED><TRNAMT>100.00</TRNAMT><FITID>x1</FITID><MEMO>SMOKE</MEMO></STMTTRN>
</BANKTRANLIST>
${body}
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

describe('Sub-fase 2B — parser extrai LEDGERBAL', () => {
  // ──────────────────────────────────────────────────────────
  it('P1. Banrisul real: LEDGERBAL bem formado SGML', () => {
    const ofx = ofxWith(`<LEDGERBAL><BALAMT>-9954.55</BALAMT><DTASOF>20260612120000</DTASOF></LEDGERBAL>`)
    const r = parseOFX(ofx)
    expect(r.ledgerBalance).not.toBeNull()
    expect(r.ledgerBalance!.amount).toBe(-9954.55)
    expect(r.ledgerBalance!.asOfDate.toISOString().slice(0, 10)).toBe('2026-06-12')
  })

  // ──────────────────────────────────────────────────────────
  it('P2. Stone real (positivo, formato XML)', () => {
    const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKACCTFROM><BANKID>197</BANKID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260612</DTPOSTED><TRNAMT>50.00</TRNAMT><FITID>s1</FITID><MEMO>X</MEMO></STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
  <BALAMT>105.20</BALAMT>
  <DTASOF>20260612</DTASOF>
</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    const r = parseOFX(ofx)
    expect(r.ledgerBalance).not.toBeNull()
    expect(r.ledgerBalance!.amount).toBe(105.20)
  })

  // ──────────────────────────────────────────────────────────
  it('P3. Sicredi real (saldo muito negativo)', () => {
    const ofx = ofxWith(`<LEDGERBAL><BALAMT>-77854.18</BALAMT><DTASOF>20260612</DTASOF></LEDGERBAL>`)
    const r = parseOFX(ofx)
    expect(r.ledgerBalance!.amount).toBe(-77854.18)
  })

  // ──────────────────────────────────────────────────────────
  it('P4. BALAMT NaN (inválido) → retorna null sem crashar', () => {
    const ofx = ofxWith(`<LEDGERBAL><BALAMT>NAO_NUMERO</BALAMT><DTASOF>20260612</DTASOF></LEDGERBAL>`)
    const r = parseOFX(ofx)
    expect(r.ledgerBalance).toBeNull()
    // Outras tx do extrato ainda devem vir
    expect(r.transactions.length).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────────────────────
  it('P5. Sem tag LEDGERBAL → null sem crashar', () => {
    const ofx = ofxWith('')  // body vazio = sem ledgerbal
    const r = parseOFX(ofx)
    expect(r.ledgerBalance).toBeNull()
    expect(r.transactions.length).toBeGreaterThan(0)
  })

  // ──────────────────────────────────────────────────────────
  it('P6. DTASOF ausente → usa fallback new Date() (decisão Yussef)', () => {
    const before = new Date()
    const ofx = ofxWith(`<LEDGERBAL><BALAMT>-100.00</BALAMT></LEDGERBAL>`)
    const r = parseOFX(ofx)
    const after = new Date()
    expect(r.ledgerBalance).not.toBeNull()
    expect(r.ledgerBalance!.amount).toBe(-100)
    expect(r.ledgerBalance!.asOfDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(r.ledgerBalance!.asOfDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)
  })

  // ──────────────────────────────────────────────────────────
  it('P7. DTASOF formato completo YYYYMMDDHHMMSS', () => {
    const ofx = ofxWith(`<LEDGERBAL><BALAMT>-7816.71</BALAMT><DTASOF>20260612153045</DTASOF></LEDGERBAL>`)
    const r = parseOFX(ofx)
    expect(r.ledgerBalance!.asOfDate.toISOString().slice(0, 10)).toBe('2026-06-12')
  })
})
