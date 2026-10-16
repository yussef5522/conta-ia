/**
 * ⭐⭐ **O RÓTULO DO PREGÃO PASSOU A DIZER A VERDADE (16/10/2026) — e a REGRESSÃO que ele não
 * pode perder: pregão == placar AO CENTAVO.**
 *
 * **O defeito, medido em prod (15/10):** a 3ª frase do pregão dizia *"empréstimos do mês:
 * R$ 94.051,51 em **13 parcela(s)**"* — e por baixo eram **9 parcelas de empréstimo + 4 faturas
 * de cartão**. ⚠️ Não é número errado: o Σ do dinheiro sempre veio do dono único
 * (`lerCompromissos`). É **rótulo que promete mais do que entrega** (a régua de 13/09): quem lê
 * "13 parcelas" vai procurar 13 contratos e não vai achar.
 *
 * ⛔⛔ **A CONTAGEM VEM DA MESMA PORTA QUE JÁ SERVIA O NÚMERO** — `compromissos.parcelas` e
 * `compromissos.faturas`, as duas listas que `lerCompromissos` já devolvia. A mesa só parou de
 * **somá-las antes de entregar**; nenhuma 2ª leitura nasceu, e o total não se move.
 *
 * ⛔⛔⛔ **E A REGRA DE OURO DA CASA FICA TRAVADA AQUI:** o pregão **não calcula dinheiro**. O
 * número grande dele é o `casa.sobraLiquida` e o veredito é o `cascata.heroi.rotulo` — os
 * MESMOS campos que o placar da margem desenha. ⭐ É isso que faz *"pregão == placar ao
 * centavo"* ser verdade **por construção**, e não por coincidência: não existe aritmética de
 * dinheiro entre a leitura e a tela.
 *
 * ⚠️ Os números são os MEDIDOS em prod (os 4 maiores tijolos de outubro + os 9+4 compromissos),
 * reusando os construtores REAIS (`montarCasa`/`montarCascata`) — fixture inventada testa o
 * mundo que eu imaginei.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios } from '@/__tests__/regras-ui/_leitura-de-fonte'
import { montarCasa } from '@/lib/margem/casa'
import { sobrasDoPeriodo, type LinhaParaSobra } from '@/lib/margem/sobra'
import { montarCascata } from '@/lib/margem/cascata'
import { linhaDeChegada } from '@/lib/margem/dia'
import { montarPregao, fraseDosEmprestimos, type PregaoInput } from '../pregao-do-mes'

const linha = (o: Partial<LinhaParaSobra> & { chave: string; nome: string }): LinhaParaSobra => ({
  status: 'FICHA_OK', vendasQtd: 10, vendasValor: 1000, precoUsado: 100, precoOrigem: 'praticado',
  custoUnitario: 20, custoParcial: 20, componentesSemCusto: 0, ...o,
})

/** ⭐ os 4 maiores tijolos REAIS de prod (outubro) */
const PROD: LinhaParaSobra[] = [
  linha({ chave: 'f:combo', nome: 'Combo Caçula', vendasQtd: 285, precoUsado: 83.3, custoUnitario: 15.2 }),
  linha({ chave: 'f:fam45', nome: 'PIZZA FAMILIA 45CM', vendasQtd: 108, precoUsado: 120.44, custoUnitario: 17.74 }),
  linha({ chave: 'f:gp', nome: 'PIZZA GRANDE PRECINHO', vendasQtd: 143, precoUsado: 64.74, custoUnitario: 9.92 }),
  linha({ chave: 'f:pq', nome: 'PIZZA PEQUENA 25CM', vendasQtd: 38, precoUsado: 52.45, custoUnitario: 6.4 }),
]

const AGORA = new Date('2026-10-01T02:00:00.000Z') // ⚠️ âncora no PASSADO (REGRA 12)
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function pregaoDe(emprestimos: { total: number; parcelas: number; faturas: number }): PregaoInput {
  const sobras = sobrasDoPeriodo(PROD)
  const casa = montarCasa({
    sobras,
    custoFixo: 43_599.36, // o custo fixo medido em prod
    dias: 7,
    composicao: { casa: true, banco: true, compromissos: true },
    complementos: { custo: 9_255.55, ocorrenciasComCusto: 1000, ocorrenciasSemCusto: 0 },
  })
  return {
    rotuloDoPeriodo: 'outubro',
    casa,
    cascata: montarCascata(casa, sobras, null),
    ontem: linhaDeChegada([], casa.custoFixoDiario, AGORA),
    medias: [],
    hoje: '2026-09-30',
    dowDeHoje: 3,
    emprestimosDoMes: emprestimos,
  }
}

