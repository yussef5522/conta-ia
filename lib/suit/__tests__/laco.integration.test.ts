// SUITAPI — o laço inteiro contra um DIA REAL (08/11/2026, fixture pela allowlist, ids renumerados,
// sem dado pessoal), deslocado pra 15/11 (≥ corte). A Suit é um fake em memória que responde
// pela MESMA interface do cliente (listar / detalhe / lancamentos).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import fixture from '../__fixtures__/dia-2026-11-08.json'
import type { ClienteSuitLeitura, PedidoCru, LancamentoCru } from '../cliente-leitura'
import { sincronizarJanela, janelaOperacional } from '../sync'
import { materializarDia, DiaAbertoError, DiaForaDoCorteError, DiaJaTemImportError, linhasDoDia, CORTE_API } from '../materializar'
import { guardarDia } from '../guarda'
import { decidirDia } from '../decisao'
import { cicloDoLaco } from '../laco'
import { agregarApi, agregarXls, veredito, somarDias } from '../regua-sombra'
import { diaOperacional } from '../espelho'
import { processarVendas, DiaDaApiError } from '../../stock/vendas/baixa-venda'

const CNPJ = '15111511000115'
// ⛔ o dia do teste é RELATIVO ao relógio de quem roda (nunca data fixa no futuro): D = ontem
// (dia operacional) — sempre ≥ corte (09/11) e dentro dos 14 dias que a sanidade da esteira lê.
const D = [CORTE_API, somarDias(diaOperacional(new Date().toISOString().slice(0, 19)), -1)].sort().at(-1)!
const DESLOCA = Math.round((Date.parse(`${D}T00:00:00Z`) - Date.parse('2026-11-08T00:00:00Z')) / 86_400_000)
/** um instante do dia SEGUINTE a D, em UTC ("06:10" = 03:10 de Brasília) */
const em = (hhmm: string) => new Date(`${somarDias(D, 1)}T${hhmm}:00Z`)
const FECHA = em('06:10')
let companyId = ''

