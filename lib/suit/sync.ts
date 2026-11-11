// SUITAPI — O SINCRONIZADOR (10/11/2026). Lê a API (só GET) e espelha no banco.
//
// ⭐ IDEMPOTENTE: o pedido guarda `conteudo` (hash de tudo que a allowlist grava). Mesmo hash ⇒
//    só `vistoUltimoEm` anda; rodar 2× é o MESMO estado (teste: sync.integration.test.ts).
// ⛔ NADA É APAGADO EM SILÊNCIO: pedido que a API passa a responder 404 ganha `sumidoEm` e um
//    evento APAGADO; pedido cuja contribuição na régua muda ganha evento ALTERADO. Depois da
//    materialização do dia, o evento fica PENDENTE (decisão do dono); antes, é SEM_EFEITO
//    (a materialização já vai nascer com o estado novo).

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import type { ClienteSuitLeitura, PedidoDaLista, PedidoCru } from './cliente-leitura'
import { linhasDoPedido, linhaDoLancamento, contribuicao, diaOperacional } from './espelho'
import { centavos, somarDias, HORA_VIRADA_DIA } from './regua-sombra'

export const EVENTO_SEM_EFEITO = 'SEM_EFEITO'

/** "YYYY-MM-DDTHH:mm:ss" no relógio da API (UTC) */
export function relogioDaApi(agora: Date): string {
  return agora.toISOString().slice(0, 19)
}

export function hashConteudo(l: ReturnType<typeof linhasDoPedido>): string {
  const { pedido, itens, pagamentos } = l
  const canon = JSON.stringify({ pedido: { ...pedido, criadoApiEm: +pedido.criadoApiEm, entregueApiEm: pedido.entregueApiEm && +pedido.entregueApiEm, finalizadoApiEm: pedido.finalizadoApiEm && +pedido.finalizadoApiEm, agendadoPara: pedido.agendadoPara && +pedido.agendadoPara }, itens: itens.map((i) => ({ ...i, pedidoEm: i.pedidoEm && +i.pedidoEm, canceladoEm: i.canceladoEm && +i.canceladoEm })), pagamentos })
  return createHash('sha256').update(canon).digest('hex').slice(0, 32)
}

async function diaJaMaterializado(db: PrismaClient, companyId: string, dia: string): Promise<boolean> {
  return !!(await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { id: true } }))
}

export type ResultadoGravar = 'NOVO' | 'IGUAL' | 'ATUALIZADO'

/** grava UM pedido cru (allowlist). Devolve o que aconteceu. */
export async function gravarPedido(db: PrismaClient, companyId: string, cru: PedidoCru, agora: Date): Promise<ResultadoGravar> {
  const l = linhasDoPedido(cru)
  const conteudo = hashConteudo(l)
  const antes = await db.suitPedido.findUnique({
    where: { companyId_apiId: { companyId, apiId: cru.id } },
    select: { id: true, conteudo: true, impressao: true, dia: true, sumidoEm: true },
  })
  if (antes && antes.conteudo === conteudo && !antes.sumidoEm) {
    await db.suitPedido.update({ where: { id: antes.id }, data: { vistoUltimoEm: agora } })
    return 'IGUAL'
  }
  const posMaterializacao = await diaJaMaterializado(db, companyId, l.pedido.dia)
  await db.$transaction(async (tx) => {
    const dados = { ...l.pedido, conteudo, vistoUltimoEm: agora, sumidoEm: null }
    const p = antes
      ? await tx.suitPedido.update({ where: { id: antes.id }, data: dados, select: { id: true } })
      : await tx.suitPedido.create({ data: { companyId, ...dados, vistoPrimeiroEm: agora }, select: { id: true } })
    // filhos são ESPELHO (não ledger): reescritos inteiros quando o conteúdo muda
    await tx.suitPedidoItem.deleteMany({ where: { pedidoId: p.id } })
    await tx.suitPedidoPagamento.deleteMany({ where: { pedidoId: p.id } })
    for (const it of l.itens) {
      const { opcoes, ...item } = it
      await tx.suitPedidoItem.create({ data: { companyId, pedidoId: p.id, ...item, opcoes: { create: opcoes } } })
    }
    if (l.pagamentos.length) await tx.suitPedidoPagamento.createMany({ data: l.pagamentos.map((pg) => ({ companyId, pedidoId: p.id, ...pg })) })
    // ⭐ V11: pedido que NASCE num dia já entregue (fechado na mão antes da virada) — nunca silêncio
    if (!antes && posMaterializacao && l.pedido.impressao !== 'FORA') {
      const d = contribuicao(l.pedido.impressao)
      await tx.suitPedidoEvento.create({
        data: {
          companyId, pedidoId: p.id, apiId: cru.id, dia: l.pedido.dia, tipo: 'NOVO', detectadoEm: agora,
          impressaoAntes: 'FORA', impressaoDepois: l.pedido.impressao, deltaCent: d.cent, deltaUn: d.un,
          depoisDaMaterializacao: true, decisao: null,
        },
      })
    }
    if (antes && antes.impressao !== l.pedido.impressao) {
      const a = contribuicao(antes.impressao)
      const d = contribuicao(l.pedido.impressao)
      await tx.suitPedidoEvento.create({
        data: {
          companyId, pedidoId: p.id, apiId: cru.id, dia: l.pedido.dia, tipo: 'ALTERADO', detectadoEm: agora,
          impressaoAntes: antes.impressao, impressaoDepois: l.pedido.impressao,
          deltaCent: d.cent - a.cent, deltaUn: Math.round((d.un - a.un) * 1000) / 1000,
          depoisDaMaterializacao: posMaterializacao, decisao: posMaterializacao ? null : EVENTO_SEM_EFEITO,
        },
      })
    }
  })
  return antes ? 'ATUALIZADO' : 'NOVO'
}

