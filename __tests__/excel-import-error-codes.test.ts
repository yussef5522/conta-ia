// Sprint 5.0.2.3 — Tests pra errorInfo + codeFromStatus.

import { describe, it, expect } from 'vitest'
import {
  errorInfo,
  codeFromStatus,
} from '@/lib/excel-import/error-codes'

describe('errorInfo — códigos conhecidos', () => {
  it('FILE_TOO_LARGE retorna título + descrição + retryable=false', () => {
    const info = errorInfo('FILE_TOO_LARGE')
    expect(info.title).toContain('grande')
    expect(info.description).toContain('10MB')
    expect(info.retryable).toBe(false)
  })

  it('NETWORK_ERROR é retryable', () => {
    expect(errorInfo('NETWORK_ERROR').retryable).toBe(true)
  })

  it('INTERNAL_ERROR é retryable', () => {
    expect(errorInfo('INTERNAL_ERROR').retryable).toBe(true)
  })

  it('FILE_TYPE_INVALID NÃO é retryable', () => {
    expect(errorInfo('FILE_TYPE_INVALID').retryable).toBe(false)
  })

  it('TIMEOUT é retryable', () => {
    expect(errorInfo('TIMEOUT').retryable).toBe(true)
  })

  it('Todas as descrições estão em PT-BR (heurística: sem strings inglês comuns)', () => {
    const codes = [
      'FILE_TOO_LARGE',
      'FILE_TYPE_INVALID',
      'PARSE_FAILED',
      'TOO_MANY_ROWS',
      'NETWORK_ERROR',
      'INTERNAL_ERROR',
    ] as const
    for (const c of codes) {
      const info = errorInfo(c)
      // PT-BR check leve: nenhuma das mensagens contém estas strings de erro EN comuns
      expect(info.description.toLowerCase()).not.toContain('failed to')
      expect(info.description.toLowerCase()).not.toContain('error occurred')
    }
  })
})

describe('errorInfo — fallback', () => {
  it('Código desconhecido → INTERNAL_ERROR', () => {
    const info = errorInfo('TOTALMENTE_INVENTADO')
    expect(info.title).toContain('inesperado')
  })

  it('null/undefined → INTERNAL_ERROR', () => {
    expect(errorInfo(null).title).toContain('inesperado')
    expect(errorInfo(undefined).title).toContain('inesperado')
  })

  it('String vazia → INTERNAL_ERROR', () => {
    expect(errorInfo('').title).toContain('inesperado')
  })
})

describe('codeFromStatus', () => {
  it.each([
    [401, 'NOT_AUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'BATCH_NOT_FOUND'],
    [409, 'BATCH_ALREADY_CONFIRMED'],
    [413, 'FILE_TOO_LARGE'],
    [415, 'FILE_TYPE_INVALID'],
    [422, 'PARSE_FAILED'],
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [504, 'INTERNAL_ERROR'],
  ])('status %i → %s', (status, expected) => {
    expect(codeFromStatus(status)).toBe(expected)
  })

  it('status 200 (não-erro) → INTERNAL_ERROR (fallback)', () => {
    expect(codeFromStatus(200)).toBe('INTERNAL_ERROR')
  })
})
