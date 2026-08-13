// Sprint Entrada-Fixa-Ponte (13/08/2026) — resolve NO SERVIDOR a categoria PF de
// ENTRADA da ponte ("dinheiro da empresa entrando no PF"). Antes o campo era
// livre na tela (CategoryCombobox com "criar nova") → o usuário criava 3
// categorias pra mesma coisa sem perceber. Agora o servidor decide; a tela não
// escolhe, não digita, não cria.
//
// MARCADOR ESTÁVEL: acha por systemSlug='BRIDGE_ENTRY' (NÃO por nome). O usuário
// pode RENOMEAR a categoria (ex: "Retirada da Caçula") — o slug garante que
// continua sendo a mesma; o get-or-create nunca cria uma segunda.
//
// Idempotência: @@unique([profileId, systemSlug]) no DB. Roda FORA do
// $transaction da ponte (com retry no P2002) pra um race não envenenar a tx.

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { BRIDGE_ENTRY_SLUG, BRIDGE_ENTRY_DEFAULT_NAME } from './entry-category-slug'

export { BRIDGE_ENTRY_SLUG, BRIDGE_ENTRY_DEFAULT_NAME }

/**
 * Retorna o id da categoria PF INCOME canônica de entrada da ponte do perfil.
 * Cria (marcada com o slug) se ainda não existir. Rename-proof + idempotente.
 */
export async function getOrCreateBridgeEntryCategory(profileId: string): Promise<string> {
  const found = await prisma.personalCategory.findFirst({
    where: { profileId, systemSlug: BRIDGE_ENTRY_SLUG },
    select: { id: true },
  })
  if (found) return found.id

  try {
    const created = await prisma.personalCategory.create({
      data: {
        profileId,
        name: BRIDGE_ENTRY_DEFAULT_NAME,
        type: 'INCOME',
        color: '#059669',
        icon: 'Briefcase',
        isDefault: true,
        systemSlug: BRIDGE_ENTRY_SLUG,
      },
      select: { id: true },
    })
    return created.id
  } catch (err) {
    // Race: outra criação simultânea ganhou o unique (profileId, systemSlug).
    // Não é erro — só relê a que ficou.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await prisma.personalCategory.findFirst({
        where: { profileId, systemSlug: BRIDGE_ENTRY_SLUG },
        select: { id: true },
      })
      if (again) return again.id
    }
    throw err
  }
}
