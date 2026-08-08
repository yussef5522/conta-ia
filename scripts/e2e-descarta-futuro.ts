// FASE 2 (07/08) — E2E: import descarta movimento futuro (não vira transação).
// 1 linha real (passado) + 1 futura (>DTASOF e >hoje) → só a real entra (EFFECTED),
// a futura é DESCARTADA e reportada. Nenhum PAYABLE criado.
// Uso: DATABASE_URL=<scratch> RECONCILE_V2=true npx tsx scripts/e2e-descarta-futuro.ts

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'

const prisma = new PrismaClient()

// DTASOF=hoje; 1 linha real (ontem) + 1 futura (daqui a semanas). fitid não-YYMMDD.
function ofx(hojeYmd: string, ontemYmd: string, futuroYmd: string) {
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>041<ACCTID>X<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${ontemYmd}<DTEND>${hojeYmd}
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${ontemYmd}<TRNAMT>-100.00<FITID>REAL01<MEMO>COMPRA REAL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${futuroYmd}<TRNAMT>-13779.73<FITID>FUT01<MEMO>PAGAMENTO CARTAO DE CREDITO</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>-100.00<DTASOF>${hojeYmd}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

async function main() {
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('RECONCILE_V2=true faltando')
  const stamp = Date.now()
  const usr = await prisma.user.create({ data: { name: 'F', email: `f${stamp}@x.com`, password: 'x' } })
  const co = await prisma.company.create({ data: { cnpj: `F${stamp}`, name: 'Fut' } })
  const acc = await prisma.bankAccount.create({ data: { companyId: co.id, name: 'banrisul-f', balance: 0 } })

  // "hoje" do import = daqui a pouco no calendário real do server; uso datas
  // relativas a um "hoje" fixo NÃO dá (o orchestrator usa new Date()). Então
  // ancoro o DTASOF/real no passado e o futuro bem à frente pra garantir > hoje.
  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replace(/-/g, '')
  const futuro = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10).replace(/-/g, '')

  const res = await prisma.$transaction((t) =>
    runImportV2(t as any, { bankAccountId: acc.id, rawOfx: ofx(hoje, ontem, futuro), userId: usr.id, fileName: 'f.ofx' }),
  )

  const rows = await prisma.transaction.findMany({ where: { bankAccountId: acc.id }, select: { lifecycle: true, amount: true, description: true } })
  const conta = await prisma.bankAccount.findUnique({ where: { id: acc.id }, select: { balance: true } })

  const okCriadas = rows.length === 1 && rows[0].lifecycle === 'EFFECTED' && rows[0].amount === 100
  const okSemPayable = rows.filter((r) => r.lifecycle !== 'EFFECTED').length === 0
  const okReport = res.discardedFuture.length === 1 && res.discardedFuture[0].memo.includes('CARTAO')
  const okSaldo = conta?.balance === -100
  const okFecha = res.ledgerMismatch === null

  console.log('\n=== RESULTADO ===')
  console.log(`  tx criadas: ${rows.length} (${rows.map((r) => r.lifecycle + ':' + r.amount).join(', ')})`)
  console.log(`  descartadas futuras: ${res.discardedFuture.length} ${JSON.stringify(res.discardedFuture)}`)
  console.log(`  saldo: ${conta?.balance} (esperado -100) · ledgerMismatch: ${JSON.stringify(res.ledgerMismatch)}`)
  const ok = okCriadas && okSemPayable && okReport && okSaldo && okFecha
  console.log(`  ${ok ? 'OK — real entrou, futura descartada+reportada, saldo fecha' : 'FALHOU'}`)
  process.exit(ok ? 0 : 1)
}
main().finally(() => prisma.$disconnect())
