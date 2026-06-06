// Sprint Retirada-Conciliação-Fix: resolve categoria PJ a setar na tx PJ
// quando uma ponte PJ→PF é criada.
//
// Antes (bug): create da ponte criava entrada PF + entry PJtoPFBridge MAS
// NÃO setava categoryId na tx PJ. Filtro Conciliação categoryId IS NULL
// continuava retornando a tx → "voltava" pra fila pós-retirada.
//
// Mapeamento por kind (ver lib/bridges/kind-defaults.ts pra dreGroup):
//   PRO_LABORE       → "Pró-labore" (DESPESAS_PESSOAL, afeta DRE)
//   DISTRIBUICAO     → "Distribuição de Lucros" (DISTRIBUICAO_LUCROS, não DRE)
//   ADIANTAMENTO     → "Distribuição de Lucros" (não DRE)
//   RETIRADA_SOCIOS  → "Distribuição de Lucros" (não DRE)
//   REEMBOLSO        → null (user escolhe — Reembolso depende do que foi
//                       reembolsado, kind-defaults já sinaliza null)
//
// Fail-open: se nenhuma categoria existir, retorna null. Não bloqueia
// criação da ponte. UI/relatório lida com null (mostra "Sem categoria").

import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

interface CategoryPick {
  /** Termos a buscar no nome (case-insensitive) — ordem = preferência. */
  nameKeywords: string[]
  /** dreGroup esperado pra reforçar match. */
  expectedDreGroup: string
}

// Por kind, qual nome procurar
const KIND_TO_PICK: Record<string, CategoryPick | null> = {
  PRO_LABORE: {
    nameKeywords: ['pró-labore', 'pro-labore', 'prolabore', 'pro labore'],
    expectedDreGroup: 'DESPESAS_PESSOAL',
  },
  DISTRIBUICAO: {
    nameKeywords: ['distribuição de lucros', 'distribuicao de lucros'],
    expectedDreGroup: 'DISTRIBUICAO_LUCROS',
  },
  ADIANTAMENTO: {
    nameKeywords: ['distribuição de lucros', 'distribuicao de lucros'],
    expectedDreGroup: 'DISTRIBUICAO_LUCROS',
  },
  RETIRADA_SOCIOS: {
    nameKeywords: ['distribuição de lucros', 'distribuicao de lucros'],
    expectedDreGroup: 'DISTRIBUICAO_LUCROS',
  },
  // REEMBOLSO: null — kind-defaults já marca suggestedPjDreGroup como null
  REEMBOLSO: null,
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Resolve categoria PJ pra setar na tx PJ ao criar ponte.
 * Retorna null se kind=REEMBOLSO (user escolhe) ou se nenhuma categoria
 * candidata existe na empresa.
 */
export async function resolvePjCategoryForKind(
  tx: Tx,
  companyId: string,
  kind: string,
): Promise<string | null> {
  const pick = KIND_TO_PICK[kind]
  if (!pick) return null

  // 1ª tentativa: por nome + dreGroup esperado + ativa
  const candidates = await tx.category.findMany({
    where: {
      companyId,
      isActive: true,
      dreGroup: pick.expectedDreGroup,
    },
    select: { id: true, name: true },
  })
  if (candidates.length === 0) return null

  // Match por nome (ordem das keywords = preferência)
  for (const kw of pick.nameKeywords) {
    const normKw = normalize(kw)
    const found = candidates.find((c) => normalize(c.name).includes(normKw))
    if (found) return found.id
  }

  // Fallback: primeira do dreGroup (ordem alfabética determinística)
  candidates.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return candidates[0].id
}
