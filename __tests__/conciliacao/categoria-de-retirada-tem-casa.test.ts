// ⭐⭐⭐ RETIRADA TEM CASA PRÓPRIA NO MENU — E NÃO VIRA DESPESA (17/09/2026)
//
// **O dono:** *"o PIX pra uma pessoa que é a retirada do dono não tem onde morar. (…)
// **nunca forçar retirada a virar despesa pra caber no menu.**"*
//
// ⚠️ As 5 categorias de retirada da Caçula **já são `EXPENSE`** com
// `dreGroup: DISTRIBUICAO_LUCROS` (medido em prod) — o filtro nunca as excluiu. O que as
// escondia era o MENU: 50 opções chapadas, sem dizer que aquelas cinco são outra classe
// de dinheiro. A cura NOMEIA a classe; não move nada de grupo.

import { describe, it, expect } from 'vitest'
import { secoesDoMenu, totalDeOpcoes, GRUPO_RETIRADA } from '@/lib/conciliacao/categorias-do-gesto'

/** ⭐ as categorias REAIS da Caçula (medidas em prod em 17/09), não fixture inventada */
const PROD = [
  { id: 'c1', name: 'Distribuição de Lucros', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  { id: 'c2', name: 'Pró-labore Sócios', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  { id: 'c3', name: 'Retirada de Lucros / Pró-labore', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  { id: 'c4', name: 'INSS sobre Pró-labore', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  { id: 'c5', name: 'Pró-labore e Distribuição', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS' },
  { id: 'd1', name: 'Matéria-Prima - Alimentos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO' },
  { id: 'd2', name: 'Salários', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL' },
  { id: 'd3', name: 'Tarifas Bancárias', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS' },
  { id: 'a1', name: 'A classificar', type: 'EXPENSE', dreGroup: 'A_CLASSIFICAR' },
  { id: 'r1', name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  { id: 'r2', name: 'Aporte de Capital', type: 'INCOME', dreGroup: 'APORTES_CAPITAL' },
  { id: 'r3', name: 'Liberação de Empréstimo', type: 'INCOME', dreGroup: 'APORTES_CAPITAL' },
]

describe('⭐⭐ o PIX da FRANCIELE acha a Distribuição de Lucros', () => {
  const secoes = secoesDoMenu(PROD, 'SAIDA')

  it('⭐ a retirada tem SEÇÃO própria, e ela vem primeiro', () => {
    expect(secoes[0].titulo).toContain('retirada')
    expect(secoes[0].itens.map((c) => c.name)).toContain('Distribuição de Lucros')
  })

  it('⛔ e a seção DIZ o que aquela classe é — cabeçalho sem explicação vira enfeite', () => {
    expect(secoes[0].ajuda).toMatch(/não é despesa operacional/i)
  })

  it('⛔⛔ NADA é forçado a virar despesa: as 5 saem da seção de despesa', () => {
    const despesa = secoes.find((s) => s.titulo.includes('despesa operacional'))!
    for (const nome of ['Distribuição de Lucros', 'Pró-labore Sócios', 'Retirada de Lucros / Pró-labore']) {
      expect(despesa.itens.map((c) => c.name), `${nome} está listada como despesa operacional`).not.toContain(nome)
    }
    expect(secoes.find((s) => s.titulo.includes('retirada'))!.itens).toHaveLength(5)
  })

  it('⭐ o dreGroup é quem separa — NUNCA o nome da categoria', () => {
    // uma categoria com "lucro" no nome mas de outro grupo NÃO entra na retirada
    const comIsca = [...PROD, { id: 'x', name: 'Seguro de lucros cessantes', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }]
    const s = secoesDoMenu(comIsca, 'SAIDA')
    expect(s.find((x) => x.titulo.includes('retirada'))!.itens.map((c) => c.name))
      .not.toContain('Seguro de lucros cessantes')
    expect(GRUPO_RETIRADA).toBe('DISTRIBUICAO_LUCROS')
  })

  it('⛔ a fila de triagem NUNCA é destino (escolher "a classificar" não classifica nada)', () => {
    expect(totalDeOpcoes(secoes)).toBe(8)
    expect(JSON.stringify(secoes)).not.toContain('A classificar')
  })

  it('⛔ e nenhuma categoria de RECEITA aparece numa saída', () => {
    expect(JSON.stringify(secoes)).not.toContain('Receita de Vendas')
  })
})

describe('⭐ na ENTRADA, dívida e capital não se misturam com faturamento', () => {
  const secoes = secoesDoMenu(PROD, 'ENTRADA')

  it('⭐ aporte/liberação tem seção própria — a régua de 26/08 aparecendo no menu', () => {
    const aporte = secoes.find((s) => s.titulo.includes('aporte'))!
    expect(aporte.itens.map((c) => c.name).sort()).toEqual(['Aporte de Capital', 'Liberação de Empréstimo'])
    expect(aporte.ajuda).toMatch(/não é venda/i)
  })

  it('⛔ e despesa nenhuma aparece numa entrada', () => {
    expect(JSON.stringify(secoes)).not.toContain('Salários')
  })
})

describe('⛔ seção vazia não aparece — cabeçalho sobre lista vazia promete destino que não há', () => {
  it('⭐ empresa sem categoria de retirada mostra só a de despesa', () => {
    const semRetirada = PROD.filter((c) => c.dreGroup !== 'DISTRIBUICAO_LUCROS')
    const s = secoesDoMenu(semRetirada, 'SAIDA')
    expect(s).toHaveLength(1)
    expect(s[0].titulo).toContain('despesa operacional')
  })

  it('⭐ lista vazia devolve ZERO seção (a tela é que diz o porquê)', () => {
    expect(secoesDoMenu([], 'SAIDA')).toEqual([])
    expect(totalDeOpcoes(secoesDoMenu([], 'ENTRADA'))).toBe(0)
  })
})

describe('⛔⛔ INATIVA nunca é destino — a prova em prod pegou 203 armadilhas', () => {
  /**
   * ⚠️ A rota devolve o catálogo INTEIRO: **263 categorias na Caçula, 60 ativas**. Oferecer
   * as 203 inativas é a família do defeito de 17/09 na fatura do cartão — *o que a tela
   * oferece tem que ser SUBCONJUNTO do que a gravação aceita*.
   */
  const COM_INATIVAS = [
    { id: 'v1', name: 'Distribuição de Lucros', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', isActive: true },
    { id: 'v2', name: 'Salários', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', isActive: true },
    { id: 'm1', name: 'Retirada ANTIGA (desativada)', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', isActive: false },
    { id: 'm2', name: 'Despesa ANTIGA (desativada)', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', isActive: false },
  ]

  it('⭐ a inativa some das DUAS seções', () => {
    const s = secoesDoMenu(COM_INATIVAS, 'SAIDA')
    expect(totalDeOpcoes(s)).toBe(2)
    expect(JSON.stringify(s)).not.toContain('desativada')
  })

  it('⭐ e a trava vale mesmo se a chamada esquecer o ?soAtivas=true', () => {
    // a régua é pura: não depende de quem chamou a rota
    expect(secoesDoMenu(COM_INATIVAS, 'SAIDA').find((x) => x.titulo.includes('retirada'))!.itens)
      .toHaveLength(1)
  })

  it('⛔ fonte que NÃO informa isActive continua valendo (não esvazia em silêncio)', () => {
    const semCampo = [{ id: 'x', name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS' }]
    expect(totalDeOpcoes(secoesDoMenu(semCampo, 'SAIDA'))).toBe(1)
  })
})
