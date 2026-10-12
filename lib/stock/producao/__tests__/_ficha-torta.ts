/**
 * ⛔⛔ O HELPER QUE CRIA A FICHA COM O RÓTULO TORTO — **de propósito, POR FORA DA PORTA**.
 *
 * Desde 11/10/2026 `criarFicha` RECUSA nascer incoerente (*"produto contado em UN ⇒ «A receita
 * rende» em UN"*, REGRA 5) — e isso é o certo: era o editor abrindo com `rende KG` num produto
 * em `UN` que fabricou os 37 achados do M5.
 *
 * ⚠️ **Mas o estado torto EXISTE em prod** (`MAIONESE`, o sabor `CALABRESA`, as 37 fichas de
 * produção), porque nasceu ANTES da porta. O M5, a fila de conversão, a auto-conversão e a
 * catraca **só se provam contra ele** — sem este helper, o guard testaria só o mundo bom, que é
 * exatamente o que a REGRA 11 proíbe.
 *
 * ⭐ Ele cria pela porta COERENTE e depois carimba a unidade do rótulo direto na versão, que é
 * **a mesma forma do legado**: a versão já existia quando a régua nasceu.
 */
import type { Prisma, PrismaClient } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export async function tornarRotuloTorto(
  companyId: string,
  fichaId: string,
  unidadeLoteBase: string,
  db: Db,
): Promise<void> {
  const f = await db.stockFicha.findUniqueOrThrow({ where: { id: fichaId }, select: { versaoAtual: true } })
  const n = await db.stockFichaVersao.updateMany({
    where: { companyId, fichaId, versao: f.versaoAtual },
    data: { unidadeLoteBase },
  })
  // ⛔ zero linha é teste que passaria achando que montou a cena — e a cena não existiria.
  if (n.count !== 1) throw new Error(`tornarRotuloTorto: esperava 1 versão, mexeu em ${n.count}`)
}
