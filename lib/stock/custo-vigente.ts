/**
 * ⛔⛔⛔ O CUSTO MÉDIO NÃO MORRE QUANDO O ESTOQUE ZERA (13/10/2026). **Lei do dono.**
 *
 * **Ordem, ao pé da letra:** *"ele tem q fica com preco q tava antes de zero estoque e manter
 * esse preco ate se estoque fica negativo — uma coisa nao tem nada ve com outra"*.
 *
 * **O CASO QUE A MOTIVOU, medido em 13/10:** `metade de bolinha massa de pizza` tinha custo
 * conhecido, o serviço consumiu tudo, o saldo foi a **0** — e a régua `saldo > 0 ? valor/saldo
 * : null` **APAGOU o custo**. Com ela nula, as **4 bases de pizza** (massa + queijo + caixa)
 * viraram *"a apurar"* e o montador inteiro apagou. ⚠️ E não era caso de borda: **item
 * produzido zera de noite todo dia**, então a bancada piscava "a definir" por rotina.
 *
 * ⭐ É a régua de TODO sistema sério (SAP/TOTVS/Odoo): **custo médio é MEMÓRIA do item**
 * (campo do cadastro, "moving average cost"), **não fração do momento**. Ele muda quando
 * alguém COMPRA ou PRODUZ; consumir até o fim não apaga quanto a coisa custa.
 *
 * ⚠️⚠️ **A TENSÃO COM O PRINCÍPIO DA CASA, declarada em vez de escondida:** *"SALDO NUNCA É
 * DADO PRIMÁRIO — derivado, cacheado se precisar, recomputável SEMPRE"*. A memória é
 * **persistida** (leitura O(1) — a porta é chamada em toda ficha/cardápio/margem) **E
 * recomputável**: `memoriaPelaHistoria` replaya o ledger e devolve o mesmo número, e é ela
 * que o **backfill** e o **juiz E17** usam. ⛔ A alternativa de derivar na leitura foi medida
 * e recusada: exigiria varrer os movimentos de **todo item zerado** (dezenas, e crescendo)
 * em cada carregamento de tela — é o scan que esta casa já pagou em 28/09.
 *
 * ⛔⛔ **E A MEMÓRIA SÓ APRENDE COM QUEM TEM CUSTO DEFENSÁVEL** (`TIPOS_COM_CUSTO_CONHECIDO`,
 * REGRA 4 — a MESMA lista que a valoração da contagem usa, com o motivo já escrito lá). Sem
 * essa trava o `AJUSTE_RESIDUO` **envenenaria a memória**: ele grava `0,001` de quantidade com
 * o unitário DERIVADO do total (no fermento, R$ 89.580/kg) — um número que existe pra fechar
 * dinheiro, nunca pra dizer quanto a coisa custa.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { TIPOS_COM_CUSTO_CONHECIDO } from './contagem-ancora'
import { TIPOS_FORA_DA_PRATELEIRA } from './prateleira'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

// ────────────────────────────────────────────────────────────────
// A LEI (pura)
// ────────────────────────────────────────────────────────────────

/**
 * ⭐⭐⭐ A LEI DO CUSTO MÉDIO — e ela é a ÚNICA porta: `saldo.ts` chama ESTA função.
 *
 * - `saldo > 0` → `valor ÷ saldo`, **igual a hoje, ao centavo** (zero regressão: ficha fechada
 *   com estoque em pé não muda um centavo);
 * - `saldo ≤ 0` → **o último custo médio conhecido** (a memória);
 * - **nunca teve entrada com valor** → `null` = *"a definir"*. ⛔ Número inventado NUNCA: num
 *   item sem compra nenhuma, um custo chutado entra na ficha, no cardápio e no CMV **saindo
 *   plausível** — que é o pior tipo de erro (a lição da FANTA UVA).
 *
 * ⚠️ Memória `≤ 0` é tratada como ausência: custo zero ou negativo não é "o que a coisa
 * custa", é resquício de um estado impossível — e propagá-lo seria propagar a ficção.
 */
export function custoMedioComMemoria(saldo: number, valor: number, vigente: number | null): number | null {
  if (saldo > 0) return round2(valor / saldo)
  return vigente != null && vigente > 0 ? round2(vigente) : null
}

export interface EntradaQueEnsinaCusto {
  tipo: string
  /** quantidade do movimento (positiva numa entrada) */
  quantidade: number
  /** dinheiro que a entrada traz (0 numa bonificação) */
  custoTotal: number
  /** saldo do item ANTES desta entrada */
  saldoAntes: number
  /** valor do item ANTES desta entrada */
  valorAntes: number
}

/**
 * ⭐⭐ O QUE A ENTRADA ENSINA — devolve a memória nova, ou `null` quando ela **não se mexe**.
 *
 * - **saldo antes > 0** → **média ponderada normal**, exatamente o número que a leitura
 *   derivada passa a mostrar: a memória nunca discorda da tela;
 * - **saldo antes ≤ 0** → a memória **REINICIA no custo da entrada** (padrão de mercado).
 *   ⛔ E aqui a média ponderada seria ERRADA de um jeito caro: no fermento, 10 kg a R$ 34
 *   entrando sobre `−5 kg / −R$ 31` daria `309 ÷ 5 = R$ 61,80/kg` — **o resíduo de dinheiro
 *   negativo contaminando o preço de compra**. O que a nota diz é 34, e é 34 que o item custa.
 *
 * ⚠️ Bonificação (`custoTotal` 0) **não ensina preço** — ela ensina que chegou de graça
 * naquele dia, não que a coisa vale zero.
 */
