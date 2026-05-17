// Pipeline orquestrador (síncrono + assíncrono) — Fase 3 Etapa 2.

import { describe, it, expect, vi } from 'vitest'
import {
  classifyForImport,
  classifyAsync,
  resolveCategoryFromHint,
  BRASILAPI_CONFIDENCE,
} from '@/lib/ai-categorizer/pipeline'
import { buildRuleIndex } from '@/lib/ai-categorizer/predict'
import type { RuleSnapshot } from '@/lib/ai-categorizer/types'
import type { BrasilApiResult } from '@/lib/ai-categorizer/brasilapi-client'

function rule(overrides: Partial<RuleSnapshot> = {}): RuleSnapshot {
  return {
    id: 'r-1',
    companyId: 'comp-1',
    tipoMatch: 'EXACT',
    padrao: 'pagamento titulo',
    categoryId: 'cat-fornec',
    supplierId: null,
    confianca: 1.0,
    vezesAplicada: 0,
    isActive: true,
    fonte: 'MANUAL',
    ...overrides,
  }
}

describe('classifyForImport — ordem Camada 1 > Camada 2A > null', () => {
  it('Camada 1 ganha quando regra existe (EXACT 1.0)', () => {
    const idx = buildRuleIndex('comp-1', [rule()])
    const r = classifyForImport({ description: 'PAGAMENTO TITULO' }, idx)
    expect(r.layer).toBe('RULE')
    expect(r.rulePrediction?.confidence).toBe(1.0)
  })

  it('Camada 1 ganha sobre keyword (regra > keyword)', () => {
    // Regra EXACT pra a descrição inteira → ganha de Camada 2A keyword "STONE"
    const idx = buildRuleIndex('comp-1', [
      rule({
        padrao: 'stone pagamentos s.a cartao antecip',
        categoryId: 'cat-custom',
      }),
    ])
    const r = classifyForImport(
      { description: 'STONE PAGAMENTOS S.A CARTAO ANTECIP' },
      idx,
    )
    expect(r.layer).toBe('RULE')
    expect(r.rulePrediction?.categoryId).toBe('cat-custom')
  })

  it('Camada 2A casa quando Camada 1 não tem regra', () => {
    const idx = buildRuleIndex('comp-1', [])
    const r = classifyForImport(
      { description: 'STONE PAGAMENTOS S.A CARTAO ANTECIP' },
      idx,
    )
    expect(r.layer).toBe('KEYWORD')
    expect(r.keywordMatch?.displayName).toBe('Stone')
    expect(r.keywordMatch?.categoryNameHint).toBe('Vendas')
    expect(r.keywordMatch?.confidence).toBe(0.8)
  })

  it('Sem regra E sem keyword → layer null', () => {
    const idx = buildRuleIndex('comp-1', [])
    const r = classifyForImport(
      { description: 'PAGAMENTO QUALQUER COISA 999' },
      idx,
    )
    expect(r.layer).toBeNull()
  })
})