const mover = (s: string | null | undefined) => {
  if (!s) return s ?? null
  const dt = new Date(`${s.slice(0, 10)}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + DESLOCA)
  return dt.toISOString().slice(0, 10) + s.slice(10)
}
type Fx = { xls: { nomeSuitable: string; quantidade: number; valorTotal: number }[]; pedidos: PedidoCru[]; lancamentos: Record<string, LancamentoCru[]> }
const FX = fixture as unknown as Fx
const PEDIDOS: PedidoCru[] = FX.pedidos.map((p) => ({
  ...p, created_at: mover(p.created_at)!, delivered_at: mover(p.delivered_at), finished_at: mover(p.finished_at), scheduled_for: mover(p.scheduled_for),
  items: p.items.map((i) => ({ ...i, requested_at: mover(i.requested_at), cancelled_at: mover(i.cancelled_at) })),
}))
const LANC: Record<string, LancamentoCru[]> = Object.fromEntries(Object.entries(FX.lancamentos).map(([k, ls]) => [mover(k)!, ls.map((l) => ({ ...l, created_at: mover(l.created_at)! }))]))

/** a Suit de mentira — `apagados` responde 404 e some da lista.
 *  `semVarianteXis`: "Xis Completo" vira "XIS COMPLETO" (ver semearHistorico: a colisão antiga da sanidade) */
function suitFake(semVarianteXis = false) {
  const apagados = new Set<number>()
  const alterados = new Map<number, PedidoCru>()
  let req = 0
  const base = semVarianteXis ? PEDIDOS.map((p) => ({ ...p, items: p.items.map((i) => (i.name === 'Xis Completo' ? { ...i, name: 'XIS COMPLETO' } : i)) })) : PEDIDOS
  const atual = () => base.filter((p) => !apagados.has(p.id)).map((p) => alterados.get(p.id) ?? p)
  const c: ClienteSuitLeitura = {
    async listar(from, to) { req++; return atual().filter((p) => p.created_at >= from && p.created_at <= to).map((p) => ({ id: p.id, status: p.status, created_at: p.created_at, products_total: p.products_total, total: p.total, paid: p.paid })) },
    async detalhe(id) { req++; return atual().find((p) => p.id === id) ?? null },
    async lancamentos(dc) { req++; return LANC[dc] ?? [] },
    async pedidosDoDia() { throw new Error('não usado') },
    requisicoes: () => req,
  }
  return { c, apagados, alterados }
}

async function limpar() {
  const cs = await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })
  for (const { id } of cs) {
    await prisma.suitPedido.deleteMany({ where: { companyId: id } })
    for (const m of [prisma.suitPedidoEvento, prisma.suitPagamento, prisma.suitDiaMaterializado] as const) await (m as typeof prisma.suitPagamento).deleteMany({ where: { companyId: id } })
    await prisma.aviso.deleteMany({ where: { companyId: id } })
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}
beforeEach(async () => { await limpar(); companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'SUIT LACO' } })).id })
afterEach(limpar)

/** N dias ANTERIORES com as mesmas linhas do XLS — o histórico de 14 dias que a sanidade lê em prod */
async function semearHistorico(n: number) {
  for (let i = 1; i <= n; i++) {
    const data = new Date(`${somarDias(D, -i)}T12:00:00`)
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data, totalLinhas: FX.xls.length, totalUnidades: 661, status: 'CONFIRMADO' } })
    // ⚠️ sem a variante "Xis Completo": a sanidade da esteira indexa por trim+MAIÚSCULA e funde
    // "XIS COMPLETO"/"Xis Completo" (o último do groupBy vence — dívida ANTIGA da esteira, fora
    // deste sprint, que em prod hoje não morde por sorte de ordenação). Aqui a ordem não decide.
    await prisma.stockVendaLinha.createMany({ data: FX.xls.filter((l) => l.nomeSuitable !== 'Xis Completo').map((l) => ({ companyId, importId: imp.id, data, nomeSuitable: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: false })) })
  }
}

async function espelharDia(c: ClienteSuitLeitura, agora = FECHA) {
  const { from, to } = janelaOperacional(D)
  return sincronizarJanela(prisma, c, companyId, from, to, agora, true)
}
const ordenar = <T extends { produto: string }>(xs: T[]) => [...xs].sort((a, b) => a.produto.localeCompare(b.produto))

describe('⭐ o dia real 08/11 pela API = o XLS do dia, BYTE A BYTE, pela esteira', () => {
  it('a régua do laço é a régua PROVADA: agregarApi(fixture) × XLS = BATE', () => {
    const v = veredito(D, agregarApi(PEDIDOS.map((p) => ({ id: p.id, status: p.status, items: p.items }))), agregarXls(FX.xls))
    expect(v.startsWith(`${D} BATE 661un R$22.430,42`)).toBe(true)
  })

  it('espelha → materializa → a esteira recebe EXATAMENTE as linhas do XLS', async () => {
    const { c } = suitFake()
    await espelharDia(c)
    const r = await materializarDia(prisma, companyId, D, FECHA)
    expect(r.status).toBe('MATERIALIZADO')
    if (r.status !== 'MATERIALIZADO') return
    expect(r.totalCent).toBe(2243042)
    expect(r.unidades).toBe(661)
    const gravadas = await prisma.stockVendaLinha.findMany({ where: { companyId, importId: r.importId }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } })
    const daApi = JSON.stringify(ordenar(gravadas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal }))))
    const doXls = JSON.stringify(ordenar(FX.xls.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal }))))
    expect(daApi).toBe(doXls) // ⛔ byte a byte: nome (grafia do XLS), quantidade, valor
    const arq = await prisma.stockVendaArquivo.findFirst({ where: { companyId, relatorio: 'PRODUTOS' }, select: { nomeArquivo: true, somaValor: true, linhasArquivo: true } })
    expect(arq).toMatchObject({ nomeArquivo: `SuitAPI · pedidos de ${D}`, somaValor: 22430.42, linhasArquivo: 106 })
  }, 120_000)
})

describe('⭐ upsert IDEMPOTENTE: rodar 2× = o mesmo estado', () => {
  it('2ª passada: tudo IGUAL, mesmos ids, 0 eventos, 0 linhas a mais', async () => {
    const { c } = suitFake()
    const r1 = await espelharDia(c)
    const foto = async () => ({
      pedidos: (await prisma.suitPedido.findMany({ where: { companyId }, select: { id: true, conteudo: true }, orderBy: { apiId: 'asc' } })),
      itens: await prisma.suitPedidoItem.count({ where: { companyId } }),
      opcoes: await prisma.suitItemOpcao.count({ where: { item: { companyId } } }),
      pag: await prisma.suitPedidoPagamento.count({ where: { companyId } }),
      ev: await prisma.suitPedidoEvento.count({ where: { companyId } }),
    })
    const a = await foto()
    const r2 = await espelharDia(c)
    expect(r1.novos).toBe(366)
    expect(r2).toMatchObject({ novos: 0, atualizados: 0, sumidos: 0, iguais: 366 })
    expect(await foto()).toEqual(a)
    expect(a.ev).toBe(0)
  }, 120_000)
})

describe('⭐ pedido que MUDA na Suit: o espelho troca, nunca acumula', () => {
  it('item cancelado depois de gravado → itens/opções/pagamentos do pedido = os da Suit agora (sem duplicar) + evento ALTERADO', async () => {
    const s = suitFake()
    await espelharDia(s.c, em('05:00'))
    const alvo = PEDIDOS.find((p) => p.items.filter((i) => !i.cancelled_at).length >= 2 && (p.payment?.methods?.length ?? 0) >= 1)!
    const mudado: PedidoCru = { ...alvo, items: alvo.items.map((i, k) => (k === 0 ? { ...i, cancelled_at: `${somarDias(D, 1)}T04:00:00` } : i)) }
    s.alterados.set(alvo.id, mudado)
    const r = await espelharDia(s.c)
    expect(r.atualizados).toBe(1)
    const ped = await prisma.suitPedido.findFirst({ where: { companyId, apiId: alvo.id }, select: { id: true } })
    expect(await prisma.suitPedidoItem.count({ where: { pedidoId: ped!.id } })).toBe(mudado.items.length)
    expect(await prisma.suitItemOpcao.count({ where: { item: { pedidoId: ped!.id } } })).toBe(mudado.items.reduce((t, i) => t + (i.options?.length ?? 0), 0))
    expect(await prisma.suitPedidoPagamento.count({ where: { pedidoId: ped!.id } })).toBe(mudado.payment!.methods!.length)
    const ev = await prisma.suitPedidoEvento.findMany({ where: { companyId, apiId: alvo.id } })
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ tipo: 'ALTERADO', decisao: 'SEM_EFEITO', deltaCent: -Math.round(Number(alvo.items[0].price) * 100) })
  }, 120_000)
})

describe('⛔ as travas da materialização', () => {
  it('dia ABERTO não materializa (06:09Z ainda é o dia aberto)', async () => {
    await expect(materializarDia(prisma, companyId, D, em('06:09'))).rejects.toThrow(DiaAbertoError)
    expect(await prisma.stockVendaImport.count({ where: { companyId } })).toBe(0)
  })
  it('dia antes do corte (≤08/11 é XLS) não materializa', async () => {
    await expect(materializarDia(prisma, companyId, '2026-11-08', FECHA)).rejects.toThrow(DiaForaDoCorteError)
  })
  it('dia que JÁ TEM import (arquivo) não é sobrescrito pela API', async () => {
    await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${D}T12:00:00`), totalLinhas: 1, totalUnidades: 1, status: 'CONFIRMADO' } })
    await expect(materializarDia(prisma, companyId, D, FECHA)).rejects.toThrow(DiaJaTemImportError)
  })
  it('…a não ser por ordem EXPLÍCITA (substituirXls): a esteira troca o arquivo pela Suit', async () => {
    const html = '<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr><tr><td>XIS</td><td>1</td><td>R$ 0,00</td><td>R$ 10,00</td></tr></table></body></html>'
    await semearHistorico(3)
    await processarVendas(companyId, D, html, 'u1', prisma, null, false, [], 'parcial.xls')
    const { c } = suitFake()
    await espelharDia(c)
    const r = await materializarDia(prisma, companyId, D, FECHA, { substituirXls: true })
    expect(r).toMatchObject({ status: 'MATERIALIZADO', totalCent: 2243042, linhas: 106 })
    expect(await prisma.stockVendaImport.count({ where: { companyId, data: new Date(`${D}T12:00:00`) } })).toBe(1) // o MESMO import do dia, reprocessado
    const linhas = await prisma.stockVendaLinha.count({ where: { companyId, importId: r.status === 'MATERIALIZADO' ? r.importId : '' } })
    expect(linhas).toBe(106)
  }, 120_000)
  it('já materializado → JA_FEITO (não refaz sozinho)', async () => {
    const { c } = suitFake()
    await espelharDia(c)
    await materializarDia(prisma, companyId, D, FECHA)
    expect((await materializarDia(prisma, companyId, D, FECHA)).status).toBe('JA_FEITO')
  }, 120_000)
})

