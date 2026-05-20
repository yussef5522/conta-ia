// Sprint 2.1 — schemas Zod de endpoints de regras.

import { describe, it, expect } from 'vitest'
import {
  updateRegraSchema,
  listRegrasQuerySchema,
} from '@/lib/validations/regra'

describe('updateRegraSchema', () => {
  it('aceita patch parcial só com padrao', () => {
    const r = updateRegraSchema.safeParse({ padrao: 'NETFLIX' })
    expect(r.success).toBe(true)
  })

  it('aceita confianca decimal', () => {
    const r = updateRegraSchema.safeParse({ confianca: 0.85 })
    expect(r.success).toBe(true)
  })

  it('REJEITA confianca > 1', () => {
    const r = updateRegraSchema.safeParse({ confianca: 1.5 })
    expect(r.success).toBe(false)
  })

  it('REJEITA tipoMatch inválido', () => {
    const r = updateRegraSchema.safeParse({ tipoMatch: 'FUZZY' })
    expect(r.success).toBe(false)
  })

  it('REJEITA objeto vazio', () => {
    const r = updateRegraSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  it('REJEITA padrao com 1 char', () => {
    const r = updateRegraSchema.safeParse({ padrao: 'a' })
    expect(r.success).toBe(false)
  })

  it('REJEITA campos extras (strict)', () => {
    const r = updateRegraSchema.safeParse({
      padrao: 'NETFLIX',
      hacker: 'sim',
    })
    expect(r.success).toBe(false)
  })
})

describe('listRegrasQuerySchema', () => {
  it('defaults razoáveis', () => {
    const r = listRegrasQuerySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.page).toBe(1)
      expect(r.data.pageSize).toBe(10)
      expect(r.data.tipoMatch).toBe('ALL')
      expect(r.data.status).toBe('ALL')
    }
  })

  it('cap pageSize 50', () => {
    const r = listRegrasQuerySchema.safeParse({ pageSize: 200 })
    expect(r.success).toBe(false)
  })

  it('aceita ?status=PAUSED', () => {
    const r = listRegrasQuerySchema.safeParse({ status: 'PAUSED' })
    expect(r.success).toBe(true)
  })
})
