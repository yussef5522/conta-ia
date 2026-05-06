import { describe, it, expect } from 'vitest'
import {
  formatActionLabel,
  formatEntityLabel,
  formatFieldLabel,
  formatValue,
  ACTION_LABELS,
} from '../lib/audit-formatters'

describe('formatActionLabel', () => {
  it('retorna label conhecido', () => {
    const result = formatActionLabel('CREATE')
    expect(result.verb).toBe('Criou')
    expect(result.color).toBe('green')
  })

  it('fallback pra action desconhecida', () => {
    const result = formatActionLabel('UNKNOWN_ACTION')
    expect(result.verb).toBe('UNKNOWN_ACTION')
    expect(result.color).toBe('gray')
  })

  it('todas actions canônicas têm label', () => {
    const required = [
      'CREATE',
      'UPDATE',
      'DELETE',
      'ACTIVATE',
      'DEACTIVATE',
      'RESTORE_TEMPLATE',
    ]
    for (const action of required) {
      expect(ACTION_LABELS[action]).toBeDefined()
    }
  })
})

describe('formatEntityLabel', () => {
  it('Category → Categoria', () => {
    expect(formatEntityLabel('Category')).toBe('Categoria')
  })

  it('Transaction → Transação', () => {
    expect(formatEntityLabel('Transaction')).toBe('Transação')
  })

  it('fallback para entity desconhecida', () => {
    expect(formatEntityLabel('Unknown')).toBe('Unknown')
  })
})

describe('formatFieldLabel', () => {
  it('campos conhecidos traduzidos', () => {
    expect(formatFieldLabel('name')).toBe('Nome')
    expect(formatFieldLabel('amount')).toBe('Valor')
    expect(formatFieldLabel('competenceDate')).toBe('Data competência')
  })

  it('fallback para campo desconhecido', () => {
    expect(formatFieldLabel('foobar')).toBe('foobar')
  })
})

describe('formatValue', () => {
  it('null → (vazio)', () => {
    expect(formatValue(null)).toBe('(vazio)')
  })

  it('undefined → (vazio)', () => {
    expect(formatValue(undefined)).toBe('(vazio)')
  })

  it('boolean true → Sim', () => {
    expect(formatValue(true)).toBe('Sim')
  })

  it('boolean false → Não', () => {
    expect(formatValue(false)).toBe('Não')
  })

  it('number → string', () => {
    expect(formatValue(42)).toBe('42')
  })

  it('object → JSON string', () => {
    expect(formatValue({ x: 1 })).toBe('{"x":1}')
  })

  it('string → identidade', () => {
    expect(formatValue('hello')).toBe('hello')
  })
})
