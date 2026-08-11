// FASE 3 — TESTE CRUZADO do modelo de perfil por banco (REGRA 3: executa o
// pipeline real contra fixtures reais/estruturais, não faz grep).
//
// Prova três coisas:
//  1) GOLDEN por banco: parse → resolve perfil → âncora → comportamento correto.
//     Em especial: Sicredi ancora pela ÚLTIMA TX REAL (06/08), NÃO pelo DTASOF
//     do fim do mês (31/08). É a base do fix "toothless" do Sicredi.
//  2) ISOLAMENTO estrutural: mutar o perfil do Sicredi NÃO muda Banrisul/Stone.
//  3) DESCONHECIDO → avisa (não adivinha).
//
// Fixtures: Banrisul = extrato real (sem PII, NAME==MEMO genérico). Sicredi/Stone
// = estruturais modelados nos arquivos reais (mesmos quirks: Sicredi DTASOF no
// fim do mês; Stone BANKID 0197, FITID UUID, ACCTID formatado) SEM dado pessoal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseOFX } from '@/lib/ofx/parser'
import {
  resolveBankProfile,
  resolveStatementAnchor,
  bankProfileWarning,
  BANK_PROFILES,
  type BankProfile,
} from '@/lib/bank-profiles'

const fx = (name: string) => readFileSync(join(__dirname, '..', '..', '..', '__tests__', 'fixtures', name), 'utf-8')
// "hoje" fixo: depois da última tx dos extratos, antes do fim do mês (pra provar
// que o DTASOF 31/08 do Sicredi cai no futuro relativo a esse instante).
const TODAY = new Date('2026-08-11T12:00:00.000Z')
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

/** Última tx que já liquidou (≤ hoje) — o que o pipeline passaria como lastRealTxDate. */
function lastRealTx(txs: { datePosted: Date }[], today: Date): Date | null {
  const past = txs.filter((t) => t.datePosted.getTime() <= today.getTime()).map((t) => t.datePosted.getTime())
  return past.length ? new Date(Math.max(...past)) : null
}

function run(fixture: string, registry?: readonly BankProfile[]) {
  const parsed = parseOFX(fx(fixture))
  const profile = resolveBankProfile(parsed.bankId, registry)
  const anchor = resolveStatementAnchor(profile, {
    dtAsOf: parsed.ledgerBalance?.asOfDate ?? null,
    dtEnd: parsed.statementEnd ?? null,
    lastRealTxDate: lastRealTx(parsed.transactions, TODAY),
    today: TODAY,
  })
  return { parsed, profile, anchor, warning: bankProfileWarning(profile, parsed.bankId ?? null) }
}

describe('FASE 3 — cross-bank: GOLDEN por banco', () => {
  it('BANRISUL: perfil 041, âncora DTASOF (11/08), lista futuro, contraparte PDF_ONLY', () => {
    const { parsed, profile, anchor } = run('Extrato_20260811.ofx')
    expect(parsed.bankId).toBe('041')
    expect(profile?.id).toBe('BANRISUL')
    expect(profile?.listsFutureMovements).toBe(true)
    expect(profile?.counterpartySource).toBe('PDF_ONLY')
    expect(profile?.fitidStability).toBe('PER_DOWNLOAD')
    expect(anchor.rule).toBe('DTASOF')
    expect(ymd(anchor.anchor)).toBe('2026-08-11')
  })

  it('SICREDI: perfil 748, âncora pela ÚLTIMA TX REAL (06/08), NÃO o DTASOF 31/08', () => {
    const { parsed, profile, anchor } = run('sicredi-perfil.ofx')
    expect(parsed.bankId).toBe('748')
    expect(profile?.id).toBe('SICREDI')
    // o DTASOF do arquivo é 31/08 (fim do mês)
    expect(ymd(parsed.ledgerBalance?.asOfDate ?? null)).toBe('2026-08-31')
    // mas a âncora resolvida é a última tx real, 06/08 — NÃO o fim do mês
    expect(anchor.rule).toBe('LAST_REAL_TX')
    expect(ymd(anchor.anchor)).toBe('2026-08-06')
    expect(profile?.counterpartySource).toBe('MEMO')
  })

  it('STONE: perfil 197 (BANKID 0197), âncora DTASOF (07/08), FITID STABLE, MEMO', () => {
    const { parsed, profile, anchor } = run('stone-perfil.ofx')
    expect(parsed.bankId).toBe('0197')
    expect(profile?.id).toBe('STONE')
    expect(profile?.fitidStability).toBe('STABLE')
    expect(profile?.counterpartySource).toBe('MEMO')
    expect(anchor.rule).toBe('DTASOF')
    expect(ymd(anchor.anchor)).toBe('2026-08-07')
  })
})

