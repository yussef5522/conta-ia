/**
 * ⛔⛔⛔ O PIN DO PAR — ordem de 10 beefs separa a dose da ficha × 10 (03/10/2026).
 *
 * **O caso vivo:** *"ordem de beef de xis pede 10 → separa pra ~6,7 · hamburger OK"*. Medido em
 * prod, as duas fichas estão **iguais e corretas** (`loteBase 1`, doses por unidade, nunca
 * alteradas) — o que diferia era o **rendimento MEDIDO** (xis 1,4749, hamburger 0,9326), e a
 * escala nascia de `pedido ÷ rendimento`.
 *
 * ⭐⭐⭐ **A CURA É A DECISÃO DO DONO, e ela é mais forte que qualquer estatística:**
 *
 * > *"A separação da ordem é SEMPRE ficha × pedido, SEM rendimento no meio. O rendimento
 * > medido (mediana, faixa, tudo) SAI da conta da separação — ele NUNCA multiplica nem divide
 * > nada. Se funcionário rende mal ou rouba, um sistema que adapta a separação pela medição
 * > APRENDE o roubo como normal e passa a cobrir ele."*
 *
 * ⚠️⚠️ **ESTE ARQUIVO MUDOU DE VEREDITO NO MESMO DIA, e as duas versões ficam registradas:**
 * pela manhã eu entreguei MEDIANA + FAIXA DE CONCORDÂNCIA (duas camadas afinando a
 * estatística) e **inverti o pin do hamburger pra 1,158**, argumentando que os 22 lotes dele
 * mediam perda real de trim. O dono recusou a premissa inteira: **perda só entra na conta se
 * ELE declarar na ficha.** O pin do hamburger voltou ao NOMINAL, e a mediana/faixa saíram da
 * separação (viraram espelho — `eficiencia-da-ordem.ts` + juiz P8).
 */
import { describe, it, expect } from 'vitest'
import { escalaDoPedido, insumoDoPedido } from '../escala-da-ordem'
import { eficienciaMedia, DESVIO_ALERTA } from '../previsao-rendimento'
import { medianaDosRendimentos } from '../conclusao'
import { avisosDaEscala } from '../escala-do-pedido'
import { eficienciaDaOrdem, fraseDaEficiencia, EFICIENCIA_MINIMA } from '../eficiencia-da-ordem'

/** os rendimentos REAIS dos 5 últimos lotes de cada ficha, medidos em prod em 03/10 */
const XIS_5 = [1.0400, 1.0598, 1.2532, 1.8803, 2.1411]
const HAMBURGER_5 = [0.9420, 0.9499, 0.9568, 0.8250, 0.9894]

/** as fichas REAIS (loteBase 1, dose por unidade) */
const XIS = { acem: 0.091, peito: 0.044, gordura: 0.02 }
const HAMBURGER = { acem: 0.11, peito: 0.055, gordura: 0.018 }

