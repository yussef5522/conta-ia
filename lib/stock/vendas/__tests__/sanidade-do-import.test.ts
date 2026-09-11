// ⛔⛔⛔ 1.499 FANTAS NUM DIA — O GUARD QUE PERGUNTA ANTES DE BAIXAR (11/09/2026)
//
// **O dono:** *"import de vendas com quantidade por produto > N× a média dos últimos dias
// PARA e pergunta antes de baixar. Sanidade antes de escrever, como a conferência de
// fatura já faz."* ⛔ **Pergunta, não recusa cega** — dia de evento existe.

import { describe, it, expect } from 'vitest'
import { avaliarSanidade, FATOR_SUSPEITO } from '../sanidade-do-import'

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
