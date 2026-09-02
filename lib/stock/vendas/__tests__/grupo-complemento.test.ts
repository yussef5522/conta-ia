// ⭐⭐ SABOR × OUTRO — a régua do cardápio, com os 121 nomes REAIS de prod (02/09).
//
// ⚠️ A amostra abaixo é o relatório de complementos de 29/08 medido no banco de produção
// (121 nomes · 651 ocorrências). Ela existe pra o teste falar do mundo real, não de um
// cenário confortável que eu inventei.

import { describe, it, expect } from 'vitest'
import { grupoPeloCardapio, normalizarNome, saboresSemVenda, variacoesDeSabor, SABORES_DO_CARDAPIO } from '../grupo-complemento'

/** os 121 nomes de 29/08 em prod (amostra fiel; sem PII, é nome de prato) */
const NOMES_PROD = [
  'CALABRESA', 'MAIONESE CASEIRA', 'FRANGO', '4 QUEIJOS', 'PAULISTA', 'BACON', 'MUSSARELA',
  '5 QUEIJOS', 'NAPOLITANA', 'MARGHERITA', 'FRANGO COM CATUPIRY', 'PORTUGUESA', 'FILE DA CASA',
  'STROGONOFF DE CARNE', 'STROGONOFF DE FRANGO', 'FILE CRISPY', 'FILE AOS 3 MOLHOS',
  'BROCOLIS COM BACON', 'COCA LATA MAIS MINI FRITAS', 'COCA COLA 2L',
  'BATATA FRITA EM CIMA DA PIZZA', 'FILE ESPECIAL', 'ENTREVERO', 'LEITE CONDENSADO',
  'FILE COM CHEDDAR', 'ADICIONE CEBOLA', 'CALABRESA ACEBOLADA',
  'COCA COLA ZERO LATA MAIS MINI FRITAS', 'ADICIONE ANEIS DE CEBOLA', 'GRANULADO',
  'FILE MIGNON', 'FILE MOSTARDA E MEL', 'MAIONESE CASEIRA COM ALHO', 'CREME DE AVELA',
  'padrão', 'BARBECUE', 'FRANGO COM BARBECUE', 'XIS - BACON', 'STROGONOFF DE CARNE FAMILIA',
  'FILE BACONNAISE', 'ovo', 'FRANGO AOS 3 MOLHOS', 'pao de xis', 'FILE COM BACON',
  'BROCOLIS COM CATUPIRY', 'OURO BRANCO', 'FILE', 'FILE ALHO E OLEO', 'FRANGO COM CHEDDAR',
  'FANTA UVA 2L', 'CHEF', 'ADICIONE CEBOLA CARAMELIZADA', 'XIS - CALABRESA', 'FILE ACEBOLADO',
  'BROCOLIS', 'ADICIONE BURGER CARNE 180G', 'MEDIO', 'GRANDE', 'FRANGO COM BACON',
  'ADICIONE ISQUINHAS DE FRANGO', 'FILE CATUPIRY', 'LEITE EM PO', 'BORDA CHOCOLATE PRETO',
  'FRANGO CHINES', 'COCA COLA LATA', 'ITALIANINHA', 'MILHO', 'não desejo refrigerante',
  'COCA ZERO 2L', 'FILE COM PALHA', 'FANTA LARANJA LATA', 'ADICIONE MUSSARELA EMPANADO',
  'PIZZA - FILE COM BROCOLIS', 'ADICIONE FRANGO EMPANADO', 'PEQUENO', 'CONFETE', 'PAÇOCA',
  'ADICIONE QUEIJO CHEDDAR', 'MOLHO MOSTARDA E MEL', 'CHOCOLATE BRANCO',
  'não desejo borda recheada', 'COCA COLA ZERO LATA', 'FEIJAO', 'GUARANA FRUKI ZERO LATA',
  'XIS - FRANGO', 'BORDA CATUPIRY', 'CHARGE', 'pizza pequena (25cm)', 'ADICIONE FILE DE FRANGO',
  'XIS - COXAO MOLE', 'BORDA CHEDDAR', 'KETCHUP', 'BORDA MUSSARELA GRANDE', 'frango com bacon',
  'coca cola 2l', 'Coca Lata + Mini Fritas', 'MMS', 'CAIPIRA MIX',
  'BORDA MUSSARELA COM CATUPIRY FAMILIA', 'FRUKI ZERO LATA MAIS MINI FRITAS', 'MILHO ESPECIAL',
  'barbecue', 'PIZZA PEQUENA NUTELLA', 'PIZZA PEQUENA CHOCOLATE BRANCO', 'BORDA KITKAT',
  'BASCA', 'filé acebolado', 'MILHO COM BACON', 'maionese picante', 'VEGETARIANA',
  'MAIONESE PICANTE', 'não desejo adicionais', 'SABOR CREME DE AVELA PROMO', 'BIS',
  'MUSSARELA ACEBOLADA', 'ADICIONE OVO FRITO', 'STROGONOFF DE CARNEE', 'maionese caseira',
  'FRUKI LATA MAIS MINI FRITAS', 'ADICIONE BACON', 'BACON ACEBOLADO',
]

