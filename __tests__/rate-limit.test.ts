// Sprint Rate-Limit-Login — backoff progressivo + reset + isolamento por chave.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  rateLimit,
  checkBackoff,
  recordFailure,
  resetAttempts,
  backoffDelayMsForFailures,
  loginBackoffKey,
  loginIpGuardKey,
  __clearAllForTests,
} from '@/lib/rate-limit'

beforeEach(() => __clearAllForTests())

describe('backoffDelayMsForFailures', () => {
  it('1-3 falhas: 0s (sem delay)', () => {
    expect(backoffDelayMsForFailures(1)).toBe(0)
    expect(backoffDelayMsForFailures(2)).toBe(0)
    expect(backoffDelayMsForFailures(3)).toBe(0)
  })

  it('4ª falha: 30s', () => {
    expect(backoffDelayMsForFailures(4)).toBe(30_000)
  })

  it('5ª falha: 60s', () => {
    expect(backoffDelayMsForFailures(5)).toBe(60_000)
  })

  it('6ª falha: 180s (3min)', () => {
    expect(backoffDelayMsForFailures(6)).toBe(180_000)
  })

  it('7ª+ falhas: teto 300s (5min) — não cresce mais', () => {
    expect(backoffDelayMsForFailures(7)).toBe(300_000)
    expect(backoffDelayMsForFailures(10)).toBe(300_000)
    expect(backoffDelayMsForFailures(100)).toBe(300_000)
  })
})

describe('checkBackoff + recordFailure — fluxo progressivo', () => {
  const key = 'login:1.2.3.4:user@x.com'

  it('chave vazia (nunca falhou): allowed', () => {
    const r = checkBackoff(key)
    expect(r.allowed).toBe(true)
    expect(r.failures).toBe(0)
    expect(r.retryAfterMs).toBe(0)
  })

  it('1-3 falhas seguidas: continua allowed (sem delay)', () => {
    recordFailure(key)
    recordFailure(key)
    recordFailure(key)
    const r = checkBackoff(key)
    expect(r.allowed).toBe(true)
    expect(r.failures).toBe(3)
    expect(r.retryAfterMs).toBe(0)
  })

  it('4ª falha: ainda allowed na verificação seguinte SE passou 30s', () => {
    // grava 4 falhas (4ª causa delay)
    for (let i = 0; i < 4; i++) recordFailure(key)
    const blocked = checkBackoff(key) // exatamente após a 4ª
    expect(blocked.allowed).toBe(false)
    expect(blocked.failures).toBe(4)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(30_000)

    // Simula 30s passados (uso nowOverride)
    const futuro = Date.now() + 31_000
    const after = checkBackoff(key, undefined, futuro)
    expect(after.allowed).toBe(true)
  })

  it('5ª falha: 60s de espera', () => {
    for (let i = 0; i < 5; i++) recordFailure(key)
    const r = checkBackoff(key)
    expect(r.allowed).toBe(false)
    expect(r.failures).toBe(5)
    expect(r.retryAfterMs).toBeLessThanOrEqual(60_000)
    expect(r.retryAfterMs).toBeGreaterThan(50_000)
  })

  it('7ª+ falha: teto 5 min e não cresce além', () => {
    for (let i = 0; i < 7; i++) recordFailure(key)
    const sete = checkBackoff(key)
    expect(sete.retryAfterMs).toBeLessThanOrEqual(300_000)
    expect(sete.retryAfterMs).toBeGreaterThan(290_000)

    for (let i = 0; i < 5; i++) recordFailure(key) // total 12 falhas
    const doze = checkBackoff(key)
    expect(doze.retryAfterMs).toBeLessThanOrEqual(300_000)
    expect(doze.retryAfterMs).toBeGreaterThan(290_000) // ainda 5 min, não cresce
  })
})

describe('resetAttempts — login bem-sucedido zera contador', () => {
  it('reset após N falhas devolve allowed pristine', () => {
    const key = 'login:1.1.1.1:noura@x.com'
    for (let i = 0; i < 6; i++) recordFailure(key)
    const blocked = checkBackoff(key)
    expect(blocked.allowed).toBe(false)

    resetAttempts(key)

    const after = checkBackoff(key)
    expect(after.allowed).toBe(true)
    expect(after.failures).toBe(0)
  })

  it('reset em chave inexistente é no-op (não throwa)', () => {
    expect(() => resetAttempts('nunca-existiu')).not.toThrow()
  })
})

describe('isolamento de chaves — par (IP, email) NÃO vaza', () => {
  it('mesmo IP, emails diferentes: contadores independentes', () => {
    const yussefMesmoIp = loginBackoffKey('192.0.2.1', 'yussef@x.com')
    const nouraMesmoIp = loginBackoffKey('192.0.2.1', 'noura@x.com')

    for (let i = 0; i < 6; i++) recordFailure(yussefMesmoIp)
    expect(checkBackoff(yussefMesmoIp).allowed).toBe(false)
    expect(checkBackoff(nouraMesmoIp).allowed).toBe(true) // Noura intacta
  })

  it('mesmo email, IPs diferentes: contadores independentes', () => {
    const casaDeYussef = loginBackoffKey('203.0.113.5', 'yussef@x.com')
    const escritorioDeYussef = loginBackoffKey('198.51.100.7', 'yussef@x.com')

    for (let i = 0; i < 6; i++) recordFailure(casaDeYussef)
    expect(checkBackoff(casaDeYussef).allowed).toBe(false)
    expect(checkBackoff(escritorioDeYussef).allowed).toBe(true) // escritório intacto
  })

  it('case-insensitive na chave de email (yussef@X.com == yussef@x.com)', () => {
    const upper = loginBackoffKey('1.1.1.1', 'Yussef@X.com')
    const lower = loginBackoffKey('1.1.1.1', 'yussef@x.com')
    expect(upper).toBe(lower) // mesma chave canonica
  })

  it('email vazio vira _anon (não compartilha com login real)', () => {
    const vazio = loginBackoffKey('1.1.1.1', '')
    const real = loginBackoffKey('1.1.1.1', 'real@x.com')
    expect(vazio).not.toBe(real)
    expect(vazio).toContain('_anon')
  })
})

describe('rateLimit (hard limit) — guarda do IP', () => {
  it('limita 20 falhas em janela', () => {
    const key = loginIpGuardKey('192.0.2.50')
    let allowed = 0
    for (let i = 0; i < 25; i++) {
      const r = rateLimit(key, 20, 15 * 60_000)
      if (r.allowed) allowed += 1
    }
    expect(allowed).toBe(20)
  })

  it('IPs diferentes têm buckets isolados na guarda', () => {
    const k1 = loginIpGuardKey('1.1.1.1')
    const k2 = loginIpGuardKey('2.2.2.2')
    for (let i = 0; i < 20; i++) rateLimit(k1, 20, 15 * 60_000)
    expect(rateLimit(k1, 20, 15 * 60_000).allowed).toBe(false)
    expect(rateLimit(k2, 20, 15 * 60_000).allowed).toBe(true)
  })
})

describe('fail-open — política de segurança', () => {
  // Não dá pra forçar throw no Map facilmente, mas valida que funções
  // retornam shapes sensatos em condições normais (smoke da contract).
  it('checkBackoff retorna allowed=true pra chave nunca usada (fail-open natural)', () => {
    const r = checkBackoff('chave-fantasma')
    expect(r.allowed).toBe(true)
  })

  it('recordFailure não throwa mesmo em chamadas repetidas', () => {
    const key = 'login:x:y'
    expect(() => {
      for (let i = 0; i < 50; i++) recordFailure(key)
    }).not.toThrow()
  })
})
