// ⛔⛔⛔ A APRESENTAÇÃO FUGIU DO MOCK EM 3 PONTOS (10/09/2026) — o motor estava certo.
//
// **O dono, navegando em prod:** *"o motor está certo (caixinhas, rodapé vivo, teto); a
// APRESENTAÇÃO virou parede: 16 cards abertos, Ivan aparece 3×, Casper 5×, Box Paper lista
// 15 parcelas até novembro."*
//
// Os três pontos, cada um com o teste que morde:
//   1. **um card por FORNECEDOR, fechado** — e a linha de dentro, uma por vez, da mais
//      antiga. ⛔ N cards do mesmo fornecedor DISPUTAM AS MESMAS NOTAS: *"o desenho certo
//      é nem criar a disputa visual"*.
//   2. **janela no "a vencer"** — parcela de novembro não abre num pagamento de setembro.
//   3. **vencidas já vêm marcadas** — o caso comum é o pagamento cobrir as vencidas.

import { describe, it, expect } from 'vitest'
import { montarCardDeEscolha, JANELA_A_VENCER_DIAS } from '../escolher-na-mao'
import { agruparPorFornecedor } from '../agrupar-escolha'

const HOJE = new Date('2026-09-10T12:00:00Z')
const d = (s: string) => new Date(`${s}T00:00:00Z`)
const nota = (id: string, valor: number, venc: string, jaPago = 0) =>
  ({ id, descricao: id, valor, vencimento: d(venc), jaPago })
const card = (valor: number, data: string, notas: ReturnType<typeof nota>[], forn = 'f', nome = 'X') =>
  montarCardDeEscolha({
    linha: { id: `L${valor}${data}`, descricao: 'PIX', valor, data: d(data), conta: 'stone', categoria: null },
    fornecedorId: forn, fornecedorNome: nome, notas, hoje: HOJE,
  })

// ────────────────────────────────────────────────────────────
// 1. UM CARD POR FORNECEDOR — e a disputa deixa de existir
// ────────────────────────────────────────────────────────────
describe('⭐⭐ 1. um card por FORNECEDOR, uma linha por vez', () => {
  // as 3 linhas REAIS do Ivan em prod (24/08, 08/09 e uma no meio) contra as MESMAS 4 notas
  const notasDoIvan = [
    nota('NF-39', 625, '2026-09-07'), nota('NF-40', 350, '2026-09-07'),
    nota('NF-41', 613.5, '2026-09-07'), nota('NF-42', 350, '2026-09-14'),
  ]
  const cards = [
    card(2008, '2026-09-08', notasDoIvan, 'ivan', 'M. IVAN LUNARDI'),
    card(1743.25, '2026-08-24', notasDoIvan, 'ivan', 'M. IVAN LUNARDI'),
    card(1500, '2026-09-01', notasDoIvan, 'ivan', 'M. IVAN LUNARDI'),
    card(1838.61, '2026-09-08', [nota('NF-3866696', 1641.12, '2026-09-10')], 'oesa', 'OESA'),
  ]

  it('3 cards do Ivan viram UM grupo com 3 linhas', () => {
    const g = agruparPorFornecedor(cards)
    expect(g).toHaveLength(2)
    expect(g[0].fornecedorNome).toBe('M. IVAN LUNARDI')
    expect(g[0].linhas).toHaveLength(3)
    expect(g[0].total).toBeCloseTo(2008 + 1743.25 + 1500, 2)
  })

  it('⭐ a primeira linha do grupo é a MAIS ANTIGA (24/08, R$ 1.743,25)', () => {
    const [ivan] = agruparPorFornecedor(cards)
    expect(ivan.linhas[0].linha.valor).toBeCloseTo(1743.25, 2)
    expect(ivan.linhas[0].linha.data.toISOString().slice(0, 10)).toBe('2026-08-24')
  })

  it('⚠️ a FILA também abre pela mais antiga', () => {
    const g = agruparPorFornecedor(cards)
    expect(g.map((x) => x.maisAntiga.toISOString().slice(0, 10))).toEqual(['2026-08-24', '2026-09-08'])
  })

  it('⛔⛔ a DISPUTA some por construção: uma nota mora em UM grupo só', () => {
    const vistas = new Map<string, Set<string>>()
    for (const g of agruparPorFornecedor(cards)) {
      for (const l of g.linhas) for (const n of [...l.vencidas, ...l.aVencer]) {
        const donos = vistas.get(n.id) ?? new Set()
        donos.add(g.fornecedorId)
        vistas.set(n.id, donos)
      }
    }
    // ⚠️ a nota se repete entre LINHAS do mesmo grupo (é a mesma dívida), e como só uma
    // linha abre por vez, ela nunca aparece em dois cards ABERTOS.
    for (const [, donos] of vistas) expect(donos.size).toBe(1)
  })

  it('⚠️ resolve por ID, nunca por nome — o homônimo do PAO DE MEL não funde', () => {
    const g = agruparPorFornecedor([
      card(100, '2026-09-01', [nota('a', 100, '2026-09-05')], 'ivan-1', 'M. IVAN LUNARDI'),
      card(200, '2026-09-02', [nota('b', 200, '2026-09-05')], 'ivan-2', 'M. IVAN LUNARDI'),
    ])
    expect(g).toHaveLength(2)
  })
})

