/**
 * ⭐⭐⭐ A LEI DO DIA FECHADO — os casos puros (17/10/2026).
 *
 * ⚠️ O caso **PENDENTE não existe no dado de prod hoje** (medido: 0 dias sem baixa de venda em
 * 34), então ele só se prova aqui — e é justamente o estado que o "—" existe pra representar.
 * *Guard que só exercita o estado bom é uma afirmação sobre o mundo bom.*
 */
import { describe, it, expect } from 'vitest'
import {
  estadoDoDia,
  valorDoDia,
  entraNaMedia,
  temDiaAApurar,
  montarDias,
  legendaDaCobertura,
} from '../dia-do-consumo'

const VAZIO = new Set<string>()
const dow = () => 0
const id = (n: number) => n

describe('⭐⭐ OS ESTADOS — e a ORDEM das perguntas é a lei', () => {
  it('dia passado sem pendência é FECHADO', () => {
    expect(estadoDoDia('2026-10-14', '2026-10-17', VAZIO)).toBe('FECHADO')
  })

  it('dia passado com pendência é PENDENTE', () => {
    expect(estadoDoDia('2026-10-14', '2026-10-17', new Set(['2026-10-14']))).toBe('PENDENTE')
  })

  it('⭐ HOJE ganha de PENDENTE — hoje é aberto por natureza, não pendente', () => {
    // ⛔ se a ordem invertesse, o dono esperaria de manhã um arquivo que só chega de noite
    expect(estadoDoDia('2026-10-17', '2026-10-17', new Set(['2026-10-17']))).toBe('HOJE')
  })

  it('⭐ FUTURO ganha de tudo — dia que não aconteceu não pode estar pendente', () => {
    expect(estadoDoDia('2026-10-18', '2026-10-17', new Set(['2026-10-18']))).toBe('FUTURO')
  })

  it('⭐ dia antes do 1º movimento do item é SEM_LIVRO, mesmo sem pendência', () => {
    expect(estadoDoDia('2026-10-01', '2026-10-17', VAZIO, '2026-10-10')).toBe('SEM_LIVRO')
    expect(estadoDoDia('2026-10-10', '2026-10-17', VAZIO, '2026-10-10')).toBe('FECHADO')
  })
})

describe('⛔⛔ O VALOR — zero é DADO, "a apurar" é AUSÊNCIA', () => {
  it('⭐ FECHADO sem movimento vale ZERO, nunca null (o caso do coxão)', () => {
    expect(valorDoDia('FECHADO', undefined)).toBe(0)
  })
  it('FECHADO com movimento vale o movimento', () => {
    expect(valorDoDia('FECHADO', 27.9)).toBe(27.9)
  })
  it('⭐ HOJE vale o PARCIAL já lançado', () => {
    expect(valorDoDia('HOJE', 3)).toBe(3)
    expect(valorDoDia('HOJE', undefined)).toBe(0)
  })
  it('⛔ PENDENTE / FUTURO / SEM_LIVRO são os ÚNICOS null', () => {
    expect(valorDoDia('PENDENTE', 5)).toBeNull()
    expect(valorDoDia('FUTURO', undefined)).toBeNull()
    expect(valorDoDia('SEM_LIVRO', 5)).toBeNull()
  })
})

describe('⛔⛔ A MÉDIA — só o dia FECHADO entra', () => {
  it('⭐ FECHADO entra (é o que faz o zero contar)', () => {
    expect(entraNaMedia('FECHADO')).toBe(true)
  })
  it('⛔ HOJE fica FORA — parcial puxaria toda média pra baixo no meio do dia', () => {
    expect(entraNaMedia('HOJE')).toBe(false)
  })
  it('⛔ PENDENTE fica fora: não é zero nem número', () => {
    expect(entraNaMedia('PENDENTE')).toBe(false)
  })
  it('⛔ SEM_LIVRO e FUTURO ficam fora', () => {
    expect(entraNaMedia('SEM_LIVRO')).toBe(false)
    expect(entraNaMedia('FUTURO')).toBe(false)
  })
})

describe('⭐⭐ O SELO DO HERÓI — UM caso, UM alarme', () => {
  const dia = (estado: Parameters<typeof entraNaMedia>[0]) => ({ dia: 'x', diaDaSemana: 0, estado, valor: null })

  it('⛔ sem pendência NENHUMA, SEM selo (anti-spam)', () => {
    expect(temDiaAApurar([dia('FECHADO'), dia('HOJE'), dia('SEM_LIVRO')])).toBe(false)
  })
  it('⭐ com UM dia pendente, o selo acende', () => {
    expect(temDiaAApurar([dia('FECHADO'), dia('PENDENTE')])).toBe(true)
  })
  it('⭐ com TRÊS dias pendentes continua UM selo — a resposta é booleana de propósito', () => {
    expect(temDiaAApurar([dia('PENDENTE'), dia('PENDENTE'), dia('PENDENTE')])).toBe(true)
  })
})

