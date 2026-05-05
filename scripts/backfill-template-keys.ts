// Backfill de templateKey em categorias existentes (Sub-etapa 5.1.E).
//
// Para cada categoria com isSystemDefault=true, calcula
// templateKey = generateTemplateKey(empresa.type, category.dreGroup, category.name)
// e atualiza no banco. Categorias custom (isSystemDefault=false) ficam com
// templateKey=null.
//
// IDEMPOTENTE: rodar 2x não muda nada (UPDATE com mesmo valor é no-op).
// APENAS LEITURA + UPDATE — não cria nem deleta nada.
//
// Uso: npx tsx scripts/backfill-template-keys.ts

import { PrismaClient } from '@prisma/client'
import { generateTemplateKey } from '../lib/categories/template-key'

const prisma = new PrismaClient()

interface BackfillReport {
  empresa: string
  total: number
  comTemplateKey: number
  customSemKey: number
  atualizadas: number
}

async function main() {
  console.log('🔑 Backfill de templateKey — Sub-etapa 5.1.E\n')

  const empresas = await prisma.company.findMany({
    select: { id: true, name: true, tradeName: true, type: true },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📋 ${empresas.length} empresa(s) encontrada(s).\n`)
  console.log('─'.repeat(72))

  let totalGeralAtualizadas = 0
  let totalGeralComKey = 0
  let totalGeralCustom = 0

  for (const empresa of empresas) {
    const nome = empresa.tradeName ?? empresa.name
    const cats = await prisma.category.findMany({
      where: { companyId: empresa.id },
      select: {
        id: true,
        name: true,
        dreGroup: true,
        isSystemDefault: true,
        templateKey: true,
      },
    })

    const report: BackfillReport = {
      empresa: nome,
      total: cats.length,
      comTemplateKey: 0,
      customSemKey: 0,
      atualizadas: 0,
    }

    for (const cat of cats) {
      if (!cat.isSystemDefault) {
        report.customSemKey++
        continue
      }
      if (!cat.dreGroup) {
        // Categoria do template sem dreGroup — situação anômala. Skip.
        continue
      }

      const novaKey = generateTemplateKey(empresa.type, cat.dreGroup, cat.name)

      if (cat.templateKey === novaKey) {
        report.comTemplateKey++
        continue
      }

      await prisma.category.update({
        where: { id: cat.id },
        data: { templateKey: novaKey },
      })
      report.atualizadas++
      report.comTemplateKey++
    }

    console.log(`\n✅ ${report.empresa}`)
    console.log(`   total categorias:        ${report.total}`)
    console.log(`   com templateKey (após):  ${report.comTemplateKey}`)
    console.log(`   custom (sem key):        ${report.customSemKey}`)
    console.log(`   atualizadas neste run:   ${report.atualizadas}`)

    totalGeralAtualizadas += report.atualizadas
    totalGeralComKey += report.comTemplateKey
    totalGeralCustom += report.customSemKey
  }

  console.log('\n' + '─'.repeat(72))
  console.log('📊 Totais:')
  console.log(`   categorias com templateKey: ${totalGeralComKey}`)
  console.log(`   categorias custom:           ${totalGeralCustom}`)
  console.log(`   atualizações neste run:      ${totalGeralAtualizadas}`)
  console.log('\n✨ Backfill concluído. Idempotente — rodar de novo dá 0 atualizações.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
