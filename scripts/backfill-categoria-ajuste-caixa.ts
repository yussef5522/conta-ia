// Sprint Caixa — Backfill da categoria "Ajuste de Caixa" em todas
// as empresas existentes.
//
// Idempotente: se categoria já existe (match por nome exato), pula.
//
// Pra que serve: na Conta Caixa, ao "Conferir caixa" (Etapa 3 — futura
// sprint) ou ao ajustar saldo manualmente, criar uma tx categorizada
// nesta categoria fica claro que foi um acerto de caixa (não despesa
// operacional real).
//
// Categoria criada como:
//   type: 'EXPENSE'
//   dreGroup: 'OUTRAS_DESPESAS'  ← não polui despesas operacionais
//   isSystemDefault: true        ← protegida contra delete
//
// Rodar: npx tsx scripts/backfill-categoria-ajuste-caixa.ts

import { prisma } from '@/lib/db'

const CATEGORIA_NOME = 'Ajuste de Caixa'
const CATEGORIA_COR = '#d97706' // amber-600
const CATEGORIA_ICONE = 'Wallet'
const CATEGORIA_DRE = 'OUTRAS_DESPESAS'

async function main() {
  console.log('🔍 Backfill categoria "Ajuste de Caixa" em todas as empresas')

  const empresas = await prisma.company.findMany({
    select: { id: true, name: true },
  })
  console.log(`📋 ${empresas.length} empresas encontradas`)

  let created = 0
  let skipped = 0

  for (const empresa of empresas) {
    const existing = await prisma.category.findFirst({
      where: { companyId: empresa.id, name: CATEGORIA_NOME },
      select: { id: true },
    })
    if (existing) {
      skipped++
      console.log(`  ⏭  ${empresa.name}: já tem "${CATEGORIA_NOME}"`)
      continue
    }

    await prisma.category.create({
      data: {
        companyId: empresa.id,
        name: CATEGORIA_NOME,
        type: 'EXPENSE',
        color: CATEGORIA_COR,
        icon: CATEGORIA_ICONE,
        dreGroup: CATEGORIA_DRE,
        isSystemDefault: true,
        isActive: true,
        description:
          'Ajuste contábil de Conta Caixa (acerto de saldo, sobra ou falta). NÃO usar pra despesas operacionais reais.',
      },
    })
    created++
    console.log(`  ✅ ${empresa.name}: criada "${CATEGORIA_NOME}"`)
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
