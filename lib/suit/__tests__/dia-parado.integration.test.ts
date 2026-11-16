/**
 * ⭐⭐ O DIA PARADO NA TRAVA, A GUARDA DA BAIXA E O DESTRAVE PELA CONTAGEM (16/11/2026) — EXECUTADO.
 *
 * Fase 2 · o dia que cai na trava fica INTEIRO retido (nada de import/linha/baixa), a pergunta vira
 *          aviso vermelho, a contagem tranca, e a resposta do dono materializa o dia inteiro.
 *        · o "normal" soma os gêmeos de grafia (o "normal é 1" de domingo 15/11).
 * Fase 3 · a guarda diária: vendido × baixado item a item + vendas sem vínculo → avisos; dia certo cala.
 * Fase 1 · o meio-estado legado se resolve pela CONTAGEM: item contado desde D 06:00 não baixa; o resto
 *          baixa datado em D; rodar 2× não duplica.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { materializarDia } from '../materializar'
import { medirSanidade } from '../../stock/vendas/medir-sanidade'
import { responderDiaParado, ORIGEM_DIA_PARADO, DiaMeioGravadoError } from '../dia-parado'
import { portaoDaContagem } from '../ao-vivo'
import { cicloDoLaco } from '../laco'
import type { ClienteSuitLeitura } from '../cliente-leitura'
import { upsertVendaMap } from '../../stock/vendas/venda-map'
import { conferirBaixaDoDia, guardarBaixaDoDia, ORIGEM_BAIXA_FURADA, ORIGEM_SEM_VINCULO } from '../../stock/vendas/guarda-da-baixa'
import { estornarMovimento } from '../../stock/movement'
import { destravarDiaParadoPelaContagem, planoDoDiaParado, STATUS_RESOLVIDO_PELA_CONTAGEM, DiaNaoDestravavelError } from '../../stock/vendas/destravar-dia-parado'

const CNPJ = '16111611000116'
const D = '2026-11-12'
const FECHA = new Date('2026-11-13T06:20:00Z') // 03:20 de Brasília do dia seguinte: D fechado
let companyId = ''
let xisId = ''
let cocaId = ''

async function limpar() {
  const cs = await prisma.company.findMany({ where: { cnpj: CNPJ }, select: { id: true } })
  for (const { id } of cs) {
    await prisma.suitPedido.deleteMany({ where: { companyId: id } })
    await prisma.stockVendaComplementoLinha.deleteMany({ where: { companyId: id } })
    await prisma.suitDiaMaterializado.deleteMany({ where: { companyId: id } })
    await prisma.aviso.deleteMany({ where: { companyId: id } })
    for (const t of ['stockMovement', 'stockSaldoCache', 'stockVendaLinha', 'stockVendaImport', 'stockVendaProdutoMap', 'stockItem'] as const) {
      await (prisma[t] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { companyId: id } })
    }
  }
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
}

beforeEach(async () => {
  await limpar()
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'DIA PARADO' } })).id
  const item = (nome: string) => prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' } })
  xisId = (await item('XIS PRONTO')).id
  cocaId = (await item('COCA-COLA  2L')).id
  for (const id of [xisId, cocaId]) await prisma.stockMovement.create({ data: { companyId, itemId: id, tipo: 'ENTRADA_NF', quantidade: 500, custoUnitario: 5, custoTotal: 2500, origem: 'SEFAZ' } })
  await upsertVendaMap(companyId, 'XIS COMPLETO', { tipo: 'REVENDA', itemId: xisId }, 'u', prisma)
  await upsertVendaMap(companyId, 'COCA COLA 2L', { tipo: 'REVENDA', itemId: cocaId }, 'u', prisma)
})
afterEach(limpar)

/** N dias ANTES de D, com as linhas dadas (o histórico que a sanidade lê) */
async function historico(linhas: [string, number][], dias = 6) {
  for (let i = 1; i <= dias; i++) {
    const d = new Date(Date.UTC(2026, 10, 12, 15) - i * 86_400_000)
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data: d, totalLinhas: linhas.length, totalUnidades: linhas.reduce((t, l) => t + l[1], 0), status: 'CONFIRMADO' } })
    await prisma.stockVendaLinha.createMany({ data: linhas.map(([nome, q]) => ({ companyId, importId: imp.id, data: d, nomeSuitable: nome, quantidade: q, valorTotal: q * 20 })) })
  }
}

