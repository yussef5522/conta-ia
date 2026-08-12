// FASE 2.1 — trava anti "OFX na conta errada" (REGRA 3: parseia OFX real dos 3
// bancos e roda a verificação; não faz grep).
//
// O quase-acidente: anexar o OFX do Sicredi (748) na conta Stone (197). A matriz
// abaixo prova: arquivo de um banco na conta de OUTRO → BLOQUEIA; na conta certa
// → passa; mesmo banco / conta diferente → bloqueia; sem como conferir → avisa.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOFX } from '@/lib/ofx/parser'
import { verifyOfxMatchesAccount, type AccountForMatch } from '@/lib/ofx/verify-account-match'

const fx = (n: string) => readFileSync(join(__dirname, '..', '..', '..', '__tests__', 'fixtures', n), 'utf-8')
const parse = (n: string) => {
  const p = parseOFX(fx(n))
  return { bankId: p.bankId, accountId: p.accountId }
}

// arquivos reais/estruturais dos 3 bancos
const FILES = {
  BANRISUL: parse('Extrato_20260811.ofx'), // BANKID 041, ACCTID 00000000
  SICREDI: parse('sicredi-perfil.ofx'), //   BANKID 748, ACCTID 5230000000000000
  STONE: parse('stone-perfil.ofx'), //       BANKID 0197, ACCTID 00000000-1
}
// contas cadastradas (bankCode + número casando com o ACCTID de cada fixture)
const ACCTS: Record<string, AccountForMatch> = {
  BANRISUL: { bankCode: '041', bankName: 'Banrisul', accountNumber: '00000000', name: 'banrisul' },
  SICREDI: { bankCode: '748', bankName: 'Sicredi', accountNumber: '5230000000000000', name: 'sicredi' },
  STONE: { bankCode: '197', bankName: 'Stone', accountNumber: '000000001', name: 'stone' },
}
const banks = ['BANRISUL', 'SICREDI', 'STONE'] as const

describe('FASE 2.1 — matriz banco×conta (arquivo na conta errada bloqueia)', () => {
  for (const fileBank of banks) {
    for (const acctBank of banks) {
      const same = fileBank === acctBank
      it(`OFX ${fileBank} na conta ${acctBank} → ${same ? 'PASSA' : 'BLOQUEIA'}`, () => {
        const r = verifyOfxMatchesAccount(FILES[fileBank], ACCTS[acctBank])
        expect(r.block).toBe(!same)
        if (!same) {
          expect(r.error).toBeTruthy()
          expect(r.code).toBe('OFX_BANK_MISMATCH')
        }
      })
    }
  }

  it('o caso REAL do quase-acidente: Sicredi (748) na conta Stone (197) → BLOQUEIA com msg clara', () => {
    const r = verifyOfxMatchesAccount(FILES.SICREDI, ACCTS.STONE)
    expect(r.block).toBe(true)
    expect(r.error).toContain('Sicredi')
    expect(r.error).toContain('stone')
  })
})

describe('FASE 2.1 — mesmo banco, conta DIFERENTE → bloqueia (camada 2 ACCTID)', () => {
  it('Sicredi na conta Sicredi de OUTRO número → OFX_ACCOUNT_MISMATCH', () => {
    const outraSicredi: AccountForMatch = { bankCode: '748', bankName: 'Sicredi', accountNumber: '111111', name: 'sicredi outra' }
    const r = verifyOfxMatchesAccount(FILES.SICREDI, outraSicredi)
    expect(r.block).toBe(true)
    expect(r.code).toBe('OFX_ACCOUNT_MISMATCH')
  })
  it('Sicredi na conta Sicredi CERTA (número casa por overlap) → passa', () => {
    const r = verifyOfxMatchesAccount(FILES.SICREDI, ACCTS.SICREDI)
    expect(r.block).toBe(false)
  })
})

describe('FASE 2.1 — não dá pra conferir → AVISA, não bloqueia', () => {
  it('conta sem bankCode (null) → warning, block=false', () => {
    const r = verifyOfxMatchesAccount(FILES.BANRISUL, { bankCode: null, accountNumber: null, name: 'cofre' })
    expect(r.block).toBe(false)
    expect(r.warning).toBeTruthy()
  })
  it('conta com bankCode "000" (normaliza vazio, ex arafet) → warning, não bloqueia import legítimo', () => {
    const r = verifyOfxMatchesAccount(FILES.BANRISUL, { bankCode: '000', accountNumber: null, name: 'banrisul arafet' })
    expect(r.block).toBe(false)
    expect(r.warning).toBeTruthy()
  })
  it('arquivo sem BANKID → warning, block=false', () => {
    const r = verifyOfxMatchesAccount({ bankId: null, accountId: '123' }, ACCTS.BANRISUL)
    expect(r.block).toBe(false)
    expect(r.warning).toBeTruthy()
  })
})
