// ⛔⛔⛔ 1.499 FANTAS NUM DIA — O GUARD QUE PERGUNTA ANTES DE BAIXAR (11/09/2026)
//
// **O dono:** *"import de vendas com quantidade por produto > N× a média dos últimos dias
// PARA e pergunta antes de baixar. Sanidade antes de escrever, como a conferência de
// fatura já faz."* ⛔ **Pergunta, não recusa cega** — dia de evento existe.

import { describe, it, expect } from 'vitest'
import { avaliarSanidade, FATOR_SUSPEITO, MIN_DIAS_PRA_NORMAL } from '../sanidade-do-import'

/** o histórico REAL da Caçula: 745 / 576 / 536 / 387 ocorrências por dia */
const MEDIA_DO_DIA = 561
const HIST = [
  { produto: 'FANTA UVA 2L', mediaDiaria: 4, dias: 14 },
  { produto: 'COCA COLA 2L', mediaDiaria: 8, dias: 14 },
  { produto: 'XIS - COMPLETO', mediaDiaria: 105, dias: 14 },
]

describe('⛔⛔ o dia 10/09 seria barrado', () => {
  // as linhas como o parser errado as leu
  const RUIM = [
    { produto: 'FANTA UVA 2L', quantidade: 1499 },
    { produto: 'COCA COLA 2L', quantidade: 1499 },
    { produto: 'BORDA FRANGO CATUPIRY', quantidade: 2499 },
  ]

  it('a FANTA acende com a frase do dono', () => {
    const r = avaliarSanidade(RUIM, HIST, MEDIA_DO_DIA)
    expect(r.precisaConfirmar).toBe(true)
    const f = r.suspeitas.find((s) => s.produto === 'FANTA UVA 2L')!
    expect(f.frase).toBe('FANTA UVA 2L: 1.499 num dia — o normal é 4. Confirma?')
  })

  it('⭐ e o TOTAL sozinho já pararia: 53.761 contra ~561 é 96×', () => {
    // ⚠️ o layout trocado desloca o arquivo INTEIRO — nem sempre um produto isolado passa
    // do fator, mas o total passa sempre.
    const r = avaliarSanidade([{ produto: 'SO UM', quantidade: 53761 }], [], MEDIA_DO_DIA)
    expect(r.precisaConfirmar).toBe(true)
    expect(r.vezesNoTotal).toBeGreaterThan(FATOR_SUSPEITO)
  })
})

describe('⭐ o dia NORMAL passa direto — alarme falso mata o alarme', () => {
  it('o arquivo real de 10/09 (o de PRODUTOS) não acende nada', () => {
    const bom = [
      { produto: 'XIS - COMPLETO', quantidade: 105 },
      { produto: 'COCA COLA 2L', quantidade: 8 },
      { produto: 'FANTA UVA 2L', quantidade: 1 },
    ]
    expect(avaliarSanidade(bom, HIST, MEDIA_DO_DIA).precisaConfirmar).toBe(false)
  })

  it('⚠️ produto SEM histórico não vira suspeita (item novo vende pela 1ª vez)', () => {
    const r = avaliarSanidade([{ produto: 'PRODUTO NOVO', quantidade: 300 }], HIST, MEDIA_DO_DIA)
    expect(r.suspeitas).toHaveLength(0)
  })

  it('⚠️ número PEQUENO não assusta: 2 viram 20 num sábado sem nada errado', () => {
    const r = avaliarSanidade(
      [{ produto: 'FANTA UVA 2L', quantidade: 19 }], HIST, MEDIA_DO_DIA,
    )
    expect(r.suspeitas).toHaveLength(0)
  })

  it('⭐ mas 10× acima com volume acende', () => {
    const r = avaliarSanidade([{ produto: 'XIS - COMPLETO', quantidade: 1100 }], HIST, MEDIA_DO_DIA)
    expect(r.suspeitas[0].vezes).toBeCloseTo(10.5, 1)
  })
})

describe('⭐⭐ (16/11) o "normal é 1" de domingo — gêmeos de grafia SOMAM, e normal precisa de dias', () => {
  // ⭐ o histórico MEDIDO em prod que a trava viu em 16/11 04:17 (02/11→14/11)
  const HIST_DOMINGO = [
    { produto: 'XIS COMPLETO', mediaDiaria: 36, dias: 13 },
    { produto: 'XIS - COMPLETO', mediaDiaria: 182.5, dias: 2 },
    { produto: 'Xis Completo', mediaDiaria: 1, dias: 2 },
  ]
  it('88 XIS COMPLETO num domingo de promoção NÃO para o dia (o normal somado é ~55/dia)', () => {
    const r = avaliarSanidade([{ produto: 'XIS COMPLETO', quantidade: 88 }], HIST_DOMINGO, 700)
    expect(r.suspeitas).toEqual([])
    expect(r.precisaConfirmar).toBe(false)
  })
  it('o dia também soma os gêmeos: 60 + 28 grafados diferente são 88 do mesmo produto', () => {
    const hist = [{ produto: 'FANTA UVA 2L', mediaDiaria: 4, dias: 14 }]
    const r = avaliarSanidade([{ produto: 'FANTA UVA 2L', quantidade: 15 }, { produto: 'Fanta Uva 2L', quantidade: 30 }], hist, 700)
    expect(r.suspeitas).toHaveLength(1)
    expect(r.suspeitas[0].frase).toBe('FANTA UVA 2L: 45 num dia — o normal é 4. Confirma?')
  })
  it(`menos de ${MIN_DIAS_PRA_NORMAL} dias de histórico não é "normal" — não pergunta`, () => {
    const r = avaliarSanidade([{ produto: 'XIS COMPLETO', quantidade: 300 }], [{ produto: 'Xis Completo', mediaDiaria: 1, dias: MIN_DIAS_PRA_NORMAL - 1 }], 700)
    expect(r.suspeitas).toEqual([])
  })
  it('⛔ o gêmeo pequeno NÃO esmaga o principal mesmo com dias suficientes (a última grafia nunca vence)', () => {
    const hist = [{ produto: 'XIS COMPLETO', mediaDiaria: 36, dias: 13 }, { produto: 'Xis Completo', mediaDiaria: 1, dias: MIN_DIAS_PRA_NORMAL }]
    expect(avaliarSanidade([{ produto: 'XIS COMPLETO', quantidade: 88 }], hist, 700).suspeitas).toEqual([])
  })
  it('com dias suficientes, o salto de verdade ainda acende', () => {
    const r = avaliarSanidade([{ produto: 'Xis Completo', quantidade: 600 }], HIST_DOMINGO, 700)
    expect(r.suspeitas[0]?.produto).toBe('Xis Completo')
  })
})
