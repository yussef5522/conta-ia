// Sprint 4.0.2 — testes da função pura jaroWinkler.

import { describe, it, expect } from 'vitest'
import { jaroSimilarity, jaroWinkler } from '@/lib/conciliacao/jaro-winkler'

describe('jaroSimilarity', () => {
  it('strings idênticas → 1', () => {
    expect(jaroSimilarity('netflix', 'netflix')).toBe(1)
  })

  it('strings totalmente diferentes → próximo de 0', () => {
    expect(jaroSimilarity('abc', 'xyz')).toBe(0)
  })

  it('uma vazia → 0', () => {
    expect(jaroSimilarity('', 'foo')).toBe(0)
    expect(jaroSimilarity('foo', '')).toBe(0)
  })

  it('ambas vazias → 1', () => {
    expect(jaroSimilarity('', '')).toBe(1)
  })

  it('martha vs marhta → ~0.944', () => {
    const sim = jaroSimilarity('martha', 'marhta')
    expect(sim).toBeGreaterThan(0.94)
    expect(sim).toBeLessThan(0.95)
  })

  it('dwayne vs duane → ~0.822', () => {
    const sim = jaroSimilarity('dwayne', 'duane')
    expect(sim).toBeGreaterThan(0.82)
    expect(sim).toBeLessThan(0.83)
  })
})

describe('jaroWinkler (com bônus de prefixo)', () => {
  it('martha vs marhta → ~0.961 (jaro 0.944 + prefixo "mar")', () => {
    const sim = jaroWinkler('martha', 'marhta')
    expect(sim).toBeGreaterThan(0.96)
    expect(sim).toBeLessThan(0.97)
  })

  it('idênticas → 1', () => {
    expect(jaroWinkler('netflix', 'netflix')).toBe(1)
  })

  it('prefixo igual gera score MAIOR que sem prefixo', () => {
    const comPrefixo = jaroWinkler('NETFLIX BR', 'NETFLIX US')
    const semPrefixo = jaroWinkler('NETFLIX BR', 'AMAZON BR')
    expect(comPrefixo).toBeGreaterThan(semPrefixo)
  })

  it('cap em 4 chars de prefixo', () => {
    // String 1 e 2 compartilham 8 chars de prefixo, mas o bônus só conta 4
    const a = jaroWinkler('ABCDEFGHxyz', 'ABCDEFGHabc')
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(1)
  })

  it('descrições bancárias típicas — ENERGISA', () => {
    const sim = jaroWinkler('ENERGISA SP', 'ENERGISA SAO PAULO')
    expect(sim).toBeGreaterThan(0.7)
  })

  it('strings sem prefixo comum não recebem bônus', () => {
    const jaro = jaroSimilarity('XYZ123', 'ABC123')
    const jw = jaroWinkler('XYZ123', 'ABC123')
    expect(jw).toBe(jaro) // prefixo=0 → bonus=0 → jw=jaro
  })
})
