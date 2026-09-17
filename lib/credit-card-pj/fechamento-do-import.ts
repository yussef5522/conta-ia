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

export interface FechamentoDoImport {
  /** Σ das linhas que vão entrar agora */
  novas: number
  /** Σ das que a dedup apontou como já gravadas — **onde quer que elas morem** */
  jaNoSistema: number
  /** o que a fatura soma no total — é isto que fecha com o declarado */
  net: number
  /** quantas das enviadas já existem (o dedup vai pular) */
  enviadasDuplicadas: number
}

/**
 * ⭐⭐ A PARTIÇÃO — **uma chave só: o `contentHash`**, a mesma da tela.
 *
 * ⚠️⚠️ **A 1ª VERSÃO DESTE CONSERTO TINHA A SEGUNDA RÉGUA DENTRO DELE** (17/09): a tela
 * particiona por hash — a linha é "já no sistema" **onde quer que ela more** —, e eu fui
 * buscar as gravadas **pela competência da fatura**. As 8 do caso real são parcelas que
 * entraram em faturas de jun/jul/ago; em `2026-09` o validador achou **zero** e voltou a
 * exigir o fechamento cheio das novas, com a mesma diferença de 828,50.
 *
 * ⭐ *Duas chaves de partição são duas réguas.* Aqui a pergunta *"esta linha já está no
 * sistema?"* tem UMA resposta: o hash existe no banco, ponto — sem competência, sem data,
 * sem cartão de qual mês.
 *
 * ⛔ E a defesa não afrouxa: a soma é a das linhas da FATURA (todas), e ela tem que bater com
 * o total declarado. Fatura 100% nova → `jaNoSistema` 0 e fechamento cheio. Reenvio integral
 * → tudo em `jaNoSistema`, fecha igual, e **nada regrava**.
 */
export function fecharImport(
  enviadas: LinhaEnviada[],
  hashesJaGravados: ReadonlySet<string>,
): FechamentoDoImport {
  const soma = (ls: LinhaEnviada[]) =>
    faturaNetTotal(ls.map((l) => ({ type: tipoDaLinha(l.kind), amount: l.amount, isCardPayment: false }))).net

  const jaTem = enviadas.filter((l) => hashesJaGravados.has(l.contentHash))
  const novas = enviadas.filter((l) => !hashesJaGravados.has(l.contentHash))
  const round2 = (n: number) => Math.round(n * 100) / 100
  return {
    novas: round2(soma(novas)),
    jaNoSistema: round2(soma(jaTem)),
    net: round2(soma(enviadas)),
    enviadasDuplicadas: jaTem.length,
  }
}
