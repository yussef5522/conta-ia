// LOTE PONTES CAÇULA (08/08) — resolve as retiradas órfãs em lote + 2 correções PJ.
// Ordem (menor→maior risco): 1) LM TRANSP→Frete  2) SAQUE 06/07 re-parear TRANSFER
// 3) G1/G2/G3/G5 fluxo A/B (saldo PF net 0)  4) G4 fluxo A (+88.000 no PF).
// Usa createBridge (atomic, mesmo caminho da tela). Idempotente por-tx.
// NÃO muda valor/data de nenhuma tx. Prova invariantes ao final.
// Uso (no servidor): DATABASE_URL=<prod> npx tsx scripts/lote-pontes-cacula.ts

import { PrismaClient } from '@prisma/client'
import { createBridge } from '@/lib/bridges/create'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const USER = 'cmp9e4kgz00007wajsn05e9mg'
const PROFILE = 'cmq1crgsz00cn50toa9zty4uy'
const SOCIO = 'cmq1cqrjk00cj50toproqbscy'
const PF_BANRISUL = 'cmq1ljh8j00011on17owta8vt'
const FRETE = 'cmq1dyhca00eopm34lf141anc' // Frete DESPESAS_COMERCIAIS
const CAT_ENTRY_FALLBACK = 'cmq1crgt600cr50toreol6jwp' // Pró-labore / Lucros (INCOME)
const SPEND = {
  nura: 'cmq5x2l2t0007mk4dvt9glflx',
  Daniela: 'cmq4bn87d0001146tvow4yhic',
  Moradia: 'cmq1crgt600cv50toq8p2yapc',
  Saude: 'cmq1crgt600cx50tol25e6kj8',
}

const LM_TRANSP = ['cmqxf16c5005zo77tfjr6lzbl', 'cmrwzvjwn01xgm8hdbcg1r5ns']
const SAQUE_OUT = [
  'cmr9ogsgs004qw3fsy2ojw56l', 'cmr9ogsgs004sw3fsvz647qr1',
  'cmr9ogsgs004rw3fs043ifj2f', 'cmr9ogsgs004tw3fs8oxzjt4s',
]
const SAQUE_IN = 'cmr9orniz007jw3fsokhwdu5l'
const SAQUE_GID = 'transfer-saque-atm-20260706-cofre'

const G1 = [
  'cmq9y7uqn00ecsjvi6edihg1h', 'cmqifleo8003cq102cx0no9i7', 'cmqifqx7s003kq102fqigtqgg',
  'cmqjsgx2a001a41ddvml0nmzm', 'cmqmu93g1000e4p0x2y6ns6s3', 'cmqqxn4lh00079qqni9zvylx8',
  'cmqva5y7j001l3wyv6qe8g43i', 'cmqzn2ao7001xp0yjdq6smzmb', 'cmrglqo8m00g4m8hdpm001h2l',
  'cmrqmj8eb016im8hdrtlc7q1l', 'cmsdit0sf003cv9nk9vpa2d8l', 'cms9epor300xltao0lkvh5ln3',
  'cmsdiwal200t2v9nkhe3gyxac',
]
const G2 = ['cmrjoc24200qvm8hdmdm1fw7c']
const G3 = ['cmsdit0re002cv9nk36evzarj']
const G5 = ['cmq71l2gf00j6mk4dpl7bnme2']
const G4 = [
  'cmqhdeybx00blnco9cdn60lk9', 'cmqhdeybw00bdnco926z9ujup', 'cmqhdeybw00benco9wqmrins7',
  'cmr6lnudg002j21h86uarqge0', 'cmr6lnudg002h21h87eldyte0', 'cmr6lnudf002g21h85s5gdoje',
  'cmr6lnudg002i21h8e69nuoge', 'cmr9ov1bp008xw3fstvpaecdp', 'cmr9ov1bn007zw3fsyzn93lw2',
  'cmrjoc24200qlm8hdcbhh1626', 'cmrwzp83a01avm8hdceidveh0', 'cmrwzxfal02ajm8hd4rnzg2mr',
  'cmsdiuegp00mxv9nkadk3hjl0', 'cmsdit0rb002av9nkykw6x2ko', 'cmsdit0sy003wv9nktkp6rjkx',
]

const r2 = (n: number) => Math.round(n * 100) / 100

