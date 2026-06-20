// Sprint ContentHash Estável FASE 4 — TESTE-CHAVE
// Simula re-import dos DEBITs 20.300 e 8.000 com FITID renumerado.
// Após backfill, o gate DEVE barrar (0 novas) porque agora contentHash bate.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'
import { applyIdentityGate } from '../lib/import-identity/apply-gate'
import { loadLedgerState } from '../lib/import-identity/ledger-queries'

const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const prisma = new PrismaClient()

interface Incoming { fitid: string; amount: number; date: string; type: 'DEBIT' | 'CREDIT'; memo: string }

const SIMULADAS: Incoming[] = [
  { fitid: '999001', amount: 20300, date: '2026-06-08', type: 'DEBIT', memo: 'PIX ENVIADO' },
  { fitid: '999002', amount: 8000, date: '2026-06-16', type: 'DEBIT', memo: 'PIX ENVIADO' },
]

async function main() {
  console.log('━'.repeat(80))
  console.log('TESTE-CHAVE — re-import simulado Banrisul DEBIT renumerados')
  console.log('━'.repeat(80))
  console.log('\nSimula DEBITs com FITID inédito (Banrisul renumera) em data/valor de TRANSFER OUT:')
  for (const s of SIMULADAS) {
    console.log(`  · ${s.date} ${s.type} R$ ${s.amount} ext=${s.fitid} memo="${s.memo}"`)
  }

  // Constrói incoming pra applyIdentityGate
  const incoming = SIMULADAS.map((s) => ({
    payload: s,
    identity: computeIdentity({
      accountId: BANRISUL,
      fitid: s.fitid,
      date: s.date,
      amount: s.amount,
      type: s.type,
      memo: s.memo,
    }),
  }))

  console.log('\nIdentidades calculadas:')
  for (const i of incoming) {
    console.log(`  ${i.payload.fitid}: contentHash=${i.identity.contentHash.slice(0, 16)} fitidKey=${i.identity.fitidKey?.slice(0, 16) ?? 'null'}`)
  }

  // Carrega ledger state
  const ledger = await loadLedgerState(
    BANRISUL,
    incoming.map((i) => i.identity.fitidKey).filter((k): k is string => k !== null),
    incoming.map((i) => i.identity.contentHash),
  )

  // Roda gate
  const result = applyIdentityGate(incoming, ledger)

  console.log('\nResultado:')
  console.log(`  toInsert: ${result.toInsert.length}`)
  console.log(`  skipped:  ${result.skipped.length}`)
  console.log(`  Stats: fitid=${result.stats.skippedFitid} content=${result.stats.skippedContent}`)

  if (result.toInsert.length === 0 && result.skipped.length === 2) {
    console.log('\n  ✅ TESTE-CHAVE PASSOU — gate barrou via contentHash estável')
  } else {
    console.log('\n  🚨 TESTE-CHAVE FALHOU')
    for (const i of result.toInsert) console.log(`    NOVA: ${i.payload.fitid}`)
    for (const s of result.skipped) console.log(`    SKIP (${s.reason}): ${s.payload.fitid}`)
  }

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