export function memoriaDaEntrada(e: EntradaQueEnsinaCusto): number | null {
  if (!TIPOS_COM_CUSTO_CONHECIDO.includes(e.tipo)) return null
  if (!(e.quantidade > 0) || !(e.custoTotal > 0)) return null
  if (e.saldoAntes > 0) {
    const saldoDepois = e.saldoAntes + e.quantidade
    if (!(saldoDepois > 0)) return null
    const c = round2((e.valorAntes + e.custoTotal) / saldoDepois)
    return c > 0 ? c : null
  }
  const c = round2(e.custoTotal / e.quantidade)
  return c > 0 ? c : null
}

export interface MovimentoDaHistoria {
  tipo: string
  quantidade: number
  custoTotal: number
}

/**
 * ⭐⭐⭐ A MEMÓRIA RECONSTRUÍDA DO LEDGER — **o replay cronológico da MESMA lei acima**.
 *
 * É o que torna o campo persistido **auditável**: o backfill preenche com isto, e o **juiz
 * E17** compara o persistido com isto. ⛔ Se eu tivesse escrito uma segunda régua aqui, o
 * juiz passaria a conferir o campo contra uma opinião diferente — e a divergência que ele
 * acusasse não diria nada sobre o dado.
 *
 * ⚠️ Recebe os movimentos **em ordem cronológica e já filtrados** pela régua de prateleira:
 * quem consulta o banco é a função abaixo; esta é pura pra poder ser travada em teste.
 */
export function memoriaPelaHistoria(movs: readonly MovimentoDaHistoria[]): number | null {
  let saldo = 0
  let valor = 0
  let ultimo: number | null = null
  for (const m of movs) {
    const saldoAntes = saldo
    const valorAntes = valor
    saldo = round2(saldo + m.quantidade)
    valor = round2(valor + m.custoTotal)
    if (saldo > 0) {
      const c = round2(valor / saldo)
      if (c > 0) ultimo = c
    } else {
      // ⭐ a entrada que chega com o saldo no chão ensina o preço dela (a mesma regra do writer)
      const mem = memoriaDaEntrada({ ...m, saldoAntes, valorAntes })
      if (mem != null) ultimo = mem
    }
  }
  return ultimo
}

// ────────────────────────────────────────────────────────────────
// O BANCO
// ────────────────────────────────────────────────────────────────

/** ⭐ a memória de TODOS os itens da empresa (1 consulta — a porta é chamada em toda tela). */
export async function custoVigentePorItem(db: Db, companyId: string): Promise<Map<string, number>> {
  const linhas = await db.stockItemCustoVigente.findMany({
    where: { companyId },
    select: { itemId: true, custoMedio: true },
  })
  return new Map(linhas.map((l) => [l.itemId, l.custoMedio]))
}

/** ⭐ a memória de UM item. */
export async function custoVigenteDoItem(db: Db, companyId: string, itemId: string): Promise<number | null> {
  const l = await db.stockItemCustoVigente.findUnique({
    where: { companyId_itemId: { companyId, itemId } },
    select: { custoMedio: true },
  })
  return l?.custoMedio ?? null
}

/**
 * ⭐ GRAVA a memória. Idempotente por `@@unique(companyId,itemId)`: aprender 2× é UPDATE,
 * nunca uma 2ª linha.
 *
 * ⚠️ `movimentoId` é RASTRO (que entrada ensinou este número) — é o que permite responder
 * *"de onde saiu esse R$ 0,54?"* três meses depois, sem reconstruir nada.
 */
export async function lembrarCustoVigente(
  db: Db,
  args: { companyId: string; itemId: string; custoMedio: number; movimentoId?: string | null },
): Promise<void> {
  if (!(args.custoMedio > 0)) return
  const custoMedio = round2(args.custoMedio)
  await db.stockItemCustoVigente.upsert({
    where: { companyId_itemId: { companyId: args.companyId, itemId: args.itemId } },
    create: { companyId: args.companyId, itemId: args.itemId, custoMedio, movimentoId: args.movimentoId ?? null },
    update: { custoMedio, movimentoId: args.movimentoId ?? null },
  })
}

/**
 * ⭐⭐ A MEMÓRIA QUE O LEDGER DIZ QUE O ITEM DEVERIA TER — consulta + `memoriaPelaHistoria`.
 *
 * Usada pelo **backfill** (preenche) e pelo **juiz E17** (confere). ⚠️ Ordena por
 * `dataMovimento` e **desempata por `id`**: dois movimentos no mesmo instante em ordem
 * arbitrária dariam memórias diferentes a cada rodada, e o juiz acusaria um drift que não
 * existe (a cicatriz do rastro de vencimento, 16/09).
 */
export async function memoriaDoLedger(db: Db, companyId: string, itemId: string): Promise<number | null> {
  const movs = await db.stockMovement.findMany({
    where: { companyId, itemId, tipo: { notIn: [...TIPOS_FORA_DA_PRATELEIRA] } },
    select: { tipo: true, quantidade: true, custoTotal: true },
    orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
  })
  return memoriaPelaHistoria(movs)
}
