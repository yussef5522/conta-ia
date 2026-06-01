// Sprint Gestão de Conta — generate-temp-password puro

import { describe, expect, test } from 'vitest'
import { generateTempPassword } from '@/lib/admin-clientes/generate-temp-password'

describe('generateTempPassword', () => {
  test('default 16 chars', () => {
    expect(generateTempPassword().length).toBe(16)
  })

  test('respeita length custom', () => {
    expect(generateTempPassword(20).length).toBe(20)
  })

  test('rejeita length < 12', () => {
    expect(() => generateTempPassword(8)).toThrow()
  })

  test('contém pelo menos 1 uppercase, 1 lowercase, 1 digit, 1 símbolo', () => {
    // Roda 50 vezes pra eliminar flutuação aleatória
    for (let i = 0; i < 50; i++) {
      const p = generateTempPassword(16)
      expect(/[A-Z]/.test(p)).toBe(true)
      expect(/[a-z]/.test(p)).toBe(true)
      expect(/[0-9]/.test(p)).toBe(true)
      expect(/[!@#$%&*+\-=?]/.test(p)).toBe(true)
    }
  })

  test('não contém chars confusos (I, O, l, 0, 1)', () => {
    // (l minúsculo e 1 são confusos visualmente — não estão no alfabeto)
    for (let i = 0; i < 30; i++) {
      const p = generateTempPassword()
      expect(p.includes('I')).toBe(false)
      expect(p.includes('O')).toBe(false)
      expect(p.includes('l')).toBe(false)
      expect(p.includes('0')).toBe(false)
      expect(p.includes('1')).toBe(false)
    }
  })

  test('senhas consecutivas são diferentes (entropia alta)', () => {
    const set = new Set<string>()
    for (let i = 0; i < 100; i++) set.add(generateTempPassword())
    expect(set.size).toBe(100)
  })

  test('passa o critério mínimo do checkPasswordStrength (8+ chars)', () => {
    // Garante que a temp password atende o padrão mínimo do app
    for (let i = 0; i < 20; i++) {
      expect(generateTempPassword(16).length).toBeGreaterThanOrEqual(8)
    }
  })
})
