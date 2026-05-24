// Sprint 4.0.4 — testes da função pura shouldRunForFrequency.

import { describe, it, expect } from 'vitest'
import { __test } from '@/lib/email/alerts-job'

const { shouldRunForFrequency } = __test

// 2026-05-25 = segunda (1 em getUTCDay)
// 2026-05-26 = terça
// 2026-05-30 = sábado (6)
// 2026-05-31 = domingo (0)
const monday = new Date('2026-05-25T08:00:00Z')
const tuesday = new Date('2026-05-26T08:00:00Z')
const saturday = new Date('2026-05-30T08:00:00Z')
const sunday = new Date('2026-05-31T08:00:00Z')

describe('shouldRunForFrequency — DAILY', () => {
  it('roda dias úteis (segunda)', () => {
    expect(shouldRunForFrequency('DAILY', monday, false)).toBe(true)
  })
  it('roda dias úteis (terça)', () => {
    expect(shouldRunForFrequency('DAILY', tuesday, false)).toBe(true)
  })
  it('NÃO roda sábado', () => {
    expect(shouldRunForFrequency('DAILY', saturday, false)).toBe(false)
  })
  it('NÃO roda domingo', () => {
    expect(shouldRunForFrequency('DAILY', sunday, false)).toBe(false)
  })
})

describe('shouldRunForFrequency — WEEKLY', () => {
  it('roda só na segunda', () => {
    expect(shouldRunForFrequency('WEEKLY', monday, false)).toBe(true)
  })
  it('NÃO roda terça', () => {
    expect(shouldRunForFrequency('WEEKLY', tuesday, false)).toBe(false)
  })
  it('NÃO roda fim de semana', () => {
    expect(shouldRunForFrequency('WEEKLY', saturday, false)).toBe(false)
    expect(shouldRunForFrequency('WEEKLY', sunday, false)).toBe(false)
  })
})

describe('shouldRunForFrequency — NONE', () => {
  it('NUNCA roda (mesmo em dia útil)', () => {
    expect(shouldRunForFrequency('NONE', monday, false)).toBe(false)
    expect(shouldRunForFrequency('NONE', tuesday, false)).toBe(false)
  })
  it('force=true sobrescreve NONE (decisão consciente do endpoint manual)', () => {
    expect(shouldRunForFrequency('NONE', monday, true)).toBe(true)
  })
})

describe('shouldRunForFrequency — force', () => {
  it('force=true sempre roda', () => {
    expect(shouldRunForFrequency('DAILY', saturday, true)).toBe(true)
    expect(shouldRunForFrequency('WEEKLY', tuesday, true)).toBe(true)
  })
})

describe('shouldRunForFrequency — frequency desconhecida', () => {
  it('valor inválido NÃO roda (seguro)', () => {
    expect(shouldRunForFrequency('INVALID', monday, false)).toBe(false)
    expect(shouldRunForFrequency('', monday, false)).toBe(false)
  })
})
