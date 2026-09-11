// ⭐⭐⭐ MODO CLEAN NO HISTÓRICO — O PAR QUE SE ANULA VIRA UMA LINHA FINA (11/09/2026)
//
// **O dono, olhando a Coca 2L depois do conserto de ontem:** *"16 linhas, das quais 8 são
// pares que se anulam. Pra entender 'o que aconteceu com meu estoque' isso é ruído — mas
// APAGAR não pode: o rastro é o que provou o desastre."*
//
// ⭐ Os dois casos deste arquivo são os REAIS de prod (medidos antes de escrever a régua):
//   COCA-COLA 2L · 16 linhas · 4 pares anulados → 12 no modo clean
//   FANTA UVA 2L · 10 linhas · 3 pares anulados →  7 no modo clean

import { describe, it, expect } from 'vitest'
import { colapsarAnulados, somaDasLinhas, type LinhaDoHistorico } from '../movimento-explicado'

let seq = 0
function linha(p: Partial<LinhaDoHistorico> & { quantidade: number; custoTotal: number }): LinhaDoHistorico {
  return {
    movimentoId: p.movimentoId ?? `m${++seq}`,
    itemId: 'item-1',
    data: p.data ?? '2026-09-10',
    tipo: p.tipo ?? 'BAIXA_VENDA',
    chip: p.chip ?? 'Baixa de venda',
    familia: 'VENDA', sentido: 'SAIU',
    quantidade: p.quantidade, custoUnitario: 0, custoTotal: p.custoTotal,
    precoRotulo: 'Custo médio un.', precoEhDeCompra: false,
    detalhe: p.detalhe ?? '', quem: p.quem ?? 'marcyelle', href: null, origemId: null, ehCompra: false,
    estornoDe: p.estornoDe ?? null,
    movePrateleira: p.movePrateleira ?? true,
    dentroDaProducao: null, anulado: null, saldoApos: null,
  }
}
const estornoDe = (alvo: LinhaDoHistorico, data: string) => linha({
  movimentoId: `e-${alvo.movimentoId}`, data, tipo: 'ESTORNO', chip: 'Estorno',
  quantidade: -alvo.quantidade, custoTotal: -alvo.custoTotal,
  estornoDe: { movimentoId: alvo.movimentoId, tipo: alvo.tipo, chip: alvo.chip, data: alvo.data },
})

/** a Coca 2L de prod: compras + as 4 duplas que se anulam + a baixa boa */
function cocaReal(): LinhaDoHistorico[] {
  const baixaRuim1 = linha({ movimentoId: 'uz3mcq', quantidade: -1499, custoTotal: -12126.91 })
  const baixaRuim2 = linha({ movimentoId: '80rzs8', quantidade: -1499, custoTotal: -12126.91 })
  const contagem1480 = linha({ movimentoId: 'nlgxro', tipo: 'AJUSTE_CONTAGEM', chip: 'Contagem', quantidade: 1480, custoTotal: 0 })
  const contagem154 = linha({ movimentoId: 'yn28gi', tipo: 'AJUSTE_CONTAGEM', chip: 'Contagem', quantidade: 154, custoTotal: 1245.48 })
  return [
    estornoDe(contagem154, '2026-09-11'), estornoDe(contagem1480, '2026-09-11'),
    estornoDe(baixaRuim2, '2026-09-11'), estornoDe(baixaRuim1, '2026-09-11'),
    contagem1480, contagem154,
    linha({ movimentoId: 'boa', quantidade: -8, custoTotal: -64.72 }),
    baixaRuim1, baixaRuim2,
    linha({ movimentoId: 'nf1', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 120, custoTotal: 970.80, data: '2026-08-29' }),
    linha({ movimentoId: 'nf2', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 120, custoTotal: 970.80, data: '2026-08-24' }),
  ]
}

