// ⛔⛔ PRODUTO DE VENDA NÃO ENTRA NA BUSCA DE ORDEM DE PRODUÇÃO (01/09/2026).
//
// O dono abriu "nova ordem" e viu **XIS COMPLETO e PIZZA PEQUENA 25CM** na busca — fichas
// de PRODUTO_FINAL criadas pelo cardápio no dia anterior. Produto de venda é **montado na
// hora do pedido**, não produzido em lote: uma ordem de produção pra um xis não significa
// nada, e a separação explodiria os componentes dele na câmara.
//
// ⚠️ E ia piorar rápido — o dono vai fichar os **~77 produtos do cardápio**. A busca de
// ordem ficaria inutilizável: 77 itens que nunca deveriam estar ali afogando os 8 que sim.
//
// ⚠️ A REGRA JÁ EXISTIA, mas como LITERAL dentro da tela de Receitas
// (`.filter((f) => f.tipoProduto === 'INTERMEDIARIO')`), e o `NovaOrdem` simplesmente não
// filtrava. Duas telas, a mesma pergunta, uma resposta só implementada — a doença de
// sempre. Agora as duas chamam `ehReceitaDeProducao`.

import { describe, it, expect } from 'vitest'
import { ehReceitaDeProducao, TIPO_RECEITA_PRODUCAO } from '../tipo-receita'

/** as fichas REAIS da Caçula em 01/09 */
const FICHAS = [
  { id: 'f1', nomeProduzido: 'porçao queijo 135 grama', tipoProduto: 'INTERMEDIARIO' },
  { id: 'f2', nomeProduzido: 'porcao de carne 100 grama', tipoProduto: 'INTERMEDIARIO' },
  { id: 'f3', nomeProduzido: 'beef de xis', tipoProduto: 'INTERMEDIARIO' },
  { id: 'f4', nomeProduzido: 'XIS COMPLETO', tipoProduto: 'PRODUTO_FINAL' },
  { id: 'f5', nomeProduzido: 'PIZZA PEQUENA 25CM', tipoProduto: 'PRODUTO_FINAL' },
]

describe('⛔⛔ a busca de nova ordem só oferece receita de PRODUÇÃO', () => {
  it('⛔⛔ XIS COMPLETO e PIZZA (PRODUTO_FINAL) ficam FORA', () => {
    const oferecidas = FICHAS.filter(ehReceitaDeProducao).map((f) => f.nomeProduzido)
    expect(oferecidas).not.toContain('XIS COMPLETO')
    expect(oferecidas).not.toContain('PIZZA PEQUENA 25CM')
  })

  it('⭐ e a porção de queijo (INTERMEDIARIO) APARECE — o filtro não come o que serve', () => {
    const oferecidas = FICHAS.filter(ehReceitaDeProducao).map((f) => f.nomeProduzido)
    expect(oferecidas).toEqual([
      'porçao queijo 135 grama', 'porcao de carne 100 grama', 'beef de xis',
    ])
  })

  it('⛔ SEM o filtro, as duas de venda voltam — é o estado que o dono viu', () => {
    // red-then-green explícito: a lista crua é o bug.
    expect(FICHAS.map((f) => f.nomeProduzido)).toContain('XIS COMPLETO')
    expect(FICHAS).toHaveLength(5)
    expect(FICHAS.filter(ehReceitaDeProducao)).toHaveLength(3)
  })

  it('⚠️ e com os ~77 produtos do cardápio fichados, a busca continua com 3', () => {
    // ⚠️ o motivo de isto ser urgente e não cosmético: sem o filtro, a busca iria a 80.
    const comCardapioInteiro = [
      ...FICHAS,
      ...Array.from({ length: 77 }, (_, i) => ({ id: `p${i}`, nomeProduzido: `PRODUTO ${i}`, tipoProduto: 'PRODUTO_FINAL' })),
    ]
    expect(comCardapioInteiro).toHaveLength(82)
    expect(comCardapioInteiro.filter(ehReceitaDeProducao)).toHaveLength(3)
  })

  it('⭐ a régua é UMA — a tela de Receitas e a de nova ordem chamam a mesma', () => {
    expect(TIPO_RECEITA_PRODUCAO).toBe('INTERMEDIARIO')
    // ⚠️ tipo desconhecido não passa por acidente (se um TIPO novo nascer, ele fica FORA
    // até alguém decidir — o default seguro é não oferecer).
    expect(ehReceitaDeProducao({ tipoProduto: 'REVENDA' })).toBe(false)
    expect(ehReceitaDeProducao({ tipoProduto: '' })).toBe(false)
  })
})