describe('⛔⛔⛔ O PIN: pedir 10 separa a dose da ficha × 10 — NOS DOIS BEEFS', () => {
  it('⭐ 10 beef de xis → 0,910 acém · 0,440 peito · 0,200 gordura', () => {
    const p = { pedido: 10, loteBase: 1 }
    expect(escalaDoPedido(p)).toBe(10)
    expect(insumoDoPedido(p, XIS.acem)).toBeCloseTo(0.910, 6)
    expect(insumoDoPedido(p, XIS.peito)).toBeCloseTo(0.440, 6)
    expect(insumoDoPedido(p, XIS.gordura)).toBeCloseTo(0.200, 6)
  })

  it('⭐⭐ 10 beef de hamburger → 1,100 · 0,550 · 0,180 — O NOMINAL DA FICHA DELE', () => {
    /**
     * ⭐ **ESTA ASSERÇÃO FOI INVERTIDA DUAS VEZES EM 03/10, e a 2ª é a que vale.**
     *
     * De manhã ela exigia **1,158** (a mediana de 0,9499 dos 22 lotes dividindo o pedido), com
     * o argumento de que a cozinha consome ~5% mais carne por beef e entregar o nominal faria
     * faltar material. **O dono recusou:** *"perda de trim só entra se EU mudar a ficha"*. Se
     * o acém limpo rende 95% do cru, ele declara isso — e aí o nominal JÁ inclui a perda.
     *
     * ⚠️ E o motivo de fundo não é preferência: **1,158 é o sistema cobrindo um desvio que
     * ninguém decidiu.** Amanhã o desvio pode ser 7%, depois 12%, e a separação acompanharia
     * calada até ninguém saber mais qual era a receita.
     */
    const p = { pedido: 10, loteBase: 1 }
    expect(insumoDoPedido(p, HAMBURGER.acem)).toBeCloseTo(1.100, 6)
    expect(insumoDoPedido(p, HAMBURGER.peito)).toBeCloseTo(0.550, 6)
    expect(insumoDoPedido(p, HAMBURGER.gordura)).toBeCloseTo(0.180, 6)
  })

  it('⛔⛔ e a MEDIÇÃO não muda NADA na separação — a prova por contrafactual', () => {
    /**
     * ⭐ O mesmo pedido, com a medição que PRODUZIU o defeito (a média envenenada do xis) e
     * com a mediana e com o rendimento do cheddar (1027%): **os três dão 0,910**, porque
     * nenhum deles tem como entrar na conta. É o coração do sprint.
     */
    const p = { pedido: 10, loteBase: 1 }
    const nominal = insumoDoPedido(p, XIS.acem)
    expect(nominal).toBeCloseTo(0.910, 6)

    // ⛔ o contrafactual do mundo ANTIGO: era assim que 10 virava 6,78
    const mediaEnvenenada = XIS_5.reduce((s, r) => s + r, 0) / XIS_5.length
    expect(mediaEnvenenada).toBeCloseTo(1.4749, 4)
    expect((10 / mediaEnvenenada) * XIS.acem).toBeCloseTo(0.617, 3)
    // ⭐ e a mediana, que foi a minha 1ª cura: também não é 0,910
    expect((10 / medianaDosRendimentos(XIS_5)!) * XIS.acem).not.toBeCloseTo(0.910, 3)
    // ⛔⛔ a BOMBA do QUEIJO CHEDDAR (medido 10,2704 em prod) separava pra 1 unidade
    expect((10 / 10.2704) * XIS.acem).toBeCloseTo(0.0886, 4)
    // ⭐⭐ e com a régua de HOJE nenhuma delas alcança a conta: não há onde passá-las
    expect(nominal).toBe(insumoDoPedido({ pedido: 10, loteBase: 1 }, XIS.acem))
  })

  it('⭐ loteBase > 1 divide o pedido — é o ÚNICO divisor que existe', () => {
    // massa que rende 17 metades: pedir 34 metades = 2 receitas
    expect(escalaDoPedido({ pedido: 34, loteBase: 17 })).toBe(2)
    expect(insumoDoPedido({ pedido: 34, loteBase: 17 }, 5)).toBe(10)
  })

  it('⛔ pedido ou lote inválido devolve null — nunca chuta', () => {
    expect(escalaDoPedido({ pedido: 0, loteBase: 1 })).toBeNull()
    expect(escalaDoPedido({ pedido: 10, loteBase: 0 })).toBeNull()
    expect(insumoDoPedido({ pedido: 10, loteBase: 1 }, 0)).toBeNull()
  })
})

