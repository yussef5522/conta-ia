// Sprint 5.0.3.0b — Tests dos saved views (4 views hardcoded).

import { describe, it, expect } from 'vitest'
import {
  SAVED_VIEWS,
  SAVED_VIEW_IDS,
  isValidSavedViewId,
  getSavedView,
  findActiveSavedView,
} from '@/lib/contas-pagar/saved-views'

// Quarta-feira 27/05/2026 12:00 UTC — datas determinísticas pra testes
const NOW = new Date('2026-05-27T12:00:00.000Z')

describe('SAVED_VIEWS — estrutura', () => {
  it('tem exatamente 4 views', () => {
    expect(SAVED_VIEWS).toHaveLength(4)
  })

  it('IDs estáveis: todas, vencidas, a-vencer-7d, pagas-mes', () => {
    expect(SAVED_VIEW_IDS).toEqual([
      'todas',
      'vencidas',
      'a-vencer-7d',
      'pagas-mes',
    ])
  })

  it('todas as views têm name não-vazio', () => {
    for (const v of SAVED_VIEWS) {
      expect(v.name.length).toBeGreaterThan(0)
    }
  })
})

describe('View "Todas"', () => {
  it('filtros: status=TODOS, sem período, sem vencidas, sort dueDate desc', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    expect(f.status).toBe('TODOS')
    expect(f.vencidasOnly).toBe(false)
    expect(f.dataDe).toBe('')
    expect(f.dataAte).toBe('')
    expect(f.sortBy).toBe('dueDate')
    expect(f.sortDir).toBe('desc')
  })
})

describe('View "Vencidas"', () => {
  it('filtros: status=PENDING + vencidasOnly=true + sort asc (antiga primeiro)', () => {
    const f = getSavedView('vencidas').buildFilters(NOW)
    expect(f.status).toBe('PENDING')
    expect(f.vencidasOnly).toBe(true)
    expect(f.sortBy).toBe('dueDate')
    expect(f.sortDir).toBe('asc')
  })
})

describe('View "A vencer 7d"', () => {
  it('período = hoje até +7d em dueDate', () => {
    const f = getSavedView('a-vencer-7d').buildFilters(NOW)
    expect(f.dataDe).toBe('2026-05-27') // hoje
    expect(f.dataAte).toBe('2026-06-03') // +7 dias
    expect(f.status).toBe('PENDING')
    expect(f.dataField).toBe('dueDate')
  })

  it('é determinístico com a mesma data', () => {
    const f1 = getSavedView('a-vencer-7d').buildFilters(NOW)
    const f2 = getSavedView('a-vencer-7d').buildFilters(NOW)
    expect(f1).toEqual(f2)
  })

  it('atravessa virada de mês corretamente', () => {
    // 28/02/2026 → +7d = 07/03/2026
    const f = getSavedView('a-vencer-7d').buildFilters(
      new Date('2026-02-28T12:00:00.000Z'),
    )
    expect(f.dataDe).toBe('2026-02-28')
    expect(f.dataAte).toBe('2026-03-07')
  })
})

describe('View "Pagas no mês"', () => {
  it('período = início/fim do mês corrente, dataField=paymentDate', () => {
    const f = getSavedView('pagas-mes').buildFilters(NOW)
    expect(f.dataDe).toBe('2026-05-01')
    expect(f.dataAte).toBe('2026-05-31')
    expect(f.status).toBe('RECONCILED')
    expect(f.dataField).toBe('paymentDate')
    expect(f.sortBy).toBe('paymentDate')
    expect(f.sortDir).toBe('desc')
  })

  it('fevereiro NÃO bissexto termina dia 28', () => {
    const f = getSavedView('pagas-mes').buildFilters(
      new Date('2025-02-15T12:00:00.000Z'),
    )
    expect(f.dataAte).toBe('2025-02-28')
  })

  it('fevereiro bissexto termina dia 29', () => {
    const f = getSavedView('pagas-mes').buildFilters(
      new Date('2024-02-15T12:00:00.000Z'),
    )
    expect(f.dataAte).toBe('2024-02-29')
  })

  it('janeiro: dataDe=01/01, dataAte=31/01', () => {
    const f = getSavedView('pagas-mes').buildFilters(
      new Date('2026-01-15T12:00:00.000Z'),
    )
    expect(f.dataDe).toBe('2026-01-01')
    expect(f.dataAte).toBe('2026-01-31')
  })

  it('dezembro: dataDe=01/12, dataAte=31/12', () => {
    const f = getSavedView('pagas-mes').buildFilters(
      new Date('2026-12-15T12:00:00.000Z'),
    )
    expect(f.dataDe).toBe('2026-12-01')
    expect(f.dataAte).toBe('2026-12-31')
  })
})

describe('isValidSavedViewId', () => {
  it.each(['todas', 'vencidas', 'a-vencer-7d', 'pagas-mes'])(
    'aceita %s',
    (id) => {
      expect(isValidSavedViewId(id)).toBe(true)
    },
  )

  it.each(['Todas', 'invalid', '', 'nova-view', null])(
    'rejeita %s',
    (id) => {
      expect(isValidSavedViewId(id as string | null)).toBe(false)
    },
  )
})

describe('findActiveSavedView', () => {
  it('state idêntico ao da view "Todas" → "todas"', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    expect(findActiveSavedView(f, NOW)).toBe('todas')
  })

  it('state com vencidasOnly=true e PENDING → "vencidas"', () => {
    const f = getSavedView('vencidas').buildFilters(NOW)
    expect(findActiveSavedView(f, NOW)).toBe('vencidas')
  })

  it('state custom (filtro manual) → null', () => {
    // Status PENDING mas dataDe="2026-01-01" — não bate nenhuma view
    expect(
      findActiveSavedView(
        {
          q: '',
          dataDe: '2026-01-01',
          dataAte: '2026-01-31',
          status: 'PENDING',
          vencidasOnly: false,
          dataField: 'dueDate',
        },
        NOW,
      ),
    ).toBeNull()
  })

  it('ignora q (busca textual) na detecção', () => {
    const f = { ...getSavedView('todas').buildFilters(NOW), q: 'GESTRA' }
    expect(findActiveSavedView(f, NOW)).toBe('todas')
  })

  it('aceita dataField undefined como dueDate (default)', () => {
    const f = getSavedView('todas').buildFilters(NOW)
    const { dataField: _dataField, ...withoutDataField } = f
    void _dataField
    expect(findActiveSavedView(withoutDataField, NOW)).toBe('todas')
  })
})
