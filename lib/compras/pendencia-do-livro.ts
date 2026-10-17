/**
 * ⭐⭐⭐ DE ONDE SAI "A APURAR" — a pendência MEDIDA, nunca suposta.
 *
 * ⚠️⚠️ **O BRIEF DIZIA OUTRA COISA E A MEDIÇÃO O REFUTOU — e isto fica escrito.** A ordem do dono
 * (17/10) nomeia a fonte da pendência como *"separação/conclusão parada na fila de conferência"*.
 * Medido no código, **nenhuma das três coisas muda o consumo de um dia PASSADO**:
 *
 * | gesto | data do movimento | muda dia passado? |
 * |---|---|---|
 * | `confirmarSeparacao` (`SEPARACAO_SAIDA`) | **sem `dataMovimento` → `now()`** | ⛔ não |
 * | `devolverInsumo` (`DEVOLUCAO_PRODUCAO`) | idem | ⛔ não |
 * | a correção do gerente (estorna-e-relança) | idem, e toca **só `PRODUCAO_GERACAO`** | ⛔ não |
 * | **`BAIXA_VENDA`** (`baixa-venda.ts:300`) | **`dataMovimento: dataDate`** — o dia do relatório | ⭐ **SIM** |
 *
 * Ou seja: ***a ÚNICA coisa que ainda vai escrever consumo com data de um dia que já passou é a
 * BAIXA DA VENDA daquele dia.*** Separação e conclusão são datadas HOJE — elas mexem no dia de
 * hoje, que já é aberto por lei. Marcar "a apurar" por causa delas apontaria o dedo pra o dia
 * errado, que é a família do *"mensagem que acusa o campo errado faz o dono caçar um erro que não
 * existe"* (16/09).
 *
 * ═══ A RÉGUA, com as três condições e o porquê de cada uma ═══
 *
 * O dia D é **PENDENTE** pro item X quando:
 *   **(a)** D é dia PASSADO (hoje é aberto por lei — `dia-do-consumo.ts`);
 *   **(b)** existe um IMPORT de venda de D **e nenhuma `BAIXA_VENDA` datada em D** — ou seja, o
 *       relatório daquele dia chegou e a baixa **não rodou**. ⭐ É a pendência por **EVIDÊNCIA**,
 *       nunca por ausência de evidência: dia em que a loja não abriu também não tem baixa, e
 *       chamá-lo de "a apurar" inventaria uma dúvida onde o fato é zero;
 *   **(c)** o item X é **alcançado pela baixa de venda** (tem `BAIXA_VENDA` no histórico lido).
 *       ⛔⛔ **Sem (c) o coxão seria marcado "a apurar"** — ele é insumo consumido por SEPARAÇÃO,
 *       nunca por venda (medido: 100% do consumo dele é separação) —, e seria alarme falso
 *       exatamente no item que motivou o sprint.
 *
 * ⚠️ **LIMITE DECLARADO, não disfarçado:** baixa que rodou **PARCIAL** (o nome do PDV não está
 * mapeado, então o consumo daquele item nunca vem) **não** entra aqui — ali há baixas no dia e a
 * régua (b) não morde. Esse caso tem tela própria (a revisão do import, com o contador de "sem
 * destino") e virar "—" para sempre seria pior que o zero: ninguém mapeia o que a tela esconde.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

/** vazio reusável — item não alcançado pela venda nunca tem dia pendente */
export const SEM_PENDENCIA: ReadonlySet<string> = new Set<string>()

export interface PendenciaDoLivro {
  /** os dias PASSADOS cujo relatório de venda entrou e a baixa não rodou */
  diasSemBaixa: ReadonlySet<string>
  /** os itens que a baixa de venda alcança (têm `BAIXA_VENDA` no histórico lido) */
  itensAlcancadosPorVenda: ReadonlySet<string>
  /**
   * ⭐ itemId → o dia do **PRIMEIRO movimento do item no ledger** (sem recorte de janela).
   *
   * ⚠️ É o que impede a baseline de inventar zeros antes de o item existir. **Sem a consulta
   * SEM filtro de data não dá pra saber** se o 1º movimento dentro da janela é o 1º da vida ou
   * só o 1º que a janela alcança — e aí o item antigo seria tratado como recém-nascido.
   */
  cobertoDesdePorItem: ReadonlyMap<string, string>
}

