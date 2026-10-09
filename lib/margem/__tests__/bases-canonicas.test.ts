/**
 * ⭐ A COMPOSIÇÃO CANÔNICA DAS BASES — testes PUROS, com os números REAIS da Caçula.
 *
 * ⛔ O caso que dá nome a este arquivo é o **«Combo Caçula»**: ele passou pela 1ª versão da
 * régua estrutural e a proposta DESTRUIRIA a receita dele (R$ 15,18 → R$ 6,94) no produto de
 * maior faturamento do cardápio. Os dois testes que o isolam estão marcados.
 */
import { describe, it, expect } from 'vitest'
import {
  COMPOSICAO,
  classificarBase,
  composicaoProposta,
  conferirBaseDeTamanho,
  ehBaseDeTamanho,
  motivoDaDoseADeclarar,
  type ComponenteDaFicha,
  type ItensDaBase,
} from '../bases-canonicas'

const ITENS: ItensDaBase = {
  massa: 'i-massa',
  queijo: 'i-queijo',
  caixa: { PEQUENA: 'i-cx25', GRANDE: 'i-cx35', FAMILIA: 'i-cx45' },
  molho: 'i-molho',
}
const c = (itemId: string, qtd: number): ComponenteDaFicha => ({ itemId, qtdPlanejada: qtd, unidade: 'UN' })

describe('a composição é a declaração do dono', () => {
  it('pequena 1·1·1 · grande 2·2·1 · família 3·3·1', () => {
    expect(COMPOSICAO.PEQUENA).toEqual({ massa: 1, queijo: 1, caixa: 1 })
    expect(COMPOSICAO.GRANDE).toEqual({ massa: 2, queijo: 2, caixa: 1 })
    expect(COMPOSICAO.FAMILIA).toEqual({ massa: 3, queijo: 3, caixa: 1 })
  })

  it('a proposta sai na ordem massa · queijo · caixa, com a caixa DO tamanho', () => {
    expect(composicaoProposta('GRANDE', 1, ITENS)).toEqual([
      c('i-massa', 2),
      c('i-queijo', 2),
      c('i-cx35', 1),
    ])
    expect(composicaoProposta('FAMILIA', 1, ITENS)[2]).toEqual(c('i-cx45', 1))
  })

  it('⭐ o multiplicador escala TUDO — `PROMO 2 PIZZAS GRANDES` é 2× a canônica', () => {
    expect(composicaoProposta('GRANDE', 2, ITENS)).toEqual([
      c('i-massa', 4),
      c('i-queijo', 4),
      c('i-cx35', 2),
    ])
  })
})

