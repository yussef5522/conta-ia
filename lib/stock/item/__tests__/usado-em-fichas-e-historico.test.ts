/**
 * ⭐⭐ A BUSCA REVERSA E AS LEITURAS DO HISTÓRICO (06/10/2026) — as réguas, executadas.
 *
 * ⚠️ REGRA 3: comportamento, nunca grep. As cenas são as de prod (o fermento em 6 fichas, a
 * ERVILHA negativa).
 */
import { describe, it, expect } from 'vitest'
import { marcarDosesSuspeitas, IRMAS_PARA_COMPARAR, FATOR_SUSPEITO, type FichaQueUsaOItem } from '../usado-em-fichas'
import { resumoDoPeriodo, linhaDoZero, saldoNoTempo, aplicarRecorte, temRecorte } from '../leitura-do-historico'
import { casaBusca } from '@/lib/busca-texto'
import type { LinhaDoHistorico } from '../../movimento-explicado'

const ficha = (nome: string, dose: number, unidade = 'KG', tipo = 'INTERMEDIARIO'): FichaQueUsaOItem => ({
  fichaId: `f-${nome}`, nome, tipoProduto: tipo, tipoLabel: tipo, versao: 1,
  dose, unidade, doseTexto: `${dose} ${unidade}`,
  href: '#', hrefCorrigir: '#', suspeita: null,
})

describe('⭐⭐⭐ A DOSE SUSPEITA — mediana das irmãs, e só o que é comparável', () => {
  it('⭐⭐ a dose 100× fora é marcada, com o número das irmãs à vista', () => {
    const r = marcarDosesSuspeitas([
      ficha('pão A', 0.003), ficha('pão B', 0.003), ficha('pão C', 0.0035), ficha('pão ERRADO', 0.3),
    ])
    const erro = r.find((f) => f.nome === 'pão ERRADO')!
    expect(erro.suspeita).not.toBeNull()
    expect(erro.suspeita!.frase).toMatch(/dose suspeita/)
    // ⭐ a frase traz a dose das irmãs — sem o número, "suspeita" é acusação sem prova
    expect(erro.suspeita!.frase).toMatch(/as outras 3 receitas usam/)
    expect(r.filter((f) => f.suspeita).length, 'só a desviante').toBe(1)
  })

  it('⭐ e o desvio pra BAIXO também: dose 5× menor faz a receita render o impossível', () => {
    const r = marcarDosesSuspeitas([ficha('a', 1), ficha('b', 1), ficha('c', 1), ficha('d', 0.1)])
    expect(r.find((f) => f.nome === 'd')!.suspeita).not.toBeNull()
  })

  /**
   * ⛔⛔ A TRAVA QUE VEIO DO M2 (02/10): com DUAS irmãs a mediana fica NO MEIO do desvio e
   * nenhuma das duas estoura o teto — o guard calaria justo no caso que existe pra achar. E
   * com duas divergindo **não há como saber qual está errada** (a trava do PAO DE MEL).
   */
  it('⛔⛔ com menos de 3 fichas no grupo, NINGUÉM é acusado', () => {
    const r = marcarDosesSuspeitas([ficha('a', 0.003), ficha('b', 0.3)])
    expect(r.every((f) => f.suspeita === null)).toBe(true)
    expect(IRMAS_PARA_COMPARAR).toBe(3)
  })

  /**
   * ⛔⛔ UNIDADES DIFERENTES NÃO SE COMPARAM — o pecado de 13/09 ("1.415,84 un" que era porção
   * somada com massa). 0,05 KG e 50 UN são a mesma coisa física e números 1000× distantes.
   */
  it('⛔⛔ dose em KG não é comparada com dose em UN', () => {
    const r = marcarDosesSuspeitas([
      ficha('a', 0.05, 'KG'), ficha('b', 0.05, 'KG'), ficha('c', 50, 'UN'), ficha('d', 50, 'UN'),
    ])
    expect(r.every((f) => f.suspeita === null), 'cada grupo tem 2 — nem chega a comparar').toBe(true)
  })

  it('⭐ produção e cardápio são grupos diferentes (tipos diferentes, doses diferentes por natureza)', () => {
    const r = marcarDosesSuspeitas([
      ficha('i1', 1, 'KG', 'INTERMEDIARIO'), ficha('i2', 1, 'KG', 'INTERMEDIARIO'), ficha('i3', 1, 'KG', 'INTERMEDIARIO'),
      ficha('p1', 0.01, 'KG', 'PRODUTO_FINAL'), ficha('p2', 0.01, 'KG', 'PRODUTO_FINAL'), ficha('p3', 0.01, 'KG', 'PRODUTO_FINAL'),
    ])
    expect(r.every((f) => f.suspeita === null), 'ninguém acusa ninguém entre grupos').toBe(true)
  })

  it('⚠️ o fator é 5× e tem dono — 4× ainda é dose diferente, não suspeita', () => {
    expect(FATOR_SUSPEITO).toBe(5)
    const r = marcarDosesSuspeitas([ficha('a', 1), ficha('b', 1), ficha('c', 1), ficha('d', 4)])
    expect(r.find((f) => f.nome === 'd')!.suspeita, '4× passa').toBeNull()
    const r2 = marcarDosesSuspeitas([ficha('a', 1), ficha('b', 1), ficha('c', 1), ficha('d', 6)])
    expect(r2.find((f) => f.nome === 'd')!.suspeita, '6× não').not.toBeNull()
  })
})

