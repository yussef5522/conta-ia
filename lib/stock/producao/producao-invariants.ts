// ESTOQUE FASE 2 item 2.5 — invariantes do JUIZ pra produção (P1-P6). Rodam no juiz
// noturno (mesma tabela stock_judge_report isolada). P7 (etiqueta vencida ainda vendida)
// depende de BAIXA_VENDA/fase 3 — deferido. Retorna o mesmo StockInvariantFail[] do E*.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from '../stock-invariants'
import { rendimentoMedioDaFicha } from './conclusao'
import { emProducaoPorOrdem } from './em-producao'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const P3_DESVIO = 0.25 // ±25% grave
const P5_DIAS = 14
const P6_DIAS = 7
const TIPOS_ORDEM = ['SEPARACAO_SAIDA', 'DEVOLUCAO_PRODUCAO', 'PRODUCAO_CONSUMO']

export async function checkProducaoInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const F = (invariante: string, companyId: string | null, detalhe: string) => fails.push({ invariante, companyId, detalhe })

  const ordens = await db.stockProductionOrder.findMany({ select: { id: true, companyId: true, estado: true, atualizadoEm: true, fichaId: true } })
  if (ordens.length) {
    const ids = ordens.map((o) => o.id)
    const movs = await db.stockMovement.findMany({ where: { receiptId: { in: ids }, tipo: { in: TIPOS_ORDEM } }, select: { receiptId: true, itemId: true, tipo: true, quantidade: true } })
    // agrupa por ordem+item: {sep, con, dev}
    const porOrdemItem = new Map<string, Map<string, { sep: number; con: number; dev: number }>>()
    for (const m of movs) {
      const oi = porOrdemItem.get(m.receiptId!) ?? new Map()
      const cur = oi.get(m.itemId) ?? { sep: 0, con: 0, dev: 0 }
      const abs = Math.abs(m.quantidade)
      if (m.tipo === 'SEPARACAO_SAIDA') cur.sep += abs
      else if (m.tipo === 'PRODUCAO_CONSUMO') cur.con += abs
      else cur.dev += abs
      oi.set(m.itemId, cur); porOrdemItem.set(m.receiptId!, oi)
    }

    // ⭐ fonte única do em-produção (a mesma que a tela usa)
    const emProducao = emProducaoPorOrdem(movs as never)

    for (const o of ordens) {
      const itens = porOrdemItem.get(o.id)
      // P1 — ordem CONCLUIDA: Σ|SEPARACAO| == Σ|CONSUMO| + Σ|DEVOLUCAO| por item
      if (o.estado === 'CONCLUIDA' && itens) {
        for (const [itemId, v] of itens) {
          if (Math.abs(round2(v.sep) - round2(v.con + v.dev)) > 0.01) {
            F('P1', o.companyId, `ordem ${o.id} item ${itemId}: separado ${round2(v.sep)} ≠ consumido ${round2(v.con)} + devolvido ${round2(v.dev)} (algo evaporou entre a câmara e a panela).`)
          }
        }
      }
      // P4 — ordem ENCERRADA com em-produção sobrando (vazamento)
      // ⭐ A CONTA SAIU DAQUI (01/09): `sep − con − dev` estava escrita inline e também em
      // `separadoPorItem`. Agora as duas — e o card "Em produção" do painel — leem
      // `emProducaoPorOrdem`. O juiz e a tela não têm como discordar sobre o que está
      // parado na produção.
      if ((o.estado === 'CONCLUIDA' || o.estado === 'CANCELADA')) {
        for (const [itemId, emProd] of emProducao.get(o.id) ?? new Map<string, number>()) {
          if (emProd > 0.01) F('P4', o.companyId, `ordem ${o.id} (${o.estado}) tem ${emProd} do item ${itemId} preso em-produção — não devolvido nem consumido.`)
        }
      }
      // P2 — ordem em aberto parada > 24h no mesmo estado
      if (['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO'].includes(o.estado)) {
        const horas = (now.getTime() - o.atualizadoEm.getTime()) / 3600_000
        if (horas > 24) F('P2', o.companyId, `ordem ${o.id} está ${o.estado} há ${Math.floor(horas)}h sem avançar.`)
      }
    }
  }

  // P3 — rendimento do lote fora de ±25% da média (desvio grave não revisado)
  const conclusoes = await db.stockProducaoConclusao.findMany({ select: { id: true, companyId: true, ordemId: true, rendimento: true } })
  const fichaDaOrdem = new Map(ordens.map((o) => [o.id, o.fichaId]))
  for (const c of conclusoes) {
    const fichaId = fichaDaOrdem.get(c.ordemId)
    if (!fichaId) continue
    const media = await rendimentoMedioDaFicha(c.companyId, fichaId, db as PrismaClient, c.id)
    if (media && media > 0) {
      const desvio = Math.abs((c.rendimento - media) / media)
      if (desvio > P3_DESVIO) F('P3', c.companyId, `conclusão ${c.id}: rendimento ${round2(c.rendimento)} desvia ${Math.round(desvio * 100)}% da média ${round2(media)} — revisar (carne ruim? porção errada? sobra não contada?).`)
    }
  }

  // P5 — PRODUTO_FINAL ativo com valorVenda nulo há > 14 dias (cobra o "a definir")
  const semPreco = await db.stockFicha.findMany({ where: { tipoProduto: 'PRODUTO_FINAL', ativo: true, valorVenda: null }, select: { id: true, companyId: true, criadoEm: true } })
  for (const f of semPreco) {
    if ((now.getTime() - f.criadoEm.getTime()) / 86_400_000 > P5_DIAS) F('P5', f.companyId, `ficha ${f.id} (produto final) está sem preço de venda há > ${P5_DIAS} dias — defina no cardápio.`)
  }

  // P6 — ficha com componente sem custo há > 7 dias
  const fichasAtivas = await db.stockFicha.findMany({ where: { ativo: true }, select: { id: true, companyId: true, versaoAtual: true, atualizadoEm: true } })
  for (const f of fichasAtivas) {
    if ((now.getTime() - f.atualizadoEm.getTime()) / 86_400_000 <= P6_DIAS) continue
    const versao = await db.stockFichaVersao.findFirst({ where: { companyId: f.companyId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    if (!versao) continue
    const comps = await db.stockFichaComponente.findMany({ where: { companyId: f.companyId, versaoId: versao.id }, select: { itemId: true } })
    if (!comps.length) continue
    // componente sem custo = item sem nenhum movimento ENTRADA_NF
    const semCusto = await db.stockMovement.groupBy({ by: ['itemId'], where: { companyId: f.companyId, itemId: { in: comps.map((c) => c.itemId) }, tipo: 'ENTRADA_NF' }, _count: { _all: true } })
    const comCusto = new Set(semCusto.map((g) => g.itemId))
    const faltando = comps.filter((c) => !comCusto.has(c.itemId)).length
    if (faltando > 0) F('P6', f.companyId, `ficha ${f.id}: ${faltando} componente(s) sem custo (sem nota) há > ${P6_DIAS} dias — o custo teórico fica "a definir".`)
  }

  return fails
}
