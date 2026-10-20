/**
 * ⭐⭐⭐ A DÍVIDA CARREGADA DA FATURA ANTERIOR (20/10/2026) — o par que se anula, e o
 * resíduo que evaporava.
 *
 * **O caso REAL:** a fatura Caixa de outubro/2026 do dono. A anterior (5.106,99) **não
 * foi paga** — daí `JUROS ATRASO ROTATIVO`, `MULTA DE ATRASO`, `MORA` e `JUROS NAO
 * PAGAMENTO MINIMO` no mesmo Demonstrativo —, então **não existe `OBRIGADO PELO
 * PAGAMENTO` pra anular o `TOTAL DA FATURA ANTERIOR`**. Pulando os dois por NOME a
 * leitura dava **3.716,72** contra **8.823,71** declarados, e a conferência recusava
 * **pelos 5.106,99 exatos**. Cinco tentativas do dono, cinco recusas.
 *
 * ⭐ A cura é PAREAMENTO, nunca "pular por nome":
 *   Σ ≈ 0 → quitação total (o caso comum) → os dois ficam fora, **golden intacto**
 *   Σ ≠ 0 → o resíduo é dívida (ou crédito) carregada e entra como **LINHA sem portador**
 *
 * ⚠️ REGRA 3: roda o parser e o validador REAIS contra o texto real (anonimizado).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCaixaFatura } from '../caixa-fatura-parser'
import { validateCaixaFatura } from '../validate-caixa-fatura'

const dir = join(__dirname, 'fixtures')
const ler = (f: string) => readFileSync(join(dir, f), 'utf-8')

const RESIDUO = ler('caixa-fatura-residuo-anterior.txt')
const AGOSTO = ler('caixa-fatura-real.txt')
const RICA = ler('caixa-fatura-rica.txt')

describe('o resíduo da fatura anterior — o caso REAL de outubro/2026', () => {
  const p = parseCaixaFatura(RESIDUO)
  const v = validateCaixaFatura(p)

  it('a anterior está lá e NÃO foi paga — resíduo = a anterior inteira', () => {
    expect(p.computed.faturaAnterior).toBe(5106.99)
    expect(p.computed.pagamentoAnterior).toBe(0) // não existe OBRIGADO PELO PAGAMENTO
    expect(p.computed.residuoAnterior).toBe(5106.99)
  })

  it('o resíduo vira LINHA "dívida carregada da fatura anterior"', () => {
    const l = p.extraction.lines.filter((x) => /dívida carregada/i.test(x.description))
    expect(l).toHaveLength(1)
    expect(l[0].amount).toBe(5106.99)
    expect(l[0].suggestedKind).toBe('ENCARGO_FINANCEIRO')
    expect(l[0].date).toBe('2026-08-28') // a data que o banco deu à anterior
  })

  /**
   * ⛔ SEM PORTADOR — medido no documento: o Demonstrativo fica FORA de todo
   * `Total final (cartão N)`. Somar o resíduo em `debitsByCard` quebraria o `V cartão N`
   * na hora, e é por isso que a linha nasce sem `cardLastDigits`.
   */
  it('a linha do resíduo NÃO tem portador e não entra em nenhum total de cartão', () => {
    const l = p.extraction.lines.find((x) => /dívida carregada/i.test(x.description))!
    expect(l.cardLastDigits).toBeUndefined()
    expect(p.computed.debitsByCard).toEqual({ '2937': 33.71, '3883': 2936.61 })
    expect(p.computed.comprasSum).toBe(1141.4)
    expect(p.computed.parceladasSum).toBe(1782.71)
  })

  it('⭐ a fatura FECHA ao centavo: net == Valor total desta fatura', () => {
    expect(p.declared.valorTotalFatura).toBe(8823.71)
    expect(p.computed.net).toBe(8823.71)
    expect(v.ok).toBe(true)
    expect(v.checks.every((c) => c.pass)).toBe(true)
  })

  it('o Total do Demonstrativo (5.853,39 D) é conferido e bate', () => {
    expect(p.declared.totalDemonstrativo).toBe(5853.39)
    expect(p.computed.demonstrativoNet).toBe(5853.39)
    const d = v.checks.find((c) => c.name === 'V demonstrativo = Total do Demonstrativo')!
    expect(d.pass).toBe(true)
    expect(d.expected).toBe(5853.39)
  })

  it('13 linhas = 12 transações + a do resíduo', () => {
    expect(p.computed.count).toBe(13)
    expect(p.extraction.lines).toHaveLength(13)
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL — a régua VELHA executada: pular a anterior por nome é o mesmo
   * que ela não estar no documento. Reproduz a recusa que o dono viu 5×, com o número.
   */
  it('CONTRAFACTUAL: sem a anterior, a leitura dá 3.716,72 e a fatura é RECUSADA', () => {
    const semAnterior = RESIDUO.split('\n')
      .filter((l) => !/TOTAL DA FATURA ANTERIOR/i.test(l))
      .join('\n')
    const pv = parseCaixaFatura(semAnterior)
    const vv = validateCaixaFatura(pv)

    expect(pv.computed.net).toBe(3716.72)
    expect(vv.ok).toBe(false)
    const total = vv.checks.find((c) => c.name === 'V total = Valor total desta fatura')!
    expect(total.pass).toBe(false)
    expect(total.diff).toBe(-5106.99) // o número exato da recusa

    // ⭐ e o `V demonstrativo` acusa a MESMA causa — duas checagens, um defeito
    const demo = vv.checks.find((c) => c.name === 'V demonstrativo = Total do Demonstrativo')!
    expect(demo.pass).toBe(false)
    expect(demo.diff).toBe(-5106.99)
  })
})