describe('⛔⛔ nenhum rótulo promete mais do que entrega — a frase dos compromissos', () => {
  it('⭐⭐ o CASO REAL de prod: 9 parcelas + 4 faturas, nunca "13 parcelas"', () => {
    const f = fraseDosEmprestimos(pregaoDe({ total: 94_051.51, parcelas: 9, faturas: 4 }))

    expect(f).toContain('9 parcelas + 4 faturas')
    /**
     * ⚠️ Comparado com o MESMO formatador, nunca com literal: o `Intl` põe **espaço
     * NÃO-QUEBRÁVEL** depois do "R$", e asserção com espaço comum nunca casa (a cicatriz
     * de 24/09, que já derrubou 2 testes desta casa).
     */
    expect(f).toContain(brl(94_051.51))
    // ⛔ o defeito de 15/10, nomeado: a soma dos dois tipos fingindo ser um só
    expect(f, 'o rótulo colapsado é o bug').not.toContain('13 parcela')
  })

  it('⛔ tipo com ZERO não aparece — "9 parcelas + 0 faturas" é ruído', () => {
    /** dizer "0 faturas" manda o dono procurar a fatura que não existe */
    expect(fraseDosEmprestimos(pregaoDe({ total: 50_000, parcelas: 9, faturas: 0 })))
      .toContain('em 9 parcelas')
    expect(fraseDosEmprestimos(pregaoDe({ total: 50_000, parcelas: 9, faturas: 0 })))
      .not.toContain('fatura')

    expect(fraseDosEmprestimos(pregaoDe({ total: 19_000, parcelas: 0, faturas: 4 })))
      .toContain('em 4 faturas')
    expect(fraseDosEmprestimos(pregaoDe({ total: 19_000, parcelas: 0, faturas: 4 })))
      .not.toContain('parcela')
  })

  it('⭐ o plural acompanha o número — o rótulo lê como gente escreve', () => {
    const f = fraseDosEmprestimos(pregaoDe({ total: 4_337.52, parcelas: 1, faturas: 1 }))
    expect(f).toContain('1 parcela + 1 fatura')
    expect(f).not.toContain('parcelas')
    expect(f).not.toContain('faturas')
  })

  it('⛔ ZERO compromisso NÃO some — a frase diz que o sistema olhou', () => {
    /** frase que desaparece faz o dono se perguntar se o sistema olhou, e ele não tem como saber */
    expect(fraseDosEmprestimos(pregaoDe({ total: 0, parcelas: 0, faturas: 0 })))
      .toBe('empréstimos do mês: nenhum compromisso agendado')
  })

  it('⭐ a frase entra na LEGENDA do pregão — ela chega à tela', () => {
    const p = montarPregao(pregaoDe({ total: 94_051.51, parcelas: 9, faturas: 4 }))
    expect(p.legenda.join(' | ')).toContain('9 parcelas + 4 faturas')
  })
})