describe('⭐⭐ A MEDIÇÃO VIROU ESPELHO — eficiência por ordem (item 1 do dono)', () => {
  it('⭐ "pedi 10 · produziu 9 → 90%", com o consumo real por componente', () => {
    const ef = eficienciaDaOrdem({
      escala: 10, loteBase: 1, qtdGerada: 9,
      componentes: [
        { nome: 'Acém', unidade: 'KG', porLote: XIS.acem, consumido: 0.95 },
        { nome: 'Peito', unidade: 'KG', porLote: XIS.peito, consumido: 0.44 },
      ],
    })
    expect(ef.pedido).toBe(10)
    expect(ef.produzido).toBe(9)
    expect(ef.pct).toBeCloseTo(0.9, 6)
    expect(ef.faixa).toBe('NORMAL') // 90% ainda está dentro de ±15%
    // ⭐ plano × real lado a lado, que é o pedido literal do dono
    expect(ef.componentes[0]).toMatchObject({ plano: 0.91, real: 0.95 })
    expect(ef.componentes[0].gap).toBeCloseTo(0.04, 6)
    expect(ef.componentes[1].gap).toBe(0) // consumiu exatamente a ficha
  })

  it('⭐⭐ abaixo de 85% ACENDE — e os 85% são a faixa de ±15% da casa, não um número novo', () => {
    expect(EFICIENCIA_MINIMA).toBe(0.85)
    expect(EFICIENCIA_MINIMA).toBe(1 - DESVIO_ALERTA)

    const ruim = eficienciaDaOrdem({
      escala: 10, loteBase: 1, qtdGerada: 8,
      componentes: [{ nome: 'Acém', unidade: 'KG', porLote: XIS.acem, consumido: 0.91 }],
    })
    expect(ruim.pct).toBeCloseTo(0.8, 6)
    expect(ruim.faixa).toBe('ABAIXO')
    expect(ruim.alerta).toBe(true)
  })

  it('⛔ render ACIMA aparece, mas NÃO acende alarme', () => {
    /**
     * ⚠️ Produzir mais do que a receita promete não é prejuízo — é sinal de ficha generosa, e
     * isso se lê no relatório. **Alarme nos dois lados viraria alarme em todo lote.**
     */
    const bom = eficienciaDaOrdem({
      escala: 10, loteBase: 1, qtdGerada: 12,
      componentes: [{ nome: 'Acém', unidade: 'KG', porLote: XIS.acem, consumido: 0.91 }],
    })
    expect(bom.faixa).toBe('ACIMA')
    expect(bom.alerta).toBe(false)
  })

  it('⛔ ficha sem lote base declarado → SEM_PEDIDO, nunca 0%', () => {
    const ef = eficienciaDaOrdem({ escala: 10, loteBase: 0, qtdGerada: 9, componentes: [] })
    expect(ef.pedido).toBeNull()
    expect(ef.pct).toBeNull()
    expect(ef.faixa).toBe('SEM_PEDIDO')
    expect(ef.alerta).toBe(false)
  })

  it('⭐ o espelho da ficha: a média só existe com 2+ lotes', () => {
    expect(eficienciaMedia({ teorico: 1, medido: 1.2532, lotes: 27 })).toEqual({ pct: 1.2532, lotes: 27 })
    expect(eficienciaMedia({ teorico: 1, medido: 1.2532, lotes: 1 })).toBeNull()
    expect(eficienciaMedia({ teorico: 1, medido: null, lotes: 0 })).toBeNull()
  })
})

