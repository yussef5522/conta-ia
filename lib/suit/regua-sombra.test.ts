import { describe, it, expect } from 'vitest'
import {
  agregarApi, agregarXls, veredito, janelaDia, centavos, mesclarState, lerState, diasPendentes,
  sequenciaBate, temVeredito, type PedidoApi,
} from './regua-sombra'

const item = (name: string, quantity: number, price: string, cancelled_at: string | null = null) => ({
  name, quantity, price, cancelled_at,
})

// um dia sintético com TODOS os casos da régua de 07/11
const PEDIDOS: PedidoApi[] = [
  { id: 1, status: 'delivered', items: [item('PIZZA GRANDE PRECINHO', 1, '39.99'), item('COCA COLA 2L', 2, '36.00')] },
  { id: 2, status: 'accepted', items: [item(' pizza grande precinho ', 2, '79.98')] }, // grafia suja → mesmo produto
  { id: 3, status: 'transferred', items: [item('XIS COMPLETO', 1, '28.99')] }, // ENTRA
  { id: 4, status: 'abandoned', items: [item('XIS COMPLETO', 5, '144.95')] }, // FICA FORA
  { id: 5, status: 'cancelled', items: [item('MINI FRITAS', 1, '9.99'), item('MINI FRITAS', 3, '29.97', '2026-11-07T20:00:00')] },
]
const XLS_CERTO = [
  { nomeSuitable: 'PIZZA GRANDE PRECINHO', quantidade: 3, valorTotal: 119.97 },
  { nomeSuitable: 'COCA COLA 2L', quantidade: 2, valorTotal: 36 },
  { nomeSuitable: 'XIS COMPLETO', quantidade: 1, valorTotal: 28.99 },
  { nomeSuitable: 'MINI FRITAS', quantidade: 1, valorTotal: 9.99 },
]

describe('régua da prova-sombra (provada em 07/11)', () => {
  it('abandoned fica FORA; transferred e cancelled ENTRAM; item com cancelled_at fica FORA', () => {
    const a = agregarApi(PEDIDOS)
    expect(a.porProduto.get('XIS COMPLETO')).toEqual({ un: 1, cent: 2899 })
    expect(a.porProduto.get('MINI FRITAS')).toEqual({ un: 1, cent: 999 })
    expect(a.porProduto.get('PIZZA GRANDE PRECINHO')).toEqual({ un: 3, cent: 11997 })
    expect(a.un).toBe(7)
    expect(a.cent).toBe(19495)
    expect(a.transferred).toBe(1)
    expect(a.pedidosContados).toBe(4)
  })

  it('BATE quando todo produto bate em un e centavo — com o formato combinado', () => {
    expect(veredito('2026-11-07', agregarApi(PEDIDOS), agregarXls(XLS_CERTO))).toBe(
      '2026-11-07 BATE 7un R$194,95 transferred=1',
    )
  })

  it('DIVERGE traz as 3 piores diferenças (API − XLS) e os totais', () => {
    const xls = [
      { nomeSuitable: 'PIZZA GRANDE PRECINHO', quantidade: 5, valorTotal: 199.95 }, // api −2 un −79,98
      { nomeSuitable: 'COCA COLA 2L', quantidade: 2, valorTotal: 36 },
      { nomeSuitable: 'XIS COMPLETO', quantidade: 1, valorTotal: 28.99 },
      // MINI FRITAS ausente no XLS → api +1 un +9,99
      { nomeSuitable: 'BATATA', quantidade: 1, valorTotal: 0.01 }, // só no XLS → −1 un −0,01
    ]
    const v = veredito('2026-11-07', agregarApi(PEDIDOS), agregarXls(xls))
    expect(v).toBe(
      '2026-11-07 DIVERGE PIZZA GRANDE PRECINHO · -2un · -R$79,98 | MINI FRITAS · +1un · +R$9,99 | BATATA · -1un · -R$0,01 ' +
        '(api 7un R$194,95 × xls 9un R$264,95; 3 produto(s) diferem) transferred=1',
    )
  })

  it('grafia: espaço duplo, caixa e acento são o MESMO produto (caso real 08/11: "HAMBURGUER  TRADICIONAL")', () => {
    const a = agregarApi([{ id: 1, status: 'delivered', items: [item('HAMBURGUER  TRADICIONAL', 7, '237.93'), item('Suco de  Pêssego', 1, '7.00')] }])
    const x = agregarXls([
      { nomeSuitable: 'HAMBURGUER TRADICIONAL', quantidade: 7, valorTotal: 237.93 },
      { nomeSuitable: 'SUCO DE PESSEGO', quantidade: 1, valorTotal: 7 },
    ])
    expect(veredito('2026-11-08', a, x)).toBe('2026-11-08 BATE 8un R$244,93 transferred=0')
  })

  it('1 centavo de diferença já é DIVERGE (nada de tolerância escondida)', () => {
    const xls = XLS_CERTO.map((l) => (l.nomeSuitable === 'COCA COLA 2L' ? { ...l, valorTotal: 36.01 } : l))
    expect(veredito('2026-11-07', agregarApi(PEDIDOS), agregarXls(xls))).toMatch(/ DIVERGE COCA COLA 2L · 0un · -R\$0,01 /)
  })

  it('soma em centavo não erra no float (0,1 + 0,2)', () => {
    const a = agregarApi([{ id: 1, status: 'delivered', items: [item('A', 1, '0.10'), item('A', 1, '0.20')] }])
    const x = agregarXls([{ nomeSuitable: 'A', quantidade: 2, valorTotal: 0.1 + 0.2 }])
    expect(veredito('2026-11-07', a, x)).toBe('2026-11-07 BATE 2un R$0,30 transferred=0')
  })

  it('valor não numérico é ERRO, nunca zero', () => {
    expect(() => centavos('abc')).toThrow()
    expect(() => agregarApi([{ id: 1, status: 'delivered', items: [item('A', 1, 'NaN')] }])).toThrow()
  })

  it('janela = D 06:00 → D+1 05:59:59, virando mês', () => {
    expect(janelaDia('2026-11-30')).toEqual({ from: '2026-11-30T06:00:00', to: '2026-12-01T05:59:59.999999' })
  })
})

