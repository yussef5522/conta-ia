// ⭐ Sprint TETO APRENDE COM O ENCARGO REAL (04/11/2026) — a ÚNICA leitura do banco que
// alimenta a terceira base do teto. O motor (`tetoDoPagamento`) é PURO de propósito: ele
// recebe os fatos já lidos. Esta é a função que lê — e ela é UMA, chamada pela porta
// (`vincular-pagamento`) e pelo preview, pelos MESMOS argumentos. Duas consultas separadas
// divergiriam no primeiro `select` incompleto (a cicatriz do PIX de 7.000).

import type { PrismaClient, Prisma } from '@prisma/client'
import type { EncargoRealRecente } from './link-payment'

type Db = PrismaClient | Prisma.TransactionClient

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** ⚠️ 3, não todas — a justificativa está no doc de `FOLGA_DO_TETO` (o encargo CAI com o saldo) */
export const PAGAS_NA_JANELA = 3

/**
 * O maior encargo REAL já gravado nas últimas {@link PAGAS_NA_JANELA} parcelas **PAGAS**
 * deste contrato: `paidInterest + paidCorrection + paidPenalty`, os mesmos campos que o DRE
 * lê (identidade no `schema.prisma`: `paidTotal = amortization + paidInterest +
 * paidCorrection + paidPenalty`). Medido em prod no Banrisul `002100057538834`: `#58` →
 * 126,26 + 419,67 = **545,93** · `#59` → 119,62 + 395,55 = **515,17**.
 *
 * ⚠️ **Ordem por NÚMERO da parcela, não por `paidDate`:** há 180 parcelas `PAID` sem vínculo
 * e sem data de pagamento — ordenar por um campo nulo daria janela arbitrária. O número é a
 * ordem do cronograma e é sempre presente.
 *
 * ⭐ **Devolve `null` quando não há encargo gravado** (contrato novo, ou pagas só por
 * documento com os `paid*` em zero): aí o teto fica exatamente o de antes. *Ausência de
 * régua não se inventa.*
 */
export async function encargoRealRecente(db: Db, loanId: string): Promise<EncargoRealRecente | null> {
  const pagas = await db.loanInstallment.findMany({
    where: { loanId, status: 'PAID' },
    orderBy: { number: 'desc' },
    take: PAGAS_NA_JANELA,
    select: { number: true, paidInterest: true, paidCorrection: true, paidPenalty: true },
  })

  let melhor: EncargoRealRecente | null = null
  for (const p of pagas) {
    const valor = round2((p.paidInterest ?? 0) + (p.paidCorrection ?? 0) + (p.paidPenalty ?? 0))
    if (valor > 0 && (melhor == null || valor > melhor.valor)) melhor = { valor, parcela: p.number }
  }
  return melhor
}
