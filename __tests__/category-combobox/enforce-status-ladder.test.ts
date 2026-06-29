// Sprint Category-Combobox (29/06/2026) — defesa em profundidade da escada.
// enforceStatusLadder GARANTE a invariante: impossível criar estado invertido.

import { describe, it, expect } from 'vitest'
import { enforceStatusLadder } from '@/lib/transacoes/needs-review'

describe('enforceStatusLadder — invariante blindada', () => {
  it('IGNORED via body preserva (manual, independente)', () => {
    expect(
      enforceStatusLadder({
        intendedStatus: 'IGNORED',
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('IGNORED')
    // IGNORED preserva mesmo COM categoria + CASH
    expect(
      enforceStatusLadder({
        intendedStatus: 'IGNORED',
        categoryId: 'cat_x',
        accountType: 'CASH',
      }),
    ).toBe('IGNORED')
  })

  it('CASH sempre RECONCILED (sem extrato pra conciliar)', () => {
    expect(
      enforceStatusLadder({
        intendedStatus: 'PENDING',
        categoryId: null,
        accountType: 'CASH',
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        intendedStatus: 'PENDING',
        categoryId: 'cat_x',
        accountType: 'CASH',
      }),
    ).toBe('RECONCILED')
  })

  it('categoryId NOT NULL ⇒ RECONCILED (mesmo se body mandou PENDING)', () => {
    // 🚨 armadilha original — agora blindada
    expect(
      enforceStatusLadder({
        intendedStatus: 'PENDING',
        categoryId: 'cat_x',
        accountType: 'CHECKING',
      }),
    ).toBe('RECONCILED')
  })

  it('categoryId NULL ⇒ PENDING (mesmo se body mandou RECONCILED)', () => {
    // 🚨 outro caso — também blindado
    expect(
      enforceStatusLadder({
        intendedStatus: 'RECONCILED',
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('PENDING')
  })

  it('intendedStatus null/undefined funciona', () => {
    expect(
      enforceStatusLadder({
        intendedStatus: null,
        categoryId: 'cat_x',
        accountType: 'CHECKING',
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        intendedStatus: undefined,
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('PENDING')
  })

  it('accountType null/undefined trata como não-CASH', () => {
    expect(
      enforceStatusLadder({
        intendedStatus: 'PENDING',
        categoryId: 'cat_x',
        accountType: null,
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        intendedStatus: 'PENDING',
        categoryId: null,
      }),
    ).toBe('PENDING')
  })

  it('idempotente: chamar 2x retorna mesmo resultado', () => {
    const ctx = {
      intendedStatus: 'PENDING' as const,
      categoryId: 'cat_x',
      accountType: 'CHECKING',
    }
    const a = enforceStatusLadder(ctx)
    const b = enforceStatusLadder({ ...ctx, intendedStatus: a })
    expect(a).toBe(b)
  })

  it('matriz exaustiva: 3 status × 2 categoryId × 2 accountType', () => {
    const statuses: ('PENDING' | 'RECONCILED' | 'IGNORED')[] = [
      'PENDING',
      'RECONCILED',
      'IGNORED',
    ]
    const cats = [null, 'cat_x']
    const types = ['CASH', 'CHECKING']

    for (const s of statuses) {
      for (const c of cats) {
        for (const t of types) {
          const r = enforceStatusLadder({
            intendedStatus: s,
            categoryId: c,
            accountType: t,
          })
          // Regra esperada
          let esperado: 'PENDING' | 'RECONCILED' | 'IGNORED'
          if (s === 'IGNORED') esperado = 'IGNORED'
          else if (t === 'CASH') esperado = 'RECONCILED'
          else esperado = c ? 'RECONCILED' : 'PENDING'
          expect(r, `s=${s} c=${c} t=${t}`).toBe(esperado)
        }
      }
    }
  })
})

describe('Blindagem: armadilha lateral do PUT', () => {
  it('body { categoryId: X, status: "PENDING" } → resultado RECONCILED', () => {
    // Cenário exato do diagnóstico anterior. Helper força RECONCILED.
    const final = enforceStatusLadder({
      intendedStatus: 'PENDING',
      categoryId: 'cmq_xyz',
      accountType: 'CHECKING',
    })
    expect(final).toBe('RECONCILED')
  })

  it('body { categoryId: null, status: "RECONCILED" } → resultado PENDING', () => {
    // Outro lado da armadilha.
    const final = enforceStatusLadder({
      intendedStatus: 'RECONCILED',
      categoryId: null,
      accountType: 'CHECKING',
    })
    expect(final).toBe('PENDING')
  })
})
