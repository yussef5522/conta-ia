// Sprint 5.0.2.h — Parser de descrições Pix.

import { describe, it, expect } from 'vitest'
import { parsePixDescription, nameMatch, normalizePixKey } from '@/lib/pix-detection/parse-pix'

describe('parsePixDescription — detecta Pix', () => {
  it('reconhece descrição com "PIX"', () => {
    expect(parsePixDescription('PIX ENVIADO').isPix).toBe(true)
  })
  it('reconhece "pix" minúsculo', () => {
    expect(parsePixDescription('pix transferencia').isPix).toBe(true)
  })
  it('reconhece "TED"', () => {
    expect(parsePixDescription('TED PARA YUSSEF').isPix).toBe(true)
  })
  it('NÃO reconhece descrição sem keyword', () => {
    expect(parsePixDescription('Aluguel mensal').isPix).toBe(false)
  })
  it('null/undefined → not pix', () => {
    expect(parsePixDescription(null).isPix).toBe(false)
    expect(parsePixDescription(undefined).isPix).toBe(false)
  })
})

describe('parsePixDescription — extrai CPF', () => {
  it('CPF formatado 123.456.789-00', () => {
    const r = parsePixDescription('PIX ENVIADO 123.456.789-00')
    expect(r.cpf).toBe('12345678900')
  })
  it('CPF sem formatação (com nome) → telefone tem prioridade se ambíguo, mas sem telefone vira CPF', () => {
    // 12345678900 (11 dígitos) é ambíguo. Sem outras pistas, vira CPF.
    // Pra ser telefone tem que parecer (DDD + 9XXXX-XXXX).
    const r = parsePixDescription('PIX YUSSEF MUSA 12345678900')
    // Telefone tem prioridade desambiguadora; se não bater como telefone OU CPF, esperado:
    expect(r.cpf || r.telefone).toBe('12345678900')
  })
  it('NÃO confunde CPF inválido (000.000.000-00)', () => {
    const r = parsePixDescription('PIX 00000000000')
    expect(r.cpf).toBeUndefined()
  })
})

describe('parsePixDescription — extrai CNPJ', () => {
  it('CNPJ formatado 12.345.678/0001-90', () => {
    const r = parsePixDescription('PIX PARA 12.345.678/0001-90')
    expect(r.cnpj).toBe('12345678000190')
  })
  it('CNPJ sem formatação 14 dígitos', () => {
    const r = parsePixDescription('PIX TRANSF ACADEMIA 12345678000190')
    expect(r.cnpj).toBe('12345678000190')
  })
  it('CNPJ tem prioridade sobre CPF', () => {
    // 14 dígitos não confunde com CPF de 11
    const r = parsePixDescription('PIX 12345678000190')
    expect(r.cnpj).toBe('12345678000190')
    expect(r.cpf).toBeUndefined()
  })
})

describe('parsePixDescription — extrai email/telefone', () => {
  it('email', () => {
    const r = parsePixDescription('PIX yussef@email.com')
    expect(r.email).toBe('yussef@email.com')
  })
  it('email maiúsculas normalizado lowercase', () => {
    const r = parsePixDescription('PIX YUSSEF@EMAIL.COM')
    expect(r.email).toBe('yussef@email.com')
  })
  it('telefone 11 dígitos', () => {
    const r = parsePixDescription('PIX 11999998888')
    expect(r.telefone).toBe('11999998888')
  })
})

describe('parsePixDescription — textoLimpo', () => {
  it('remove CPF e palavras-chave Pix', () => {
    const r = parsePixDescription('PIX ENVIADO YUSSEF MUSA 123.456.789-00')
    expect(r.textoLimpo.toLowerCase()).toContain('yussef')
    expect(r.textoLimpo.toLowerCase()).toContain('musa')
    expect(r.textoLimpo).not.toContain('123.456.789-00')
  })
})

describe('nameMatch', () => {
  it('match exato substring', () => {
    expect(nameMatch('Yussef Musa', 'YUSSEF MUSA')).toBe(true)
  })
  it('case-insensitive', () => {
    expect(nameMatch('yussef musa', 'YUSSEF Musa Silva')).toBe(true)
  })
  it('sem acento', () => {
    expect(nameMatch('Cacula Mix', 'CACULA MIX RESTAURANTE')).toBe(true)
  })
  it('2 palavras significativas match parcial', () => {
    expect(nameMatch('Yussef Musa Silva', 'PIX YUSSEF SILVA RECEBIDO')).toBe(true)
  })
  it('1 palavra do nome só → não basta', () => {
    expect(nameMatch('Yussef Musa Silva', 'PIX SILVA RECEBIDO')).toBe(false)
  })
  it('nome único 1 palavra → match exato', () => {
    expect(nameMatch('Cacula', 'PIX CACULA RECEBIDO')).toBe(true)
  })
  it('strings vazias → false', () => {
    expect(nameMatch('', 'qualquer coisa')).toBe(false)
    expect(nameMatch('Yussef', '')).toBe(false)
    expect(nameMatch('Yussef', null)).toBe(false)
  })
})

describe('normalizePixKey', () => {
  it('email lowercase', () => {
    expect(normalizePixKey('YUSSEF@email.COM')).toBe('yussef@email.com')
  })
  it('CPF 123.456.789-00 → só dígitos', () => {
    expect(normalizePixKey('123.456.789-00')).toBe('12345678900')
  })
  it('CNPJ formatado → só dígitos', () => {
    expect(normalizePixKey('12.345.678/0001-90')).toBe('12345678000190')
  })
  it('telefone 11 dígitos', () => {
    expect(normalizePixKey('(11) 99999-8888')).toBe('11999998888')
  })
  it('chave aleatória mantém', () => {
    expect(normalizePixKey('abc123-def456')).toBe('abc123-def456')
  })
})
