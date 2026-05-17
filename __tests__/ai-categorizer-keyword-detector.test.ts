// Keyword detector — Camada 2A. Fase 3 Etapa 2.

import { describe, it, expect } from 'vitest'
import {
  detectKeyword,
  KEYWORD_DETECTION_CONFIDENCE,
  keywordCount,
} from '@/lib/ai-categorizer/keyword-detector'

describe('detectKeyword — matches dos top BR', () => {
  it('STONE PAGAMENTOS S.A → Stone (Vendas)', () => {
    const r = detectKeyword('STONE PAGAMENTOS S.A CARTAO ANTECIP')
    expect(r).toBeTruthy()
    expect(r?.keyword).toBe('STONE')
    expect(r?.displayName).toBe('Stone')
    expect(r?.categoryNameHint).toBe('Vendas')
    expect(r?.dreGroup).toBe('RECEITA_BRUTA')
  })

  it('VERO ANTECIPACAO BANRICARD → adquirente (Vendas) — mais longo casa', () => {
    // BANRICARD (9 chars) tem prioridade vs VERO (4 chars) — ambos resolvem
    // categoryNameHint=Vendas. Comportamento "mais específico ganha".
    const r = detectKeyword('VERO ANTECIPACAO BANRICARD')
    expect(r?.categoryNameHint).toBe('Vendas')
    expect(r?.dreGroup).toBe('RECEITA_BRUTA')
    expect(['Vero', 'Banricard']).toContain(r?.displayName)
  })

  it('VERO ANTECIPACAO sem BANRICARD → Vero', () => {
    const r = detectKeyword('VERO ANTECIPACAO')
    expect(r?.displayName).toBe('Vero')
    expect(r?.categoryNameHint).toBe('Vendas')
  })

  it('VIVO TELECOMUNICACOES → Vivo (Telefonia)', () => {
    const r = detectKeyword('VIVO TELECOMUNICACOES MENSALIDADE')
    expect(r?.displayName).toBe('Vivo')
    expect(r?.categoryNameHint).toBe('Telefonia')
  })

  it('HDI SEGUROS → HDI (Seguros)', () => {
    const r = detectKeyword('HDI SEGUROS APOLICE 12345')
    expect(r?.displayName).toBe('HDI Seguros')
    expect(r?.categoryNameHint).toBe('Seguros')
  })

  it('RG CAPITALIZACAO → RG (Seguros)', () => {
    const r = detectKeyword('RG CAPITALIZACAO TITULO 998')
    expect(r?.displayName).toBe('RG Capitalização')
    expect(r?.dreGroup).toBe('DESPESAS_FINANCEIRAS')
  })

  it('IOF isolado → Tarifas Bancárias', () => {
    const r = detectKeyword('IOF')
    expect(r?.displayName).toBe('IOF')
    expect(r?.categoryNameHint).toBe('Tarifas Bancárias')
  })

  it('Insensível a caixa e acentos', () => {
    const r1 = detectKeyword('stone pagamentos')
    const r2 = detectKeyword('STONE PAGAMENTOS')
    const r3 = detectKeyword('Stóne Pagamentos')
    expect(r1?.keyword).toBe('STONE')
    expect(r2?.keyword).toBe('STONE')
    expect(r3?.keyword).toBe('STONE')
  })
})

describe('detectKeyword — word boundary (anti falso positivo)', () => {
  it('NÃO casa "STONE" dentro de "stoneware"', () => {
    expect(detectKeyword('stoneware ceramica')).toBeNull()
  })

  it('NÃO casa "TIM" dentro de "TIMOTEO"', () => {
    expect(detectKeyword('TIMOTEO LOJA')).toBeNull()
  })

  it('NÃO casa "OI" dentro de "BOI"', () => {
    expect(detectKeyword('FRIGORIFICO BOI BRAVO')).toBeNull()
  })

  it('CASA "OI" como palavra isolada', () => {
    const r = detectKeyword('PAGAMENTO OI FIBRA')
    expect(r?.displayName).toBe('Oi')
  })

  it('"REDE" não casa dentro de "AREDESC"', () => {
    expect(detectKeyword('AREDESC LTDA')).toBeNull()
  })
})

describe('detectKeyword — keywords compostas (múltiplas palavras)', () => {
  it('"MERCADO PAGO" casa como sequência exata', () => {
    const r = detectKeyword('MERCADO PAGO TRANSFER')
    expect(r?.displayName).toBe('Mercado Pago')
  })

  it('"MERCADO PAGO" não casa só "MERCADO"', () => {
    expect(detectKeyword('MERCADO ABERTO LOJA')).toBeNull()
  })

  it('"RG CAPITALIZACAO" casa exato', () => {
    const r = detectKeyword('DEB RG CAPITALIZACAO MENSAL')
    expect(r?.displayName).toBe('RG Capitalização')
  })
})

describe('detectKeyword — descrição vazia / sem match', () => {
  it('string vazia → null', () => {
    expect(detectKeyword('')).toBeNull()
  })

  it('descrição genérica sem keyword → null', () => {
    expect(detectKeyword('PAGAMENTO TITULO 12345')).toBeNull()
  })

  it('apenas dígitos → null', () => {
    expect(detectKeyword('1234567890')).toBeNull()
  })
})

describe('confidence + table size', () => {
  it('KEYWORD_DETECTION_CONFIDENCE = 0.8 (NUNCA AUTO no import)', () => {
    expect(KEYWORD_DETECTION_CONFIDENCE).toBe(0.8)
    expect(KEYWORD_DETECTION_CONFIDENCE).toBeLessThan(0.95)
  })

  it('tabela tem pelo menos 40 keywords (cobertura top BR)', () => {
    expect(keywordCount()).toBeGreaterThanOrEqual(40)
  })
})
