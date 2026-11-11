// SUITAPI — A GUARDA DIÁRIA DO DONO (10/11/2026). Substitui a prova-sombra. Todo dia, pra D-1:
//
//  (a) RECONTAGEM: a régua PROVADA (`agregarApi`, a mesma da sombra, intocada) sobre os detalhes
//      que a API devolve AGORA × o que foi entregue à esteira (StockVendaLinha do import do dia)
//      — ao centavo. Diferença explicada pelos eventos pendentes (apagado/alterado) é nomeada.
//  (b) CRUZAMENTO INDEPENDENTE: os lançamentos financeiros do PDV (financial/payments/list) ×
//      o dinheiro dos pedidos. Identidade medida em 08/11 (ao centavo, resto 0):
//          Σ lançamentos de venda = régua + entrega − desconto + adicional + serviço
//      Nomeadas: taxa da maquininha (fica no líquido) e a prazo (status ≠ paid). Resto tem que ser 0.
//  (c) EVENTOS: pedido apagado/alterado DEPOIS da materialização → aviso "manter ou atualizar?".
//  (d) BATIMENTO: o sync parou há > 15 min → aviso (roda a cada 5 min, sem API).

import type { PrismaClient } from '@prisma/client'
import type { ClienteSuitLeitura, PedidoCru } from './cliente-leitura'
import { agregarApi, type PedidoApi } from './regua-sombra'
import { sincronizarJanela, sincronizarLancamentos, janelaOperacional } from './sync'
import { registrarAviso, resolverAviso, reconciliarOrigem } from '../avisos/central'
import { linhasDeComplementoDaRegua, deCrus, complementosGravados } from './complementos'

export const ORIGEM_EVENTO = 'SUIT_PEDIDO_MUDOU'
export const ORIGEM_GUARDA = 'SUIT_GUARDA_DIVERGE'
export const ORIGEM_SYNC = 'SUIT_SYNC_PAROU'
export const SYNC_PARADO_MIN = 15
/** lançamentos que NÃO são venda (abertura/fechamento de caixa, sangria) */
const LANCAMENTO_NAO_VENDA = new Set(['previous_cash_balance', 'liquidation', 'closing_transfer'])

