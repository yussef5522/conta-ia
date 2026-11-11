// VENDAS AO VIVO — as contas da lei (docs/vendas-ao-vivo-referencia.html v3) viram teste.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { reguaDoRitmo, ritmo, minutosNoStatus, abertaHa, janelaDoEixo, horaOperacional, montarAoVivo, portaoDaContagem, quemFechou, seloDaGuarda, canalDe, minutoOperacional, type PedidoDaRegua } from '../ao-vivo'
import { fecharDiaNaMao, FechandoAgoraError } from '../fechar-dia'
import { tentarTravar, soltar } from '../trava-arquivo'
import { gravarPedido } from '../sync'
import { diaOperacional } from '../espelho'
import { somarDias } from '../regua-sombra'
import { CORTE_API } from '../cortes'
import type { ClienteSuitLeitura, PedidoCru } from '../cliente-leitura'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ─── as contas puras ────────────────────────────────────────────────────────────────────
const em = (iso: string) => new Date(iso)
const ped = (criado: string, valorCent: number, status = 'delivered'): PedidoDaRegua => ({ status, sumido: false, criado: em(criado), valorCent })

describe('V2 · ritmo é comparação JUSTA (mesmo corte de horário) e régua não se inventa', () => {
  // 4 sábados: cada um vendeu 100 às 19:00 BRT (22:00Z) e 900 às 22:00 BRT (01:00Z do dia seguinte)
  const sabado = (d: string) => ({ dia: d, pedidos: [ped(`${d}T22:00:00Z`, 10000), ped(`${somarDias(d, 1)}T01:00:00Z`, 90000)] })
  const quatro = ['2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07'].map(sabado)
  it('às 21:37 a régua só conta o que os sábados venderam ATÉ 21:37 (dia corrido × dia inteiro é proibido)', () => {
    const r = reguaDoRitmo(quatro, minutoOperacional(em('2026-11-15T00:37:00Z'))) // 21:37 BRT
    expect(r.tipicoCent).toBe(10000) // NÃO 100.000
    expect(r.tipicoDiaCent).toBe(100000)
    expect(ritmo(8000, r.tipicoCent)).toEqual({ pct: -20, alerta: true }) // V7: além de 15% → alerta
    expect(ritmo(9000, r.tipicoCent)).toEqual({ pct: -10, alerta: false })
  })
  it('com menos de 4 semanas no espelho: régua EM FORMAÇÃO (null), nunca média de 3', () => {
    const r = reguaDoRitmo(quatro.slice(0, 3), 9999)
    expect(r).toEqual({ semanas: 3, tipicoCent: null, tipicoDiaCent: null, porHoraCent: null })
    expect(ritmo(5000, r.tipicoCent)).toEqual({ pct: null, alerta: false })
  })
  it('abandoned e apagado ficam fora da régua (V10)', () => {
    const dias = quatro.map((s) => ({ ...s, pedidos: [...s.pedidos, ped(`${s.dia}T21:00:00Z`, 50000, 'abandoned'), { ...ped(`${s.dia}T21:00:00Z`, 70000), sumido: true }] }))
    expect(reguaDoRitmo(dias, minutoOperacional(em('2026-11-15T00:37:00Z'))).tipicoCent).toBe(10000)
  })
})

describe('V3 · minutos no status ativo = agora − o último horário REAL', () => {
  const agora = em('2026-11-15T00:37:00Z')
  it('aceito/pronto contam; entregue/cancelado não', () => {
    const tl = [{ hora: em('2026-11-15T00:28:00Z') }]
    expect(minutosNoStatus('accepted', tl, agora)).toBe(9)
    expect(minutosNoStatus('ready', tl, agora)).toBe(9)
    expect(minutosNoStatus('delivered', tl, agora)).toBeNull()
    expect(minutosNoStatus('cancelled', tl, agora)).toBeNull()
  })
})

