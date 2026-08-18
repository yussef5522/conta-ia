// FASE 1 (10/08) — MEDIR ANTES. Roda os 4 motores de detecção de par de
// transferência contra os dados REAIS das 3 empresas (READ-ONLY, zero escrita).
// Monta a tabela: por par candidato (união), o que cada motor diz.
// Uso (no servidor): DATABASE_URL=<prod> npx tsx scripts/measure-transfer-engines.ts

import { PrismaClient } from '@prisma/client'
import { findActiveTransferCandidates } from '@/lib/conciliation/active-transfer-detector'
import { findRetroactivePairs, type TxForDetect } from '@/lib/transfers/detect-retroactive'
import { scanRetroativo } from '@/lib/transfers/scan-retroativo'
import { loadOwnEntityRefs } from '@/lib/transfers/load-own-entity-refs'
import { detectTransfers, type UnifiedTx } from '@/lib/transfers/unified-transfer-engine'

const prisma = new PrismaClient()
const MS_DAY = 86400000
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const keyOf = (a: string, b: string) => [a, b].sort().join('|')
const daysBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / MS_DAY

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })

  for (const co of companies) {
    const refs = await loadOwnEntityRefs(prisma, co.id)

    // ---- MOTOR A (active-transfer-detector) — self-loads do DB ----
    const aCands = await findActiveTransferCandidates(co.id, {})
    const A = new Map<string, number>()
    for (const c of aCands) A.set(keyOf(c.debit.id, c.credit.id), c.confidence)

    // ---- órfãs (12m) pra C e D ----
    const since = new Date(Date.now() - 365 * MS_DAY)
    const orfasRaw = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: co.id },
        type: { in: ['CREDIT', 'DEBIT'] },
        transferGroupId: null,
        transferDismissedAt: null,
        isInternalTransfer: false,
        date: { gte: since },
      },
      select: { id: true, bankAccountId: true, date: true, type: true, amount: true, description: true, bankAccount: { select: { name: true } } },
      take: 5000,
    })
    const txsForDetect: TxForDetect[] = orfasRaw
      .filter((t) => t.bankAccountId)
      .map((t) => ({ id: t.id, bankAccountId: t.bankAccountId!, bankAccountName: t.bankAccount?.name ?? '', date: t.date, type: t.type, amount: t.amount, description: t.description }))

    // ---- MOTOR C (detect-retroactive, threshold 0.85) ----
    const cRes = findRetroactivePairs(txsForDetect, refs)
    const C = new Map<string, number>()
    for (const p of cRes.pairs) C.set(keyOf(p.from.id, p.to.id), p.confidence)

    // ---- MOTOR D (scan-retroativo, minConfidence 0.85) ----
    const dRes = scanRetroativo({ txs: txsForDetect, refs, minConfidence: 0.85 })
    const D = new Map<string, { c: number; level: string; nameOk: boolean }>()
    for (const p of dRes.pairs) D.set(keyOf(p.from.id, p.to.id), { c: p.confidence, level: p.level, nameOk: p.nameMatchOk })
    // D a 0.70 também (pra ver os falsos que o 0.70 pegava)
    const dRes70 = scanRetroativo({ txs: txsForDetect, refs, minConfidence: 0.70 })
    const D70 = new Map<string, { c: number; level: string; nameOk: boolean }>()
    for (const p of dRes70.pairs) D70.set(keyOf(p.from.id, p.to.id), { c: p.confidence, level: p.level, nameOk: p.nameMatchOk })

    // ---- MOTOR B (parear-sugestoes) — replicado: PENDING+PENDING, ±0,01, ±3d ----
    const pend = await prisma.transaction.findMany({
      where: { bankAccount: { companyId: co.id }, status: 'PENDING', transferGroupId: null, type: { in: ['CREDIT', 'DEBIT'] } },
      select: { id: true, bankAccountId: true, date: true, type: true, amount: true, description: true },
    })
    const B = new Set<string>()
    const pd = pend.filter((t) => t.type === 'DEBIT')
    const pc = pend.filter((t) => t.type === 'CREDIT')
    for (const d of pd) for (const c of pc) {
      if (!d.bankAccountId || !c.bankAccountId || d.bankAccountId === c.bankAccountId) continue
      if (Math.abs(d.amount - c.amount) > 0.01) continue
      if (daysBetween(d.date, c.date) > 3) continue
      B.add(keyOf(d.id, c.id))
    }

    // ---- MOTOR NOVO (unified, 3 camadas) — SHADOW-RUN ----
    const vc = await prisma.transaction.groupBy({
      by: ['amount'],
      where: { bankAccount: { companyId: co.id }, date: { gte: new Date(Date.now() - 60 * MS_DAY) } },
      _count: { _all: true },
    })
    const valorComum = new Set(vc.filter((v) => v._count._all >= 3).map((v) => Math.round(v.amount * 100) / 100))
    const uniTxs: UnifiedTx[] = txsForDetect.map((t) => ({ ...t }))
    const NEW = detectTransfers(uniTxs, { refs, valorComum })
    const Nsug = new Map(NEW.suggestions.map((s) => [keyOf(s.from.id, s.to.id), s]))
    const Nweak = new Map(NEW.weak.map((s) => [keyOf(s.from.id, s.to.id), s]))

    // ---- UNIÃO de todos os candidatos ----
    const allKeys = new Set<string>([...A.keys(), ...B, ...C.keys(), ...D.keys(), ...D70.keys(), ...Nsug.keys(), ...Nweak.keys()])
    const meta = new Map(orfasRaw.map((t) => [t.id, t]))

    console.log(`\n\n════════════════ ${co.name} (${co.id}) ════════════════`)
    console.log(`  órfãs 12m: ${orfasRaw.length} · PENDING: ${pend.length} · candidatos únicos: ${allKeys.size}`)
    console.log(`  A(active)=${A.size} · B(parear PEND)=${B.size} · C(retro .85)=${C.size} · D(scan .85)=${D.size} · D(scan .70)=${D70.size} · NOVO sug=${Nsug.size} weak=${Nweak.size}`)
    // ---- SHADOW-RUN: provas ----
    const bons = new Set<string>([...A.keys(), ...C.keys(), ...D.keys()]) // A e C e D@0.85 = os BONS
    const pegaTodosBons = [...bons].every((k) => Nsug.has(k))
    const falsos70 = [...D70.keys()].filter((k) => !bons.has(k)) // D@0.70-only = os falsos
    const sugereFalso = falsos70.filter((k) => Nsug.has(k))
    console.log(`  [SHADOW] NOVO pega todos os pares BONS (A∪C∪D.85=${bons.size})? ${pegaTodosBons ? 'SIM ✓' : 'NÃO ✗'}`)
    console.log(`  [SHADOW] falsos (D@0.70-only)=${falsos70.length} · NOVO sugere algum falso? ${sugereFalso.length === 0 ? 'NÃO ✓' : 'SIM ✗ (' + sugereFalso.length + ')'}`)
    const weakExato = NEW.weak.filter((w) => w.signals.exactValue).length
    const weakProx = NEW.weak.length - weakExato
    const weakComKeyword = NEW.weak.filter((w) => w.signals.transferKeyword || w.signals.ownEntity).length
    console.log(`  [WEAK] total=${NEW.weak.length} · exato=${weakExato} · valor-próximo=${weakProx} · com sinal(keyword/own)=${weakComKeyword}`)
    if (allKeys.size === 0) { console.log('  (nenhum candidato)'); continue }
    console.log('\n  PAR | A | B | C | D.85 | D.70 | NOVO | detalhe')
    for (const k of allKeys) {
      const [id1, id2] = k.split('|')
      const t1 = meta.get(id1); const t2 = meta.get(id2)
      const a = A.has(k) ? A.get(k)!.toFixed(2) : '·'
      const b = B.has(k) ? 'S' : '·'
      const c = C.has(k) ? C.get(k)!.toFixed(2) : '·'
      const d85 = D.get(k); const d70 = D70.get(k)
      const dS = d85 ? `${d85.c.toFixed(2)}/${d85.level}/${d85.nameOk ? 'ok' : 'NO'}` : '·'
      const d70S = d70 ? `${d70.c.toFixed(2)}/${d70.level}/${d70.nameOk ? 'ok' : 'NO'}` : '·'
      const ns = Nsug.get(k); const nw = Nweak.get(k)
      const nS = ns ? `${ns.layer}✓${ns.confidence}` : nw ? `weak/${nw.confidence}` : '·'
      const val = t1 ? brl(t1.amount) : '?'
      const contas = t1 && t2 ? `${t1.bankAccount?.name}→${t2.bankAccount?.name}` : ''
      const desc = t1 && t2 ? `${(t1.description ?? '').slice(0, 20)} / ${(t2.description ?? '').slice(0, 20)}` : ''
      const dias = t1 && t2 ? daysBetween(t1.date, t2.date).toFixed(0) : '?'
      console.log(`  R$${val} ${dias}d ${contas} | ${a} | ${b} | ${c} | ${dS} | ${d70S} | ${nS} | ${desc}`)
    }
  }
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
