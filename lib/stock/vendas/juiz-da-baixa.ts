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
 * | motor × ledger | o MUNDO mudou depois da baixa? | veredito |
 * |---|---|---|
 * | batem | — | **verde** |
 * | divergem | **sim** (ficha versionada **ou** nome mapeado depois) | **AVISO**: *"reprocessar é decisão do dono"* |
 * | divergem | não | ⛔ **ERRO**: alguém baixou fora da porta |
 *
 * ⚠️ E a pergunta *"qual ficha?"* só é respondível porque a porta devolve o **rastro**
 * (`viaFichas`): sem ele eu teria que olhar "alguma ficha da empresa mudou", o que
 * transformaria qualquer edição de receita num perdão geral.
 *
 * ⚠️⚠️ **E "O MUNDO" SÃO DUAS COISAS, NÃO UMA — a prova em prod me ensinou a segunda.** A 1ª
 * versão olhava só a FICHA e acusou os complementos de 11/09 como ERRO; a causa era o dono ter
 * **mapeado dois nomes novos do PDV em 14/09**. Ver `mundoMudouDepois`, abaixo.
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
 * ⭐ O MUNDO MUDOU DEPOIS DA BAIXA? São **DUAS** coisas, e a prova em prod me ensinou a
 * segunda.
 *
 * **(1) A FICHA** — alguma das fichas que a explosão de hoje atravessou (o rastro `viaFichas`)
 * ganhou versão nova depois que o movimento foi escrito. Era o caso do Combo v3.
 *
 * ⚠️⚠️ **(2) O MAPA — e este buraco só apareceu RODANDO contra prod.** A 1ª versão olhava só
 * a ficha, e o M1 acusou **complementos de 11/09** como ERRO: *"COCA COLA LATA 350ML — motor
 * 15 × ledger 0"*. A causa não era ficha nenhuma: aqueles **nomes do PDV foram mapeados
 * DEPOIS** (o dono mapeou `COCA COLA LATA` e a Zero em 14/09 às 17:59). Na época eram
 * pendentes e não baixaram nada — hoje o mapa existe e o motor manda baixar. **Divergência
 * legítima, acusada como defeito.** *Um juiz que trata "o dono mapeou um nome novo" como
 * "alguém baixou por fora" vira ruído na primeira semana de uso real.*
 *
 * ⚠️ **LACUNA DECLARADA:** `stock_venda_produto_map` tem só `criadoEm` (sem `atualizadoEm`),
 * então **TROCAR o destino de um nome já mapeado é invisível** pra esta pergunta — o mapa é
 * upsert e a data não se move. O efeito cai no lado **seguro**: o juiz ACUSA em vez de
 * perdoar, e o dono vê a divergência em vez de ela ser absolvida em silêncio. O mapa de
 * complementos tem `atualizadoEm` e não sofre disso.
 */
async function mundoMudouDepois(
  db: PrismaClient,
  companyId: string,
  fichaIds: string[],
  nomesDoDia: string[],
  gravadoEm: Date | null,
  fluxo: 'PRODUTOS' | 'COMPLEMENTOS',
): Promise<{ fichas: string[]; nomes: string[] }> {
  if (!gravadoEm) return { fichas: [], nomes: [] }

  const versoes = fichaIds.length
    ? await db.stockFichaVersao.findMany({
        where: { companyId, fichaId: { in: fichaIds }, criadoEm: { gt: gravadoEm } },
        select: { fichaId: true },
      })
    : []

  let nomes: string[] = []
  if (nomesDoDia.length) {
    if (fluxo === 'PRODUTOS') {
      nomes = (
        await db.stockVendaProdutoMap.findMany({
          where: { companyId, nomeSuitable: { in: nomesDoDia }, criadoEm: { gt: gravadoEm } },
          select: { nomeSuitable: true },
        })
      ).map((m) => m.nomeSuitable)
    } else {
      nomes = (
        await db.stockVendaComplementoMap.findMany({
          where: {
            companyId,
            nomeSuitable: { in: nomesDoDia },
            OR: [{ criadoEm: { gt: gravadoEm } }, { atualizadoEm: { gt: gravadoEm } }],
          },
          select: { nomeSuitable: true },
        })
      ).map((m) => m.nomeSuitable)
    }
  }

  return { fichas: [...new Set(versoes.map((v) => v.fichaId))], nomes }
}

/** a frase do AVISO, dizendo QUAL das duas coisas mudou — alarme sem causa é ruído */
function fraseDoAviso(fluxo: string, data: string, m: { fichas: string[]; nomes: string[] }): string {
  const partes: string[] = []
  if (m.fichas.length) partes.push(`a receita mudou depois desta baixa (${m.fichas.length} ficha(s))`)
  if (m.nomes.length) partes.push(`${m.nomes.length} nome(s) do PDV foram mapeados depois (${m.nomes.slice(0, 3).join(', ')})`)
  return `${fluxo} de ${data}: ${partes.join(' · ')} — a divergência é esperada; reprocessar o dia é decisão do dono`
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

    const nomesDoDia = [...new Set(r.plano.produtos.map((p) => p.nome))]
    const mudou = await mundoMudouDepois(db, imp.companyId, r.plano.fichasUsadas, nomesDoDia, led.gravadoEm, 'PRODUTOS')
    if (mudou.fichas.length || mudou.nomes.length) {
      fails.push({
        invariante: 'M1',
        companyId: imp.companyId,
        nivel: 'aviso',
        detalhe: fraseDoAviso('produtos', data, mudou),
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

    const nomesDoDia = [...new Set(plano.complementos.map((x) => x.nomeSuitable))]
    const mudou = await mundoMudouDepois(db, imp.companyId, plano.fichasUsadas, nomesDoDia, led.gravadoEm, 'COMPLEMENTOS')
    if (mudou.fichas.length || mudou.nomes.length) {
      fails.push({
        invariante: 'M1',
        companyId: imp.companyId,
        nivel: 'aviso',
        detalhe: fraseDoAviso('complementos', data, mudou),
      })
    } else {
      fails.push({ invariante: 'M1', companyId: imp.companyId, detalhe: frase('complementos', data, c, nomes) })
    }
  }

  return fails
}
