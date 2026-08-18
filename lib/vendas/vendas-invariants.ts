// VENDAS FASE 1 item 4 (17/08) — invariantes V1-V4 do juiz noturno. Só competência
// >= moduleInicio (12/08). Provam que a VendaDiaria (derivada) está fiel às
// Transaction — se o gatilho não rodar após um import/categorização, o juiz grita.
//
// V1: Σ VendaDiaria(EXTRATO_INFERIDO) == Σ recompute esperado (por chave). Diverge
//     → venda sem competência, dobrada, ou VendaDiaria velha (gatilho não rodou).
// V2: nenhuma VendaDiaria sem origem (link N:1); nenhuma venda-tx sem VendaDiaria.
// V3: nenhuma VendaDiaria com companyId != da tx de origem (vazamento multi-tenant).
// V4: recompute 2× idêntico (determinismo/idempotência).

import type { PrismaClient, Prisma } from '@prisma/client'
import { computeExpectedVendas } from './recompute-vendas'
import { diaUTC } from './feriados-nacionais'

type Db = PrismaClient | Prisma.TransactionClient

export interface VendaInvariantFail {
  invariante: 'V1' | 'V2' | 'V3' | 'V4'
  companyId: string
  companyName: string
  detalhe: string
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const meiaNoite = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const chave = (i: Date, f: Date, meio: string, tipo: string) => `${diaUTC(i)}|${diaUTC(f)}|${meio}|${tipo}`

export interface StoredVenda {
  id: string
  dataCompetencia: Date
  dataCompetenciaFim: Date
  meio: string
  tipo: string
  valorLiquido: number
  origens: { transactionId: string }[]
}
export interface ExpectedVenda {
  dataCompetencia: Date
  dataCompetenciaFim: Date
  meio: string
  tipo: string
  valorLiquido: number
  origens: { transactionId: string }[]
}

/** PURA — V1 (valor por chave), V2 (links), V3 (multi-tenant). Testável sem DB.
 *  `txCompany`: companyId real de cada tx de origem (pra V3). */
export function diffVendas(
  companyId: string,
  companyName: string,
  stored: StoredVenda[],
  expected: ExpectedVenda[],
  txCompany: Map<string, string>,
): VendaInvariantFail[] {
  const fails: VendaInvariantFail[] = []
  const F = (invariante: VendaInvariantFail['invariante'], detalhe: string) => fails.push({ invariante, companyId, companyName, detalhe })

  // V1 — valor por chave
  const mapExp = new Map<string, number>()
  for (const v of expected) mapExp.set(chave(v.dataCompetencia, v.dataCompetenciaFim, v.meio, v.tipo), round2(v.valorLiquido))
  const mapSto = new Map<string, number>()
  for (const v of stored) mapSto.set(chave(v.dataCompetencia, v.dataCompetenciaFim, v.meio, v.tipo), round2(v.valorLiquido))
  for (const k of new Set([...mapExp.keys(), ...mapSto.keys()])) {
    const e = mapExp.get(k) ?? 0
    const s = mapSto.get(k) ?? 0
    if (Math.abs(e - s) > 0.01) F('V1', `chave ${k}: gravado ${s.toFixed(2)} vs esperado ${e.toFixed(2)} (VendaDiaria velha ou dobrada?)`)
  }

  // V2 — links completos
  for (const v of stored) if (v.origens.length === 0) F('V2', `VendaDiaria ${v.id} (${diaUTC(v.dataCompetencia)} ${v.meio}) SEM origem`)
  const txExp = new Set(expected.flatMap((v) => v.origens.map((o) => o.transactionId)))
  const txSto = new Set(stored.flatMap((v) => v.origens.map((o) => o.transactionId)))
  for (const t of txExp) if (!txSto.has(t)) F('V2', `venda-tx ${t} tem competência >= corte mas NÃO está em nenhuma VendaDiaria`)
  for (const t of txSto) if (!txExp.has(t)) F('V2', `VendaDiaria linka tx ${t} que não é venda-tx do período (link fantasma)`)

  // V3 — multi-tenant
  for (const t of txSto) {
    const c = txCompany.get(t)
    if (c && c !== companyId) F('V3', `tx ${t} é da empresa ${c}, não ${companyId} (vazamento)`)
  }
  return fails
}

export async function checkVendasForCompany(
  db: Db,
  companyId: string,
  companyName: string,
  moduleInicio: Date,
): Promise<VendaInvariantFail[]> {
  const inicio = meiaNoite(moduleInicio)
  const expected = await computeExpectedVendas(db, companyId, moduleInicio)
  const expected2 = await computeExpectedVendas(db, companyId, moduleInicio)

  const fails: VendaInvariantFail[] = []
  // V4 — determinismo/idempotência (recompute 2× idêntico)
  if (JSON.stringify(expected) !== JSON.stringify(expected2)) {
    fails.push({ invariante: 'V4', companyId, companyName, detalhe: 'recompute 2× deu resultado DIFERENTE (não-determinístico)' })
  }

  const stored = await db.vendaDiaria.findMany({
    where: { companyId, origem: 'EXTRATO_INFERIDO', dataCompetencia: { gte: inicio } },
    include: { origens: { select: { transactionId: true } } },
  })

  // V3 precisa do companyId real de cada tx de origem.
  const txIds = [...new Set(stored.flatMap((v) => v.origens.map((o) => o.transactionId)))]
  const txCompany = new Map<string, string>()
  if (txIds.length > 0) {
    const txs = await db.transaction.findMany({ where: { id: { in: txIds } }, select: { id: true, bankAccount: { select: { companyId: true } } } })
    for (const t of txs) if (t.bankAccount?.companyId) txCompany.set(t.id, t.bankAccount.companyId)
  }

  // V1/V2/V3 — comparação PURA (testável)
  fails.push(...diffVendas(companyId, companyName, stored, expected, txCompany))
  return fails
}
