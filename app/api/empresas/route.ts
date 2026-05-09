import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { empresaSchema } from '@/lib/validations/empresa'
import { aplicarTemplate } from '@/lib/categories/defaults'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const userCompanies = await prisma.userCompany.findMany({
    where: { userId: user.sub },
    include: {
      company: {
        select: {
          id: true,
          cnpj: true,
          name: true,
          tradeName: true,
          type: true,
          taxRegime: true,
          isActive: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const empresas = userCompanies.map((uc) => uc.company)

  return NextResponse.json({ empresas })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = empresaSchema.parse(body)

    // Verifica se o CNPJ já existe
    const cnpjNums = data.cnpj.replace(/\D/g, '')
    const existente = await prisma.company.findUnique({ where: { cnpj: cnpjNums } })
    if (existente) {
      return NextResponse.json(
        { erro: 'CNPJ já cadastrado', campos: { cnpj: 'Este CNPJ já está cadastrado' } },
        { status: 409 }
      )
    }

    // Cria empresa + vínculos (UserCompany legacy + UserCompanyRole RBAC) +
    // aplica template de plano de contas (hierarquia, DRE groups, códigos SPED
    // e visibleInRegimes) em uma transação atômica.
    const empresa = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          cnpj: cnpjNums,
          name: data.name,
          tradeName: data.tradeName || null,
          type: data.type,
          taxRegime: data.taxRegime,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zipCode: data.zipCode || null,
          users: {
            create: { userId: user.sub, role: 'OWNER' },
          },
        },
      })

      // RBAC: também atribui role OWNER (system default) via UserCompanyRole.
      // Sem isso, getAuthContext (lib/auth/rbac.ts) retorna 403 em todos os
      // endpoints novos. UserCompany legacy continua criado pra compat com
      // listagem (GET /api/empresas) e outros consumidores ainda não migrados.
      const ownerRole = await tx.role.findFirst({
        where: { name: 'OWNER', companyId: null, isSystemDefault: true },
      })
      if (!ownerRole) {
        throw new Error(
          'Role OWNER (system default) não encontrada. Rode npx tsx scripts/seed-rbac.ts.'
        )
      }
      await tx.userCompanyRole.create({
        data: {
          userId: user.sub,
          companyId: created.id,
          roleId: ownerRole.id,
        },
      })

      await aplicarTemplate(tx, created.id, data.type)
      return created
    })

    return NextResponse.json({ empresa }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => {
        if (e.path[0]) campos[e.path[0] as string] = e.message
      })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[EMPRESAS POST] Erro interno:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
