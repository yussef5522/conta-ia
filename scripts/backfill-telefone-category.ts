// Sprint Retirada-Despesa-PF — Backfill da categoria "Telefone/Celular"
// nos perfis PF existentes.
//
// Por quê: a categoria foi adicionada como 13ª default em
// lib/personal-profile/default-categories.ts, mas perfis criados ANTES
// dessa mudança não a têm. Script idempotente: se categoria já existe
// no perfil, NÃO cria duplicata.
//
// Rodar: npx tsx scripts/backfill-telefone-category.ts
// (em prod, depois de prisma migrate deploy)

import { prisma } from '@/lib/db'

const TELEFONE_NAME = 'Telefone/Celular'
const TELEFONE_COLOR = '#0891b2'
const TELEFONE_ICON = 'Phone'

async function main() {
  console.log('🔍 Backfill categoria Telefone/Celular em perfis PF existentes')

  const profiles = await prisma.personalProfile.findMany({
    select: { id: true, name: true },
  })
  console.log(`📋 ${profiles.length} perfis encontrados`)

  let created = 0
  let skipped = 0

  for (const profile of profiles) {
    // Idempotente: pula se já existe (qualquer name match exato)
    const existing = await prisma.personalCategory.findFirst({
      where: { profileId: profile.id, name: TELEFONE_NAME },
      select: { id: true },
    })
    if (existing) {
      skipped++
      console.log(`  ⏭  ${profile.name}: já tem "${TELEFONE_NAME}"`)
      continue
    }

    await prisma.personalCategory.create({
      data: {
        profileId: profile.id,
        name: TELEFONE_NAME,
        type: 'EXPENSE',
        color: TELEFONE_COLOR,
        icon: TELEFONE_ICON,
        isDefault: true,
        isActive: true,
      },
    })
    created++
    console.log(`  ✅ ${profile.name}: criada "${TELEFONE_NAME}"`)
  }

  console.log('')
  console.log(`📊 Resultado: ${created} criadas · ${skipped} já existiam`)
  console.log('✅ Backfill concluído')
}

main()
  .catch((err) => {
    console.error('❌ Erro:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
