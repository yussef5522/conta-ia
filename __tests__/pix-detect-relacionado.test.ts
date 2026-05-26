// Sprint 5.0.2.h — Detecção Pix relacionado (sócio PF, CNPJ grupo).

import { describe, it, expect } from 'vitest'
import { detectPixRelacionado } from '@/lib/pix-detection/detect-pix-relacionado'

const SOCIO_YUSSEF = {
  id: 'socio-yussef',
  nome: 'Yussef Musa',
  cpf: '12345678900',
  pixKeys: ['yussef@email.com', '11999998888'],
  papel: 'SOCIO',
}

const EMPRESA_ACADEMIA = {
  id: 'empresa-academia',
  nomeFantasia: 'Academia Forca Total',
  cnpjRelacionado: '98765432000110',
  pixKeys: ['academia@email.com'],
  relacao: 'MESMO_GRUPO',
}

describe('detectPixRelacionado — não-Pix retorna null', () => {
  it('descrição sem keyword Pix', () => {
    const r = detectPixRelacionado({
      description: 'Aluguel mensal',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [EMPRESA_ACADEMIA],
    })
    expect(r.tipo).toBeNull()
  })
})

describe('detectPixRelacionado — match SOCIO_PF por CPF', () => {
  it('Pix com CPF do sócio → SOCIO_PF Distribuição', () => {
    const r = detectPixRelacionado({
      description: 'PIX YUSSEF 123.456.789-00',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [],
    })
    expect(r.tipo).toBe('SOCIO_PF')
    expect(r.destinatarioId).toBe('socio-yussef')
    expect(r.categoriaSugerida).toBe('Distribuição de Lucros')
    expect(r.matchedBy).toBe('cpf')
  })

  it('papel ADMINISTRADOR → Pró-labore', () => {
    const r = detectPixRelacionado({
      description: 'PIX 123.456.789-00',
      socios: [{ ...SOCIO_YUSSEF, papel: 'ADMINISTRADOR' }],
      empresasRelacionadas: [],
    })
    expect(r.categoriaSugerida).toBe('Pró-labore')
    expect(r.dreGroupSugerido).toBe('PRO_LABORE')
  })

  it('papel FAMILIAR → Pró-labore', () => {
    const r = detectPixRelacionado({
      description: 'PIX 123.456.789-00',
      socios: [{ ...SOCIO_YUSSEF, papel: 'FAMILIAR' }],
      empresasRelacionadas: [],
    })
    expect(r.categoriaSugerida).toBe('Pró-labore')
  })
})

describe('detectPixRelacionado — match GRUPO_PJ por CNPJ', () => {
  it('Pix com CNPJ relacionado → GRUPO_PJ Transferência', () => {
    const r = detectPixRelacionado({
      description: 'PIX TRANSF ACADEMIA 12.345.678/0001-90',
      socios: [],
      empresasRelacionadas: [
        { ...EMPRESA_ACADEMIA, cnpjRelacionado: '12345678000190' },
      ],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
    expect(r.categoriaSugerida).toContain('Transferência')
    expect(r.dreGroupSugerido).toBe('TRANSFERENCIA')
    expect(r.matchedBy).toBe('cnpj')
  })

  it('CNPJ tem prioridade sobre CPF', () => {
    // descrição tem só CNPJ → não procura CPF
    const r = detectPixRelacionado({
      description: 'PIX 98.765.432/0001-10',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [EMPRESA_ACADEMIA],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
  })
})

describe('detectPixRelacionado — match por email/telefone', () => {
  it('email do sócio na chave Pix → SOCIO_PF', () => {
    const r = detectPixRelacionado({
      description: 'PIX yussef@email.com',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [],
    })
    expect(r.tipo).toBe('SOCIO_PF')
    expect(r.matchedBy).toBe('email')
  })

  it('telefone do sócio', () => {
    const r = detectPixRelacionado({
      description: 'PIX 11999998888',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [],
    })
    expect(r.tipo).toBe('SOCIO_PF')
    expect(r.matchedBy).toBe('telefone')
  })

  it('email da empresa relacionada → GRUPO_PJ', () => {
    const r = detectPixRelacionado({
      description: 'PIX academia@email.com',
      socios: [],
      empresasRelacionadas: [EMPRESA_ACADEMIA],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
    expect(r.matchedBy).toBe('email')
  })
})

describe('detectPixRelacionado — match por nome (fallback)', () => {
  it('nome do sócio na descrição (sem CPF/email)', () => {
    const r = detectPixRelacionado({
      description: 'PIX YUSSEF MUSA RECEBIDO',
      socios: [{ ...SOCIO_YUSSEF, cpf: null, pixKeys: [] }],
      empresasRelacionadas: [],
    })
    expect(r.tipo).toBe('SOCIO_PF')
    expect(r.matchedBy).toBe('nome')
  })

  it('nome fantasia da empresa na descrição', () => {
    const r = detectPixRelacionado({
      description: 'PIX TRANSF ACADEMIA FORCA TOTAL',
      socios: [],
      empresasRelacionadas: [{ ...EMPRESA_ACADEMIA, pixKeys: [] }],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
    expect(r.matchedBy).toBe('nome')
  })

  it('nome único 1 palavra match', () => {
    const r = detectPixRelacionado({
      description: 'PIX CACULA RECEBIDO',
      socios: [],
      empresasRelacionadas: [{ ...EMPRESA_ACADEMIA, nomeFantasia: 'Cacula', pixKeys: [] }],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
  })
})

describe('detectPixRelacionado — sem match → PIX_NORMAL', () => {
  it('Pix pra desconhecido', () => {
    const r = detectPixRelacionado({
      description: 'PIX RESTAURANTE QUALQUER 99.999.999/9999-99',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [EMPRESA_ACADEMIA],
    })
    expect(r.tipo).toBeNull()
    expect(r.parsed.isPix).toBe(true)
  })
})

describe('detectPixRelacionado — prioridade GRUPO sobre SÓCIO em conflito', () => {
  it('se nome bate tanto sócio quanto empresa, CNPJ ganha primeiro', () => {
    const r = detectPixRelacionado({
      description: 'PIX 12.345.678/0001-90 YUSSEF',
      socios: [SOCIO_YUSSEF],
      empresasRelacionadas: [{ ...EMPRESA_ACADEMIA, cnpjRelacionado: '12345678000190' }],
    })
    expect(r.tipo).toBe('GRUPO_PJ')
  })
})
