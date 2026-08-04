// Etapa 1 — Substituir Manual Banrisul (par PIX 7.400 grupo 1ec907e5) pela
// OFX nova de hoje. Cenário 1 do plano (OFX_REPLACED_MANUAL_TRANSFER).
//
// Backup: /var/backups/conta-ia/pre-etapa1-pix7400-20260611_175030.dump
//
// Pré-condições já checadas via SQL:
//   - 0 reverso aponta pra Manual Banrisul (seguro deletar)
//   - 0 bridge PJ→PF
//   - Grupo 1ec907e5 tem exatamente 2 perngas

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const GROUP_ID = '1ec907e5-e6e9-4a5c-bf8f-cc93c213e7ee'

const MANUAL_BANRISUL_ID = 'cmq8i5q8400e5uuado5yo653q' // A — deletar
const MANUAL_STONE_ID = 'cmq8i5q8500e7uuadmka2lmy3' // B — preservar
const OFX_NEW_ID = 'cmq9wd6ll00disjvihajspjfm' // C — virar TRANSFER no grupo

const AMOUNT = 7400.0
const BANRISUL_BEFORE = -14282.27
const BANRISUL_AFTER = -6882.27 // -14282.27 + 7400 (revert dup)
const STONE_BEFORE = 29211.21
const SICREDI_BEFORE = -73298.76
const TOL = 0.01

function fmt(n: number) {
  return n.toFixed(2)
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL
}

