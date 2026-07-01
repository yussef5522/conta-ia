// Sprint Category-Combobox PJ Batch (30/06/2026) — helper createCategoryForPJ.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCategoryForPJ,
  derivePjCategoryType,
} from '@/lib/transacoes/on-create-category'

describe('derivePjCategoryType', () => {
  it('DEBIT → EXPENSE', () => {
    expect(derivePjCategoryType('DEBIT')).toBe('EXPENSE')
  })
  it('CREDIT → INCOME', () => {
    expect(derivePjCategoryType('CREDIT')).toBe('INCOME')
  })
  it('TRANSFER → TRANSFER', () => {
    expect(derivePjCategoryType('TRANSFER')).toBe('TRANSFER')
  })
  it('desconhecido → EXPENSE (default seguro)', () => {
    expect(derivePjCategoryType('WHATEVER')).toBe('EXPENSE')
  })
})

describe('createCategoryForPJ', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('retorna null se nome vazio', async () => {
    const r = await createCategoryForPJ('emp-1', '', 'EXPENSE')
    expect(r).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('POSTa pra /api/empresas/[id]/categorias com name+type', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cat-1',
        name: 'Nova Cat',
        color: '#123',
        type: 'EXPENSE',
        dreGroup: 'OUTRAS_DESPESAS',
      }),
    })
    const r = await createCategoryForPJ('emp-1', ' Nova Cat ', 'EXPENSE')
    expect(mockFetch).toHaveBeenCalledOnce()
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/api/empresas/emp-1/categorias')
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(call[1].body as string)
    expect(body).toEqual({ name: 'Nova Cat', type: 'EXPENSE' })
    expect(r).toEqual({
      id: 'cat-1',
      name: 'Nova Cat',
      color: '#123',
      type: 'EXPENSE',
      dreGroup: 'OUTRAS_DESPESAS',
    })
  })

  it('retorna null se 4xx/5xx', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
    })
    const r = await createCategoryForPJ('emp-1', 'X', 'INCOME')
    expect(r).toBeNull()
  })

  it('retorna null em erro de rede', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    )
    const r = await createCategoryForPJ('emp-1', 'X', 'INCOME')
    expect(r).toBeNull()
  })

  it('aceita shape com wrap { categoria }', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ categoria: { id: 'cat-2', name: 'B' } }),
    })
    const r = await createCategoryForPJ('emp-1', 'B', 'INCOME')
    expect(r).toEqual({
      id: 'cat-2',
      name: 'B',
      color: null,
      type: null,
      dreGroup: null,
    })
  })

  it('trima whitespace do nome', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'x', name: 'Trimmed' }),
    })
    await createCategoryForPJ('emp-1', '   Trimmed   ', 'EXPENSE')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.name).toBe('Trimmed')
  })
})
