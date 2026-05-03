// TEMPORÁRIO — só pra Parte A da Etapa 2.4. Apagar depois.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══ EMPRESAS EXISTENTES ═══\n')
  const empresas = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      tradeName: true,
      type: true,
      taxRegime: true,
      _count: { select: { categories: true, bankAccounts: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  for (const e of empresas) {
    const txCount = await prisma.transaction.count({
      where: { bankAccount: { companyId: e.id } },
    })
    console.log(`• ${e.tradeName ?? e.name} (${e.id})`)
    console.log(`  type=${e.type}  taxRegime=${e.taxRegime}`)
    console.log(`  categorias=${e._count.categories}  contas=${e._count.bankAccounts}  transações=${txCount}\n`)
  }

  console.log('\n═══ DETALHE: cada empresa ═══\n')
  for (const empresa of empresas) {
    console.log(`\n--- ${empresa.tradeName ?? empresa.name} (type=${empresa.type}) ---`)

  const cats = await prisma.category.findMany({
    where: { companyId: empresa.id },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      type: true,
      isSystemDefault: true,
      isActive: true,
      visibleInRegimes: true,
      dreGroup: true,
      code: true,
      parentId: true,
      _count: { select: { transactions: true } },
    },
  })

    console.log(`Total categorias: ${cats.length}`)
    if (cats.length === 0) {
      console.log(`  (vazia)`)
    } else {
      const semDreGroup = cats.filter((c) => !c.dreGroup).length
      const comTx = cats.filter((c) => c._count.transactions > 0).length
      const sysDef = cats.filter((c) => c.isSystemDefault).length
      const expense = cats.filter((c) => c.type === 'EXPENSE')
      const income = cats.filter((c) => c.type === 'INCOME')
      const transfer = cats.filter((c) => c.type === 'TRANSFER')
      console.log(`  EXPENSE=${expense.length}  INCOME=${income.length}  TRANSFER=${transfer.length}`)
      console.log(`  com transações vinculadas: ${comTx}`)
      console.log(`  isSystemDefault=true: ${sysDef}/${cats.length}`)
      console.log(`  sem dreGroup: ${semDreGroup}/${cats.length}`)

      // Lista as primeiras 20 com detalhes
      console.log(`\n  | name | type | sysDef | dreGroup | tx |`)
      console.log(`  |---|---|---|---|---|`)
      for (const c of cats.slice(0, 20)) {
        console.log(
          `  | ${c.name} | ${c.type} | ${c.isSystemDefault ? 'Y' : 'N'} | ${c.dreGroup ?? '(null)'} | ${c._count.transactions} |`,
        )
      }
      if (cats.length > 20) console.log(`  ...(+${cats.length - 20} categorias)`)
    }
  }

  console.log('\n═══ ANÁLISE: routing por companyType ═══\n')
  console.log('Templates esperam companyType lowercase (ex: "service", "restaurant", "retail").')
  console.log('Empresas no banco:')
  for (const e of empresas) {
    console.log(`  • "${e.tradeName ?? e.name}": type="${e.type}" → router default '${e.type.toLowerCase()}'`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
