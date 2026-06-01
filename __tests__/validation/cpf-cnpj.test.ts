// Sprint Asaas 3B — validação CPF/CNPJ Mod 11

import { describe, expect, test } from 'vitest'
import {
  isValidCnpj,
  isValidCpf,
  isValidCpfCnpj,
  onlyDigits,
} from '@/lib/validation/cpf-cnpj'

describe('onlyDigits', () => {
  test('remove tudo que não é dígito', () => {
    expect(onlyDigits('123.456.789-00')).toBe('12345678900')
    expect(onlyDigits('12.345.678/0001-90')).toBe('12345678000190')
    expect(onlyDigits('abc')).toBe('')
  })
})

describe('isValidCpf', () => {
  test('CPF válido (referência: 11144477735)', () => {
    expect(isValidCpf('11144477735')).toBe(true)
    expect(isValidCpf('111.444.777-35')).toBe(true) // com máscara
  })

  test('CPF inválido (DV errado)', () => {
    expect(isValidCpf('11144477700')).toBe(false)
    expect(isValidCpf('11144477710')).toBe(false)
  })

  test('CPF com 10 dígitos é inválido', () => {
    expect(isValidCpf('1234567890')).toBe(false)
  })

  test('CPF com 12 dígitos é inválido', () => {
    expect(isValidCpf('123456789012')).toBe(false)
  })

  test('rejeita sequências repetidas', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('22222222222')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })
})

describe('isValidCnpj', () => {
  test('CNPJ válido (referência: 11222333000181)', () => {
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true) // com máscara
  })

  test('CNPJ inválido (DV errado)', () => {
    expect(isValidCnpj('11222333000100')).toBe(false)
  })

  test('CNPJ com 13 dígitos é inválido', () => {
    expect(isValidCnpj('1122233300018')).toBe(false)
  })

  test('rejeita sequências repetidas', () => {
    expect(isValidCnpj('11111111111111')).toBe(false)
  })
})

describe('isValidCpfCnpj (auto-detecta pelo tamanho)', () => {
  test('11 dígitos → CPF', () => {
    expect(isValidCpfCnpj('11144477735')).toBe(true)
  })
  test('14 dígitos → CNPJ', () => {
    expect(isValidCpfCnpj('11222333000181')).toBe(true)
  })
  test('outros tamanhos → inválido', () => {
    expect(isValidCpfCnpj('1234567890')).toBe(false)
    expect(isValidCpfCnpj('123456789012')).toBe(false)
  })
})
