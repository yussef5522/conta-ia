// ⭐⭐⭐ EM QUE UNIDADE **FÍSICA** CADA MOVIMENTO ENTROU (11/09/2026)
//
// ⛔⛔ **O ACHADO QUE PEDIU ESTE ARQUIVO:** o `reunitizar-item.ts` converte **TODOS** os
// movimentos vivos pelo mesmo fator — ele assume, desde 27/08, que o ledger inteiro está na
// unidade antiga. **No caso real do queijo isso é falso**, e o dado mostra por quê:
//
// ```
// 24/08  NF 179080 (Santo Cristo)  8 × R$ 69,90   → a nota disse UN  → 8 PEÇAS de 2 kg
// 03/09  NF 506554 (outro forn.)  19,2 × R$ 33,90 → a nota disse KG  → 19,2 KG   (já certo)
// 11/09  NF 179646 (Santo Cristo)  32 × R$ 34,45  → corrigida UN→KG  → 32 KG     (já certo)
// ```
//
// Reunitizar isso ×2 daria **118,4** — inventaria **51,2 kg de queijo que não existem**.
// ⚠️ Um item recebe de FORNECEDORES DIFERENTES, e cada um manda na unidade que quer: o
// ledger de um item pode ser **misto** e nada garante homogeneidade.
//
// ⭐ E a unidade de cada entrada é **DERIVÁVEL, não adivinhável**: a conferência guarda a
// `unidadeNota` e a correção guarda a `unidadeEntrada`. O custo unitário também denunciaria
// (69,90 é preço de peça, 33,90 é preço de quilo) — mas isso é **heurística sobre número**,
// e este módulo não decide por heurística: decide pelo que foi REGISTRADO.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export interface UnidadeDoMovimento {
  movimentoId: string
  quantidade: number
  /** a unidade em que a quantidade deste movimento está expressa */
  unidade: string
  /** de onde a resposta saiu — `PADRAO` é o fallback da régua do próprio item */
  origem: 'CORRECAO' | 'CONFERENCIA' | 'PADRAO'
}

/**
 * ⭐ A cadeia de resolução, do mais específico pro mais genérico:
 * 1. **correção de unidade** daquela conferência — o dono disse, em letras, qual era;
 * 2. **`unidadeNota`** da conferência — o que o documento declarou;
 * 3. **a unidade de controle do item** — contagem, produção e entrada manual são digitadas
 *    na régua do próprio item, então é ela que vale.
 */
export async function unidadeFisicaDosMovimentos(
  db: Db, companyId: string, itemId: string, unidadeControleAtual: string,
): Promise<Map<string, UnidadeDoMovimento>> {
  const movs = await db.stockMovement.findMany({
    where: { companyId, itemId, tipo: { not: 'ESTORNO' } },
    select: { id: true, quantidade: true, receiptId: true },
  })
  const receipts = [...new Set(movs.map((m) => m.receiptId).filter((r): r is string => !!r))]
  const [conf, corr] = await Promise.all([
    receipts.length
      ? db.stockConferenceItem.findMany({ where: { companyId, itemId, conferenceId: { in: receipts } }, select: { conferenceId: true, unidadeNota: true } })
      : Promise.resolve([]),
    receipts.length
      ? db.stockUnidadeCorrigida.findMany({ where: { companyId, itemId, conferenceId: { in: receipts } }, select: { conferenceId: true, unidadeEntrada: true } })
      : Promise.resolve([]),
  ])
  const porConf = new Map(conf.map((c) => [c.conferenceId, c.unidadeNota]))
  const porCorr = new Map(corr.map((c) => [c.conferenceId!, c.unidadeEntrada]))

  return new Map<string, UnidadeDoMovimento>(movs.map((m): [string, UnidadeDoMovimento] => {
    const corrigida = m.receiptId ? porCorr.get(m.receiptId) : undefined
    if (corrigida) return [m.id, { movimentoId: m.id, quantidade: m.quantidade, unidade: corrigida, origem: 'CORRECAO' as const }]
    const daNota = m.receiptId ? porConf.get(m.receiptId) : undefined
    if (daNota) return [m.id, { movimentoId: m.id, quantidade: m.quantidade, unidade: daNota, origem: 'CONFERENCIA' as const }]
    return [m.id, { movimentoId: m.id, quantidade: m.quantidade, unidade: unidadeControleAtual, origem: 'PADRAO' as const }]
  }))
}

export interface PlanoDeConversao {
  /** vai ser convertido ×fator (está na régua antiga) */
  converte: UnidadeDoMovimento[]
  /** já está na régua nova — fica intacto */
  jaEstaCerto: UnidadeDoMovimento[]
  /**
   * ⛔⛔ nem antiga nem nova (uma terceira unidade, ex.: CX num item que vai de UN pra KG).
   * **Não dá pra converter com o fator que está na mão** — e este módulo não chuta fator.
   */
  naoSeiConverter: UnidadeDoMovimento[]
}

/**
 * ⛔⛔ **NUNCA CONVERTE METADE E CALA** (ordem do dono, 11/09). Quando sobra linha em
 * `naoSeiConverter`, quem chama **bloqueia** e mostra quais são — converter só o que dá
 * deixaria o item com duas réguas dentro do mesmo saldo, que é o defeito que estamos
 * consertando, só que pior: agora invisível.
 */
export function planejarConversao(
  unidades: Map<string, UnidadeDoMovimento>, unidadeAtual: string, unidadeNova: string,
): PlanoDeConversao {
  const plano: PlanoDeConversao = { converte: [], jaEstaCerto: [], naoSeiConverter: [] }
  const norm = (u: string) => u.trim().toUpperCase()

  /**
   * ⚠️⚠️ SEM TROCA DE UNIDADE, TUDO CONVERTE — e os testes do PÃO pegaram isto na hora.
   *
   * O caso original do `reunitizar` (27/08) é *"PACOTE de 12 pães → PÃO"*: o nome da unidade
   * continua **UN** dos dois lados, e o que muda é a RÉGUA. Ali não existe "já está certo"
   * pra distinguir — a unidade não carrega a informação —, então o ledger inteiro entra.
   *
   * ⭐ A discriminação por unidade física só faz sentido quando a unidade **muda de nome**
   * (UN → KG), que é exatamente o caso do queijo, onde o ledger é misto.
   */
  if (norm(unidadeAtual) === norm(unidadeNova)) {
    plano.converte.push(...unidades.values())
    return plano
  }

  for (const u of unidades.values()) {
    const un = norm(u.unidade)
    if (un === norm(unidadeNova)) plano.jaEstaCerto.push(u)
    else if (un === norm(unidadeAtual)) plano.converte.push(u)
    else plano.naoSeiConverter.push(u)
  }
  return plano
}
