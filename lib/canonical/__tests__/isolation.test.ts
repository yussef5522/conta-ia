// Sprint Rearquitetura-Import FASE 2 (13/08) — ISOLAMENTO PROVADO POR CONSTRUÇÃO.
// Igual ao que funcionou no motor de transferência: muta UM tradutor e exige que
// os OUTROS deem resultado IDÊNTICO. Se um dia o tradutor do Banrisul afetar o do
// Sicredi, este teste fica VERMELHO.

import { describe, it, expect } from 'vitest'
import { toCanonical } from '../to-canonical'
import type { TranslatorSpec } from '../build'

const trn = (dt: string, amt: string, fitid: string, memo: string) =>
  `<STMTTRN><TRNTYPE>${amt.startsWith('-') ? 'DEBIT' : 'CREDIT'}</TRNTYPE><DTPOSTED>${dt}</DTPOSTED><TRNAMT>${amt}</TRNAMT><FITID>${fitid}</FITID><MEMO>${memo}</MEMO></STMTTRN>`
const ofx = (bankId: string, trns: string[], dtAsOf = '20260806') =>
  `<OFX><BANKACCTFROM><BANKID>${bankId}</BANKID><ACCTID>1</ACCTID></BANKACCTFROM><BANKTRANLIST><DTEND>${dtAsOf}</DTEND>${trns.join('')}</BANKTRANLIST><LEDGERBAL><BALAMT>1.00</BALAMT><DTASOF>${dtAsOf}</DTASOF></LEDGERBAL></OFX>`

const SICREDI_FILE = ofx('748', [trn('20260804', '-50.00', 'S1', 'PIX'), trn('20260806', '129.90', 'S2', 'REC')])
const STONE_FILE = ofx('197', [trn('20260806', '-10.00', 'uuid-1', 'PIX')])
const BANRISUL_FILE = ofx('041', [trn('20260806', '-4092.02', '260806', 'EMPRESTIMO')])

// Tradutor do Banrisul CORROMPIDO — inverte tudo (identidade = FITID, status
// sempre AGENDADA). Se o isolamento vazar, Sicredi/Stone mudariam com isto.
const CORRUPTED_BANRISUL: TranslatorSpec = {
  id: 'BANRISUL_CORRUPTED',
  conservative: false,
  anchor: () => new Date('2000-01-01T12:00:00Z'), // tudo vira AGENDADA
  identityOf: (l) => l.fitid, // errado de propósito
  counterpartyOf: (l) => l.counterpartyName,
}
const override = { '41': CORRUPTED_BANRISUL }

describe('isolamento entre tradutores', () => {
  it('corromper o Banrisul NÃO altera o resultado do Sicredi', () => {
    expect(toCanonical(SICREDI_FILE, override)).toEqual(toCanonical(SICREDI_FILE))
  })
  it('corromper o Banrisul NÃO altera o resultado da Stone', () => {
    expect(toCanonical(STONE_FILE, override)).toEqual(toCanonical(STONE_FILE))
  })

  it('o teste NÃO é vazio: o override REALMENTE muda o Banrisul', () => {
    const normal = toCanonical(BANRISUL_FILE)
    const corrupted = toCanonical(BANRISUL_FILE, override)
    // com o corrompido: identidade vira o FITID e status vira AGENDADA
    expect(normal.transactions[0].stableId).not.toContain('260806')
    expect(normal.transactions[0].status).toBe('EFETIVADA')
    expect(corrupted.transactions[0].stableId).toBe('260806#1')
    expect(corrupted.transactions[0].status).toBe('AGENDADA')
    expect(normal).not.toEqual(corrupted)
  })

  it('cada arquivo aciona SÓ o tradutor do seu banco', () => {
    expect(toCanonical(SICREDI_FILE).translatorId).toBe('SICREDI')
    expect(toCanonical(STONE_FILE).translatorId).toBe('STONE')
    expect(toCanonical(BANRISUL_FILE).translatorId).toBe('BANRISUL')
  })
})
