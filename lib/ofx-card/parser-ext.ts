// Sprint PF Fatia 3 — Parser OFX estendido com suporte a CCSTMTRS (cartão).
//
// REUSO MÁXIMO de lib/ofx/parser.ts (PJ). Adiciona:
//   1. Detecção de statementType: BANK | CREDITCARD
//   2. Extração específica de CCACCTFROM (cartão usa CCACCTFROM,
//      conta usa BANKACCTFROM)
//   3. Extração de ORG (NU PAGAMENTOS S.A.) + FID (260) pra cartão
//
// FUNÇÃO PURA. Testável sem rede/DB.
//
// Mantém compat 100% com PJ — parser PJ continua usando parseOFX.

import { parseOFX, type OFXParseResult, type OFXTransaction } from '@/lib/ofx/parser'

export interface OFXParseResultExt extends OFXParseResult {
  statementType: 'BANK' | 'CREDITCARD'
  // Pra cartão (CCSTMTRS):
  org?: string                      // "NU PAGAMENTOS S.A."
  fid?: string                      // "260"
}

function extractTag(content: string, tag: string): string | null {
  // Procura tag e captura até o próximo < (com ou sem closing tag)
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
  const m = content.match(re)
  return m?.[1] ? m[1].trim() : null
}

/**
 * Extrai conteúdo entre <TAG> e </TAG> (ou até a próxima TAG de mesmo nível).
 * Mais robusto que extractTag pra blocos compostos.
 */
function extractBlock(content: string, tag: string): string | null {
  // XML-style com closing tag
  const xml = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')
  const m = content.match(xml)
  return m?.[1] ?? null
}

export function parseOFXExtended(raw: string): OFXParseResultExt {
  const content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Detecta tipo do statement
  const isCreditCard =
    /<CREDITCARDMSGSRSV1>/i.test(content) || /<CCSTMTRS>/i.test(content)
  const statementType: 'BANK' | 'CREDITCARD' = isCreditCard ? 'CREDITCARD' : 'BANK'

  // Reusa o parser base pras transações (mesmo BANKTRANLIST nas duas estruturas)
  const base = parseOFX(content)

  // Pra cartão, sobrescreve accountId com o ACCTID DE DENTRO de CCACCTFROM
  let accountId = base.accountId
  let org: string | undefined
  let fid: string | undefined

  if (isCreditCard) {
    const ccacctfromBlock = extractBlock(content, 'CCACCTFROM')
    if (ccacctfromBlock) {
      const ccAcctId = extractTag(ccacctfromBlock, 'ACCTID')
      if (ccAcctId) accountId = ccAcctId
    }
    // ORG + FID estão em <SIGNONMSGSRSV1><SONRS><FI>
    const fiBlock = extractBlock(content, 'FI') ?? content
    org = extractTag(fiBlock, 'ORG') ?? undefined
    fid = extractTag(fiBlock, 'FID') ?? undefined
  }

  return {
    ...base,
    accountId,
    statementType,
    org,
    fid,
  }
}

export type { OFXTransaction }