describe('⛔⛔ OS AVISOS DO ATO DA CRIAÇÃO — denunciam, não corrigem', () => {
  it('⭐ a ficha do xis acusa o LOTE NÃO COMPARÁVEL e a MÉDIA que destoa', () => {
    const a = avisosDaEscala({
      pedido: 10, loteBase: 1, unidadeLoteBase: 'KG', unidadeProduto: 'UN',
      maiorDose: { nome: 'Acém', dose: XIS.acem },
      espelho: { pct: 1.2532, lotes: 27 },
    })
    expect(a.map((x) => x.motivo)).toEqual(['LOTE_NAO_COMPARAVEL', 'MEDIA_DESTOA'])
    expect(a[0].frase).toContain('não diz quantas UN saem')
    // ⭐ o número em KG que o dono reconhece de olho, agora sempre o NOMINAL
    expect(a[0].frase).toContain('0.91')
    expect(a[1].frase).toContain('125%')
    expect(a[1].frase).toContain('A separação segue a ficha')
  })

  it('⛔ nenhuma frase de TELA carrega markdown — o dono veria os asteriscos', () => {
    /**
     * ⚠️⚠️ **DEFEITO REAL QUE EU INTRODUZI E SÓ APARECEU NO BUNDLE DE PROD.** Eu escrevi
     * `**A separação segue a ficha**` pra dar ênfase; a tela renderiza `{a.frase}` como texto
     * puro, então sairia com os asteriscos na faixa âmbar. **O `**` é a convenção dos
     * COMENTÁRIOS deste repo e não atravessa pra UI.**
     */
    const frases = [
      ...avisosDaEscala({
        pedido: 10, loteBase: 1, unidadeLoteBase: 'KG', unidadeProduto: 'UN',
        maiorDose: { nome: 'Acém', dose: XIS.acem }, espelho: { pct: 1.2532, lotes: 27 },
      }).map((a) => a.frase),
      fraseDaEficiencia(
        eficienciaDaOrdem({
          escala: 10, loteBase: 1, qtdGerada: 8,
          componentes: [{ nome: 'Acém', unidade: 'KG', porLote: XIS.acem, consumido: 0.95 }],
        }),
        'UN',
      ) ?? '',
    ]
    for (const f of frases) {
      expect(f, f).not.toContain('**')
      expect(f, f).not.toMatch(/[`_]{2}|<\/?[a-z]+>/i) // nem backtick/underscore de ênfase, nem HTML
    }
  })

  it('⛔⛔ `SEPARACAO_DESTOA` MORREU — asserção INVERTIDA, com o motivo escrito', () => {
    /**
     * ⚠️ De manhã este aviso comparava a separação proposta com a dose nominal e acendia
     * quando destoava mais de 20% (era o *"pedindo 10, vai propor 0,617 onde a ficha pede
     * 0,910"*). **Com a separação sendo a ficha, as duas são a MESMA coisa por construção** —
     * o aviso não tem como disparar. Aviso impossível ocupa a faixa âmbar e ensina o dono a
     * não ler nenhum. (Ver o cabeçalho de `escala-do-pedido.ts`.)
     */
    const motivos = avisosDaEscala({
      pedido: 10, loteBase: 1, unidadeLoteBase: 'UN', unidadeProduto: 'UN',
      maiorDose: { nome: 'Acém', dose: XIS.acem },
      espelho: { pct: 1.0, lotes: 27 },
    }).map((x) => x.motivo)
    expect(motivos).not.toContain('SEPARACAO_DESTOA' as never)
    expect(motivos).toEqual([]) // ficha coerente + média coerente = silêncio
  })

  it('⭐ a folga de 6% da cozinha NÃO acende — senão o aviso morre de ruído', () => {
    /** ⚠️ É o `beef de hamburger`: 94-99% é a vida real, e ela não é denúncia. */
    const a = avisosDaEscala({
      pedido: 10, loteBase: 1, unidadeLoteBase: 'UN', unidadeProduto: 'UN',
      maiorDose: { nome: 'Acém', dose: HAMBURGER.acem },
      espelho: { pct: medianaDosRendimentos(HAMBURGER_5)!, lotes: 22 },
    })
    expect(medianaDosRendimentos(HAMBURGER_5)).toBe(0.9499)
    expect(a).toEqual([])
  })

  it('⛔ sem espelho (ficha nova) NÃO inventa denúncia', () => {
    expect(
      avisosDaEscala({
        pedido: 10, loteBase: 1, unidadeLoteBase: 'UN', unidadeProduto: 'UN',
        maiorDose: { nome: 'Acém', dose: XIS.acem }, espelho: null,
      }),
    ).toEqual([])
  })
})
