// VENDAS FASE 1 (17/08/2026) — regras default da Cacula (a partir de 12/08, o
// 1º dia do PIX via Tuna; antes disso a tela não olha). Confirmadas pelo dono no
// onboarding → `confirmadoPeloDono: true`. Builder puro (usado pelo seed E pelo
// teste — REGRA 4, uma fonte só). O `vigenteDe` é 12/08/2026 (decisão do dono).
//
// Perfil (extratos reais de agosto):
//   Banrisul CARTAO   D+1 útil, sem fim de semana (inclui OP.CREDITO C/GARANTIA)
//   Sicredi  PIX      D+1 útil, sem fim de semana (TUNA PAGAMENTO, consolidado)
//   Stone    PIX      D+0, recebe fim de semana (Pix|Maquininha residual)
//   Cofre    DINHEIRO D+1 útil, sem fim de semana

import type { RegraRecebimento, Meio } from './perfil-recebimento'

export interface CaculaAccountIds {
  banrisulId: string
  sicrediId: string
  stoneId: string
  cofreId: string
}

export const CACULA_PERFIL_VIGENTE_DE = new Date('2026-08-12T00:00:00Z')

export function buildCaculaDefaultRegras(
  ids: CaculaAccountIds,
  vigenteDe: Date = CACULA_PERFIL_VIGENTE_DE,
): RegraRecebimento[] {
  const base = { vigenteDe, vigenteAte: null as Date | null, confirmadoPeloDono: true }
  const mk = (
    bankAccountId: string,
    meio: Meio,
    diasUteisAtraso: number,
    recebeSabDom: boolean,
    origemHint: string,
  ): RegraRecebimento => ({ ...base, bankAccountId, meio, diasUteisAtraso, recebeSabDom, origemHint })

  return [
    mk(ids.banrisulId, 'CARTAO', 1, false, 'Cartão Banrisul (bandeiras + OP.CREDITO C/GARANTIA)'),
    mk(ids.sicrediId, 'PIX', 1, false, 'TUNA PAGAMENTO'),
    mk(ids.stoneId, 'PIX', 0, true, 'Pix | Maquininha (residual)'),
    mk(ids.cofreId, 'DINHEIRO', 1, false, 'Caixa loja/cofre'),
  ]
}

// IDs reais da Cacula (do topo do CLAUDE.md — REGRA 8, resolver por ID).
export const CACULA_IDS: CaculaAccountIds = {
  banrisulId: 'cmq17z90v00qxrndl02kfn4iz',
  sicrediId: 'cmq180ksv0001aktni9wj64mq',
  stoneId: 'cmq182qfr0005aktn6q2ugpv2',
  cofreId: 'cmq2o25qe0001y2faydl1yrp5',
}
