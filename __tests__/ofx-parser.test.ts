import { describe, it, expect } from 'vitest'
import { parseOFX } from '../lib/ofx/parser'

const OFX_SGML = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20240101
<DTEND>20240131
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20240105
<TRNAMT>1500.00
<FITID>2024010500001
<MEMO>SALARIO EMPRESA X
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240110
<TRNAMT>-350.50
<FITID>2024011000001
<MEMO>BOLETO ENERGIA ELETRICA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20240115
<TRNAMT>-1200.00
<FITID>2024011500001
<MEMO>ALUGUEL
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>260</BANKID>
          <ACCTID>99999-9</ACCTID>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20240201120000</DTPOSTED>
            <TRNAMT>500.00</TRNAMT>
            <FITID>NU202402010001</FITID>
            <MEMO>PIX RECEBIDO</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20240202120000</DTPOSTED>
            <TRNAMT>-89.90</TRNAMT>
            <FITID>NU202402020001</FITID>
            <MEMO>COMPRA SUPERMERCADO</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`

describe('parseOFX', () => {
  describe('formato SGML (bancos tradicionais BR)', () => {
    it('parseia 3 transações corretamente', () => {
      const result = parseOFX(OFX_SGML)
      expect(result.transactions).toHaveLength(3)
    })

    it('extrai metadados da conta', () => {
      const result = parseOFX(OFX_SGML)
      expect(result.bankId).toBe('341')
      expect(result.accountId).toBe('12345-6')
    })

    it('identifica crédito com valor positivo', () => {
      const result = parseOFX(OFX_SGML)
      const credit = result.transactions.find((t) => t.fitid === '2024010500001')
      expect(credit).toBeDefined()
      expect(credit?.type).toBe('CREDIT')
      expect(credit?.amount).toBe(1500)
    })

    it('identifica débito com valor negativo', () => {
      const result = parseOFX(OFX_SGML)
      const debit = result.transactions.find((t) => t.fitid === '2024011000001')
      expect(debit).toBeDefined()
      expect(debit?.type).toBe('DEBIT')
      expect(debit?.amount).toBe(350.5)
    })

    it('amount é sempre positivo (valor absoluto)', () => {
      const result = parseOFX(OFX_SGML)
      result.transactions.forEach((t) => {
        expect(t.amount).toBeGreaterThan(0)
      })
    })

    it('parseia data no formato YYYYMMDD', () => {
      const result = parseOFX(OFX_SGML)
      const t = result.transactions[0]
      expect(t.datePosted.getFullYear()).toBe(2024)
      expect(t.datePosted.getMonth()).toBe(0) // janeiro = 0
      expect(t.datePosted.getDate()).toBe(5)
    })

    it('preserva memo/descrição', () => {
      const result = parseOFX(OFX_SGML)
      expect(result.transactions[0].memo).toBe('SALARIO EMPRESA X')
    })

    it('não retorna erros para arquivo válido', () => {
      const result = parseOFX(OFX_SGML)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('formato XML (Nubank, fintechs)', () => {
    it('parseia 2 transações no formato XML', () => {
      const result = parseOFX(OFX_XML)
      expect(result.transactions).toHaveLength(2)
    })

    it('extrai FITID corretamente', () => {
      const result = parseOFX(OFX_XML)
      const fitids = result.transactions.map((t) => t.fitid)
      expect(fitids).toContain('NU202402010001')
      expect(fitids).toContain('NU202402020001')
    })

    it('parseia data com horário (YYYYMMDDHHMMSS)', () => {
      const result = parseOFX(OFX_XML)
      const t = result.transactions[0]
      expect(t.datePosted.getFullYear()).toBe(2024)
      expect(t.datePosted.getMonth()).toBe(1) // fevereiro = 1
      expect(t.datePosted.getDate()).toBe(1)
    })

    it('extrai bankId e accountId', () => {
      const result = parseOFX(OFX_XML)
      expect(result.bankId).toBe('260')
      expect(result.accountId).toBe('99999-9')
    })
  })

  describe('deduplicação', () => {
    it('dois arquivos com mesmo FITID produzem transações com FITID idêntico', () => {
      const r1 = parseOFX(OFX_SGML)
      const r2 = parseOFX(OFX_SGML)
      const ids1 = r1.transactions.map((t) => t.fitid).sort()
      const ids2 = r2.transactions.map((t) => t.fitid).sort()
      expect(ids1).toEqual(ids2)
    })
  })

  describe('tratamento de erros', () => {
    it('retorna erro para transação sem FITID', () => {
      const ofx = OFX_SGML.replace('<FITID>2024010500001\n', '')
      const result = parseOFX(ofx)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('FITID')
    })

    it('arquivo vazio retorna zero transações', () => {
      const result = parseOFX('')
      expect(result.transactions).toHaveLength(0)
    })

    it('arquivo sem BANKTRANLIST retorna zero transações', () => {
      const result = parseOFX('<OFX><STMTRS></STMTRS></OFX>')
      expect(result.transactions).toHaveLength(0)
    })

    it('transação com valor inválido é ignorada com erro', () => {
      const ofx = OFX_SGML.replace('<TRNAMT>1500.00', '<TRNAMT>NAO_NUMERO')
      const result = parseOFX(ofx)
      expect(result.transactions).toHaveLength(2)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