describe('⭐ a GUARDA do dono (a/b/c) e a decisão', () => {
  it('dia limpo: (a) BATE ao centavo · (b) o caixa da Suit FECHA com os pedidos, resto 0 · (c) nada pendente', async () => {
    const { c } = suitFake()
    await espelharDia(c)
    await materializarDia(prisma, companyId, D, FECHA)
    const g = await guardarDia(prisma, c, companyId, D, em('10:00'))
    expect(g.a).toMatchObject({ veredito: 'BATE', apiCent: 2243042, esteiraCent: 2243042, restoCent: 0, restoUn: 0 })
    expect(g.b).toMatchObject({ veredito: 'FECHA', lancamentosCent: 2342550, pedidosCent: 2342550, restoCent: 0, reguaCent: 2243042, entregaCent: 108900, descontoCent: 9632, adicionalCent: 240, taxaCent: 7252, aPrazoCent: 0 })
    expect(g.b.reguaCent + g.b.entregaCent - g.b.descontoCent + g.b.adicionalCent + g.b.servicoCent).toBe(g.b.pedidosCent) // a identidade medida
    expect(g.c.pendentes).toBe(0)
  }, 180_000)

  it('⛔ pedido APAGADO depois de entrar → evento pendente + aviso "manter ou atualizar"; ATUALIZAR refaz o dia', async () => {
    await semearHistorico(3)
    const s = suitFake(true)
    await espelharDia(s.c)
    await materializarDia(prisma, companyId, D, FECHA)
    const vitima = PEDIDOS.find((p) => p.status === 'delivered' && p.items.some((i) => !i.cancelled_at))!
    const valor = vitima.items.filter((i) => !i.cancelled_at).reduce((t, i) => t + Math.round(Number(i.price) * 100), 0)
    s.apagados.add(vitima.id)
    const g = await guardarDia(prisma, s.c, companyId, D, em('10:00'))
    expect(g.c).toEqual({ pendentes: 1, deltaCent: -valor })
    expect(g.a).toMatchObject({ veredito: 'BATE', restoCent: 0, eventosCent: -valor }) // a diferença é NOMEADA pelo evento
    const ped = await prisma.suitPedido.findFirst({ where: { companyId, apiId: vitima.id }, select: { sumidoEm: true } })
    expect(ped?.sumidoEm).not.toBeNull() // ⛔ nunca removido
    const aviso = await prisma.aviso.findFirst({ where: { companyId, origem: 'SUIT_PEDIDO_MUDOU', alvo: D, resolvidoEm: null } })
    expect(aviso?.acaoHref).toBe(`/empresas/${companyId}/estoque/vendas/suit?dia=${D}`)

    const r = await decidirDia(prisma, companyId, D, 'ATUALIZAR', 'u1', em('11:00'))
    expect(r.eventos).toBe(1)
    expect(r.reentrega).toMatchObject({ status: 'MATERIALIZADO', totalCent: 2243042 - valor })
    expect(await prisma.suitPedidoEvento.count({ where: { companyId, decisao: null } })).toBe(0)
    expect(await prisma.aviso.count({ where: { companyId, origem: 'SUIT_PEDIDO_MUDOU', resolvidoEm: null } })).toBe(0)
  }, 240_000)

  it('⛔ ATUALIZAR quando a esteira PERGUNTA (sanidade): o dia fica ESPERANDO o dono — a máquina nunca responde por ele', async () => {
    const s = suitFake()
    await espelharDia(s.c)
    await materializarDia(prisma, companyId, D, FECHA) // sem histórico: o próprio dia vira a régua do "normal"
    s.apagados.add(PEDIDOS.find((p) => p.status === 'delivered')!.id)
    await espelharDia(s.c, em('09:00'))
    const r = await decidirDia(prisma, companyId, D, 'ATUALIZAR', 'u1', em('11:00'))
    expect(r.reentrega?.status).toBe('AGUARDANDO_DONO')
    expect((await prisma.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: D } } }))?.status).toBe('AGUARDANDO_DONO')
  }, 180_000)

  it('MANTER: o dia fica como entrou e o evento sai da fila', async () => {
    const s = suitFake()
    await espelharDia(s.c)
    const m = await materializarDia(prisma, companyId, D, FECHA)
    s.apagados.add(PEDIDOS.find((p) => p.status === 'delivered')!.id)
    await espelharDia(s.c, em('09:00'))
    await decidirDia(prisma, companyId, D, 'MANTER', 'u1', em('11:00'))
    const dm = await prisma.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: D } } })
    expect(dm?.totalCent).toBe(m.status === 'MATERIALIZADO' ? m.totalCent : -1)
    expect((await linhasDoDia(prisma, companyId, D)).totalCent).toBeLessThan(dm!.totalCent) // o espelho sabe; o dia não mudou
    expect(await prisma.suitPedidoEvento.count({ where: { companyId, decisao: 'MANTER' } })).toBe(1)
  }, 180_000)

  it('pedido apagado ANTES do fechamento: fica fora da materialização e o evento é SEM_EFEITO (sem aviso)', async () => {
    const s = suitFake()
    await espelharDia(s.c, em('05:00'))
    s.apagados.add(PEDIDOS.find((p) => p.status === 'delivered')!.id)
    await espelharDia(s.c)
    const r = await materializarDia(prisma, companyId, D, FECHA)
    expect(r.status === 'MATERIALIZADO' && r.totalCent).toBeLessThan(2243042)
    expect(await prisma.suitPedidoEvento.count({ where: { companyId, decisao: 'SEM_EFEITO', tipo: 'APAGADO' } })).toBe(1)
    expect(await prisma.suitPedidoEvento.count({ where: { companyId, decisao: null } })).toBe(0)
  }, 180_000)
})