describe('V11/V6 · carimbo e selo dizem a verdade', () => {
  it('quem fechou: antes da virada (D+1 06:10Z) = dono; depois = automático', () => {
    expect(quemFechou('2026-11-14', em('2026-11-15T02:30:00Z'))).toBe('dono')
    expect(quemFechou('2026-11-14', em('2026-11-15T06:10:05Z'))).toBe('automatico')
  })
  it('selo só "conferido" quando a guarda bateu produto E sabor; sem linha = conferindo (selo falso jamais)', () => {
    expect(seloDaGuarda(undefined)).toBe('conferindo')
    expect(seloDaGuarda('2026-11-14 a=BATE api=… · b=FECHA … · comp=BATE(API) …')).toBe('conferido')
    expect(seloDaGuarda('2026-11-14 a=BATE api=… · comp=DIVERGE(API) …')).toBe('divergiu')
    expect(seloDaGuarda('2026-11-14 a=BATE api=… · c=0 pendente(s)')).toBe('conferindo') // linha antiga, sem sabor conferido
  })
  it('canal pelo campo DECLARADO: marketplace pela origem, o resto pelo tipo', () => {
    expect(canalDe('ifood', 'delivery').chave).toBe('ifood')
    expect(canalDe('aiqfome', 'delivery').chave).toBe('aiqfome')
    expect(canalDe('whatsapp', 'delivery').chave).toBe('tele')
    expect(canalDe('self_checkout', 'salon').chave).toBe('salao')
    expect(canalDe('totem (local)', 'number').chave).toBe('salao')
    expect(canalDe('mobile', 'takeout').chave).toBe('retirada')
  })
})

// ─── com banco (dia RELATIVO ao relógio — nunca data fixa no futuro) ─────────────────────
const CNPJ = '11121112000112'
let companyId = ''
const AGORA = new Date()
const D = diaOperacional(AGORA.toISOString().slice(0, 19))
const antes = (min: number) => new Date(AGORA.getTime() - min * 60_000)
const iso = (d: Date) => d.toISOString().slice(0, 23)

// o pedido CRU como a API manda — COM os campos de cliente (pra provar que nada vaza)
const cru = (id: number, criado: Date, status: string, extra: Partial<PedidoCru> = {}): PedidoCru => ({
  id, display_number: String(100 + id), status, order_type: 'delivery', source: 'whatsapp', created_at: iso(criado),
  finished_at: null, delivered_at: status === 'delivered' ? iso(new Date(criado.getTime() + 20 * 60_000)) : null, scheduled_for: null, is_scheduled: false,
  products_total: '30.00', delivery_fee: '0.00', service_fee: '0.00', discount: '0.00', additional: '0.00', total: '30.00', paid: true, integration_code: null,
  items: [{ id: id * 10, name: 'PIZZA GRANDE 35CM', category: 'PIZZA', quantity: 1, unit_price: '30.00', price: '30.00', base_price: '30.00', status: 'x', requested_at: iso(criado), cancelled_at: null, weight_kg: null, sold_by_weight: false, promotional: false, options: [{ group_name: 'SABOR', name: 'CALABRESA', unit_price: '0.00', quantity: 1, price: '0.00' }] }],
  payment: { methods: [{ id: 1, code: 1, type: 'Pix', entry_type: 'Débito', value: '30.00', settled: true }] },
  ...({ customer: { name: 'FULANA DE TAL', phone: '51999990000' }, delivery_address: { street: 'RUA DO CLIENTE 123', formatted: 'RUA DO CLIENTE 123' }, motoboy: { name: 'MOTOBOY JOAO' }, comments: 'CHAMA A MARIA', call_name: 'MARIA' } as object),
  ...extra,
})

async function limpar() {
  for (const { id } of await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })) {
    await prisma.suitPedido.deleteMany({ where: { companyId: id } })
    for (const m of [prisma.suitPedidoEvento, prisma.suitPagamento, prisma.suitDiaMaterializado, prisma.stockVendaComplementoLinha, prisma.stockVendaComplementoNome, prisma.stockVendaArquivo] as const) await (m as typeof prisma.suitPagamento).deleteMany({ where: { companyId: id } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}
beforeEach(async () => { await limpar(); companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'AO VIVO' } })).id })
afterEach(limpar)

