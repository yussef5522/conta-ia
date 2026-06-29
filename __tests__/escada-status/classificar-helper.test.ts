// Sprint Escada-Status (28/06/2026) — F1: montarUpdateClassificacaoManual
// agora sobe status pra RECONCILED quando recebe categoryId, e PENDING
// quando recebe null. Sem isso, PATCH /api/transacoes/[id] e /lote deixavam
// tx em estado invertido (categoryId preenchido + status=PENDING).

import { describe, it, expect } from 'vitest'
import { montarUpdateClassificacaoManual } from '@/lib/transacoes/classificar'
import { statusFromCategoryId } from '@/lib/transacoes/needs-review'

describe('montarUpdateClassificacaoManual — escada completa', () => {
  it('categoryId preenchido → status RECONCILED', () => {
    const r = montarUpdateClassificacaoManual('cat_abc')
    expect(r.categoryId).toBe('cat_abc')
    expect(r.status).toBe('RECONCILED')
    expect(r.classificationSource).toBe('MANUAL')
  })

  it('categoryId null → status PENDING', () => {
    const r = montarUpdateClassificacaoManual(null)
    expect(r.categoryId).toBeNull()
    expect(r.status).toBe('PENDING')
    expect(r.classificationSource).toBe('MANUAL')
  })

  it('usa statusFromCategoryId (fonte única)', () => {
    expect(montarUpdateClassificacaoManual('x').status).toBe(
      statusFromCategoryId('x'),
    )
    expect(montarUpdateClassificacaoManual(null).status).toBe(
      statusFromCategoryId(null),
    )
  })

  it('shape completo inclui status', () => {
    const r = montarUpdateClassificacaoManual('cat_xyz')
    expect(Object.keys(r).sort()).toEqual(
      ['aiConfidence', 'categoryId', 'classificationSource', 'classifiedByRuleId', 'status'].sort(),
    )
  })

  it('limpa campos de IA mesmo com categoria preenchida', () => {
    const r = montarUpdateClassificacaoManual('cat_abc')
    expect(r.aiConfidence).toBeNull()
    expect(r.classifiedByRuleId).toBeNull()
  })
})

describe('Defensivo: callers do helper estão em endpoints conhecidos', () => {
  // Esta sprint mudou o shape do helper (incluiu status). Quem usa precisa
  // continuar passando o objeto inteiro pro Prisma — não pode desestruturar
  // sem incluir status, ou o fix se perde.
  it('PATCH /api/transacoes/[id] usa o helper', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const code = fs.readFileSync(
      path.join(__dirname, '..', '..', 'app/api/transacoes/[id]/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/montarUpdateClassificacaoManual/)
  })

  it('PATCH /api/transacoes/lote usa o helper', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const code = fs.readFileSync(
      path.join(__dirname, '..', '..', 'app/api/transacoes/lote/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/montarUpdateClassificacaoManual/)
  })
})
