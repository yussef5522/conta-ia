import { describe, it, expect } from 'vitest'
import {
  canHardDelete,
  getHardDeleteDisabledReason,
} from '../lib/categories/delete-rules'

describe('canHardDelete (regras de hard delete)', () => {
  it('categoria custom sem uso → pode excluir', () => {
    const r = canHardDelete({
      isSystemDefault: false,
      transactionCount: 0,
      childrenCount: 0,
    })
    expect(r).toBe(true)
  })

  it('isSystemDefault=true → bloqueia', () => {
    const r = canHardDelete({
      isSystemDefault: true,
      transactionCount: 0,
      childrenCount: 0,
    })
    expect(r).toBe(false)
  })

  it('com 1 transação vinculada → bloqueia', () => {
    const r = canHardDelete({
      isSystemDefault: false,
      transactionCount: 1,
      childrenCount: 0,
    })
    expect(r).toBe(false)
  })

  it('com várias transações → bloqueia', () => {
    const r = canHardDelete({
      isSystemDefault: false,
      transactionCount: 270,
      childrenCount: 0,
    })
    expect(r).toBe(false)
  })

  it('com 1 filho → bloqueia', () => {
    const r = canHardDelete({
      isSystemDefault: false,
      transactionCount: 0,
      childrenCount: 1,
    })
    expect(r).toBe(false)
  })

  it('com vários filhos → bloqueia', () => {
    const r = canHardDelete({
      isSystemDefault: false,
      transactionCount: 0,
      childrenCount: 5,
    })
    expect(r).toBe(false)
  })

  it('múltiplos bloqueios simultâneos → bloqueia (qualquer um basta)', () => {
    const r = canHardDelete({
      isSystemDefault: true,
      transactionCount: 10,
      childrenCount: 3,
    })
    expect(r).toBe(false)
  })
})

describe('getHardDeleteDisabledReason (mensagem do tooltip)', () => {
  it('categoria livre → null (pode excluir)', () => {
    expect(
      getHardDeleteDisabledReason({
        isSystemDefault: false,
        transactionCount: 0,
        childrenCount: 0,
      }),
    ).toBeNull()
  })

  it('isSystemDefault → mensagem padrão', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: true,
      transactionCount: 0,
      childrenCount: 0,
    })
    expect(msg).toMatch(/template padrão/i)
    expect(msg).toMatch(/Desativar/)
  })

  it('1 transação → singular "transação vinculada"', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: false,
      transactionCount: 1,
      childrenCount: 0,
    })
    expect(msg).toMatch(/^1 transação vinculada/)
    expect(msg).toMatch(/Desativar/)
  })

  it('várias transações → plural "transações vinculadas"', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: false,
      transactionCount: 5,
      childrenCount: 0,
    })
    expect(msg).toMatch(/^5 transações vinculadas/)
  })

  it('1 filho → singular "subcategoria"', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: false,
      transactionCount: 0,
      childrenCount: 1,
    })
    expect(msg).toMatch(/^1 subcategoria/)
    expect(msg).toMatch(/exclua os filhos/)
  })

  it('vários filhos → plural "subcategorias"', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: false,
      transactionCount: 0,
      childrenCount: 3,
    })
    expect(msg).toMatch(/^3 subcategorias/)
  })

  it('ordem de prioridade: isSystemDefault > transactions > children', () => {
    // isSystemDefault tem prioridade mesmo quando há outras razões
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: true,
      transactionCount: 5,
      childrenCount: 2,
    })
    expect(msg).toMatch(/template padrão/i)
  })

  it('transactions tem prioridade sobre children quando não é template', () => {
    const msg = getHardDeleteDisabledReason({
      isSystemDefault: false,
      transactionCount: 5,
      childrenCount: 2,
    })
    expect(msg).toMatch(/^5 transações/)
  })
})
