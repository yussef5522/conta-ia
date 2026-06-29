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

  // Sprint Escada-Status (28/06/2026): contrato passou de 4 → 5 chaves.
  // Adicionado `status` (PENDING|RECONCILED) derivado de categoryId via
  // statusFromCategoryId. Cobertura no helper resolve as 57 tx Cacula em
  // estado invertido (categoryId preenchido + status=PENDING).
  it('contrato fixo: exatamente as 5 chaves (4 classificação + status escada)', () => {
    const r = montarUpdateClassificacaoManual('cat_x')
    expect(Object.keys(r).sort()).toEqual([
      'aiConfidence',
      'categoryId',
      'classificationSource',
      'classifiedByRuleId',
      'status',
    ])
  })

  it('Sprint Escada-Status: inclui status, mas NÃO inclui campos fora do escopo classificação+escada', () => {
    const r = montarUpdateClassificacaoManual('cat_x')
    expect(r).toHaveProperty('status') // Sprint Escada-Status (28/06)
    expect(r).not.toHaveProperty('notes')
    expect(r).not.toHaveProperty('amount')
    expect(r).not.toHaveProperty('description')
    expect(r).not.toHaveProperty('type')
    expect(r).not.toHaveProperty('date')
    expect(r).not.toHaveProperty('supplierId')
  })

  it('Sprint Escada-Status: categoryId preenchido sobe status pra RECONCILED', () => {
    expect(montarUpdateClassificacaoManual('cat_x').status).toBe('RECONCILED')
  })

  it('Sprint Escada-Status: categoryId null desce status pra PENDING', () => {
    expect(montarUpdateClassificacaoManual(null).status).toBe('PENDING')
  })
})
