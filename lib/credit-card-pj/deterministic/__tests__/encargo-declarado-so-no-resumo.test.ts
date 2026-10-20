// ⛔⛔⛔ O ENCARGO DECLARADO **SÓ NO RESUMO** — a família inteira, com o texto REAL (20/10/2026)
//
// **A fatura que o dono subiu 5× e foi recusada:** `soma lida 12.585,84 × declarado
// 12.696,23 · diferença −110,39`. Os R$ 110,39 são duas linhas que o banco **cobra no
// saldo** e que **não existem no bloco de transações**:
//
// ```
// (+) Encargos sobre rotativo             108,98
// (+) IOF sobre operações de crédito        1,41
// ```
//
// ⭐ A fixture é o TEXTO REAL do documento (anonimizado nas descrições, trocas do MESMO
// comprimento — a geometria das colunas é o que o parser lê). **O PDF do dono fica fora do
// repo**, ordem dele. É a régua de 16/09: *"correção de parser só é aceita com o texto real
// do caso na suíte; reconstrução nunca mais vira prova"*.
//
// ⚠️ E os CONTRAFACTUAIS abaixo são sintéticos de propósito: eles existem pra ISOLAR cada
// trava (a âncora, a dupla contagem do IOF do exterior, o `somarTodas`), e o documento real
// não isola nenhuma delas sozinho — nele os três rótulos de parcelamento são 0,00 e o IOF
// do exterior também.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFatura } from '../banrisul-fatura-parser'
import { validateBanrisulFatura } from '../validate-banrisul-fatura'
import { blocoDoResumo, readEncargosDoResumo, round2 } from '@/lib/fatura-banrisul/nucleo'