// ───────────────────────── histórico ─────────────────────────

let seq = 0
const linha = (p: Partial<LinhaDoHistorico> & { data: string }): LinhaDoHistorico => ({
  movimentoId: `m${++seq}`, itemId: 'i', tipo: 'BAIXA_VENDA', chip: 'Baixa de venda',
  familia: 'VENDA', sentido: 'SAIU', quantidade: -1, custoUnitario: 1, custoTotal: -1,
  precoRotulo: 'Custo un.', precoEhDeCompra: false, detalhe: '—', quem: null, href: null,
  origemId: null, ehCompra: false, estornoDe: null, movePrateleira: true,
  dentroDaProducao: null, anulado: null, saldoApos: 0, ...p,
})

describe('⭐⭐ RESUMO DO PERÍODO — só o que move a prateleira, e o resto é CONTADO', () => {
  it('⭐ entrou · saiu · Δ · N, pela MESMA régua do rodapé', () => {
    const r = resumoDoPeriodo([
      linha({ data: '2026-10-05', tipo: 'ENTRADA_NF', quantidade: 100, custoTotal: 340 }),
      linha({ data: '2026-10-04', quantidade: -30, custoTotal: -102 }),
      // ⛔ não move a prateleira: transferência interna
      linha({ data: '2026-10-03', tipo: 'PRODUCAO_CONSUMO', quantidade: -30, custoTotal: -102, movePrateleira: false }),
    ])
    expect(r.entrou).toBe(100)
    expect(r.saiu).toBe(30)
    expect(r.delta).toBe(70)
    expect(r.movimentos, 'o N conta as LINHAS visíveis, inclusive as que não somam').toBe(3)
    // ⚠️ exclusão escondida é tão ruim quanto exclusão nenhuma
    expect(r.foraDaConta).toBe(1)
  })

  it('⭐ o dinheiro anda com a quantidade', () => {
    const r = resumoDoPeriodo([linha({ data: '2026-10-05', tipo: 'ENTRADA_NF', quantidade: 10, custoTotal: 340 })])
    expect(r.entrouValor).toBe(340)
    expect(r.deltaValor).toBe(340)
  })
})

describe('⭐⭐ A LINHA DO ZERO — onde o saldo cruzou pro negativo', () => {
  /** a lista é DESC (mais recente primeiro), como a tabela desenha */
  it('⭐ acha o cruzamento MAIS RECENTE', () => {
    const l = [
      linha({ data: '2026-10-05', saldoApos: -5 }),
      linha({ data: '2026-10-04', saldoApos: -2 }), // ← cruzou aqui
      linha({ data: '2026-10-03', saldoApos: 3 }),
      linha({ data: '2026-10-02', saldoApos: 8 }),
    ]
    expect(linhaDoZero(l)?.data).toBe('2026-10-04')
  })

  it('⛔ item que JÁ COMEÇOU negativo não aponta o dedo pra ninguém', () => {
    const l = [linha({ data: '2026-10-05', saldoApos: -5 }), linha({ data: '2026-10-04', saldoApos: -3 })]
    expect(linhaDoZero(l)).toBeNull()
  })

  it('⛔ sem `saldoApos` (recorte não contíguo) não dá pra afirmar nada', () => {
    const l = [linha({ data: '2026-10-05', saldoApos: null }), linha({ data: '2026-10-04', saldoApos: null })]
    expect(linhaDoZero(l)).toBeNull()
  })

  it('⭐ item que foi e VOLTOU do negativo aponta o buraco de AGORA', () => {
    const l = [
      linha({ data: '2026-10-06', saldoApos: -1 }),
      linha({ data: '2026-10-05', saldoApos: 4 }),
      linha({ data: '2026-10-04', saldoApos: -9 }),
      linha({ data: '2026-10-03', saldoApos: 2 }),
    ]
    expect(linhaDoZero(l)?.data, 'o cruzamento recente, não o antigo').toBe('2026-10-06')
  })
})