describe('⛔ V8 · o DTO da tela NÃO TEM campo de cliente (nem pra ler)', () => {
  it('chaves do DTO = allowlist exata; nenhum sentinela de cliente no JSON', async () => {
    for (const [i, st] of (['accepted', 'ready', 'delivered', 'cancelled'] as const).entries()) await gravarPedido(prisma, companyId, cru(i + 1, antes(60 - i * 10), st), AGORA)
    const dto = await montarAoVivo(prisma, companyId, AGORA, { atualizado: AGORA, guarda: new Map() })
    const json = JSON.stringify(dto)
    for (const s of ['FULANA', '51999990000', 'RUA DO CLIENTE', 'MOTOBOY', 'MARIA']) expect(json, s).not.toContain(s)
    const chaves = new Set<string>()
    const andar = (o: unknown) => { if (Array.isArray(o)) o.forEach(andar); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { chaves.add(k); andar(v) } }
    andar(dto)
    expect([...chaves].sort()).toEqual([
      'agora', 'alerta', 'atual', 'atualizado', 'canais', 'canal', 'cent', 'chave', 'conta', 'curva', 'dia', 'feed', 'fechado', 'hoje', 'hojeCent', 'hora', 'id', 'itens', 'linhaDoTempo', 'minutos', 'aberta', 'naCozinha', 'nome', 'num', 'pagamento', 'pedidos', 'prontos', 'q', 'regua', 'reguaCent', 'ritmoPct', 'rotulo', 'sabores', 'selo', 'semana', 'semanas', 'status', 'taxaDia', 'ticketCent', 'tipicoCent', 'tipicoDiaCent', 'tipo', 'totalCent', 'valorCent', 'vendidoCent',
    ].sort())
  })
})

describe('V3 · honestidade: nada "depois de agora" entra no feed; cancelado aparece riscado e fora do total', () => {
  it('pedido com hora no futuro fica fora; entregue no futuro não entra na linha do tempo', async () => {
    await gravarPedido(prisma, companyId, cru(1, antes(30), 'accepted'), AGORA)
    await gravarPedido(prisma, companyId, cru(2, new Date(AGORA.getTime() + 5 * 60_000), 'accepted'), AGORA) // relógio da API adiantado
    await gravarPedido(prisma, companyId, cru(3, antes(10), 'delivered'), AGORA) // entregue_at = +10min → futuro
    await gravarPedido(prisma, companyId, cru(4, antes(20), 'cancelled', { items: [{ ...cru(4, antes(20), 'x').items[0], cancelled_at: iso(antes(15)) }] }), AGORA)
    const d = await montarAoVivo(prisma, companyId, AGORA, { atualizado: null, guarda: new Map() })
    expect(d.feed.map((p) => p.id).sort()).toEqual([1, 3, 4])
    expect(d.feed.find((p) => p.id === 3)!.linhaDoTempo.map((t) => t.rotulo)).toEqual(['aceito'])
    expect(d.feed.find((p) => p.id === 1)!.minutos).toBe(30)
    const c = d.feed.find((p) => p.id === 4)!
    expect(c).toMatchObject({ status: 'cancelled', conta: false, valorCent: 3000 })
    expect(c.linhaDoTempo.map((t) => t.rotulo)).toEqual(['aceito', 'cancelado'])
    expect(d.vendidoCent).toBe(6000) // 1 e 3; cancelado fora
    expect(d.regua).toMatchObject({ semanas: 0, tipicoCent: null, ritmoPct: null, alerta: false }) // em formação
  })
})

