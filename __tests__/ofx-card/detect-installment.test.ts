// Sprint PF Fatia 3 — detectInstallment puros.

import { describe, expect, test } from 'vitest'
import { detectInstallment } from '@/lib/ofx-card/detect-installment'

describe('detectInstallment — formato Nubank (- Parcela X/Y)', () => {
  test('"Airbnb * Hm9z23za5s - Parcela 5/6" detecta 5/6', () => {
    const r = detectInstallment('Airbnb * Hm9z23za5s - Parcela 5/6')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(5)
    expect(r.installmentTotal).toBe(6)
    expect(r.baseDescription).toBe('Airbnb * Hm9z23za5s')
  })

  test('"Laghetto Golden - Parcela 4/9"', () => {
    const r = detectInstallment('Laghetto Golden - Parcela 4/9')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(4)
    expect(r.installmentTotal).toBe(9)
    expect(r.baseDescription).toBe('Laghetto Golden')
  })

  test('"Mercadolivre*Rgs - Parcela 5/10" (sem espaço antes do *)', () => {
    const r = detectInstallment('Mercadolivre*Rgs - Parcela 5/10')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(5)
    expect(r.installmentTotal).toBe(10)
    expect(r.baseDescription).toBe('Mercadolivre*Rgs')
  })
})

describe('detectInstallment — outras variações', () => {
  test('"X Parcela 2/3" (sem hífen)', () => {
    const r = detectInstallment('X Parcela 2/3')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(2)
  })

  test('"Compra (3/12)" sufixo entre parênteses', () => {
    const r = detectInstallment('Compra (3/12)')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(3)
    expect(r.installmentTotal).toBe(12)
  })

  test('"Parc. 1/4" abreviado', () => {
    const r = detectInstallment('Loja X Parc. 1/4')
    expect(r.isInstallment).toBe(true)
    expect(r.installmentNumber).toBe(1)
    expect(r.installmentTotal).toBe(4)
  })
})

describe('detectInstallment — false positives evitados', () => {
  test('"5/6 estrelas" NÃO é parcela (sem palavra "Parcela")', () => {
    const r = detectInstallment('Avaliação 5/6 estrelas')
    expect(r.isInstallment).toBe(false)
  })

  test('"19/06/2026" NÃO é parcela', () => {
    const r = detectInstallment('Restaurante 19/06/2026')
    expect(r.isInstallment).toBe(false)
  })

  test('description vazio → false', () => {
    expect(detectInstallment('').isInstallment).toBe(false)
  })

  test('"Parcela 0/3" inválido (num < 1) → false', () => {
    const r = detectInstallment('X Parcela 0/3')
    expect(r.isInstallment).toBe(false)
  })

  test('"Parcela 7/6" inválido (num > total) → false', () => {
    const r = detectInstallment('X Parcela 7/6')
    expect(r.isInstallment).toBe(false)
  })

  test('"Parcela 5/100" muito grande → false', () => {
    const r = detectInstallment('X Parcela 5/100')
    expect(r.isInstallment).toBe(false)
  })
})
