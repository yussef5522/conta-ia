import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { empresaSchema } from '@/lib/validations/empresa'
import { aplicarTemplate } from '@/lib/categories/defaults'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  // ⭐⭐ AS DUAS PORTAS DE VÍNCULO (30/08/2026) — foi o que deixou a convidada sem empresa.
  //
  // ⚠️ O BUG REAL, e ele é estrutural: existir vínculo em `UserCompany` (o modelo ANTIGO)
  // e em `UserCompanyRole` (o do RBAC) não é novidade — o próprio CLAUDE.md registra que
  // "linked tem DUAS portas" no caso das parcelas de empréstimo. **Aqui a listagem lia só
  // a porta antiga**, e o convite grava só a nova. Resultado: a pessoa aceita o convite,
  // vira membro de verdade (as rotas de estoque a reconhecem, 200) e **a empresa não
  // aparece no seletor dela** — workspace vazio com acesso funcionando por baixo.
  //
  // Lê as DUAS e deduplica. Enquanto as duas tabelas existirem, quem responde "de quais
  // empresas eu sou?" tem que olhar as duas — checar UMA foi o bug de 14/08 outra vez.
  const SELECT = {
    id: true, cnpj: true, name: true, tradeName: true,
    type: true, taxRegime: true, isActive: true, createdAt: true,
  } as const

  const [legado, porPapel] = await Promise.all([
    prisma.userCompany.findMany({
      where: { userId: user.sub },
      include: { company: { select: SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userCompanyRole.findMany({
      where: { userId: user.sub },
      include: { company: { select: SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const porId = new Map<string, (typeof legado)[number]['company']>()
  for (const uc of legado) porId.set(uc.company.id, uc.company)
  for (const ucr of porPapel) porId.set(ucr.company.id, ucr.company)

  return NextResponse.json({ empresas: [...porId.values()] })
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
          // Sprint 5.0.2.l — setor pra Knowledge Base. Fallback derivado de type:
          // RESTAURANT → RESTAURANTE; RETAIL/MIXED → VAREJO_GERAL; outros → null.
          setor:
            (data.setor as string | null | undefined) ||
            ({
              RESTAURANT: 'RESTAURANTE',
              RETAIL: 'VAREJO_GERAL',
              MIXED: 'VAREJO_GERAL',
            } as Record<string, string>)[data.type] ||
            null,
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
