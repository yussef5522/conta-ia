import { describe, it, expect } from 'vitest'
import { detectarBanco, bateComPerfilDaConta } from '../lib/ofx/bancos'
import { BANCOS_BR } from '../lib/bancos'

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

  it('detecta bancos adicionais (BB, Inter, BTG, C6, Mercado Pago, PagBank, Safra)', () => {
    expect(detectarBanco('001')?.nome).toBe('Banco do Brasil')
    expect(detectarBanco('077')?.nome).toBe('Inter')
    expect(detectarBanco('208')?.nome).toBe('BTG Pactual')
    expect(detectarBanco('336')?.nome).toBe('C6 Bank')
    expect(detectarBanco('323')?.nome).toBe('Mercado Pago')
    expect(detectarBanco('290')?.nome).toBe('PagBank')
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

describe('consistência entre lista canônica e detecção OFX', () => {
  it('todo banco da lista canônica é detectável pelo seu próprio código', () => {
    for (const b of BANCOS_BR) {
      const detectado = detectarBanco(b.codigo)
      expect(detectado, `banco ${b.nome} (${b.codigo}) não foi detectado`).not.toBeNull()
      expect(detectado).toEqual({ codigo: b.codigo, nome: b.nome })
    }
  })

  it('detecção retorna o mesmo nome que o cadastro do form (sem divergência)', () => {
    // Garante que se mudar a lista, ambos os usos (form e OFX) leem o mesmo dado.
    for (const b of BANCOS_BR) {
      expect(detectarBanco(b.codigo)?.nome).toBe(b.nome)
    }
  })

  it('cadastro com bankCode da lista canônica bate com detecção do mesmo código', () => {
    for (const b of BANCOS_BR) {
      const conta = { bankName: null, bankCode: b.codigo }
      expect(bateComPerfilDaConta(conta, b)).toBe(true)
    }
  })

  it('cadastro com bankName da lista canônica bate com detecção do mesmo banco', () => {
    for (const b of BANCOS_BR) {
      const conta = { bankName: b.nome, bankCode: null }
      expect(bateComPerfilDaConta(conta, b)).toBe(true)
    }
  })
})
