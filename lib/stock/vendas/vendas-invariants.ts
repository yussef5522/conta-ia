// ESTOQUE FASE 3 — invariantes do juiz pra vendas.
//
// V1: venda importada SEM destino (nome não mapeado) há > 7 dias.
// V2 (05/09): DIA IMPORTADO E NUNCA BAIXADO há > 24h — o buraco que deixou 3 dias de
//     complemento parados sem ninguém saber (02, 03 e 04/09: mapa certo, ficha certa, plano
//     certo, e ZERO movimento no ledger).
//
// Os dois são AVISO (não vermelho) — decidir é do dono; o juiz só lembra.
//
// ⛔⛔ E O V2 RESPEITA A DISPENSA, senão ele nasce como ruído: o dono decidiu que 02 e 03/09
// não baixam (a produção não estava montada), e um aviso que grita pra sempre sobre dias
// pulados de propósito é como um alarme morre — a lição dos 111 falsos.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from '../stock-invariants'
import { ehLinhaDePeriodo } from './import-complementos'

type Db = PrismaClient | Prisma.TransactionClient
const V1_DIAS = 7

export async function checkVendasInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const limite = new Date(now.getTime() - V1_DIAS * 86_400_000)
  const [linhas, mapa] = await Promise.all([
    db.stockVendaLinha.findMany({ where: { data: { lt: limite } }, select: { companyId: true, nomeSuitable: true } }),
    db.stockVendaProdutoMap.findMany({ select: { companyId: true, nomeSuitable: true } }),
  ])
  const mapeados = new Set(mapa.map((m) => `${m.companyId}|${m.nomeSuitable}`))
  const pendentesAntigos = new Map<string, { companyId: string; nome: string }>()
  for (const l of linhas) {
    const k = `${l.companyId}|${l.nomeSuitable}`
    if (mapeados.has(k)) continue
    if (!pendentesAntigos.has(k)) pendentesAntigos.set(k, { companyId: l.companyId, nome: l.nomeSuitable })
  }
  for (const p of pendentesAntigos.values()) {
    fails.push({ invariante: 'V1', companyId: p.companyId, nivel: 'aviso', detalhe: `venda "${p.nome}" importada há > ${V1_DIAS} dias sem destino no estoque — mapeie pra a baixa contar (ou deixe pendente).` })
  }
  fails.push(...await checkDiasSemBaixa(db, now))
  return fails
}

/** ⚠️ importar e baixar no mesmo minuto não é pendência — só depois de 24h vira aviso */
const V2_HORAS = 24

/**
 * V2 — dia importado e nunca baixado. Cobre os DOIS relatórios (produtos e complementos),
 * porque a pergunta é a mesma: *"entrou venda e o estoque não se moveu?"*.
 */
async function checkDiasSemBaixa(db: Db, now: Date): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const limite = new Date(now.getTime() - V2_HORAS * 3_600_000)

  const [impProdutos, linhasComp, baixas, dispensas] = await Promise.all([
    db.stockVendaImport.findMany({ where: { criadoEm: { lt: limite } }, select: { id: true, companyId: true, data: true } }),
    db.stockVendaComplementoLinha.findMany({
      where: { criadoEm: { lt: limite } }, select: { companyId: true, data: true, importId: true },
    }),
    // uma baixa ATIVA basta pra o dia não ser pendência (estorno é outro assunto: o
    // `precisaReprocessar` da tela cobre o dia que mudou depois de baixado)
    db.stockMovement.findMany({ where: { tipo: 'BAIXA_VENDA' }, select: { companyId: true, receiptId: true } }),
    db.stockVendaDiaDispensado.findMany({ where: { revertidoEm: null }, select: { companyId: true, escopo: true, data: true } }),
  ])

  const comBaixa = new Set(baixas.map((b) => `${b.companyId}|${b.receiptId}`))
  const dispensado = new Set(dispensas.map((d) => `${d.companyId}|${d.escopo}|${d.data.toISOString().slice(0, 10)}`))
  const dia = (d: Date) => d.toISOString().slice(0, 10)

  for (const i of impProdutos) {
    if (comBaixa.has(`${i.companyId}|${i.id}`)) continue
    if (dispensado.has(`${i.companyId}|PRODUTO|${dia(i.data)}`)) continue
    fails.push({
      invariante: 'V2', companyId: i.companyId, nivel: 'aviso',
      detalhe: `as vendas de ${dia(i.data)} (produtos) foram importadas e NUNCA baixaram o estoque — baixe, ou marque o dia como "não baixar" se foi decisão.`,
    })
  }

  // ⚠️ complemento não tem tabela de import: o dia é o conjunto de linhas com o mesmo importId
  const diasComp = new Map<string, { companyId: string; data: string; importId: string }>()
  for (const l of linhasComp) {
    const k = `${l.companyId}|${l.importId}`
    if (!diasComp.has(k)) diasComp.set(k, { companyId: l.companyId, data: dia(l.data), importId: l.importId })
  }
  for (const d of diasComp.values()) {
    // ⛔ PERÍODO nunca baixa (ele existe pra montar a lista de sabores) — cobrar seria
    // pedir o que o desenho proíbe
    if (ehLinhaDePeriodo(d.importId)) continue
    if (comBaixa.has(`${d.companyId}|${d.importId}`)) continue
    if (dispensado.has(`${d.companyId}|COMPLEMENTO|${d.data}`)) continue
    fails.push({
      invariante: 'V2', companyId: d.companyId, nivel: 'aviso',
      detalhe: `os complementos de ${d.data} foram importados e NUNCA baixaram o estoque — o sabor vendido não saiu da câmara. Baixe, ou marque o dia como "não baixar" se foi decisão.`,
    })
  }

  return fails
}
