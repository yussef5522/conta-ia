// Sprint Category-Combobox (29/06/2026) — defesa em profundidade da escada.
// enforceStatusLadder GARANTE a invariante: impossível criar estado invertido.

import { describe, it, expect } from 'vitest'
import { enforceStatusLadder } from '@/lib/transacoes/needs-review'

describe('enforceStatusLadder — invariante blindada', () => {
  it('IGNORED via body preserva (manual, independente)', () => {
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: 'IGNORED',
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('IGNORED')
    // IGNORED preserva mesmo COM categoria + CASH
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: 'IGNORED',
        categoryId: 'cat_x',
        accountType: 'CASH',
      }),
    ).toBe('IGNORED')
  })

  it('CASH sempre RECONCILED (sem extrato pra conciliar)', () => {
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: 'PENDING',
        categoryId: null,
        accountType: 'CASH',
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
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
        temVinculoDeGesto: false,
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
        temVinculoDeGesto: false,
        intendedStatus: 'RECONCILED',
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('PENDING')
  })

  it('intendedStatus null/undefined funciona', () => {
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: null,
        categoryId: 'cat_x',
        accountType: 'CHECKING',
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: undefined,
        categoryId: null,
        accountType: 'CHECKING',
      }),
    ).toBe('PENDING')
  })

  it('accountType null/undefined trata como não-CASH', () => {
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
        intendedStatus: 'PENDING',
        categoryId: 'cat_x',
        accountType: null,
      }),
    ).toBe('RECONCILED')
    expect(
      enforceStatusLadder({
        temVinculoDeGesto: false,
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
      temVinculoDeGesto: false,
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
            temVinculoDeGesto: false,
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
      temVinculoDeGesto: false,
      intendedStatus: 'PENDING',
      categoryId: 'cmq_xyz',
      accountType: 'CHECKING',
    })
    expect(final).toBe('RECONCILED')
  })

  it('body { categoryId: null, status: "RECONCILED" } → resultado PENDING', () => {
    // Outro lado da armadilha.
    const final = enforceStatusLadder({
      temVinculoDeGesto: false,
      intendedStatus: 'RECONCILED',
      categoryId: null,
      accountType: 'CHECKING',
    })
    expect(final).toBe('PENDING')
  })
})

describe('⭐⭐ 27/09 — O DEGRAU DO VÍNCULO: o gesto resolve, e o resultado SOBREVIVE', () => {
  /**
   * ⛔⛔ **O defeito que este degrau fecha:** esta função roda no fim de **todo** create/update
   * (a defesa em profundidade de 29/06), então sem ele **qualquer edição posterior** — mudar a
   * descrição, um lote de status — devolvia a "Pendente" a linha que o gesto 🏦/💳/📈 acabou de
   * resolver. *O defeito voltaria sozinho, em silêncio.*
   *
   * ⚠️ E `temVinculoDeGesto` virou campo **OBRIGATÓRIO** no tipo de propósito: opcional seria
   * `undefined` = "sem vínculo", o default **errado** — e o `tsc` achou os 4 chamadores em vez
   * de eu ir de grep (a REGRA 4 de graça, como no `temAporteVinculado` de 25/09).
   */
  it('⭐ com vínculo e SEM categoria → RECONCILED (era PENDING: o bug dos 58 lançamentos)', () => {
    expect(enforceStatusLadder({
      intendedStatus: 'PENDING', categoryId: null, accountType: 'CHECKING',
      temVinculoDeGesto: true,
    })).toBe('RECONCILED')
  })

  it('⭐ e ele vem ANTES da escada da categoria — a categoria dessas linhas é nula por DESENHO', () => {
    // ⚠️ sem a precedência, a escada decidiria por `categoryId: null` e o carimbo não sobreviveria
    expect(enforceStatusLadder({
      intendedStatus: 'RECONCILED', categoryId: null, accountType: null,
      temVinculoDeGesto: true,
    })).toBe('RECONCILED')
  })

  it('⛔ IGNORED continua vencendo tudo — decisão do dono não se sobrescreve', () => {
    expect(enforceStatusLadder({
      intendedStatus: 'IGNORED', categoryId: null, accountType: 'CHECKING',
      temVinculoDeGesto: true,
    })).toBe('IGNORED')
  })

  it('⛔ e SEM vínculo nada muda — a escada da categoria continua mandando', () => {
    expect(enforceStatusLadder({
      intendedStatus: 'RECONCILED', categoryId: null, accountType: 'CHECKING',
      temVinculoDeGesto: false,
    })).toBe('PENDING')
  })
})
