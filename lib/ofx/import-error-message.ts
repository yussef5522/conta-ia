// Sprint Fix Dedup Import (30/07/2026) — mapeia erro técnico do import OFX para
// mensagem pt-BR amigável. NUNCA expõe nome de tabela/coluna/stack pro usuário.
// O caller deve logar o erro técnico completo no servidor (pm2) e devolver só a
// mensagem amigável ao client.

import { Prisma } from '@prisma/client'

export interface FriendlyImportError {
  message: string
  code: string
}

export function toFriendlyImportError(err: unknown): FriendlyImportError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint. Com a importação atômica ($transaction), o
    // rollback garante que NENHUMA transação foi criada.
    if (err.code === 'P2002') {
      return {
        code: 'IMPORT_DUP_CONFLICT',
        message:
          'Não foi possível concluir a importação por um conflito de duplicidade. Nenhuma transação foi criada. Tente de novo e, se persistir, avise o suporte.',
      }
    }
    // P2028 = transaction API timeout.
    if (err.code === 'P2028') {
      return {
        code: 'IMPORT_TX_TIMEOUT',
        message:
          'A importação demorou demais e foi cancelada. Nenhuma transação foi criada. Tente um extrato menor.',
      }
    }
    return {
      code: 'IMPORT_DB_ERROR',
      message:
        'Erro no banco de dados durante a importação. Nenhuma transação foi criada. Tente de novo.',
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      code: 'IMPORT_DB_VALIDATION',
      message:
        'Erro ao gravar a importação. Nenhuma transação foi criada. Tente de novo.',
    }
  }
  // Erros de parse/validação do OFX lançados pelo orchestrator (mensagens técnicas
  // conhecidas: "OFX sem LEDGERBAL/DTASOF — abort", "OFX sem transações — abort").
  const raw = err instanceof Error ? err.message : ''
  if (/OFX sem|DTASOF|LEDGERBAL|sem transaç|abort/i.test(raw)) {
    return {
      code: 'IMPORT_OFX_PARSE',
      message:
        'Não consegui ler esse OFX (formato inesperado, sem saldo ou sem período). Confira o arquivo ou gere outro export — ou use a importação por PDF.',
    }
  }
  return {
    code: 'IMPORT_FAILED',
    message: 'Falha ao importar o extrato. Nenhuma transação foi criada. Tente de novo.',
  }
}
