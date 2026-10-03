/**
 * ⛔⛔ M2 — PLAUSIBILIDADE DA DOSE, pela comparação ENTRE IRMÃOS (02/10/2026).
 *
 * ⭐ Os números são os REAIS da perícia do acém: `beef de xis` 0,091/0,044/0,020 e
 * `beef de hamburger` 0,110/0,055/0,018.
 *
 * ⚠️⚠️ **VÁRIAS ASSERÇÕES DESTE ARQUIVO FORAM INVERTIDAS COM O MOTIVO ESCRITO**, porque a régua
 * mudou depois de DUAS rodadas em prod derrubarem o denominador (ver o cabeçalho de
 * `plausibilidade-da-dose.ts`). A versão antiga acendia quando os TRÊS componentes desviavam
 * junto; hoje **esse caso cala de propósito** — ele é ESCALA/rendimento, e tem dono: o P3.
 * Emitir nos dois seria o mesmo problema contado duas vezes, mandando o dono conferir três
 * fichas que estão certas.
 *
 * ⭐ O que o M2 afirma agora é a metade **separável** da pergunta do dono (item 4b): *"ratio só
 * no acém = dose/versão da ficha"*. Essa leitura é imune ao denominador, porque o denominador
 * é o mesmo pros três irmãos e a normalização pela mediana o cancela.
 */
import { describe, it, expect } from 'vitest'
import {
  dosesSuspeitas,
  assinaturaDoDesvio,
  DESVIO_DA_DOSE,
} from '../plausibilidade-da-dose'

/** a ficha real do `beef de xis` (dose por lote) */
const XIS = [
  { itemId: 'acem', doseDaFicha: 0.091 },
  { itemId: 'peito', doseDaFicha: 0.044 },
  { itemId: 'gordura', doseDaFicha: 0.02 },
]

/** todos os componentes consumindo na MESMA proporção `razao` — a assinatura de ESCALA */
const todosIguais = (razao: number, escala: number) =>
  XIS.map((c) => ({ ...c, consumido: c.doseDaFicha * razao * escala }))

/** só UM componente fora, os outros na ficha — a assinatura de COMPONENTE */
const soUm = (itemId: string, razao: number, escala: number) =>
  XIS.map((c) => ({
    ...c,
    consumido: c.doseDaFicha * (c.itemId === itemId ? razao : 1) * escala,
  }))

describe('⭐ o M2 cala quando TODOS desviam junto — isso é ESCALA, e é do P3', () => {
  it('razão 1,00 nos três', () => {
    expect(dosesSuspeitas(todosIguais(1, 102), 102)).toEqual([])
  })

  it('⛔⛔ razão 1,21 nos TRÊS → CALA (asserção INVERTIDA em 02/10, com o motivo)', () => {
    /**
     * ⚠️ A 1ª versão deste teste exigia **3 suspeitas** aqui, e estava errada: três
     * componentes desviando na MESMA proporção não é dose nenhuma errada — é o lote. Medido em
     * prod, era essa leitura que produzia **81 avisos** repetindo o P3.
     */
    expect(dosesSuspeitas(todosIguais(1.21, 100), 100)).toEqual([])
  })

  it('⛔ e a MAIONESE de escala dupla (2,86 nos três) também CALA — era o caso de 12-13/09', () => {
    // ⚠️ também invertido: escala dupla é escala, não dose. Quem grita ali é o P3.
    expect(dosesSuspeitas(todosIguais(2.86, 50), 50)).toEqual([])
  })

  it('⭐⭐ e é por isso que a régua é IMUNE AO DENOMINADOR — a prova numérica', () => {
    /**
     * O MESMO consumo avaliado com escalas MUITO diferentes dá o MESMO veredito. É isto que
     * torna o invariante confiável mesmo com `escalaReceitas` torta no histórico (foram as
     * razões de +15344% que mostraram o problema).
     */
    const doses = soUm('acem', 1.4, 100)
    const a = dosesSuspeitas(doses, 100)
    const b = dosesSuspeitas(doses, 1) // denominador 100× errado
    expect(a.map((x) => x.itemId)).toEqual(['acem'])
    expect(b.map((x) => x.itemId)).toEqual(['acem'])
    expect(a[0].razao).toBeCloseTo(b[0].razao, 9)
  })

  it('⛔ escala zero → VAZIO (nunca divide por zero)', () => {
    expect(dosesSuspeitas(todosIguais(1, 100), 0)).toEqual([])
  })

  it('⛔⛔ ficha de UM componente não é avaliável — não há irmão com que comparar', () => {
    /**
     * ⚠️ Inventar veredito aqui seria o denominador falando, e o denominador é justamente o
     * que não dá pra confiar. Devolver vazio é a resposta honesta — a mesma disciplina do
     * *"uma pessoa só não é a mais rápida, é a única"* (06/09).
     */
    expect(dosesSuspeitas([{ itemId: 'x', doseDaFicha: 0.1, consumido: 999 }], 1)).toEqual([])
  })

  it('⛔⛔⛔ e com DOIS também não — a mediana de dois DILUI, e o guard calaria em silêncio', () => {
    /**
     * ⚠️⚠️ ESTE CASO FOI ACHADO POR UM TESTE VERMELHO, não por raciocínio: com 2 componentes a
     * mediana é a média, então um desvio de **40%** vira `+17%` num e `−17%` no outro — **os
     * dois abaixo do teto**. O invariante calaria exatamente no caso que ele existe pra achar.
     *
     * ⭐ E a resposta honesta é a trava do PAO DE MEL: com dois divergindo, **não há como saber
     * qual dos dois está errado**. Devolver vazio é dizer "não sei", que é verdade.
     */
    const doisComUmFora = [
      { itemId: 'acem', doseDaFicha: 0.091, consumido: 0.091 * 1.4 * 100 },
      { itemId: 'peito', doseDaFicha: 0.044, consumido: 0.044 * 100 },
    ]
    expect(dosesSuspeitas(doisComUmFora, 100)).toEqual([])
    // ⭐ e o contrafactual: com o TERCEIRO irmão, o mesmo desvio acende
    expect(
      dosesSuspeitas([...doisComUmFora, { itemId: 'gordura', doseDaFicha: 0.02, consumido: 0.02 * 100 }], 100),
    ).toHaveLength(1)
  })
})

