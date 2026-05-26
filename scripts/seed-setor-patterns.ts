// Sprint 5.0.2.l — Runner do seed de SetorPattern.
//
// Uso: npx tsx scripts/seed-setor-patterns.ts
//
// Idempotente: usa upsert via chave natural (setor + matchType + pattern).
// Pode rodar quantas vezes quiser.

import { PrismaClient } from '@prisma/client'
import { SETOR_PATTERNS_SEED } from '../prisma/seeds/setor-patterns'

const prisma = new PrismaClient()

interface SetorPatternKey {
  setor: string
  matchType: string
  pattern: string
}

async function main() {
  console.log(
    `[SEED] Sincronizando ${SETOR_PATTERNS_SEED.length} padrões de SetorPattern...`,
  )

  let created = 0
  let updated = 0
  let unchanged = 0

  for (const p of SETOR_PATTERNS_SEED) {
    const key: SetorPatternKey = {
      setor: p.setor,
      matchType: p.matchType,
      pattern: p.pattern,
    }
    // Busca por chave natural (sem unique constraint formal; evitamos
    // dependência de migration extra pra constraint)
    const existing = await prisma.setorPattern.findFirst({
      where: key,
    })

    if (!existing) {
      await prisma.setorPattern.create({
        data: {
          setor: p.setor,
          matchType: p.matchType,
          pattern: p.pattern,
          categoryName: p.categoryName,
          type: p.type,
          confidence: p.confidence,
          description: p.description ?? null,
          origem: 'CURATED',
          active: true,
        },
      })
      created++
      continue
    }

    // Update campos editáveis se mudaram
    const needsUpdate =
      existing.categoryName !== p.categoryName ||
      existing.type !== p.type ||
      existing.confidence !== p.confidence ||
      !existing.active

    if (needsUpdate) {
      await prisma.setorPattern.update({
        where: { id: existing.id },
        data: {
          categoryName: p.categoryName,
          type: p.type,
          confidence: p.confidence,
          description: p.description ?? null,
          active: true,
        },
      })
      updated++
    } else {
      unchanged++
    }
  }

  console.log(
    `[SEED] OK · created=${created} updated=${updated} unchanged=${unchanged} total=${SETOR_PATTERNS_SEED.length}`,
  )

  // Breakdown por setor
  const counts = await prisma.setorPattern.groupBy({
    by: ['setor'],
    where: { active: true },
    _count: { id: true },
  })
  for (const row of counts) {
    console.log(`  ${row.setor}: ${row._count.id} padrões ativos`)
  }
}

main()
  .catch((err) => {
    console.error('[SEED] erro:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
