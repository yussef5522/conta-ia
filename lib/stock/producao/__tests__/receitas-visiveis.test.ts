/**
 * ⭐⭐ "O QUE EU VEJO NO RELATÓRIO" — o recorte, a preferência e os formatadores (04/10/2026).
 *
 * **Pedido do dono:** *"Quero escolher quais receitas aparecem (esconder preparos miúdos). Escolha
 * SALVA EM TABELA por usuário — volto amanhã e está como deixei. Totais recalculam sobre as
 * VISÍVEIS, com o guard Σ(linhas)==total continuando a fechar."*
 *
 * ⛔⛔ **O TESTE CENTRAL É O DO Σ.** Esconder é fácil; o que quebra em silêncio é o subtotal
 * continuar somando o lote que a tela não mostra — e aí o rodapé diz um número que as linhas
 * acima não somam, que é a doença do cabeçalho dos *"69 duplicatas"*.
 */
import { describe, it, expect } from 'vitest'
import {
  recortarPorReceitasVisiveis, agruparPorDia, agruparPorReceita, type LinhaDoRelatorio,
} from '../relatorio-por-dia'
import { normalizar } from '../receitas-ocultas'
import { formatarDuracao } from '@/lib/format/duracao'
import { formatBRL } from '@/lib/format/money'

const linha = (p: Partial<LinhaDoRelatorio>): LinhaDoRelatorio => ({
  ordemId: 'o1', dia: '2026-10-04', tarefa: 'porcao coxao 80 grama', itemId: 'it-coxao', unidade: 'UN',
  pedido: 80, produzido: 78, pctDoPedido: 98, seloDoPedido: 'OK',
  eficiencia: 0.98, separadoReais: 100, minutos: 60, relampago: false,
  setor: 'COZINHA', quemConcluiu: 'rodrigo', encerradoAs: null, ...p,
})

/** o cenário real: 2 porções que importam + 1 preparo miúdo que o dono quer esconder */
const CENA = [
  linha({ ordemId: 'a', itemId: 'it-coxao', tarefa: 'porcao coxao 80 grama', separadoReais: 877.96, produzido: 100, minutos: 95 }),
  linha({ ordemId: 'b', itemId: 'it-coxao', tarefa: 'porcao coxao 80 grama', separadoReais: 400.04, produzido: 50, minutos: 61 }),
  linha({ ordemId: 'c', itemId: 'it-queijo', tarefa: 'porçao queijo 135 grama', separadoReais: 1534.78, produzido: 200, minutos: 120 }),
  linha({ ordemId: 'd', itemId: 'it-tomate', tarefa: 'TOMATE PICADO', separadoReais: 12.5, produzido: 8, minutos: 7 }),
]

