// ⭐⭐⭐ O FECHAMENTO DE UM IMPORT MISTO (17/09/2026).
//
// **O dono:** *"40 linhas, 8 já no sistema (R$ 828,50, em leitura sem checkbox — como a tela
// de ontem manda), 32 novas marcadas (R$ 2.365,85). Clico confirmar → 'a soma das linhas
// 2.365,85 não fecha com o total 3.194,35, diferença 828,50' — a diferença é EXATAMENTE as 8
// que a própria tela impediu de marcar."*
//
// ⛔⛔ **A TELA APRENDEU A PARTIÇÃO E O VALIDADOR FICOU NA ÉPOCA DO TUDO-OU-NADA.** O preview
// já dizia a frase certa (*"você marcou 32 de 40, por isso o total é outro"*); o `confirm`
// continuava exigindo que as linhas ENVIADAS fechassem sozinhas com o total da fatura. É a
// segunda régua de novo — agora entre preview e confirm, a dupla que este projeto já pagou
// caro no import de OFX.
//
// ⭐ **A CONTA CERTA:** `Σ(novas) + Σ(já no sistema) == total da fatura`. A já-gravada **conta
// pra fechar e não regrava** — o dedup de sempre cuida disso.
//
// ⛔ E A DEFESA NÃO AFROUXA: numa fatura 100% nova não há nada gravado, `jaNoSistema` é 0, e
// o fechamento continua exigindo a soma cheia. *Ela não ficou mais permissiva — ela aprendeu
// que a fatura pode chegar em duas partes.*

import { faturaNetTotal } from './fatura-net-total'
import { tipoDaLinha } from './identidade-da-linha'
import type { InvoiceLineKind } from './types'

export interface LinhaEnviada {
  kind: InvoiceLineKind
  amount: number
  contentHash: string
}

/** o que já está gravado NESTA fatura (mesmo cartão, mesma competência) */
export interface LinhaGravada {
  type: string
  amount: number
  contentHash: string | null
  isCardPayment: boolean
}

export interface FechamentoDoImport {
  /** Σ das linhas que vão entrar agora */
  novas: number
  /** Σ das que já estavam gravadas e NÃO vieram no envio */
  jaNoSistema: number
  /** o que a fatura soma no total — é isto que fecha com o declarado */
  net: number
  /** quantas das enviadas já existem (vão ser puladas pelo dedup) */
  enviadasDuplicadas: number
}

/**
 * ⭐⭐ A PARTIÇÃO — **a mesma que a tela mostra**, porque as duas nascem do mesmo
 * `contentHash` (`identidadeDaLinha`). O validador não recalcula "o que é novo" por conta
 * própria: ele pergunta pela mesma chave.
 *
 * ⚠️ Uma linha enviada que JÁ está gravada conta **uma vez só** — senão o fechamento
 * dobraria justo no caso em que o dono reenvia a fatura inteira.
 *
 * ⚠️ E pagamento de fatura fica fora: ele não é lançamento da fatura, é a quitação dela.
 */
export function fecharImport(
  enviadas: LinhaEnviada[],
  gravadas: LinhaGravada[],
): FechamentoDoImport {
  const hashesEnviados = new Set(enviadas.map((l) => l.contentHash))

  const netNovas = faturaNetTotal(
    enviadas.map((l) => ({ type: tipoDaLinha(l.kind), amount: l.amount, isCardPayment: false })),
  ).net

  const soDoBanco = gravadas.filter(
    (t) => !t.isCardPayment && (!t.contentHash || !hashesEnviados.has(t.contentHash)),
  )
  const netGravadas = faturaNetTotal(
    soDoBanco.map((t) => ({ type: t.type, amount: t.amount, isCardPayment: false })),
  ).net

  const round2 = (n: number) => Math.round(n * 100) / 100
  return {
    novas: round2(netNovas),
    jaNoSistema: round2(netGravadas),
    net: round2(netNovas + netGravadas),
    enviadasDuplicadas: gravadas.filter((t) => t.contentHash && hashesEnviados.has(t.contentHash)).length,
  }
}
