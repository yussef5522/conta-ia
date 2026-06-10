// Sprint E1 (09/06/2026) — Guard centralizado contra duplicação de grupo TRANSFER.
//
// Bloqueia criação de transferência quando já existe transferGroupId envolvendo:
//   - MESMAS 2 contas (from + to, direção não importa pra dedup)
//   - MESMO valor (±1 centavo)
//   - MESMA data (±1 dia, cobre TED que cai D+1)
//
// Aplicado nos 3 caminhos: createTransfer (manual), createTransferFromOfx
// (Replace OFX), e POST /sugestoes/confirmar (varredura retroativa).
//
// Caso real que motivou: Sprint 0.5 reservou dedupHash no Replace OFX pra evitar
// re-import duplicar. Mas Banrisul recicla FITID + muda memo cosmeticamente entre
// exports → re-import calcula hash NOVO → reserva não dispara → 2ª OFX órfã →
// user pareou de novo achando que era nova → 2 grupos paralelos R$ 34k cada.

import { prisma } from '@/lib/db'
import { TransferValidationError } from './validate'

/**
 * Erro específico de duplicação de grupo TRANSFER. Status 409 (Conflict) +
 * payload estruturado pra UI mostrar link pro grupo existente.
 */
export class DuplicateTransferGroupError extends TransferValidationError {
  status = 409
  code = 'DUPLICATE_TRANSFER_GROUP'
  existing: ExistingGroup
  constructor(message: string, existing: ExistingGroup) {
    super(message)
    this.name = 'DuplicateTransferGroupError'
    this.existing = existing
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const AMOUNT_TOLERANCE = 0.015

export interface DuplicateCheckInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: Date
}

export interface ExistingGroup {
  groupId: string
  fromAccountName: string
  toAccountName: string
  amount: number
  date: Date
}

/**
 * Verifica se já existe um grupo TRANSFER envolvendo o mesmo par de contas,
 * mesmo valor e mesma data (±1 dia). Retorna o primeiro encontrado, ou null.
 *
 * Lógica: busca tx TRANSFER da fromAccount no range de data + valor. Pra cada,
 * confirma se EXISTE outra tx TRANSFER no mesmo transferGroupId com
 * bankAccountId = toAccount. Direção (saída/entrada) NÃO importa pra dedup —
 * "banrisul ↔ stone R$ 34k em 08/jun" só pode acontecer uma vez por dia.
 */
export async function findDuplicateTransferGroup(
  input: DuplicateCheckInput,
): Promise<ExistingGroup | null> {
  const dateStart = new Date(input.date.getTime() - ONE_DAY_MS)
  const dateEnd = new Date(input.date.getTime() + ONE_DAY_MS)
  const amountMin = input.amount - AMOUNT_TOLERANCE
  const amountMax = input.amount + AMOUNT_TOLERANCE

  // 1ª pesquisa: tx TRANSFER em UMA das 2 contas com valor+data próximos.
  // Ordena por createdAt asc pra retornar o grupo mais antigo (o "original").
  const candidates = await prisma.transaction.findMany({
    where: {
      type: 'TRANSFER',
      transferGroupId: { not: null },
      bankAccountId: { in: [input.fromAccountId, input.toAccountId] },
      amount: { gte: amountMin, lte: amountMax },
      date: { gte: dateStart, lte: dateEnd },
    },
    select: {
      transferGroupId: true,
      bankAccountId: true,
      amount: true,
      date: true,
      bankAccount: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (candidates.length === 0) return null

  // Agrupa por transferGroupId; só vira "duplicata" se AS 2 contas (from + to)
  // estiverem presentes no mesmo grupo. Cobre tanto direção banrisul→stone
  // quanto stone→banrisul (qualquer uma é considerada duplicata).
  const groupMap = new Map<
    string,
    { fromName?: string; toName?: string; amount: number; date: Date }
  >()
  for (const c of candidates) {
    if (!c.transferGroupId) continue
    const existing = groupMap.get(c.transferGroupId) ?? {
      amount: c.amount,
      date: c.date,
    }
    if (c.bankAccountId === input.fromAccountId) {
      existing.fromName = c.bankAccount?.name ?? 'conta'
    } else if (c.bankAccountId === input.toAccountId) {
      existing.toName = c.bankAccount?.name ?? 'conta'
    }
    groupMap.set(c.transferGroupId, existing)
  }

  for (const [gid, g] of groupMap) {
    if (g.fromName && g.toName) {
      return {
        groupId: gid,
        fromAccountName: g.fromName,
        toAccountName: g.toName,
        amount: g.amount,
        date: g.date,
      }
    }
  }
  return null
}

/**
 * Lança TransferValidationError se já existir grupo duplicado.
 * Wrapper do find pra encaixar no flow de validação dos caminhos.
 */
export async function assertNoDuplicateTransferGroup(
  input: DuplicateCheckInput,
): Promise<void> {
  const existing = await findDuplicateTransferGroup(input)
  if (!existing) return

  const dia = existing.date.toISOString().slice(0, 10).split('-').reverse().join('/')
  throw new DuplicateTransferGroupError(
    `Esta transferência (R$ ${existing.amount.toFixed(2)}, ${existing.fromAccountName} ↔ ${existing.toAccountName}, ${dia}) já foi pareada em outro grupo (${existing.groupId.slice(0, 8)}). Não vou criar de novo pra não duplicar. Se for uma transferência DIFERENTE com mesmo valor, abra /transferencias e desfaça a errada primeiro.`,
    existing,
  )
}