describe('quitação total — o par se anula e os goldens ficam INTACTOS', () => {
  it('agosto/2026: par 7.676,72 × 7.676,72 → resíduo 0, 18 linhas, net 7.280,39', () => {
    const p = parseCaixaFatura(AGOSTO)
    expect(p.computed.faturaAnterior).toBe(7676.72)
    expect(p.computed.pagamentoAnterior).toBe(-7676.72)
    expect(p.computed.residuoAnterior).toBe(0)
    expect(p.extraction.lines.some((l) => /carregad/i.test(l.description))).toBe(false)
    expect(p.computed.count).toBe(18)
    expect(p.computed.net).toBe(7280.39)
    expect(validateCaixaFatura(p).ok).toBe(true)
  })

  it('setembro/2026 (rica): par 7.280,39 × 7.280,39 → resíduo 0, 15 linhas, net 5.106,99', () => {
    const p = parseCaixaFatura(RICA)
    expect(p.computed.residuoAnterior).toBe(0)
    expect(p.computed.count).toBe(15)
    expect(p.computed.net).toBe(5106.99)
    expect(validateCaixaFatura(p).ok).toBe(true)
  })

  /**
   * ⭐ E o `V demonstrativo` passou a MORDER na rica — antes o `totalDemonstrativo` vinha
   * `null` (o regex exigia sufixo C e lá o Total é `465,29 D`) e a checagem nem rodava.
   */
  it('na rica o Total do Demonstrativo é 465,29 D — e agora é CONFERIDO', () => {
    const p = parseCaixaFatura(RICA)
    expect(p.declared.totalDemonstrativo).toBe(465.29)
    expect(p.computed.demonstrativoNet).toBe(465.29)
    const d = validateCaixaFatura(p).checks.find((c) => c.name === 'V demonstrativo = Total do Demonstrativo')
    expect(d?.pass).toBe(true)
  })
})

/**
 * ⭐⭐ PAGAMENTO PARCIAL — **o caso GERAL**, e o que a cura cobre de graça.
 *
 * Sintético derivado do texto real: clona a linha da anterior e troca o conteúdo por um
 * `OBRIGADO PELO PAGAMENTO` de 3.000,00 — **trocas do MESMO COMPRIMENTO**, porque a Caixa
 * é lida por COLUNA. Os dois declarados andam junto (o documento fica coerente, como uma
 * fatura de pagamento parcial de verdade seria).
 */
function comPagamentoParcial(valor: string): string {
  const linhas = RESIDUO.split('\n')
  const idx = linhas.findIndex((l) => /TOTAL DA FATURA ANTERIOR/i.test(l))
  const pagamento = linhas[idx]
    .replace('28/08', '13/09')
    .replace('TOTAL DA FATURA ANTERIOR', 'OBRIGADO PELO PAGAMENTO ')
    .replace('5.106,99D', `${valor}C`)
  linhas.splice(idx + 1, 0, pagamento)
  return linhas.join('\n')
}