const TXT = readFileSync(
  join(process.cwd(), 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-encargo-no-resumo.txt'),
  'utf-8',
)
const r = parseBanrisulFatura(TXT)

describe('⭐⭐⭐ a fatura de 15-20/10 FECHA — os 110,39 entraram', () => {
  it('⭐ lê os DOIS encargos do resumo, ao centavo', () => {
    expect(r.declared.encargosResumo).toBeCloseTo(110.39, 2)
    expect(r.declared.encargosResumoItens).toEqual([
      { rotulo: 'Encargos sobre rotativo', valor: 108.98 },
      { rotulo: 'IOF sobre operações de crédito', valor: 1.41 },
    ])
  })

  /**
   * ⭐⭐ ELES VIRAM **LINHA**, não uma soma "por fora" — e isso é o que mantém o K1 do juiz
   * de pé: ele compara o `lastInvoiceTotalToPay` (o saldo) com a Σ das transações GRAVADAS.
   * Somar por fora deixaria o K1 vermelho em 110,39 **toda noite**, numa fatura correta.
   * É a mesma conclusão que o caminho PF escreveu em 26/08: *"a correção é criar a LINHA do
   * encargo, não somar no total por fora"*.
   */
  it('⭐⭐ cada encargo não-zero vira LINHA visível na fatura', () => {
    const doResumo = (r.extraction.lines ?? []).filter((l) => /declarado no resumo/i.test(l.note ?? ''))
    expect(doResumo.map((l) => [l.description, l.amount])).toEqual([
      ['Encargos sobre rotativo', 108.98],
      ['IOF sobre operações de crédito', 1.41],
    ])
    // ⚠️ sem portador de propósito: o encargo é da FATURA, não de um dos dois cartões
    expect(doResumo.every((l) => (l as { cardLastDigits?: string }).cardLastDigits == null)).toBe(true)
  })

  it('⭐ o `net` passa a incluí-los e a conferência fecha em 12.696,23', () => {
    expect(r.computed.sumEncargosResumo).toBeCloseTo(110.39, 2)
    expect(round2(r.computed.sumPositives + r.computed.sumEstornos + r.computed.sumEncargosResumo)).toBeCloseTo(12696.23, 2)
    expect(r.computed.net).toBeCloseTo(12696.23, 2)
    expect(r.declared.saldoAtual).toBeCloseTo(12696.23, 2)
  })

  it('⭐⭐ as 6 checagens do validador passam — os DOIS vermelhos do dono apagaram', () => {
    const v = validateBanrisulFatura(r)
    expect(v.checks.filter((c) => !c.pass).map((c) => `${c.name} dif ${c.diff}`)).toEqual([])
    expect(v.ok, v.message ?? '').toBe(true)
  })

  /**
   * ⛔⛔ RED-THEN-GREEN MEDIDO NOS 110,39 — o mundo de antes da cura, reposto.
   *
   * Ignorar o encargo (o que o parser fazia) devolve **exatamente** os dois vermelhos que o
   * dono viu, com o mesmo número: `V5` e `Resumo declarado`, −110,39 nos dois. É o par de
   * checks que denunciava UMA causa.
   */
  it('⛔ COM o defeito reposto, o net cai pra 12.585,84 e DOIS checks acusam −110,39', () => {
    const semEncargo = {
      ...r,
      declared: { ...r.declared, encargosResumo: 0 },
      computed: { ...r.computed, sumEncargosResumo: 0, net: round2(r.computed.net - 110.39) },
    }
    expect(semEncargo.computed.net).toBeCloseTo(12585.84, 2)

    const v = validateBanrisulFatura(semEncargo)
    expect(v.ok).toBe(false)
    const falhos = v.checks.filter((c) => !c.pass)
    expect(falhos.map((c) => c.name)).toEqual(['V5 net = Saldo da fatura atual', 'Resumo declarado = Saldo atual'])
    for (const c of falhos) expect(c.diff).toBeCloseTo(-110.39, 2)
  })
})

describe('⛔⛔ ANCORADO NO BLOCO — número de propaganda não é número de conferência', () => {
  /**
   * A lição de 31/08. O MESMO PDF imprime, FORA do resumo, *"serão cobrados encargos
   * máximos de até R$ 2.328,04 na próxima fatura"* e uma tabela de taxas com o teto
   * contratual — nenhum dos dois é cobrança desta fatura.
   *
   * ⚠️ O documento real **não isola** esta trava (lá a propaganda usa outro rótulo), então o
   * contrafactual repete o rótulo EXATO fora do bloco, nas duas pontas.
   */
  const comPropaganda = [
    'Atenção: (+) Encargos sobre rotativo    999,99 na próxima fatura (IOF incluso).',
    '(+) Total da fatura anterior                                   1.000,00',
    '( -) Pagamentos / Créditos                                     1.000,00',
    '(+) Despesas / Débitos no Brasil                                 500,00',
    '    Saldo Convertido em Reais (+)                                0,00',
    '(+) Encargos sobre rotativo                                     10,00',
    '(+) IOF sobre transações no exterior                             2,00',
    '(=) Saldo da fatura atual                                      512,00',
    'Encargos cobrados nesta fatura:  (+) Encargos sobre rotativo   777,77',
  ].join('\n')

  it('⭐ lê os 10,00 do bloco e IGNORA a propaganda das duas pontas', () => {
    expect(readEncargosDoResumo(comPropaganda).total).toBeCloseTo(10, 2)
  })

  it('⛔ CONTRAFACTUAL: regex SOLTO no documento inteiro pegaria 999,99', () => {
    const solto = comPropaganda.match(/Encargos sobre rotativo\s+([\d.]+,\d{2})/i)
    expect(solto?.[1]).toBe('999,99')
  })

  /**
   * ⛔⛔ **AUSÊNCIA DE BLOCO NÃO É AUSÊNCIA DE ENCARGO.** Sem as âncoras devolve `null`, não
   * `0` — zero afirmaria que o banco não cobrou nada e a conferência fecharia curta em
   * silêncio, que é a classe deste bug inteiro.
   */
  it('⛔ sem as âncoras, o total é `null` (nunca 0)', () => {
    expect(blocoDoResumo('fatura sem resumo nenhum')).toBeNull()
    expect(readEncargosDoResumo('fatura sem resumo nenhum').total).toBeNull()
  })
})

describe('⛔⛔⛔ a 8ª linha `(+)` FICA DE FORA — ela já é o `declared.iof`', () => {
  /**
   * `IOF sobre transações no exterior` é a 8ª linha `(+)` do bloco e **já entra no `net`**
   * pelas linhas de IOF do bloco de transações (`sumIof` → `sumPositives`). Somá-la como
   * encargo a contaria **DUAS VEZES**.
   *
   * ⚠️ Na fatura real ela é `0,00` — então o erro nasceria **INVISÍVEL**, que é por que esta
   * trava precisa de um contrafactual com ela **diferente de zero**.
   */
  const comIofDoExterior = [
    '(+) Total da fatura anterior                                   1.000,00',
    '( -) Pagamentos / Créditos                                     1.000,00',
    '(+) Despesas / Débitos no Brasil                                 500,00',
    '    Saldo Convertido em Reais (+)                                0,00',
    '(+) Encargos sobre rotativo                                     10,00',
    '(+) Encargos sobre parcelamento emissor                          5,00',
    '(+) IOF sobre operações de crédito                               1,00',
    '(+) IOF sobre transações no exterior                             2,00',
    '(=) Saldo da fatura atual                                      518,00',
    'TOTAL DE GASTOS                                                  500,00',
  ].join('\n')

  it('⭐ soma 7 rótulos (16,00) e NÃO o IOF do exterior', () => {
    expect(readEncargosDoResumo(comIofDoExterior).total).toBeCloseTo(16, 2)
  })

  /**
   * ⭐⭐ E A ARITMÉTICA DO RESUMO É O JUIZ DISSO: `1000 − 1000 + 500 + 0 + 2 + 16 = 518`,
   * exatamente o saldo declarado. Com os 8 rótulos daria **520** e o check acusaria — ou
   * seja, a decisão "7, não 8" se prova com um VERMELHO, não com um argumento.
   */
  it('⛔ com a 8ª somada, o "Resumo declarado" iria a 520 e acusaria +2,00', () => {
    const p = parseBanrisulFatura(comIofDoExterior)
    expect(p.declared.encargosResumo).toBeCloseTo(16, 2)
    expect(p.declared.iof).toBeCloseTo(2, 2)

    const soma = (enc: number) =>
      round2((p.declared.anterior ?? 0) - (p.declared.pagamentosCreditos ?? 0)
        + (p.declared.brasil ?? 0) + (p.declared.exterior ?? 0) + (p.declared.iof ?? 0) + enc)

    expect(soma(16), 'com 7 rótulos fecha').toBeCloseTo(518, 2)
    expect(soma(18), 'com 8 rótulos conta o IOF do exterior 2×').toBeCloseTo(520, 2)
  })

  it('⭐ e os 3 rótulos de PARCELAMENTO são lidos de verdade (eram 0,00 nos documentos de hoje)', () => {
    const comParcelamento = comIofDoExterior
      .replace('(+) Encargos sobre parcelamento emissor                          5,00',
        [
          '(+) Encargos sobre parcelamento emissor                          5,00',
          '(+) Encargos sobre parcelamento de fatura                         3,00',
          '(+) Encargos sobre parcelamento de rotativo                       1,50',
        ].join('\n'))
    expect(readEncargosDoResumo(comParcelamento).total).toBeCloseTo(20.5, 2)
  })
})

describe('⛔⛔ `somarTodas` — rótulo PRESENTE com valor ilegível devolve null', () => {
  /**
   * ⭐ O caso que ISOLA, e ele é plausível: basta o banco imprimir `R$` entre o rótulo e o
   * número. Antes de 20/10 isto **não casava nada** → `continue` → o encargo contribuía
   * **0 em silêncio**, que é somar pela metade.
   */
  const comReal = [
    '(+) Total da fatura anterior                                   1.000,00',
    '(+) Encargos sobre rotativo                                 R$ 108,98',
    '(=) Saldo da fatura atual                                    1.108,98',
  ].join('\n')

  it('⛔ devolve `null`, não 0 — e a conferência recusa em vez de fechar curta', () => {
    expect(readEncargosDoResumo(comReal).total).toBeNull()
    expect(readEncargosDoResumo(comReal).itens).toEqual([])
  })

  it('⭐ e o `null` chega no validador, que então NÃO afirma que o resumo fecha', () => {
    const p = parseBanrisulFatura(comReal)
    expect(p.declared.encargosResumo).toBeNull()
  })
})