describe('⭐⭐ modo CLEAN: o par anulado colapsa, o rastro fica', () => {
  it('⭐ a COCA 2L real: 4 pares viram 4 linhas finas (11 → 7)', () => {
    const cru = cocaReal()
    const clean = colapsarAnulados(cru)
    expect(cru).toHaveLength(11)
    expect(clean).toHaveLength(7)                       // 11 − 8 do par + 4 sintéticas
    expect(clean.filter((l) => l.anulado).length).toBe(4)
  })

  it('⛔⛔ A SOMA NÃO MUDA — é o que o rodapé "bate com o saldo" prova', () => {
    const cru = cocaReal()
    expect(somaDasLinhas(colapsarAnulados(cru))).toEqual(somaDasLinhas(cru))
  })

  it('⭐ a linha fina não soma nem parece que soma', () => {
    const fina = colapsarAnulados(cocaReal()).find((l) => l.anulado)!
    expect(fina.quantidade).toBe(0)
    expect(fina.custoTotal).toBe(0)
    expect(fina.movePrateleira).toBe(false)
  })

  it('⛔ NADA É APAGADO: o par inteiro viaja dentro da linha', () => {
    const fina = colapsarAnulados(cocaReal()).find((l) => l.anulado?.original.movimentoId === 'uz3mcq')!
    expect(fina.anulado!.original.quantidade).toBe(-1499)
    expect(fina.anulado!.estornos).toHaveLength(1)
    expect(fina.anulado!.estornos[0].quantidade).toBe(1499)
    expect(fina.anulado!.frase).toContain('1.499')
    expect(fina.anulado!.frase).toContain('estornada em 11/09')
  })

  it('⭐ a linha fina fica NO LUGAR DO ORIGINAL — o fato começou ali', () => {
    const clean = colapsarAnulados(cocaReal())
    const fina = clean.findIndex((l) => l.anulado?.original.movimentoId === 'uz3mcq')
    const boa = clean.findIndex((l) => l.movimentoId === 'boa')
    expect(fina).toBeGreaterThan(boa)   // a baixa boa é mais recente na lista de prod
  })

  it('⭐ o que sobra é o que aconteceu de verdade', () => {
    const vivas = colapsarAnulados(cocaReal()).filter((l) => !l.anulado)
    expect(vivas.map((l) => l.movimentoId).sort()).toEqual(['boa', 'nf1', 'nf2'])
  })

  // ⚠️⚠️ REGRA 11 PEGOU ESTE TESTE FRACO: com o par ABAIXO (que move a prateleira dos dois
  // lados), remover a trava do PARCIAL deixava os 11 VERDES — quem barrava era a trava de
  // contribuição, porque −100 + 40 já não soma zero. O teste que ISOLA a régua do parcial é
  // o de baixo: os dois lados FORA da prateleira, onde a contribuição é zero de qualquer
  // jeito e só a pergunta "foi desfeito POR INTEIRO?" separa.
  it('⛔ ESTORNO PARCIAL não colapsa — se sobrou efeito, ele tem que estar à vista', () => {
    const m = linha({ movimentoId: 'p1', quantidade: -100, custoTotal: -800 })
    const parcial = linha({
      movimentoId: 'e-p1', tipo: 'ESTORNO', chip: 'Estorno', quantidade: 40, custoTotal: 320,
      estornoDe: { movimentoId: 'p1', tipo: m.tipo, chip: m.chip, data: m.data },
    })
    const r = colapsarAnulados([parcial, m])
    expect(r).toHaveLength(2)
    expect(r.some((l) => l.anulado)).toBe(false)
  })

  it('⛔⛔ PARCIAL fora da prateleira: contribuição zero, mas sobrou efeito → NÃO colapsa', () => {
    // o consumo de produção não move o saldo; um desfazer PARCIAL dele também não. A soma
    // exibida é zero nos dois casos — então a ÚNICA pergunta que separa é "desfez tudo?".
    const consumo = linha({ movimentoId: 'k1', tipo: 'PRODUCAO_CONSUMO', chip: 'Produção', quantidade: -10, custoTotal: -50, movePrateleira: false })
    const meio = linha({
      movimentoId: 'e-k1', tipo: 'PRODUCAO_CONSUMO', chip: 'Produção', quantidade: 4, custoTotal: 20, movePrateleira: false,
      estornoDe: { movimentoId: 'k1', tipo: consumo.tipo, chip: consumo.chip, data: consumo.data },
    })
    const r = colapsarAnulados([meio, consumo])
    expect(r).toHaveLength(2)                     // ⛔ some da tela e o efeito residual some junto
    expect(r.some((l) => l.anulado)).toBe(false)
  })

  it('⛔⛔ par ASSIMÉTRICO (um lado não move a prateleira) NÃO colapsa — senão a soma mentiria', () => {
    const consumo = linha({ movimentoId: 'c1', tipo: 'PRODUCAO_CONSUMO', chip: 'Produção', quantidade: -10, custoTotal: -50, movePrateleira: false })
    const est = estornoDe(consumo, '2026-09-11')   // o estorno MOVE
    const cru = [est, consumo]
    expect(colapsarAnulados(cru)).toHaveLength(2)
    expect(somaDasLinhas(colapsarAnulados(cru))).toEqual(somaDasLinhas(cru))
  })

  it('⛔ estorno cujo ORIGINAL não está na lista (filtro/período) fica como está', () => {
    const orfao = linha({
      movimentoId: 'e-x', tipo: 'ESTORNO', chip: 'Estorno', quantidade: 5, custoTotal: 40,
      estornoDe: { movimentoId: 'fora-da-lista', tipo: 'BAIXA_VENDA', chip: 'Baixa de venda', data: '2026-01-01' },
    })
    expect(colapsarAnulados([orfao])).toHaveLength(1)
  })

  it('⭐ item sem estorno nenhum passa intacto (mesma referência)', () => {
    const ls = [linha({ quantidade: 10, custoTotal: 80 })]
    expect(colapsarAnulados(ls)).toBe(ls)
  })

  it('⭐ a FANTA UVA real: 3 pares (10 → 7 na tela)', () => {
    const b1 = linha({ movimentoId: 'wpsmrf', quantidade: -1499, custoTotal: -10208.19 })
    const b2 = linha({ movimentoId: 'mx6tn8', quantidade: -1499, custoTotal: -10208.19 })
    const cont = linha({ movimentoId: 'mv284o', tipo: 'AJUSTE_CONTAGEM', chip: 'Contagem', quantidade: 1496, custoTotal: 0 })
    const cru = [
      estornoDe(cont, '2026-09-11'), estornoDe(b2, '2026-09-11'), estornoDe(b1, '2026-09-11'),
      cont, linha({ movimentoId: 'boa', quantidade: -1, custoTotal: -6.81 }), b1, b2,
      linha({ movimentoId: 'cg', tipo: 'AJUSTE_CONTAGEM', chip: 'Contagem', quantidade: -9, custoTotal: -61.29, data: '2026-09-09' }),
      linha({ movimentoId: 'nf1', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 8, custoTotal: 54.48, data: '2026-08-29' }),
      linha({ movimentoId: 'nf2', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 8, custoTotal: 54.48, data: '2026-08-24' }),
    ]
    const clean = colapsarAnulados(cru)
    expect(cru).toHaveLength(10)
    expect(clean).toHaveLength(7)
    expect(clean.filter((l) => l.anulado)).toHaveLength(3)
    expect(somaDasLinhas(clean)).toEqual(somaDasLinhas(cru))
  })
})

