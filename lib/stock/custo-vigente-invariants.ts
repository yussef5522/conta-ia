/**
 * ⭐⭐⭐ E17 — A MEMÓRIA DO CUSTO BATE COM O LEDGER (13/10/2026).
 *
 * A lei de 13/10 (*"o custo médio não morre quando o estoque zera"*) faz o campo persistido
 * `stock_item_custo_vigente` ser **lido como FONTE** quando o saldo é ≤ 0. ⛔ E campo lido
 * como fonte sem auditoria é exatamente o que fez a `CreditCardInvoice.status` ficar
 * eternamente OPEN e o `balance` driftar R$ 2.112,00 (30/09): **gravado envelhece.**
 *
 * ⭐ Por isso ele é RECOMPUTÁVEL: `memoriaDoLedger` replaya a MESMA lei sobre os movimentos e
 * tem que dar o mesmo número. Divergência = algum caminho criou entrada sem passar pelo
 * choke-point do ledger.
 *
 * ⚠️ Confere **só os itens onde a memória é CONSULTADA** (saldo ≤ 0) — é lá que ela decide
 * dinheiro, e varrer os 191 itens custaria uma consulta por item toda noite. Memória stale de
 * item com saldo em pé é invisível hoje e **passa a ser conferida na noite seguinte à que ele
 * zerar**, que é o contrato do juiz: 3ª camada, post-factum.
 *
 * ⚠️⚠️ **E ELE MORA NUM ARQUIVO PRÓPRIO porque a REGRA 11 o pegou VERDE** (13/10): inline no
 * `stock-invariants.ts`, o único jeito de travá-lo era grep de símbolo — e `void
 * memoriaDoLedger` passa por "uso". *"Menção, não uso"* pela 15ª vez nesta casa, dentro do
 * guard do meu próprio sprint. Extraído, o teste **EXECUTA o juiz** contra um drift de
 * verdade (REGRA 3).
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { memoriaDoLedger } from './custo-vigente'
import { saldosDaEmpresa } from './saldo'
import type { StockInvariantFail } from './stock-invariants'

type Db = PrismaClient | Prisma.TransactionClient

/** tolerância do centavo — a mesma do CHECK do ledger */
const TOL = 0.01

export async function checkCustoVigenteInvariants(db: Db, companyIds: string[]): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []
  for (const companyId of companyIds) {
    const derivados = await saldosDaEmpresa(db, companyId)
    for (const d of derivados) {
      // ⭐ só onde a memória DECIDE: com saldo em pé o custo é o derivado e a memória não é lida
      if (d.saldo > 0) continue
      const doLedger = await memoriaDoLedger(db, companyId, d.itemId)
      const persistido = d.custoMedio // com saldo ≤ 0 a porta devolve a memória
      if (persistido == null && doLedger != null) {
        fails.push({
          invariante: 'E17',
          companyId,
          nivel: 'aviso',
          detalhe:
            `item ${d.itemId}: saldo ${d.saldo} e SEM memória de custo, mas o ledger diz `
            + `R$ ${doLedger.toFixed(2)} — a ficha/cardápio mostram "a definir" por falta do backfill, `
            + `não por falta de compra.`,
        })
      } else if (persistido != null && doLedger != null && Math.abs(persistido - doLedger) > TOL) {
        fails.push({
          invariante: 'E17',
          companyId,
          detalhe:
            `item ${d.itemId}: memória de custo R$ ${persistido.toFixed(2)} ≠ o que o ledger diz `
            + `(R$ ${doLedger.toFixed(2)}) — algum caminho criou entrada SEM passar pelo choke-point do ledger.`,
        })
      }
    }
  }
  return fails
}
