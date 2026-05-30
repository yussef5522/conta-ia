// Sprint 5.0.2.3 — Mapeamento códigos de erro → mensagens humanas PT-BR.
//
// Filosofia: nunca mostrar stack trace ou "HTTP 500" pro usuário. Cada erro
// tem código estável (snake_case UPPER) usado por cliente E servidor pra
// internacionalização e exibição consistente.

export type ErrorCode =
  | 'FILE_REQUIRED'
  | 'FILE_TOO_LARGE'
  | 'FILE_TYPE_INVALID'
  | 'FILE_CORRUPTED'
  | 'PARSE_FAILED'
  | 'EMPTY_FILE'
  | 'TOO_MANY_ROWS'
  | 'DUPLICATE_BATCH'
  | 'BATCH_NOT_FOUND'
  | 'BATCH_ALREADY_CONFIRMED'
  | 'BATCH_EMPTY'
  | 'NOT_AUTHENTICATED'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
  // Sprint CSV Import (30/05/2026)
  | 'CSV_HEADER_DESCONHECIDO'
  | 'CSV_DECODE_FAILED'

interface ErrorInfo {
  /** Mensagem curta (1 linha) — vira título do alert. */
  title: string
  /** Detalhe humano — vira corpo do alert. */
  description: string
  /** True se o usuário pode tentar de novo sem mudar nada. */
  retryable: boolean
}

const ERROR_MESSAGES: Record<ErrorCode, ErrorInfo> = {
  FILE_REQUIRED: {
    title: 'Nenhum arquivo selecionado',
    description: 'Clique no dropzone ou arraste a planilha Excel pra cá.',
    retryable: false,
  },
  FILE_TOO_LARGE: {
    title: 'Arquivo muito grande',
    description:
      'O limite é 10MB. Reduza o tamanho ou divida a planilha em arquivos menores.',
    retryable: false,
  },
  FILE_TYPE_INVALID: {
    title: 'Formato não suportado',
    description:
      'Envie uma planilha Excel (.xlsx, .xls) ou CSV. PDF e outros formatos ainda não são aceitos.',
    retryable: false,
  },
  FILE_CORRUPTED: {
    title: 'Arquivo parece corrompido',
    description:
      'O arquivo não tem a assinatura de um Excel ou CSV válido. Tente abrir/salvar de novo ou enviar outra cópia.',
    retryable: false,
  },
  // Sprint CSV Import (30/05/2026)
  CSV_HEADER_DESCONHECIDO: {
    title: 'Header CSV não reconhecido',
    description:
      'O CSV foi lido mas o formato do cabeçalho não bate com nenhum conhecido. Vou tentar mapear com IA — pode ter erros, revise no preview.',
    retryable: false,
  },
  CSV_DECODE_FAILED: {
    title: 'Não conseguimos decodificar o CSV',
    description:
      'O arquivo precisa estar em UTF-8 (Excel BR salva por padrão). Re-salve como "CSV UTF-8" e tente de novo.',
    retryable: false,
  },
  PARSE_FAILED: {
    title: 'Não conseguimos ler a planilha',
    description:
      'Verifique se ela não está protegida por senha e se o cabeçalho está na primeira linha.',
    retryable: true,
  },
  EMPTY_FILE: {
    title: 'Planilha sem dados',
    description:
      'A planilha está vazia ou só tem cabeçalho. Verifique se há linhas além da primeira.',
    retryable: false,
  },
  TOO_MANY_ROWS: {
    title: 'Planilha muito grande',
    description:
      'O limite é 5000 linhas por planilha. Divida em arquivos menores e suba um de cada vez.',
    retryable: false,
  },
  DUPLICATE_BATCH: {
    title: 'Planilha já enviada',
    description:
      'Esta planilha já foi importada anteriormente. Retomando o batch existente.',
    retryable: false,
  },
  BATCH_NOT_FOUND: {
    title: 'Batch não encontrado',
    description: 'O batch pode ter sido removido. Suba a planilha de novo.',
    retryable: false,
  },
  BATCH_ALREADY_CONFIRMED: {
    title: 'Batch já confirmado',
    description:
      'Essa planilha já foi importada e confirmada antes. Veja em Contas a Pagar.',
    retryable: false,
  },
  BATCH_EMPTY: {
    title: 'Batch sem linhas válidas',
    description: 'Todas as linhas foram filtradas (subtotais/vazias).',
    retryable: false,
  },
  NOT_AUTHENTICATED: {
    title: 'Sessão expirou',
    description: 'Faça login de novo pra continuar.',
    retryable: false,
  },
  FORBIDDEN: {
    title: 'Sem permissão',
    description: 'Você não tem permissão pra importar contas nesta empresa.',
    retryable: false,
  },
  NETWORK_ERROR: {
    title: 'Erro de rede',
    description:
      'Não foi possível alcançar o servidor. Verifique sua conexão e tente novamente.',
    retryable: true,
  },
  TIMEOUT: {
    title: 'Tempo esgotado',
    description:
      'O servidor demorou demais pra responder. Tente novamente — se persistir, a planilha pode ser muito complexa.',
    retryable: true,
  },
  INTERNAL_ERROR: {
    title: 'Erro inesperado no servidor',
    description:
      'Algo deu errado. Tente novamente. Se o problema continuar, copie o código do erro e avise o suporte.',
    retryable: true,
  },
}

/**
 * Retorna info humana pra um código de erro. Se código desconhecido,
 * retorna INTERNAL_ERROR (fallback seguro).
 */
export function errorInfo(code: string | null | undefined): ErrorInfo {
  if (code && code in ERROR_MESSAGES) {
    return ERROR_MESSAGES[code as ErrorCode]
  }
  return ERROR_MESSAGES.INTERNAL_ERROR
}

/**
 * Retorna o código de erro mais apropriado pra um status HTTP.
 * Usado quando o backend não devolveu code explícito (sistemas legados).
 */
export function codeFromStatus(status: number): ErrorCode {
  if (status === 401) return 'NOT_AUTHENTICATED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'BATCH_NOT_FOUND'
  if (status === 409) return 'BATCH_ALREADY_CONFIRMED'
  if (status === 413) return 'FILE_TOO_LARGE'
  if (status === 415) return 'FILE_TYPE_INVALID'
  if (status === 422) return 'PARSE_FAILED'
  if (status >= 500) return 'INTERNAL_ERROR'
  return 'INTERNAL_ERROR'
}
