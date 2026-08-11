// FASE 2 — aviso de banco desconhecido / ficha incompleta PRA TELA.
//
// Requisito do Yussef: se importar de um banco novo, o aviso tem que aparecer
// NA HORA, na tela — não só no log. Este helper devolve a mensagem pt-BR que o
// preview/import injeta no payload; a UI mostra em banner/toast.

import type { BankProfile } from './types'

export interface BankProfileWarning {
  code: 'BANK_UNKNOWN' | 'BANK_PROFILE_INCOMPLETE'
  /** BANKID do arquivo (quando desconhecido). */
  bankid: string | null
  message: string
}

/**
 * Devolve o aviso a mostrar na tela, ou null quando o banco é conhecido e a
 * ficha está completa. `bankid` é o BANKID cru do OFX (pra citar no aviso).
 */
export function bankProfileWarning(
  profile: BankProfile | null,
  bankid: string | null,
): BankProfileWarning | null {
  if (!profile) {
    return {
      code: 'BANK_UNKNOWN',
      bankid,
      message:
        `Banco não reconhecido (código ${bankid ?? '?'}). O sistema está usando um comportamento conservador ` +
        `(âncora pela última transação, sem descarte automático de futuro, sem preencher contraparte). ` +
        `Confira o resultado com atenção — não dá pra garantir as particularidades desse banco ainda.`,
    }
  }
  if (profile.incomplete) {
    return {
      code: 'BANK_PROFILE_INCOMPLETE',
      bankid,
      message:
        `${profile.displayName}: a ficha deste banco ainda está incompleta (nenhum extrato real analisado). ` +
        `O sistema está sendo conservador. Confira o resultado com atenção.`,
    }
  }
  return null
}
