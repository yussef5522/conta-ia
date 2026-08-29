// ESTOQUE — invariantes do juiz noturno (tabela PRÓPRIA stock_judge_report, isolada:
// falha de estoque nunca mascara nem é mascarada por empréstimo/cartão/venda).
//
// FASE 0: E12 (certificado) + snapshot de isolamento.
// FASE 1 (agora que há MOVIMENTO real): E1 (cache==Σ) · E2 (conferência confirmada tem
// movimentos que somam os itens) · E3 (nota confirmada com duplicata tem payable) ·
// E15 (evento SEFAZ pendente/erro > 24h).

import type { PrismaClient, Prisma } from '@prisma/client'
import { saldosDaEmpresa } from './saldo'
import { checkProducaoInvariants } from './producao/producao-invariants'
import { checkVendasInvariants } from './vendas/vendas-invariants'
import { checkSaidaInvariants } from './saida-invariants'
import { checkContagemInvariants } from './contagem-invariants'
import { checkNfeInvariants } from './nfe-invariants'
import { checkPonteInvariants } from './ponte-invariants'

type Db = PrismaClient | Prisma.TransactionClient

export interface StockInvariantFail {
  invariante: string
  companyId: string | null
  detalhe: string
  nivel?: 'erro' | 'aviso' // 'aviso' aparece no relatório mas NÃO deixa o selo vermelho (default 'erro')
}

