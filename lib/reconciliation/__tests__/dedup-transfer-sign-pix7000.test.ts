import { describe, it, expect } from 'vitest'
import { reconcileImportLines } from '../import-orchestrator'
import type { StatementLine } from '../types'

// REGRA 1 + REGRA 4 — bug do PIX 7.000 (17/08/2026).
//
// Uma TRANSFER Banrisul→Stone: a perna Banrisul (OUT, −7000) foi importada DEPOIS
// da perna Stone (IN, +7000). No re-import do Banrisul, o dedup montava o universo
// SEM `transferDirection` no select → prepareBalanceTransactions caía no fallback
// createdAt (perna mais antiga = saída) e, como o Stone foi criado ANTES, assinava
// o Banrisul como +7000. A linha nova do OFX (−7000) não batia com +7000 → virava
// "nova" → DUPLICATA. O saldo não pegava (ancorado no LEDGERBAL, e a data era pré-
// anchor); o I9 também não (pré-anchor).
//
// Este teste roda o reconcileImportLines REAL contra um `db` que HONRA o `select`
// (igual ao Prisma: só devolve os campos pedidos). Enquanto o select trouxer
// transferDirection → o sinal sai correto (−7000) → a linha casa → 0 novas. Se
// alguém REMOVER transferDirection do select, o mock devolve a linha sem o campo →
// fallback → sinal invertido → 1 nova (duplicata) → o teste FALHA. É o guard que
// impede o bug de voltar (REGRA 4: "NUNCA remover deste select").

type Row = Record<string, unknown>

// Mock de PrismaClient.transaction.findMany que respeita where + select, igual ao
// Prisma faz — é isso que torna o teste um guard do SELECT, não da lógica só.
function makeDb(rows: Row[]) {
  const matchWhere = (r: Row, where: any): boolean => {
    if (!where) return true
    for (const [k, v] of Object.entries(where)) {
      const rv = r[k]
      if (v && typeof v === 'object') {
        const cond = v as any
        if ('not' in cond && rv === cond.not) return false
        if ('in' in cond && !cond.in.includes(rv)) return false
        if ('gte' in cond && (rv as Date) < cond.gte) return false
        if ('lte' in cond && (rv as Date) > cond.lte) return false
      } else if (rv !== v) {
        return false
      }
    }
    return true
  }
  const pickSelect = (r: Row, select: any): Row => {
    if (!select) return r
    const out: Row = {}
    for (const [k, want] of Object.entries(select)) if (want) out[k] = r[k]
    return out
  }
  return {
    transaction: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: async ({ where, select }: any) =>
        rows.filter((r) => matchWhere(r, where)).map((r) => pickSelect(r, select)),
    },
  } as any
}

const D = (iso: string) => new Date(iso)

describe('dedup do import — sinal de TRANSFER (bug PIX 7.000)', () => {
  // A perna Stone (IN) criada 13/08; a Banrisul (OUT) criada 15/08 (fora de ordem).
  const banLeg: Row = {
    id: 'ban', date: D('2026-08-13T12:00:00Z'), createdAt: D('2026-08-15T18:06:00Z'),
    type: 'TRANSFER', amount: 7000, bankAccountId: 'BAN', transferGroupId: 'g1',
    transferDirection: 'OUT', externalId: null, description: 'PIX ENVIADO', lifecycle: 'EFFECTED',
  }
  const stoLeg: Row = {
    id: 'sto', date: D('2026-08-13T12:00:00Z'), createdAt: D('2026-08-13T23:46:00Z'),
    type: 'TRANSFER', amount: 7000, bankAccountId: 'STO', transferGroupId: 'g1',
    transferDirection: 'IN', externalId: null, description: 'YUSSEF - Transf', lifecycle: 'EFFECTED',
  }

  // A MESMA linha do OFX que já existe (PIX ENVIADO −7000 em 13/08).
  const linhaJaExiste: StatementLine = {
    datePosted: D('2026-08-13T12:00:00Z'), signedAmount: -7000, memo: 'PIX ENVIADO', fitid: '999',
  }

  it('re-import da linha que já existe como TRANSFER OUT → 0 novas (casa, não duplica)', async () => {
    const db = makeDb([banLeg, stoLeg])
    const { result } = await reconcileImportLines(db, {
      bankAccountId: 'BAN',
      allLines: [linhaJaExiste],
      realLines: [linhaJaExiste],
      dtAsOf: D('2026-08-17T12:00:00Z'),
      today: D('2026-08-17T12:00:00Z'),
      judgeRan: true, // pula separação de preview — conciliação pura
    })
    expect(result.missing.length).toBe(0) // NÃO recria a duplicata
    expect(result.matched.length).toBe(1) // casou com a tx de sexta
  })

  it('PROVA do bug: sem transferDirection nas pernas, o fallback INVERTE → 1 duplicata', async () => {
    // Simula exatamente o SELECT antigo (sem transferDirection): as pernas chegam
    // sem o campo → prepareBalanceTransactions cai no fallback createdAt. Como o
    // Stone foi criado antes, o Banrisul vira +7000 → não casa com −7000 → duplicata.
    // É o estado pré-fix; garante que o teste acima passa POR CAUSA do select.
    const { transferDirection: _b, ...banSemDir } = banLeg
    const { transferDirection: _s, ...stoSemDir } = stoLeg
    const db = makeDb([banSemDir, stoSemDir])
    const { result } = await reconcileImportLines(db, {
      bankAccountId: 'BAN', allLines: [linhaJaExiste], realLines: [linhaJaExiste],
      dtAsOf: D('2026-08-17T12:00:00Z'), today: D('2026-08-17T12:00:00Z'), judgeRan: true,
    })
    expect(result.missing.length).toBe(1) // o bug: recria como duplicata
    expect(result.matched.length).toBe(0)
  })

  it('CAMINHO IN (Stone): re-import da perna IN +7000 → casa, 0 novas (bug Stone 17/08)', async () => {
    // A perna IN do Stone (+7000, dir IN). O select traz transferDirection → o sinal
    // sai +7000 (não invertido) → o stableKey da linha nova (CREDIT +7000) bate.
    const db = makeDb([banLeg, stoLeg])
    const linhaStoneIN: StatementLine = {
      datePosted: D('2026-08-13T12:00:00Z'), signedAmount: 7000, memo: 'YUSSEF - Transf', fitid: '888',
    }
    const { result } = await reconcileImportLines(db, {
      bankAccountId: 'STO', // reconciliando a conta STONE
      allLines: [linhaStoneIN], realLines: [linhaStoneIN],
      dtAsOf: D('2026-08-17T12:00:00Z'), today: D('2026-08-17T12:00:00Z'), judgeRan: true,
    })
    expect(result.missing.length).toBe(0) // já existe — não recria (era o bug: virava nova)
    expect(result.matched.length).toBe(1)
  })

  it('linha genuinamente nova (valor diferente) continua sendo nova', async () => {
    const db = makeDb([banLeg, stoLeg])
    const nova: StatementLine = { datePosted: D('2026-08-16T12:00:00Z'), signedAmount: -1234.5, memo: 'PIX ENVIADO', fitid: '111' }
    const { result } = await reconcileImportLines(db, {
      bankAccountId: 'BAN', allLines: [nova], realLines: [nova],
      dtAsOf: D('2026-08-17T12:00:00Z'), today: D('2026-08-17T12:00:00Z'), judgeRan: true,
    })
    expect(result.missing.length).toBe(1)
    expect(result.matched.length).toBe(0)
  })
})