describe('⭐ V11 · FECHAR O DIA: idempotente, travado, e o dia volta a falar depois', () => {
  const fake = (pedidos: PedidoCru[]): ClienteSuitLeitura => ({
    async listar(from, to) { return pedidos.filter((p) => p.created_at >= from && p.created_at <= to).map((p) => ({ id: p.id, status: p.status, created_at: p.created_at, products_total: p.products_total, total: p.total, paid: p.paid })) },
    async detalhe(id) { return pedidos.find((p) => p.id === id) ?? null },
    async lancamentos() { return [] },
    async pedidosDoDia() { return [] },
    requisicoes: () => 0,
  })
  const trava = () => join(mkdtempSync(join(tmpdir(), 'suit-trava-')), 'suit.lock')

  it.skipIf(D < CORTE_API)('1º clique materializa produtos+sabores; 2º clique = só o carimbo (1 import, nada duplicado)', async () => {
    const ps = [cru(1, antes(50), 'delivered'), cru(2, antes(40), 'ready')]
    const t = trava()
    const c1 = await fecharDiaNaMao(prisma, fake(ps), companyId, AGORA, t)
    expect(c1).toMatchObject({ dia: D, por: 'dono', jaEstava: false, produtos: { status: 'MATERIALIZADO', totalCent: 6000 } })
    expect(c1.sabores).toMatchObject({ status: 'MATERIALIZADO', ocorrencias: 2 })
    const c2 = await fecharDiaNaMao(prisma, fake(ps), companyId, new Date(AGORA.getTime() + 60_000), t)
    expect(c2).toMatchObject({ dia: D, jaEstava: true, hora: c1.hora })
    expect(await prisma.stockVendaImport.count({ where: { companyId } })).toBe(1)
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId } })).toBe(1)
    expect((await portaoDaContagem(prisma, companyId, AGORA)).liberada).toBe(true)
  }, 60_000)

  it.skipIf(D < CORTE_API)('⛔ clique durante outro fechamento (trava ocupada) → "fechando", nada gravado', async () => {
    const t = trava()
    expect(tentarTravar(t)).toBe(true)
    await expect(fecharDiaNaMao(prisma, fake([cru(1, antes(50), 'delivered')]), companyId, AGORA, t)).rejects.toThrow(FechandoAgoraError)
    soltar(t)
    expect(await prisma.suitDiaMaterializado.count({ where: { companyId } })).toBe(0)
  }, 60_000)

  it.skipIf(D < CORTE_API)('pedido que NASCE depois do fechamento na mão vira evento NOVO pendente (nunca silêncio)', async () => {
    const t = trava()
    await fecharDiaNaMao(prisma, fake([cru(1, antes(50), 'delivered')]), companyId, AGORA, t)
    await gravarPedido(prisma, companyId, cru(9, antes(1), 'accepted'), new Date(AGORA.getTime() + 60_000))
    const ev = await prisma.suitPedidoEvento.findMany({ where: { companyId } })
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ tipo: 'NOVO', decisao: null, deltaCent: 3000, depoisDaMaterializacao: true })
  }, 60_000)
})

describe('⛔ o PORTÃO da contagem', () => {
  it('sem venda no dia (manhã) → liberada; com venda e dia aberto → trancada, com o dia', async () => {
    expect(await portaoDaContagem(prisma, companyId, AGORA)).toEqual({ liberada: true, dia: null })
    await gravarPedido(prisma, companyId, cru(1, antes(20), 'accepted'), AGORA)
    expect(await portaoDaContagem(prisma, companyId, AGORA)).toEqual({ liberada: false, dia: D })
  })
  it('venda só ABANDONADA não tranca', async () => {
    await gravarPedido(prisma, companyId, cru(1, antes(20), 'abandoned'), AGORA)
    expect((await portaoDaContagem(prisma, companyId, AGORA)).liberada).toBe(true)
  })
})

