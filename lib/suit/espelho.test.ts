import { describe, it, expect } from 'vitest'
import { linhasDoPedido, linhaDoLancamento, diaOperacional, impressaoDaRegua, contribuicao } from './espelho'
import { linhasDaRegua, exigirDiaFechado, DiaAbertoError, grafiaDoXls } from './materializar'
import type { PedidoCru, LancamentoCru } from './cliente-leitura'

// ⛔ os SENTINELAS de dado pessoal: se qualquer um aparecer no que vai pro banco, a allowlist furou
const PII = ['FULANA DE TAL', '51999990000', 'RUA DO CLIENTE 123', '-29.1234', 'MOTOBOY JOAO', 'SEM CEBOLA PRO SEU ZE', 'CLIENTE VIP RECLAMOU', 'CHAMA A MARIA', 'Rua Coronel']
const cru = (over: Partial<PedidoCru> = {}): PedidoCru => ({
  id: 27630, display_number: '80', status: 'delivered', order_type: 'delivery', source: 'terminal',
  created_at: '2026-11-10T02:54:02.8244', finished_at: null, delivered_at: '2026-11-10T03:22:08.4281', scheduled_for: '2026-11-10T03:34:02.7711', is_scheduled: false,
  products_total: '63.98', delivery_fee: '9.00', service_fee: '0.00', discount: '0.00', additional: '0.00', total: '63.98', paid: true, integration_code: 'abc',
  items: [{ id: 1, name: 'AÇAÍ 500ML', category: 'AÇAÍ', quantity: 1, unit_price: '20.99', price: '20.99', base_price: '20.99', status: 'Entregue', requested_at: '2026-11-10T02:54:02.8962', cancelled_at: null, weight_kg: 1, sold_by_weight: false, promotional: false, options: [{ group_name: 'Frutas', name: 'MORANGO', unit_price: '0.00', quantity: 2, price: '0.00' }] }],
  payment: { methods: [{ id: 1, code: 1, type: 'Dinheiro', entry_type: 'Débito', value: '63.98', settled: true }] },
  ...over,
})
// o pedido como a API manda DE VERDADE (medido 10/11): com cliente, endereço, motoboy e texto livre
const comPII = {
  ...cru(), call_name: PII[7], comments: PII[5], cancellation_reason: PII[6], discount_reason: PII[6], is_recent_customer: true,
  customer: { id: 1552, name: PII[0], phone: PII[1] },
  delivery_address: { street: PII[2], number: '1272', neighborhood: 'Centro', city: 'X', latitude: PII[3], longitude: PII[3], formatted: `${PII[8]} 1272` },
  motoboy: { id: 4734, name: PII[4] },
  items: [{ ...cru().items[0], comments: PII[5], cancellation_reason: PII[6] }],
} as unknown as PedidoCru

describe('⛔ LGPD / lei V8 — o espelho é ALLOWLIST: nenhum dado pessoal chega ao banco', () => {
  it('pedido real com cliente/endereço/motoboy/comentário → NENHUM sentinela no que é gravado', () => {
    const gravado = JSON.stringify(linhasDoPedido(comPII))
    for (const s of PII) expect(gravado, `vazou: ${s}`).not.toContain(s)
    expect(gravado).toContain('AÇAÍ 500ML') // o produto (não é pessoal) entra
  })
  it('lançamento financeiro: `description` e o nome da conta ficam fora', () => {
    const l = { id: 9, entry_id: 1, description: `PIX de ${PII[0]}`, type: 'delivery', status: 'paid', value: '10.00', is_earning: true, fee: '0.07', net_value: '9.93', created_at: '2026-11-08T12:00:00', received_at: '2026-11-08', payment_method: { id: 99, name: PII[0], type: 'pix' }, bank_account: { id: 3, name: PII[0], type: 'x' } } as unknown as LancamentoCru
    const g = JSON.stringify(linhaDoLancamento(l, '2026-11-08'))
    expect(g).not.toContain(PII[0])
    expect(linhaDoLancamento(l, '2026-11-08')).toMatchObject({ valorCent: 1000, taxaCent: 7, liquidoCent: 993, metodoTipo: 'pix' })
  })
})

describe('o dia operacional da régua: 06h→06h no relógio da API (UTC)', () => {
  it.each([
    ['2026-11-10T05:59:59.999', '2026-11-09'],
    ['2026-11-10T06:00:00', '2026-11-10'],
    ['2026-11-10T02:54:02.8244', '2026-11-09'], // 23:54 de Brasília do dia 09
    ['2026-11-09T23:59:59', '2026-11-09'],
  ])('%s → %s', (c, d) => expect(diaOperacional(c)).toBe(d))
})