describe('FASE 3 — isolamento estrutural (mudar um banco não muda outro)', () => {
  it('mutar o perfil do SICREDI não altera o resultado de Banrisul nem Stone', () => {
    // baseline com o registry real
    const banrisulBase = run('Extrato_20260811.ofx')
    const stoneBase = run('stone-perfil.ofx')

    // registry mutado: Sicredi vira DTASOF (o "errado") — objeto separado
    const mutado = BANK_PROFILES.map((p) =>
      p.id === 'SICREDI' ? ({ ...p, dateAnchor: 'DTASOF' as const }) : p,
    )
    const banrisulMut = run('Extrato_20260811.ofx', mutado)
    const stoneMut = run('stone-perfil.ofx', mutado)

    // Banrisul e Stone: IDÊNTICOS antes e depois de mexer no Sicredi
    expect(ymd(banrisulMut.anchor.anchor)).toBe(ymd(banrisulBase.anchor.anchor))
    expect(banrisulMut.anchor.rule).toBe(banrisulBase.anchor.rule)
    expect(ymd(stoneMut.anchor.anchor)).toBe(ymd(stoneBase.anchor.anchor))
    expect(stoneMut.anchor.rule).toBe(stoneBase.anchor.rule)

    // sanidade: a mutação REALMENTE muda o Sicredi (senão o teste seria vazio).
    // Com dateAnchor=DTASOF, o Sicredi cairia na rede FUTURE_FALLBACK (DTASOF 31/08
    // no futuro) → ainda 06/08, mas por outra regra. Prova que o objeto mudou.
    const sicrediMut = run('sicredi-perfil.ofx', mutado)
    expect(sicrediMut.anchor.rule).toBe('FUTURE_FALLBACK')
    expect(sicrediMut.anchor.rule).not.toBe('LAST_REAL_TX')
  })
})

describe('FASE 3 — banco desconhecido / ficha incompleta → AVISA', () => {
  it('BANKID fora do registry → perfil null, warning BANK_UNKNOWN, âncora conservadora', () => {
    const profile = resolveBankProfile('999')
    expect(profile).toBeNull()
    const warn = bankProfileWarning(profile, '999')
    expect(warn?.code).toBe('BANK_UNKNOWN')
    expect(warn?.message).toContain('não reconhecido')
    const anchor = resolveStatementAnchor(profile, {
      dtAsOf: new Date('2026-08-31'), dtEnd: null,
      lastRealTxDate: new Date('2026-08-06'), today: TODAY,
    })
    expect(anchor.rule).toBe('UNKNOWN_CONSERVATIVE')
    expect(ymd(anchor.anchor)).toBe('2026-08-06') // última tx real, não o DTASOF
  })

  it('CAIXA (104) resolve mas está incompleta → warning BANK_PROFILE_INCOMPLETE', () => {
    const profile = resolveBankProfile('104')
    expect(profile?.id).toBe('CAIXA')
    expect(profile?.incomplete).toBe(true)
    const warn = bankProfileWarning(profile, '104')
    expect(warn?.code).toBe('BANK_PROFILE_INCOMPLETE')
  })
})

describe('FASE 3 — normalização de BANKID (0197 == 197, zeros à esquerda)', () => {
  it('resolve 0197, 197 e 00197 pro mesmo perfil Stone', () => {
    expect(resolveBankProfile('0197')?.id).toBe('STONE')
    expect(resolveBankProfile('197')?.id).toBe('STONE')
    expect(resolveBankProfile('00197')?.id).toBe('STONE')
  })
  it('cada perfil tem rationale preenchido (o PORQUÊ legível)', () => {
    for (const p of BANK_PROFILES) {
      expect(p.rationale.dateAnchor.length).toBeGreaterThan(10)
      expect(p.rationale.fitidStability.length).toBeGreaterThan(10)
      expect(p.rationale.counterpartySource.length).toBeGreaterThan(10)
    }
  })
})