/** o dia D no espelho da Suit: um pedido com os itens dados */
async function vendasDoDia(itens: [string, number][]) {
  await prisma.suitPedido.create({
    data: {
      companyId, apiId: 1, dia: D, status: 'delivered', criadoApiEm: new Date(`${D}T18:00:00Z`),
      produtosCent: 0, entregaCent: 0, servicoCent: 0, descontoCent: 0, adicionalCent: 0, totalCent: 0, pago: true, impressao: 'h', conteudo: 'h',
      itens: { create: itens.map(([nome, q], k) => ({ companyId, apiItemId: k + 1, nome, quantidade: q, unitarioCent: 2000, precoCent: 2000 * q })) },
    },
  })
}

const contar = async () => ({
  imports: await prisma.stockVendaImport.count({ where: { companyId, data: new Date(`${D}T12:00:00`) } }),
  linhas: await prisma.stockVendaLinha.count({ where: { companyId, data: new Date(`${D}T12:00:00`) } }),
  baixas: await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } }),
})

describe('FASE 2 — a trava NUNCA mais para o dia em silêncio, nem pela metade', () => {
  it('⛔ dia que cai na trava fica INTEIRO retido: zero import, zero linha, zero baixa; aviso vermelho; contagem trancada', async () => {
    await historico([['XIS COMPLETO', 2], ['COCA COLA 2L', 10]])
    await vendasDoDia([['XIS COMPLETO', 88], ['COCA COLA 2L', 12]])
    const r = await materializarDia(prisma, companyId, D, FECHA)
    expect(r).toMatchObject({ status: 'AGUARDANDO_DONO', importId: null })
    expect((r as { motivo: string }).motivo).toBe('XIS COMPLETO: 88 num dia — o normal é 2. Confirma?')
    expect(await contar()).toEqual({ imports: 0, linhas: 0, baixas: 0 })
    const av = await prisma.aviso.findFirst({ where: { companyId, origem: ORIGEM_DIA_PARADO, alvo: D, resolvidoEm: null } })
    expect(av).toMatchObject({ severidade: 'vermelho', acaoRotulo: 'Responder agora' })
    expect(av!.corpo).toContain('XIS COMPLETO: 88 num dia')
    expect(await portaoDaContagem(prisma, companyId, FECHA)).toEqual({ liberada: false, dia: D })
  })

  it('⭐ a resposta do dono materializa o dia INTEIRO (vendas + baixas juntas) e cala o aviso', async () => {
    await historico([['XIS COMPLETO', 2], ['COCA COLA 2L', 10]])
    await vendasDoDia([['XIS COMPLETO', 88], ['COCA COLA 2L', 12]])
    await materializarDia(prisma, companyId, D, FECHA)
    const r = await responderDiaParado(prisma, companyId, D, new Date('2026-11-13T12:00:00Z'))
    expect(r.produtos.status).toBe('MATERIALIZADO')
    expect(await contar()).toEqual({ imports: 1, linhas: 2, baixas: 2 })
    const row = await prisma.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia: D } } })
    expect(row?.status).toBe('MATERIALIZADO')
    expect(row?.motivo).toMatch(/^confirmado pelo dono em 13\/11 às \d\d:\d\d$/)
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_DIA_PARADO, resolvidoEm: null } })).toBe(0)
    expect(await portaoDaContagem(prisma, companyId, FECHA)).toEqual({ liberada: true, dia: null })
  })

  it('⭐ o "normal" soma os GÊMEOS de grafia: 88 XIS num dia em que XIS COMPLETO + Xis Completo dão ~41/dia NÃO para', async () => {
    await historico([['XIS COMPLETO', 40], ['Xis Completo', 1], ['COCA COLA 2L', 10]])
    await vendasDoDia([['XIS COMPLETO', 88], ['COCA COLA 2L', 12]])
    expect((await materializarDia(prisma, companyId, D, FECHA)).status).toBe('MATERIALIZADO')
  })

  it('⛔ o laço NÃO materializa os sabores de um dia parado (o dia fica retido inteiro)', async () => {
    await historico([['XIS COMPLETO', 2]])
    await vendasDoDia([['XIS COMPLETO', 88]])
    await prisma.suitItemOpcao.create({ data: { itemId: (await prisma.suitPedidoItem.findFirstOrThrow({ where: { companyId } })).id, ordem: 0, nome: 'CALABRESA', quantidade: 1, unitarioCent: 0, precoCent: 0 } })
    await materializarDia(prisma, companyId, D, FECHA)
    const suit: ClienteSuitLeitura = {
      async listar() { return [] }, async detalhe() { return null }, async lancamentos() { return [] },
      async pedidosDoDia() { return [] }, requisicoes: () => 0,
    } as unknown as ClienteSuitLeitura
    // ⚠️ o laço roda DOIS dias depois: D fica fora da janela viva (o espelho de teste não é tocado) e dentro da recuperação
    const c = await cicloDoLaco(prisma, suit, companyId, new Date('2026-11-15T06:20:00Z'), () => true, (e) => String((e as Error)?.name))
    expect(c.complementos.find((x) => x.dia === D)).toBeUndefined()
    expect(await prisma.stockVendaComplementoLinha.count({ where: { companyId } })).toBe(0)
  })

  it('⛔ a janela do "normal" termina ANTES do dia julgado: o próprio dia ruim (num reprocesso) não esconde o alarme', async () => {
    await historico([['XIS COMPLETO', 2]])
    // o import RUIM do próprio D já gravado (reprocesso): 600 xis
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${D}T12:00:00`), totalLinhas: 1, totalUnidades: 600, status: 'CONFIRMADO' } })
    await prisma.stockVendaLinha.create({ data: { companyId, importId: imp.id, data: new Date(`${D}T12:00:00`), nomeSuitable: 'XIS COMPLETO', quantidade: 600, valorTotal: 0 } })
    const r = await medirSanidade(companyId, [{ produto: 'XIS COMPLETO', quantidade: 600 }], prisma, D)
    expect(r.precisaConfirmar).toBe(true)
    expect(r.suspeitas[0].frase).toBe('XIS COMPLETO: 600 num dia — o normal é 2. Confirma?')
  })

  it('⛔ o meio-estado LEGADO não se resolve pelo botão (confirmar baixaria em cima da contagem)', async () => {
    await vendasDoDia([['XIS COMPLETO', 88]])
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${D}T12:00:00`), totalLinhas: 1, totalUnidades: 88, status: 'CONFIRMADO' } })
    await prisma.suitDiaMaterializado.create({ data: { companyId, dia: D, status: 'AGUARDANDO_DONO', importId: imp.id, pedidos: 1, linhas: 1, unidades: 88, totalCent: 0, motivo: 'x', materializadoEm: FECHA, atualizadoEm: FECHA } })
    await expect(responderDiaParado(prisma, companyId, D, FECHA)).rejects.toBeInstanceOf(DiaMeioGravadoError)
  })
})

