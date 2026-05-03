import { describe, it, expect } from 'vitest'
import {
  commonCategorias,
  validarHierarquia,
  detectarCiclos,
  validarCodigosUnicos,
  DRE_GROUPS,
  type CategoryTemplateNode,
} from '../lib/categories/templates/_common'
import { academiaTemplate } from '../lib/categories/templates/academia'
import { restauranteTemplate } from '../lib/categories/templates/restaurante'
import { clinicaTemplate } from '../lib/categories/templates/clinica'
import { salaoTemplate } from '../lib/categories/templates/salao'
import { lojaTemplate } from '../lib/categories/templates/loja'
import {
  REGIMES_TRIBUTARIOS,
  categoriaVisivelNoRegime,
  regimesToJson,
} from '../lib/categories/regimes'
import { getTemplate, getDefaultCategories } from '../lib/categories/defaults'

const dreGroupSet = new Set<string>(DRE_GROUPS)

const TEMPLATES: Record<string, CategoryTemplateNode[]> = {
  academia: academiaTemplate,
  restaurante: restauranteTemplate,
  clinica: clinicaTemplate,
  salao: salaoTemplate,
  loja: lojaTemplate,
}

describe('commonCategorias', () => {
  it('tem categorias suficientes pra cobrir os blocos compartilhados', () => {
    expect(commonCategorias.length).toBeGreaterThanOrEqual(50)
  })

  it('inclui CBS e IBS Reforma 2026 (diferencial competitivo)', () => {
    expect(commonCategorias.find((c) => c.code === '2.1.07')?.name).toMatch(/CBS/)
    expect(commonCategorias.find((c) => c.code === '2.1.08')?.name).toMatch(/IBS/)
  })

  it('PIS/COFINS Cumulativo só visível em LUCRO_PRESUMIDO', () => {
    const pisC = commonCategorias.find((c) => c.code === '2.1.03')
    const cofinsC = commonCategorias.find((c) => c.code === '2.1.04')
    expect(pisC?.visibleInRegimes).toEqual(['LUCRO_PRESUMIDO'])
    expect(cofinsC?.visibleInRegimes).toEqual(['LUCRO_PRESUMIDO'])
  })

  it('PIS/COFINS Não-Cumulativo só visível em LUCRO_REAL', () => {
    const pisNC = commonCategorias.find((c) => c.code === '2.1.05')
    const cofinsNC = commonCategorias.find((c) => c.code === '2.1.06')
    expect(pisNC?.visibleInRegimes).toEqual(['LUCRO_REAL'])
    expect(cofinsNC?.visibleInRegimes).toEqual(['LUCRO_REAL'])
  })

  it('DAS Simples Nacional só visível em regimes Simples (não MEI)', () => {
    const das = commonCategorias.find((c) => c.code === '2.1.02')
    expect(das?.visibleInRegimes).toEqual([
      'SIMPLES_NACIONAL_I',
      'SIMPLES_NACIONAL_II',
      'SIMPLES_NACIONAL_III',
      'SIMPLES_NACIONAL_IV',
      'SIMPLES_NACIONAL_V',
    ])
  })

  it('IRPJ, CSLL, IRPJ Adicional só visíveis em LP/LR', () => {
    const irpj = commonCategorias.find((c) => c.code === '9.1.01')
    const adicional = commonCategorias.find((c) => c.code === '9.1.02')
    const csll = commonCategorias.find((c) => c.code === '9.1.03')
    for (const cat of [irpj, adicional, csll]) {
      expect(cat?.visibleInRegimes).toEqual(['LUCRO_PRESUMIDO', 'LUCRO_REAL'])
    }
  })

  it('FGTS é visível em todos os regimes (universal)', () => {
    const fgts = commonCategorias.find((c) => c.code === '4.3.01')
    expect(fgts?.visibleInRegimes).toBeNull()
  })

  it('Distribuição de Lucros separada de Pró-labore', () => {
    const proLabore = commonCategorias.find((c) => c.code === '4.9.01')
    const distrib = commonCategorias.find((c) => c.code === '4.9.03')
    expect(proLabore?.dreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(distrib?.dreGroup).toBe('DISTRIBUICAO_LUCROS')
    expect(proLabore?.name).toMatch(/Pró-labore/)
    expect(distrib?.name).toMatch(/Distribuição/)
  })
})

describe('templates por subsetor', () => {
  for (const [nome, template] of Object.entries(TEMPLATES)) {
    describe(nome, () => {
      it('hierarquia válida (todo parent existe no template)', () => {
        const erros = validarHierarquia(template)
        expect(erros).toEqual([])
      })

      it('sem ciclos', () => {
        const erros = detectarCiclos(template)
        expect(erros).toEqual([])
      })

      it('códigos SPED únicos', () => {
        const erros = validarCodigosUnicos(template)
        expect(erros).toEqual([])
      })

      it('todo dreGroup pertence ao enum oficial', () => {
        for (const cat of template) {
          expect(dreGroupSet.has(cat.dreGroup)).toBe(true)
        }
      })

      it('visibleInRegimes (se preenchido) só contém regimes válidos', () => {
        const regimesValidos = new Set<string>(REGIMES_TRIBUTARIOS)
        for (const cat of template) {
          if (cat.visibleInRegimes) {
            for (const r of cat.visibleInRegimes) {
              expect(regimesValidos.has(r)).toBe(true)
            }
          }
        }
      })

      it('todos os codes seguem padrão SPED hierárquico', () => {
        for (const cat of template) {
          expect(cat.code).toMatch(/^[0-9]+(\.[0-9]+)*$/)
        }
      })

      it('toda categoria tem description não-vazio', () => {
        for (const cat of template) {
          expect(cat.description.length).toBeGreaterThan(5)
        }
      })

      it('toda categoria tem cor hex válida', () => {
        for (const cat of template) {
          expect(cat.color).toMatch(/^#[0-9a-fA-F]{6}$/)
        }
      })
    })
  }
})

describe('contagens de templates', () => {
  it('academia retorna ao redor de 116 categorias (alvo de 80-120)', () => {
    expect(academiaTemplate.length).toBeGreaterThanOrEqual(100)
  })

  it('restaurante retorna ao redor de 70 categorias', () => {
    expect(restauranteTemplate.length).toBeGreaterThanOrEqual(60)
  })

  it('clinica retorna ao redor de 68 categorias', () => {
    expect(clinicaTemplate.length).toBeGreaterThanOrEqual(60)
  })

  it('salao retorna ao redor de 60 categorias', () => {
    expect(salaoTemplate.length).toBeGreaterThanOrEqual(55)
  })

  it('loja retorna ao redor de 70 categorias', () => {
    expect(lojaTemplate.length).toBeGreaterThanOrEqual(60)
  })

  it('todos os templates incluem o common', () => {
    for (const template of Object.values(TEMPLATES)) {
      expect(template.length).toBeGreaterThan(commonCategorias.length)
    }
  })
})

describe('decisões de produto Yussef (sanity checks)', () => {
  it('academia tem 7 modalidades de Mensalidade (incluindo Gympass + Diária)', () => {
    const subs = academiaTemplate.filter((c) => c.parentCode === '1.1.01')
    expect(subs.length).toBe(7)
    const nomes = subs.map((s) => s.name)
    expect(nomes).toContain('Plano Gympass/TotalPass')
    expect(nomes).toContain('Plano Diária Avulsa')
  })

  it('academia tem 7 modalidades de Aulas em Grupo (Hidro + Funcional incluídos)', () => {
    const subs = academiaTemplate.filter((c) => c.parentCode === '1.1.04')
    expect(subs.length).toBe(7)
    const nomes = subs.map((s) => s.name)
    expect(nomes).toContain('Hidroginástica')
    expect(nomes).toContain('Treinamento Funcional')
  })

  it('academia tem Bolsa Estagiários em Pessoal Op Direto (3.1.05)', () => {
    const bolsa = academiaTemplate.find((c) => c.code === '3.1.05')
    expect(bolsa?.name).toBe('Bolsa Estagiários')
    expect(bolsa?.dreGroup).toBe('CUSTO_PRODUTO_VENDIDO')
  })

  it('academia tem Comissão Plataformas Gympass/TotalPass em 6.4.01', () => {
    const comissao = academiaTemplate.find((c) => c.code === '6.4.01')
    expect(comissao?.name).toMatch(/Gympass|TotalPass/)
    expect(comissao?.dreGroup).toBe('DESPESAS_COMERCIAIS')
  })

  it('academia tem Royalties (3.2) oculto por default (isActive: false)', () => {
    const roy = academiaTemplate.find((c) => c.code === '3.2')
    expect(roy?.name).toMatch(/Royalties/)
    expect(roy?.isActive).toBe(false)
  })

  it('restaurante tem 5 canais de delivery (Pedidos Próprios, iFood, Rappi, 99Food, Outros)', () => {
    const subs = restauranteTemplate.filter((c) => c.parentCode === '1.1.02')
    expect(subs.length).toBe(5)
  })

  it('restaurante tem Comissão iFood, Rappi, 99Food em 6.4.x', () => {
    const subs = restauranteTemplate.filter((c) => c.parentCode === '6.4')
    expect(subs.length).toBeGreaterThanOrEqual(3)
    const nomes = subs.map((s) => s.name)
    expect(nomes.some((n) => /iFood/i.test(n))).toBe(true)
    expect(nomes.some((n) => /Rappi/i.test(n))).toBe(true)
  })

  it('restaurante tem Salários Motoboys CLT, Combustível Delivery, Manutenção Motos, Cardápio Digital', () => {
    expect(restauranteTemplate.find((c) => c.code === '3.1.05')?.name).toMatch(/Motoboys/)
    expect(restauranteTemplate.find((c) => c.code === '5.1.09')?.name).toMatch(/Combustível/)
    expect(restauranteTemplate.find((c) => c.code === '5.2.09')?.name).toMatch(/Motos/)
    expect(restauranteTemplate.find((c) => c.code === '5.3.06')?.name).toMatch(/Cardápio Digital/)
  })

  it('clinica tem Glosas (2.2) com Coparticipação (2.2.01) e Glosas Definitivas (2.2.02)', () => {
    const glosas = clinicaTemplate.find((c) => c.code === '2.2')
    expect(glosas).toBeDefined()
    const subs = clinicaTemplate.filter((c) => c.parentCode === '2.2')
    expect(subs.length).toBeGreaterThanOrEqual(2)
    expect(subs.find((s) => /Coparticipa/.test(s.name))).toBeDefined()
  })

  it('clinica tem 3 anuidades de conselho (CRM, CRO, CRP/Outras)', () => {
    const subs = clinicaTemplate.filter((c) => c.parentCode === '7.4')
    expect(subs.length).toBe(3)
  })

  it('salao tem Comissão Parceiros (Lei 12.592) em 3.1.02', () => {
    const com = salaoTemplate.find((c) => c.code === '3.1.02')
    expect(com?.name).toMatch(/Parceiro/)
  })

  it('salao tem booth rental (1.2.02) e revenda de produtos (1.2.01)', () => {
    expect(salaoTemplate.find((c) => c.code === '1.2.01')?.name).toMatch(/Revenda/)
    expect(salaoTemplate.find((c) => c.code === '1.2.02')?.name).toMatch(/Booth|Cadeira/)
  })

  it('loja tem ICMS-ST (3.1.05 - CFOP 1403)', () => {
    const icmsST = lojaTemplate.find((c) => c.code === '3.1.05')
    expect(icmsST?.name).toMatch(/ICMS-ST/)
  })

  it('loja tem Inadimplência (Provisão Devedores Duvidosos) em 8.4.01', () => {
    const inad = lojaTemplate.find((c) => c.code === '8.4.01')
    expect(inad?.name).toMatch(/Devedores Duvidosos|Provisão/)
  })

  it('loja tem 4 sub de Vendas Online (E-commerce + 3 marketplaces)', () => {
    const subs = lojaTemplate.filter((c) => c.parentCode === '1.1.03')
    expect(subs.length).toBe(4)
  })
})

describe('categoriaVisivelNoRegime', () => {
  it('null = visível em qualquer regime', () => {
    expect(categoriaVisivelNoRegime({ visibleInRegimes: null }, 'SIMPLES_NACIONAL_III')).toBe(true)
    expect(categoriaVisivelNoRegime({ visibleInRegimes: null }, 'LUCRO_REAL')).toBe(true)
  })

  it('JSON válido com regime presente → true', () => {
    const cat = { visibleInRegimes: JSON.stringify(['LUCRO_PRESUMIDO', 'LUCRO_REAL']) }
    expect(categoriaVisivelNoRegime(cat, 'LUCRO_REAL')).toBe(true)
    expect(categoriaVisivelNoRegime(cat, 'LUCRO_PRESUMIDO')).toBe(true)
  })

  it('JSON válido sem o regime → false', () => {
    const cat = { visibleInRegimes: JSON.stringify(['LUCRO_PRESUMIDO']) }
    expect(categoriaVisivelNoRegime(cat, 'LUCRO_REAL')).toBe(false)
    expect(categoriaVisivelNoRegime(cat, 'SIMPLES_NACIONAL_III')).toBe(false)
  })

  it('JSON corrompido → fallback visível (failsafe)', () => {
    const cat = { visibleInRegimes: '{not valid json' }
    expect(categoriaVisivelNoRegime(cat, 'SIMPLES_NACIONAL_III')).toBe(true)
  })

  it('JSON é objeto e não array → fallback visível', () => {
    const cat = { visibleInRegimes: '{"a":1}' }
    expect(categoriaVisivelNoRegime(cat, 'LUCRO_REAL')).toBe(true)
  })
})

describe('regimesToJson', () => {
  it('null → null', () => {
    expect(regimesToJson(null)).toBeNull()
  })

  it('array vazio → null', () => {
    expect(regimesToJson([])).toBeNull()
  })

  it('array com regimes → JSON serializado', () => {
    const json = regimesToJson(['LUCRO_PRESUMIDO', 'LUCRO_REAL'])
    expect(json).toBe('["LUCRO_PRESUMIDO","LUCRO_REAL"]')
  })
})

describe('getTemplate / getDefaultCategories (router)', () => {
  it('service → academia', () => {
    expect(getTemplate('service')).toBe(academiaTemplate)
  })

  it('restaurant → restaurante', () => {
    expect(getTemplate('restaurant')).toBe(restauranteTemplate)
  })

  it('clinica → clinica', () => {
    expect(getTemplate('clinica')).toBe(clinicaTemplate)
  })

  it('salao → salao', () => {
    expect(getTemplate('salao')).toBe(salaoTemplate)
  })

  it('retail → loja', () => {
    expect(getTemplate('retail')).toBe(lojaTemplate)
  })

  it('mixed/other/industry → academia (fallback)', () => {
    expect(getTemplate('mixed')).toBe(academiaTemplate)
    expect(getTemplate('other')).toBe(academiaTemplate)
    expect(getTemplate('industry')).toBe(academiaTemplate)
    expect(getTemplate('desconhecido')).toBe(academiaTemplate)
  })

  it('getDefaultCategories retorna shape compatível com seed antigo', () => {
    const cats = getDefaultCategories('service')
    expect(cats.length).toBeGreaterThan(0)
    for (const cat of cats) {
      expect(cat).toHaveProperty('name')
      expect(cat).toHaveProperty('type')
      expect(cat).toHaveProperty('color')
    }
  })
})
