// Sprint 5.0.2.i — Auto-apply Pix (camada 0 do pipeline).

import { describe, it, expect } from 'vitest'
import { detectAndPlanPixApply } from '@/lib/pix-detection/auto-apply-pix'
import {
  resolveSystemCategoryId,
  type SystemCategoriesResult,
} from '@/lib/categorias/ensure-system-categories'

const SYSTEM_CATEGORIES: SystemCategoriesResult = {
  distribuicaoLucrosId: 'cat-distrib',
  proLaboreId: 'cat-pro-labore',
  transferenciaInternaId: 'cat-transf',
}

const SOCIO = {
  id: 'socio-yussef',
  nome: 'Yussef Musa',
  cpf: '12345678900',
  pixKeys: ['yussef@email.com'],
  papel: 'SOCIO',
}

const EMPRESA_REL = {
  id: 'er-academia',
  nomeFantasia: 'Academia Forca Total',
  cnpjRelacionado: '98765432000110',
  pixKeys: [],
  relacao: 'MESMO_GRUPO',
}

describe('detectAndPlanPixApply — não-Pix', () => {
  it('descrição sem PIX → não aplica', () => {
    const r = detectAndPlanPixApply(
      { description: 'Aluguel mensal' },
      [SOCIO],
      [EMPRESA_REL],
      SYSTEM_CATEGORIES,
    )
    expect(r.apply).toBe(false)
    expect(r.patch).toBeUndefined()
  })
})

describe('detectAndPlanPixApply — SOCIO_PF', () => {
  it('Pix com CPF sócio papel SOCIO → Distribuição', () => {
    const r = detectAndPlanPixApply(
      { description: 'PIX 123.456.789-00 YUSSEF' },
      [SOCIO],
      [EMPRESA_REL],
      SYSTEM_CATEGORIES,
    )
    expect(r.apply).toBe(true)
    expect(r.patch?.relatedPartyType).toBe('SOCIO_PF')
    expect(r.patch?.relatedPartyId).toBe('socio-yussef')
    expect(r.patch?.categoryId).toBe('cat-distrib')
    expect(r.patch?.status).toBe('RECONCILED')
    expect(r.patch?.aiConfidence).toBe(1.0)
  })

  it('Pix com CPF sócio papel ADMINISTRADOR → Pró-labore', () => {
    const r = detectAndPlanPixApply(
      { description: 'PIX 123.456.789-00' },
      [{ ...SOCIO, papel: 'ADMINISTRADOR' }],
      [],
      SYSTEM_CATEGORIES,
    )
    expect(r.patch?.categoryId).toBe('cat-pro-labore')
  })

  it('Pix com email do sócio', () => {
    const r = detectAndPlanPixApply(
      { description: 'PIX yussef@email.com' },
      [SOCIO],
      [],
      SYSTEM_CATEGORIES,
    )
    expect(r.apply).toBe(true)
    expect(r.patch?.relatedPartyType).toBe('SOCIO_PF')
  })
})

describe('detectAndPlanPixApply — GRUPO_PJ', () => {
  it('Pix com CNPJ relacionado → Transferência', () => {
    const r = detectAndPlanPixApply(
      { description: 'PIX 98.765.432/0001-10 ACADEMIA' },
      [SOCIO],
      [EMPRESA_REL],
      SYSTEM_CATEGORIES,
    )
    expect(r.apply).toBe(true)
    expect(r.patch?.relatedPartyType).toBe('GRUPO_PJ')
    expect(r.patch?.relatedPartyId).toBe('er-academia')
    expect(r.patch?.categoryId).toBe('cat-transf')
  })

  it('Pix com nome fantasia da empresa', () => {
    const r = detectAndPlanPixApply(
      { description: 'PIX ACADEMIA FORCA TOTAL' },
      [],
      [EMPRESA_REL],
      SYSTEM_CATEGORIES,
    )
    expect(r.patch?.relatedPartyType).toBe('GRUPO_PJ')
  })
})

describe('resolveSystemCategoryId — todos dreGroups', () => {
  it('DISTRIBUICAO_LUCROS → distribuicao', () => {
    expect(resolveSystemCategoryId('DISTRIBUICAO_LUCROS', SYSTEM_CATEGORIES)).toBe('cat-distrib')
  })
  it('PRO_LABORE → pro-labore', () => {
    expect(resolveSystemCategoryId('PRO_LABORE', SYSTEM_CATEGORIES)).toBe('cat-pro-labore')
  })
  it('DESPESAS_PESSOAL → pro-labore', () => {
    expect(resolveSystemCategoryId('DESPESAS_PESSOAL', SYSTEM_CATEGORIES)).toBe('cat-pro-labore')
  })
  it('TRANSFERENCIA → transf', () => {
    expect(resolveSystemCategoryId('TRANSFERENCIA', SYSTEM_CATEGORIES)).toBe('cat-transf')
  })
  it('desconhecido → fallback transf', () => {
    expect(resolveSystemCategoryId('FOO', SYSTEM_CATEGORIES)).toBe('cat-transf')
  })
})
