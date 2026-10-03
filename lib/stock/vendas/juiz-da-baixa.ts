/**
 * ⛔⛔⛔ O JUIZ QUE NÃO DORME — a baixa gravada bate com o motor? (item 2a, 02/10/2026)
 *
 * **A ordem do dono:** *"pra CADA dia de baixas, Σ(o que o motor diz que deveria sair) ==
 * Σ(o que o ledger escreveu), por item, à grama; divergência = VERMELHO com o nome do fluxo
 * que desviou."*
 *
 * ⭐⭐ **M1 É O QUE TORNA A PORTA ÚNICA PERMANENTE.** O guard estrutural
 * (`__tests__/regras-estoque/uma-porta-pra-explosao.test.ts`) impede alguém de ESCREVER uma
 * segunda multiplicação; o M1 pega o estrago de qualquer coisa que **desvie da porta em
 * runtime** — um fluxo novo gravando por fora, um reprocesso que deixou movimento velho vivo,
 * ou o próprio motor mudando sem ninguém reprocessar.
 *
 * ═══ ⚠️⚠️ A ARMADILHA QUE QUASE FEZ ESTE JUIZ NASCER MENTINDO ═══
 *
 * Re-explodir HOJE um dia ANTIGO dá resposta diferente quando a **ficha mudou no meio** — e
 * isso aconteceu de verdade **neste mesmo dia**: a ficha do Combo Caçula virou v3 (sem a Coca
 * 2L embutida) e os dias de 20/09 e 01/10 seguem gravados com a v2. Um juiz ingênuo acusaria
 * aqueles dois dias como "o motor desviou" **toda noite, pra sempre** — e alarme falso
 * repetido é como um alarme morre (os 111 falsos do juiz de vendas, 26/08).
 *
 * ⭐ Por isso o veredito tem **TRÊS** saídas, não duas — a mesma disciplina do B1 do saldo:
 *
 * | motor × ledger | a ficha mudou depois da baixa? | veredito |
 * |---|---|---|
 * | batem | — | **verde** |
 * | divergem | **sim** | **AVISO**: *"a receita mudou depois desta baixa — reprocessar é decisão do dono"* |
 * | divergem | não | ⛔ **ERRO**: alguém baixou fora da porta |
 *
 * ⚠️ E a pergunta *"qual ficha?"* só é respondível porque a porta devolve o **rastro**
 * (`viaFichas`): sem ele eu teria que olhar "alguma ficha da empresa mudou", o que
 * transformaria qualquer edição de receita num perdão geral.
 */

import type { PrismaClient } from '@prisma/client'
import type { StockInvariantFail } from '../stock-invariants'
import { montarPlanoComplementos } from './baixa-complemento'
import { montarPlanoReprocesso } from './baixa-venda'
import { confrontarMotorComLedger, type Confronto } from './confronto-motor-ledger'
import { diasDispensados } from './dia-dispensado'

/**
 * ⚠️ Só os dias recentes: o juiz roda toda noite contra o banco inteiro, e re-explodir um ano
 * de vendas a cada madrugada é o custo que fez o badge do menu ir a 1,3 s (11/09). 30 dias
 * cobre o período em que reprocessar ainda é gesto natural.
 */
const DIAS_VIGIADOS = 30

const dia = (d: Date) => d.toISOString().slice(0, 10)

/** as BAIXA_VENDA VIVAS de um import (estorno já descontado), em valor absoluto por item */
async function ledgerDoImport(db: PrismaClient, companyId: string, receiptId: string) {
  const baixas = await db.stockMovement.findMany({
    where: { companyId, receiptId, tipo: 'BAIXA_VENDA' },
    select: { id: true, itemId: true, quantidade: true, criadoEm: true },
  })
  const estornadas = new Set(
    baixas.length
      ? (
          await db.stockMovement.findMany({
            where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixas.map((b) => b.id) } },
            select: { estornoDeId: true },
          })
        ).map((e) => e.estornoDeId)
      : [],
  )
  const vivas = baixas.filter((b) => !estornadas.has(b.id))
  const porItem = new Map<string, number>()
  for (const b of vivas) porItem.set(b.itemId, (porItem.get(b.itemId) ?? 0) + Math.abs(b.quantidade))
  /** ⚠️ o instante em que a baixa foi GRAVADA — é contra ele que "a ficha mudou depois" compara */
  const gravadoEm = vivas.length
    ? new Date(Math.min(...vivas.map((b) => b.criadoEm.getTime())))
    : null
  return { porItem, gravadoEm, movimentos: vivas.length }
}

/**
 * ⭐ A ficha mudou DEPOIS da baixa? Recebe as fichas que a explosão de hoje usou (o rastro
 * `viaFichas`) e pergunta se alguma ganhou versão nova depois que o movimento foi escrito.
 */
async function receitaMudouDepois(
  db: PrismaClient,
  companyId: string,
  fichaIds: string[],
  gravadoEm: Date | null,
): Promise<string[]> {
  if (!gravadoEm || !fichaIds.length) return []
  const versoes = await db.stockFichaVersao.findMany({
    where: { companyId, fichaId: { in: fichaIds }, criadoEm: { gt: gravadoEm } },
    select: { fichaId: true },
  })
  return [...new Set(versoes.map((v) => v.fichaId))]
}

