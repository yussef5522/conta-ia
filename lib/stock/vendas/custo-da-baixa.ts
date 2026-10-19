// ⭐⭐⭐ O CUSTO DE UMA BAIXA DE VENDA — UM DONO, OS DOIS RELATÓRIOS (19/10/2026).
//
// **O caso que pariu este arquivo:** a baixa dos complementos de 17/10 foi **barrada pelo
// guarda do estado impossível** na `porçao calabresa ralada 50 grama` — 49 UN, valor
// R$ 39,57, e a baixa calculada em **R$ 39,69** → final **0 UN / −R$ 0,12**.
//
// ⛔⛔ **A CAUSA: a baixa de COMPLEMENTOS era um TERCEIRO CAMINHO.** Ela usava
// `custoMedioPorItem` — o custo **ARREDONDADO em 2 casas**, que é número de TELA — e
// multiplicava pela quantidade, sem nenhuma das duas curas que a baixa de PRODUTOS já tinha:
//
// ```
// HOJE (complementos): custo 0,81          × 49 = R$ 39,69  →  final 0 / R$ −0,12  ⛔
// A LEI  (produtos):   custo 0,8075510204… × 49 = R$ 39,57  →  final 0 / R$   0,00  ⭐
// ```
//
// ⭐ **Repare que com precisão cheia o resíduo NÃO NASCE** — ele não é "absorvido", ele deixa
// de existir: zerar a quantidade (`qtd == saldo`) dá `saldo × (valor/saldo) = valor` **exato**.
// É a lição que esta casa já aprendeu três vezes (a reunitização do pão em 2,3125 · o custo
// por unidade da conclusão de produção · o ovo de 19/09): ***o ledger guarda precisão cheia;
// quem arredonda é a LEITURA***.
//
// ⚠️⚠️ **E ISSO ERA A REGRA 4 COBRANDO:** as duas curas (precisão cheia + resíduo em 19/09;
// custo vigente no saldo ≤ 0 em 15/10) foram escritas **só no `baixa-venda.ts`**, e o
// `baixa-complemento.ts` — que compartilha o MOTOR de explosão com ele desde 03/09 — ficou
// com a aritmética antiga. *Duas réguas pra "quanto vale esta baixa"; uma corrigida, a outra
// não* — a doença que custou 7 detectores de par a este projeto. Daqui pra frente os dois
// chamam ESTA função, e o terceiro relatório que nascer herda de graça.
//
// ⛔⛔ **O GUARDA NÃO FOI AFROUXADO, e isso é o ponto.** `assertSaldoNaoFicaImpossivel`
// (11/09) pegou exatamente o estado que não existe — saldo zero com dinheiro negativo — e
// está CERTO. A cura é no CUSTO da baixa; mexer no guarda trocaria um alarme verdadeiro por
// um estoque bonito e falso.

import type { PrismaClient, Prisma } from '@prisma/client'
import { saldosDaEmpresa } from '../saldo'
import { custoVigentePorItem } from '../custo-vigente'
import { custoParaBaixar } from '../residuo-de-centavos'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface EstadoDaBaixa {
  /**
   * saldo, valor e o custo médio **de LEITURA** de cada item, no instante da baixa.
   *
   * ⭐ O `custoMedio` vem junto de propósito: é o número que a TELA mostra (arredondado em 2
   * casas, como a Posição), e sai da MESMA consulta que o custo da gravação. Ter os dois aqui
   * é o que impede o preview de buscar o custo por outro caminho e divergir do ledger.
   */
  porItem: Map<string, { saldo: number; valor: number; custoMedio: number | null }>
  /** a MEMÓRIA do custo (lei de 13/10) — o que faz item negativado não sair a R$ 0,00 */
  vigentes: Map<string, number>
}

/**
 * ⭐ Lê o estado do lote INTEIRO em **2 consultas**.
 *
 * ⚠️ **Dentro da transação e DEPOIS dos estornos**, sempre: num reprocesso, o estado que
 * importa é o de depois de desfazer as baixas antigas — ler antes daria o custo de um saldo
 * que não existe mais.
 *
 * ⚠️ E **fora do laço**, de propósito: uma consulta por item num plano de 30 itens é a
 * doença dos 4.909 ms / 1.786 consultas de 28/09.
 */
export async function estadoParaBaixa(db: Db, companyId: string): Promise<EstadoDaBaixa> {
  const [saldos, vigentes] = await Promise.all([
    saldosDaEmpresa(db, companyId),
    custoVigentePorItem(db, companyId),
  ])
  return {
    porItem: new Map(saldos.map((s) => [s.itemId, { saldo: s.saldo, valor: s.valor, custoMedio: s.custoMedio }])),
    vigentes,
  }
}