describe('a régua que separa BASE de PRODUTO PRONTO é estrutural', () => {
  it('base de verdade (as 11 da Caçula) passa', () => {
    // PIZZA GRANDE 35CM como está hoje (sem massa) — ainda é base, só está incompleta
    expect(ehBaseDeTamanho([c('i-queijo', 2), c('i-cx35', 1)], ITENS)).toBe(true)
    // PIZZA GRANDE PRECINHO como está hoje (sem caixa)
    expect(ehBaseDeTamanho([c('i-queijo', 2), c('i-massa', 2)], ITENS)).toBe(true)
    // Pizza Grande (35cm): só queijo
    expect(ehBaseDeTamanho([c('i-queijo', 2)], ITENS)).toBe(true)
  })

  it('⛔ produto pronto com sabor embutido NÃO é base (PIZZA CALABRESA CONGELADA)', () => {
    expect(ehBaseDeTamanho([c('i-queijo', 1), c('i-porcao-calabresa', 1)], ITENS)).toBe(false)
  })

  it('ficha sem componente não é base', () => {
    expect(ehBaseDeTamanho([], ITENS)).toBe(false)
  })

  /**
   * ⛔⛔ O CASO QUE A 1ª VERSÃO DEIXOU PASSAR — e ele vale os dois testes abaixo.
   * O «Combo Caçula» real: 2 queijo + caixa 35 + 3 massa + caixa 25.
   */
  it('⛔⛔ COMBO CAÇULA: caixa de DOIS tamanhos na mesma ficha não é base', () => {
    const combo = [c('i-queijo', 2), c('i-cx35', 1), c('i-massa', 3), c('i-cx25', 1)]
    expect(ehBaseDeTamanho(combo, ITENS)).toBe(false)
  })

  /**
   * ⚠️⚠️ ESTE TESTE NASCEU DE UM VERDE DA REGRA 11. O caso do Combo acima viola AS DUAS
   * travas (caixa dupla **e** massa 3 ≠ queijo 2) — então, com a trava da caixa removida, a
   * outra segurava e o teste passava: *reposição que não reproduz o defeito é um verde de
   * graça*. O caso que ISOLA a caixa é o BALANCEADO: combo de uma grande + uma pequena.
   */
  it('⛔⛔ caixa dupla com massa BALANCEADA não é base (isola a 1ª trava)', () => {
    const comboBalanceado = [c('i-massa', 2), c('i-queijo', 2), c('i-cx35', 1), c('i-cx25', 1)]
    expect(ehBaseDeTamanho(comboBalanceado, ITENS)).toBe(false)
  })

  it('⛔⛔ COMBO CAÇULA: massa (3) diferente do queijo (2) não é base — a canônica é N:N', () => {
    // mesma ficha, mas com UMA caixa só: a 2ª trava é que tem que morder aqui
    const desbalanceado = [c('i-queijo', 2), c('i-massa', 3), c('i-cx35', 1)]
    expect(ehBaseDeTamanho(desbalanceado, ITENS)).toBe(false)
  })

  it('⚠️ a MESMA caixa 2× continua passando — é combo do mesmo tamanho (PROMO 2 PIZZAS)', () => {
    expect(ehBaseDeTamanho([c('i-queijo', 4), c('i-cx35', 2)], ITENS)).toBe(true)
  })
})