describe('⛔⛔ e ACENDE quando UM componente foge dos irmãos — a pergunta do item 4b', () => {
  it('⭐ "ratio só no acém" → acende NOMEANDO ele, assinatura COMPONENTE', () => {
    const s = dosesSuspeitas(soUm('acem', 1.4, 100), 100)
    expect(s.map((x) => x.itemId)).toEqual(['acem'])
    expect(s[0].razao).toBeCloseTo(1.4, 6)
    expect(s[0].lado).toBe('ACIMA')
    expect(assinaturaDoDesvio(s, 3)).toBe('COMPONENTE')
  })

  it('⭐ consumo A MENOS num componente também acende (o lado que ninguém procura)', () => {
    /**
     * ⚠️ Desvio pra BAIXO passa batido porque "sobrou" não dói no bolso na hora — mas é o
     * sinal de ficha gorda, que é exatamente o caso do fermento de 59 g (28/09).
     */
    const s = dosesSuspeitas(soUm('gordura', 0.5, 80), 80)
    expect(s.map((x) => x.itemId)).toEqual(['gordura'])
    expect(s[0].lado).toBe('ABAIXO')
  })

  it('⭐⭐ a MEDIANA protege o desviante de se esconder — com MÉDIA ele escapava', () => {
    /**
     * ⛔ Com a média como referência, o componente fora **puxa a própria referência** e a
     * razão dele encolhe. A mediana de 3 valores não se move quando um foge — é por isso que
     * ela é a escolha, e não "estatística mais bonita".
     */
    const s = dosesSuspeitas(soUm('acem', 2, 100), 100)
    expect(s[0].razao).toBeCloseTo(2, 6) // com média seria ~1,5 e cairia perto do teto
  })

  it('⛔ dois de três fora, com razões DIFERENTES → acende os dois', () => {
    const doses = [
      { itemId: 'acem', doseDaFicha: 0.091, consumido: 0.091 * 1.5 * 100 },
      { itemId: 'peito', doseDaFicha: 0.044, consumido: 0.044 * 100 },
      { itemId: 'gordura', doseDaFicha: 0.02, consumido: 0.02 * 0.4 * 100 },
    ]
    const s = dosesSuspeitas(doses, 100)
    expect(s.map((x) => x.itemId).sort()).toEqual(['acem', 'gordura'])
  })
})

describe('⚠️ a faixa é ±20% e isso é DECISÃO MEDIDA, não gosto', () => {
  it('a borda exata de 20% não acende; 21% acende', () => {
    expect(DESVIO_DA_DOSE).toBe(0.2)
    expect(dosesSuspeitas(soUm('acem', 1.2, 100), 100)).toEqual([])
    expect(dosesSuspeitas(soUm('acem', 1.21, 100), 100)).toHaveLength(1)
  })

  it('⛔ a ±3% a folga normal da cozinha viraria ruído — o contrafactual dos 20%', () => {
    expect(dosesSuspeitas(soUm('acem', 1.06, 192), 192)).toEqual([])
    expect(dosesSuspeitas(soUm('acem', 1.06, 192), 192, 0.03)).toHaveLength(1)
  })
})
