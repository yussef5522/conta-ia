// Atualiza só TEXTO (descrição + notes) da bridge Daniela
// — sem mexer em saldo, categoria, estrutura.
//
// Decisão Yussef: a Daniela fez serviço pessoal dele em casa, mas a saída
// foi paga pelo PIX da empresa (Sicredi). Conceitualmente é retirada de
// sócio (empresa pagou despesa pessoal do sócio). A bridge JÁ está
// modelada assim (aponta pro perfil PF do Yussef como DISTRIBUICAO).
// Só falta rastreabilidade textual.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PF_TX_ID = 'cmq8inx7l00fquuaddi60p2tx'
const BRIDGE_ID = 'cmq8inx7z00fsuuad5u09xzvm'
const SICREDI_ID = 'cmq180ksv0001aktni9wj64mq'
const PROFILE_YUSSEF_ID = 'cmq1crgsz00cn50toa9zty4uy'

const SICREDI_BEFORE = -73316.31
const PF_SIGNED_BEFORE = 1640.11
const TOL = 0.01

const NEW_DESCRIPTION =
  'Retirada — empresa pagou serviço pessoal (Daniela Leite, 10/06/2026)'
const NEW_NOTES =
  'Pagamento pessoal Yussef → Daniela Leite por serviço residencial. Sicredi PIX 4.000 pago pela empresa por engano = retirada de sócio.'

