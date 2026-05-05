// Backfill de competenceDate em transações existentes (Sub-etapa 5.3.A).
//
// Pra transações antigas, assume competenceDate = date (conservador).
// `date` é a coluna real no schema atual (sem migration de rename pra
// transactionDate). Em v2, user pode ajustar manualmente data competência.
//
// IDEMPOTENTE: rodar 2x não muda nada (filtro `competenceDate: null`).

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════')
  console.log('  BACKFILL competenceDate — Sub-etapa 5.3.A')
  console.log('═══════════════════════════════════════════════\n')

  const semCompetence = await prisma.transaction.count({
    where: { competenceDate: null },
  })

  console.log(`📋 ${semCompetence} transações sem competenceDate.\n`)

  if (semCompetence === 0) {
    console.log('✅ Nada a fazer. Tudo já tem competenceDate.')
    return
  }

  // Schema atual: `date` é NOT NULL, então não há transações sem `date`.
  // Mantemos check defensivo: query usa `take` em loop até esgotar.

  const BATCH_SIZE = 500
  let processadas = 0

  while (true) {
    const lote = await prisma.transaction.findMany({
      where: { competenceDate: null },
      select: { id: true, date: true },
      take: BATCH_SIZE,
    })

    if (lote.length === 0) break

    for (const tx of lote) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { competenceDate: tx.date },
      })
      processadas++
    }

    console.log(`   📊 Processadas: ${processadas}/${semCompetence}`)
  }

  console.log(`\n✅ ${processadas} transações atualizadas.`)
  console.log('🎯 competenceDate agora é igual a date em todas legadas.')
}

main()
  .catch((e) => {
    console.error('❌ ERRO:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
