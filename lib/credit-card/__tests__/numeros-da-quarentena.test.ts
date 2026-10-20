// ⛔⛔⛔ A QUARENTENA DO CAMINHO PJ GRAVAVA AS TRÊS COLUNAS VAZIAS (20/10/2026)
//
// **O achado 4 da caça:** a recusa gravava `declarado: null, calculado: null, linhas: 0` e o
// desfecho OK gravava `calculado: null`. Então `recusadasParaDiagnosticar` — a função que
// existe pra o dono/eu abrir a fila sem pedir o PDF de novo — devolvia linhas em que dava
// pra ver **QUE** recusou e nunca **POR QUANTO**. A medição por SQL ficava cega.
//
// ⚠️ E `linhas: 0` é pior que ausente: lido na tabela, ele AFIRMA *"o parser não achou
// lançamento nenhum"* — diagnóstico completamente diferente de *"achou 34 e a soma não
// fechou em 110,39"*, que é o caso real.
//
// ⭐ Os números deste arquivo são os do documento REAL que recusou em 15 e 20/10, colhidos
// rodando o parser e o validador de verdade sobre a fixture — não fixture inventada.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { numerosDaQuarentena } from '../quarentena-fatura'
import { parseBanrisulFatura } from '@/lib/credit-card-pj/deterministic/banrisul-fatura-parser'
import { validateBanrisulFatura } from '@/lib/credit-card-pj/deterministic/validate-banrisul-fatura'
import { round2 } from '@/lib/fatura-banrisul/nucleo'
import { CreditCardPjExtractError } from '@/lib/credit-card-pj/types'

