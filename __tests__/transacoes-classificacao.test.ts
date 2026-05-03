import { describe, it, expect } from 'vitest'
import { montarUpdateClassificacaoManual } from '../lib/transacoes/classificar'

describe('montarUpdateClassificacaoManual', () => {
  it('seta categoryId quando categoria informada', () => {
    const r = montarUpdateClassificacaoManual('cat_abc')
    expect(r.categoryId).toBe('cat_abc')
  })

  it('aceita null pra descrassificar (mantém categoryId = null)', () => {
    const r = montarUpdateClassificacaoManual(null)
    expect(r.categoryId).toBeNull()
  })

  it('sempre seta classificationSource = "MANUAL"', () => {
    expect(montarUpdateClassificacaoManual('cat_x').classificationSource).toBe('MANUAL')
    expect(montarUpdateClassificacaoManual(null).classificationSource).toBe('MANUAL')
  })

  it('sempre limpa aiConfidence (manual não tem confiança IA)', () => {
    expect(montarUpdateClassificacaoManual('cat_x').aiConfidence).toBeNull()
    expect(montarUpdateClassificacaoManual(null).aiConfidence).toBeNull()
  })

  it('sempre limpa classifiedByRuleId (manual não veio de regra)', () => {
    expect(montarUpdateClassificacaoManual('cat_x').classifiedByRuleId).toBeNull()
    expect(montarUpdateClassificacaoManual(null).classifiedByRuleId).toBeNull()
  })

  it('contrato fixo: exatamente as 4 chaves de classificação, nada mais', () => {
    const r = montarUpdateClassificacaoManual('cat_x')
    expect(Object.keys(r).sort()).toEqual([
      'aiConfidence',
      'categoryId',
      'classificationSource',
      'classifiedByRuleId',
    ])
  })

  it('não inclui campos não relacionados a classificação (status, notes, amount, etc)', () => {
    const r = montarUpdateClassificacaoManual('cat_x')
    expect(r).not.toHaveProperty('status')
    expect(r).not.toHaveProperty('notes')
    expect(r).not.toHaveProperty('amount')
    expect(r).not.toHaveProperty('description')
    expect(r).not.toHaveProperty('type')
    expect(r).not.toHaveProperty('date')
    expect(r).not.toHaveProperty('supplierId')
  })
})
