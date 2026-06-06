// GET /api/empresas/[id]/withdrawal-context
//
// Sprint Retirada-1-Clique — payload único pra UI montar os dropdowns
// da aba "Retirada" sem precisar fazer N requests.
//
// Retorna:
//   - sócios cadastrados (SocioPF) — usado pra suggest + dropdown
//   - perfis PF DO USER (UserPersonalProfile com isSelf=true OU OWNER)
//   - contas PF por perfil (PersonalBankAccount)
//   - categorias PF INCOME por perfil (PersonalCategory)
//
// Privacidade Fatia 4 mantida: só perfis com role OWNER aparecem (não
// vaza outros perfis de outros sócios).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const userId = ctx.user.id

    // Sócios da empresa (cadastro público — todos os users da empresa veem)
    const socios = await prisma.socioPF.findMany({
      where: { companyId: empresaId },
      select: {
        id: true,
        nome: true,
        cpf: true,
        pixKeys: true,
        papel: true,
      },
      orderBy: { nome: 'asc' },
    })

    // Perfis PF DO USER (privacidade: só os que ele é OWNER)
    const userProfiles = await prisma.userPersonalProfile.findMany({
      where: { userId, role: 'OWNER' },
      include: {
        profile: {
          include: {
            bankAccounts: {
              where: { isActive: true },
              select: { id: true, name: true, bankName: true },
              orderBy: { name: 'asc' },
            },
            categories: {
              where: { isActive: true, type: 'INCOME' },
              select: { id: true, name: true },
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    })

    const profiles = userProfiles
      .filter((up) => up.profile !== null)
      .map((up) => ({
        id: up.profile.id,
        name: up.profile.name,
        cpf: up.profile.cpf,
        type: up.profile.type,
        accounts: up.profile.bankAccounts,
        incomeCategories: up.profile.categories,
      }))

    return NextResponse.json({
      socios: socios.map((s) => ({
        id: s.id,
        nome: s.nome,
        cpf: s.cpf,
        papel: s.papel,
        pixKeys: (() => {
          try {
            const arr = JSON.parse(s.pixKeys ?? '[]')
            return Array.isArray(arr) ? arr.filter((k) => typeof k === 'string') : []
          } catch {
            return []
          }
        })(),
      })),
      profiles,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