describe('⛔⛔⛔ A REGRA DE OURO — pregão == placar AO CENTAVO (regressão travada)', () => {
  const input = pregaoDe({ total: 94_051.51, parcelas: 9, faturas: 4 })
  const pregao = montarPregao(input)

  it('⭐⭐ o número grande do pregão É a `sobraLiquida` da casa, ao centavo', () => {
    /**
     * ⛔ Não é "um número parecido": é o MESMO campo. Se o pregão recalculasse a sobra, as duas
     * telas divergiriam no primeiro caso de borda — e o dono veria um número na home e outro
     * na margem, pro mesmo mês.
     */
    const esperado = input.casa.sobraLiquida.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    expect(pregao.valor).toBe(esperado)
  })

  it('⭐⭐ o veredito do pregão É o rótulo do herói da cascata', () => {
    expect(pregao.veredito.rotulo).toBe(input.cascata.heroi.rotulo)
  })

  it('⭐ a ressalva da cobertura é HERDADA da casa — o pregão não a reescreve', () => {
    expect(pregao.veredito.ressalva).toBe(input.casa.veredito.ressalva)
  })

  it('⛔⛔ a barra é DERIVADA do `pctPago` da casa — em OBRA ela não enche', () => {
    /**
     * ⚠️⚠️ **O TESTE CORRIGIU A MINHA ASSERÇÃO.** Eu afirmei *"os pedaços somam 1"* lendo o
     * comentário da barra — e aquilo vale **só com a casa PAGA**. Com ela EM OBRA (o caso
     * destes tijolos: `pctPago` 0,707) a soma é **0,707 de propósito**: a barra mostra o
     * quanto FALTA, e enchê-la aqui seria a tela afirmando que a casa se pagou.
     */
    const b = pregao.barra
    expect(b, 'com plano e venda, a barra existe').not.toBeNull()
    expect(b!.pago).toBeCloseTo(input.casa.pctPago as number, 6)
    expect(b!.transbordo, 'em obra não há transbordo').toBe(0)
    expect(b!.bandeira, 'a 🏁 só acende com a casa paga').toBe(false)
  })

  it('⭐⭐ com a casa PAGA, aí sim os dois pedaços somam 1 (a barra não estoura o telhado)', () => {
    /** ⭐ é o estado que o comentário da barra descreve — e ele existe: custo fixo menor */
    const sobras = sobrasDoPeriodo(PROD)
    const casa = montarCasa({
      sobras,
      custoFixo: 20_000,
      dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 9_255.55, ocorrenciasComCusto: 1000, ocorrenciasSemCusto: 0 },
    })
    const p = montarPregao({
      ...input,
      casa,
      cascata: montarCascata(casa, sobras, null),
      ontem: linhaDeChegada([], casa.custoFixoDiario, AGORA),
    })

    expect(casa.veredito.estado, 'a cena é a da casa paga').toBe('PAGA')
    expect(p.barra!.pago + p.barra!.transbordo).toBeCloseTo(1, 6)
    expect(p.barra!.bandeira).toBe(true)
    expect(p.barra!.rotuloTransbordo, 'o transbordo ganha rótulo').toMatch(/^\+\d+%$/)
  })

  it('⛔ sem plano declarado o pregão diz "a apurar" — nunca R$ 0,00', () => {
    const sobras = sobrasDoPeriodo(PROD)
    const casa = montarCasa({
      sobras,
      custoFixo: null, // o dono ainda não declarou
      dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    const p = montarPregao({
      ...input,
      casa,
      cascata: montarCascata(casa, sobras, null),
      ontem: linhaDeChegada([], casa.custoFixoDiario, AGORA),
    })
    expect(p.valor).not.toContain('R$ 0,00')
    expect(p.barra, 'barra de 0% afirmaria que nada foi pago de uma casa sem valor').toBeNull()
  })
})

/**
 * ⛔⛔⛔ **A PROCEDÊNCIA DO NÚMERO — e este bloco nasceu de um guard MEU que não mordia.**
 *
 * **REGRA 11, medida:** repus a aritmética no pregão (`brl(casa.sobraTotal - casa.complementos.custo)`
 * no lugar de `brl(casa.sobraLiquida)`) e os 11 testes ficaram **VERDES** — porque aquela conta
 * é, por definição, **o mesmo número** que a `sobraLiquida`. ⚠️ *O teste comparava dois caminhos
 * que coincidem; ele não provava nada sobre "o pregão não calcula".*
 *
 * ⭐ O que morde é exigir a **PROCEDÊNCIA**: o número exibido tem que **receber o campo**, sem
 * expressão no meio. É a mesma régua que a cascata já usa (*"a tela não calcula dinheiro"*, 10/10)
 * e a única forma de *"pregão == placar ao centavo"* ser verdade **por construção** — com
 * aritmética ali, a igualdade volta a depender de duas fórmulas continuarem iguais.
 */
describe('⛔⛔⛔ o pregão NÃO calcula dinheiro — ele ECOA o placar', () => {
  const src = () =>
    semComentarios(readFileSync(join(process.cwd(), 'lib/balance/pregao-do-mes.ts'), 'utf8'))

  it('⭐⭐ o número grande RECEBE `casa.sobraLiquida`, sem expressão', () => {
    expect(src(), 'o valor é o campo, não uma conta').toMatch(/:\s*brl\(casa\.sobraLiquida\)/)
  })

  it('⭐⭐ o veredito RECEBE `cascata.heroi.rotulo`, sem expressão', () => {
    expect(src()).toMatch(/rotulo:\s*cascata\.heroi\.rotulo\s*,/)
  })

  it('⛔ nenhuma aritmética sobre os campos de dinheiro da casa', () => {
    /**
     * ⚠️ A régua é estreita de propósito: `custoFixo + transbordo` é **geometria da barra**
     * (fração 0..1, não dinheiro na tela) e segue permitida. O que não pode é somar/subtrair
     * os campos que são o NÚMERO exibido — `sobraLiquida`, `sobraTotal` e `complementos.custo`.
     */
    const s = src()
    for (const campo of ['sobraLiquida', 'sobraTotal', 'complementos\\.custo']) {
      const re = new RegExp(`casa\\.${campo}\\s*[-+*/]|[-+*/]\\s*casa\\.${campo}`)
      expect(s, `aritmética sobre casa.${campo.replace('\\', '')}`).not.toMatch(re)
    }
  })
})