describe('pagamento PARCIAL — o resíduo é a dívida que o banco carrega', () => {
  // 5.106,99 − 3.000,00 = 2.106,99 · Demonstrativo 5.853,39 − 3.000 = 2.853,39
  // Valor total 8.823,71 − 3.000 = 5.823,71
  const texto = comPagamentoParcial('3.000,00')
    .replace('5.853,39 D', '2.853,39 D')
    .replace('R$ 8.823,71 D', 'R$ 5.823,71 D')
  const p = parseCaixaFatura(texto)
  const v = validateCaixaFatura(p)

  it('a geometria das colunas sobrevive (a linha clonada tem o mesmo tamanho)', () => {
    const original = RESIDUO.split('\n').find((l) => /TOTAL DA FATURA ANTERIOR/i.test(l))!
    const clonada = texto.split('\n').find((l) => /OBRIGADO PELO PAGAMENTO/i.test(l))!
    expect(clonada.length).toBe(original.length)
  })

  it('pareia e sobra 2.106,99', () => {
    expect(p.computed.faturaAnterior).toBe(5106.99)
    expect(p.computed.pagamentoAnterior).toBe(-3000)
    expect(p.computed.residuoAnterior).toBe(2106.99)
  })

  it('o resíduo vira a LINHA, com a conta escrita na nota', () => {
    const l = p.extraction.lines.find((x) => /dívida carregada/i.test(x.description))!
    expect(l.amount).toBe(2106.99)
    expect(l.note).toContain('R$ 5106,99')
    expect(l.note).toContain('R$ 3000,00')
    expect(l.note).toContain('sem portador')
  })

  it('⭐ e a fatura FECHA: 5.823,71 declarados == net', () => {
    expect(p.computed.net).toBe(5823.71)
    expect(p.computed.demonstrativoNet).toBe(2853.39)
    expect(v.ok).toBe(true)
  })
})

describe('bordas do pareamento', () => {
  it('pagamento A MAIS → "crédito carregado", kind ESTORNO, entra como crédito', () => {
    const p = parseCaixaFatura(comPagamentoParcial('6.000,00'))
    expect(p.computed.residuoAnterior).toBe(-893.01)
    const l = p.extraction.lines.find((x) => /crédito carregado/i.test(x.description))!
    expect(l.amount).toBe(893.01)
    expect(l.suggestedKind).toBe('ESTORNO')
    expect(l.cardLastDigits).toBeUndefined()
    expect(p.computed.sumCredits).toBe(-905.51) // −12,50 do cashback − 893,01
  })

  /**
   * ⛔ 2 centavos é RUÍDO DE ARREDONDAMENTO, não pagamento parcial — o mesmo degrau
   * `FECHA` da casa. Abaixo disso nenhuma linha nasce.
   */
  it('diferença de 1 centavo NÃO vira linha (é arredondamento do banco)', () => {
    const p = parseCaixaFatura(comPagamentoParcial('5.106,98'))
    expect(p.computed.residuoAnterior).toBe(0.01)
    expect(p.extraction.lines.some((l) => /carregad/i.test(l.description))).toBe(false)
  })

  it('3 centavos JÁ viram linha (acima do ruído, é dívida de verdade)', () => {
    const p = parseCaixaFatura(comPagamentoParcial('5.106,96'))
    expect(p.computed.residuoAnterior).toBe(0.03)
    expect(p.extraction.lines.some((l) => /dívida carregada/i.test(l.description))).toBe(true)
  })

  it('DOIS pagamentos somam antes de parear (o dono pagou em duas vezes)', () => {
    const base = comPagamentoParcial('3.000,00')
    const linhas = base.split('\n')
    const idx = linhas.findIndex((l) => /OBRIGADO PELO PAGAMENTO/i.test(l))
    linhas.splice(idx + 1, 0, linhas[idx].replace('3.000,00C', '2.106,99C'))
    const p = parseCaixaFatura(linhas.join('\n'))
    expect(p.computed.pagamentoAnterior).toBe(-5106.99)
    expect(p.computed.residuoAnterior).toBe(0) // quitou em duas mordidas
    expect(p.extraction.lines.some((l) => /carregad/i.test(l.description))).toBe(false)
  })

  /**
   * ⭐ O resíduo nasce ONDE a anterior estava — a 1ª coisa do Demonstrativo. Jogá-lo pro
   * fim faria a fatura contar a história fora de ordem.
   */
  it('a linha do resíduo é a PRIMEIRA da fatura', () => {
    const p = parseCaixaFatura(RESIDUO)
    expect(p.extraction.lines[0].description).toBe('dívida carregada da fatura anterior')
  })
})