describe('classifyAsync — Camada 2B BrasilAPI', () => {
  const VALID_CNPJ = '11222333000181'

  function fakeFetcher(result: BrasilApiResult) {
    return vi.fn().mockResolvedValue(result)
  }

  it('Camada 2B dispara quando 1+2A falham E há CNPJ válido', async () => {
    const idx = buildRuleIndex('comp-1', [])
    const fetcher = fakeFetcher({
      kind: 'success',
      data: {
        cnpj: VALID_CNPJ,
        razao_social: 'VIVO TELECOMUNICACOES LTDA',
        nome_fantasia: 'Vivo',
        cnae_fiscal: 6110801,
        cnae_fiscal_descricao: 'Telefonia móvel',
        situacao_cadastral: 2,
      },
    })

    const r = await classifyAsync(
      { description: `PAGAMENTO 11.222.333/0001-81 REF MAIO` },
      idx,
      { fetcher },
    )
    expect(r.layer).toBe('BRASILAPI')
    expect(r.brasilApiData?.razaoSocial).toBe('VIVO TELECOMUNICACOES LTDA')
    expect(r.brasilApiData?.hint?.categoryNameHint).toBe('Telefonia')
    expect(r.brasilApiData?.confidence).toBe(BRASILAPI_CONFIDENCE)
  })

  it('Camada 1 antes — NÃO chama BrasilAPI quando regra casa', async () => {
    const idx = buildRuleIndex('comp-1', [
      rule({ padrao: 'pagamento titulo 11.222.333/0001-81' }),
    ])
    const fetcher = vi.fn() // não deve ser chamado

    const r = await classifyAsync(
      { description: `PAGAMENTO TITULO 11.222.333/0001-81` },
      idx,
      { fetcher },
    )
    expect(r.layer).toBe('RULE')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('sem CNPJ + sem regra + sem keyword → null sem chamar fetcher', async () => {
    const idx = buildRuleIndex('comp-1', [])
    const fetcher = vi.fn()
    const r = await classifyAsync(
      { description: 'TRANSACAO QUALQUER 12345' },
      idx,
      { fetcher },
    )
    expect(r.layer).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('BrasilAPI retorna not-found → layer null', async () => {
    const idx = buildRuleIndex('comp-1', [])
    const fetcher = fakeFetcher({ kind: 'not-found' })
    const r = await classifyAsync(
      { description: `PAGAMENTO 11.222.333/0001-81` },
      idx,
      { fetcher },
    )
    expect(r.layer).toBeNull()
  })

  it('BrasilAPI rate-limited → layer null (degrade gracioso)', async () => {
    const idx = buildRuleIndex('comp-1', [])
    const fetcher = fakeFetcher({ kind: 'rate-limited' })
    const r = await classifyAsync(
      { description: `PAGAMENTO 11.222.333/0001-81` },
      idx,
      { fetcher },
    )
    expect(r.layer).toBeNull()
  })

  it('CNAE não mapeado → success mas hint=null (Supplier sem categoria)', async () => {
    const idx = buildRuleIndex('comp-1', [])
    const fetcher = fakeFetcher({
      kind: 'success',
      data: {
        cnpj: VALID_CNPJ,
        razao_social: 'EMPRESA XYZ LTDA',
        nome_fantasia: null,
        cnae_fiscal: 9999, // não mapeado
        cnae_fiscal_descricao: 'Outras atividades',
        situacao_cadastral: 2,
      },
    })
    const r = await classifyAsync(
      { description: `PAGAMENTO 11.222.333/0001-81` },
      idx,
      { fetcher },
    )
    expect(r.layer).toBe('BRASILAPI')
    expect(r.brasilApiData?.hint).toBeNull()
    expect(r.brasilApiData?.razaoSocial).toBe('EMPRESA XYZ LTDA')
  })
})

describe('resolveCategoryFromHint — plano de contas da empresa', () => {
  const cats = [
    { id: 'c1', name: 'Telefonia', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isActive: true },
    { id: 'c2', name: 'Vendas', dreGroup: 'RECEITA_BRUTA', isActive: true },
    { id: 'c3', name: 'Outras Despesas', dreGroup: 'DESPESAS_ADMINISTRATIVAS', isActive: true },
    { id: 'c4', name: 'Categoria Inativa', dreGroup: 'RECEITA_BRUTA', isActive: false },
  ]

  it('match exato por nome', () => {
    expect(
      resolveCategoryFromHint(cats, {
        dreGroup: 'DESPESAS_ADMINISTRATIVAS',
        categoryNameHint: 'Telefonia',
      }),
    ).toBe('c1')
  })

  it('fallback por dreGroup quando nome não casa', () => {
    expect(
      resolveCategoryFromHint(cats, {
        dreGroup: 'DESPESAS_ADMINISTRATIVAS',
        categoryNameHint: 'Categoria Inexistente',
      }),
    ).toBe('c1') // primeira ATIVA com mesmo dreGroup
  })

  it('IGNORA categorias inativas', () => {
    expect(
      resolveCategoryFromHint(cats, {
        dreGroup: 'RECEITA_BRUTA',
        categoryNameHint: 'Categoria Inativa',
      }),
    ).toBe('c2') // fallback pra Vendas (ativa)
  })

  it('null quando nenhuma categoria casa', () => {
    expect(
      resolveCategoryFromHint(cats, {
        dreGroup: 'CUSTOS_VARIAVEIS',
        categoryNameHint: 'Inexistente',
      }),
    ).toBeNull()
  })
})
