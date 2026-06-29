// Sprint Preview-Truth (29/06/2026) — applyImportDecisions (função pura).

import { describe, it, expect } from 'vitest'
import {
  applyImportDecisions,
  importDecisionsSchema,
  IMPORT_DECISION_ACTIONS,
} from '@/lib/ofx/decisions'

const tx = (h: string) => ({ dedupHash: h, x: h })

describe('applyImportDecisions', () => {
  it('sem decisions → mantém TODAS as novas (back-compat)', () => {
    const r = applyImportDecisions([tx('a'), tx('b'), tx('c')], undefined)
    expect(r.filtered).toHaveLength(3)
    expect(r.skipped).toBe(0)
    expect(r.implicit).toBe(3)
  })

  it('decisions vazio → mantém todas (back-compat)', () => {
    const r = applyImportDecisions([tx('a'), tx('b')], [])
    expect(r.filtered).toHaveLength(2)
    expect(r.implicit).toBe(2)
  })

  it('SKIP remove a linha desmarcada', () => {
    const r = applyImportDecisions(
      [tx('a'), tx('b'), tx('c')],
      [
        { dedupHash: 'b', action: 'SKIP' },
        { dedupHash: 'a', action: 'CREATE_NEW' },
        { dedupHash: 'c', action: 'CREATE_NEW' },
      ],
    )
    expect(r.filtered.map((t) => t.dedupHash)).toEqual(['a', 'c'])
    expect(r.skipped).toBe(1)
    expect(r.implicit).toBe(0)
  })

  it('REPLACE_MANUAL e CONCILIATE_PAYABLE mantêm (não pulam)', () => {
    const r = applyImportDecisions(
      [tx('a'), tx('b')],
      [
        { dedupHash: 'a', action: 'REPLACE_MANUAL' },
        { dedupHash: 'b', action: 'CONCILIATE_PAYABLE' },
      ],
    )
    expect(r.filtered).toHaveLength(2)
    expect(r.skipped).toBe(0)
  })

  it('decisão sem entrada no arquivo → orphanDecisionHashes', () => {
    const r = applyImportDecisions(
      [tx('a')],
      [
        { dedupHash: 'a', action: 'CREATE_NEW' },
        { dedupHash: 'xyz', action: 'SKIP' },
      ],
    )
    expect(r.orphanDecisionHashes).toEqual(['xyz'])
    expect(r.filtered).toHaveLength(1)
  })

  it('linha sem decisão → CREATE_NEW default + conta como implicit', () => {
    const r = applyImportDecisions(
      [tx('a'), tx('b'), tx('c')],
      [{ dedupHash: 'a', action: 'CREATE_NEW' }],
    )
    expect(r.filtered).toHaveLength(3) // b e c implícitos
    expect(r.implicit).toBe(2)
    expect(r.skipped).toBe(0)
  })

  it('idempotente: aplicar 2x dá mesmo resultado', () => {
    const novas = [tx('a'), tx('b'), tx('c')]
    const decisions = [
      { dedupHash: 'a', action: 'SKIP' as const },
      { dedupHash: 'b', action: 'CREATE_NEW' as const },
      { dedupHash: 'c', action: 'CREATE_NEW' as const },
    ]
    const a = applyImportDecisions(novas, decisions)
    const b = applyImportDecisions(a.filtered, decisions)
    expect(a.filtered.length).toBe(2)
    expect(b.filtered.length).toBe(2)
  })
})

describe('importDecisionsSchema (zod)', () => {
  it('aceita actions válidas', () => {
    const r = importDecisionsSchema.safeParse([
      { dedupHash: 'abcd1234', action: 'SKIP' },
      { dedupHash: 'efgh5678', action: 'CREATE_NEW' },
    ])
    expect(r.success).toBe(true)
  })

  it('rejeita action desconhecida', () => {
    const r = importDecisionsSchema.safeParse([
      { dedupHash: 'abcd1234', action: 'WHATEVER' },
    ])
    expect(r.success).toBe(false)
  })

  it('cobre o enum completo', () => {
    expect(IMPORT_DECISION_ACTIONS).toEqual([
      'CREATE_NEW',
      'SKIP',
      'REPLACE_MANUAL',
      'CONCILIATE_PAYABLE',
    ])
  })

  it('limite 2000 decisões', () => {
    const ok = importDecisionsSchema.safeParse(
      Array.from({ length: 2000 }, (_, i) => ({
        dedupHash: `h${i.toString().padStart(7, '0')}`,
        action: 'CREATE_NEW' as const,
      })),
    )
    expect(ok.success).toBe(true)
    const tooMany = importDecisionsSchema.safeParse(
      Array.from({ length: 2001 }, (_, i) => ({
        dedupHash: `h${i.toString().padStart(7, '0')}`,
        action: 'CREATE_NEW' as const,
      })),
    )
    expect(tooMany.success).toBe(false)
  })
})

describe('cenário Yussef — consórcio 09/07 desmarcado', () => {
  it('linha desmarcada não vira tx (resolve raiz)', () => {
    // 6 tx do Banrisul de hoje, 1 é o consórcio futuro
    const novas = [
      tx('crd-stone-antecip'),
      tx('crd-stone-debito'),
      tx('crd-vero-banricard'),
      tx('crd-banricompras'),
      tx('crd-banri-vista'),
      tx('deb-consorcio-09jul'),
    ]
    const decisions = [
      { dedupHash: 'crd-stone-antecip', action: 'CREATE_NEW' as const },
      { dedupHash: 'crd-stone-debito', action: 'CREATE_NEW' as const },
      { dedupHash: 'crd-vero-banricard', action: 'CREATE_NEW' as const },
      { dedupHash: 'crd-banricompras', action: 'CREATE_NEW' as const },
      { dedupHash: 'crd-banri-vista', action: 'CREATE_NEW' as const },
      { dedupHash: 'deb-consorcio-09jul', action: 'SKIP' as const }, // <-- desmarcou
    ]
    const r = applyImportDecisions(novas, decisions)
    expect(r.filtered.map((t) => t.dedupHash)).not.toContain('deb-consorcio-09jul')
    expect(r.filtered).toHaveLength(5)
    expect(r.skipped).toBe(1)
  })
})