describe('⭐⭐⭐ `montarDias` — o caso-cicatriz do coxão, dia a dia', () => {
  /** os números REAIS de prod (ledger do Coxão Mole, 11→17/10) */
  const porDia = new Map([
    ['2026-10-11', 27.9],
    ['2026-10-12', 19.44],
    ['2026-10-13', 8.64],
  ])

  const dias = () =>
    montarDias({
      de: '2026-10-11',
      ate: '2026-10-17',
      hoje: '2026-10-17',
      pendentes: VAZIO,
      porDia,
      diaDaSemana: dow,
      arredonda: id,
    })

  it('⭐ 7 dias, e qua/qui/sex/sáb NÃO são "a apurar"', () => {
    const d = dias()
    expect(d).toHaveLength(7)
    expect(d.map((x) => x.estado)).toEqual([
      'FECHADO', 'FECHADO', 'FECHADO', // dom seg ter — produziram
      'FECHADO', 'FECHADO', 'FECHADO', // qua qui sex — ZERO de verdade
      'HOJE',                          // sáb — dia aberto
    ])
  })

  it('⭐⭐ os zeros são ZERO e a semana soma 55,98 (os 56 KG que o dono viu)', () => {
    const d = dias()
    expect(d.map((x) => x.valor)).toEqual([27.9, 19.44, 8.64, 0, 0, 0, 0])
    const soma = d.reduce((s, x) => s + (entraNaMedia(x.estado) ? (x.valor ?? 0) : 0), 0)
    expect(soma).toBeCloseTo(55.98, 2)
  })

  it('⛔ o herói do coxão NÃO ganha selo — não há pendência nenhuma', () => {
    expect(temDiaAApurar(dias())).toBe(false)
  })

  it('⭐ COM pendência de verdade (qui), SÓ aquele dia vira "—"', () => {
    const d = montarDias({
      de: '2026-10-11', ate: '2026-10-17', hoje: '2026-10-17',
      pendentes: new Set(['2026-10-15']),
      porDia, diaDaSemana: dow, arredonda: id,
    })
    expect(d[4].estado).toBe('PENDENTE')
    expect(d[4].valor).toBeNull()
    // ⛔ e os vizinhos seguem ZERO — a pendência é POR DIA, não contagia a semana
    expect(d[3].valor).toBe(0)
    expect(d[5].valor).toBe(0)
    expect(temDiaAApurar(d)).toBe(true)
  })

  it('⭐ faixa que passa de hoje: o futuro não tem barra nem zero', () => {
    const d = montarDias({
      de: '2026-10-16', ate: '2026-10-19', hoje: '2026-10-17',
      pendentes: VAZIO, porDia, diaDaSemana: dow, arredonda: id,
    })
    expect(d.map((x) => x.estado)).toEqual(['FECHADO', 'HOJE', 'FUTURO', 'FUTURO'])
    expect(d[2].valor).toBeNull()
  })
})

describe('⭐⭐ A LEGENDA DA COBERTURA — morre a contradição de 17/10', () => {
  it('⛔⛔ o caso que o dono viu: NÚMERO na tela e "sem média medida ainda" embaixo', () => {
    // 7,6 dias de cobertura com farol A_APURAR (faltam os dias de chegada)
    const l = legendaDaCobertura({ cobertura: 7.6, farol: 'A_APURAR', diasComMedia: 7, diasDaBaseline: 28 })
    expect(l).not.toContain('sem média medida')
    expect(l).not.toContain('sem consumo medido')
    // ⭐ ela DIZ a janela usada e cobra o que de fato falta
    expect(l).toContain('média de 28d')
    expect(l).toContain('7 de 7 dias da semana')
    expect(l).toContain('dias de chegada')
  })

  it('⭐ com farol aceso, o veredito vem ANTES e a janela ao lado', () => {
    expect(legendaDaCobertura({ cobertura: 1, farol: 'CORAL', diasComMedia: 7, diasDaBaseline: 28 }))
      .toBe('acaba antes da chegada · média de 28d · 7 de 7 dias da semana')
    expect(legendaDaCobertura({ cobertura: 9, farol: 'VERDE', diasComMedia: 5, diasDaBaseline: 28 }))
      .toContain('tranquilo')
  })

  it('⛔ SEM dado de verdade não mostra número — e diz por quê', () => {
    expect(legendaDaCobertura({ cobertura: null, farol: 'A_APURAR', diasComMedia: 0, diasDaBaseline: 28 }))
      .toBe('sem consumo medido ainda')
  })

  it('⚠️ média medida mas ZERO consumo: a cobertura não existe e a legenda NÃO mente', () => {
    const l = legendaDaCobertura({ cobertura: null, farol: 'A_APURAR', diasComMedia: 7, diasDaBaseline: 28 })
    expect(l).toContain('não consome')
    expect(l).not.toBe('sem consumo medido ainda')
  })

  it('⛔ a JANELA vem por parâmetro — nunca digitada (a cicatriz do TETO cravado)', () => {
    expect(legendaDaCobertura({ cobertura: 3, farol: 'VERDE', diasComMedia: 7, diasDaBaseline: 14 }))
      .toContain('média de 14d')
  })
})
