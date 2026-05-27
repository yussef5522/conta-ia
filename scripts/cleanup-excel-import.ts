// Sprint 5.0.2.4 — Limpa estado de import Excel de uma empresa pra permitir
// re-import com fix da causa raiz (46 linhas perdidas).
//
// FAZ:
//   1. DELETE transactions WHERE origin='IMPORT_EXCEL' AND companyId=<X>
//   2. DELETE excel_import_batches WHERE companyId=<X> (cascade limpa staging)
//
// NÃO FAZ (intencional — preserva pro próximo import):
//   - Suppliers/Employees criados pelo import (continuam úteis)
//   - Categories criadas pelo import (mantém plano de contas evoluído)
//   - Transactions de OFX/MANUAL (intocadas)
//
// Modos:
//   npx tsx scripts/cleanup-excel-import.ts <companyId>              # dry-run
//   npx tsx scripts/cleanup-excel-import.ts <companyId> --confirm    # aplica

import { prisma } from '@/lib/db'

interface DiffReport {
  transactionsToDelete: number
  totalAmount: number
  batchesToDelete: number
  stagedRowsToDelete: number
  suppliersUntouched: number
  employeesUntouched: number
  categoriesUntouched: number
}

async function compute(companyId: string): Promise<DiffReport> {
  // Transactions IMPORT_EXCEL escopadas via supplier/employee/category multi-tenant
  const txs = await prisma.transaction.findMany({
    where: {
      origin: 'IMPORT_EXCEL',
      OR: [
        { supplier: { companyId } },
        { employee: { companyId } },
        { category: { companyId } },
        { bankAccount: { companyId } },
      ],
    },
    select: { id: true, amount: true },
  })

  const batches = await prisma.excelImportBatch.findMany({
    where: { companyId },
    select: { id: true },
  })

  const stagedRows = await prisma.stagedPayableRow.count({
    where: { batchId: { in: batches.map((b) => b.id) } },
  })

  const [suppliersCount, employeesCount, categoriesCount] = await Promise.all([
    prisma.supplier.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId } }),
    prisma.category.count({ where: { companyId } }),
  ])

  return {
    transactionsToDelete: txs.length,
    totalAmount: txs.reduce((s, t) => s + t.amount, 0),
    batchesToDelete: batches.length,
    stagedRowsToDelete: stagedRows,
    suppliersUntouched: suppliersCount,
    employeesUntouched: employeesCount,
    categoriesUntouched: categoriesCount,
  }
}

async function apply(companyId: string): Promise<DiffReport> {
  // Sequência: TX → batches (cascade limpa staged_payable_rows)
  const txs = await prisma.transaction.findMany({
    where: {
      origin: 'IMPORT_EXCEL',
      OR: [
        { supplier: { companyId } },
        { employee: { companyId } },
        { category: { companyId } },
        { bankAccount: { companyId } },
      ],
    },
    select: { id: true, amount: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    // 1. Apaga transactions
    const delTx = await tx.transaction.deleteMany({
      where: { id: { in: txs.map((t) => t.id) } },
    })

    // 2. Apaga batches (FK ON DELETE CASCADE → leva staged_payable_rows)
    const delBatches = await tx.excelImportBatch.deleteMany({
      where: { companyId },
    })

    // 3. Conta órfãos remanescentes pra sanity report
    const stagedLeft = await tx.stagedPayableRow.count({
      where: { batch: { companyId } },
    })

    return {
      transactionsToDelete: delTx.count,
      totalAmount: txs.reduce((s, t) => s + t.amount, 0),
      batchesToDelete: delBatches.count,
      stagedRowsToDelete: stagedLeft, // pós-delete; deve ser 0
      suppliersUntouched: 0,
      employeesUntouched: 0,
      categoriesUntouched: 0,
    }
  })

  const [suppliersCount, employeesCount, categoriesCount] = await Promise.all([
    prisma.supplier.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId } }),
    prisma.category.count({ where: { companyId } }),
  ])
  result.suppliersUntouched = suppliersCount
  result.employeesUntouched = employeesCount
  result.categoriesUntouched = categoriesCount

  return result
}

async function main() {
  const companyId = process.argv[2]
  const confirm = process.argv.includes('--confirm')

  if (!companyId) {
    console.error('Uso: cleanup-excel-import.ts <companyId> [--confirm]')
    process.exit(1)
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })
  if (!company) {
    console.error(`Empresa ${companyId} não encontrada.`)
    process.exit(1)
  }

  console.log(`Empresa: ${company.name} (${companyId})`)
  console.log(`Modo: ${confirm ? '🔴 APPLY (vai apagar)' : '🟢 DRY-RUN (não apaga)'}`)
  console.log('')

  const before = await compute(companyId)
  console.log('═══ ESTADO ATUAL ═══')
  console.log(`Transactions IMPORT_EXCEL: ${before.transactionsToDelete}`)
  console.log(`  → R$ ${before.totalAmount.toFixed(2)}`)
  console.log(`ExcelImportBatch: ${before.batchesToDelete}`)
  console.log(`StagedPayableRow: ${before.stagedRowsToDelete}`)
  console.log(`Suppliers (preservar): ${before.suppliersUntouched}`)
  console.log(`Employees (preservar): ${before.employeesUntouched}`)
  console.log(`Categories (preservar): ${before.categoriesUntouched}`)
  console.log('')

  if (!confirm) {
    console.log('Pra aplicar, rodar de novo com --confirm.')
    return
  }

  if (before.transactionsToDelete === 0 && before.batchesToDelete === 0) {
    console.log('✅ Nada pra apagar. Saindo.')
    return
  }

  console.log('🔴 Aplicando delete...')
  const result = await apply(companyId)
  console.log('')
  console.log('═══ DELETE EXECUTADO ═══')
  console.log(`Transactions apagadas: ${result.transactionsToDelete} (R$ ${result.totalAmount.toFixed(2)})`)
  console.log(`Batches apagados: ${result.batchesToDelete}`)
  console.log(`StagedPayableRows restantes: ${result.stagedRowsToDelete} (deve ser 0)`)
  console.log(`Suppliers preservados: ${result.suppliersUntouched}`)
  console.log(`Employees preservados: ${result.employeesUntouched}`)
  console.log(`Categories preservadas: ${result.categoriesUntouched}`)
  console.log('')
  console.log('✅ Cleanup completo. Yussef pode re-importar a planilha.')
}

main()
  .catch((e) => {
    console.error('ERRO:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
