import { describe, it, expect } from 'vitest'
import { BANCOS_BR, findBancoByCodigo, normalizarCodigoBanco } from '../lib/bancos'

describe('BANCOS_BR (lista canônica)', () => {
  it('contém os 8 bancos do Yussef', () => {
    const codigos = BANCOS_BR.map((b) => b.codigo)
    expect(codigos).toContain('041') // Banrisul
    expect(codigos).toContain('237') // Bradesco
    expect(codigos).toContain('341') // Itaú
    expect(codigos).toContain('033') // Santander
    expect(codigos).toContain('748') // Sicredi
    expect(codigos).toContain('756') // Sicoob
    expect(codigos).toContain('104') // Caixa
    expect(codigos).toContain('260') // Nubank
  })

  it('contém os bancos adicionais (BB, Inter, BTG, C6, Mercado Pago, PagBank, Safra)', () => {
    const codigos = BANCOS_BR.map((b) => b.codigo)
    expect(codigos).toContain('001') // Banco do Brasil
    expect(codigos).toContain('077') // Inter
    expect(codigos).toContain('208') // BTG Pactual
    expect(codigos).toContain('336') // C6 Bank
    expect(codigos).toContain('323') // Mercado Pago
    expect(codigos).toContain('290') // PagBank
    expect(codigos).toContain('422') // Safra
  })

  it('código 290 é "PagBank" (decisão de produto: nome de mercado, não razão social)', () => {
    const banco = BANCOS_BR.find((b) => b.codigo === '290')
    expect(banco?.nome).toBe('PagBank')
  })

  it('totaliza 15 bancos', () => {
    expect(BANCOS_BR).toHaveLength(15)
  })

  it('não tem códigos duplicados', () => {
    const codigos = BANCOS_BR.map((b) => b.codigo)
    const unicos = new Set(codigos)
    expect(unicos.size).toBe(codigos.length)
  })

  it('não tem nomes duplicados', () => {
    const nomes = BANCOS_BR.map((b) => b.nome)
    const unicos = new Set(nomes)
    expect(unicos.size).toBe(nomes.length)
  })

  it('todos os códigos seguem formato FEBRABAN (3 dígitos numéricos)', () => {
    for (const b of BANCOS_BR) {
      expect(b.codigo).toMatch(/^\d{3}$/)
    }
  })

  it('não inclui o código sentinela "000" (reservado para "Outro" só na UI)', () => {
    const codigos = BANCOS_BR.map((b) => b.codigo)
    expect(codigos).not.toContain('000')
  })

  it('está ordenada alfabeticamente por nome', () => {
    const nomes = BANCOS_BR.map((b) => b.nome)
    const ordenados = [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    expect(nomes).toEqual(ordenados)
  })
})

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

describe('findBancoByCodigo', () => {
  it('encontra banco por código de 3 dígitos', () => {
    expect(findBancoByCodigo('041')?.nome).toBe('Banrisul')
    expect(findBancoByCodigo('341')?.nome).toBe('Itaú')
  })

  it('aceita variações de formato (curto, com zeros à frente, com espaços)', () => {
    expect(findBancoByCodigo('41')?.nome).toBe('Banrisul')
    expect(findBancoByCodigo('0041')?.nome).toBe('Banrisul')
    expect(findBancoByCodigo('  041  ')?.nome).toBe('Banrisul')
  })

  it('retorna null para código desconhecido', () => {
    expect(findBancoByCodigo('999')).toBeNull()
    expect(findBancoByCodigo('500')).toBeNull()
  })

  it('retorna null para o código sentinela 000 (Outro)', () => {
    expect(findBancoByCodigo('000')).toBeNull()
  })

  it('retorna null para entradas inválidas', () => {
    expect(findBancoByCodigo(null)).toBeNull()
    expect(findBancoByCodigo(undefined)).toBeNull()
    expect(findBancoByCodigo('')).toBeNull()
    expect(findBancoByCodigo('abc')).toBeNull()
  })
})