describe('FASE 3 — a guarda diária da baixa', () => {
  it('dia certo: BATE e nenhum aviso; furo plantado (baixa estornada) → aviso com a lista; e as vendas sem vínculo', async () => {
    await vendasDoDia([['XIS COMPLETO', 5], ['COCA COLA 2L', 3], ['MAIONESE CASEIRA', 4]])
    expect((await materializarDia(prisma, companyId, D, FECHA)).status).toBe('MATERIALIZADO')
    const ok = await guardarBaixaDoDia(companyId, D, prisma)
    expect(ok.status).toBe('BATE')
    expect(ok.semVinculo).toEqual([{ nome: 'MAIONESE CASEIRA', qtd: 4, tipo: 'PRODUTO' }])
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_BAIXA_FURADA, resolvidoEm: null } })).toBe(0)
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_SEM_VINCULO, alvo: D, resolvidoEm: null } })).toBe(1)

    // ⛔ o FURO plantado: a baixa da coca some do razão (estorno)
    const b = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, itemId: cocaId, tipo: 'BAIXA_VENDA' } })
    await prisma.$transaction((tx) => estornarMovimento(tx, b.id, { criadoPorId: 'u' }))
    const furo = await guardarBaixaDoDia(companyId, D, prisma)
    expect(furo.status).toBe('FURO')
    expect(furo.furos.map((f) => [f.nome, f.vendido, f.baixado, f.buraco, f.rs])).toEqual([['COCA-COLA  2L', 3, 0, 3, 15]])
    const av = await prisma.aviso.findFirstOrThrow({ where: { companyId, origem: ORIGEM_BAIXA_FURADA, alvo: D, resolvidoEm: null } })
    expect(av.corpo).toContain('COCA-COLA  2L · vendido 3 · baixado 0 · faltou baixar 3')
    // rodar de novo não abre outro aviso (idempotente por dia)
    await guardarBaixaDoDia(companyId, D, prisma)
    expect(await prisma.aviso.count({ where: { companyId, origem: ORIGEM_BAIXA_FURADA, alvo: D } })).toBe(1)
  })

  it('dia retido na trava: a guarda não grita por cima (o aviso dele é o do dia parado)', async () => {
    await historico([['XIS COMPLETO', 2]])
    await vendasDoDia([['XIS COMPLETO', 88]])
    await materializarDia(prisma, companyId, D, FECHA)
    expect((await conferirBaixaDoDia(companyId, D, prisma)).status).toBe('DIA_PARADO')
  })
})