const brl = (cent: number) => (cent < 0 ? '−' : '') + 'R$ ' + (Math.abs(cent) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const diaBr = (d: string) => d.split('-').reverse().join('/')

export interface ResultadoGuarda {
  dia: string
  a: { veredito: 'BATE' | 'DIVERGE' | 'SEM_DIA'; apiCent: number; apiUn: number; esteiraCent: number; esteiraUn: number; eventosCent: number; restoCent: number; restoUn: number }
  b: { veredito: 'FECHA' | 'DIVERGE'; lancamentosCent: number; taxaCent: number; aPrazoCent: number; pedidosCent: number; reguaCent: number; entregaCent: number; descontoCent: number; adicionalCent: number; servicoCent: number; restoCent: number }
  c: { pendentes: number; deltaCent: number }
  /** COMPLEMENTOS: a régua sobre a API de agora × o que a esteira tem (XLS ou API) — ao centavo e nome a nome */
  comp: { veredito: 'BATE' | 'DIVERGE' | 'SEM_DIA'; origem: 'API' | 'XLS' | null; apiOcc: number; apiCent: number; esteiraOcc: number; esteiraCent: number; nomesDiferem: number }
  requisicoes: number
}

/** detalhe que, além de devolver, guarda o que a régua da sombra precisa (UMA passada na API) */
function clienteQueAnota(c: ClienteSuitLeitura) {
  const vistos = new Map<number, PedidoCru | null>()
  const cliente: ClienteSuitLeitura = { ...c, detalhe: async (id) => { const d = await c.detalhe(id); vistos.set(id, d); return d } }
  return { cliente, vistos }
}

export async function guardarDia(db: PrismaClient, base: ClienteSuitLeitura, companyId: string, dia: string, agora: Date): Promise<ResultadoGuarda> {
  const { cliente, vistos } = clienteQueAnota(base)
  const { from, to } = janelaOperacional(dia)
  // 1 passada COMPLETA: atualiza o espelho (apagados/alterados viram evento) E anota pra régua
  await sincronizarJanela(db, cliente, companyId, from, to, agora, true)
  await sincronizarLancamentos(db, cliente, companyId, dia, agora)

  // (a) régua provada sobre a API de AGORA × esteira
  const pedidosApi: PedidoApi[] = [...vistos.values()].filter((d): d is PedidoCru => !!d && d.created_at >= from && d.created_at <= to)
    .map((d) => ({ id: d.id, status: d.status, items: d.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, cancelled_at: i.cancelled_at })) }))
  const api = agregarApi(pedidosApi)
  const mat = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } } })
  const linhas = mat?.importId ? await db.stockVendaLinha.findMany({ where: { companyId, importId: mat.importId }, select: { quantidade: true, valorTotal: true } }) : []
  const esteiraCent = linhas.reduce((s, l) => s + Math.round(l.valorTotal * 100), 0)
  const esteiraUn = linhas.reduce((s, l) => s + l.quantidade, 0)
  const pend = await db.suitPedidoEvento.findMany({ where: { companyId, dia, depoisDaMaterializacao: true, decisao: null }, select: { deltaCent: true, deltaUn: true } })
  const eventosCent = pend.reduce((s, e) => s + e.deltaCent, 0)
  const eventosUn = pend.reduce((s, e) => s + e.deltaUn, 0)
  const restoCent = api.cent - esteiraCent - eventosCent
  const restoUn = Math.round((api.un - esteiraUn - eventosUn) * 1000) / 1000
  const a = { veredito: (!mat ? 'SEM_DIA' : restoCent === 0 && restoUn === 0 ? 'BATE' : 'DIVERGE') as ResultadoGuarda['a']['veredito'], apiCent: api.cent, apiUn: api.un, esteiraCent, esteiraUn, eventosCent, restoCent, restoUn }

  // (comp) complementos: a régua dos sabores sobre a API de AGORA × o gravado na esteira
  const crusDoDia = [...vistos.values()].filter((d): d is PedidoCru => !!d && d.created_at >= from && d.created_at <= to)
  const rc = linhasDeComplementoDaRegua(deCrus(crusDoDia))
  const gc = await complementosGravados(db, companyId, dia)
  const gravM = new Map<string, [number, number]>()
  for (const l of gc.linhas) { const cur = gravM.get(l.nomeSuitable) ?? [0, 0]; cur[0] += l.ocorrencias; cur[1] += Math.round(l.valorTotal * 100); gravM.set(l.nomeSuitable, cur) }
  const apiM = new Map(rc.linhas.map((l) => [l.produto, [l.quantidade, Math.round(l.valorTotal * 100)] as [number, number]]))
  const nomesDiferem = [...new Set([...gravM.keys(), ...apiM.keys()])].filter((k) => { const a = apiM.get(k) ?? [0, 0]; const g2 = gravM.get(k) ?? [0, 0]; return a[0] !== g2[0] || a[1] !== g2[1] }).length
  const esteiraOcc = [...gravM.values()].reduce((t, v) => t + v[0], 0)
  const esteiraCentC = [...gravM.values()].reduce((t, v) => t + v[1], 0)
  const comp: ResultadoGuarda['comp'] = {
    veredito: !gc.linhas.length && !gc.temArquivo ? 'SEM_DIA' : nomesDiferem === 0 ? 'BATE' : 'DIVERGE',
    origem: gc.daApi ? 'API' : gc.temArquivo || gc.linhas.length ? 'XLS' : null,
    apiOcc: rc.ocorrencias, apiCent: rc.totalCent, esteiraOcc, esteiraCent: esteiraCentC, nomesDiferem,
  }

  // (b) dinheiro: lançamentos × pedidos vivos (sem abandoned/cancelled, sem apagados)
  const lanc = await db.suitPagamento.findMany({ where: { companyId, dia, receita: true, administrativo: false }, select: { tipo: true, status: true, valorCent: true, taxaCent: true } })
  const vendas = lanc.filter((l) => !LANCAMENTO_NAO_VENDA.has(l.tipo))
  const lancamentosCent = vendas.reduce((s, l) => s + l.valorCent, 0)
  const taxaCent = vendas.reduce((s, l) => s + l.taxaCent, 0)
  const aPrazoCent = vendas.filter((l) => l.status !== 'paid').reduce((s, l) => s + l.valorCent, 0)
  const vivos = await db.suitPedido.findMany({ where: { companyId, dia, sumidoEm: null, status: { notIn: ['abandoned', 'cancelled'] } }, select: { totalCent: true, entregaCent: true, descontoCent: true, adicionalCent: true, servicoCent: true } })
  const soma = (k: keyof (typeof vivos)[number]) => vivos.reduce((s, p) => s + p[k], 0)
  const pedidosCent = soma('totalCent')
  const b = {
    veredito: (lancamentosCent - pedidosCent === 0 ? 'FECHA' : 'DIVERGE') as ResultadoGuarda['b']['veredito'],
    lancamentosCent, taxaCent, aPrazoCent, pedidosCent, reguaCent: api.cent,
    entregaCent: soma('entregaCent'), descontoCent: soma('descontoCent'), adicionalCent: soma('adicionalCent'), servicoCent: soma('servicoCent'),
    restoCent: lancamentosCent - pedidosCent,
  }

  // o dia que esperava o dono e ele já confirmou na tela → passa a MATERIALIZADO
  if (mat?.status === 'AGUARDANDO_DONO' && mat.importId) {
    const baixas = await db.stockMovement.count({ where: { companyId, receiptId: mat.importId, tipo: 'BAIXA_VENDA' } })
    if (baixas > 0) await db.suitDiaMaterializado.update({ where: { id: mat.id }, data: { status: 'MATERIALIZADO', motivo: null, atualizadoEm: agora } })
  }

  await avisarEventos(db, companyId)
  if (a.veredito === 'DIVERGE' || b.veredito === 'DIVERGE' || comp.veredito === 'DIVERGE') {
    await registrarAviso({
      companyId, setor: 'estoque', severidade: 'vermelho', origem: ORIGEM_GUARDA, alvo: dia,
      titulo: `Conferir as vendas de ${diaBr(dia)} com a Suit`,
      corpo: `A conferência da manhã não fechou: ${a.veredito === 'DIVERGE' ? `as vendas da Suit somam ${brl(a.apiCent)} e o sistema recebeu ${brl(a.esteiraCent)}` : comp.veredito === 'DIVERGE' ? `os sabores da Suit somam ${comp.apiOcc} (${brl(comp.apiCent)}) e o sistema recebeu ${comp.esteiraOcc} (${brl(comp.esteiraCent)})` : `o caixa da Suit soma ${brl(b.lancamentosCent)} e os pedidos somam ${brl(b.pedidosCent)}`}. Nada foi mudado sozinho.`,
      oQueFazer: 'Abrir as vendas do dia e comparar com o relatório da Suit antes de confiar no estoque desse dia.',
      acaoRotulo: 'Ver vendas do dia', acaoHref: `/empresas/${companyId}/estoque/vendas`,
    }, db)
  } else {
    await resolverAviso(companyId, ORIGEM_GUARDA, dia, db)
  }
  return { dia, a, b, c: { pendentes: pend.length, deltaCent: eventosCent }, comp, requisicoes: base.requisicoes() }
}

