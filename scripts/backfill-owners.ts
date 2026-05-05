// Backfill: usuários existentes viram OWNER de suas empresas (Sub-etapa 5.3.A).
//
// Estratégia v1: TODOS os users já em UserCompany ganham role OWNER no
// UserCompanyRole. Sem distinguir "creator" original (não temos esse dado).
// Justificativa: o campo legacy `UserCompany.role` já default = "OWNER" pra
// todo registro existente, então a equivalência é fiel.
//
// IDEMPOTENTE: rodar 2x não duplica.
// APENAS INSERT — nunca deleta dados existentes.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  BACKFILL OWNERS — Sub-etapa 5.3.A')
  console.log('═══════════════════════════════════════════════\n')

  const ownerRole = await prisma.role.findFirst({
    where: { name: 'OWNER', companyId: null, isSystemDefault: true },
  })

  if (!ownerRole) {
    throw new Error('❌ Role OWNER não encontrada. Rode npx tsx scripts/seed-rbac.ts antes.')
  }

  console.log(`✅ Role OWNER encontrada: ${ownerRole.id}\n`)

  const userCompanies = await prisma.userCompany.findMany()
  console.log(`📋 ${userCompanies.length} relação(ões) UserCompany encontrada(s).\n`)

  if (userCompanies.length === 0) {
    console.log('⚠️  Nenhum UserCompany existente. Pulando backfill.')
    return
  }

  let criados = 0
  let pulados = 0

  for (const uc of userCompanies) {
    const existing = await prisma.userCompanyRole.findUnique({
      where: { userId_companyId: { userId: uc.userId, companyId: uc.companyId } },
    })

    if (existing) {
      pulados++
      continue
    }

    await prisma.userCompanyRole.create({
      data: {
        userId: uc.userId,
        companyId: uc.companyId,
        roleId: ownerRole.id,
      },
    })
    criados++
  }

  console.log(`✅ ${criados} UserCompanyRole criadas com role OWNER`)
  console.log(`⏭️  ${pulados} já existiam (idempotente, OK)`)
  console.log('')
  console.log('🎯 Próximo passo: backfill-competence-date.ts')
}

main()
  .catch((e) => {
    console.error('❌ ERRO:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