describe('FASE 1 — o meio-estado legado pela REGRA DA CONTAGEM', () => {
  async function meioEstado() {
    await vendasDoDia([['XIS COMPLETO', 88], ['COCA COLA 2L', 28]])
    const imp = await prisma.stockVendaImport.create({ data: { companyId, data: new Date(`${D}T12:00:00`), totalLinhas: 2, totalUnidades: 116, status: 'CONFIRMADO' } })
    await prisma.stockVendaLinha.createMany({ data: [['XIS COMPLETO', 88], ['COCA COLA 2L', 28]].map(([n, q]) => ({ companyId, importId: imp.id, data: new Date(`${D}T12:00:00`), nomeSuitable: n as string, quantidade: q as number, valorTotal: 0 })) })
    await prisma.suitDiaMaterializado.create({ data: { companyId, dia: D, status: 'AGUARDANDO_DONO', importId: imp.id, pedidos: 1, linhas: 2, unidades: 116, totalCent: 0, motivo: 'XIS COMPLETO: 88 num dia — o normal é 1. Confirma?', materializadoEm: FECHA, atualizadoEm: FECHA } })
    // o dono CONTOU a coca no dia seguinte (−28)
    await prisma.stockMovement.create({ data: { companyId, itemId: cocaId, tipo: 'AJUSTE_CONTAGEM', quantidade: -28, custoUnitario: 5, custoTotal: -140, origem: 'MANUAL', dataMovimento: new Date('2026-11-13T14:00:00Z') } })
    return imp.id
  }

  it('item contado desde D 06:00 NÃO ganha baixa; o resto baixa datado em D; o dia sai RESOLVIDO; 2ª rodada recusa', async () => {
    const importId = await meioEstado()
    const p = await planoDoDiaParado(companyId, D, prisma)
    expect(p.aplicar.map((a) => [a.nome, a.qtd])).toEqual([['XIS PRONTO', 88]])
    expect(p.cobertos.map((a) => [a.nome, a.qtd, a.tipo])).toEqual([['COCA-COLA  2L', 28, 'AJUSTE_CONTAGEM']])
    const r = await destravarDiaParadoPelaContagem(companyId, D, '2026-11-16', prisma)
    expect(r.movimentos).toBe(1)
    const baixas = await prisma.stockMovement.findMany({ where: { companyId, tipo: 'BAIXA_VENDA' }, select: { itemId: true, quantidade: true, receiptId: true, dataMovimento: true } })
    expect(baixas).toEqual([{ itemId: xisId, quantidade: -88, receiptId: importId, dataMovimento: new Date(`${D}T12:00:00`) }])
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: cocaId, tipo: 'BAIXA_VENDA' } })).toBe(0) // ⛔ coberta pela contagem
    const row = await prisma.suitDiaMaterializado.findUniqueOrThrow({ where: { companyId_dia: { companyId, dia: D } } })
    expect(row.status).toBe(STATUS_RESOLVIDO_PELA_CONTAGEM)
    expect(row.motivo).toBe('baixa do dia parado, aplicada em 16/11: 1 itens baixados · 1 cobertos por contagem (não baixados)')
    // o buraco do dia: só o coberto pela contagem sobra (e ele é conhecido)
    const g = await conferirBaixaDoDia(companyId, D, prisma)
    expect(g.furos.map((f) => [f.nome, f.buraco])).toEqual([['COCA-COLA  2L', 28]])
    await expect(destravarDiaParadoPelaContagem(companyId, D, '2026-11-16', prisma)).rejects.toBeInstanceOf(DiaNaoDestravavelError)
    expect(await prisma.stockMovement.count({ where: { companyId, tipo: 'BAIXA_VENDA' } })).toBe(1)
  })

  it('contagem de ANTES do dia não cobre: baixa', async () => {
    await meioEstado()
    await prisma.stockMovement.updateMany({ where: { companyId, tipo: 'AJUSTE_CONTAGEM' }, data: { dataMovimento: new Date(`${D}T08:00:00Z`) } }) // 05:00 de Brasília de D
    const p = await planoDoDiaParado(companyId, D, prisma)
    expect(p.aplicar.map((a) => a.nome).sort()).toEqual(['COCA-COLA  2L', 'XIS PRONTO'])
  })
})