/** (c) um aviso por DIA com evento pendente; dia sem pendência → aviso resolvido */
export async function avisarEventos(db: PrismaClient, companyId: string): Promise<number> {
  const pend = await db.suitPedidoEvento.findMany({ where: { companyId, depoisDaMaterializacao: true, decisao: null }, select: { dia: true, tipo: true, deltaCent: true } })
  const porDia = new Map<string, { n: number; apagados: number; delta: number }>()
  for (const e of pend) {
    const d = porDia.get(e.dia) ?? { n: 0, apagados: 0, delta: 0 }
    d.n++
    if (e.tipo === 'APAGADO') d.apagados++
    d.delta += e.deltaCent
    porDia.set(e.dia, d)
  }
  for (const [dia, d] of porDia) {
    await registrarAviso({
      companyId, setor: 'estoque', severidade: 'ambar', origem: ORIGEM_EVENTO, alvo: dia,
      titulo: `Decidir: manter ou atualizar as vendas de ${diaBr(dia)}`,
      corpo: `${d.n === 1 ? 'Um pedido' : `${d.n} pedidos`} de ${diaBr(dia)} ${d.apagados === d.n ? (d.n === 1 ? 'foi apagado' : 'foram apagados') : 'mudou'} na Suit depois que o dia já tinha entrado (${brl(d.delta)}). O estoque segue como estava até você decidir.`,
      oQueFazer: 'Abrir o dia, ver os pedidos que mudaram e escolher: manter o dia como entrou ou atualizar o dia inteiro com a Suit.',
      acaoRotulo: 'Manter ou atualizar', acaoHref: `/empresas/${companyId}/estoque/vendas/suit?dia=${dia}`,
    }, db)
  }
  await reconciliarOrigem(companyId, ORIGEM_EVENTO, [...porDia.keys()], db)
  return porDia.size
}