describe('a classificação diz o tamanho ou PERGUNTA', () => {
  it('⭐ o nome que diz o tamanho é CLARO', () => {
    for (const [nome, t] of [
      ['PIZZA GRANDE 35CM', 'GRANDE'],
      ['GRANDE PRECINHO', 'GRANDE'],
      ['PIZZA FAMILIA 45CM', 'FAMILIA'],
      ['PIZZA FAMILIA PRECINHO', 'FAMILIA'],
      ['PIZZA PEQUENA 25CM', 'PEQUENA'],
      ['Pizza Família (45cm)', 'FAMILIA'], // ⚠️ com acento, que o normalizador tira
    ] as const) {
      const r = classificarBase({ nome, componentes: [c('i-queijo', 2)], itens: ITENS })
      expect(r.tamanho, nome).toBe(t)
      expect(r.confianca, nome).toBe('CLARO')
      expect(r.multiplicador, nome).toBe(1)
    }
  })

  it('⚠️ mais de uma pizza no nome SEMPRE pergunta (PROMO 2 PIZZAS GRANDES)', () => {
    const r = classificarBase({
      nome: 'PROMO 2 PIZZAS GRANDES',
      componentes: [c('i-queijo', 4), c('i-cx35', 2)],
      itens: ITENS,
    })
    expect(r.tamanho).toBe('GRANDE')
    expect(r.multiplicador).toBe(2)
    expect(r.confianca).toBe('PERGUNTA')
    expect(r.porque).toContain('2 pizzas')
  })

  /**
   * ⚠️⚠️ OS DOIS TESTES ABAIXO FORAM INVERTIDOS EM 08/10, com o motivo escrito: eles afirmavam
   * que `Pizza (Aiq)` **PERGUNTA** pela evidência — e isso era o mundo ANTES da régua do dono.
   * Em 08/10 ele declarou: *"nome SEM tamanho = GRANDE; nome com FAMÍLIA depois do Aiq =
   * FAMÍLIA — vale pra qualquer produto Aiq futuro"*. ⭐ A metade que continua valendo (a
   * EVIDÊNCIA segue existindo e sendo dita pra nome sem régua nenhuma) está travada nos dois
   * testes seguintes, com um nome que não é de canal.
   */
  it('⭐ a RÉGUA DO CANAL decide: nome de canal sem palavra de tamanho é GRANDE', () => {
    for (const comps of [
      [c('i-queijo', 2), c('i-cx35', 1)], // com a caixa de grande (concorda com a régua)
      [c('i-queijo', 2), c('i-massa', 2)], // o caso REAL do Pizza (Aiq): sem caixa nenhuma
      [c('i-massa', 2)], // ⭐ sem evidência nenhuma — e a régua resolve sozinha
    ]) {
      const r = classificarBase({ nome: 'Pizza (Aiq)', componentes: comps, itens: ITENS })
      expect(r.tamanho).toBe('GRANDE')
      expect(r.confianca).toBe('CLARO')
      expect(r.regra).toBe('CANAL_SEM_TAMANHO_E_GRANDE')
      expect(r.porque).toContain('régua do dono')
    }
  })

  it('⭐ a PALAVRA ganha da régua do canal — «Pizza Aiq Família» é FAMILIA', () => {
    // é a 2ª metade da régua de 08/10, e ela sai de graça: a palavra é conferida ANTES do canal
    const r = classificarBase({ nome: 'Pizza Aiq Família', componentes: [c('i-queijo', 2)], itens: ITENS })
    expect(r.tamanho).toBe('FAMILIA')
    expect(r.confianca).toBe('CLARO')
    expect(r.regra).toBe('PALAVRA_DO_NOME')
  })

  it('⛔⛔ a régua do canal NÃO sobrescreve evidência que a contradiz — volta a PERGUNTAR', () => {
    // a trava que o «Combo Caçula» ensinou: aplicar GRANDE numa ficha com composição de PEQUENA
    // trocaria o custo de todo dia por um número plausível e errado
    const r = classificarBase({
      nome: 'Pizza (Aiq)',
      componentes: [c('i-queijo', 1), c('i-cx25', 1)],
      itens: ITENS,
    })
    expect(r.tamanho).toBe('PEQUENA')
    expect(r.confianca).toBe('PERGUNTA')
    expect(r.regra).toBe('CANAL_CONTRA_EVIDENCIA')
    expect(r.porque).toContain('o dono decide')
  })

  it('⚠️ nome SEM régua nenhuma usa a CAIXA como evidência, e PERGUNTA', () => {
    const r = classificarBase({ nome: 'Pizza Surpresa', componentes: [c('i-queijo', 2), c('i-cx35', 1)], itens: ITENS })
    expect(r.tamanho).toBe('GRANDE')
    expect(r.confianca).toBe('PERGUNTA')
    expect(r.regra).toBe('EVIDENCIA_DA_CAIXA')
    expect(r.porque).toContain('caixa')
  })

  it('⚠️ sem caixa, a evidência é a contagem de queijo', () => {
    const r = classificarBase({ nome: 'Pizza Surpresa', componentes: [c('i-queijo', 2), c('i-massa', 2)], itens: ITENS })
    expect(r.tamanho).toBe('GRANDE')
    expect(r.confianca).toBe('PERGUNTA')
    expect(r.regra).toBe('EVIDENCIA_DO_QUEIJO')
    expect(r.porque).toContain('queijo')
  })

  it('⚠️ canal COM combo de N pizzas não é CLARO — a régua do canal não cobre combo', () => {
    const r = classificarBase({
      nome: 'PROMO 2 PIZZAS (Aiq)',
      componentes: [c('i-queijo', 4), c('i-cx35', 2)],
      itens: ITENS,
    })
    expect(r.multiplicador).toBe(2)
    expect(r.confianca).toBe('PERGUNTA')
  })

  it('⛔ sem nome nem evidência, devolve null — nunca chuta um tamanho', () => {
    const r = classificarBase({ nome: 'Pizza Surpresa', componentes: [c('i-massa', 7)], itens: ITENS })
    expect(r.tamanho).toBeNull()
    expect(r.confianca).toBe('PERGUNTA')
  })

  it('⚠️ `PIZZA GRANDE CALABRESA` ainda resolve GRANDE — a palavra do sabor não vira tamanho', () => {
    // a trava contra isto virar BASE é estrutural (`ehBaseDeTamanho`), não do nome
    const r = classificarBase({ nome: 'PIZZA GRANDE CALABRESA', componentes: [c('i-queijo', 2)], itens: ITENS })
    expect(r.tamanho).toBe('GRANDE')
  })
})

