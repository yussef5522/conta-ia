import { describe, it, expect } from 'vitest'
import { suggestSpendCategory } from '@/lib/bridges/suggest-spend-category'

describe('suggestSpendCategory — função pura', () => {
  describe('casos reais das 6 retiradas do Yussef', () => {
    it('COOPERATIVA DE PAIS E MESTRES → Educação', () => {
      const r = suggestSpendCategory('COOPERATIVA DE PAIS E MESTRES')
      expect(r).not.toBeNull()
      expect(r!.categoryName).toBe('Educação')
      expect(r!.confidence).toBeGreaterThanOrEqual(0.85)
    })

    it('RECARGA TELEFONE → Telefone/Celular', () => {
      const r = suggestSpendCategory('RECARGA TELEFONE')
      expect(r).not.toBeNull()
      expect(r!.categoryName).toBe('Telefone/Celular')
    })

    it('RECARGA CELULAR → Telefone/Celular', () => {
      const r = suggestSpendCategory('RECARGA CELULAR')
      expect(r).not.toBeNull()
      expect(r!.categoryName).toBe('Telefone/Celular')
    })

    it('PIX SOLANGE → null (nada óbvio)', () => {
      const r = suggestSpendCategory('PIX SOLANGE')
      expect(r).toBeNull()
    })

    it('LATSCH → null (nome de pessoa)', () => {
      const r = suggestSpendCategory('LATSCH')
      expect(r).toBeNull()
    })

    it('PIX ENVIADO → null (genérico)', () => {
      const r = suggestSpendCategory('PIX ENVIADO')
      expect(r).toBeNull()
    })
  })

  describe('outras categorias', () => {
    it('POSTO IPIRANGA → Transporte', () => {
      const r = suggestSpendCategory('POSTO IPIRANGA')
      expect(r?.categoryName).toBe('Transporte')
    })

    it('UBER 12345 → Transporte', () => {
      const r = suggestSpendCategory('UBER 12345')
      expect(r?.categoryName).toBe('Transporte')
    })

    it('SUPERMERCADO ASUN → Alimentação', () => {
      const r = suggestSpendCategory('SUPERMERCADO ASUN')
      expect(r?.categoryName).toBe('Alimentação')
    })

    it('IFOOD - Pedido 9999 → Alimentação', () => {
      const r = suggestSpendCategory('IFOOD - Pedido 9999')
      expect(r?.categoryName).toBe('Alimentação')
    })

    it('FARMACIA RAIA → Saúde', () => {
      const r = suggestSpendCategory('FARMACIA RAIA')
      expect(r?.categoryName).toBe('Saúde')
    })

    it('NETFLIX BRASIL → Lazer', () => {
      const r = suggestSpendCategory('NETFLIX BRASIL')
      expect(r?.categoryName).toBe('Lazer')
    })

    it('ALUGUEL APTO 405 → Moradia', () => {
      const r = suggestSpendCategory('ALUGUEL APTO 405')
      expect(r?.categoryName).toBe('Moradia')
    })

    it('CEMIG → Contas (luz, água, internet)', () => {
      const r = suggestSpendCategory('CEMIG')
      expect(r?.categoryName).toBe('Contas (luz, água, internet)')
    })

    it('ZARA SHOPPING → Vestuário', () => {
      const r = suggestSpendCategory('ZARA SHOPPING')
      expect(r?.categoryName).toBe('Vestuário')
    })
  })

  describe('Telefone vs Contas — não conflita', () => {
    it('RECARGA TELEFONE → Telefone (não cai em Contas)', () => {
      const r = suggestSpendCategory('RECARGA TELEFONE')
      expect(r?.categoryName).toBe('Telefone/Celular')
    })

    it('VIVO FIBRA → Contas (internet)', () => {
      const r = suggestSpendCategory('VIVO FIBRA 300MB')
      expect(r?.categoryName).toBe('Contas (luz, água, internet)')
    })

    it('CONTA DE LUZ → Contas', () => {
      const r = suggestSpendCategory('CONTA DE LUZ DEZEMBRO')
      expect(r?.categoryName).toBe('Contas (luz, água, internet)')
    })
  })

  describe('edge cases', () => {
    it('null → null', () => {
      expect(suggestSpendCategory(null)).toBeNull()
    })

    it('undefined → null', () => {
      expect(suggestSpendCategory(undefined)).toBeNull()
    })

    it('string vazia → null', () => {
      expect(suggestSpendCategory('')).toBeNull()
    })

    it('só espaços → null', () => {
      expect(suggestSpendCategory('   ')).toBeNull()
    })

    it('confidence sempre ≥ 0.85 quando casa', () => {
      const cases = [
        'COOPERATIVA DE PAIS',
        'RECARGA TELEFONE',
        'POSTO BR',
        'NETFLIX',
        'CEMIG',
      ]
      for (const c of cases) {
        const r = suggestSpendCategory(c)
        expect(r).not.toBeNull()
        expect(r!.confidence).toBeGreaterThanOrEqual(0.85)
        expect(r!.confidence).toBeLessThanOrEqual(1.0)
      }
    })

    it('retorna matchedKeyword pra audit', () => {
      const r = suggestSpendCategory('COOPERATIVA DE PAIS E MESTRES')
      expect(r?.matchedKeyword).toContain('COOPERATIVA')
    })

    it('descrição com sufixo de ponte ("· 30/05/2026") ainda casa', () => {
      const r = suggestSpendCategory(
        'Distribuição de Lucros caçula mix (Yussef) · 30/05/2026 COOPERATIVA DE PAIS',
      )
      expect(r?.categoryName).toBe('Educação')
    })
  })

  describe('não cai em falso positivo', () => {
    it('PIX TRANSFERENCIA → null (sem destino claro)', () => {
      expect(suggestSpendCategory('PIX TRANSFERENCIA')).toBeNull()
    })

    it('TED PARA TERCEIRO → null', () => {
      expect(suggestSpendCategory('TED PARA TERCEIRO')).toBeNull()
    })

    it('BOLETO 12345 → null (sem categoria clara)', () => {
      expect(suggestSpendCategory('BOLETO 12345')).toBeNull()
    })

    it('PAGAMENTO FORNECEDOR → null', () => {
      expect(suggestSpendCategory('PAGAMENTO FORNECEDOR')).toBeNull()
    })
  })
})