// ─── emendas do dono (11/11) ─────────────────────────────────────────────────────────────
describe('E2 · o eixo da curva é o DIA INTEIRO desde a primeira hora', () => {
  it('pura: união das horas, contínua da primeira à última; sem dado nenhum → só a hora atual', () => {
    expect(janelaDoEixo([8, 9, 10, 11, 5, 22, 14], 11)).toEqual({ ini: 5, fim: 22 })
    expect(janelaDoEixo([], 11)).toEqual({ ini: 11, fim: 11 })
  })
  it('caso real de 11/11 14:57: hoje só 3h de venda, mas o eixo vai das 08h à 01h do esqueleto dos 7 dias', async () => {
    const emHoraOp = (dia: string, h: number, min = 10) => new Date(Date.parse(`${dia}T00:00:00Z`) + ((h + 6) * 60 + min) * 60_000)
    const d7 = somarDias(D, -7)
    await gravarPedido(prisma, companyId, cru(50, emHoraOp(d7, 5), 'delivered'), AGORA) // 08h de Brasília
    await gravarPedido(prisma, companyId, cru(51, emHoraOp(d7, 22), 'delivered'), AGORA) // 01h da madrugada
    await gravarPedido(prisma, companyId, cru(52, emHoraOp(somarDias(D, -3), 12), 'abandoned'), AGORA) // abandonado não estica o eixo
    const hojeH: number[] = []
    for (const [k, min] of [10, 70, 130].entries()) {
      const t = antes(min)
      if (diaOperacional(iso(t)) !== D) continue
      await gravarPedido(prisma, companyId, cru(60 + k, t, 'delivered'), AGORA)
      hojeH.push(horaOperacional(t))
    }
    const d = await montarAoVivo(prisma, companyId, AGORA, { atualizado: null, guarda: new Map() })
    const ini = Math.min(5, ...hojeH), fim = Math.max(22, ...hojeH)
    const rot = (h: number) => `${String((h + 3) % 24).padStart(2, '0')}h`
    expect(d.curva.map((c) => c.hora)).toEqual(Array.from({ length: fim - ini + 1 }, (_, k) => rot(ini + k)))
    const hAtual = horaOperacional(AGORA)
    for (const [k, c] of d.curva.entries()) {
      const h = ini + k
      if (h > hAtual) expect(c.hojeCent, c.hora).toBeNull() // o futuro fica vazio, nunca zero
      else expect(c.hojeCent, c.hora).not.toBeNull()
    }
    expect(d.curva.filter((c) => c.atual).length).toBe(hAtual >= ini && hAtual <= fim ? 1 : 0)
    expect(d.agora).toMatch(/^\d{2}:\d{2}$/) // o traço "agora" mostra HH:MM completo
  })
})

describe('E3 · salão (mesa/comanda) não tem cronômetro de alarme', () => {
  it('pura: "aberta há" só no salão ativo', () => {
    const t0 = em('2026-11-11T15:00:00Z')
    expect(abertaHa('accepted', 'salon', t0, em('2026-11-11T16:15:00Z'))).toBe('aberta há 1h15')
    expect(abertaHa('ready', 'salon', t0, em('2026-11-11T15:40:00Z'))).toBe('aberta há 40min')
    expect(abertaHa('delivered', 'salon', t0, em('2026-11-11T16:15:00Z'))).toBeNull()
    expect(abertaHa('accepted', 'delivery', t0, em('2026-11-11T16:15:00Z'))).toBeNull()
    expect(abertaHa('accepted', 'number', t0, em('2026-11-11T16:15:00Z'))).toBeNull() // totem segue com cronômetro
  })
  it('no feed: mesa aberta há 75min = sem minutos e "aberta há 1h15"; tele segue com cronômetro', async () => {
    await gravarPedido(prisma, companyId, cru(70, antes(75), 'accepted', { order_type: 'salon', source: 'self_checkout' }), AGORA)
    await gravarPedido(prisma, companyId, cru(71, antes(30), 'accepted'), AGORA)
    const d = await montarAoVivo(prisma, companyId, AGORA, { atualizado: null, guarda: new Map() })
    const mesa = d.feed.find((p) => p.id === 70), tele = d.feed.find((p) => p.id === 71)
    if (diaOperacional(iso(antes(75))) === D) expect(mesa).toMatchObject({ minutos: null, aberta: 'aberta há 1h15' })
    else expect(mesa).toBeUndefined() // a virada das 03:00 caiu no meio: a mesa é do dia anterior
    expect(tele).toMatchObject({ minutos: 30, aberta: null })
  })
})
