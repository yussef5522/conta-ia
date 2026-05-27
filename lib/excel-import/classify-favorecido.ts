// Sprint 5.0.2.0 — Classifica favorecido em SUPPLIER | EMPLOYEE | ORGAO_PUBLICO.
//
// Estratégia (em ordem de prioridade):
//   1. Se planilha tem coluna `beneficiario_tipo` com valor explícito → confia
//      ("Fornecedores" → SUPPLIER, "Colaboradores" → EMPLOYEE, "Órgãos
//      oficiais" → ORGAO_PUBLICO).
//   2. Heurística por nome:
//      - Keywords órgão público (RECEITA FEDERAL, INSS, FGTS, PREFEITURA,
//        DAS, DARF, IPVA, IPTU) → ORGAO_PUBLICO
//      - Padrão jurídico explícito (LTDA, SA, EIRELI, ME, MEI, EPP, COMERCIO,
//        INDUSTRIA, SERVIÇOS, DISTRIBUIDORA) → SUPPLIER
//      - 2+ palavras maiúsculas com 4+ letras E sem padrão jurídico
//        (típico pessoa física: "ANA CAROLINE", "JOSE LUIS NEDEL") → EMPLOYEE
//      - Caso ambíguo: SUPPLIER (default seguro — usuário corrige se errado)
//   3. Centro de custo é "hint" adicional pra inferir EMPLOYEE.tipo
//      (Salário Estagiário → ESTAGIO, Salário Professor → CLT, etc.)
//
// FUNÇÃO PURA — sem DB, sem fetch, sem state. Testável trivialmente.

export type FavorecidoType = 'SUPPLIER' | 'EMPLOYEE' | 'ORGAO_PUBLICO'
export type EmployeeTipo = 'CLT' | 'ESTAGIO' | 'PJ' | 'AUTONOMO'

export interface ClassifyInput {
  favorecido: string
  beneficiarioTipo?: string | null
  centroCusto?: string | null
}

export interface ClassifyResult {
  type: FavorecidoType
  /** Quando type=EMPLOYEE, tipo do vínculo inferido do centro de custo. */
  employeeTipo?: EmployeeTipo
  /** 0-1 — confidence da decisão. */
  confidence: number
  /** Heurística que pegou (audit/debug). */
  reason: string
}

// Sprint 5.0.2.0 — Cada padrão deve ter \b (word boundary) pra evitar falsos
// positivos tipo "BEBIDAS SA" → DAS S (substring).
const ORGAO_REGEX_PATTERNS: ReadonlyArray<RegExp> = [
  /\bRECEITA FEDERAL\b/i,
  /\bINSS\b/i,
  /\bFGTS\b/i,
  /\bPREFEITURA\b/i,
  /\bMUNIC[ÍI]PIO\b/i,
  /\bGOVERNO\b/i,
  /\bESTADO DE\b/i,
  /\bIPVA\b/i,
  /\bIPTU\b/i,
  /\bISS\b/i,
  /\bDAS\b/i, // word boundary impede match em "BEBIDAS"
  /\bDAS-MEI\b/i,
  /\bDARF\b/i,
  /\bCONFAZ\b/i,
  /\bSECRETARIA\b/i,
  /\bBANCO CENTRAL\b/i,
  /\bINCRA\b/i,
  /\bFUNRURAL\b/i,
  /\bCRA\b/i,
  /\bCFC\b/i,
  /\bCRECI\b/i,
  /\bOAB\b/i,
  /\bCART[ÓO]RIO\b/i,
  /\bTJRS\b/i,
  /\bTRT\b/i,
  /\bJUSTI[ÇC]A\b/i,
]

const JURIDICO_KEYWORDS = [
  ' LTDA',
  ' S.A',
  ' SA',
  ' EIRELI',
  ' ME',
  ' MEI',
  ' EPP',
  ' CIA',
  ' COMERCIO',
  ' COMÉRCIO',
  'COMERCIO DE',
  'INDUSTRIA',
  'INDÚSTRIA',
  'SERVIÇOS',
  'SERVICOS',
  'DISTRIBUIDORA',
  'DISTRIBUIDOR',
  'ATACADO',
  'COMERCIAL',
  'IMPORTAÇÃO',
  'IMPORTACAO',
  'EXPORTAÇÃO',
  'EXPORTACAO',
  'SOCIEDADE',
  'ASSOCIAÇÃO',
  'ASSOCIACAO',
  'COOPERATIVA',
]

