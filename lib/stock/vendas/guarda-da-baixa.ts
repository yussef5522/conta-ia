// ⭐⭐ A GUARDA DIÁRIA DA BAIXA (16/11/2026) — a conferência que os números 1 do varejo têm.
//
// ⛔ O CASO: o laudo de 16/11 achou R$ 6.420 de custo vendido e NÃO baixado em 14 dias — 89% num dia
// parado na trava (15/11), o resto em baixa parcial/ausente espalhada — e NINGUÉM soube até o dono
// contar a coca (171 → 170 com 29 vendidas). E 171 nomes de venda sem vínculo nunca baixaram nada.
//
// ⭐ A REGRA: todo dia, depois da materialização, para CADA item de estoque: o que o dia MANDA baixar
// (produtos + complementos pela régua, com o mapa e as fichas de agora — os MESMOS planejadores que a
// baixa usa: `montarPlanoReprocesso` e `montarPlanoComplementos`) × o que o razão TEM baixado (as
// BAIXA_VENDA do dia, menos os estornos delas). Divergência de 1 unidade que seja → aviso no sininho
// com a lista. A mesma passada conta e lista as VENDAS SEM VÍNCULO do dia.
// Idempotente: um aviso por dia (origem + alvo = dia), resolvido quando o dia volta a bater. Só lê
// e avisa — NUNCA reprocessa nem baixa nada (o conserto é do dono, na tela).
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { registrarAviso, resolverAviso } from '@/lib/avisos/central'
import { montarPlanoReprocesso } from './baixa-venda'
import { ORIGEM_BAIXA_DO_FECHAMENTO } from './baixou-na-hora'
import { montarPlanoComplementos } from './baixa-complemento'
import { importIdDe } from './identidade-import-complemento'
import { custoMedioPorItem } from '../saldo'
import { avisarNegativos } from '../negativos-no-sininho'
import { avisarFichaTardia, listarFichaTardia } from './ficha-tardia'
import { somarDias } from '@/lib/datas/dia-sao-paulo'

export const ORIGEM_BAIXA_FURADA = 'BAIXA_FURADA'
export const ORIGEM_SEM_VINCULO = 'VENDA_SEM_VINCULO'
/** abaixo disto é poeira de arredondamento (KG com 3 casas), não unidade */
export const TOLERANCIA_DA_BAIXA = 0.001

export interface FuroDaBaixa { itemId: string; nome: string; vendido: number; baixado: number; buraco: number; custoUn: number | null; rs: number | null }
export interface SemVinculo { nome: string; qtd: number; tipo: 'PRODUTO' | 'COMPLEMENTO' }
export interface ConferenciaDaBaixa {
  dia: string
  /** DIA_PARADO: o dia está retido na trava (o aviso dele é o do dia parado) · SEM_DIA: nada gravado */
  status: 'BATE' | 'FURO' | 'DIA_PARADO' | 'SEM_DIA'
  furos: FuroDaBaixa[]
  semVinculo: SemVinculo[]
  /** soma do custo dos buracos (a menos − a mais); `aoMenos` = há item sem custo médio */
  totalRs: number
  aoMenos: boolean
  /**
   * ⭐⭐ (25/11) O EVENTO, por PRODUTO: venderam no dia, NÃO baixaram no fechamento e têm ficha hoje
   * (a ficha chegou depois). ⛔ Lido do registro do fechamento, nunca do mapa de hoje — o furo por
   * item fala "porção queijo", o dono procura "PROMOO 3 PIZZAS".
   */
  ficaramPraTras: { nome: string; qtd: number }[]
}

/**
 * o que o razão TEM baixado de um recibo NO FECHAMENTO: as BAIXA_VENDA dele nascidas do fechamento
 * menos os estornos delas, por item.
 * ⭐ (27/11) O ACERTO da ficha tardia mora no mesmo recibo, mas NÃO entra aqui: o produto acertado já
 * saiu do "vendido" (`montarPlanoReprocesso` — a mesma blindagem do reprocesso). O acerto é um evento
 * fechado em si (o que saiu + o que a contagem fixou); somar só um dos lados era o que inventava furo.
 */
async function baixadoDoRecibo(db: PrismaClient, companyId: string, receiptId: string, acc: Map<string, number>): Promise<void> {
  const base = await db.stockMovement.findMany({ where: { companyId, receiptId, tipo: 'BAIXA_VENDA', origem: ORIGEM_BAIXA_DO_FECHAMENTO }, select: { id: true, itemId: true, quantidade: true } })
  if (base.length) {
    const est = await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: base.map((b) => b.id) } }, select: { itemId: true, quantidade: true } })
    for (const m of [...base, ...est]) acc.set(m.itemId, (acc.get(m.itemId) ?? 0) - m.quantidade)
  }
}