async function pfBalance() {
  const a = await prisma.personalBankAccount.findUniqueOrThrow({ where: { id: PF_BANRISUL }, select: { balance: true } })
  return r2(a.balance)
}
async function pjBalances() {
  const c = await prisma.bankAccount.findMany({ where: { companyId: CO }, select: { name: true, balance: true }, orderBy: { name: 'asc' } })
  return new Map(c.map((x) => [x.name, r2(x.balance)]))
}
async function distribuido() {
  const rows = await prisma.$queryRawUnsafe<Array<{ v: number }>>(
    `SELECT COALESCE(SUM(b.amount),0)::float v FROM pj_to_pf_bridges b WHERE b."companyId"=$1 AND b.kind='DISTRIBUICAO'`, CO)
  return r2(rows[0].v)
}
async function orfas() {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: number; v: number }>>(
    `SELECT count(*)::int n, COALESCE(SUM(t.amount),0)::float v FROM transactions t
     JOIN bank_accounts ba ON ba.id=t."bankAccountId" JOIN categories c ON c.id=t."categoryId"
     WHERE ba."companyId"=$1 AND c."dreGroup"='DISTRIBUICAO_LUCROS' AND t.type='DEBIT' AND t.lifecycle='EFFECTED'
       AND NOT EXISTS (SELECT 1 FROM pj_to_pf_bridges b WHERE b."pjTransactionId"=t.id)`, CO)
  return rows[0]
}
async function snapAll(ids: string[]) {
  const rows = await prisma.transaction.findMany({ where: { id: { in: ids } }, select: { id: true, amount: true, date: true } })
  return new Map(rows.map((t) => [t.id, `${t.amount}|${t.date.toISOString()}`]))
}

async function bridge(pjId: string, spendCat?: string, catEntry?: string) {
  try {
    await createBridge({
      userId: USER, companyId: CO, pjTransactionId: pjId, profileId: PROFILE,
      pfBankAccountId: PF_BANRISUL,
      kind: 'DISTRIBUICAO', createdVia: 'CREATED_MANUAL', socioPFId: SOCIO,
      spend: spendCat ? { categoryId: spendCat } : undefined,
    })
    return 'ok'
  } catch (e: any) {
    if (e?.code === 'PJ_ALREADY_BRIDGED') return 'já-existe'
    throw e
  }
}

// Sequencial (não concorrente): as pontes tocam a MESMA linha de saldo da conta
// PF → concorrência daria deadlock/race. Serial garante incremento exato.
async function bridgeSeq(ids: string[], spendCat: string | undefined, catEntry: string) {
  const out: string[] = []
  for (const id of ids) out.push(await bridge(id, spendCat, catEntry))
  return out
}