/** a API respondeu 404 pra um pedido que ESTAVA gravado → sumidoEm + evento. Nunca DELETE. */
export async function marcarSumido(db: PrismaClient, companyId: string, apiId: number, agora: Date): Promise<boolean> {
  const p = await db.suitPedido.findUnique({ where: { companyId_apiId: { companyId, apiId } }, select: { id: true, impressao: true, dia: true, sumidoEm: true } })
  if (!p || p.sumidoEm) return false
  const pos = await diaJaMaterializado(db, companyId, p.dia)
  const c = contribuicao(p.impressao)
  await db.$transaction([
    db.suitPedido.update({ where: { id: p.id }, data: { sumidoEm: agora } }),
    db.suitPedidoEvento.create({
      data: {
        companyId, pedidoId: p.id, apiId, dia: p.dia, tipo: 'APAGADO', detectadoEm: agora,
        impressaoAntes: p.impressao, impressaoDepois: null, deltaCent: -c.cent, deltaUn: -c.un,
        depoisDaMaterializacao: pos, decisao: pos ? null : EVENTO_SEM_EFEITO,
      },
    }),
  ])
  return true
}

/** a "cara" de um pedido na LISTA bate com o gravado? (se não, busca o detalhe) */
function mesmaCara(l: PedidoDaLista, g: { status: string; produtosCent: number; totalCent: number; pago: boolean }): boolean {
  return l.status === g.status && centavos(l.products_total) === g.produtosCent && centavos(l.total) === g.totalCent && !!l.paid === g.pago
}

export interface RelatorioSync { listados: number; detalhes: number; novos: number; atualizados: number; iguais: number; sumidos: number }

/**
 * Um passo do laço: a janela [from, to] (relógio da API). `completo` = busca o detalhe de TODOS
 * (fechamento do dia / guarda) em vez de só os de cara nova.
 */
export async function sincronizarJanela(
  db: PrismaClient, cliente: ClienteSuitLeitura, companyId: string,
  from: string, to: string, agora: Date, completo = false,
): Promise<RelatorioSync> {
  const r: RelatorioSync = { listados: 0, detalhes: 0, novos: 0, atualizados: 0, iguais: 0, sumidos: 0 }
  const lista = await cliente.listar(from, to)
  r.listados = lista.length
  const dias = new Set<string>()
  for (let d = diaOperacional(from); d <= diaOperacional(to); d = somarDias(d, 1)) dias.add(d)
  const gravados = await db.suitPedido.findMany({
    where: { companyId, dia: { in: [...dias] }, sumidoEm: null },
    select: { apiId: true, status: true, produtosCent: true, totalCent: true, pago: true, criadoApiEm: true },
  })
  const porId = new Map(gravados.map((g) => [g.apiId, g]))
  const naLista = new Set<number>()
  for (const l of lista) {
    naLista.add(l.id)
    const g = porId.get(l.id)
    if (!completo && g && mesmaCara(l, g)) continue
    const d = await cliente.detalhe(l.id)
    r.detalhes++
    if (!d) { if (await marcarSumido(db, companyId, l.id, agora)) r.sumidos++; continue }
    const res = await gravarPedido(db, companyId, d, agora)
    if (res === 'NOVO') r.novos++
    else if (res === 'ATUALIZADO') r.atualizados++
    else r.iguais++
  }
  // gravado DENTRO da janela que a lista não trouxe → pergunta pelo id (404 = apagado no PDV)
  const fromD = new Date(`${from}Z`)
  const toD = new Date(`${to.slice(0, 23)}Z`)
  for (const g of gravados) {
    if (naLista.has(g.apiId) || g.criadoApiEm < fromD || g.criadoApiEm > toD) continue
    const d = await cliente.detalhe(g.apiId)
    r.detalhes++
    if (!d) { if (await marcarSumido(db, companyId, g.apiId, agora)) r.sumidos++; continue }
    const res = await gravarPedido(db, companyId, d, agora)
    if (res === 'ATUALIZADO') r.atualizados++
    else if (res === 'IGUAL') r.iguais++
  }
  return r
}

/** a janela operacional inteira de D, no relógio da API */
export function janelaOperacional(dia: string): { from: string; to: string } {
  return { from: `${dia}T${HORA_VIRADA_DIA}`, to: `${somarDias(dia, 1)}T05:59:59.999999` }
}

/** espelha os lançamentos financeiros que caem no dia operacional D (start_date D e D+1 — o
 *  filtro da API é a data UTC do created_at; medido 10/11). Upsert por id da API. */
export async function sincronizarLancamentos(db: PrismaClient, cliente: ClienteSuitLeitura, companyId: string, dia: string, agora: Date): Promise<number> {
  let n = 0
  for (const diaCaixa of [dia, somarDias(dia, 1)]) {
    for (const l of await cliente.lancamentos(diaCaixa)) {
      const linha = linhaDoLancamento(l, diaCaixa)
      if (linha.dia !== dia) continue
      await db.suitPagamento.upsert({
        where: { companyId_apiId: { companyId, apiId: l.id } },
        create: { companyId, ...linha, vistoUltimoEm: agora },
        update: { ...linha, vistoUltimoEm: agora },
      })
      n++
    }
  }
  return n
}
