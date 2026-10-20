// Golden da fatura Caixa (FASE 4) — trava a leitura determinística ao centavo contra
// o -layout REAL (fixture anonimizado). O ponto central: os 3 créditos (sufixo C,
// 12,58) que o Vision PERDEU têm que entrar — é o K1/K4/REGRA 6. REGRA 3: roda o
// parser real contra o texto real.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCaixaFatura } from '../caixa-fatura-parser'
import { validateCaixaFatura } from '../validate-caixa-fatura'

const text = readFileSync(join(__dirname, 'fixtures/caixa-fatura-real.txt'), 'utf-8')

describe('parseCaixaFatura — golden agosto/2026', () => {
  const parsed = parseCaixaFatura(text)

  it('lê os totais declarados (âncora "Valor total desta fatura")', () => {
    expect(parsed.declared.valorTotalFatura).toBe(7280.39)
    expect(parsed.declared.totalFinalByCard['2937']).toBe(7.55)
    expect(parsed.declared.totalFinalByCard['3883']).toBe(7285.42)
    expect(parsed.declared.totalCompras).toBe(5490.21)
    expect(parsed.declared.totalParceladas).toBe(1782.71)
    /**
     * ⚠️ INVERTIDO EM 20/10 COM O MOTIVO ESCRITO (era `12.58`).
     *
     * O "Total" do Demonstrativo é o **NET do bloco, ASSINADO** pelo sufixo — e aqui ele
     * é `12,58 C`, logo **−12,58**. O `+12,58` de antes vinha de um regex que só casava
     * o sufixo C e era comparado com `|Σ créditos|`: batia nesta fixture por acidente
     * (o par anterior×pagamento se anula, então o net do bloco É −|créditos|) e **nem
     * rodava** na fatura rica, onde o Total é `465,29 D`.
     *
     * ⭐ A metade CERTA da asserção antiga — *os 3 créditos entram e somam 12,58* —
     * continua travada no teste de baixo (`sumCredits === -12.58`).
     */
    expect(parsed.declared.totalDemonstrativo).toBe(-12.58)
  })

  it('recupera os 3 créditos quebrados no -layout (o que o Vision perdeu)', () => {
    const creditos = parsed.extraction.lines.filter((l) => l.suggestedKind === 'ESTORNO')
    expect(creditos).toHaveLength(3)
    expect(creditos.map((l) => l.amount).sort((a, b) => a - b)).toEqual([0.04, 0.04, 12.5])
    expect(parsed.computed.sumCredits).toBe(-12.58)
  })

  it('soma por cartão ao centavo (V1/V2)', () => {
    expect(parsed.computed.debitsByCard['2937']).toBe(7.55)
    expect(parsed.computed.debitsByCard['3883']).toBe(7285.42)
  })

  it('soma por seção ao centavo', () => {
    expect(parsed.computed.comprasSum).toBe(5490.21)
    expect(parsed.computed.parceladasSum).toBe(1782.71)
    expect(parsed.computed.sumDebits).toBe(7292.97) // 7,55 + 7.285,42
  })

  it('net = Valor total desta fatura (débitos − créditos)', () => {
    expect(parsed.computed.net).toBe(7280.39) // 7.292,97 − 12,58
  })

  /**
   * ⚠️ A PERGUNTA MUDOU EM 20/10, e o resultado é o MESMO porque o par SE ANULA aqui:
   * `TOTAL DA FATURA ANTERIOR 7.676,72 D` × `OBRIGADO PELO PAGAMENTO 7.676,72 C` → Σ 0.
   * Era *"os dois são pulados por nome"*; agora é *"os dois são PAREADOS, e quitação
   * total não deixa resíduo"* — que é o que faz este golden continuar intacto ao centavo.
   */
  it('o par da fatura anterior se ANULA (quitação total) e nenhum dos dois vira linha', () => {
    expect(parsed.computed.faturaAnterior).toBe(7676.72)
    expect(parsed.computed.pagamentoAnterior).toBe(-7676.72)
    expect(parsed.computed.residuoAnterior).toBe(0)
    expect(parsed.extraction.lines.some((l) => /FATURA ANTERIOR|OBRIGADO|carregada/i.test(l.description))).toBe(false)
  })

  it('parcela "08 DE 10" (DUFRIO) vira 8/10, data da compra ano-1', () => {
    const dufrio = parsed.extraction.lines.find((l) => /DUFRIO/.test(l.description))
    expect(dufrio?.installmentNumber).toBe(8)
    expect(dufrio?.installmentTotal).toBe(10)
    expect(dufrio?.date).toBe('2025-12-10') // 10/12, mês > venc(08) ⇒ ano anterior
  })

  it('conta 18 linhas importáveis (15 débitos + 3 créditos)', () => {
    expect(parsed.computed.count).toBe(18)
    expect(parsed.extraction.lines).toHaveLength(18)
    expect(parsed.extraction.lines.filter((l) => l.suggestedKind !== 'ESTORNO')).toHaveLength(15)
  })

  it('multi-cartão: 2937 e 3883 detectados', () => {
    expect(parsed.extraction.cardLastDigitsFound.sort()).toEqual(['2937', '3883'])
  })

  it('VALIDAÇÃO fecha (as 6 checagens passam)', () => {
    const v = validateCaixaFatura(parsed)
    expect(v.ok).toBe(true)
    expect(v.checks.every((c) => c.pass)).toBe(true)
    expect(v.checks).toHaveLength(6) // 2 cartões + compras + parceladas + demonstrativo + total
    expect(v.checks.map((c) => c.name)).toContain('V demonstrativo = Total do Demonstrativo')
  })
})