// ⭐⭐⭐ A COLUNA SALDO — O EXTRATO BANCÁRIO DO ITEM (11/09/2026)
//
// **O dono:** *"quanto o item tinha DEPOIS de cada linha (227 → 234 → …). Derivada do
// ledger na ordem, nunca gravada."* ⭐ A prova que ele pediu está embutida: o saldo da
// linha mais recente **é** o rodapé **e** a Posição — três leitores, uma régua.

import { anotarSaldo } from '../movimento-explicado'

describe('⭐⭐ coluna SALDO derivada do ledger', () => {
  // ⚠️ o saldo de "hoje" sai da PRÓPRIA cena (Σ das linhas que movem), senão o teste
  // afirmaria a mecânica contra um número que não é o desta fixture.
  const saldoHoje = somaDasLinhas(cocaReal()).quantidade
  const saldoDaCoca = new Map([['item-1', saldoHoje]])

  it('⭐ a linha MAIS RECENTE vale o saldo de HOJE — o número da Posição', () => {
    const ls = anotarSaldo(colapsarAnulados(cocaReal()), saldoDaCoca)
    expect(ls[0].saldoApos).toBe(saldoHoje)
  })

  it('⭐⭐ desce linha a linha: cada uma devolve o próprio efeito pra quem vem abaixo', () => {
    const ls = anotarSaldo(colapsarAnulados(cocaReal()), saldoDaCoca)
    const nf1 = ls.find((l) => l.movimentoId === 'nf1')!   // compra de +120, a penúltima
    const nf2 = ls.find((l) => l.movimentoId === 'nf2')!   // compra de +120, a MAIS ANTIGA
    const boa = ls.find((l) => l.movimentoId === 'boa')!   // a baixa de −8
    // ⭐ a linha do tempo, de baixo pra cima: 120 → 240 → 232
    expect(nf2.saldoApos).toBe(120)
    expect(nf1.saldoApos).toBe(240)
    expect(boa.saldoApos).toBe(232)
    expect(boa.saldoApos).toBe(saldoHoje)   // nada aconteceu depois dela, no modo limpo
  })

  it('⛔ a linha ANULADA repete o saldo ANTERIOR (a de baixo na lista) — não mexe em nada', () => {
    // ⚠️ "anterior" é no TEMPO, e a lista desce do mais recente pro mais antigo — então a
    // linha anterior é a de BAIXO. Meu 1º teste comparava com a de cima e falhou com razão.
    const ls = anotarSaldo(colapsarAnulados(cocaReal()), saldoDaCoca)
    const anuladas = ls.filter((l) => l.anulado)
    expect(anuladas.length).toBeGreaterThan(0)
    for (let i = 0; i < ls.length; i++) {
      if (!ls[i].anulado) continue
      const abaixo = ls[i + 1]
      if (abaixo) expect(ls[i].saldoApos, `anulada em ${i}`).toBe(abaixo.saldoApos)
    }
  })

  /**
   * ⚠️⚠️ DESCOBERTA DE DESENHO, e ela é importante o suficiente pra ficar travada num teste:
   * **os dois modos respondem perguntas diferentes e por isso divergem NO MEIO da lista.**
   *
   * No FORENSE, a linha de 10/09 mostra o saldo que o item **realmente tinha naquele dia** —
   * fundo do poço, porque as baixas erradas já tinham acontecido e o estorno só veio em
   * 11/09. No CLEAN, ela mostra a linha do tempo **sem os lançamentos anulados**: o saldo que
   * o item teria tido se o erro nunca existisse.
   *
   * ⭐ Os dois **convergem onde tem que convergir**: no topo (hoje) e em tudo que está ABAIXO
   * do par — porque o par soma zero. É por isso que o rodapé bate nos dois modos.
   */
  it('⛔⛔ CLEAN e FORENSE convergem no TOPO e ABAIXO do par — e divergem no meio, de propósito', () => {
    const cru = cocaReal()
    const forense = anotarSaldo(cru, saldoDaCoca)
    const clean = anotarSaldo(colapsarAnulados(cru), saldoDaCoca)

    expect(clean[0].saldoApos).toBe(forense[0].saldoApos)          // hoje: o mesmo número
    for (const id of ['nf1', 'nf2']) {                             // abaixo do par: o mesmo
      expect(clean.find((l) => l.movimentoId === id)!.saldoApos)
        .toBe(forense.find((l) => l.movimentoId === id)!.saldoApos)
    }
    // ⚠️ no meio, o forense conta a verdade crua: em 10/09 o item estava MUITO negativo
    const boaForense = forense.find((l) => l.movimentoId === 'boa')!
    expect(boaForense.saldoApos).toBeLessThan(0)
    expect(clean.find((l) => l.movimentoId === 'boa')!.saldoApos).toBe(saldoHoje)
  })

  it('⭐ a linha que NÃO move a prateleira não desconta nada de quem vem abaixo', () => {
    const consumo = linha({ movimentoId: 'c9', tipo: 'PRODUCAO_CONSUMO', chip: 'Produção', quantidade: -10, custoTotal: -50, movePrateleira: false })
    const compra = linha({ movimentoId: 'nf9', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 50, custoTotal: 400 })
    const ls = anotarSaldo([consumo, compra], new Map([['item-1', 50]]))
    expect(ls[0].saldoApos).toBe(50)
    expect(ls[1].saldoApos).toBe(50)   // ⭐ o consumo não tirou nada do saldo
  })

  it('⛔⛔ item FORA do mapa de saldo não ganha número inventado', () => {
    const ls = anotarSaldo([linha({ quantidade: 5, custoTotal: 40 })], new Map())
    expect(ls[0].saldoApos).toBeNull()
  })

  it('⭐ a FANTA real fecha em 6 no topo', () => {
    const b1 = linha({ movimentoId: 'f1', quantidade: -1499, custoTotal: -10208.19 })
    const cru = [estornoDe(b1, '2026-09-11'), linha({ movimentoId: 'boa', quantidade: -1, custoTotal: -6.81 }), b1,
      linha({ movimentoId: 'nf', tipo: 'ENTRADA_NF', chip: 'Compra (NF-e)', quantidade: 7, custoTotal: 47.67 })]
    const ls = anotarSaldo(colapsarAnulados(cru), new Map([['item-1', somaDasLinhas(cru).quantidade]]))
    expect(ls[0].saldoApos).toBe(6)
    expect(ls.at(-1)!.saldoApos).toBe(7)   // depois da compra, antes da venda
  })
})
