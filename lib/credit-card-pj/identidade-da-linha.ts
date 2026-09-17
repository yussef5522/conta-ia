// ⭐⭐⭐ A IDENTIDADE DE UMA LINHA DE FATURA — UMA DECISÃO, UM LUGAR (17/09/2026).
//
// ⛔⛔ **O DEFEITO QUE ISTO MATA: o PREVIEW e o CONFIRM calculavam o hash com `type`
// DIFERENTE.** O preview cravava `type: 'DEBIT'` pra toda linha; o confirm usava o tipo de
// verdade (`ESTORNO → CREDIT`). Resultado: **a identidade de um estorno nunca casa entre as
// duas telas** — o preview jura que ele é novo, o confirm sabe que já está lá.
//
// ⚠️ O dono viu isso como *"a IA classificou tipo errado em massa"*: reimportando a fatura,
// as 19 compras vinham marcadas como já-existentes e **só os 14 estornos ficavam marcados**,
// então o rodapé somava −2.749,91 e dizia *"Compras R$ 0,00"*. **A classificação estava
// certa; a identidade é que divergia.**
//
// ⭐ É a família mais cara deste projeto — *"preview e confirm discordando"* —, a mesma que
// custou o import de OFX (a tela dizia "N novas" e a gravação fazia outra coisa) e que o
// `resolveImportStatuses` resolveu lá com exatamente este desenho: **uma função que as duas
// pontas chamam**. Enquanto a regra viver copiada nos dois arquivos, ela volta a divergir na
// primeira mudança — foi assim que ela nasceu.

import { computeIdentity } from '@/lib/import-identity/compute-identity'
import type { InvoiceLineKind } from '@/lib/credit-card-pj/types'

/** o mínimo que define uma linha de fatura, no formato que as duas pontas têm à mão */
export interface LinhaIdentificavel {
  date: string
  description: string
  amount: number
  /** ⚠️ ESTORNO é CRÉDITO — é justamente o campo que as duas pontas liam diferente */
  kind: InvoiceLineKind
}

/**
 * ⭐ O TIPO CONTÁBIL DA LINHA. Só o estorno é crédito; encargo e compra são débito.
 * ⛔ Não existe segunda régua disto — quem precisar do tipo, chama aqui.
 */
export function tipoDaLinha(kind: InvoiceLineKind): 'DEBIT' | 'CREDIT' {
  // ⚠️ `IGNORAR` nunca é gravada; cai em DEBIT só pra a identidade ser total (sem `null`).
  return kind === 'ESTORNO' ? 'CREDIT' : 'DEBIT'
}

/**
 * ⭐⭐ O `contentHash` da linha — **a mesma conta no preview e no confirm**.
 *
 * ⚠️ Cartão não tem FITID, então a identidade é o conteúdo: conta + data + valor + tipo +
 * memo. O `accountId` usa o prefixo `card:` porque o escopo é o CARTÃO, não uma conta
 * bancária (fatura não tem `bankAccountId`).
 */
export function identidadeDaLinha(cardId: string, linha: LinhaIdentificavel): string {
  return computeIdentity({
    accountId: `card:${cardId}`,
    fitid: null,
    date: linha.date,
    amount: linha.amount,
    type: tipoDaLinha(linha.kind),
    memo: linha.description,
  }).contentHash
}