describe('⭐ SALDO NO TEMPO — projeção do saldoApos, um ponto por dia', () => {
  it('⭐ vários movimentos no mesmo dia viram UM ponto: o último do dia', () => {
    const s = saldoNoTempo([
      linha({ data: '2026-10-05T18:00:00Z', saldoApos: 7 }),
      linha({ data: '2026-10-05T09:00:00Z', saldoApos: 12 }),
      linha({ data: '2026-10-04T10:00:00Z', saldoApos: 20 }),
    ])
    expect(s).toEqual([{ data: '2026-10-04', saldo: 20 }, { data: '2026-10-05', saldo: 7 }])
  })

  it('⛔ linha sem saldo conhecido não entra (o gráfico não inventa ponto)', () => {
    expect(saldoNoTempo([linha({ data: '2026-10-05', saldoApos: null })])).toEqual([])
  })
})

describe('⭐ O RECORTE — período, busca e o aviso de que ele existe', () => {
  const l = [
    linha({ data: '2026-10-05', tipo: 'ENTRADA_NF', ehCompra: true, detalhe: 'NF nº 1234 · Frigorífico Silva' }),
    linha({ data: '2026-09-20', detalhe: 'venda do dia 20/09', quem: 'marcyelle' }),
    linha({ data: '2026-08-01', tipo: 'AJUSTE_CONTAGEM', detalhe: 'contagem de rotina' }),
  ]

  it('⭐ período corta pelos dois lados', () => {
    expect(aplicarRecorte(l, { de: '2026-09-01' }, casaBusca)).toHaveLength(2)
    expect(aplicarRecorte(l, { ate: '2026-09-30' }, casaBusca)).toHaveLength(2)
    expect(aplicarRecorte(l, { de: '2026-09-01', ate: '2026-09-30' }, casaBusca)).toHaveLength(1)
  })

  it('⭐ a busca usa a régua da CASA — palavra em qualquer ordem, sem caixa e sem acento', () => {
    expect(aplicarRecorte(l, { busca: '1234' }, casaBusca)).toHaveLength(1)
    expect(aplicarRecorte(l, { busca: 'frigorifico' }, casaBusca), 'sem acento acha').toHaveLength(1)
    expect(aplicarRecorte(l, { busca: 'silva frigorifico' }, casaBusca), 'ordem livre').toHaveLength(1)
    expect(aplicarRecorte(l, { busca: 'MARCYELLE' }, casaBusca), 'quem fez também é buscável').toHaveLength(1)
  })

  it('⭐ o filtro de tipo e a aba de compras seguem funcionando', () => {
    expect(aplicarRecorte(l, { filtro: 'COMPRAS' }, casaBusca)).toHaveLength(1)
    expect(aplicarRecorte(l, { filtro: 'AJUSTE_CONTAGEM' }, casaBusca)).toHaveLength(1)
  })

  /** ⛔ é isto que decide se o rodapé da Σ aparece: filtrado, a soma é do recorte */
  it('⛔ `temRecorte` reconhece qualquer recorte ativo', () => {
    expect(temRecorte({})).toBe(false)
    expect(temRecorte({ filtro: 'TUDO' })).toBe(false)
    expect(temRecorte({ busca: '   ' }), 'espaço não é busca').toBe(false)
    expect(temRecorte({ de: '2026-01-01' })).toBe(true)
    expect(temRecorte({ busca: 'nf' })).toBe(true)
    expect(temRecorte({ filtro: 'COMPRAS' })).toBe(true)
  })
})