// ────────────────────────────────────────────────────────────
// 2. A JANELA DO "A VENCER"
// ────────────────────────────────────────────────────────────
describe('⭐ 2. o "a vencer" tem janela — novembro não abre num pagamento de setembro', () => {
  // a BOX PAPER real: 3 vencidas em 10/09 + 12 parcelas até 09/11
  const boxPaper = card(5211.85, '2026-09-02', [
    nota('R-6472', 3799.6, '2026-09-10'), nota('R-6474', 1129.21, '2026-09-10'),
    nota('R-6477', 2080.13, '2026-09-10'),
    nota('R02', 3799.6, '2026-09-25'), nota('R03', 3799.6, '2026-10-10'),
    nota('R04', 3799.6, '2026-10-25'), nota('R05', 3799.6, '2026-11-09'),
  ])

  it(`só abre o que vence em até ${JANELA_A_VENCER_DIAS} dias`, () => {
    const abertas = boxPaper.aVencer.filter((n) => !n.foraDaJanela).map((n) => n.id)
    expect(abertas).toEqual(['R02', 'R03'])                      // 25/09 e 10/10
    expect(boxPaper.aVencer.filter((n) => n.foraDaJanela).map((n) => n.id)).toEqual(['R04', 'R05'])
  })

  it('⛔ mas NENHUMA some da lista — o dono pode adiantar parcela', () => {
    expect(boxPaper.aVencer).toHaveLength(4)
  })

  it('⚠️ vencida NUNCA sai da janela — ela é o trabalho, não o ruído', () => {
    expect(boxPaper.vencidas.every((n) => !n.foraDaJanela)).toBe(true)
  })

  it('⭐ o PISO: fornecedor só com parcela distante ainda abre as 3 mais próximas', () => {
    const trimestral = card(1000, '2026-09-02', [
      nota('t1', 500, '2026-12-10'), nota('t2', 500, '2027-03-10'),
      nota('t3', 500, '2027-06-10'), nota('t4', 500, '2027-09-10'),
    ])
    expect(trimestral.aVencer.filter((n) => !n.foraDaJanela).map((n) => n.id)).toEqual(['t1', 't2', 't3'])
  })
})

// ────────────────────────────────────────────────────────────
// 3. VENCIDAS JÁ VÊM MARCADAS
// ────────────────────────────────────────────────────────────
describe('⭐ 3. as vencidas nascem marcadas — desmarcar é a exceção', () => {
  it('IVAN: as 3 vencidas vêm ligadas, a que vence 14/09 não', () => {
    const ivan = card(2008, '2026-09-08', [
      nota('NF-39', 625, '2026-09-07'), nota('NF-40', 350, '2026-09-07'),
      nota('NF-41', 613.5, '2026-09-07'), nota('NF-42', 350, '2026-09-14'),
    ])
    expect(ivan.vencidas.filter((n) => n.sugerida)).toHaveLength(3)
    expect(ivan.aVencer.every((n) => !n.sugerida)).toBe(true)
  })

  it('⚠️ OESA: marcar as 2 vencidas PASSA da linha — e é isso mesmo, a parcial aparece', () => {
    const oesa = card(1838.61, '2026-09-08', [
      nota('NF-3866696', 1641.12, '2026-09-10'), nota('NF-3866706', 738.99, '2026-09-10'),
    ])
    const soma = oesa.vencidas.filter((n) => n.sugerida).reduce((s, n) => s + n.emAberto, 0)
    expect(soma).toBeCloseTo(2380.11, 2)                        // passou 541,50 → baixa parcial
  })

  it('⭐ o ATALHO continua ganhando das vencidas quando existe combinação única', () => {
    // ⚠️ a+b cravam 1.000; 'c' também está VENCIDA e continua DESMARCADA — quando existe
    // combinação exata, é ela que manda, não a régua geral do "marca as vencidas".
    const c = card(1000, '2026-09-08', [
      nota('a', 750, '2026-09-05'), nota('b', 250, '2026-09-05'), nota('c', 400, '2026-09-05'),
    ])
    expect(c.atalho?.notasIds.sort()).toEqual(['a', 'b'])
    expect(c.vencidas.filter((n) => n.sugerida).map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('⛔⛔ AMBÍGUO CONTINUA MARCANDO NADA — a tela promete isso por escrito', () => {
    const c = card(150, '2026-09-08', [
      nota('a', 100, '2026-09-05'), nota('b', 100, '2026-09-05'),
      nota('c', 50, '2026-09-05'), nota('d', 50, '2026-09-05'),
    ])
    expect(c.atalho?.ambiguo).toBe(true)
    expect([...c.vencidas, ...c.aVencer].some((n) => n.sugerida)).toBe(false)
  })

  it('⚠️ sem vencida nenhuma, nada nasce marcado (não inventa seleção)', () => {
    const c = card(999, '2026-09-08', [nota('futura', 500, '2026-09-20')])
    expect(c.aVencer.every((n) => !n.sugerida)).toBe(true)
  })
})
