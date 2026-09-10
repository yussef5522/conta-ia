// ⭐⭐ O CARD DO "ESCOLHER NA MÃO" — com os casos REAIS de prod (10/09/2026).
//
// Medido no dia do sprint, resolvendo o fornecedor por ID (REGRA 8 — a 1ª medição resolveu
// por NOME e caiu num homônimo, "MAURO IVAN LUNARDI (PAO DE MEL)"):
//
//   IVAN       linha 2.008,00 (08/09) × 4 notas abertas: 625,00 · 613,50 · 350,00 (venc
//              07/09) + 350,00 (vence 14/09) = 1.938,50
//   BOX PAPER  linha 5.211,85 (02/09) × 15 notas abertas (3 NFs × 5 parcelas)
//   OESA       linha 1.838,61 (08/09) × 2 notas: 1.641,12 + 738,99 = 2.380,11

import { describe, it, expect } from 'vitest'
import {
  montarCardDeEscolha, contaDoRodape, emAbertoDaNota,
  TETO_DA_DIFERENCA, type NotaAbertaDoCard,
} from '../escolher-na-mao'

const HOJE = new Date('2026-09-10T12:00:00.000Z')
const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const nota = (id: string, valor: number, venc: string, jaPago = 0): NotaAbertaDoCard =>
  ({ id, descricao: id, valor, vencimento: d(venc), jaPago })
const linha = (valor: number, data: string) =>
  ({ id: 'ext', descricao: 'PIX', valor, data: d(data), conta: 'stone', categoria: null })

const marcar = (card: { vencidas: { id: string; emAberto: number }[]; aVencer: { id: string; emAberto: number }[] }, ids: string[]) =>
  [...card.vencidas, ...card.aVencer].filter((n) => ids.includes(n.id)).map((n) => ({ id: n.id, emAberto: n.emAberto }))

// ────────────────────────────────────────────────────────────────

describe('⭐⭐ OESA — o caso da BAIXA PARCIAL (linha menor que as notas)', () => {
  const notas = [nota('NF-3866696', 1641.12, '2026-09-10'), nota('NF-3866706', 738.99, '2026-09-10')]
  const card = montarCardDeEscolha({
    linha: linha(1838.61, '2026-09-08'), fornecedorId: 'f', fornecedorNome: 'OESA', notas, hoje: HOJE,
  })

  it('⛔ nenhuma combinação crava 1.838,61 — sem atalho', () => {
    expect(card.atalho).toBeNull()
  })

  it('⭐⭐ marcando as duas, a última recebe 1.099,62 e sobram 541,50 em aberto', () => {
    // ⚠️ a ordem é por vencimento; com o mesmo dia, a ordem da lista manda — e a tela
    // mostra QUAL nota recebe a parcial, pra o dono desmarcar se quiser outra.
    const c = contaDoRodape({ valorDaLinha: 1838.61, marcadas: marcar(card, ['NF-3866696', 'NF-3866706']) })
    expect(c.estado).toBe('PASSOU')
    expect(c.parcial).not.toBeNull()
    expect(c.parcial!.recebe + c.parcial!.continuaEmAberto).toBeCloseTo(
      [...card.vencidas, ...card.aVencer].find((n) => n.id === c.parcial!.notaId)!.emAberto, 2)
    expect(c.parcial!.continuaEmAberto).toBeCloseTo(541.50, 2)
  })

  it('⛔⛔ e o CONCILIAR só acende depois de o dono ACEITAR a parcial', () => {
    const marcadas = marcar(card, ['NF-3866696', 'NF-3866706'])
    expect(contaDoRodape({ valorDaLinha: 1838.61, marcadas }).podeConciliar).toBe(false)
    expect(contaDoRodape({ valorDaLinha: 1838.61, marcadas, parcialAceita: true }).podeConciliar).toBe(true)
  })
})

