// Sprint 5.0.3.0a — Função pura que constrói o `where` Prisma do GET
// /api/contas-a-pagar a partir dos searchParams validados.
//
// Extraído pra TESTAR isoladamente (sem DB) — protege contra regressão
// em filtro multi-tenant / multi-select / período / busca textual.

import { z } from 'zod'
import { whereDoStatus } from './escopo'

export const dataFieldEnum = z.enum([
  'dueDate', // padrão — data esperada de pagamento
  'paymentDate', // data efetiva do pagamento (PAID)
  'date', // data principal (= paymentDate quando EFFECTED)
  'competenceDate', // regime competência (CFC)
])

export const sortByEnum = z.enum([
  'dueDate',
  'paymentDate',
  'amount',
  'description',
  'createdAt',
])

export const listPayableSchema = z.object({
  empresaId: z.string().cuid(),

  // Paginação
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),

  // Filtros de período
  dataDe: z.string().date().optional(), // YYYY-MM-DD
  dataAte: z.string().date().optional(),
  dataField: dataFieldEnum.default('dueDate'),

  // Status / scope
  status: z.enum(['PENDING', 'RECONCILED', 'IGNORED', 'TODOS']).optional(),
  /**
   * ⭐⭐⭐ O RECORTE DOS TRÊS STATS (13/09) — **o número É o filtro**.
   *
   * O dono: *"clicar no stat = a lista filtra naquele exato conjunto; card diz 34, lista
   * mostra 34"*. Sem isto, o card e a lista tinham réguas diferentes e o dono via um
   * número no topo e outro na tabela — a doença que este sprint inteiro conserta.
   */
  escopo: z.enum(['VENCIDA', 'A_PAGAR', 'PAGA']).optional(),
  /** @deprecated use `escopo=VENCIDA` — mantido pra link antigo não quebrar */
  vencidasOnly: z.coerce.boolean().default(false),

  // Multi-selects (CSV no querystring: "?supplierIds=a,b,c")
  supplierIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
  employeeIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
  categoryIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
  bankAccountIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),
  origins: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : undefined)),

  // Busca + valor
  q: z.string().optional(),
  valorMin: z.coerce.number().optional(),
  valorMax: z.coerce.number().optional(),

  // Sort
  sortBy: sortByEnum.default('dueDate'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
})

export type ListPayableInput = z.infer<typeof listPayableSchema>

/**
 * Constrói o `where` Prisma com:
 *   - Multi-tenant guard via OR em supplier/employee/category/bankAccount.companyId
 *   - Escopo "Contas a Pagar": PAYABLE (a pagar) OR EFFECTED que nasceu de PAYABLE
 *     (paga via mark_paid ou Excel isPaid). Identificada por dueDate IS NOT NULL
 *     + type=DEBIT + reconciledWithId IS NULL. Bug-fix 28/05/2026.
 *   - Filtros aplicados condicionalmente
 *   - Período no campo escolhido (dataField)
 *   - Busca textual case-insensitive em description + supplier
 *
 * IMPORTANTE: NUNCA retornar where sem o lifecycle scope E o OR multi-tenant.
 */
