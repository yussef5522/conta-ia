import { describe, it, expect } from 'vitest'
import { sugerir } from '../lib/categories/sugerir'

describe('sugerir() — auto-sugestão pra DESPESAS', () => {
  it('"Aluguel" → DESPESAS_ADMINISTRATIVAS + home', () => {
    const r = sugerir({ nome: 'Aluguel', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(r.color).toBe('bg-orange-300')
    expect(r.icon).toBe('home')
  })

  it('"Energia Elétrica" → DESPESAS_ADMINISTRATIVAS + zap', () => {
    const r = sugerir({ nome: 'Energia Elétrica', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(r.icon).toBe('zap')
  })

  it('"Internet/Telefonia" → DESPESAS_ADMINISTRATIVAS + smartphone', () => {
    const r = sugerir({ nome: 'Internet/Telefonia', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(r.icon).toBe('smartphone')
  })

  it('"Salários" → DESPESAS_PESSOAL + users', () => {
    const r = sugerir({ nome: 'Salários', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_PESSOAL')
    expect(r.color).toBe('bg-blue-500')
    expect(r.icon).toBe('users')
  })

  it('"FGTS" → DESPESAS_PESSOAL + briefcase', () => {
    const r = sugerir({ nome: 'FGTS', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_PESSOAL')
    expect(r.icon).toBe('briefcase')
  })

  it('"Vale Transporte" → DESPESAS_PESSOAL + gift', () => {
    const r = sugerir({ nome: 'Vale Transporte', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_PESSOAL')
    expect(r.icon).toBe('gift')
  })

  it('"Marketing Digital" → DESPESAS_COMERCIAIS + megaphone', () => {
    const r = sugerir({ nome: 'Marketing Digital', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_COMERCIAIS')
    expect(r.color).toBe('bg-orange-400')
    expect(r.icon).toBe('megaphone')
  })

  it('"Google Ads" → DESPESAS_COMERCIAIS', () => {
    const r = sugerir({ nome: 'Google Ads', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_COMERCIAIS')
  })

  it('"Comissão de Vendas" → DESPESAS_COMERCIAIS + percent', () => {
    const r = sugerir({ nome: 'Comissão de Vendas', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_COMERCIAIS')
    expect(r.icon).toBe('percent')
  })

  it('"Juros sobre Empréstimo" → DESPESAS_FINANCEIRAS + banknote', () => {
    const r = sugerir({ nome: 'Juros sobre Empréstimo', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_FINANCEIRAS')
    expect(r.color).toBe('bg-red-600')
    expect(r.icon).toBe('banknote')
  })

  it('"IRPJ" → IMPOSTOS_SOBRE_LUCRO + scale', () => {
    const r = sugerir({ nome: 'IRPJ', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('IMPOSTOS_SOBRE_LUCRO')
    expect(r.color).toBe('bg-purple-700')
    expect(r.icon).toBe('scale')
  })

  it('"Insumos da Cozinha" → CUSTO_PRODUTO_VENDIDO + package', () => {
    const r = sugerir({ nome: 'Insumos da Cozinha', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('CUSTO_PRODUTO_VENDIDO')
    expect(r.icon).toBe('package')
  })

  it('"Equipamentos" → INVESTIMENTOS + wrench', () => {
    const r = sugerir({ nome: 'Equipamentos', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('INVESTIMENTOS')
    expect(r.color).toBe('bg-purple-400')
    expect(r.icon).toBe('wrench')
  })

  it('default EXPENSE (nome desconhecido) → DESPESAS_ADMINISTRATIVAS', () => {
    const r = sugerir({ nome: 'XYZ Random', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(r.icon).toBe('file-text')
  })
})

describe('sugerir() — auto-sugestão pra RECEITAS', () => {
  it('"Mensalidades" → RECEITA_BRUTA + calendar', () => {
    const r = sugerir({ nome: 'Mensalidades', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('RECEITA_BRUTA')
    expect(r.color).toBe('bg-emerald-500')
    expect(r.icon).toBe('calendar')
  })

  it('"Vendas Online" → RECEITA_BRUTA + dollar-sign', () => {
    const r = sugerir({ nome: 'Vendas Online', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('RECEITA_BRUTA')
    expect(r.icon).toBe('dollar-sign')
  })

  it('"Serviços Prestados" → RECEITA_BRUTA', () => {
    const r = sugerir({ nome: 'Serviços Prestados', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('RECEITA_BRUTA')
  })

  it('"Rendimentos de Aplicações" → RECEITAS_FINANCEIRAS + trending-up', () => {
    const r = sugerir({ nome: 'Rendimentos de Aplicações', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('RECEITAS_FINANCEIRAS')
    expect(r.icon).toBe('trending-up')
  })

  it('"Indenizações Recebidas" → OUTRAS_RECEITAS + gift', () => {
    const r = sugerir({ nome: 'Indenizações Recebidas', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('OUTRAS_RECEITAS')
    expect(r.icon).toBe('gift')
  })

  it('"ISS Recolhido" → DEDUCOES (mesmo sendo INCOME-flavor)', () => {
    // Quando user seleciona INCOME mas digita "ISS", a heurística reconhece
    // ISS como dedução de receita.
    const r = sugerir({ nome: 'ISS Recolhido', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('DEDUCOES')
  })

  it('default INCOME (desconhecido) → RECEITA_BRUTA', () => {
    const r = sugerir({ nome: 'Algo Estranho', tipo: 'INCOME' })
    expect(r.dreGroup).toBe('RECEITA_BRUTA')
  })
})

describe('sugerir() — auto-sugestão pra TRANSFERÊNCIAS', () => {
  it('"Aporte de Sócio" → TRANSFERENCIA + handshake', () => {
    const r = sugerir({ nome: 'Aporte de Sócio', tipo: 'TRANSFER' })
    expect(r.dreGroup).toBe('TRANSFERENCIA')
    expect(r.icon).toBe('handshake')
  })

  it('"Distribuição de Lucros" → DISTRIBUICAO_LUCROS + trending-up', () => {
    const r = sugerir({ nome: 'Distribuição de Lucros', tipo: 'TRANSFER' })
    expect(r.dreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(r.color).toBe('bg-amber-500')
  })

  it('"Pró-Labore" → DISTRIBUICAO_LUCROS', () => {
    const r = sugerir({ nome: 'Pró-Labore', tipo: 'TRANSFER' })
    expect(r.dreGroup).toBe('DISTRIBUICAO_LUCROS')
  })

  it('default TRANSFER → TRANSFERENCIA + arrow-left-right', () => {
    const r = sugerir({ nome: 'Outra Transfer', tipo: 'TRANSFER' })
    expect(r.dreGroup).toBe('TRANSFERENCIA')
    expect(r.icon).toBe('arrow-left-right')
  })
})

describe('sugerir() — edge cases', () => {
  it('nome vazio → default do tipo', () => {
    expect(sugerir({ nome: '', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(sugerir({ nome: '', tipo: 'INCOME' }).dreGroup).toBe('RECEITA_BRUTA')
    expect(sugerir({ nome: '', tipo: 'TRANSFER' }).dreGroup).toBe('TRANSFERENCIA')
  })

  it('só whitespace → default', () => {
    expect(sugerir({ nome: '   ', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
  })

  it('case insensitive', () => {
    expect(sugerir({ nome: 'aluguel', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(sugerir({ nome: 'ALUGUEL', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
    expect(sugerir({ nome: 'AlUgUeL', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_ADMINISTRATIVAS')
  })

  it('normaliza acentos', () => {
    // "Salários" e "Salarios" e "salário" devem dar o mesmo resultado
    expect(sugerir({ nome: 'Salários', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_PESSOAL')
    expect(sugerir({ nome: 'Salarios', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_PESSOAL')
    expect(sugerir({ nome: 'salário', tipo: 'EXPENSE' }).dreGroup).toBe('DESPESAS_PESSOAL')
  })

  it('é determinístico (rodar 2x = mesmo resultado)', () => {
    const a = sugerir({ nome: 'Marketing', tipo: 'EXPENSE' })
    const b = sugerir({ nome: 'Marketing', tipo: 'EXPENSE' })
    expect(a).toEqual(b)
  })

  it('aplica primeira regra que casa (ordem importa)', () => {
    // "Salário Marketing" — se Marketing match primeiro seria errado.
    // Salário match primeiro → DESPESAS_PESSOAL.
    const r = sugerir({ nome: 'Salário Marketing', tipo: 'EXPENSE' })
    expect(r.dreGroup).toBe('DESPESAS_PESSOAL')
  })

  it('sempre retorna objeto com 3 campos (dreGroup, color, icon)', () => {
    const r = sugerir({ nome: 'Qualquer Coisa', tipo: 'EXPENSE' })
    expect(r).toHaveProperty('dreGroup')
    expect(r).toHaveProperty('color')
    expect(r).toHaveProperty('icon')
  })

  it('color sempre é classe Tailwind bg-*', () => {
    const tipos = ['EXPENSE', 'INCOME', 'TRANSFER'] as const
    for (const t of tipos) {
      const r = sugerir({ nome: 'X', tipo: t })
      expect(r.color).toMatch(/^bg-/)
    }
  })
})
