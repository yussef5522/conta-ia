// Sprint PF Fatia 3 — Parser estendido OFX cartão.

import { describe, expect, test } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseOFXExtended } from '@/lib/ofx-card/parser-ext'

const FIXTURE = readFileSync(
  join(__dirname, '..', 'fixtures', 'nubank-fatura.ofx'),
  'utf-8',
)

describe('parseOFXExtended — fixture Nubank real', () => {
  test('detecta statementType=CREDITCARD', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.statementType).toBe('CREDITCARD')
  })

  test('extrai ORG = NU PAGAMENTOS S.A.', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.org).toBe('NU PAGAMENTOS S.A.')
  })

  test('extrai FID = 260', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.fid).toBe('260')
  })

  test('extrai accountId de CCACCTFROM', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.accountId).toBe('5031xxxxxxxx1234')
  })

  test('parse todas as 15 transações', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.transactions).toHaveLength(15)
  })

  test('Posto Pitangueira corretamente parseado (DEBIT R$ 85,50)', () => {
    const r = parseOFXExtended(FIXTURE)
    const posto = r.transactions.find((t) => t.memo === 'Posto Pitangueira')
    expect(posto).toBeDefined()
    expect(posto?.amount).toBe(85.5)
    expect(posto?.type).toBe('DEBIT')
  })

  test('Pagamento recebido = CREDIT R$ 2800', () => {
    const r = parseOFXExtended(FIXTURE)
    const pag = r.transactions.find((t) => t.memo === 'Pagamento recebido')
    expect(pag).toBeDefined()
    expect(pag?.type).toBe('CREDIT')
    expect(pag?.amount).toBe(2800)
  })

  test('Airbnb com Parcela 5/6 parseado integralmente', () => {
    const r = parseOFXExtended(FIXTURE)
    const ab = r.transactions.find((t) => t.memo.includes('Airbnb'))
    expect(ab).toBeDefined()
    expect(ab?.memo).toContain('Parcela 5/6')
    expect(ab?.amount).toBe(380)
  })

  test('zero erros no parse da fixture', () => {
    const r = parseOFXExtended(FIXTURE)
    expect(r.errors).toHaveLength(0)
  })
})

describe('parseOFXExtended — retrocompat BANK', () => {
  test('OFX de conta bancária (sem CREDITCARDMSGSRSV1) → statementType=BANK', () => {
    const bankOfx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>033
<ACCTID>123456789
</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260720
<TRNAMT>-50.00
<FITID>123
<MEMO>Teste
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`
    const r = parseOFXExtended(bankOfx)
    expect(r.statementType).toBe('BANK')
    expect(r.accountId).toBe('123456789')
    expect(r.org).toBeUndefined()
    expect(r.transactions).toHaveLength(1)
  })
})
