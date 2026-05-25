// Sprint 5.0.2.b — Seed idempotente do catálogo CNAEActivity.
//
// Popula a tabela com os 19 CNAEs cobertos pelos 3 ramos (restaurante,
// academia, comércio de roupas) usando `upsert` por `code` — pode rodar
// quantas vezes quiser sem duplicar nem perder edições manuais.
//
// Uso: npx tsx scripts/seed-cnae-expert.ts

import { PrismaClient } from '@prisma/client'
import {
  ALL_EXPERTISE,
  ALL_CNAES,
  type Ramo,
} from '@/lib/tax/expertise'

const prisma = new PrismaClient()

const ANEXO_TO_FULL: Record<string, string> = {
  I: 'ANEXO_I',
  II: 'ANEXO_II',
  III: 'ANEXO_III',
  IV: 'ANEXO_IV',
  V: 'ANEXO_V',
  'III/V': 'ANEXO_III',
}

function fullAnexo(short: string): string {
  return ANEXO_TO_FULL[short] ?? 'ANEXO_I'
}

async function main() {
  console.log('Seeding CNAEActivity table...')

  let upserted = 0
  for (const cnae of ALL_CNAES) {
    const exp = ALL_EXPERTISE[cnae.ramo as Ramo]

    await prisma.cNAEActivity.upsert({
      where: { code: cnae.code },
      create: {
        code: cnae.code,
        name: cnae.name,
        ramo: cnae.ramo,
        anexoSimples: fullAnexo(cnae.anexo),
        expertise: JSON.stringify(exp),
        beneficios: JSON.stringify(exp.beneficios),
        particularidades: JSON.stringify(exp.particularidades),
        errosComuns: JSON.stringify(exp.errosComuns),
        ativo: true,
        versao: '2026',
      },
      update: {
        name: cnae.name,
        ramo: cnae.ramo,
        anexoSimples: fullAnexo(cnae.anexo),
        expertise: JSON.stringify(exp),
        beneficios: JSON.stringify(exp.beneficios),
        particularidades: JSON.stringify(exp.particularidades),
        errosComuns: JSON.stringify(exp.errosComuns),
        versao: '2026',
      },
    })
    upserted++
    console.log(`  ✓ ${cnae.code} — ${cnae.name}`)
  }

  console.log(`\n✅ ${upserted} CNAEs seeded (${ALL_CNAES.length} esperados)`)
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