const E12_DIAS = 30
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function checkStockInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const F = (invariante: string, companyId: string | null, detalhe: string) => fails.push({ invariante, companyId, detalhe })

  // E12 — certificado ativo vence em < 30 dias (ou já venceu).
  const certs = await db.stockCertificate.findMany({ where: { status: 'ATIVO' }, select: { companyId: true, cnpj: true, validadeAte: true } })
  for (const c of certs) {
    const dias = Math.floor((c.validadeAte.getTime() - now.getTime()) / 86_400_000)
    if (dias < 0) F('E12', c.companyId, `certificado ${c.cnpj} VENCIDO há ${-dias} dia(s) — o download da SEFAZ está parado. Renove.`)
    else if (dias < E12_DIAS) F('E12', c.companyId, `certificado ${c.cnpj} vence em ${dias} dia(s) — renove antes de vencer.`)
  }

  // empresas com dado de estoque (movimento OU nota) — o universo do juiz.
  const companiesComMov = await db.stockMovement.findMany({ distinct: ['companyId'], select: { companyId: true } })
  const companyIds = [...new Set(companiesComMov.map((c) => c.companyId))]

  // E1 — cache de saldo == Σ movimentos (por item).
  for (const companyId of companyIds) {
    const derivados = await saldosDaEmpresa(db, companyId)
    const derivadoPorItem = new Map(derivados.map((d) => [d.itemId, d.saldo]))
    const caches = await db.stockSaldoCache.findMany({ where: { companyId }, select: { itemId: true, saldo: true } })
    for (const c of caches) {
      const der = derivadoPorItem.get(c.itemId) ?? 0
      if (Math.abs(round2(c.saldo) - round2(der)) > 0.001) {
        F('E1', companyId, `item ${c.itemId}: cache de saldo ${round2(c.saldo)} ≠ Σ movimentos ${round2(der)} — recompute.`)
      }
    }
    // cache faltando pra item com movimento (stale) — aviso brando
    for (const d of derivados) {
      if (!caches.find((c) => c.itemId === d.itemId)) F('E1', companyId, `item ${d.itemId}: tem movimento mas SEM cache de saldo (recompute pendente).`)
    }
  }

  // E2 — toda conferência CONFIRMADA/DIVERGENTE_ACEITA tem movimentos que somam os itens.
  const confs = await db.stockReceiptConference.findMany({ where: { status: { in: ['CONFIRMADA', 'DIVERGENTE_ACEITA'] } }, select: { id: true, companyId: true } })
  for (const conf of confs) {
    // ⚠️ CONTA LÍQUIDO, não bruto (27/08). Antes isto era um `count` cru de ENTRADA_NF e
    // ficava VERMELHO em qualquer correção — e correção pelo caminho documentado do módulo
    // é justamente **ESTORNO + movimento novo** (o ledger é imutável, não se edita linha).
    // Ou seja, o invariante era incompatível com a própria disciplina de correção do
    // estoque: bastava corrigir um item de nota pra o juiz acusar rombo que não existe.
    // Achado ao reunitizar o pão (pacote → unidade), que faz exatamente esse par.
    // A pergunta certa é "quantas entradas VALENDO existem", e entrada estornada não vale.
    const [nItens, entradas, estornos] = await Promise.all([
      db.stockConferenceItem.count({ where: { conferenceId: conf.id } }),
      db.stockMovement.findMany({ where: { companyId: conf.companyId, receiptId: conf.id, tipo: 'ENTRADA_NF' }, select: { id: true } }),
      db.stockMovement.findMany({ where: { companyId: conf.companyId, receiptId: conf.id, tipo: 'ESTORNO' }, select: { estornoDeId: true } }),
    ])
    const estornados = new Set(estornos.map((e) => e.estornoDeId).filter((x): x is string => !!x))
    const movs = entradas.filter((m) => !estornados.has(m.id)).length
    if (movs !== nItens) F('E2', conf.companyId, `conferência ${conf.id}: ${nItens} itens conferidos vs ${movs} movimentos ENTRADA_NF vigentes (deveriam ser iguais).`)
  }

  // E3 — toda nota CONFIRMADA com duplicata tem contas a pagar sugerido.
  const notasConf = await db.stockNfe.findMany({ where: { status: 'CONFIRMADA' }, select: { id: true, companyId: true } })
  for (const n of notasConf) {
    const dups = await db.stockNfeDup.count({ where: { companyId: n.companyId, nfeId: n.id } })
    if (dups > 0) {
      const pag = await db.stockPayableSuggestion.count({ where: { companyId: n.companyId, nfeId: n.id } })
      if (pag < dups) F('E3', n.companyId, `nota ${n.id}: ${dups} duplicata(s) na nota mas ${pag} conta(s) a pagar sugerida(s).`)
    }
  }

  // E15 — evento SEFAZ pendente/erro há > 24h SEM manifestação registrada.
  // Uma nota que JÁ tem um evento ENVIADO (Ciência 210210 OU Confirmação 210200 — a
  // Confirmação é mais forte e supera a Ciência) está manifestada; tentativas ANTERIORES
  // que falharam (parse ruim, seq 594) são ruído, não problema. Só flagra nota SEM sucesso.
  const limite = new Date(now.getTime() - 24 * 3600_000)
  const [enviados, eventosPend] = await Promise.all([
    db.stockSefazEvent.findMany({ where: { status: 'ENVIADO' }, select: { companyId: true, chave: true } }),
    db.stockSefazEvent.findMany({ where: { status: { in: ['PENDENTE', 'ERRO'] }, criadoEm: { lt: limite } }, select: { companyId: true, chave: true, tpEvento: true, status: true } }),
  ])
  const manifestada = new Set(enviados.map((e) => `${e.companyId}|${e.chave}`))
  for (const e of eventosPend) {
    if (manifestada.has(`${e.companyId}|${e.chave}`)) continue // já manifestada com sucesso
    F('E15', e.companyId, `evento ${e.tpEvento} da nota ${e.chave} está ${e.status} há > 24h SEM manifestação registrada — reenviar.`)
  }

  // P1-P6 — invariantes de PRODUÇÃO (fase 2). Mesma tabela isolada, mesmo relatório.
  fails.push(...(await checkProducaoInvariants(db, now)))
  // V1 — invariantes de VENDA (fase 3). V1 é AVISO (não deixa o selo vermelho).
  fails.push(...(await checkVendasInvariants(db, now)))
  // C1/C2 — invariantes de SAÍDA (perda/uso interno). C1 erro, C2 aviso.
  fails.push(...(await checkSaidaInvariants(db, now)))
  // E7/E8 — invariantes da CONTAGEM (fase 3 parte 2). E8 erro (ajuste bate com o ledger),
  // E7 aviso (item com saldo sem contagem há > 30 dias).
  fails.push(...(await checkContagemInvariants(db, now)))
  // E10 — nota na fila sem XML completo há > 24h. Olha a tabela do FATO (a nota), não a
  // do PROCESSO (o evento) — foi exatamente o que deixou a Focatto passar 2 dias invisível.
  fails.push(...(await checkNfeInvariants(db, now)))
  // F1/F2/F3/F4 — a PONTE pro financeiro. O estoque ganhou permissão de escrever em
  // `transactions`/`suppliers`; o juiz confere TODA linha que ele escreveu lá.
  // F4 (29/08) mede contra o COMBINADO vigente, não contra as duplicatas cruas do XML —
  // renegociação pós-nota é legítima, e a régua velha acusaria toda uma como erro.
  fails.push(...(await checkPonteInvariants(db, now)))

  return fails
}

