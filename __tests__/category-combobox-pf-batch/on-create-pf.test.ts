// Sprint Category-Combobox PF Batch (30/06/2026) — helper createCategoryForPF.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCategoryForPF,
  derivePfCategoryType,
} from '@/lib/transacoes/on-create-category'

describe('derivePfCategoryType', () => {
  it('CREDIT → INCOME', () => {
    expect(derivePfCategoryType('CREDIT')).toBe('INCOME')
  })
  it('DEBIT → EXPENSE', () => {
    expect(derivePfCategoryType('DEBIT')).toBe('EXPENSE')
  })
  it('desconhecido → EXPENSE (default seguro)', () => {
    expect(derivePfCategoryType('WHATEVER')).toBe('EXPENSE')
  })
})

describe('createCategoryForPF', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('retorna null se nome vazio', async () => {
    const r = await createCategoryForPF('profile-1', '', 'EXPENSE')
    expect(r).toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('POSTa pra /api/perfis/[id]/categorias com name+type', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    // Endpoint retorna { category }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        category: {
          id: 'pcat-1',
          name: 'Alimentação',
          color: '#f59e0b',
          type: 'EXPENSE',
        },
      }),
    })
    const r = await createCategoryForPF('profile-1', ' Alimentação ', 'EXPENSE')
    expect(mockFetch).toHaveBeenCalledOnce()
    const call = mockFetch.mock.calls[0]
    expect(call[0]).toBe('/api/perfis/profile-1/categorias')
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(call[1].body as string)
    expect(body).toEqual({ name: 'Alimentação', type: 'EXPENSE' })
    expect(r).toEqual({
      id: 'pcat-1',
      name: 'Alimentação',
      color: '#f59e0b',
      type: 'EXPENSE',
      // PersonalCategory nunca tem dreGroup (PJ-only).
      dreGroup: null,
    })
  })

  it('INCOME também funciona', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ category: { id: 'p2', name: 'Salário', type: 'INCOME' } }),
    })
    await createCategoryForPF('profile-1', 'Salário', 'INCOME')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.type).toBe('INCOME')
  })

  it('retorna null se 4xx/5xx', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 400,
    })
    const r = await createCategoryForPF('profile-1', 'X', 'INCOME')
    expect(r).toBeNull()
  })

  it('retorna null em erro de rede', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network'),
    )
    const r = await createCategoryForPF('profile-1', 'X', 'INCOME')
    expect(r).toBeNull()
  })

  it('aceita retorno direto (sem wrap)', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'p3', name: 'Direto', type: 'EXPENSE' }),
    })
    const r = await createCategoryForPF('profile-1', 'Direto', 'EXPENSE')
    expect(r).toEqual({
      id: 'p3',
      name: 'Direto',
      color: null,
      type: 'EXPENSE',
      dreGroup: null,
    })
  })

  it('dreGroup sempre null pra PF (não existe no schema)', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      // Mesmo se backend enviar dreGroup (não deveria), ignoramos
      json: async () => ({
        category: {
          id: 'p4',
          name: 'X',
          type: 'EXPENSE',
          dreGroup: 'DESPESAS_PESSOAL',
        },
      }),
    })
    const r = await createCategoryForPF('profile-1', 'X', 'EXPENSE')
    expect(r?.dreGroup).toBeNull()
  })

  it('trima whitespace do nome', async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ category: { id: 'x', name: 'Trimmed', type: 'INCOME' } }),
    })
    await createCategoryForPF('profile-1', '   Trimmed   ', 'INCOME')
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.name).toBe('Trimmed')
  })
})