export function buildPayableListWhere(
  input: ListPayableInput,
  now: Date = new Date(),
): Record<string, unknown> {
  const { empresaId } = input

  // Escopo "Contas a Pagar" (lifecycle scope):
  //   - PAYABLE: contas pendentes, comportamento original
  //   - EFFECTED com dueDate+type=DEBIT+sem conciliação: contas que JÁ foram
  //     pagas mas nasceram como conta a pagar (via mark_paid ou Excel isPaid).
  //     Antes do bug-fix 28/05/2026 ficavam PAYABLE+paymentDate. Após o fix
  //     viram EFFECTED. Mantemos visíveis aqui pra UX de histórico.
  //     reconciledWithId IS NULL exclui as conciliadas com OFX (que aparecem
  //     em /movimentacoes).
  const lifecycleScope = {
    OR: [
      { lifecycle: 'PAYABLE' },
      {
        lifecycle: 'EFFECTED',
        dueDate: { not: null },
        type: 'DEBIT',
        reconciledWithId: null,
      },
    ],
  }

  // Multi-tenant guard — bankAccountId pode ser null em PAYABLE.
  const multiTenantOR = [
    { bankAccount: { companyId: empresaId } },
    { supplier: { companyId: empresaId } },
    { employee: { companyId: empresaId } },
    { customer: { companyId: empresaId } },
    { category: { companyId: empresaId } },
  ]

  // Combina via AND (lifecycleScope precisa do próprio OR + multi-tenant tem o seu)
  const where: Record<string, unknown> = {
    AND: [{ OR: multiTenantOR }, lifecycleScope],
  }

  // Status
  if (input.status && input.status !== 'TODOS') {
    where.status = input.status
  }
  /**
   * ⭐⭐ O RECORTE VEM DO DONO ÚNICO — o mesmo `whereDoStatus` dos stats e do aging.
   *
   * ⚠️ Entra no `AND` (nunca por spread): o fragmento de A_PAGAR tem `OR` próprio, e
   * spread apagaria o OR multi-tenant — o Bug #1 de 5.0.3.1, que já vazou tx de outra
   * empresa uma vez.
   */
  if (input.escopo) {
    ;(where.AND as Array<Record<string, unknown>>).push(whereDoStatus(input.escopo, now))
  } else if (input.vencidasOnly) {
    // ⚠️ o caminho velho segue vivo pra link antigo, mas lendo a MESMA régua — não dá
    // pra ele voltar a discordar do card
    ;(where.AND as Array<Record<string, unknown>>).push(whereDoStatus('VENCIDA', now))
  }

  // Período no campo escolhido
  if (input.dataDe || input.dataAte) {
    const range: Record<string, Date> = {}
    if (input.dataDe) range.gte = new Date(`${input.dataDe}T00:00:00.000Z`)
    if (input.dataAte) range.lte = new Date(`${input.dataAte}T23:59:59.999Z`)
    where[input.dataField] = range
  }

  // Multi-selects (in[])
  if (input.supplierIds?.length)
    where.supplierId = { in: input.supplierIds }
  if (input.employeeIds?.length)
    where.employeeId = { in: input.employeeIds }
  if (input.categoryIds?.length)
    where.categoryId = { in: input.categoryIds }
  if (input.bankAccountIds?.length)
    where.bankAccountId = { in: input.bankAccountIds }
  if (input.origins?.length) where.origin = { in: input.origins }

  // Busca textual: description OR supplier.razaoSocial OR employee.nome
  // Bug-fix 28/05/2026: where.AND já contém [multiTenantOR, lifecycleScope].
  // Adicionamos um terceiro elemento com o OR da busca.
  if (input.q && input.q.trim()) {
    const q = input.q.trim()
    const existingAND = where.AND as Array<Record<string, unknown>>
    existingAND.push({
      OR: [
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        {
          supplier: {
            OR: [
              { razaoSocial: { contains: q, mode: 'insensitive' } },
              { nomeFantasia: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
        { employee: { nome: { contains: q, mode: 'insensitive' } } },
      ],
    })
  }

  // Valor (amount range)
  if (input.valorMin !== undefined || input.valorMax !== undefined) {
    const range: Record<string, number> = {}
    if (input.valorMin !== undefined) range.gte = input.valorMin
    if (input.valorMax !== undefined) range.lte = input.valorMax
    where.amount = range
  }

  return where
}

/**
 * Map sortBy → input.orderBy (compat com Prisma). Fica em func separada pra
 * permitir sort em campos relacionados no futuro (ex: supplier.razaoSocial).
 */
export function buildPayableOrderBy(
  input: ListPayableInput,
): Array<Record<string, 'asc' | 'desc'>> {
  return [
    { [input.sortBy]: input.sortDir },
    { createdAt: 'desc' }, // tiebreaker estável
  ]
}