export interface CustoDaBaixa {
  /** custo unitário a gravar — **precisão cheia** com saldo em pé */
  custoUnitario: number
  /** o valor do movimento, **já com sinal** (negativo: é saída) */
  custoTotal: number
}

/**
 * ⭐⭐ O custo de UMA linha da baixa. Puro — o estado vem de fora.
 *
 * ⛔ **Quem decide o custo é `custoParaBaixar`**, a porta única de 15/10: saldo em pé →
 * `valor / saldo` em precisão cheia; saldo ≤ 0 → a **memória** do item (e `0` só quando ele
 * nunca teve entrada com valor, que é a resposta honesta — número inventado NUNCA).
 *
 * ═══ ⚠️⚠️ POR QUE AQUI NÃO HÁ AJUSTE DE RESÍDUO — MEDIDO, NÃO SUPOSTO (19/10/2026) ═══
 *
 * A 1ª versão desta função chamava `avaliarResiduo` e, no ramo `AJUSTA_RESIDUO`, **derivava o
 * unitário do total** pra o CHECK do ledger fechar. **A REGRA 11 provou que aquele ramo era
 * INALCANÇÁVEL**: repondo o defeito (unitário NÃO derivado do total) os testes ficaram
 * **VERDES**, e a varredura numérica explica por quê —
 *
 * ```
 * AJUSTA_RESIDUO exige  valorDepois < −0,01
 * com precisão cheia    valorDepois = round2(valor − round2(saldo × valor/saldo)) ≥ −0,005
 * ```
 *
 * ⭐ ***É o próprio ponto deste arquivo se provando: com precisão cheia o resíduo não é
 * "absorvido" — ele NÃO NASCE.*** `saldo × (valor/saldo) = valor` exato, e o único erro
 * possível é o meio-centavo do arredondamento final, que fica **dentro** da folga do guarda.
 *
 * ⛔ **Linha que não pode falhar é linha que finge ser trava** (a lição do `ehVizinho`,
 * 17/10): o ramo saiu. Quem guarda a classe agora é o teste de VARREDURA em
 * `__tests__/custo-da-baixa.test.ts` — se alguém voltar a arredondar o custo unitário, o
 * resíduo volta a nascer e **ele fica vermelho apontando a causa**, em vez de um paliativo
 * silencioso absorver o estrago.
 *
 * ⚠️ E o ramo segue vivo onde ele é alcançável de verdade: `encerrar-item` (19/09) absorve o
 * resíduo de um item que **já está zerado**, estado que nenhuma baixa produz.
 */
export function custoDaBaixa(
  itemId: string, qtd: number, e: EstadoDaBaixa,
): CustoDaBaixa {
  const at = e.porItem.get(itemId)
  // ⚠️ a assinatura é (VALOR, SALDO, vigente) — inverter dá custo plausível e errado
  const custoUnitario = custoParaBaixar(at?.valor ?? 0, at?.saldo ?? 0, e.vigentes.get(itemId) ?? null)
  return { custoUnitario, custoTotal: round2(-qtd * custoUnitario) }
}

/**
 * ⭐⭐ O VALOR QUE O PREVIEW MOSTRA — **o MESMO que o ledger vai gravar** (19/10/2026).
 *
 * ⛔⛔ Sem isto a cura acima criaria a doença que esta casa mais paga: a gravação passaria a
 * usar precisão cheia e **a tela continuaria somando o custo arredondado** — na calabresa, o
 * modal prometeria `R$ 39,69` e o ledger escreveria `R$ 39,57`, com o recibo do dia mentindo
 * 12 centavos. *Preview e confirm discordando* é exatamente o que custou o import de OFX
 * inteiro (17/08), e a cura de lá é a mesma daqui: **uma função, as duas pontas**.
 *
 * ⚠️ E repare na divisão de trabalho: o **total** vem da precisão cheia (é dinheiro que se
 * move), o **custo unitário exibido** continua arredondado em 2 casas (é leitura, e é o
 * número que a Posição mostra). *O ledger guarda precisão cheia; quem arredonda é a leitura.*
 */
export function valorPrevistoDaBaixa(itemId: string, qtd: number, e: EstadoDaBaixa): number | null {
  const at = e.porItem.get(itemId)
  // ⛔ item sem custo conhecido é **"a definir"**, nunca R$ 0,00 — a lição da FANTA UVA
  if (!at || at.custoMedio == null) return null
  return round2(Math.abs(custoDaBaixa(itemId, qtd, e).custoTotal))
}