const TXT = readFileSync(
  join(process.cwd(), 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-encargo-no-resumo.txt'),
  'utf-8',
)

describe('⭐⭐⭐ os números que a recusa REAL grava', () => {
  /**
   * ⭐⭐ O DEFEITO DE 15/10 REPOSTO, pelo VALIDADOR DE VERDADE — não por uma lista de checks
   * que eu escrevi. É o que prova que o resolvedor lê a forma que o sistema produz.
   */
  const comODefeito = () => {
    const r = parseBanrisulFatura(TXT)
    const semEncargo = {
      ...r,
      declared: { ...r.declared, encargosResumo: 0 },
      computed: { ...r.computed, sumEncargosResumo: 0, net: round2(r.computed.net - 110.39) },
    }
    return {
      validation: validateBanrisulFatura(semEncargo),
      linhas: r.extraction.lines?.length ?? 0,
    }
  }

  it('⭐ a recusa grava declarado 12.696,23 × calculado 12.585,84 — o par que o dono viu', () => {
    const { validation, linhas } = comODefeito()
    expect(validation.ok).toBe(false)

    const n = numerosDaQuarentena({ checks: validation.checks, linhas })

    expect(n.declarado).toBeCloseTo(12696.23, 2)
    expect(n.calculado).toBeCloseTo(12585.84, 2)
    // ⭐ e a diferença dos dois É os 110,39 da caça
    expect(round2(n.calculado! - n.declarado!)).toBeCloseTo(-110.39, 2)
  })

  /**
   * ⛔⛔ `linhas: 0` ERA A GRAVAÇÃO ANTIGA — e o documento tem 36 lançamentos. Zero ali
   * manda quem lê a fila procurar um parser que não leu nada, quando o parser leu tudo.
   */
  it('⛔ a recusa grava a CONTAGEM real (36), nunca o zero de antes', () => {
    const { validation, linhas } = comODefeito()
    expect(linhas).toBe(36)
    expect(numerosDaQuarentena({ checks: validation.checks, linhas }).linhas).toBe(36)
  })

  /**
   * ⭐⭐ O DESFECHO OK NÃO INVENTA DIVERGÊNCIA — e esta é a razão de o par vir SEMPRE da
   * mesma checagem. Com a cura aplicada a fatura fecha; se o `declarado` viesse do
   * `totalDeclarado` (12.796,76, o TOTAL DE GASTOS) e o `calculado` do `got` de outra
   * checagem, a linha OK apareceria com ~100 reais de diferença — número plausível e falso.
   */
  it('⭐⭐ a linha OK fecha: declarado == calculado, com a fatura que FECHA', () => {
    const r = parseBanrisulFatura(TXT)
    const v = validateBanrisulFatura(r)
    expect(v.ok).toBe(true)

    const n = numerosDaQuarentena({
      checks: v.checks,
      linhas: r.extraction.lines?.length ?? 0,
      totalDeclarado: r.declared.totalGastos ?? null,
    })

    expect(n.declarado).not.toBeNull()
    expect(n.calculado).not.toBeNull()
    expect(round2(n.calculado! - n.declarado!)).toBeCloseTo(0, 2)
  })

  /**
   * ⭐ E o `declarado` da linha OK concorda com o que o RESTO DA CASA chama de declarado
   * (o congelador e a tela usam o `TOTAL DE GASTOS` = 12.796,76). Sem a 2ª régua de escolha
   * ele cairia no `Saldo da fatura atual`, e a quarentena diria um número e o congelador
   * outro pro mesmo documento.
   */
  it('⭐ e ele bate com o total declarado que o congelador usa (12.796,76)', () => {
    const r = parseBanrisulFatura(TXT)
    const v = validateBanrisulFatura(r)
    const n = numerosDaQuarentena({
      checks: v.checks, linhas: 36, totalDeclarado: r.declared.totalGastos ?? null,
    })
    expect(n.declarado).toBeCloseTo(12796.76, 2)
  })
})

describe('⛔⛔ a escolha da checagem — uma régua, três casos', () => {
  const ck = (name: string, expected: number, got: number, pass: boolean) =>
    ({ name, expected, got, diff: round2(got - expected), pass })

  it('⛔ falhou → vale a de MAIOR diferença (é o número na cara do dono)', () => {
    const n = numerosDaQuarentena({
      checks: [
        ck('pequena', 100, 100.5, false),   // dif 0,50
        ck('GRANDE', 9000, 8000, false),    // dif −1000
        ck('passou', 50, 50, true),
      ],
      linhas: 7,
    })
    expect(n.declarado).toBe(9000)
    expect(n.calculado).toBe(8000)
  })

  it('⛔ a que PASSOU nunca ganha de uma que FALHOU, mesmo sendo maior', () => {
    const n = numerosDaQuarentena({
      checks: [ck('enorme que passou', 99999, 99999, true), ck('falhou', 10, 12, false)],
      linhas: 1,
    })
    expect(n.declarado).toBe(10)
    expect(n.calculado).toBe(12)
  })

  it('⭐ nenhuma falhou + total declarado → a checagem mais PRÓXIMA dele', () => {
    const n = numerosDaQuarentena({
      checks: [ck('saldo', 7995.55, 7995.55, true), ck('total', 7896.32, 7896.32, true)],
      linhas: 4,
      totalDeclarado: 7896.32,
    })
    expect(n.declarado).toBeCloseTo(7896.32, 2)
  })

  /**
   * ⛔⛔⛔ O CASO QUE ISOLA A MISTURA DE FONTES — e ele precisou ser achado pela REGRA 11.
   *
   * A 1ª versão deste arquivo "provava" que o par não mistura usando a fatura real, e
   * **repor a mistura passou VERDE**: nos documentos reais o total declarado É `expected` de
   * alguma checagem, então a 2ª régua de escolha já alinha os dois sozinha e a mistura não
   * aparece. *Reposição que não reproduz o defeito é um verde de graça.*
   *
   * ⚠️ É SINTÉTICO de propósito: o que isola é o total declarado **não ser** `expected` de
   * checagem nenhuma (banco em que ele é derivado). Aí tirar o `declarado` de uma fonte e o
   * `calculado` de outra faz uma linha **OK** nascer com 99,23 de divergência — número
   * plausível e falso, na coluna que existe pra medir divergência.
   */
  it('⛔⛔ total declarado que não é checagem nenhuma: o par ainda FECHA (não mistura fontes)', () => {
    const n = numerosDaQuarentena({
      checks: [ck('único', 7995.55, 7995.55, true)],
      linhas: 4,
      totalDeclarado: 7896.32, // derivado, não é `expected` de nada
    })
    expect(n.declarado).toBeCloseTo(7995.55, 2)
    expect(round2(n.calculado! - n.declarado!)).toBeCloseTo(0, 2)
  })

  it('⭐ nenhuma falhou e SEM total → a de maior valor (numa fatura, o total é o maior)', () => {
    const n = numerosDaQuarentena({
      checks: [ck('parcial', 120, 120, true), ck('total', 8000, 8000, true)],
      linhas: 4,
    })
    expect(n.declarado).toBe(8000)
  })
})

describe('⛔ ausência de medição NÃO é medição de ausência', () => {
  /**
   * ⚠️ Leitura por VISION não valida nada (não há `FaturaCheck`). Ali o `calculado` fica
   * **`null`** — zero afirmaria que a nossa soma deu nada.
   */
  it('⛔ sem checagem nenhuma: declarado = o total extraído, calculado = null (nunca 0)', () => {
    const n = numerosDaQuarentena({ checks: undefined, linhas: 12, totalDeclarado: 3053.32 })
    expect(n.declarado).toBeCloseTo(3053.32, 2)
    expect(n.calculado).toBeNull()
    expect(n.linhas).toBe(12)
  })

  it('⛔ sem checagem e sem total: os dois `null`, e NÃO explode', () => {
    const n = numerosDaQuarentena({})
    expect(n).toEqual({ declarado: null, calculado: null, linhas: 0 })
  })

  /**
   * ⚠️ O `details` do erro é `unknown`. Forma inesperada tem que degradar pra "sem números",
   * **nunca derrubar** — este caminho roda dentro de uma gravação fail-soft de diagnóstico.
   */
  it('⚠️ `details` com forma estranha degrada em silêncio, sem throw', () => {
    for (const lixo of ['texto', 42, null, {}, [null], [{ nome: 'x' }], [{ expected: NaN, got: 1 }]]) {
      expect(() => numerosDaQuarentena({ checks: lixo, totalDeclarado: 9 })).not.toThrow()
      expect(numerosDaQuarentena({ checks: lixo, totalDeclarado: 9 }).calculado).toBeNull()
    }
  })

  it('⭐ check sem `diff` tem a diferença DERIVADA, não descartada', () => {
    const n = numerosDaQuarentena({
      checks: [{ name: 'x', expected: 100, got: 90, pass: false }],
      linhas: 2,
    })
    expect(n.declarado).toBe(100)
    expect(n.calculado).toBe(90)
  })
})

describe('⛔⛔ a RECUSA leva a contagem, e a ROTA consome o resolvedor', () => {
  it('⭐ o erro carrega `linhas`', () => {
    const e = new CreditCardPjExtractError('VALIDATION_FAILED', 'não fecha', [], 'texto cru', 36)
    expect(e.linhas).toBe(36)
    expect(e.texto).toBe('texto cru')
  })

  /**
   * ⚠️⚠️ ESTE É ESTRUTURAL **E ASSUMIDO COMO TAL**, e o motivo é concreto: o `throw` mora
   * dentro do `extractInvoiceSmart`, que recebe **bytes de PDF** e chama o `pdftotext` — não
   * há injeção de dependência pra entregar texto a ele, então provar o `throw` por
   * comportamento exigiria um PDF real no repo (e o PDF do dono fica FORA, ordem dele).
   * O que dá pra afirmar daqui é que o ponto do `throw` **passa a contagem**, que é
   * exatamente o campo que vinha zerado.
   */
  it('⛔ o ponto do throw passa a contagem de linhas (nunca mais `linhas: 0`)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/credit-card-pj/extract-invoice-smart.ts'), 'utf-8')
    // ⚠️ ÂNCORA ESTRUTURAL, não literal: a 1ª versão deste guard casava o `throw` numa
    // linha só e ficou VERMELHA quando eu quebrei a chamada em várias linhas — ou seja,
    // vermelho com o código CERTO. Agora ele acha a construção que carrega VALIDATION_FAILED.
    const blocos = src.split('new CreditCardPjExtractError(').slice(1)
    const bloco = blocos.map((b) => b.slice(0, 400)).find((b) => b.includes("'VALIDATION_FAILED'"))
    expect(bloco, 'não achei o throw da validação — reaponte este guard').toBeTruthy()
    expect(bloco).toContain('validation.checks')
    expect(bloco, 'a recusa tem que levar o TEXTO (16/09)').toContain('text')
    expect(bloco, 'a recusa tem que levar a CONTAGEM (20/10)').toMatch(/parsed\.extraction\.lines\?\.length/)
  })

  /**
   * ⭐⭐ GUARD DE DOIS LADOS: os números não podem voltar a ser cravados **e** os dois
   * desfechos têm que passar pelo resolvedor. Um guard que só proibisse o `null` aprovaria o
   * dia em que alguém escrevesse uma segunda régua ali dentro.
   */
  it('⛔ a rota PJ não crava os números, e os DOIS desfechos usam a mesma função', () => {
    const rota = readFileSync(
      join(process.cwd(), 'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview/route.ts'),
      'utf-8',
    )
    const semComentario = rota.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    // ⛔ as formas EXATAS que estavam lá antes de 20/10
    expect(semComentario).not.toMatch(/declarado:\s*null/)
    expect(semComentario).not.toMatch(/calculado:\s*null/)
    expect(semComentario).not.toMatch(/linhas:\s*0\b/)

    // ⭐ e as duas chamadas a `guardarNaQuarentena` espalham o resolvedor
    const chamadas = semComentario.split('guardarNaQuarentena(').slice(1)
    expect(chamadas.length, 'a rota tem 2 desfechos: RECUSADA e OK').toBe(2)
    for (const c of chamadas) {
      expect(c.slice(0, 500)).toContain('...numerosDaQuarentena({')
    }
  })
})