describe('state e escolha de dias', () => {
  it('mescla substitui a linha do dia (AGUARDANDO vira veredito) e ordena', () => {
    let s = mesclarState('', '2026-11-09 AGUARDANDO-XLS')
    s = mesclarState(s, '2026-11-08 BATE 1un R$1,00 transferred=0')
    s = mesclarState(s, '2026-11-09 BATE 2un R$2,00 transferred=0')
    expect(s).toBe('2026-11-08 BATE 1un R$1,00 transferred=0\n2026-11-09 BATE 2un R$2,00 transferred=0\n')
  })

  it('só BATE/DIVERGE é veredito; AGUARDANDO e ERRO voltam pra fila', () => {
    expect(temVeredito('2026-11-08 BATE 1un')).toBe(true)
    expect(temVeredito('2026-11-08 DIVERGE X')).toBe(true)
    expect(temVeredito('2026-11-08 AGUARDANDO-XLS')).toBe(false)
    expect(temVeredito('2026-11-08 ERRO-API GET x')).toBe(false)
    expect(temVeredito(undefined)).toBe(false)
  })

  it('pendentes: os 3 mais recentes sem veredito, já fechados, nunca antes do início', () => {
    const st = lerState('2026-11-08 BATE 1un\n2026-11-10 AGUARDANDO-XLS\n2026-11-11 DIVERGE X\n')
    // 13/11 07:17 → ontem (12) fechado às 13 06:00; 11 tem veredito; 10 aguardando; 9 sem linha
    expect(diasPendentes(st, '2026-11-13T07:17:00', '2026-11-08')).toEqual(['2026-11-09', '2026-11-10', '2026-11-12'])
    // 13/11 05:00 → o dia 12 ainda NÃO fechou (vira às 06:00)
    expect(diasPendentes(st, '2026-11-13T05:00:00', '2026-11-08')).toEqual(['2026-11-09', '2026-11-10'])
    expect(diasPendentes(new Map(), '2026-11-09T07:17:00', '2026-11-08')).toEqual(['2026-11-08'])
  })

  it('sequência de BATE conta do mais recente pra trás e para no DIVERGE', () => {
    expect(sequenciaBate(lerState('2026-11-08 BATE a\n2026-11-09 DIVERGE b\n2026-11-10 BATE c\n2026-11-11 BATE d\n2026-11-12 AGUARDANDO-XLS\n'))).toBe(2)
  })
})
