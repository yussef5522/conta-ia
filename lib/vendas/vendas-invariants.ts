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
import { conferirConsistencia, explicarConsistencia, type LinhaVendaComOrigem } from './consistencia-caixa'

type Db = PrismaClient | Prisma.TransactionClient

export interface VendaInvariantFail {
  invariante: 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6'
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
  // ⚠️ SOMA, não SET (26/08). Com `set`, N linhas de mesma chave sobrescreviam umas às
  // outras e sobrava UMA — que batia com o esperado. Foi por isso que o V1 ficou VERDE
  // enquanto o bloco 31/07 tinha 5 cópias em prod (215.530,15 em vez de 43.106,03):
  // o invariante era CEGO PRA DUPLICATA por construção. Somando, 5 cópias viram 5× o
  // esperado e o V1 grita. Duplicata também é reportada à parte (V5), com a contagem.
  const mapSto = new Map<string, number>()
  const contagemSto = new Map<string, number>()
  for (const v of stored) {
    const k = chave(v.dataCompetencia, v.dataCompetenciaFim, v.meio, v.tipo)
    mapSto.set(k, round2((mapSto.get(k) ?? 0) + v.valorLiquido))
    contagemSto.set(k, (contagemSto.get(k) ?? 0) + 1)
  }
  for (const [k, n] of contagemSto) {
    if (n > 1) F('V5', `chave ${k}: ${n} linhas de VendaDiaria para a MESMA competência/meio — duplicata (recompute não-idempotente?)`)
  }
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

  // ⚠️ SOBREPOSIÇÃO, não pertencimento (26/08). O filtro era `dataCompetencia >= inicio`
  // e escondia do juiz o BLOCO de fim de semana que COMEÇA antes do início do módulo —
  // ele tem competência na sexta, e a sexta pode cair no mês/dia anterior ao corte.
  // O `computeExpectedVendas` COMPUTA esse bloco (o dinheiro entrou depois do corte),
  // mas o `stored` não o buscava → V1 "gravado 0.00 vs esperado X" e V2 "tx não está em
  // nenhuma VendaDiaria", 111 alarmes FALSOS na extensão pra 01/08 (o bloco 31/07–02/08,
  // R$ 43.106,03, existia gravado o tempo todo).
  // É a MESMA decisão que a tela de vendas usa (`lib/vendas/janela-mes.ts`); estava em
  // dois lugares e só um foi corrigido — REGRA 4.
  const stored = await db.vendaDiaria.findMany({
    where: { companyId, origem: 'EXTRATO_INFERIDO', dataCompetenciaFim: { gte: inicio } },
    include: { origens: { select: { transactionId: true } } },
  })

  // V3 precisa do companyId real de cada tx de origem.
  const txIds = [...new Set(stored.flatMap((v) => v.origens.map((o) => o.transactionId)))]
  const txCompany = new Map<string, string>()
  if (txIds.length > 0) {
    const txs = await db.transaction.findMany({ where: { id: { in: txIds } }, select: { id: true, bankAccount: { select: { companyId: true } } } })
    for (const t of txs) if (t.bankAccount?.companyId) txCompany.set(t.id, t.bankAccount.companyId)
  }

  // V1/V2/V3/V5 — comparação PURA (testável)
  fails.push(...diffVendas(companyId, companyName, stored, expected, txCompany))

  // ⭐ V6 — A PONTE ENTRE AS DUAS TELAS. Vendas (competência) e Fluxo (caixa) medem
  // coisas diferentes do MESMO dinheiro; a diferença só pode ser borda de D+N. Se
  // sobrar valor inexplicado, é porque uma tela vê dado que a outra não vê.
  fails.push(...(await checkConsistenciaCaixa(db, companyId, companyName, inicio)))
  return fails
}

/** Roda a ponte Vendas × Caixa mês a mês, do início do módulo até hoje. */
async function checkConsistenciaCaixa(
  db: Db,
  companyId: string,
  companyName: string,
  inicio: Date,
): Promise<VendaInvariantFail[]> {
  const out: VendaInvariantFail[] = []
  const linhasDb = await db.vendaDiaria.findMany({
    where: { companyId, dataCompetenciaFim: { gte: inicio } },
    include: { origens: { select: { transactionId: true, valor: true } } },
  })
  if (linhasDb.length === 0) return out

  type LinhaDb = { dataCompetencia: Date; dataCompetenciaFim: Date; valorLiquido: number; origens: { transactionId: string; valor: number }[] }
  const linhasTip = linhasDb as unknown as LinhaDb[]
  const txIds = [...new Set(linhasTip.flatMap((v) => v.origens.map((o) => o.transactionId)))]
  const txs = txIds.length
    ? await db.transaction.findMany({ where: { id: { in: txIds } }, select: { id: true, date: true } })
    : []
  const dataDaTx = new Map((txs as { id: string; date: Date }[]).map((t) => [t.id, t.date]))

  const linhas: LinhaVendaComOrigem[] = linhasTip.map((v) => ({
    dataCompetencia: v.dataCompetencia,
    dataCompetenciaFim: v.dataCompetenciaFim,
    valorLiquido: v.valorLiquido,
    entradas: v.origens
      .map((o) => ({ data: dataDaTx.get(o.transactionId), valor: o.valor }))
      .filter((e: { data?: Date; valor: number }): e is { data: Date; valor: number } => !!e.data),
  }))

  // meses do início do módulo até o mês corrente
  const hoje = new Date()
  const cur = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1))
  while (cur.getTime() <= hoje.getTime()) {
    const mesIni = new Date(cur.getTime())
    const mesFim = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
    const r = conferirConsistencia(linhas, mesIni, mesFim)
    if (!r.fecha) {
      const rot = `${String(mesIni.getUTCMonth() + 1).padStart(2, '0')}/${mesIni.getUTCFullYear()}`
      out.push({ invariante: 'V6', companyId, companyName, detalhe: explicarConsistencia(r, rot) })
    }
    cur.setUTCMonth(cur.getUTCMonth() + 1)
  }
  return out
}
