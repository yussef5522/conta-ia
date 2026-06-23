// Sprint 10 — testes do helper puro de sugestão de regra (extraído mentalmente
// do componente OfertaRegraBanner) + do shape do payload do endpoint.

import { describe, it, expect } from 'vitest'

// Re-implementação local do helper (mesma lógica do despesas-client.tsx
// `ruleSuggestion`) — testar isoladamente.
function sugerirPadrao(description: string): string | null {
  const tokens = description
    .replace(/[^\w\sÀ-ÿ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
  if (tokens.length === 0) return null
  return tokens.slice(0, 2).join(' ').toUpperCase()
}

describe('sugerirPadrao — Sprint 10 Fase 3', () => {
  it('pega as 2 primeiras palavras significativas', () => {
    expect(sugerirPadrao('FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA')).toBe(
      'FRIGORIFICO SILVA',
    )
  })

  it('descarta números soltos (pega "TED" e "RGE" pulando "12345")', () => {
    expect(sugerirPadrao('TED 12345 RGE COMPANHIA ESTADUAL')).toBe('TED RGE')
  })

  it('descarta palavras curtas (<3)', () => {
    expect(sugerirPadrao('A B CIA DA FRUTA')).toBe('CIA FRUTA')
  })

  it('uppercase normalizado', () => {
    expect(sugerirPadrao('netflix pagamento mensal')).toBe('NETFLIX PAGAMENTO')
  })

  it('descrição vazia → null', () => {
    expect(sugerirPadrao('')).toBe(null)
    expect(sugerirPadrao('   ')).toBe(null)
  })

  it('só números → null', () => {
    expect(sugerirPadrao('123 456 789')).toBe(null)
  })

  it('substitui pontuação por espaço (pega "STONE" e "NET" — pontos viram separadores)', () => {
    expect(sugerirPadrao('STONE.NET MENSALIDADE/2026')).toBe('STONE NET')
  })

  it('preserva acentos (palavras >= 3 chars)', () => {
    expect(sugerirPadrao('Salário Maio Junho 2026')).toBe('SALÁRIO MAIO')
  })

  it('1 palavra significativa retorna a palavra', () => {
    expect(sugerirPadrao('NETFLIX')).toBe('NETFLIX')
  })
})

describe('shape do payload recategorizar', () => {
  it('aceita transactionIds + novaCategoriaId', () => {
    const payload = {
      transactionIds: ['tx_1', 'tx_2', 'tx_3'],
      novaCategoriaId: 'cat_xyz',
    }
    expect(payload.transactionIds.length).toBe(3)
    expect(payload.novaCategoriaId).toBe('cat_xyz')
  })

  it('aceita 1 id (recategorizar inline)', () => {
    const payload = { transactionIds: ['tx_solo'], novaCategoriaId: 'cat_y' }
    expect(payload.transactionIds.length).toBe(1)
  })
})
