/**
 * ⭐⭐⭐ O CONFRONTO — "o que o motor diz que deveria sair" × "o que o ledger gravou"
 * (item 2a do sprint do motor, 02/10/2026).
 *
 * **A ordem do dono:** *"invariante executável — pra CADA dia de baixas, Σ(o que o motor diz)
 * == Σ(o que o ledger escreveu), por item, à grama; divergência = vermelho COM O NOME do
 * fluxo que desviou."*
 *
 * ⚠️⚠️ **ESTA COMPARAÇÃO JÁ EXISTIA — derivada, dentro do planejador dos complementos**, como
 * o `precisaReprocessar` (07/09). Escrever uma segunda aqui seria exatamente a conta paralela
 * que este sprint existe pra matar: a tela diria "precisa reprocessar" e o juiz diria "fecha"
 * (ou o contrário) no primeiro caso de borda. **Então ela saiu de lá e virou esta função**, que
 * o planejador, o preview e o juiz consomem.
 *
 * ⭐ A função é PURA de propósito: o juiz roda contra o banco inteiro e o planejador roda por
 * import — o que não pode divergir é a RÉGUA, não a consulta.
 */

/**
 * ⚠️ A TOLERÂNCIA É O RUÍDO DE ARREDONDAMENTO DA GRAVAÇÃO, não folga escolhida a dedo: o
 * ledger grava a quantidade em 6 casas e os planejadores arredondam em 2 ou 6 na borda. Um
 * milésimo é o pior caso dessa diferença; acima disso é dose a mais ou a menos de verdade.
 *
 * ⛔ Não subir isto pra "fazer o vermelho calar" — foi a diferença de 0,001 que denunciou o
 * resíduo de separação em 09/09.
 */
export const TOLERANCIA_DO_CONFRONTO = 0.001

export interface LinhaDoConfronto {
  itemId: string
  /** o que a explosão (porta única) diz que deveria ter saído */
  motor: number
  /** o que está gravado e VIVO no ledger (estorno já descontado) */
  ledger: number
  /** motor − ledger. Positivo = o ledger baixou MENOS do que devia. */
  dif: number
}

export interface Confronto {
  fecha: boolean
  /** só as que divergem acima da tolerância, maior diferença primeiro */
  divergencias: LinhaDoConfronto[]
  /** itens que o motor manda baixar e o ledger não tem NENHUM movimento */
  faltamNoLedger: string[]
  /** itens que o ledger baixou e o motor de hoje não manda — ficha/mapa mudou, ou baixa órfã */
  sobramNoLedger: string[]
}

const arred = (n: number) => Math.round((n + 1e-9) * 1e6) / 1e6

/**
 * ⭐ Compara os dois lados por ITEM. `motor` e `ledger` são quantidades POSITIVAS (o ledger
 * grava a baixa como negativa; quem chama manda o valor absoluto — é o que o `baixadoHoje`
 * do planejador já fazia).
 */
export function confrontarMotorComLedger(
  motor: Map<string, number>,
  ledger: Map<string, number>,
  tolerancia = TOLERANCIA_DO_CONFRONTO,
): Confronto {
  const itens = new Set([...motor.keys(), ...ledger.keys()])
  const divergencias: LinhaDoConfronto[] = []
  const faltamNoLedger: string[] = []
  const sobramNoLedger: string[] = []

  for (const itemId of itens) {
    const m = arred(motor.get(itemId) ?? 0)
    const l = arred(ledger.get(itemId) ?? 0)
    const dif = arred(m - l)
    if (Math.abs(dif) <= tolerancia) continue
    divergencias.push({ itemId, motor: m, ledger: l, dif })
    // ⚠️ "falta" e "sobra" são classes diferentes de "diverge em 2 gramas": ausência total de
    // movimento aponta fluxo que não passou pela porta; diferença aponta número torto.
    if (l === 0) faltamNoLedger.push(itemId)
    if (m === 0) sobramNoLedger.push(itemId)
  }

  divergencias.sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif))
  return { fecha: divergencias.length === 0, divergencias, faltamNoLedger, sobramNoLedger }
}
