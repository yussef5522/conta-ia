/**
 * ⛔⛔ M2 — PLAUSIBILIDADE DA DOSE (02/10/2026).
 *
 * ⭐ Os números são os REAIS da perícia do acém: `beef de xis` 0,091/0,044/0,020 e
 * `beef de hamburger` 0,110/0,055/0,018, razões efetivas medidas em 1,00–1,06 com **um
 * outlier de 1,21 em 26/09**. É o teste que prova que o M2 **cala no normal e acende no
 * outlier** — porque aviso que acende em tudo é aviso que o dono aprende a ignorar.
 */
import { describe, it, expect } from 'vitest'
import {
  dosesSuspeitas,
  assinaturaDoDesvio,
  DESVIO_DA_DOSE,
} from '../plausibilidade-da-dose'

/** a ficha real do `beef de xis` (dose por unidade) */
const XIS = [
  { itemId: 'acem', doseDaFicha: 0.091 },
  { itemId: 'peito', doseDaFicha: 0.044 },
  { itemId: 'gordura', doseDaFicha: 0.02 },
]

/**
 * monta o consumo como se a ordem de escala `escala` tivesse rodado com a razão dada.
 *
 * ⚠️ O 2º parâmetro é a **ESCALA DA ORDEM** (quantos lotes o plano mandou), não as unidades
 * produzidas — a prova em prod mostrou que dividir por unidades mede o RENDIMENTO (que vai de
 * 0,04 a 3,78 na Caçula) e não a dose. Ver o cabeçalho de `plausibilidade-da-dose.ts`.
 */
const comRazao = (razao: number, escala: number) =>
  XIS.map((c) => ({ ...c, consumido: c.doseDaFicha * razao * escala }))

describe('⭐ o M2 cala no normal', () => {
  it('razão 1,00 — a ordem consumiu exatamente a ficha', () => {
    expect(dosesSuspeitas(comRazao(1, 102), 102)).toEqual([])
  })

  it('razão 1,06 — a folga normal de separação da cozinha NÃO acende', () => {
    /**
     * ⚠️ É a faixa medida nas ordens reais: `consumo == escala × dose` fecha exato em 13 de
     * 16, e o que sobra é a folga de quem tira da câmara. Acender aqui transformaria a
     * rotina inteira em alarme.
     */
    expect(dosesSuspeitas(comRazao(1.06, 192), 192)).toEqual([])
  })

  it('⛔ ordem sem escala devolve VAZIO — não existe "dose por lote" de zero lote', () => {
    /**
     * A mesma disciplina do *"tempo zero não é velocidade infinita"* (06/09): dividir por
     * zero aqui inventaria um desvio infinito. Ordem parada é assunto do P2.
     */
    expect(dosesSuspeitas(comRazao(1, 100), 0)).toEqual([])
    expect(dosesSuspeitas([{ itemId: 'x', doseDaFicha: 0, consumido: 5 }], 10)).toEqual([])
  })
})

describe('⛔⛔ e acende no outlier — com a ASSINATURA que diz onde olhar', () => {
  it('o 1,21 de 26/09 acende nos três componentes, e a assinatura é ESCALA', () => {
    const s = dosesSuspeitas(comRazao(1.21, 100), 100)
    expect(s).toHaveLength(3)
    expect(s.every((x) => x.lado === 'ACIMA')).toBe(true)
    expect(s[0].razao).toBeCloseTo(1.21, 6)
    /**
     * ⭐⭐ A LEITURA QUE O DONO DITOU: razão IDÊNTICA nos N componentes = **ESCALA** (o caso
     * da maionese), não as doses. Sem isso, três avisos mandariam conferir três fichas que
     * estão certas — e o dono perderia a tarde no lugar errado.
     */
    expect(assinaturaDoDesvio(s, 3)).toBe('ESCALA')
  })

  it('⭐ razão SÓ no acém = assinatura de COMPONENTE (dose ou versão da ficha)', () => {
    /**
     * É literalmente a pergunta do dono no item 4b: *"ratio só no acém = dose/versão da
     * ficha — alguém mudou?"*. O M2 separa os dois casos sozinho.
     */
    const doses = [
      { itemId: 'acem', doseDaFicha: 0.091, consumido: 0.091 * 1.4 * 100 },
      { itemId: 'peito', doseDaFicha: 0.044, consumido: 0.044 * 100 },
      { itemId: 'gordura', doseDaFicha: 0.02, consumido: 0.02 * 100 },
    ]
    const s = dosesSuspeitas(doses, 100)
    expect(s.map((x) => x.itemId)).toEqual(['acem'])
    expect(assinaturaDoDesvio(s, 3)).toBe('COMPONENTE')
  })

  it('⭐ a MAIONESE de escala dupla (razão ~2,86) acende alto — era o caso de 12-13/09', () => {
    const s = dosesSuspeitas(comRazao(2.86, 50), 50)
    expect(s).toHaveLength(3)
    expect(Math.abs(s[0].razao - 1)).toBeGreaterThan(1)
    expect(assinaturaDoDesvio(s, 3)).toBe('ESCALA')
  })

  it('⛔ consumo A MENOS também acende (o lado que ninguém procura)', () => {
    /**
     * ⚠️ Desvio pra BAIXO costuma passar batido porque "sobrou" não dói no bolso na hora —
     * mas é o sinal de ficha gorda, que é exatamente o caso do fermento de 59 g (28/09).
     */
    const s = dosesSuspeitas(comRazao(0.5, 100), 100)
    expect(s).toHaveLength(3)
    expect(s.every((x) => x.lado === 'ABAIXO')).toBe(true)
  })
})

describe('⚠️ a faixa é ±20% e isso é DECISÃO MEDIDA, não gosto', () => {
  it('a borda exata de 20% não acende; 21% acende', () => {
    expect(DESVIO_DA_DOSE).toBe(0.2)
    expect(dosesSuspeitas(comRazao(1.2, 100), 100)).toEqual([])
    expect(dosesSuspeitas(comRazao(1.21, 100), 100)).toHaveLength(3)
  })

  it('⛔ a ±10% a rotina da Caçula viraria ruído — o contrafactual que justifica os 20%', () => {
    /**
     * Com a faixa que o dono NÃO escolheu, a ordem de razão 1,06 (que é o dia normal da
     * cozinha) acenderia — e o aviso morreria no primeiro mês.
     */
    expect(dosesSuspeitas(comRazao(1.06, 192), 192, 0.03)).toHaveLength(3)
  })
})