describe('⛔ XLS por cima do dia da API: recusa sem confirmação explícita', () => {
  const html = '<html><body><table><tr><td>Produto</td><td>Quantidade</td><td>Valor Extra</td><td>Valor total</td></tr><tr><td>XIS</td><td>1</td><td>R$ 0,00</td><td>R$ 10,00</td></tr></table></body></html>'
  it('sem confirmar → DiaDaApiError e NADA muda; confirmando → entra e o dia vira XLS_POR_CIMA', async () => {
    const { c } = suitFake()
    await espelharDia(c)
    const m = await materializarDia(prisma, companyId, D, FECHA)
    await expect(processarVendas(companyId, D, html, 'u1', prisma)).rejects.toThrow(DiaDaApiError)
    const imp = m.status === 'MATERIALIZADO' ? m.importId : ''
    expect(await prisma.stockVendaLinha.count({ where: { companyId, importId: imp } })).toBe(106)
    await processarVendas(companyId, D, html, 'u1', prisma, null, false, [], 'arquivo.xls', true)
    expect(await prisma.stockVendaLinha.count({ where: { companyId, importId: imp } })).toBe(1)
    expect((await prisma.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: D } } }))?.status).toBe('XLS_POR_CIMA')
  }, 180_000)
})

describe('o CICLO do laço: fecha o dia só depois das 03:10 e roda a guarda depois das 07:00', () => {
  it('⛔ dia que já tem arquivo: o ciclo recusa SEM chamar a API (orçamento de requisições)', async () => {
    const { c } = suitFake()
    await cicloDoLaco(prisma, c, companyId, em('06:05'), () => false, (e) => (e as Error).name) // janela viva já espelhada
    await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${D}T12:00:00`), totalLinhas: 1, totalUnidades: 1, status: 'CONFIRMADO' } })
    const r0 = c.requisicoes()
    const ciclo = await cicloDoLaco(prisma, c, companyId, FECHA, () => false, (e) => (e as Error).name)
    expect(ciclo.fechados.find((f) => f.dia === D)?.resultado).toMatchObject({ status: 'ERRO', erro: 'DiaJaTemImportError' })
    expect(c.requisicoes() - r0).toBe(1) // só a LISTA da janela viva — nenhum sync completo (seriam 366+ detalhes)
  }, 120_000)

  it('antes das 03:10 nada entra; às 03:10 o dia entra; às 07:00 a guarda roda', async () => {
    const { c } = suitFake()
    const feitas = new Set<string>()
    const nome = (e: unknown) => (e as Error).name
    const c1 = await cicloDoLaco(prisma, c, companyId, em('05:30'), (d) => feitas.has(d), nome)
    expect(c1.fechados.filter((f) => f.dia === D)).toEqual([])
    const c2 = await cicloDoLaco(prisma, c, companyId, FECHA, (d) => feitas.has(d), nome)
    expect(c2.fechados.find((f) => f.dia === D)?.resultado.status).toBe('MATERIALIZADO')
    expect(c2.guarda).toBeNull()
    const c3 = await cicloDoLaco(prisma, c, companyId, em('10:01'), (d) => feitas.has(d), nome)
    expect(c3.guarda?.dia).toBe(D)
    expect(c3.guarda?.a.veredito).toBe('BATE')
  }, 300_000)
})