async function main() {
  console.log('=== Etapa 1: substituir Manual Banrisul pela OFX (grupo 1ec907e5) ===\n')

  // 1. Snapshot pré (fora do atomic, pra log)
  const banrisul = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'banrisul' },
    select: { id: true, balance: true, name: true },
  })
  const stone = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'stone' },
    select: { id: true, balance: true, name: true },
  })
  const sicredi = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: 'sicredi ' },
    select: { id: true, balance: true, name: true },
  })

  const [manualBanrisul, manualStone, ofxNew] = await Promise.all([
    prisma.transaction.findUniqueOrThrow({ where: { id: MANUAL_BANRISUL_ID } }),
    prisma.transaction.findUniqueOrThrow({ where: { id: MANUAL_STONE_ID } }),
    prisma.transaction.findUniqueOrThrow({ where: { id: OFX_NEW_ID } }),
  ])

  console.log('[snapshot pré]')
  console.log(`  banrisul.balance: ${fmt(banrisul.balance)}`)
  console.log(`  stone.balance:    ${fmt(stone.balance)}`)
  console.log(`  sicredi.balance:  ${fmt(sicredi.balance)}`)
  console.log(`  Manual Banrisul:  ${manualBanrisul.id} TRANSFER ${fmt(manualBanrisul.amount)} grupo=${manualBanrisul.transferGroupId?.slice(0, 13)}`)
  console.log(`  Manual Stone:     ${manualStone.id} TRANSFER ${fmt(manualStone.amount)} grupo=${manualStone.transferGroupId?.slice(0, 13)}`)
  console.log(`  OFX nova:         ${ofxNew.id} ${ofxNew.type} ${fmt(ofxNew.amount)} FITID=${ofxNew.externalId} hash=${ofxNew.dedupHash?.slice(0, 16)}`)

  // 2. Validações pré-atomic
  if (!close(banrisul.balance, BANRISUL_BEFORE))
    throw new Error(`banrisul.balance ${fmt(banrisul.balance)} != esperado ${fmt(BANRISUL_BEFORE)}. Aborta.`)
  if (!close(stone.balance, STONE_BEFORE))
    throw new Error(`stone.balance ${fmt(stone.balance)} != esperado ${fmt(STONE_BEFORE)}. Aborta.`)
  if (!close(sicredi.balance, SICREDI_BEFORE))
    throw new Error(`sicredi.balance ${fmt(sicredi.balance)} != esperado ${fmt(SICREDI_BEFORE)}. Aborta.`)

  if (manualBanrisul.transferGroupId !== GROUP_ID)
    throw new Error(`Manual Banrisul grupo errado: ${manualBanrisul.transferGroupId}. Aborta.`)
  if (manualStone.transferGroupId !== GROUP_ID)
    throw new Error(`Manual Stone grupo errado: ${manualStone.transferGroupId}. Aborta.`)
  if (manualBanrisul.type !== 'TRANSFER' || manualStone.type !== 'TRANSFER')
    throw new Error(`Manuals não são TRANSFER. Aborta.`)
  if (manualBanrisul.origin !== 'MANUAL' || manualStone.origin !== 'MANUAL')
    throw new Error(`Manuals não são MANUAL. Aborta.`)
  if (manualBanrisul.bankAccountId !== banrisul.id)
    throw new Error(`Manual Banrisul não está no banrisul. Aborta.`)
  if (manualStone.bankAccountId !== stone.id)
    throw new Error(`Manual Stone não está no stone. Aborta.`)
  if (Math.abs(manualBanrisul.amount - AMOUNT) > 0.015) throw new Error('Manual Banrisul amount errado. Aborta.')
  if (Math.abs(manualStone.amount - AMOUNT) > 0.015) throw new Error('Manual Stone amount errado. Aborta.')

  if (ofxNew.transferGroupId !== null) throw new Error(`OFX já em grupo: ${ofxNew.transferGroupId}. Aborta.`)
  if (ofxNew.reconciledWithId !== null) throw new Error(`OFX já linkada: ${ofxNew.reconciledWithId}. Aborta.`)
  if (ofxNew.type !== 'DEBIT') throw new Error(`OFX type errado: ${ofxNew.type}. Aborta.`)
  if (ofxNew.origin !== 'OFX') throw new Error(`OFX origin errado: ${ofxNew.origin}. Aborta.`)
  if (ofxNew.bankAccountId !== banrisul.id)
    throw new Error(`OFX não está no banrisul: ${ofxNew.bankAccountId}. Aborta.`)
  if (Math.abs(ofxNew.amount - AMOUNT) > 0.015) throw new Error('OFX amount errado. Aborta.')

  // Sanity reverso (já checado via SQL, mas re-confirma in-place)
  const reverso = await prisma.transaction.count({ where: { reconciledWithId: MANUAL_BANRISUL_ID } })
  if (reverso !== 0) throw new Error(`${reverso} tx apontam reconciledWithId pra Manual Banrisul. Aborta.`)

  // Sanity grupo
  const grupoPre = await prisma.transaction.findMany({ where: { transferGroupId: GROUP_ID } })
  if (grupoPre.length !== 2) throw new Error(`Grupo tem ${grupoPre.length} tx, esperado 2. Aborta.`)

  console.log(`\n  ✓ todas pré-validações OK\n`)

  // 3. Atomic
  console.log('[executando atomic...]')
  const result = await prisma.$transaction(async (tx) => {
    // 3.1. UPDATE OFX → vira TRANSFER no grupo (sem reconciledWithId, vai ser deletado)
    await tx.transaction.update({
      where: { id: OFX_NEW_ID },
      data: {
        type: 'TRANSFER',
        transferGroupId: GROUP_ID,
        status: 'RECONCILED',
        // NÃO setamos reconciledWithId — manual vai ser deletada, evita ref pendurada.
        // categoryId continua null (TRANSFER não precisa de categoria — DRE ignora).
      },
    })

    // 3.2. UPDATE banrisul balance: +7.400 (revert dup)
    const banrisulAfter = await tx.bankAccount.update({
      where: { id: banrisul.id },
      data: { balance: { increment: AMOUNT } },
      select: { balance: true },
    })

    // 3.3. SANITY 1: balance banrisul == -6882.27
    if (!close(banrisulAfter.balance, BANRISUL_AFTER)) {
      throw new Error(
        `Banrisul pós ${fmt(banrisulAfter.balance)} != esperado ${fmt(BANRISUL_AFTER)}. Rollback.`,
      )
    }

    // 3.4. DELETE Manual Banrisul
    await tx.transaction.delete({ where: { id: MANUAL_BANRISUL_ID } })

    // 3.5. SANITY 2: grupo ainda tem 2 perngas (Stone manual + Banrisul OFX)
    const grupoPos = await tx.transaction.findMany({
      where: { transferGroupId: GROUP_ID },
      select: { id: true, bankAccountId: true, origin: true, type: true, amount: true },
    })
    if (grupoPos.length !== 2) {
      throw new Error(`Grupo pós tem ${grupoPos.length} tx, esperado 2. Rollback.`)
    }
    const banrisulOfxNoGrupo = grupoPos.find(
      (t) => t.bankAccountId === banrisul.id && t.origin === 'OFX' && t.type === 'TRANSFER',
    )
    const stoneManualNoGrupo = grupoPos.find(
      (t) => t.bankAccountId === stone.id && t.origin === 'MANUAL' && t.type === 'TRANSFER',
    )
    if (!banrisulOfxNoGrupo) throw new Error('Banrisul OFX TRANSFER não está no grupo. Rollback.')
    if (!stoneManualNoGrupo) throw new Error('Stone MANUAL TRANSFER não está no grupo. Rollback.')
    if (banrisulOfxNoGrupo.id !== OFX_NEW_ID) throw new Error('Banrisul OFX no grupo não é a esperada. Rollback.')
    if (stoneManualNoGrupo.id !== MANUAL_STONE_ID) throw new Error('Stone MANUAL no grupo não é a esperada. Rollback.')
    if (Math.abs(banrisulOfxNoGrupo.amount - AMOUNT) > 0.015) throw new Error('amount Banrisul pós errado. Rollback.')
    if (Math.abs(stoneManualNoGrupo.amount - AMOUNT) > 0.015) throw new Error('amount Stone pós errado. Rollback.')

    // 3.6. SANITY 3: stone e sicredi balance não mexeram
    const [stoneAfter, sicrediAfter] = await Promise.all([
      tx.bankAccount.findUniqueOrThrow({ where: { id: stone.id }, select: { balance: true } }),
      tx.bankAccount.findUniqueOrThrow({ where: { id: sicredi.id }, select: { balance: true } }),
    ])
    if (!close(stoneAfter.balance, STONE_BEFORE)) {
      throw new Error(`Stone balance mexeu (${fmt(stoneAfter.balance)} != ${fmt(STONE_BEFORE)}). Rollback.`)
    }
    if (!close(sicrediAfter.balance, SICREDI_BEFORE)) {
      throw new Error(`Sicredi balance mexeu (${fmt(sicrediAfter.balance)} != ${fmt(SICREDI_BEFORE)}). Rollback.`)
    }

    // 3.7. AuditLog: snapshot completo da manual deletada + nova estrutura
    await tx.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        userId: 'cmp9e4kgz00007wajsn05e9mg',
        userName: 'Yussef (Etapa 1 PIX 7.400 OFX_REPLACED_MANUAL_TRANSFER)',
        userEmail: 'yussefmusa5522@gmail.com',
        action: 'OFX_REPLACED_MANUAL_TRANSFER',
        entityType: 'Transfer',
        entityId: GROUP_ID,
        metadata: JSON.stringify({
          context:
            'Caso PIX 7.400 (11/06) — par manual de ontem (10/06 20:09) duplicava OFX de hoje (11/06 19:35). OFX assumiu lado Banrisul do grupo; lado Stone preservado. Manual Banrisul deletada. Balance Banrisul revertido +7.400.',
          groupId: GROUP_ID,
          deletedManual: {
            id: MANUAL_BANRISUL_ID,
            side: 'from (banrisul)',
            snapshot: {
              type: manualBanrisul.type,
              amount: manualBanrisul.amount,
              date: manualBanrisul.date.toISOString(),
              description: manualBanrisul.description,
              origin: manualBanrisul.origin,
              status: manualBanrisul.status,
              lifecycle: manualBanrisul.lifecycle,
              transferGroupId: manualBanrisul.transferGroupId,
              createdAt: manualBanrisul.createdAt.toISOString(),
            },
          },
          preservedManual: {
            id: MANUAL_STONE_ID,
            side: 'to (stone)',
          },
          newOfxInGroup: {
            id: OFX_NEW_ID,
            side: 'from (banrisul)',
            externalId: ofxNew.externalId,
            dedupHash: ofxNew.dedupHash,
            originalType: 'DEBIT',
            newType: 'TRANSFER',
          },
          balanceImpact: {
            banrisulBefore: banrisul.balance,
            banrisulAfter: banrisulAfter.balance,
            banrisulDelta: +AMOUNT,
            stoneInchanged: STONE_BEFORE,
            sicrediInchanged: SICREDI_BEFORE,
          },
          backupPath: '/var/backups/conta-ia/pre-etapa1-pix7400-20260611_175030.dump',
        }),
      },
    })

    return {
      banrisulAfter: banrisulAfter.balance,
      stoneAfter: stoneAfter.balance,
      sicrediAfter: sicrediAfter.balance,
    }
  })

  console.log(`  ✓ OFX virou TRANSFER no grupo ${GROUP_ID.slice(0, 8)}`)
  console.log(`  ✓ Manual Banrisul deletada`)
  console.log(`  ✓ banrisul.balance: ${fmt(banrisul.balance)} → ${fmt(result.banrisulAfter)} (+7.400)`)
  console.log(`  ✓ stone.balance:    ${fmt(result.stoneAfter)} (inalterado)`)
  console.log(`  ✓ sicredi.balance:  ${fmt(result.sicrediAfter)} (inalterado)`)
  console.log(`  ✓ AuditLog OFX_REPLACED_MANUAL_TRANSFER criada`)

  await prisma.$disconnect()
  console.log(`\n=== ETAPA 1 CONCLUÍDA ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