async function main() {
  const ALL_IDS = [...LM_TRANSP, ...SAQUE_OUT, SAQUE_IN, ...G1, ...G2, ...G3, ...G5, ...G4]
  const snapBefore = await snapAll(ALL_IDS)
  const pfBefore = await pfBalance()
  const pjBefore = await pjBalances()
  const distBefore = await distribuido()
  const orfBefore = await orfas()
  const pontesBefore = await prisma.pJtoPFBridge.findMany({ select: { id: true, pjTransactionId: true, amount: true } })
  const loansBefore = await prisma.loan.count({ where: { companyId: CO } })

  // categoria de entrada: mesma que as pontes DISTRIBUICAO existentes usam (consistência)
  let catEntry = CAT_ENTRY_FALLBACK
  const modeRows = await prisma.$queryRawUnsafe<Array<{ cat: string; n: number }>>(
    `SELECT pt."categoryId" cat, count(*)::int n FROM pj_to_pf_bridges b
     JOIN personal_transactions pt ON pt.id=b."pfTransactionId"
     WHERE b."companyId"=$1 AND b.kind='DISTRIBUICAO' AND pt."categoryId" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 1`, CO)
  if (modeRows[0]?.cat) {
    const c = await prisma.personalCategory.findUnique({ where: { id: modeRows[0].cat }, select: { type: true, name: true } })
    if (c?.type === 'INCOME') { catEntry = modeRows[0].cat; console.log(`  categoria de entrada (moda existentes): ${c.name}`) }
  }

  console.log(`\nBASELINE  PF banrisul=${pfBefore} · distribuído=${distBefore} · órfãs=${orfBefore.n}(${r2(orfBefore.v)}) · pontes=${pontesBefore.length} · loans=${loansBefore}`)

  // ============ PASSO 1 — LM TRANSP → Frete ============
  let lm = 0
  for (const id of LM_TRANSP) {
    const t = await prisma.transaction.findUniqueOrThrow({ where: { id }, select: { categoryId: true } })
    if (t.categoryId !== FRETE) {
      await prisma.transaction.update({ where: { id }, data: { categoryId: FRETE, status: 'RECONCILED', classificationSource: 'MANUAL' } })
      lm++
    }
  }
  console.log(`\n[1] LM TRANSP → Frete: ${lm} recategorizadas · órfãs agora=${(await orfas()).n}`)

  // ============ PASSO 2 — SAQUE 06/07 re-parear TRANSFER interna ============
  // ADIADO: sistema só modela transferência 1:1 (CHECK transferGroupId + UNIQUE
  // group×direction). O caso é 4:1 (4 saques → 1 depósito no caixa) → precisa
  // consolidar (apagar 4, criar 1 OUT de 7.000). Aguardando decisão do usuário.
  console.log(`[2] SAQUE 06/07 → ADIADO (transferência 4:1 exige consolidar; decisão do usuário)`)

  // ============ PASSO 3 — G1/G2/G3/G5 fluxo A/B (saldo PF net 0) ============
  const g1 = await bridgeSeq(G1, SPEND.nura, catEntry)
  console.log(`\n[3] G1 nura   (A/B): ${g1.filter((x) => x === 'ok').length}/${G1.length} · PF banrisul=${await pfBalance()}`)
  const g2 = await bridgeSeq(G2, SPEND.Daniela, catEntry)
  console.log(`    G2 Daniela(A/B): ${g2.filter((x) => x === 'ok').length}/${G2.length} · PF banrisul=${await pfBalance()}`)
  const g3 = await bridgeSeq(G3, SPEND.Moradia, catEntry)
  console.log(`    G3 Moradia(A/B): ${g3.filter((x) => x === 'ok').length}/${G3.length} · PF banrisul=${await pfBalance()}`)
  const g5 = await bridgeSeq(G5, SPEND.Saude, catEntry)
  console.log(`    G5 Saúde  (A/B): ${g5.filter((x) => x === 'ok').length}/${G5.length} · PF banrisul=${await pfBalance()}`)

  // ============ PASSO 4 — G4 fluxo A (+88.000 no PF) ============
  const g4 = await bridgeSeq(G4, undefined, catEntry)
  console.log(`\n[4] G4 retirada simples (fluxo A): ${g4.filter((x) => x === 'ok').length}/${G4.length} · PF banrisul=${await pfBalance()}`)

  // ============ PROVA ============
  const pfAfter = await pfBalance()
  const pjAfter = await pjBalances()
  const distAfter = await distribuido()
  const orfAfter = await orfas()
  const pontesAfter = await prisma.pJtoPFBridge.findMany({ select: { id: true, pjTransactionId: true, amount: true } })
  const loansAfter = await prisma.loan.count({ where: { companyId: CO } })
  const snapAfter = await snapAll(ALL_IDS)

  console.log('\n════════ PROVA ════════')
  console.log(`  PF banrisul: ${pfBefore} → ${pfAfter}  (Δ ${r2(pfAfter - pfBefore)} — esperado +88000)`)
  console.log(`  Δ PF == +88000 ? ${Math.abs((pfAfter - pfBefore) - 88000) < 0.01 ? 'SIM ✓' : 'NÃO ✗'}`)
  console.log('  Saldos das 5 contas PJ (Δ deve ser 0):')
  for (const [name, bal] of pjAfter) console.log(`    ${name.padEnd(18)} ${pjBefore.get(name)} → ${bal}  Δ ${r2(bal - (pjBefore.get(name) ?? 0))}`)
  const pjOk = [...pjAfter].every(([n, b]) => Math.abs(b - (pjBefore.get(n) ?? 0)) < 0.01)
  console.log(`  5 contas PJ inalteradas ? ${pjOk ? 'SIM ✓' : 'NÃO ✗'}`)
  // 23 pontes antigas intactas
  const beforeMap = new Map(pontesBefore.map((p) => [p.id, `${p.pjTransactionId}|${p.amount}`]))
  const afterMap = new Map(pontesAfter.map((p) => [p.id, `${p.pjTransactionId}|${p.amount}`]))
  const oldIntact = [...beforeMap].every(([id, v]) => afterMap.get(id) === v)
  console.log(`  Pontes: ${pontesBefore.length} → ${pontesAfter.length} (+${pontesAfter.length - pontesBefore.length}) · ${pontesBefore.length} antigas intactas ? ${oldIntact ? 'SIM ✓' : 'NÃO ✗'}`)
  console.log(`  Empréstimos: ${loansBefore} → ${loansAfter} (Δ0 ? ${loansBefore === loansAfter ? 'SIM ✓' : 'NÃO ✗'})`)
  // nenhuma tx com valor/data alterados
  const noChange = [...snapBefore].every(([id, v]) => snapAfter.get(id) === v)
  console.log(`  Nenhuma tx com valor/data alterados ? ${noChange ? 'SIM ✓' : 'NÃO ✗'}`)
  console.log(`\n  Já distribuído: ${distBefore} → ${distAfter} (Δ ${r2(distAfter - distBefore)})`)
  console.log(`  Órfãs (não classificado): ${orfBefore.n}(${r2(orfBefore.v)}) → ${orfAfter.n}(${r2(orfAfter.v)})`)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