describe('⭐⭐ BOX PAPER — 2 inteiras + parcial de 283,04 na NF 6477', () => {
  // as 3 vencidas de 10/09; as outras 12 parcelas vencem 25/09 em diante
  const notas = [
    nota('NF-6472', 3799.60, '2026-09-10'),
    nota('NF-6474', 1129.21, '2026-09-10'),
    nota('NF-6477', 2080.13, '2026-09-10'),
    nota('NF-6474-b', 1129.21, '2026-09-25'),
    nota('NF-6472-b', 3799.60, '2026-09-25'),
  ]
  const card = montarCardDeEscolha({
    linha: linha(5211.85, '2026-09-02'), fornecedorId: 'f', fornecedorNome: 'BOX PAPER', notas, hoje: HOJE,
  })

  it('⛔ nenhuma combinação crava 5.211,85 — o caso é de baixa parcial', () => {
    expect(card.atalho).toBeNull()
  })

  it('⭐⭐ 3.799,60 + 1.129,21 inteiras + 283,04 na NF 6477 · 1.797,09 em aberto', () => {
    const c = contaDoRodape({
      valorDaLinha: 5211.85,
      marcadas: marcar(card, ['NF-6472', 'NF-6474', 'NF-6477']),
      parcialAceita: true,
    })
    expect(c.estado).toBe('PASSOU')
    expect(c.parcial!.notaId).toBe('NF-6477')
    expect(c.parcial!.recebe).toBeCloseTo(283.04, 2)
    expect(c.parcial!.continuaEmAberto).toBeCloseTo(1797.09, 2)
    expect(c.podeConciliar).toBe(true)
  })

  it('⭐ as vencidas e as a vencer vêm SEPARADAS, como no mock', () => {
    expect(card.vencidas.map((n) => n.id)).toEqual(['NF-6472', 'NF-6474', 'NF-6477'])
    expect(card.aVencer.map((n) => n.id)).toEqual(['NF-6474-b', 'NF-6472-b'])
  })
})

describe('⛔⛔ IVAN — o atalho NÃO aparece, e o número do mock não existe em prod', () => {
  // ⚠️ O mock dizia *"3 vencidas 1.588,50 + NF 419,50 que nem venceu"*. Medido: a 4ª nota
  // aberta do Ivan é **350,00** (NF 42, vence 14/09) e **não existe nenhuma de 419,50** em
  // estado nenhum. As 4 abertas somam 1.938,50 contra a linha de 2.008,00 → sobram 69,50.
  const notas = [
    nota('NF-39', 625.00, '2026-09-07'),
    nota('NF-41', 613.50, '2026-09-07'),
    nota('NF-40', 350.00, '2026-09-07'),
    nota('NF-42', 350.00, '2026-09-14'),
  ]
  const card = montarCardDeEscolha({
    linha: linha(2008.00, '2026-09-08'), fornecedorId: 'f', fornecedorNome: 'IVAN', notas, hoje: HOJE,
  })

  it('⛔ nenhuma combinação fecha 2.008,00 com as notas que existem', () => {
    expect(card.atalho).toBeNull()
  })

  it('⛔⛔ marcando TODAS, faltam 69,50 — e isso passa do teto, então não fecha com nome', () => {
    const c = contaDoRodape({ valorDaLinha: 2008, marcadas: marcar(card, ['NF-39', 'NF-41', 'NF-40', 'NF-42']) })
    expect(c.estado).toBe('FALTA')
    expect(c.diferenca).toBeCloseTo(69.50, 2)
    expect(c.cabeAcertoComNome).toBe(false)   // 69,50 > R$ 25
    expect(c.podeConciliar).toBe(false)
  })

  it('⛔ e nem dizer "é juros" salva acima do teto — a trava não é opinião', () => {
    const c = contaDoRodape({
      valorDaLinha: 2008,
      marcadas: marcar(card, ['NF-39', 'NF-41', 'NF-40', 'NF-42']),
      diferencaNomeada: true,
    })
    expect(c.podeConciliar).toBe(false)
  })

  it('⭐ mas a nota que VENCE DEPOIS entra na lista — é o pagamento real', () => {
    expect(card.aVencer.map((n) => n.id)).toEqual(['NF-42'])
    expect(card.vencidas).toHaveLength(3)
  })
})