function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Atualizando texto Daniela bridge ===\n')

  // Snapshot pré
  const [pfTxBefore, bridgeBefore, sicrediBefore] = await Promise.all([
    prisma.personalTransaction.findUniqueOrThrow({
      where: { id: PF_TX_ID },
      select: { description: true, amount: true, type: true, profileId: true },
    }),
    prisma.pJtoPFBridge.findUniqueOrThrow({
      where: { id: BRIDGE_ID },
      select: {
        notes: true,
        kind: true,
        profileId: true,
        socioPFId: true,
        pjTransactionId: true,
        pfTransactionId: true,
        amount: true,
      },
    }),
    prisma.bankAccount.findUniqueOrThrow({
      where: { id: SICREDI_ID },
      select: { balance: true },
    }),
  ])

  console.log('[snapshot pré]')
  console.log(`  pf tx description: "${pfTxBefore.description}"`)
  console.log(`  bridge notes:      "${bridgeBefore.notes ?? '(vazio)'}"`)
  console.log(`  Sicredi balance:   ${sicrediBefore.balance.toFixed(2)}`)
  console.log(`  bridge kind:       ${bridgeBefore.kind}`)
  console.log(`  bridge profileId:  ${bridgeBefore.profileId}`)
  console.log(`  bridge socioPFId:  ${bridgeBefore.socioPFId}`)

  // Sanity
  if (!close(sicrediBefore.balance, SICREDI_BEFORE)) {
    throw new Error(`Sicredi mudou (${sicrediBefore.balance}). Aborta.`)
  }
  if (pfTxBefore.profileId !== PROFILE_YUSSEF_ID) {
    throw new Error(
      `Pf tx profile não é Yussef (${pfTxBefore.profileId}). Aborta — modelagem inesperada.`,
    )
  }
  if (bridgeBefore.profileId !== PROFILE_YUSSEF_ID) {
    throw new Error(
      `Bridge profile não é Yussef (${bridgeBefore.profileId}). Aborta.`,
    )
  }
  if (bridgeBefore.kind !== 'DISTRIBUICAO') {
    throw new Error(`Bridge kind não é DISTRIBUICAO (${bridgeBefore.kind}). Aborta.`)
  }
  if (Math.abs(bridgeBefore.amount - 4000) > 0.01) {
    throw new Error(`Bridge amount ≠ 4.000 (${bridgeBefore.amount}). Aborta.`)
  }
  console.log(`  ✓ estrutura preservada (Yussef + DISTRIBUICAO + 4.000)\n`)

  // Atomic
  console.log('[executando atomic...]')
  await prisma.$transaction(async (tx) => {
    await tx.personalTransaction.update({
      where: { id: PF_TX_ID },
      data: { description: NEW_DESCRIPTION },
    })

    await tx.pJtoPFBridge.update({
      where: { id: BRIDGE_ID },
      data: { notes: NEW_NOTES },
    })

    // Sanity check: saldo Sicredi NÃO mudou (atualização de texto não toca balance)
    const sicrediAfter = await tx.bankAccount.findUniqueOrThrow({
      where: { id: SICREDI_ID },
      select: { balance: true },
    })
    if (!close(sicrediAfter.balance, SICREDI_BEFORE)) {
      throw new Error(
        `Sicredi mudou inesperadamente (${sicrediAfter.balance}). Rollback.`,
      )
    }

    // Verifica que estrutura da bridge não mudou (kind, profileId, amount)
    const bridgeAfter = await tx.pJtoPFBridge.findUniqueOrThrow({
      where: { id: BRIDGE_ID },
      select: {
        kind: true,
        profileId: true,
        socioPFId: true,
        amount: true,
        pjTransactionId: true,
        pfTransactionId: true,
      },
    })
    if (
      bridgeAfter.kind !== bridgeBefore.kind ||
      bridgeAfter.profileId !== bridgeBefore.profileId ||
      bridgeAfter.socioPFId !== bridgeBefore.socioPFId ||
      Math.abs(bridgeAfter.amount - bridgeBefore.amount) > 0.01 ||
      bridgeAfter.pjTransactionId !== bridgeBefore.pjTransactionId ||
      bridgeAfter.pfTransactionId !== bridgeBefore.pfTransactionId
    ) {
      throw new Error('Bridge estrutura mudou inesperadamente. Rollback.')
    }

    // Verifica que valor da tx PF não mudou (só descrição)
    const pfTxAfter = await tx.personalTransaction.findUniqueOrThrow({
      where: { id: PF_TX_ID },
      select: { amount: true, type: true, profileId: true },
    })
    if (
      Math.abs(pfTxAfter.amount - pfTxBefore.amount) > 0.01 ||
      pfTxAfter.type !== pfTxBefore.type ||
      pfTxAfter.profileId !== pfTxBefore.profileId
    ) {
      throw new Error('PF tx estrutura mudou. Rollback.')
    }

    await tx.auditLog.create({
      data: {
        companyId: 'cmq17yapb00gnrndlh33sctbo',
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (texto Daniela bridge)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'UPDATE',
        entityType: 'PjToPfBridge',
        entityId: BRIDGE_ID,
        metadata: JSON.stringify({
          context:
            'Daniela R$ 4.000 — atualiza só TEXTO (descrição PF + notes bridge) pra rastreabilidade. Estrutura conceitual já estava certa (retirada Yussef pra pagar serviço pessoal feito pela Daniela).',
          changes: {
            pfTransactionDescription: {
              from: pfTxBefore.description,
              to: NEW_DESCRIPTION,
              txId: PF_TX_ID,
            },
            bridgeNotes: {
              from: bridgeBefore.notes ?? null,
              to: NEW_NOTES,
              bridgeId: BRIDGE_ID,
            },
          },
          preserved: {
            bridgeKind: bridgeBefore.kind,
            bridgeProfileId: bridgeBefore.profileId,
            bridgeSocioPFId: bridgeBefore.socioPFId,
            bridgeAmount: bridgeBefore.amount,
            sicrediBalance: sicrediBefore.balance,
            pfTxAmount: pfTxBefore.amount,
            pfTxType: pfTxBefore.type,
          },
        }),
      },
    })
  })

  console.log(`  ✓ pf tx description atualizada`)
  console.log(`  ✓ bridge notes atualizada`)
  console.log(`  ✓ Sicredi balance: ${sicrediBefore.balance.toFixed(2)} (inalterado)`)
  console.log(`  ✓ estrutura preservada\n`)
  console.log('=== ATUALIZAÇÃO CONCLUÍDA ===')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