/** Centro de custo (hints) → EmployeeTipo inferido. */
const EMPLOYEE_TIPO_HINTS: ReadonlyArray<{ regex: RegExp; tipo: EmployeeTipo }> = [
  { regex: /(estagi[áa]rio|estagi[áa]ria|jovem aprendiz)/i, tipo: 'ESTAGIO' },
  { regex: /(autonomo|aut[ôo]nomo|free.?lance|prestador pf)/i, tipo: 'AUTONOMO' },
  { regex: /(pj |pessoa jur[íi]dica|terceirizado)/i, tipo: 'PJ' },
  // sal[áa]rio professor / recepção / limpeza / motorista / atendente / etc.
  { regex: /^sal[áa]rio/i, tipo: 'CLT' },
  { regex: /(folha pagamento|folha de pagamento|13[°º] sal|f[ée]rias)/i, tipo: 'CLT' },
]

function upper(s: string | null | undefined): string {
  return (s ?? '').toUpperCase().trim()
}

export function classifyFavorecido(input: ClassifyInput): ClassifyResult {
  const fav = upper(input.favorecido)
  const tipo = upper(input.beneficiarioTipo)
  const cc = upper(input.centroCusto)

  // ────────────────────────────────────────────────────────────────────
  // 1. Coluna explícita beneficiarioTipo (alta confiança quando disponível)
  // ────────────────────────────────────────────────────────────────────
  if (tipo) {
    if (
      tipo.includes('ÓRG') ||
      tipo.includes('ORG') ||
      tipo.includes('OFICIA') ||
      tipo.includes('PÚBLIC') ||
      tipo.includes('PUBLIC')
    ) {
      return {
        type: 'ORGAO_PUBLICO',
        confidence: 0.95,
        reason: `Coluna Beneficiário="${input.beneficiarioTipo}"`,
      }
    }
    if (tipo.includes('COLABORA') || tipo.includes('FUNCIONÁRIO') || tipo.includes('FUNCIONARIO')) {
      const employeeTipo = inferEmployeeTipo(cc)
      return {
        type: 'EMPLOYEE',
        employeeTipo,
        confidence: 0.95,
        reason: `Coluna Beneficiário="${input.beneficiarioTipo}"`,
      }
    }
    if (tipo.includes('FORNECEDOR') || tipo.includes('PRESTADOR') || tipo.includes('PJ')) {
      return {
        type: 'SUPPLIER',
        confidence: 0.95,
        reason: `Coluna Beneficiário="${input.beneficiarioTipo}"`,
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 2. Heurística por nome
  // ────────────────────────────────────────────────────────────────────

  // 2.1 ÓRGÃO PÚBLICO
  if (ORGAO_REGEX_PATTERNS.some((re) => re.test(fav))) {
    return {
      type: 'ORGAO_PUBLICO',
      confidence: 0.9,
      reason: 'Nome contém termo de órgão público (RECEITA/INSS/FGTS/...)',
    }
  }

  // 2.2 EMPRESA (LTDA, SA, COMERCIO, ...)
  if (JURIDICO_KEYWORDS.some((k) => fav.includes(k))) {
    return {
      type: 'SUPPLIER',
      confidence: 0.88,
      reason: 'Nome contém forma jurídica (LTDA/SA/COMERCIO/...)',
    }
  }

  // 2.3 PESSOA FÍSICA — 2+ palavras maiúsculas com 4+ letras E sem forma jurídica
  const palavrasFortes = fav
    .split(/\s+/)
    .filter((p) => p.length >= 4 && /^[A-ZÀ-Ú]+$/i.test(p))
  if (palavrasFortes.length >= 2) {
    const employeeTipo = inferEmployeeTipo(cc)
    return {
      type: 'EMPLOYEE',
      employeeTipo,
      // Confidence menor que coluna explícita (heurística pura)
      confidence: 0.75,
      reason: `Nome de pessoa física (${palavrasFortes.length} palavras-nome detectadas)`,
    }
  }

  // 2.4 Default conservador: SUPPLIER (Yussef corrige se errado)
  return {
    type: 'SUPPLIER',
    confidence: 0.55,
    reason: 'Default conservador — nome curto/ambíguo (ex: marca simples)',
  }
}

export function inferEmployeeTipo(centroCusto: string | null | undefined): EmployeeTipo {
  if (!centroCusto) return 'CLT'
  for (const hint of EMPLOYEE_TIPO_HINTS) {
    if (hint.regex.test(centroCusto)) return hint.tipo
  }
  return 'CLT'
}