/** (d) batimento: `ultimoOk` = último ciclo do sync que terminou bem */
export async function verificarBatimento(db: PrismaClient, companyId: string, ultimoOk: Date | null, agora: Date): Promise<'VIVO' | 'PARADO'> {
  const parado = !ultimoOk || agora.getTime() - ultimoOk.getTime() > SYNC_PARADO_MIN * 60_000
  if (!parado) { await resolverAviso(companyId, ORIGEM_SYNC, 'sync', db); return 'VIVO' }
  const desde = ultimoOk ? ultimoOk.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca'
  await registrarAviso({
    companyId, setor: 'sistema', severidade: 'vermelho', origem: ORIGEM_SYNC, alvo: 'sync',
    titulo: 'Verificar a ligação com a Suit',
    corpo: `As vendas da Suit pararam de chegar (última leitura boa: ${desde}). Enquanto isso, o dia de hoje não entra sozinho.`,
    oQueFazer: 'Avisar o suporte do sistema; se passar das 3h da manhã, subir o arquivo do dia pela porta de emergência.',
  }, db)
  return 'PARADO'
}

export function linhaDoState(r: ResultadoGuarda): string {
  return `${r.dia} a=${r.a.veredito} api=${brl(r.a.apiCent)}/${r.a.apiUn}un esteira=${brl(r.a.esteiraCent)}/${r.a.esteiraUn}un eventos=${brl(r.a.eventosCent)} resto=${brl(r.a.restoCent)} · ` +
    `b=${r.b.veredito} lanc=${brl(r.b.lancamentosCent)} pedidos=${brl(r.b.pedidosCent)} [régua ${brl(r.b.reguaCent)} +entrega ${brl(r.b.entregaCent)} −desc ${brl(r.b.descontoCent)} +adic ${brl(r.b.adicionalCent)} +serv ${brl(r.b.servicoCent)}] taxa=${brl(r.b.taxaCent)} aprazo=${brl(r.b.aPrazoCent)} resto=${brl(r.b.restoCent)} · ` +
    `c=${r.c.pendentes} pendente(s) ${brl(r.c.deltaCent)} · ` +
    `comp=${r.comp.veredito}${r.comp.origem ? `(${r.comp.origem})` : ''} api=${r.comp.apiOcc}/${brl(r.comp.apiCent)} esteira=${r.comp.esteiraOcc}/${brl(r.comp.esteiraCent)} nomes≠${r.comp.nomesDiferem}`
}
