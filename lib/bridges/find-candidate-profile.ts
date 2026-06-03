// Sprint PF Fatia 4 — Detecta perfil PF candidato pra ponte.
//
// 🔒 PRIVACIDADE MULTI-SÓCIO (decisão D do plano §0.b):
// SEMPRE filtra pelo userId logado. Sócio B nunca recebe sugestão pra
// CPF de sócio A da mesma empresa, mesmo que o CPF de A bate com algum
// PersonalProfile cadastrado por A.
//
// Algoritmo:
// 1. Tx PJ precisa ter relatedPartyType='SOCIO_PF' (vem do 5.0.2.h).
// 2. Busca SocioPF pelo relatedPartyId — precisa ter CPF.
// 3. Normaliza CPF (remove pontos/traços) e busca PersonalProfile com
//    cpf normalizado igual + type='OWN' + linkado ao userId via
//    UserPersonalProfile.
// 4. Se múltiplos perfis batem (raro), retorna o 1º isSelf=true.

import { prisma } from '@/lib/db'
import type { BridgeCandidate } from './types'
import { suggestKindFromSocioPapel } from './kind-defaults'
import type { Transaction as PjTransaction } from '@prisma/client'

/** Remove pontos/traços/espaços do CPF pra comparação. */
export function normalizeCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return null
  return digits
}

export interface FindCandidateInput {
  pjTransactionId: string
  userId: string
}

/**
 * Retorna candidate de ponte SE:
 *  - Tx PJ tem relatedPartyType='SOCIO_PF'
 *  - SocioPF associado tem CPF válido
 *  - User logado tem PersonalProfile OWN com mesmo CPF (via UserPersonalProfile)
 *
 * Retorna null em qualquer outra situação (sem revelar por quê).
 */
export async function findCandidateProfile(
  input: FindCandidateInput,
): Promise<BridgeCandidate | null> {
  const pjTx = await prisma.transaction.findUnique({
    where: { id: input.pjTransactionId },
    include: {
      bankAccount: true,
    },
  })

  if (!pjTx) return null
  if (pjTx.type !== 'DEBIT') return null
  if (pjTx.lifecycle !== 'EFFECTED') return null
  if (pjTx.isInternalTransfer) return null
  if (pjTx.transferGroupId) return null
  if (pjTx.relatedPartyType !== 'SOCIO_PF') return null
  if (!pjTx.relatedPartyId) return null

  // Conferir que tx já não tem bridge.
  const existingBridge = await prisma.pJtoPFBridge.findUnique({
    where: { pjTransactionId: pjTx.id },
  })
  if (existingBridge) return null

  // Buscar SocioPF + CPF
  const socioPF = await prisma.socioPF.findUnique({
    where: { id: pjTx.relatedPartyId },
  })
  if (!socioPF || !socioPF.cpf) return null

  const cpfNormalized = normalizeCpf(socioPF.cpf)
  if (!cpfNormalized) return null

  // 🔒 BUSCA filtrada por userId (privacidade multi-sócio)
  const userLink = await prisma.userPersonalProfile.findFirst({
    where: {
      userId: input.userId,
      profile: {
        type: 'OWN',
        isActive: true,
        // Não temos comparação normalizada no DB — comparamos abaixo
      },
    },
    include: {
      profile: {
        include: {
          bankAccounts: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          categories: {
            where: { isActive: true, type: 'INCOME' },
            orderBy: { isDefault: 'desc' },
          },
        },
      },
    },
    orderBy: { isSelf: 'desc' },
  })

  // Filtra app-layer: precisa bater CPF normalizado
  // (varremos todos os perfis do user em vez de pingar query separada)
  const allUserLinks = await prisma.userPersonalProfile.findMany({
    where: { userId: input.userId },
    include: {
      profile: {
        include: {
          bankAccounts: {
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
          categories: {
            where: { isActive: true, type: 'INCOME' },
            orderBy: { isDefault: 'desc' },
          },
        },
      },
    },
    orderBy: { isSelf: 'desc' },
  })

  const matching = allUserLinks.find((link) => {
    const p = link.profile
    if (!p.isActive) return false
    if (p.type !== 'OWN') return false
    const pCpf = normalizeCpf(p.cpf)
    return pCpf === cpfNormalized
  })

  if (!matching) {
    void userLink // evita unused warning (mantém indício de query)
    return null
  }

  const profile = matching.profile
  const sugCat = profile.categories.find((c) =>
    c.name.toLowerCase().includes('pró-labore') ||
    c.name.toLowerCase().includes('lucros') ||
    c.name.toLowerCase().includes('outros'),
  ) ?? profile.categories[0] ?? null

  return {
    pjTransaction: pjTx as PjTransaction,
    socioPF,
    profile,
    suggestedKind: suggestKindFromSocioPapel(socioPF.papel),
    suggestedAccountId: profile.bankAccounts[0]?.id ?? null,
    suggestedCategoryId: sugCat?.id ?? null,
  }
}