function frase(fluxo: string, data: string, c: Confronto, nomes: Map<string, string>): string {
  const top = c.divergencias
    .slice(0, 4)
    .map((d) => `${nomes.get(d.itemId) ?? d.itemId}: motor ${d.motor} × ledger ${d.ledger} (${d.dif > 0 ? 'falta' : 'sobra'} ${Math.abs(d.dif)})`)
  const resto = c.divergencias.length > 4 ? ` · e mais ${c.divergencias.length - 4}` : ''
  const ausentes = c.faltamNoLedger.length
    ? ` · ⛔ ${c.faltamNoLedger.length} item(ns) que o motor manda baixar NÃO têm movimento nenhum`
    : ''
  return `${fluxo} de ${data}: a baixa gravada não bate com a explosão da ficha — ${top.join(' · ')}${resto}${ausentes}`
}

export async function checkBaixaInvariants(
  db: PrismaClient,
  now: Date = new Date(),
): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  const desde = new Date(now.getTime() - DIAS_VIGIADOS * 86_400_000)

  const nomes = new Map(
    (await db.stockItem.findMany({ select: { id: true, nome: true } })).map((i) => [i.id, i.nome]),
  )

  // ═══ PRODUTOS ═══
  const imports = await db.stockVendaImport.findMany({
    where: { data: { gte: desde } },
    select: { id: true, companyId: true, data: true },
  })
  for (const imp of imports) {
    const data = dia(imp.data)
    const led = await ledgerDoImport(db, imp.companyId, imp.id)
    // ⚠️ dia sem baixa nenhuma NÃO é divergência — é dia não processado, e quem cobra isso é
    // o V2 (importado e nunca baixou > 24h), que já existe e já respeita a dispensa.
    if (!led.movimentos) continue

    const r = await montarPlanoReprocesso(imp.companyId, data, db)
    if (!r) continue
    const motor = new Map(r.plano.agregada.map((a) => [a.itemId, a.qtd]))
    const c = confrontarMotorComLedger(motor, led.porItem)
    if (c.fecha) continue

    const mudaram = await receitaMudouDepois(db, imp.companyId, r.plano.fichasUsadas, led.gravadoEm)
    if (mudaram.length) {
      fails.push({
        invariante: 'M1',
        companyId: imp.companyId,
        nivel: 'aviso',
        detalhe: `produtos de ${data}: a receita mudou depois desta baixa (${mudaram.length} ficha(s)) — a divergência é esperada; reprocessar o dia é decisão do dono`,
      })
    } else {
      fails.push({ invariante: 'M1', companyId: imp.companyId, detalhe: frase('produtos', data, c, nomes) })
    }
  }

  /**
   * ═══ COMPLEMENTOS ═══
   *
   * ⚠️ Complementos **não têm tabela de import** — o dia é derivado das próprias linhas
   * (`listarDiasComplemento` faz igual). Inventar uma consulta diferente aqui seria a segunda
   * definição de *"que dias existem"*.
   */
  const linhasComp = await db.stockVendaComplementoLinha.findMany({
    where: { data: { gte: desde } },
    select: { companyId: true, data: true, importId: true },
  })
  const diasComp = new Map<string, { companyId: string; data: string; importId: string }>()
  for (const l of linhasComp) {
    const k = `${l.companyId}|${dia(l.data)}`
    if (!diasComp.has(k)) diasComp.set(k, { companyId: l.companyId, data: dia(l.data), importId: l.importId })
  }

  const dispensados = new Set<string>()
  for (const companyId of new Set(linhasComp.map((l) => l.companyId))) {
    // ⭐ a régua ÚNICA da dispensa (05/09) — ⚠️ o escopo é 'COMPLEMENTO', singular
    for (const d of await diasDispensados(db, companyId, 'COMPLEMENTO')) dispensados.add(`${companyId}|${d}`)
  }

  for (const imp of diasComp.values()) {
    const data = imp.data
    if (dispensados.has(`${imp.companyId}|${data}`)) continue
    const led = await ledgerDoImport(db, imp.companyId, imp.importId)
    if (!led.movimentos) continue

    const plano = await montarPlanoComplementos(imp.companyId, data, db).catch(() => null)
    if (!plano) continue
    const motor = new Map(plano.agregada.map((a) => [a.itemId, a.qtd]))
    const c = confrontarMotorComLedger(motor, led.porItem)
    if (c.fecha) continue

    const mudaram = await receitaMudouDepois(db, imp.companyId, plano.fichasUsadas, led.gravadoEm)
    if (mudaram.length) {
      fails.push({
        invariante: 'M1',
        companyId: imp.companyId,
        nivel: 'aviso',
        detalhe: `complementos de ${data}: a receita mudou depois desta baixa (${mudaram.length} ficha(s)) — a divergência é esperada; reprocessar o dia é decisão do dono`,
      })
    } else {
      fails.push({ invariante: 'M1', companyId: imp.companyId, detalhe: frase('complementos', data, c, nomes) })
    }
  }

  return fails
}
