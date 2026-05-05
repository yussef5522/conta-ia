import { describe, it, expect } from 'vitest'
import { extractRequestContext } from '../lib/audit'
import type { NextRequest } from 'next/server'

function mockRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get(key: string): string | null {
        return headers[key.toLowerCase()] ?? null
      },
    },
  } as NextRequest
}

describe('extractRequestContext', () => {
  it('request undefined → tudo null', () => {
    const result = extractRequestContext(undefined)
    expect(result).toEqual({ ipAddress: null, userAgent: null })
  })

  it('captura IP de x-forwarded-for', () => {
    const req = mockRequest({ 'x-forwarded-for': '192.168.1.1' })
    expect(extractRequestContext(req).ipAddress).toBe('192.168.1.1')
  })

  it('x-forwarded-for múltiplos: pega o primeiro', () => {
    const req = mockRequest({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
    })
    expect(extractRequestContext(req).ipAddress).toBe('192.168.1.1')
  })

  it('x-real-ip se x-forwarded-for ausente', () => {
    const req = mockRequest({ 'x-real-ip': '10.0.0.1' })
    expect(extractRequestContext(req).ipAddress).toBe('10.0.0.1')
  })

  it('IP truncado em 45 chars (IPv6 max)', () => {
    const longIp = 'a'.repeat(60)
    const req = mockRequest({ 'x-forwarded-for': longIp })
    expect(extractRequestContext(req).ipAddress?.length).toBeLessThanOrEqual(45)
  })

  it('captura user-agent', () => {
    const req = mockRequest({ 'user-agent': 'Mozilla/5.0 (Test)' })
    expect(extractRequestContext(req).userAgent).toBe('Mozilla/5.0 (Test)')
  })

  it('user-agent truncado em 500', () => {
    const longUa = 'a'.repeat(600)
    const req = mockRequest({ 'user-agent': longUa })
    expect(extractRequestContext(req).userAgent?.length).toBeLessThanOrEqual(500)
  })

  it('sem headers: tudo null', () => {
    const req = mockRequest({})
    expect(extractRequestContext(req)).toEqual({
      ipAddress: null,
      userAgent: null,
    })
  })

  it('IPv6 funciona', () => {
    const req = mockRequest({ 'x-forwarded-for': '2001:db8::1' })
    expect(extractRequestContext(req).ipAddress).toBe('2001:db8::1')
  })

  it('trim em IPs com espaço', () => {
    const req = mockRequest({ 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' })
    expect(extractRequestContext(req).ipAddress).toBe('192.168.1.1')
  })
})