describe('⭐⭐ O GUARD DO DONO: base de tamanho sem massa + queijo + caixa é vermelho', () => {
  it('a canônica completa passa', () => {
    expect(conferirBaseDeTamanho(composicaoProposta('GRANDE', 1, ITENS), ITENS)).toEqual({
      completa: true,
      faltando: [],
    })
  })

  it('⛔ os 3 estados REAIS de prod, cada um nomeando o que falta', () => {
    // PIZZA GRANDE 35CM e GRANDE PRECINHO: falta a MASSA
    expect(conferirBaseDeTamanho([c('i-queijo', 2), c('i-cx35', 1)], ITENS).faltando).toEqual(['massa'])
    // PIZZA GRANDE PRECINHO: falta a CAIXA
    expect(conferirBaseDeTamanho([c('i-queijo', 2), c('i-massa', 2)], ITENS).faltando).toEqual(['caixa'])
    // Pizza Grande (35cm): faltam as DUAS
    expect(conferirBaseDeTamanho([c('i-queijo', 2)], ITENS).faltando).toEqual(['massa', 'caixa'])
  })

  it('⛔⛔ MOLHO É ISENTO — cobrar dose que ninguém pode preencher sem inventar viraria alarme eterno', () => {
    const r = conferirBaseDeTamanho(composicaoProposta('FAMILIA', 1, ITENS), ITENS)
    expect(r.completa).toBe(true)
    expect(r.faltando).not.toContain('molho')
  })

  it('⚠️ quantidade ZERO não conta como presente — componente a 0 não baixa nada', () => {
    expect(conferirBaseDeTamanho([c('i-massa', 0), c('i-queijo', 2), c('i-cx35', 1)], ITENS).faltando).toEqual([
      'massa',
    ])
  })

  it('⭐ a caixa de QUALQUER tamanho satisfaz o guard — ele cobra "tem caixa", não "qual"', () => {
    expect(conferirBaseDeTamanho([c('i-massa', 1), c('i-queijo', 1), c('i-cx45', 1)], ITENS).completa).toBe(true)
  })
})

describe('⭐ a pendência de dose DIZ quantas pizzas são (ordem do dono, 08/10)', () => {
  it('base de um tamanho: o motivo é o de sempre, sem número nenhum', () => {
    const m = motivoDaDoseADeclarar(1)
    expect(m).toContain('declaração do dono')
    expect(m).not.toContain('pizzas:')
  })

  it('⛔ COMBO: o motivo carrega o multiplicador — senão o dono declara a dose de UMA pizza', () => {
    const m = motivoDaDoseADeclarar(2)
    expect(m).toContain('declaração do dono')
    expect(m).toContain('são 2 pizzas')
    expect(m).toContain('2× a da base')
  })

  it('⚠️ e vale pra qualquer N, não só 2', () => {
    expect(motivoDaDoseADeclarar(3)).toContain('são 3 pizzas')
  })
})
