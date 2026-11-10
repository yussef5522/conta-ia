// SUITAPI — UM CICLO DO LAÇO (a cada 2 min, no processo `conta-ia-suit-sync`).
//   1. espelha a janela viva (D-1 06h → agora, relógio da API) — só detalha pedido de cara nova
//   2. FECHAMENTO: cada dia ≥ CORTE já fechado (D+1 03:10 BRT) e ainda não entregue → sync
//      COMPLETO do dia + lançamentos → materializarDia (a esteira de sempre)
//   3. GUARDA: a partir das 07:00 BRT, uma vez por dia, pra D-1 (dentro do MESMO processo — a
//      guarda e o sync escrevem o mesmo espelho; juntos no mesmo laço, nunca disputam)
import type { PrismaClient } from '@prisma/client'
import type { ClienteSuitLeitura } from './cliente-leitura'
import { sincronizarJanela, sincronizarLancamentos, relogioDaApi, janelaOperacional, type RelatorioSync } from './sync'
import { materializarDia, fechamentoDe, CORTE_API, DiaJaTemImportError, type ResultadoMaterializacao } from './materializar'
import { guardarDia, avisarEventos, type ResultadoGuarda } from './guarda'
import { diaOperacional } from './espelho'
import { somarDias } from './regua-sombra'

/** a guarda da manhã: 07:00 de Brasília = 10:00 UTC */
export const HORA_GUARDA_UTC = 10
/** quantos dias pra trás o fechamento procura dia não entregue */
export const DIAS_DE_RECUPERACAO = 7

export interface Ciclo {
  vivo: RelatorioSync
  fechados: Array<{ dia: string; resultado: ResultadoMaterializacao | { status: 'ERRO'; erro: string } }>
  guarda: ResultadoGuarda | null
}

export function diaDeHoje(agora: Date): string {
  return diaOperacional(relogioDaApi(agora))
}

/** o dia que a guarda da manhã confere (D-1 do dia operacional que está aberto às 07h) */
export function diaDaGuarda(agora: Date): string | null {
  if (agora.getUTCHours() < HORA_GUARDA_UTC) return null
  return somarDias(diaDeHoje(agora), -1)
}

export async function cicloDoLaco(
  db: PrismaClient, cliente: ClienteSuitLeitura, companyId: string, agora: Date,
  guardaJaFeita: (dia: string) => boolean,
  nomeDoErro: (e: unknown) => string,
): Promise<Ciclo> {
  const hoje = diaDeHoje(agora)
  const ontem = somarDias(hoje, -1)
  const vivo = await sincronizarJanela(db, cliente, companyId, janelaOperacional(ontem).from, relogioDaApi(agora), agora)

  const fechados: Ciclo['fechados'] = []
  const inicio = [CORTE_API, somarDias(hoje, -DIAS_DE_RECUPERACAO)].sort().at(-1)!
  const entregues = new Set((await db.suitDiaMaterializado.findMany({ where: { companyId, dia: { gte: inicio } }, select: { dia: true } })).map((m) => m.dia))
  for (let dia = inicio; dia < hoje; dia = somarDias(dia, 1)) {
    if (entregues.has(dia) || agora.getTime() < fechamentoDe(dia).getTime()) continue
    // ⛔ dia que já tem arquivo/lançamento: recusa ANTES de gastar a API (sem isto, ~450 GETs a
    // cada 2 min pra um dia que nunca vai entrar sozinho — só por ordem explícita do dono)
    if (await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: new Date(`${dia}T12:00:00`) } }, select: { id: true } })) {
      fechados.push({ dia, resultado: { status: 'ERRO', erro: nomeDoErro(new DiaJaTemImportError(dia)) } })
      continue
    }
    try {
      const { from, to } = janelaOperacional(dia)
      await sincronizarJanela(db, cliente, companyId, from, to, agora, true)
      await sincronizarLancamentos(db, cliente, companyId, dia, agora)
      fechados.push({ dia, resultado: await materializarDia(db, companyId, dia, agora) })
    } catch (e) {
      fechados.push({ dia, resultado: { status: 'ERRO', erro: nomeDoErro(e) } })
    }
  }

  let guarda: ResultadoGuarda | null = null
  const dg = diaDaGuarda(agora)
  const dgEntregue = !!dg && (entregues.has(dg) || fechados.some((f) => f.dia === dg && f.resultado.status !== 'ERRO'))
  if (dg && dg >= CORTE_API && dgEntregue && !guardaJaFeita(dg)) {
    guarda = await guardarDia(db, cliente, companyId, dg, agora)
  } else {
    await avisarEventos(db, companyId)
  }
  return { vivo, fechados, guarda }
}
