// Etapa C — Conciliar Excel TOZZO + RM2 (Cacula Stone)
//
// RM2 (1:1): Excel R$ 198,80 ↔ OFX R$ 198,80 (sem ajuste)
// TOZZO (1:1 + ADJ): Excel R$ 1.165,50 ↔ OFX R$ 1.191,13 + ADJ R$ 25,63 Juros
//
// Reusa LÓGICA do lib/conciliacao/reconcile.ts CLASSIC (replicada inline pra
// não precisar de AuthContext fake) + lib/conciliacao/create-adjustment.ts.
//
// Backup: /var/backups/conta-ia/pre-etapa-c-tozzo-rm2-reconcile-20260611_221634.dump

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { buildAdjustmentTxData } from '../lib/conciliacao/create-adjustment'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const STONE_ID = 'cmq182qfr0005aktn6q2ugpv2'
const USER_ID = 'cmp9e4kgz00007wajsn05e9mg'

// IDs das 4 tx
const OFX_TOZZO_ID = 'cmq9wbpx000c4sjvixx4hkbpw' // -1.191,13 EFFECTED PENDING
const EXCEL_TOZZO_ID = 'cmq8g05jj00azuuad3ovp853q' // -1.165,50 PAYABLE RECONCILED
const OFX_RM2_ID = 'cmq9wbpx100clsjvi0jud0h2a' // -198,80 EFFECTED PENDING
const EXCEL_RM2_ID = 'cmq8g05kn00bpuuadu98hcvko' // -198,80 PAYABLE RECONCILED

// Categorias
const CAT_JUROS_ID = 'cmq17yasg00jbrndlwftt2eon' // Multas e Juros de Mora Pagos
const SUP_TOZZO_ID = 'cmq19ah6p005750toixa2uybn' // Excel TOZZO categoryId is this

const ADJ_AMOUNT = 25.63 // 1.191,13 - 1.165,50
const STONE_BEFORE = 29211.21
const DRE_SIGNED_BEFORE = 54771.83
const DRE_QTD_BEFORE = 959
const TOL = 0.01

function fmt(n: number) { return n.toFixed(2) }
function close(a: number, b: number) { return Math.abs(a - b) <= TOL }

async function getDreCaixaJun() {
  const result = await prisma.$queryRaw<Array<{ qtd: bigint; signed: number }>>`
    SELECT COUNT(*) AS qtd,
      SUM(CASE WHEN t.type='CREDIT' THEN t.amount WHEN t.type='DEBIT' THEN -t.amount ELSE 0 END) AS signed
    FROM transactions t
    JOIN bank_accounts ba ON ba.id = t."bankAccountId"
    WHERE ba."companyId" = ${COMPANY_ID}
      AND t.lifecycle = 'EFFECTED'
      AND t.type <> 'TRANSFER'
      AND t."isInternalTransfer" = false
      AND (
        (t."paymentDate" >= '2026-06-01'::date AND t."paymentDate" <= '2026-06-30'::date)
        OR (t."paymentDate" IS NULL AND t.date >= '2026-06-01'::date AND t.date <= '2026-06-30'::date)
      )
      AND NOT (
        t.origin = 'OFX' AND t."reconciledWithId" IS NULL
        AND EXISTS (SELECT 1 FROM transactions r WHERE r."reconciledWithId" = t.id)
      )
  `
  return { qtd: Number(result[0].qtd), signed: Number(result[0].signed) }
}