describe('⭐⭐ o recorte: Σ(linhas) == total continua fechando', () => {
  it('⛔⛔ esconder recalcula o subtotal do DIA — nada do oculto sobra na soma', () => {
    const todas = agruparPorDia(CENA)[0]
    expect(todas.lotes).toBe(4)
    expect(todas.separadoReais).toBeCloseTo(2825.28, 2)

    const r = recortarPorReceitasVisiveis(CENA, ['it-tomate'])
    const [d] = agruparPorDia(r.linhas)

    expect(d.lotes, 'o lote oculto sai da contagem').toBe(3)
    // ⭐ o invariante: o total é a Σ do que FICOU, ao centavo
    const esperado = r.linhas.reduce((s, l) => s + (l.separadoReais ?? 0), 0)
    expect(d.separadoReais).toBeCloseTo(esperado, 2)
    expect(d.separadoReais).toBeCloseTo(2812.78, 2)
    expect(d.produzido.total, 'e a quantidade também').toBe(350)
    expect(d.minutos, 'e o tempo').toBe(95 + 61 + 120)
  })

  it('⭐ e por RECEITA também: a oculta desaparece da lista, as outras intactas', () => {
    const r = recortarPorReceitasVisiveis(CENA, ['it-tomate'])
    const porReceita = agruparPorReceita(r.linhas)
    expect(porReceita.map((x) => x.tarefa)).toEqual(['porcao coxao 80 grama', 'porçao queijo 135 grama'])
    // ⚠️ o coxão tem 2 lotes e eles continuam somando entre si
    const coxao = porReceita.find((x) => x.itemId === 'it-coxao')!
    expect(coxao.lotes).toBe(2)
    expect(coxao.separadoReais).toBeCloseTo(1278, 2)
  })

  /**
   * ⛔⛔ O TESTE QUE IMPEDE O PAINEL DE SE SUICIDAR: a lista do seletor tem que trazer a receita
   * OCULTA. Derivá-la das linhas que sobraram tiraria o TOMATE do próprio painel que existe pra
   * desocultá-lo — e a escolha reversível viraria permanente.
   */
  it('⭐⭐ a lista do seletor traz a OCULTA, marcada', () => {
    const r = recortarPorReceitasVisiveis(CENA, ['it-tomate'])
    expect(r.receitasDoPeriodo).toHaveLength(3)
    const tomate = r.receitasDoPeriodo.find((x) => x.itemId === 'it-tomate')
    expect(tomate, 'a oculta TEM que estar na lista do painel').toBeTruthy()
    expect(tomate!.oculta).toBe(true)
    expect(r.receitasDoPeriodo.filter((x) => !x.oculta).map((x) => x.itemId)).toEqual(['it-coxao', 'it-queijo'])
  })

  it('⭐ ordenada por LOTES — o preparo miúdo cai no fim sozinho', () => {
    const r = recortarPorReceitasVisiveis(CENA, [])
    expect(r.receitasDoPeriodo.map((x) => x.tarefa)).toEqual([
      'porcao coxao 80 grama',      // 2 lotes
      'porçao queijo 135 grama',    // 1
      'TOMATE PICADO',              // 1, desempate alfabético
    ])
    expect(r.receitasDoPeriodo[0].lotes).toBe(2)
  })

  /**
   * ⚠️ O NÚMERO DO RODAPÉ É O QUE ESTÁ SENDO ESCONDIDO **DESTA VISTA**, nunca o tamanho da
   * preferência: dizer "10 ocultas" num período em que só 1 produziu é a tela afirmando um
   * filtro que ela não aplicou.
   */
  it('⛔ a contagem de ocultas é DO PERÍODO, não da preferência', () => {
    const r = recortarPorReceitasVisiveis(CENA, ['it-tomate', 'it-milho', 'it-ervilha', 'it-nada'])
    expect(r.ocultasNoPeriodo, 'só o TOMATE produziu aqui').toBe(1)
    expect(r.linhas).toHaveLength(3)
  })

  it('⭐ sem nenhuma oculta, a lista é a MESMA referência (zero trabalho de graça)', () => {
    const r = recortarPorReceitasVisiveis(CENA, [])
    expect(r.linhas).toBe(CENA)
    expect(r.ocultasNoPeriodo).toBe(0)
  })

  it('⛔ esconder TUDO devolve lista vazia — e a tela trata como "vazio", não como zero', () => {
    const r = recortarPorReceitasVisiveis(CENA, ['it-coxao', 'it-queijo', 'it-tomate'])
    expect(r.linhas).toHaveLength(0)
    expect(r.ocultasNoPeriodo).toBe(3)
    expect(r.receitasDoPeriodo, 'e o painel continua oferecendo as 3 pra desfazer').toHaveLength(3)
  })
})