describe('⭐ a normalização junta o que é o mesmo prato', () => {
  it('⭐⭐ caixa e acento não separam — o PDV escreve dos dois jeitos', () => {
    // casos REAIS da tabela: 'filé acebolado' e 'FILE ACEBOLADO' convivem lá
    expect(normalizarNome('filé acebolado')).toBe(normalizarNome('FILE ACEBOLADO'))
    expect(normalizarNome('frango com bacon')).toBe(normalizarNome('FRANGO COM BACON'))
    expect(normalizarNome('  coca   cola 2l ')).toBe('COCA COLA 2L')
  })

  it('⭐ e os dois viram SABOR, não um sim e outro não', () => {
    expect(grupoPeloCardapio('filé acebolado')).toBe('SABOR')
    expect(grupoPeloCardapio('FILE ACEBOLADO')).toBe('SABOR')
  })
})

describe('⭐⭐ o que é SABOR e o que é OUTRO nos 121 nomes reais', () => {
  const sabores = NOMES_PROD.filter((n) => grupoPeloCardapio(n) === 'SABOR')
  const outros = NOMES_PROD.filter((n) => grupoPeloCardapio(n) === 'OUTRO')

  it('⭐⭐ a maioria das ocorrências é sabor, mas a maioria dos NOMES não é', () => {
    expect(sabores.length).toBeGreaterThan(40)
    expect(outros.length).toBeGreaterThan(50)
    expect(sabores.length + outros.length).toBe(NOMES_PROD.length)
  })

  it('⛔ tamanho e resposta de formulário NUNCA são sabor — é o que vai pro IGNORAR', () => {
    for (const n of ['GRANDE', 'MEDIO', 'PEQUENO', 'padrão', 'não desejo borda recheada', 'não desejo adicionais'])
      expect(grupoPeloCardapio(n), n).toBe('OUTRO')
  })

  it('⛔ borda, adicional, combo de bebida e xis também não', () => {
    for (const n of ['BORDA CATUPIRY', 'ADICIONE OVO FRITO', 'COCA LATA MAIS MINI FRITAS', 'XIS - BACON', 'KETCHUP'])
      expect(grupoPeloCardapio(n), n).toBe('OUTRO')
  })

  it('⭐ e os campeões de venda caem certos', () => {
    for (const n of ['CALABRESA', 'FRANGO', '4 QUEIJOS', 'PAULISTA', 'BACON', 'MUSSARELA'])
      expect(grupoPeloCardapio(n), n).toBe('SABOR')
    expect(grupoPeloCardapio('MAIONESE CASEIRA')).toBe('OUTRO') // 2º em ocorrências e NÃO é sabor
  })

  it('⚠️ "FILE" sozinho não é sabor do cardápio — fica em OUTROS até o dono decidir', () => {
    // ⛔ tentador casar com "FILE MIGNON"/"FILE DA CASA" por prefixo; seria adivinhar.
    expect(grupoPeloCardapio('FILE')).toBe('OUTRO')
  })
})

describe('⭐⭐ CONFERÊNCIA — sabor do cardápio que nunca vendeu', () => {
  it('⭐⭐ nomeia quem falta, em vez de deixar sumir em silêncio', () => {
    const faltando = saboresSemVenda(NOMES_PROD)
    // MEXICANA e HOT DOG estão no cardápio e não aparecem no relatório de 29/08
    expect(faltando).toContain('MEXICANA')
    expect(faltando).toContain('HOT DOG')
    expect(faltando).toContain('PIZZA ATUM')
    expect(faltando).toContain('KIT KAT')
    expect(faltando).toContain('CHOCOLATE PRETO')
    // e quem vendeu NÃO aparece na lista de faltantes
    expect(faltando).not.toContain('CALABRESA')
    expect(faltando).not.toContain('BASCA')
  })

  it('⭐ os 52 do cardápio estão todos na régua (nada se perdeu na transcrição)', () => {
    expect(new Set(SABORES_DO_CARDAPIO.map(normalizarNome)).size).toBe(SABORES_DO_CARDAPIO.length)
    expect(SABORES_DO_CARDAPIO.length).toBeGreaterThanOrEqual(52)
  })
})

describe('⭐ VARIAÇÕES — lista, nunca casa sozinho', () => {
  it('⭐⭐ acha a variação de tamanho de porção do mesmo sabor', () => {
    const v = variacoesDeSabor(NOMES_PROD)
    const nomes = v.map((x) => x.nome)
    expect(nomes).toContain('STROGONOFF DE CARNE FAMILIA')
    expect(v.find((x) => x.nome === 'STROGONOFF DE CARNE FAMILIA')?.pareceCom).toBe('STROGONOFF DE CARNE')
  })

  it('⛔ e NÃO promove nada: variação continua fora do grupo SABOR', () => {
    // ⚠️ é o dono quem faz o vínculo N:1 — casar sozinho faria a promo baixar a ficha errada
    expect(grupoPeloCardapio('STROGONOFF DE CARNE FAMILIA')).toBe('OUTRO')
    expect(grupoPeloCardapio('SABOR CREME DE AVELA PROMO')).toBe('OUTRO')
  })

  it('⚠️ sabor exato do cardápio nunca entra na lista de variação', () => {
    const v = variacoesDeSabor(NOMES_PROD).map((x) => x.nome)
    for (const n of ['MILHO ESPECIAL', 'MILHO COM BACON', 'CALABRESA ACEBOLADA', 'BACON ACEBOLADO'])
      expect(v, n).not.toContain(n)
  })
})