async function main() {
  console.log('=== Etapa C: conciliar TOZZO + RM2 ===\n')

  // 1. Snapshot pré
  const stonePre = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: STONE_ID },
    select: { balance: true },
  })
  const drePre = await getDreCaixaJun()
  console.log('[snapshot pré]')
  console.log(`  stone.balance: ${fmt(stonePre.balance)}`)
  console.log(`  DRE caixa Cacula jun: ${drePre.qtd} tx, signed ${fmt(drePre.signed)}`)

  if (!close(stonePre.balance, STONE_BEFORE)) throw new Error(`stone mudou: ${fmt(stonePre.balance)}`)
  if (drePre.qtd !== DRE_QTD_BEFORE) throw new Error(`DRE qtd mudou: ${drePre.qtd}`)
  if (!close(drePre.signed, DRE_SIGNED_BEFORE)) throw new Error(`DRE signed mudou: ${fmt(drePre.signed)}`)

  // 2. Fetch das 4 tx + valida
  const [ofxTozzo, excelTozzo, ofxRm2, excelRm2] = await Promise.all([
    prisma.transaction.findUniqueOrThrow({ where: { id: OFX_TOZZO_ID } }),
    prisma.transaction.findUniqueOrThrow({ where: { id: EXCEL_TOZZO_ID } }),
    prisma.transaction.findUniqueOrThrow({ where: { id: OFX_RM2_ID } }),
    prisma.transaction.findUniqueOrThrow({ where: { id: EXCEL_RM2_ID } }),
  ])

  // Validações pré
  if (ofxTozzo.origin !== 'OFX' || ofxTozzo.type !== 'DEBIT' || ofxTozzo.lifecycle !== 'EFFECTED')
    throw new Error('OFX TOZZO estado errado')
  if (Math.abs(ofxTozzo.amount - 1191.13) > 0.015) throw new Error('OFX TOZZO valor errado')
  if (ofxTozzo.bankAccountId !== STONE_ID) throw new Error('OFX TOZZO não está na Stone')
  if (ofxTozzo.reconciledWithId !== null) throw new Error('OFX TOZZO já linkada')

  if (excelTozzo.origin !== 'IMPORT_EXCEL' || excelTozzo.lifecycle !== 'PAYABLE')
    throw new Error('Excel TOZZO estado errado')
  if (Math.abs(excelTozzo.amount - 1165.50) > 0.015) throw new Error('Excel TOZZO valor errado')
  if (excelTozzo.reconciledWithId !== null) throw new Error('Excel TOZZO já linkada')

  if (ofxRm2.origin !== 'OFX' || ofxRm2.type !== 'DEBIT' || ofxRm2.lifecycle !== 'EFFECTED')
    throw new Error('OFX RM2 estado errado')
  if (Math.abs(ofxRm2.amount - 198.80) > 0.015) throw new Error('OFX RM2 valor errado')
  if (ofxRm2.bankAccountId !== STONE_ID) throw new Error('OFX RM2 não está na Stone')
  if (ofxRm2.reconciledWithId !== null) throw new Error('OFX RM2 já linkada')

  if (excelRm2.origin !== 'IMPORT_EXCEL' || excelRm2.lifecycle !== 'PAYABLE')
    throw new Error('Excel RM2 estado errado')
  if (Math.abs(excelRm2.amount - 198.80) > 0.015) throw new Error('Excel RM2 valor errado')
  if (excelRm2.reconciledWithId !== null) throw new Error('Excel RM2 já linkada')

  // Soma TOZZO + ADJ = OFX
  const sumToZzo = 1165.50 + ADJ_AMOUNT
  if (Math.abs(sumToZzo - 1191.13) > 0.015) throw new Error(`Excel+ADJ ${fmt(sumToZzo)} != OFX 1191.13`)

  console.log(`\n  ✓ 4 tx validadas (Excel PAYABLE x2 + OFX EFFECTED x2)`)
  console.log(`  ✓ Excel TOZZO 1.165,50 + ADJ 25,63 = OFX 1.191,13 ✓\n`)

  // 3. Atomic
  console.log('[executando atomic...]')
  const groupIdRm2 = randomUUID()
  const groupIdTozzo = randomUUID()

  const result = await prisma.$transaction(async (tx) => {
    // 3.1. RECONCILE RM2 (CLASSIC)
    const excelRm2Updated = await tx.transaction.update({
      where: { id: EXCEL_RM2_ID },
      data: {
        lifecycle: 'EFFECTED',
        paymentDate: ofxRm2.date,
        date: ofxRm2.date,
        bankAccountId: ofxRm2.bankAccountId,
        reconciledWithId: OFX_RM2_ID,
        status: 'RECONCILED',
        reconcileGroupId: groupIdRm2,
      },
    })

    // 3.2. RECONCILE TOZZO (CLASSIC)
    const excelTozzoUpdated = await tx.transaction.update({
      where: { id: EXCEL_TOZZO_ID },
      data: {
        lifecycle: 'EFFECTED',
        paymentDate: ofxTozzo.date,
        date: ofxTozzo.date,
        bankAccountId: ofxTozzo.bankAccountId,
        reconciledWithId: OFX_TOZZO_ID,
        status: 'RECONCILED',
        reconcileGroupId: groupIdTozzo,
      },
    })

    // 3.3. CRIA ADJUSTMENT TOZZO (Multas e Juros)
    const adjData = buildAdjustmentTxData({
      ofxTransactionId: OFX_TOZZO_ID,
      bankAccountId: STONE_ID,
      companyId: COMPANY_ID,
      categoryId: CAT_JUROS_ID,
      amount: ADJ_AMOUNT,
      sign: 'EXPENSE',
      description: 'Juros/Multa boleto — TOZZO ALIMENTOS LTDA',
      reconcileGroupId: groupIdTozzo,
      date: ofxTozzo.date,
      userId: USER_ID,
    })
    // Adiciona supplierId TOZZO ao ADJ pra rastreabilidade
    const adjCreated = await tx.transaction.create({
      data: { ...adjData, supplierId: SUP_TOZZO_ID },
    })

    // 3.4. SANITY: balance Stone idêntico
    const stonePos = await tx.bankAccount.findUniqueOrThrow({
      where: { id: STONE_ID }, select: { balance: true },
    })
    if (!close(stonePos.balance, STONE_BEFORE))
      throw new Error(`stone mudou (${fmt(stonePos.balance)} != ${fmt(STONE_BEFORE)}). Rollback.`)

    // 3.5. SANITY: as 2 Excel agora EFFECTED + linkadas
    if (excelRm2Updated.lifecycle !== 'EFFECTED' || excelRm2Updated.reconciledWithId !== OFX_RM2_ID)
      throw new Error('Excel RM2 update falhou. Rollback.')
    if (excelTozzoUpdated.lifecycle !== 'EFFECTED' || excelTozzoUpdated.reconciledWithId !== OFX_TOZZO_ID)
      throw new Error('Excel TOZZO update falhou. Rollback.')

    // 3.6. SANITY: ADJ criada com cat correta
    if (adjCreated.categoryId !== CAT_JUROS_ID || Math.abs(adjCreated.amount - ADJ_AMOUNT) > 0.015)
      throw new Error('ADJ criada errada. Rollback.')
    if (adjCreated.reconcileGroupId !== groupIdTozzo)
      throw new Error('ADJ não está no grupo TOZZO. Rollback.')

    // 3.7. AUDIT LOG
    // (a) RM2 reconciled
    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: USER_ID,
        userName: 'Yussef (Etapa C reconcile RM2)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'EXCEL_PAYABLE_RECONCILED_VIA_OFX',
        entityType: 'Reconciliation',
        entityId: EXCEL_RM2_ID,
        metadata: JSON.stringify({
          context: 'Etapa C: Excel PAYABLE-anômalo (PAYABLE+RECONCILED+paymentDate sem bankAccount) virou EFFECTED + linkada com OFX. Sem ajuste (valores iguais).',
          mode: 'CLASSIC',
          excelId: EXCEL_RM2_ID,
          ofxId: OFX_RM2_ID,
          amount: 198.80,
          reconcileGroupId: groupIdRm2,
          categoria: 'Material de Escritório',
        }),
      },
    })

    // (b) TOZZO reconciled
    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: USER_ID,
        userName: 'Yussef (Etapa C reconcile TOZZO)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'EXCEL_PAYABLE_RECONCILED_VIA_OFX',
        entityType: 'Reconciliation',
        entityId: EXCEL_TOZZO_ID,
        metadata: JSON.stringify({
          context: 'Etapa C: Excel PAYABLE-anômalo virou EFFECTED + linkada com OFX. Ajuste R$ 25,63 (juros) criado separado no mesmo grupo.',
          mode: 'CLASSIC',
          excelId: EXCEL_TOZZO_ID,
          ofxId: OFX_TOZZO_ID,
          excelAmount: 1165.50,
          ofxAmount: 1191.13,
          diff: 25.63,
          reconcileGroupId: groupIdTozzo,
          categoria: 'Matéria-Prima - Outros Insumos',
        }),
      },
    })

    // (c) ADJ criada
    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: USER_ID,
        userName: 'Yussef (Etapa C ADJ Juros TOZZO)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'CREATE_ADJUSTMENT_FOR_RECONCILE',
        entityType: 'Adjustment',
        entityId: adjCreated.id,
        metadata: JSON.stringify({
          context: 'Juros/Multa do boleto TOZZO ALIMENTOS LTDA pago em 11/jun. Excel R$ 1.165,50 + ADJ R$ 25,63 = OFX R$ 1.191,13.',
          adjId: adjCreated.id,
          ofxId: OFX_TOZZO_ID,
          reconcileGroupId: groupIdTozzo,
          amount: ADJ_AMOUNT,
          categoryId: CAT_JUROS_ID,
          categoryName: 'Multas e Juros de Mora Pagos',
          sign: 'EXPENSE',
          backupPath: '/var/backups/conta-ia/pre-etapa-c-tozzo-rm2-reconcile-20260611_221634.dump',
        }),
      },
    })

    return {
      adjId: adjCreated.id,
      stonePos: stonePos.balance,
      groupIdRm2,
      groupIdTozzo,
    }
  })

  console.log(`  ✓ Excel RM2 reconciled (lifecycle=EFFECTED, link=OFX_RM2)`)
  console.log(`  ✓ Excel TOZZO reconciled (lifecycle=EFFECTED, link=OFX_TOZZO)`)
  console.log(`  ✓ ADJ TOZZO criada: ${result.adjId} (R$ 25,63 Multas e Juros)`)
  console.log(`  ✓ stone.balance: ${fmt(stonePre.balance)} → ${fmt(result.stonePos)} (idêntico)`)
  console.log(`  ✓ groupId RM2:   ${result.groupIdRm2.slice(0, 8)}`)
  console.log(`  ✓ groupId TOZZO: ${result.groupIdTozzo.slice(0, 8)}`)

  // 4. Prova final: DRE caixa Cacula jun
  const drePos = await getDreCaixaJun()
  console.log(`\n[snapshot pós]`)
  console.log(`  DRE caixa Cacula jun: ${drePos.qtd} tx, signed ${fmt(drePos.signed)}`)
  if (drePos.qtd !== DRE_QTD_BEFORE + 1)
    throw new Error(`DRE qtd pós ${drePos.qtd} != esperado ${DRE_QTD_BEFORE + 1}`)
  if (!close(drePos.signed, DRE_SIGNED_BEFORE))
    throw new Error(`DRE signed pós ${fmt(drePos.signed)} != esperado ${fmt(DRE_SIGNED_BEFORE)}`)
  console.log(`  ✓ DRE qtd +1 (ADJ entra), signed idêntico (zero inflação)`)

  await prisma.$disconnect()
  console.log(`\n=== ETAPA C CONCLUÍDA ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
