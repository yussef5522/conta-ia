// ⭐⭐ O DIA PARADO NA TRAVA (16/11/2026) — a pergunta que GRITA e a resposta que destrava.
//
// ⛔ O CASO: domingo 15/11 a trava de sanidade perguntou "XIS COMPLETO: 88 num dia — o normal é 1.
// Confirma?" e NINGUÉM viu (a pergunta só aparecia como "esperando você" numa faixa da central de
// vendas). Pior: o dia foi gravado PELA METADE — vendas sim, baixas de produto não (114 produtos,
// 759 un, R$ 5.701 de custo sem baixar). O dono contou o estoque em cima do buraco.
//
// ⭐ A REGRA NOVA:
//   1. dia que cai na trava fica INTEIRO retido: nem import, nem linhas, nem baixa, nem sabores
//      (`materializarDia` + o laço/fechar/decisão pulam os complementos de dia parado);
//   2. a pergunta vira AVISO VERMELHO no sininho + faixa no Painel e nas telas de Vendas, com o botão;
//   3. o portão da contagem TRANCA enquanto o dia está parado (contar em cima de venda não baixada
//      é contar duas vezes depois da resposta);
//   4. a resposta (`responderDiaParado`) materializa o dia inteiro de uma vez, com o "confirma" DELE.
import type { PrismaClient } from '@prisma/client'
import { registrarAviso, resolverAviso } from '@/lib/avisos/central'
import { materializarDia, type ResultadoMaterializacao } from './materializar'
import { materializarComplementosDia, complementosGravados } from './complementos'
import { CORTE_COMPLEMENTOS } from './cortes'
import { horaBrasil } from './ao-vivo'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

export const ORIGEM_DIA_PARADO = 'SUIT_DIA_PARADO'
export const STATUS_PARADO = 'AGUARDANDO_DONO'

const diaBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export class DiaNaoEstaParadoError extends Error {
  constructor(dia: string) { super(`O dia ${diaBr(dia)} não está esperando resposta.`); this.name = 'DiaNaoEstaParadoError' }
}
/** ⛔ meio-estado LEGADO (antes de 16/11): vendas gravadas sem baixa. Confirmar baixaria em cima de contagem. */
export class DiaMeioGravadoError extends Error {
  constructor(dia: string) {
    super(`O dia ${diaBr(dia)} foi gravado pela metade antes da trava nova — ele se resolve pela contagem, não por este botão.`)
    this.name = 'DiaMeioGravadoError'
  }
}

/** ⭐ o grito: aviso vermelho no sininho, com o botão pra responder */
export async function avisarDiaParado(db: PrismaClient, companyId: string, dia: string, motivo: string): Promise<void> {
  await registrarAviso({
    companyId, setor: 'estoque', severidade: 'vermelho', origem: ORIGEM_DIA_PARADO, alvo: dia,
    titulo: `Confirme ou revise as vendas de ${diaBr(dia)} — o dia está parado`,
    corpo: `A conferência das vendas perguntou: "${motivo}". Enquanto você não responder, nada desse dia entra no estoque — nem as vendas, nem as baixas — e a contagem fica trancada.`,
    oQueFazer: 'Confirme se o número é de verdade (promoção, evento) ou revise as vendas do dia antes de confirmar.',
    acaoRotulo: 'Responder agora', acaoHref: `/empresas/${companyId}/estoque/vendas`,
  }, db)
}

export interface DiaParado { dia: string; motivo: string; unidades: number; totalCent: number; pedidos: number }

/** os dias esperando o dono (a faixa e o sininho leem daqui) */
export async function diasParados(db: PrismaClient, companyId: string): Promise<DiaParado[]> {
  const rs = await db.suitDiaMaterializado.findMany({
    where: { companyId, status: STATUS_PARADO }, orderBy: { dia: 'asc' },
    select: { dia: true, motivo: true, unidades: true, totalCent: true, pedidos: true },
  })
  return rs.map((r) => ({ dia: r.dia, motivo: r.motivo ?? 'a conferência perguntou', unidades: r.unidades, totalCent: r.totalCent, pedidos: r.pedidos }))
}

/**
 * ⭐⭐ A RESPOSTA DO DONO: "confirmo". Materializa o dia INTEIRO (produtos com o confirma dele +
 * sabores) e cala o aviso. ⛔ Só um humano chama isto (rota com sessão) — a máquina nunca responde.
 */
export async function responderDiaParado(
  db: PrismaClient, companyId: string, dia: string, agora: Date,
): Promise<{ produtos: ResultadoMaterializacao; sabores: 'GRAVADOS' | 'JA_ESTAVAM' | 'ANTES_DO_CORTE' }> {
  const row = await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } } })
  if (!row || row.status !== STATUS_PARADO) throw new DiaNaoEstaParadoError(dia)
  if (row.importId) {
    const baixas = await db.stockMovement.count({ where: { companyId, receiptId: row.importId, tipo: 'BAIXA_VENDA' } })
    if (baixas === 0) throw new DiaMeioGravadoError(dia)
  }
  const produtos = await materializarDia(db, companyId, dia, agora, { reentregar: true, fechadoNaMao: true, confirmouSanidade: true })
  if (produtos.status === 'AGUARDANDO_DONO') return { produtos, sabores: 'JA_ESTAVAM' } // item barrado: a pergunta segue
  let sabores: 'GRAVADOS' | 'JA_ESTAVAM' | 'ANTES_DO_CORTE' = 'ANTES_DO_CORTE'
  if (dia >= CORTE_COMPLEMENTOS) {
    const g = await complementosGravados(db, companyId, dia)
    if (g.daApi || g.linhas.length || g.temArquivo) sabores = 'JA_ESTAVAM'
    else { await materializarComplementosDia(db, companyId, dia, agora, { fechadoNaMao: true }); sabores = 'GRAVADOS' }
  }
  await db.suitDiaMaterializado.update({
    where: { companyId_dia: { companyId, dia } },
    data: { motivo: `confirmado pelo dono em ${diaBr(diaEmSaoPaulo(agora))} às ${horaBrasil(agora)}` },
  })
  await resolverAviso(companyId, ORIGEM_DIA_PARADO, dia, db)
  return { produtos, sabores }
}
