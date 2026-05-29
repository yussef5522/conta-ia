// Sprint 4.0.5.c — valida manifest.json é JSON válido + tem campos PWA mínimos.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PWA manifest.json', () => {
  const raw = readFileSync(join(__dirname, '..', 'public', 'manifest.json'), 'utf-8')
  let manifest: Record<string, unknown> = {}

  it('é JSON válido', () => {
    expect(() => {
      manifest = JSON.parse(raw)
    }).not.toThrow()
  })

  it('tem campos PWA obrigatórios', () => {
    manifest = JSON.parse(raw)
    expect(manifest.name).toBeTypeOf('string')
    expect(manifest.short_name).toBeTypeOf('string')
    expect(manifest.start_url).toBeTypeOf('string')
    expect(manifest.display).toBeTypeOf('string')
    expect(manifest.theme_color).toBeTypeOf('string')
    expect(manifest.background_color).toBeTypeOf('string')
  })

  it('display é standalone (instalável)', () => {
    manifest = JSON.parse(raw)
    expect(manifest.display).toBe('standalone')
  })

  it('theme_color casa com brand CAIXAOS violet-600', () => {
    manifest = JSON.parse(raw)
    // Sprint Brand CAIXAOS (29/05/2026): #7c3aed = violet-600 Tailwind
    // (antes #6366F1 indigo-500). Bate com logo da nova identidade.
    expect(manifest.theme_color).toBe('#7c3aed')
  })

  it('lang pt-BR', () => {
    manifest = JSON.parse(raw)
    expect(manifest.lang).toBe('pt-BR')
  })

  it('start_url aponta pra rota válida', () => {
    manifest = JSON.parse(raw)
    expect(manifest.start_url).toMatch(/^\//)
  })

  it('icons array não-vazio', () => {
    manifest = JSON.parse(raw)
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect((manifest.icons as unknown[]).length).toBeGreaterThan(0)
  })

  it('icon.svg existe', () => {
    expect(() =>
      readFileSync(join(__dirname, '..', 'public', 'icon.svg'), 'utf-8'),
    ).not.toThrow()
  })
})
