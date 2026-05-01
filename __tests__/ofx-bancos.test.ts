import { describe, it, expect } from 'vitest'
import { detectarBanco, normalizarCodigoBanco, bateComPerfilDaConta } from '../lib/ofx/bancos'

describe('normalizarCodigoBanco', () => {
  it('retorna null para entrada vazia ou null', () => {
    expect(normalizarCodigoBanco(null)).toBeNull()
    expect(normalizarCodigoBanco(undefined)).toBeNull()
    expect(normalizarCodigoBanco('')).toBeNull()
    expect(normalizarCodigoBanco('   ')).toBeNull()
  })

  it('retorna null para entrada não numérica', () => {
    expect(normalizarCodigoBanco('abc')).toBeNull()
    expect(normalizarCodigoBanco('341X')).toBeNull()
  })

  it('preserva código de 3 dígitos', () => {
    expect(normalizarCodigoBanco('341')).toBe('341')
    expect(normalizarCodigoBanco('001')).toBe('001')
  })

  it('preenche com zeros à esquerda códigos curtos', () => {
    expect(normalizarCodigoBanco('41')).toBe('041')
    expect(normalizarCodigoBanco('1')).toBe('001')
  })

  it('trunca para os últimos 3 dígitos quando longo', () => {
    expect(normalizarCodigoBanco('0341')).toBe('341')
    expect(normalizarCodigoBanco('00041')).toBe('041')
  })

  it('faz trim de espaços', () => {
    expect(normalizarCodigoBanco('  341  ')).toBe('341')
  })
})

describe('detectarBanco', () => {
  it('detecta os 8 bancos do Yussef', () => {
    expect(detectarBanco('041')?.nome).toBe('Banrisul')
    expect(detectarBanco('237')?.nome).toBe('Bradesco')
    expect(detectarBanco('341')?.nome).toBe('Itaú')
    expect(detectarBanco('033')?.nome).toBe('Santander')
    expect(detectarBanco('748')?.nome).toBe('Sicredi')
    expect(detectarBanco('756')?.nome).toBe('Sicoob')
    expect(detectarBanco('104')?.nome).toBe('Caixa Econômica Federal')
    expect(detectarBanco('260')?.nome).toBe('Nubank')
  })

  it('detecta bancos adicionais (BB, Inter, BTG, C6, Mercado Pago, PagSeguro, Safra)', () => {
    expect(detectarBanco('001')?.nome).toBe('Banco do Brasil')
    expect(detectarBanco('077')?.nome).toBe('Inter')
    expect(detectarBanco('208')?.nome).toBe('BTG Pactual')
    expect(detectarBanco('336')?.nome).toBe('C6 Bank')
    expect(detectarBanco('323')?.nome).toBe('Mercado Pago')
    expect(detectarBanco('290')?.nome).toBe('PagSeguro')
    expect(detectarBanco('422')?.nome).toBe('Safra')
  })

  it('retorna o código normalizado', () => {
    expect(detectarBanco('341')?.codigo).toBe('341')
    expect(detectarBanco('41')?.codigo).toBe('041')
    expect(detectarBanco('0341')?.codigo).toBe('341')
  })

  it('retorna null para código desconhecido', () => {
    expect(detectarBanco('999')).toBeNull()
    expect(detectarBanco('500')).toBeNull()
  })

  it('retorna null para entradas inválidas', () => {
    expect(detectarBanco(null)).toBeNull()
    expect(detectarBanco(undefined)).toBeNull()
    expect(detectarBanco('')).toBeNull()
    expect(detectarBanco('abc')).toBeNull()
  })
})

describe('bateComPerfilDaConta', () => {
  const banrisul = { codigo: '041', nome: 'Banrisul' }
  const itau = { codigo: '341', nome: 'Itaú' }

  it('retorna null quando a conta não tem banco cadastrado', () => {
    expect(bateComPerfilDaConta({ bankName: null, bankCode: null }, banrisul)).toBeNull()
    expect(bateComPerfilDaConta({ bankName: '', bankCode: null }, banrisul)).toBeNull()
  })

  it('compara por código quando conta tem bankCode', () => {
    expect(bateComPerfilDaConta({ bankName: null, bankCode: '041' }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: null, bankCode: '341' }, banrisul)).toBe(false)
  })

  it('normaliza código cadastrado antes de comparar', () => {
    expect(bateComPerfilDaConta({ bankName: null, bankCode: '41' }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: null, bankCode: '0041' }, banrisul)).toBe(true)
  })

  it('compara por nome quando conta tem bankName mas não bankCode', () => {
    expect(bateComPerfilDaConta({ bankName: 'Banrisul', bankCode: null }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: 'BANRISUL S/A', bankCode: null }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: 'Itaú Unibanco', bankCode: null }, banrisul)).toBe(false)
  })

  it('comparação por nome é case-insensitive e por contains', () => {
    expect(bateComPerfilDaConta({ bankName: 'banrisul', bankCode: null }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: 'Banco Banrisul', bankCode: null }, banrisul)).toBe(true)
    expect(bateComPerfilDaConta({ bankName: 'Itaú', bankCode: null }, itau)).toBe(true)
  })

  it('código tem prioridade sobre nome', () => {
    // Cadastro com nome certo mas código errado → false
    expect(bateComPerfilDaConta({ bankName: 'Banrisul', bankCode: '341' }, banrisul)).toBe(false)
  })
})
