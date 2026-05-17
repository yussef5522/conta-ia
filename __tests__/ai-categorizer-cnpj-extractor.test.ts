// CNPJ extractor — Fase 3 Etapa 2.

import { describe, it, expect } from 'vitest'
import {
  extractCNPJ,
  validateCNPJ,
  formatCNPJ,
} from '@/lib/ai-categorizer/cnpj-extractor'

// CNPJ teste oficial (válido): 11.222.333/0001-81
const VALID_CNPJ = '11222333000181'
const VALID_FORMATTED = '11.222.333/0001-81'

describe('validateCNPJ', () => {
  it('valida CNPJ correto', () => {
    expect(validateCNPJ(VALID_CNPJ)).toBe(true)
    expect(validateCNPJ(VALID_FORMATTED)).toBe(true)
  })

  it('rejeita CNPJ com dígito verificador errado', () => {
    expect(validateCNPJ('11222333000199')).toBe(false)
    expect(validateCNPJ('11.222.333/0001-99')).toBe(false)
  })

  it('rejeita sequências repetidas (00000... 11111...)', () => {
    expect(validateCNPJ('00000000000000')).toBe(false)
    expect(validateCNPJ('11111111111111')).toBe(false)
  })

  it('rejeita tamanho diferente de 14 dígitos', () => {
    expect(validateCNPJ('1122233300018')).toBe(false) // 13
    expect(validateCNPJ('112223330001811')).toBe(false) // 15
  })
})

describe('extractCNPJ', () => {
  it('extrai CNPJ formatado da descrição', () => {
    expect(extractCNPJ(`VIVO TELECOMUNICACOES ${VALID_FORMATTED}`)).toBe(
      VALID_CNPJ,
    )
  })

  it('extrai CNPJ puro (14 dígitos) da descrição', () => {
    expect(extractCNPJ(`PAGAMENTO ${VALID_CNPJ} REF MAIO`)).toBe(VALID_CNPJ)
  })

  it('IGNORA CPF (11 dígitos)', () => {
    // CPF "00560881088" do Banrisul, formato típico Cacula Mix
    expect(extractCNPJ('Mario Anderson 00560881088 - Pix | Maquininha')).toBeNull()
  })

  it('retorna o PRIMEIRO CNPJ válido se múltiplos', () => {
    const desc = `CNPJ ${VALID_FORMATTED} TRANSFER PARA 99.999.999/9999-99`
    expect(extractCNPJ(desc)).toBe(VALID_CNPJ)
  })

  it('IGNORA sequências 14 dígitos que falham validação', () => {
    expect(extractCNPJ('PAGAMENTO 12345678901234 REF MAIO')).toBeNull()
  })

  it('descrição vazia → null', () => {
    expect(extractCNPJ('')).toBeNull()
  })

  it('sem CNPJ na descrição → null', () => {
    expect(extractCNPJ('STONE PAGAMENTOS S.A CARTAO ANTECIP')).toBeNull()
  })

  it('aceita CNPJ com espaços/traços extras', () => {
    expect(extractCNPJ(`CLIENTE  11 222 333  0001-81  PG`)).toBe(VALID_CNPJ)
  })
})

describe('formatCNPJ', () => {
  it('formata 14 dígitos no padrão XX.XXX.XXX/XXXX-XX', () => {
    expect(formatCNPJ(VALID_CNPJ)).toBe(VALID_FORMATTED)
  })

  it('preserva entrada inválida (não tem 14 dígitos)', () => {
    expect(formatCNPJ('123')).toBe('123')
  })
})
