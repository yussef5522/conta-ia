// SUITAPI — V11 · "FECHAR O DIA" (lei vendas-ao-vivo v3). O dono fechou o caixa na Suit → o dia
// CORRENTE entra NA HORA pela MESMA esteira das 03:10 (produtos e sabores, baixas de ficha) e a
// contagem é liberada. Idempotente: dia já fechado = só o carimbo. Anti-duplo-clique: a MESMA
// trava de arquivo do laço (o laço pula o ciclo; um 2º clique simultâneo recebe "fechando…").
// A rotina das 03:10 continua: dia fechado na mão → ela re-confere (guarda) e pedido que mudar,
// sumir ou NASCER depois vira aviso nominal.
import type { PrismaClient } from '@prisma/client'
import type { ClienteSuitLeitura } from './cliente-leitura'
import { sincronizarJanela, sincronizarLancamentos, relogioDaApi, janelaOperacional } from './sync'
import { materializarDia, type ResultadoMaterializacao } from './materializar'
import { materializarComplementosDia, complementosGravados, type ResultadoComplementos } from './complementos'
import { CORTE_COMPLEMENTOS } from './cortes'
import { diaOperacional } from './espelho'
import { quemFechou, horaBrasil } from './ao-vivo'
import { tentarTravar, soltar } from './trava-arquivo'

export class FechandoAgoraError extends Error {
  constructor() { super('O dia já está sendo fechado — espere um instante.'); this.name = 'FechandoAgoraError' }
}

export interface Carimbo { dia: string; hora: string; por: 'dono' | 'automatico'; jaEstava: boolean; produtos?: ResultadoMaterializacao; sabores?: ResultadoComplementos | { status: 'XLS' } }

export async function fecharDiaNaMao(db: PrismaClient, cliente: ClienteSuitLeitura, companyId: string, agora: Date, trava: string): Promise<Carimbo> {
  const dia = diaOperacional(relogioDaApi(agora))
  const carimbo = async (jaEstava: boolean, extra: Partial<Carimbo> = {}): Promise<Carimbo> => {
    const m = await db.suitDiaMaterializado.findUniqueOrThrow({ where: { companyId_dia: { companyId, dia } }, select: { materializadoEm: true } })
    return { dia, hora: horaBrasil(m.materializadoEm), por: quemFechou(dia, m.materializadoEm), jaEstava, ...extra }
  }
  if (await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { id: true } })) return carimbo(true)
  if (!tentarTravar(trava)) throw new FechandoAgoraError()
  try {
    // dentro da trava, confere de novo (o laço pode ter fechado entre a 1ª leitura e a trava)
    if (await db.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId, dia } }, select: { id: true } })) return carimbo(true)
    const { from } = janelaOperacional(dia)
    await sincronizarJanela(db, cliente, companyId, from, relogioDaApi(agora), agora, true)
    await sincronizarLancamentos(db, cliente, companyId, dia, agora)
    const produtos = await materializarDia(db, companyId, dia, agora, { fechadoNaMao: true })
    let sabores: Carimbo['sabores']
    const g = await complementosGravados(db, companyId, dia)
    if (dia >= CORTE_COMPLEMENTOS && !g.linhas.length && !g.temArquivo) sabores = await materializarComplementosDia(db, companyId, dia, agora, { fechadoNaMao: true })
    else sabores = { status: 'XLS' }
    return carimbo(false, { produtos, sabores })
  } finally {
    soltar(trava)
  }
}