// ---------------------------------------------------------------------------
// SNAPSHOT DE ISOLAMENTO (Fase 0) — operação de estoque NÃO altera módulo fechado.
// ---------------------------------------------------------------------------

// ⚠️ `accountsPayable` NÃO é delegate do Prisma (contas a pagar são `Transaction` com
// lifecycle=PAYABLE) — fica na lista por documentação, o `if (delegate?.count)` pula.
// A cobertura real de contas a pagar vem de `transaction`.
const TABELAS_FECHADAS = [
  'transaction', 'category', 'accountsPayable', 'vendaDiaria', 'loan',
  'businessCreditCard', 'bankAccount', 'aiLearningRule', 'supplier',
] as const

export interface IsolationSnapshot { [tabela: string]: number }

// Transaction não tem `companyId` direto (JOIN via bankAccount) — as demais têm.
const ESCOPO_EMPRESA: Record<string, (companyId: string) => object> = {
  transaction: (companyId) => ({ bankAccount: { companyId } }),
}
const escopoDe = (t: string, companyId: string) => (ESCOPO_EMPRESA[t] ?? ((c: string) => ({ companyId: c })))(companyId)

/**
 * Conta as linhas dos módulos FECHADOS. Sem `companyId` conta tudo (uso do juiz noturno).
 *
 * COM `companyId` conta só as linhas daquela empresa — é o que os testes devem usar:
 * a suíte roda arquivos em PARALELO contra o mesmo banco, e qualquer outro teste criando
 * ou apagando empresa (cascade → bankAccount/transaction) mudava a contagem GLOBAL entre
 * dois snapshots e pintava de vermelho um isolamento que estava intacto. Escopar por
 * empresa não afrouxa a regra — deixa a pergunta exata: "a operação de estoque DESTA
 * empresa criou linha em módulo fechado DESTA empresa?".
 */
export async function snapshotClosedModules(db: Db, companyId?: string): Promise<IsolationSnapshot> {
  const snap: IsolationSnapshot = {}
  for (const t of TABELAS_FECHADAS) {
    // @ts-expect-error — acesso dinâmico ao delegate do Prisma
    const delegate = db[t]
    if (!delegate?.count) continue
    snap[t] = companyId ? await delegate.count({ where: escopoDe(t, companyId) }) : await delegate.count()
  }
  return snap
}

export function isolationHeld(antes: IsolationSnapshot, depois: IsolationSnapshot): boolean {
  const keys = new Set([...Object.keys(antes), ...Object.keys(depois)])
  for (const k of keys) if (antes[k] !== depois[k]) return false
  return true
}