/**
 * ⭐ DUAS consultas pra N itens e N dias — nunca uma por dia nem uma por item (a lição dos
 * 4.909 ms da lista de fichas, 28/09). A 3ª pergunta (quais itens a venda alcança) sai do
 * `movs` que o leitor **já tem na mão**, por isso entra por parâmetro.
 */
export async function medirPendenciaDoLivro(
  input: {
    companyId: string
    /** início da janela de leitura (ISO) */
    desde: string
    /** hoje no fuso do Brasil (ISO) — quem decide é o chamador, nunca o relógio daqui */
    hoje: string
    /** os movimentos já lidos: `{ itemId, tipo }` basta */
    movimentos: readonly { itemId: string; tipo: string; estornoDeId?: string | null }[]
    /** os itens das listas — pra medir o 1º movimento de cada um */
    itemIds: readonly string[]
  },
  db: PrismaClient = defaultPrisma,
): Promise<PendenciaDoLivro> {
  const de = new Date(`${input.desde}T00:00:00Z`)
  const ate = new Date(`${input.hoje}T00:00:00Z`) // exclusivo: hoje não é dia fechado

  const [imports, baixas, primeiros] = await Promise.all([
    db.stockVendaImport.findMany({
      where: { companyId: input.companyId, data: { gte: de, lt: ate } },
      select: { data: true },
    }),
    db.stockMovement.findMany({
      where: {
        companyId: input.companyId,
        tipo: 'BAIXA_VENDA',
        dataMovimento: { gte: de, lt: ate },
      },
      select: { dataMovimento: true },
    }),
    // ⭐ UMA agregação pros N itens, SEM recorte de data (é justamente o passado que importa)
    input.itemIds.length
      ? db.stockMovement.groupBy({
          by: ['itemId'],
          where: { companyId: input.companyId, itemId: { in: [...input.itemIds] } },
          _min: { dataMovimento: true },
        })
      : Promise.resolve([] as { itemId: string; _min: { dataMovimento: Date | null } }[]),
  ])

  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const comBaixa = new Set(baixas.map((b) => iso(b.dataMovimento)))
  const diasSemBaixa = new Set<string>()
  for (const i of imports) {
    const dia = iso(i.data)
    if (!comBaixa.has(dia)) diasSemBaixa.add(dia)
  }

  // ⚠️ o ESTORNO de uma baixa também prova que a venda alcança o item (ele desfez uma), então
  //    conta igual — o que importa aqui é "este item já saiu por venda alguma vez", não o saldo.
  const alcancados = new Set<string>()
  for (const m of input.movimentos) {
    if (m.tipo === 'BAIXA_VENDA') alcancados.add(m.itemId)
  }

  const cobertoDesdePorItem = new Map<string, string>()
  for (const g of primeiros) {
    const d = g._min.dataMovimento
    if (d) cobertoDesdePorItem.set(g.itemId, iso(d))
  }

  return { diasSemBaixa, itensAlcancadosPorVenda: alcancados, cobertoDesdePorItem }
}

/** ⭐ A régua (c) num lugar só: item que a venda não alcança **não tem** dia pendente. */
export function pendentesDoItem(itemId: string, p: PendenciaDoLivro): ReadonlySet<string> {
  return p.itensAlcancadosPorVenda.has(itemId) ? p.diasSemBaixa : SEM_PENDENCIA
}

/** ⭐ O 1º dia que o livro cobre pra este item; `null` = item sem movimento nenhum. */
export function cobertoDesdeDoItem(itemId: string, p: PendenciaDoLivro): string | null {
  return p.cobertoDesdePorItem.get(itemId) ?? null
}
