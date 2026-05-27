// Sprint 5.0.2.0 — mapCategories (puro).

import { describe, it, expect } from 'vitest'
import { mapCategories } from '@/lib/excel-import/map-categories'

const CATS = [
  { id: 'cat-salarios', name: 'Salários', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { id: 'cat-vt', name: 'Vale Transporte', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { id: 'cat-energia', name: 'Energia Elétrica', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { id: 'cat-aluguel', name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { id: 'cat-contabil', name: 'Honorários Contábeis', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { id: 'cat-mp-carnes', name: 'Matéria-Prima - Carnes', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO' },
  { id: 'cat-mp-bebidas', name: 'Matéria-Prima - Bebidas', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO' },
  { id: 'cat-servico-pf', name: 'Serviços PF (Prestadores)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { id: 'cat-software', name: 'Software/Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' },
  { id: 'cat-marketing', name: 'Marketing Digital', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS' },
  { id: 'cat-inss', name: 'INSS', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
]

describe('mapCategories — match exato', () => {
  it('"Salários" → Salários (confidence 1.0)', () => {
    const r = mapCategories({ centrosCusto: ['Salários'], categoriasEmpresa: CATS })
    expect(r[0].matchedCategoryId).toBe('cat-salarios')
    expect(r[0].confidence).toBe(1)
  })

  it('case + acentos não importam', () => {
    const r = mapCategories({ centrosCusto: ['SALARIOS'], categoriasEmpresa: CATS })
    expect(r[0].matchedCategoryId).toBe('cat-salarios')
  })
})

describe('mapCategories — hints setoriais (planilha ASSECONT)', () => {
  it('"Salário Professor" → Salários', () => {
    const r = mapCategories({
      centrosCusto: ['Salário Professor'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-salarios')
    expect(r[0].confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('"Salário Estagiário" → Salários', () => {
    const r = mapCategories({
      centrosCusto: ['Salário Estagiário'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-salarios')
  })

  it('"Vale transporte funcionários" → Vale Transporte', () => {
    const r = mapCategories({
      centrosCusto: ['Vale transporte funcionários'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-vt')
  })

  it('"Exame Ocupacional" → Serviços PF', () => {
    const r = mapCategories({
      centrosCusto: ['Exame Ocupacional'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-servico-pf')
  })

  it('"Honorários Contábeis SAMA" → Honorários Contábeis', () => {
    const r = mapCategories({
      centrosCusto: ['Honorários Contábeis SAMA'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-contabil')
  })

  it('"INSS RECOLHIMENTO" → INSS', () => {
    const r = mapCategories({
      centrosCusto: ['INSS RECOLHIMENTO ABRIL'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-inss')
  })

  it('"Energia da Loja" → Energia Elétrica (hint /energia/)', () => {
    const r = mapCategories({
      centrosCusto: ['Energia da Loja'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-energia')
  })

  it('"Bebidas para revenda" → Matéria-Prima - Bebidas', () => {
    const r = mapCategories({
      centrosCusto: ['Bebidas para revenda'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-mp-bebidas')
  })

  it('"Compra de Carnes" → Matéria-Prima - Carnes', () => {
    const r = mapCategories({
      centrosCusto: ['Compra de Carnes'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBe('cat-mp-carnes')
  })
})

describe('mapCategories — hint propõe categoria nova', () => {
  it('"Folha de Pagamento" → propõe Salários se não existir', () => {
    const catsSemSalarios = CATS.filter((c) => c.id !== 'cat-salarios')
    const r = mapCategories({
      centrosCusto: ['Folha Pagamento Abril'],
      categoriasEmpresa: catsSemSalarios,
    })
    expect(r[0].matchedCategoryId).toBeNull()
    expect(r[0].proposedCategoryName).toBe('Salários')
    expect(r[0].confidence).toBeGreaterThanOrEqual(0.8)
  })
})

describe('mapCategories — similaridade tokens', () => {
  it('"Aluguel da unidade Centro" → Aluguel via tokens', () => {
    const r = mapCategories({
      centrosCusto: ['Aluguel da unidade Centro'],
      categoriasEmpresa: CATS,
    })
    // Hint regex de "aluguel" pega primeiro
    expect(r[0].matchedCategoryId).toBe('cat-aluguel')
  })
})

describe('mapCategories — sem match', () => {
  it('CC totalmente inédito → propõe categoria nova com nome do CC', () => {
    const r = mapCategories({
      centrosCusto: ['Categoria Yussef Customizada XYZ'],
      categoriasEmpresa: CATS,
    })
    expect(r[0].matchedCategoryId).toBeNull()
    expect(r[0].proposedCategoryName).toBe('Categoria Yussef Customizada XYZ')
    expect(r[0].confidence).toBe(0)
  })

  it('CC vazio → vazio', () => {
    const r = mapCategories({ centrosCusto: [''], categoriasEmpresa: CATS })
    expect(r[0].confidence).toBe(0)
    expect(r[0].matchedCategoryId).toBeNull()
  })
})

describe('mapCategories — batch', () => {
  it('processa N CCs únicos', () => {
    const r = mapCategories({
      centrosCusto: ['Salário Professor', 'Energia da Loja', 'Aluguel Loja'],
      categoriasEmpresa: CATS,
    })
    expect(r).toHaveLength(3)
    expect(r[0].matchedCategoryId).toBe('cat-salarios')
    expect(r[1].matchedCategoryId).toBe('cat-energia')
    expect(r[2].matchedCategoryId).toBe('cat-aluguel')
  })
})
