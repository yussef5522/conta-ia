// Sprint PDF-no-Import (09/08/2026) — Regra 1, FASE 4. Antes do fix o preview
// EXACT não expunha o `documento` do PDF → não dava pra persistir em
// counterpartyDocument (o que distingue os 2 "EMPRESTIMO" e as capitalizações).
// Este teste falha antes (exact[].documento === undefined) e passa depois.

import { describe, it, expect } from 'vitest'
import { buildEnrichmentPreview } from '../build-preview'
import type { ParsedBankStatement } from '@/lib/bank-statement-pdf/types'

const parsed: ParsedBankStatement = {
  header: { agencia: '0230', conta: '0605534106', titular: 'CACULA MIX' },
  period: null,
  lines: [
    { day: 6, historico: 'PIX ENVIADO', documento: '198074', amount: 1215, signed: -1215, counterpartyName: 'MARCOS ADRIEL LEAL KERNBAUM' },
  ],
}

describe('buildEnrichmentPreview — FASE 4: documento no EXACT', () => {
  it('expõe o documento do PDF pra persistir em counterpartyDocument', () => {
    const p = buildEnrichmentPreview(parsed, [
      {
        id: 't1',
        externalId: '198074',
        amount: 1215,
        date: new Date('2026-07-06T12:00:00Z'),
        description: 'PIX ENVIADO',
        type: 'DEBIT',
        counterpartyName: null,
        counterpartySource: null,
      },
    ])
    expect(p.exact).toHaveLength(1)
    expect(p.exact[0].proposedName).toBe('MARCOS ADRIEL LEAL KERNBAUM')
    expect(p.exact[0].documento).toBe('198074') // <- FASE 4
  })
})