describe('⭐ O ATALHO ⭐ — combinação única crava', () => {
  it('marca as caixas certas e diz o resumo', () => {
    const notas = [nota('a', 1000, '2026-09-05'), nota('b', 500, '2026-09-06'), nota('c', 77, '2026-09-20')]
    const card = montarCardDeEscolha({
      linha: linha(1500, '2026-09-08'), fornecedorId: 'f', fornecedorNome: 'X', notas, hoje: HOJE,
    })
    expect(card.atalho?.notasIds.sort()).toEqual(['a', 'b'])
    expect(card.atalho?.ambiguo).toBe(false)
    expect(card.vencidas.filter((n) => n.sugerida).map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('⛔⛔ DUAS combinações que fecham = sem atalho (não sei qual foi)', () => {
    const notas = [
      nota('a', 100, '2026-09-05'), nota('b', 100, '2026-09-05'),
      nota('c', 50, '2026-09-05'), nota('d', 50, '2026-09-05'),
    ]
    const card = montarCardDeEscolha({
      linha: linha(150, '2026-09-08'), fornecedorId: 'f', fornecedorNome: 'X', notas, hoje: HOJE,
    })
    expect(card.atalho?.ambiguo).toBe(true)
    expect(card.atalho?.notasIds).toEqual([])
    expect([...card.vencidas, ...card.aVencer].some((n) => n.sugerida)).toBe(false)
  })

  it('⭐ e o atalho SÓ MARCA — quem concilia é o dono', () => {
    // a prova é a forma: `atalho` só carrega ids; não existe caminho de gravação aqui.
    const notas = [nota('a', 1000, '2026-09-05'), nota('b', 500, '2026-09-06')]
    const card = montarCardDeEscolha({
      linha: linha(1500, '2026-09-08'), fornecedorId: 'f', fornecedorNome: 'X', notas, hoje: HOJE,
    })
    expect(Object.keys(card.atalho!)).toEqual(['notasIds', 'resumo', 'ambiguo'])
  })
})

describe('⭐ DIFERENÇA PEQUENA fecha com NOME; grande, não', () => {
  const marcadas = [{ id: 'a', emAberto: 1000 }]

  it(`⭐ até R$ ${TETO_DA_DIFERENCA} cabe o acerto nomeado`, () => {
    const c = contaDoRodape({ valorDaLinha: 1020, marcadas })
    expect(c.diferenca).toBeCloseTo(20, 2)
    expect(c.cabeAcertoComNome).toBe(true)
    expect(c.podeConciliar).toBe(false)                       // ⛔ ainda falta NOMEAR
    expect(contaDoRodape({ valorDaLinha: 1020, marcadas, diferencaNomeada: true }).podeConciliar).toBe(true)
  })

  it('⛔ acima do teto não oferece acerto rápido', () => {
    expect(contaDoRodape({ valorDaLinha: 1030, marcadas }).cabeAcertoComNome).toBe(false)
  })
})

describe('⭐⭐ NOTA QUE JÁ RECEBEU BAIXA PARCIAL entra pelo EM ABERTO', () => {
  it('o valor de face não manda — o que ela ainda deve, sim', () => {
    expect(emAbertoDaNota({ valor: 2080.13, jaPago: 283.04 })).toBeCloseTo(1797.09, 2)
    const notas = [nota('parcial', 2080.13, '2026-09-10', 283.04), nota('inteira', 202.91, '2026-09-10')]
    const card = montarCardDeEscolha({
      linha: linha(2000, '2026-09-11'), fornecedorId: 'f', fornecedorNome: 'X', notas, hoje: HOJE,
    })
    // 1.797,09 + 202,91 = 2.000,00 exato → o atalho crava
    expect(card.atalho?.notasIds.sort()).toEqual(['inteira', 'parcial'])
    const c = contaDoRodape({ valorDaLinha: 2000, marcadas: marcar(card, ['parcial', 'inteira']) })
    expect(c.estado).toBe('FECHA')
    expect(c.podeConciliar).toBe(true)
  })

  it('⛔ nota já quitada por parciais some da lista', () => {
    const card = montarCardDeEscolha({
      linha: linha(100, '2026-09-11'), fornecedorId: 'f', fornecedorNome: 'X',
      notas: [nota('quitada', 500, '2026-09-10', 500), nota('viva', 100, '2026-09-10')],
      hoje: HOJE,
    })
    expect([...card.vencidas, ...card.aVencer].map((n) => n.id)).toEqual(['viva'])
  })
})
