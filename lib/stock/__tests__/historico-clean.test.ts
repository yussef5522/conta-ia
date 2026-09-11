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
    dentroDaProducao: null, anulado: null,
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