describe('⭐ a preferência lida com DESCONFIANÇA', () => {
  it('⛔ JSON torto, nulo ou de outro formato vira lista VAZIA (= tudo visível)', () => {
    // ⚠️ o default seguro é MOSTRAR: esconder por acidente é o erro que o dono não percebe
    expect(normalizar(null)).toEqual([])
    expect(normalizar(undefined)).toEqual([])
    expect(normalizar('')).toEqual([])
    expect(normalizar('não é json')).toEqual([])
    expect(normalizar('{"a":1}')).toEqual([])   // objeto, não array (a lição do `metadata` do audit)
    expect(normalizar('"só uma string"')).toEqual([])
  })

  it('⭐ lista boa passa; lixo DENTRO da lista é descartado item a item', () => {
    expect(normalizar('["it-a","it-b"]')).toEqual(['it-a', 'it-b'])
    expect(normalizar('["it-a",null,123,"",{"x":1},"it-b"]')).toEqual(['it-a', 'it-b'])
  })
})

describe('⭐⭐ os 3 defeitos de formatação que a tela mostrou (print de 04/10)', () => {
  /**
   * ⛔⛔ A CAUSA É FLOAT, e ela era invisível no código: `201.83 % 60` em JS dá
   * **21.830000000000013**. Estava em CINCO cópias do `${floor(m/60)}h${m % 60}`.
   */
  it('⭐ (a) o float não vaza mais: 3h22 e 1h03', () => {
    expect(201.83 % 60, 'a prova de que a causa é o %').toBeCloseTo(21.830000000000013, 12)
    expect(formatarDuracao(201.83)).toBe('3h22')   // era "3h21.830000000000013"
    expect(formatarDuracao(62.67)).toBe('1h03')    // era "1h2.670000000000003"
  })

  it('⭐ (b) minuto fracionado arredonda: 1h57', () => {
    expect(formatarDuracao(116.67)).toBe('1h57')   // era "1h56.67"
  })

  /**
   * ⚠️⚠️ **O `\u00a0` NÃO É FRESCURA — é o que o `Intl` realmente devolve.** A 1ª versão deste
   * teste comparou com espaço comum e falhou com a mensagem mais cruel que existe:
   * *"expected 'R$ 638,50' to be 'R$ 638,50'"*. É a cicatriz de 24/08 (o `'R$ 4,79/KG'` da
   * reunitização) — e eu caí nela de novo. **Espaço não-quebrável é a assinatura de que o número
   * passou pelo formatador**, então o teste o exige: um `R$ ` digitado à mão no código reprova.
   */
  it('⭐ (c) moeda SEMPRE com 2 casas: R$ 638,50', () => {
    expect(formatBRL(638.5)).toBe('R$\u00a0638,50')     // era "R$ 638,5"
    expect(formatBRL(638)).toBe('R$\u00a0638,00')
    // ⚠️ e o milhar com ponto, que era o outro efeito de formatar na mão
    expect(formatBRL(1534.78)).toBe('R$\u00a01.534,78')
  })

  /**
   * ⚠️⚠️ **AS BORDAS QUE AS CINCO CÓPIAS ERRAVAM — inclusive as DUAS que "já arredondavam".**
   * Elas arredondavam o RESTO, não o total: `round(119.7 % 60)` = `round(59.7)` = 60 → "1h60",
   * uma hora que não existe. E `59.7` caía no ramo `< 60` e saía "60min".
   */
  it('⛔⛔ 1h60 e 60min eram ALCANÇÁVEIS — agora são impossíveis', () => {
    expect(formatarDuracao(119.7)).toBe('2h00')
    expect(formatarDuracao(59.7)).toBe('1h00')
    expect(formatarDuracao(59.4)).toBe('59min')
    expect(formatarDuracao(0)).toBe('0min')
  })

  it('⭐ o caso comum (inteiro) não muda — nenhuma frase do golden se move', () => {
    expect(formatarDuracao(45)).toBe('45min')
    expect(formatarDuracao(60)).toBe('1h00')
    expect(formatarDuracao(95)).toBe('1h35')
    expect(formatarDuracao(180)).toBe('3h00')
    expect(formatarDuracao(1115)).toBe('18h35')
  })
})