/** ⭐ a CONTA, só leitura */
export async function conferirBaixaDoDia(companyId: string, dia: string, db: PrismaClient = defaultPrisma): Promise<ConferenciaDaBaixa> {
  const vazio = { dia, furos: [], semVinculo: [], totalRs: 0, aoMenos: false, ficaramPraTras: [] }
  const mat = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { status: true, importId: true } })
  if (mat?.status === 'AGUARDANDO_DONO' && !mat.importId) return { ...vazio, status: 'DIA_PARADO' }

  const vendido = new Map<string, number>()
  const nomes = new Map<string, string>()
  const baixado = new Map<string, number>()
  const semVinculo: SemVinculo[] = []

  const prod = await montarPlanoReprocesso(companyId, dia, db)
  if (prod) {
    for (const a of prod.plano.agregada) { vendido.set(a.itemId, (vendido.get(a.itemId) ?? 0) + a.qtd); nomes.set(a.itemId, a.nome) }
    for (const p of prod.plano.pendentes) semVinculo.push({ nome: p.nome, qtd: p.quantidade, tipo: 'PRODUTO' })
    const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${dia}T12:00:00`) } }, select: { id: true } })
    if (imp) await baixadoDoRecibo(db, companyId, imp.id, baixado)
  }
  let temComp = false
  try {
    const comp = await montarPlanoComplementos(companyId, dia, db)
    temComp = true
    for (const a of comp.agregada) { vendido.set(a.itemId, (vendido.get(a.itemId) ?? 0) + a.qtd); nomes.set(a.itemId, a.nome) }
    for (const p of comp.pendentes) semVinculo.push({ nome: p.nomeSuitable, qtd: p.ocorrencias, tipo: 'COMPLEMENTO' })
    await baixadoDoRecibo(db, companyId, importIdDe(companyId, dia, 'DIA'), baixado)
  } catch { /* dia sem linha de complemento: nada a conferir desse lado */ }
  if (!prod && !temComp) return { ...vazio, status: 'SEM_DIA' }

  const ids = [...new Set([...vendido.keys(), ...baixado.keys()])]
  const custo = ids.length ? await custoMedioPorItem(db, companyId) : new Map<string, number | null>()
  const faltaNome = ids.filter((id) => !nomes.has(id))
  if (faltaNome.length) for (const i of await db.stockItem.findMany({ where: { companyId, id: { in: faltaNome } }, select: { id: true, nome: true } })) nomes.set(i.id, i.nome)

  const furos: FuroDaBaixa[] = []
  for (const id of ids) {
    const v = vendido.get(id) ?? 0, b = baixado.get(id) ?? 0
    const buraco = Math.round((v - b) * 1000) / 1000
    if (Math.abs(buraco) <= TOLERANCIA_DA_BAIXA) continue
    const cu = custo.get(id) ?? null
    furos.push({ itemId: id, nome: nomes.get(id) ?? id, vendido: v, baixado: b, buraco, custoUn: cu, rs: cu == null ? null : Math.round(buraco * cu * 100) / 100 })
  }
  furos.sort((x, y) => Math.abs(y.rs ?? 0) - Math.abs(x.rs ?? 0) || Math.abs(y.buraco) - Math.abs(x.buraco))
  // ⭐ o EVENTO por produto — a mesma porta da pergunta de acerto (só o dia desta conferência)
  const ficaramPraTras = (await listarFichaTardia(companyId, { hoje: somarDias(dia, 1) }, db))
    .filter((p) => p.dia === dia).map((p) => ({ nome: p.nomeSuitable, qtd: p.quantidade }))
  semVinculo.sort((x, y) => y.qtd - x.qtd || x.nome.localeCompare(y.nome, 'pt-BR'))
  return {
    dia, status: furos.length || ficaramPraTras.length ? 'FURO' : 'BATE', furos, semVinculo, ficaramPraTras,
    totalRs: Math.round(furos.reduce((t, f) => t + (f.rs ?? 0), 0) * 100) / 100,
    aoMenos: furos.some((f) => f.rs == null),
  }
}

/** ⭐ a aba Bancada do Cardápio — o destino do aviso de venda sem vínculo */
export const hrefDaBancada = (companyId: string) => `/empresas/${companyId}/estoque/cardapio?aba=bancada`

const diaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⭐ a GUARDA: confere e avisa (ou cala o aviso do dia, se voltou a bater). Idempotente por dia. */
export async function guardarBaixaDoDia(companyId: string, dia: string, db: PrismaClient = defaultPrisma): Promise<ConferenciaDaBaixa> {
  // ⭐ (19/11) a seção dos ITENS NEGATIVOS: roda todo dia, ANTES de qualquer retorno (dia parado ou sem dia
  // também têm negativo pra mostrar). ⚠️ Falha dela não derruba a conferência da baixa — e o erro é
  // nomeado sem a mensagem (a do Prisma pode carregar a URI do banco).
  try { await avisarNegativos(companyId, db) } catch (e) { console.error(`[guarda] negativos falhou: ${e instanceof Error ? e.name : 'erro'}`) }
  // ⭐⭐ (25/11) A FICHA QUE CHEGOU DEPOIS: venda de dia fechado que não baixou e tem ficha hoje →
  // grito vermelho no sininho, nomeando o PRODUTO. ⚠️ Fail-soft, como os negativos.
  try { await avisarFichaTardia(companyId, db) } catch (e) { console.error(`[guarda] ficha tardia falhou: ${e instanceof Error ? e.name : 'erro'}`) }
  const c = await conferirBaixaDoDia(companyId, dia, db)
  if (c.status === 'DIA_PARADO' || c.status === 'SEM_DIA') return c
  const href = `/empresas/${companyId}/estoque/vendas`
  if (c.furos.length || c.ficaramPraTras.length) {
    // ⭐ o PRODUTO primeiro, na língua do balcão: "PROMOO 3 PIZZAS vendeu 31 e nada saiu"
    const produtos = c.ficaramPraTras.map((p) => `${p.nome} vendeu ${num(p.qtd)} un e nada saiu do estoque (a ficha foi criada depois)`).join('; ')
    const lista = c.furos.slice(0, 12).map((f) => `${f.nome} · vendido ${num(f.vendido)} · baixado ${num(f.baixado)} · ${f.buraco > 0 ? 'faltou baixar' : 'baixou a mais'} ${num(Math.abs(f.buraco))} · ${f.rs == null ? 'sem custo' : brl(Math.abs(f.rs))}`).join('; ')
    await registrarAviso({
      companyId, setor: 'estoque', severidade: 'vermelho', origem: ORIGEM_BAIXA_FURADA, alvo: dia,
      titulo: c.ficaramPraTras.length
        ? `Confira o estoque: ${c.ficaramPraTras[0].nome} vendeu ${num(c.ficaramPraTras[0].qtd)} un em ${diaBr(dia)} e nada saiu do estoque${c.ficaramPraTras.length > 1 ? ` (e mais ${c.ficaramPraTras.length - 1})` : ''}`
        : `Confira as baixas de estoque de ${diaBr(dia)} — ${c.furos.length} ${c.furos.length === 1 ? 'item não bateu' : 'itens não bateram'}`,
      corpo: `${produtos ? `${produtos}. ` : ''}${c.furos.length ? `O que foi vendido não é o que saiu do estoque (${c.aoMenos ? 'pelo menos ' : ''}${brl(Math.abs(c.totalRs))} de custo). ${lista}${c.furos.length > 12 ? `; e mais ${c.furos.length - 12}` : ''}.` : ''}`,
      oQueFazer: 'Abra as vendas do dia e confira os itens da lista; se uma ficha ou um vínculo mudou, reprocesse o dia.',
      acaoRotulo: 'Ver vendas do dia', acaoHref: href,
    }, db)
  } else await resolverAviso(companyId, ORIGEM_BAIXA_FURADA, dia, db)

  if (c.semVinculo.length) {
    const un = c.semVinculo.reduce((t, s) => t + s.qtd, 0)
    await registrarAviso({
      companyId, setor: 'estoque', severidade: 'ambar', origem: ORIGEM_SEM_VINCULO, alvo: dia,
      titulo: `Vincule ${c.semVinculo.length} ${c.semVinculo.length === 1 ? 'nome de venda' : 'nomes de venda'} de ${diaBr(dia)} ao estoque`,
      corpo: `Esses nomes venderam ${num(un)} un e não baixaram nada do estoque: ${c.semVinculo.slice(0, 15).map((s) => `${s.nome}${s.tipo === 'COMPLEMENTO' ? ' (complemento)' : ''} ${num(s.qtd)}`).join(' · ')}${c.semVinculo.length > 15 ? ` · e mais ${c.semVinculo.length - 15}` : ''}.`,
      oQueFazer: 'Abra a Bancada de vínculos e ligue cada nome a uma ficha — ou ignore o que não controla estoque.',
      // ⭐ (19/11) direto pra fila única (lei R32), não pras vendas do dia
      acaoRotulo: 'Abrir a Bancada', acaoHref: hrefDaBancada(companyId),
    }, db)
  } else await resolverAviso(companyId, ORIGEM_SEM_VINCULO, dia, db)
  return c
}
