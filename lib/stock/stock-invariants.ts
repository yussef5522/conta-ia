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

  // E3 — toda nota CONFIRMADA com parcela tem contas a pagar sugerido.
  //
  // ⚠️ A RÉGUA É O COMBINADO, não a duplicata crua (29/08/2026 — mesma correção do F4).
  // Renegociar 3 parcelas do XML em 2 é legítimo; medir contra o XML faria o juiz gritar
  // "3 duplicatas mas 2 sugeridas" toda noite. Alarme falso é como um alarme morre.
  const notasConf = await db.stockNfe.findMany({ where: { status: 'CONFIRMADA' }, select: { id: true, companyId: true } })
  for (const n of notasConf) {
    const renegociadas = await db.stockParcelaCombinada.count({
      where: { companyId: n.companyId, origemDoc: 'NFE', refId: n.id, ativo: true },
    })
    const esperadas = renegociadas > 0
      ? renegociadas
      : await db.stockNfeDup.count({ where: { companyId: n.companyId, nfeId: n.id } })
    if (esperadas > 0) {
      const pag = await db.stockPayableSuggestion.count({ where: { companyId: n.companyId, nfeId: n.id } })
      const fonte = renegociadas > 0 ? 'parcela(s) combinada(s)' : 'duplicata(s) na nota'
      if (pag < esperadas) F('E3', n.companyId, `nota ${n.id}: ${esperadas} ${fonte} mas ${pag} conta(s) a pagar sugerida(s).`)
    }
  }

  // ⭐⭐ E16 — O QUE ENTROU NO ESTOQUE BATE COM O QUE A NOTA DIZ (29/08/2026).
  //
  // ⚠️ ESTE INVARIANTE NÃO EXISTIA, e é o buraco que deixou passar R$ 12.528 de estoque
  // fantasma. O E2 conta LINHAS (itens conferidos × movimentos); ninguém olhava VALOR.
  // Caso real: OVO BRANCO, três notas idênticas de "12 UN × R$ 18 = R$ 216". Em duas
  // delas a quantidade foi convertida à mão pra 360 (12 cartelas × 30 ovos) **e o custo
  // ficou em 18** — em vez de converter (valor intacto), multiplicou o valor por 30:
  // 6.480 no lugar de 216, duas vezes.
  //
  // A régua: Σ(ENTRADA_NF + ESTORNO) da chave  ==  Σ(vProd) dos itens da nota.
  // ⚠️ O ESTORNO ENTRA NA CONTA e o tipo dele é 'ESTORNO', não 'ENTRADA_NF' — esquecer
  // isso acusa toda correção legítima (a reunitização do pão apareceu como "+1.775,96"
  // na minha primeira varredura, e era o método do módulo funcionando). Mesma lição do
  // E2: invariante que soma em ledger imutável tem que contar o LÍQUIDO.
  //
  // ⚠️ TOLERÂNCIA = O LIMITE MATEMÁTICO DO ARREDONDAMENTO, não um número escolhido a dedo:
  // meio centavo por UNIDADE movimentada (0,005 × Σ|quantidade|), com piso de 5 centavos.
  //
  // É o pior caso do custo unitário arredondado a 2 casas — e explica exatamente o que a
  // varredura viu em prod: R$ 0,07 numa nota de 2 caixas é arredondamento; R$ 6.264,00 em
  // 12 unidades é erro. Uma régua fixa em centavos alarmaria as duas, e alarme falso
  // repetido é como um alarme morre (a lição dos 111 de vendas).
  //
  // ⚠️ ISSO NÃO É AFROUXAR: desde 29/08 o custo é gravado em precisão cheia, então a
  // diferença de arredondamento das entradas NOVAS tende a zero. A folga cobre o histórico.
  const notasComEntrada = await db.stockMovement.groupBy({
    by: ['companyId', 'nfeChave'],
    where: { tipo: { in: ['ENTRADA_NF', 'ESTORNO'] }, nfeChave: { not: null } },
    _sum: { custoTotal: true },
    _count: { _all: true },
  })
  for (const g of notasComEntrada) {
    if (!g.nfeChave) continue
    const nota = await db.stockNfe.findFirst({
      where: { companyId: g.companyId, chave: g.nfeChave },
      select: { id: true, emitNome: true },
    })
    if (!nota) continue // nota apagada: outro problema, não este
    const itens = await db.stockNfeItem.aggregate({
      where: { companyId: g.companyId, nfeId: nota.id }, _sum: { vProd: true }, _count: { _all: true },
    })
    const declarado = round2(itens._sum.vProd ?? 0)
    if (declarado <= 0) continue // nota sem itens parseados (só resumo) — nada a comparar
    const entrou = round2(g._sum.custoTotal ?? 0)
    const qtds = await db.stockMovement.findMany({
      where: { companyId: g.companyId, nfeChave: g.nfeChave, tipo: { in: ['ENTRADA_NF', 'ESTORNO'] } },
      select: { quantidade: true },
    })
    const unidadesMovimentadas = qtds.reduce((acc, m) => acc + Math.abs(m.quantidade), 0)
    const tolerancia = Math.max(0.05, 0.005 * unidadesMovimentadas)
    const dif = round2(entrou - declarado)
    if (Math.abs(dif) > tolerancia) {
      F(
        'E16', g.companyId,
        `nota ${g.nfeChave.slice(25, 34)} (${nota.emitNome ?? 'fornecedor'}): entrou R$ ${entrou.toFixed(2)} no estoque, ` +
        `mas a nota declara R$ ${declarado.toFixed(2)} nos itens — diferença de R$ ${Math.abs(dif).toFixed(2)} ` +
        `${dif > 0 ? 'A MAIS' : 'A MENOS'}. Costuma ser quantidade convertida sem o custo acompanhar (o valor tem que ficar intacto).`,
      )
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