describe('impressão da régua: muda só quando o que a régua CONTA muda', () => {
  it('status de transição (accepted→delivered) NÃO muda; item cancelado e abandoned mudam', () => {
    const a = impressaoDaRegua(cru({ status: 'accepted' }))
    expect(impressaoDaRegua(cru({ status: 'delivered' }))).toBe(a)
    expect(impressaoDaRegua(cru({ items: [{ ...cru().items[0], cancelled_at: '2026-11-10T03:00:00' }] }))).not.toBe(a)
    expect(impressaoDaRegua(cru({ status: 'abandoned' }))).toBe('FORA')
    expect(contribuicao(a)).toEqual({ un: 1, cent: 2099 })
    expect(contribuicao('FORA')).toEqual({ un: 0, cent: 0 })
  })
})

const ped = (status: string, itens: [string, number, number, boolean?][], sumido = false) => ({
  status, sumidoEm: sumido ? new Date() : null,
  itens: itens.map(([nome, quantidade, precoCent, canc]) => ({ nome, quantidade, precoCent, canceladoEm: canc ? new Date() : null })),
})

describe('a régua da ESTEIRA (linhasDaRegua) — a mesma régua provada, na grafia do XLS', () => {
  it('abandoned fora · item cancelado fora · pedido apagado fora · resto soma', () => {
    const r = linhasDaRegua([
      ped('delivered', [['XIS COMPLETO', 1, 2899], ['COCA 2L', 2, 3600]]),
      ped('abandoned', [['XIS COMPLETO', 5, 14495]]),
      ped('cancelled', [['MINI FRITAS', 1, 999], ['MINI FRITAS', 3, 2997, true]]),
      ped('ready', [['XIS COMPLETO', 9, 9999]], true),
    ])
    expect(r.linhas).toEqual([
      { produto: 'COCA 2L', quantidade: 2, valorTotal: 36 },
      { produto: 'MINI FRITAS', quantidade: 1, valorTotal: 9.99 },
      { produto: 'XIS COMPLETO', quantidade: 1, valorTotal: 28.99 },
    ])
    expect(r.totalCent).toBe(2899 + 3600 + 999)
    expect(r.pedidos).toBe(2)
  })
  it('a grafia é a do XLS: espaço colapsado, caixa e acento intactos (caso real 08/11)', () => {
    expect(grafiaDoXls('HAMBURGUER  TRADICIONAL')).toBe('HAMBURGUER TRADICIONAL')
    expect(grafiaDoXls(' Combo Caçula ')).toBe('Combo Caçula')
    const r = linhasDaRegua([ped('delivered', [['SUCO DE  PESSEGO', 1, 800], ['SUCO DE PESSEGO', 1, 800]])])
    expect(r.linhas).toEqual([{ produto: 'SUCO DE PESSEGO', quantidade: 2, valorTotal: 16 }])
  })
  it('⛔ caixa diferente = LINHA diferente, como o XLS (caso real 08/11: "XIS COMPLETO" e "Xis Completo")', () => {
    const p = [ped('delivered', [['XIS COMPLETO', 2, 5000], ['Xis Completo', 1, 5596], ['XIS  COMPLETO', 1, 2500]])]
    const l = linhasDaRegua(p).linhas
    expect(l).toHaveLength(2)
    expect(l).toEqual(expect.arrayContaining([
      { produto: 'XIS COMPLETO', quantidade: 3, valorTotal: 75 },
      { produto: 'Xis Completo', quantidade: 1, valorTotal: 55.96 },
    ]))
  })
  it('⛔ quantidade fracionada é ERRO (a esteira é inteira), nunca arredondada calada', () => {
    expect(() => linhasDaRegua([ped('delivered', [['AÇAÍ KG', 0.35, 1400]])])).toThrow(/fracionada/)
  })
})

describe('⛔ dia ABERTO não materializa (fecha D+1 03:10 de Brasília = 06:10 UTC)', () => {
  it('09/11 às 06:09Z de 10/11 → aberto; às 06:10Z → fechado', () => {
    expect(() => exigirDiaFechado('2026-11-09', new Date('2026-11-10T06:09:59Z'))).toThrow(DiaAbertoError)
    expect(() => exigirDiaFechado('2026-11-09', new Date('2026-11-10T06:10:00Z'))).not.toThrow()
    expect(() => exigirDiaFechado('2026-11-10', new Date('2026-11-10T08:00:00Z'))).toThrow(DiaAbertoError)
  })
})
