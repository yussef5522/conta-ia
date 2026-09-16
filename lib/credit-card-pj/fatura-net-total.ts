// Sprint Fatura-Net-Unico (14/08/2026) — A ÚNICA função de total de fatura.
//
// O bug se repetiu 3× hoje (import, display, categoria) sempre pelo mesmo motivo: o
// caminho feliz (compra DEBIT) num lugar e a exceção (estorno CREDIT) noutro. Agora
// TODO cálculo de "quanto vale esta fatura" passa por AQUI: compras + encargos
// (DEBIT) − estornos (CREDIT), sem o pagamento. Um número, uma fonte. Se alguém
// somar DEBIT sem CREDIT de novo, diverge — por isso é função única e testada.

const round2 = (n: number) => Math.round(n * 100) / 100

export interface FaturaItem {
  type: 'DEBIT' | 'CREDIT' | string
  amount: number // sempre positivo (o sinal vem do type)
  isCardPayment?: boolean
}

export interface FaturaNet {
  compras: number // DEBIT (compras + encargos)
  estornos: number // CREDIT não-pagamento
  net: number // compras − estornos = "Total desta Fatura" (o que sai do banco)
}

/** O total LÍQUIDO da fatura (= o que o pagamento casa). Pagamento não conta. */
export function faturaNetTotal(items: FaturaItem[]): FaturaNet {
  let compras = 0
  let estornos = 0
  for (const it of items) {
    if (it.isCardPayment) continue
    if (it.type === 'CREDIT') estornos += it.amount
    else compras += it.amount
  }
  return { compras: round2(compras), estornos: round2(estornos), net: round2(compras - estornos) }
}

/** Amount COM SINAL pra somar por categoria (estorno reduz). */
export function signedFaturaAmount(item: FaturaItem): number {
  if (item.isCardPayment) return 0
  return item.type === 'CREDIT' ? -item.amount : item.amount
}

/**
 * Qual competência um pagamento quita: a fatura cujo TOTAL LÍQUIDO bate o valor pago
 * (±2%). É o fix do bug sistêmico do casar (que usava "a mais recente" e mandava o
 * pagamento pro mês errado). Sem match por valor → cai na mais recente (fallback).
 */
export function pickInvoiceMonthByValue(netByMonth: Map<string, number>, amount: number): string | null {
  let best: string | null = null
  let bestDiff = Infinity
  for (const [m, net] of netByMonth) {
    const d = Math.abs(round2(net) - amount)
    if (d < bestDiff) { bestDiff = d; best = m }
  }
  // ⭐ a MESMA tolerância que o `mesQueBateOValor` usa — uma régua, dois leitores
  if (best && bestDiff <= tolerânciaDaFatura(amount)) return best
  return [...netByMonth.keys()].sort().pop() ?? null
}

/**
 * ⭐⭐ A TOLERÂNCIA DO "BATE" — num lugar só, porque agora ela tem DOIS leitores.
 *
 * ⚠️ Ela nasceu embutida no `pickInvoiceMonthByValue` e foi extraída em 16/09, quando o
 * palpite do cartão ≍ precisou fazer a **outra** pergunta (ver abaixo). Duas cópias de
 * "quanto é perto o bastante" divergiriam no primeiro ajuste.
 */
export function tolerânciaDaFatura(amount: number): number {
  return Math.max(0.02, amount * 0.02)
}

/**
 * ⭐⭐⭐ EXISTE FATURA QUE **BATE** O VALOR? — `null` quando não existe, SEM FALLBACK.
 *
 * ⛔⛔ **POR QUE ISTO NÃO É O `pickInvoiceMonthByValue`, e a diferença é de CONTRATO:**
 * aquele responde *"o dono JÁ disse que este pagamento é deste cartão — qual competência
 * ele quita?"*, e por isso ele **cai na mais recente** quando nada bate: é o melhor chute
 * pra uma pergunta cuja premissa o dono já confirmou.
 *
 * Esta responde *"este pagamento é de ALGUM cartão?"* — e aí o fallback é **veneno**.
 *
 * ⚠️ **MEDIDO EM PROD NO 1º USO (16/09):** a linha `DEB.CTA.FATURA` de R$ 3.194,35 fez o
 * `resolvePaidInvoiceMonth` devolver `2026-08` pros **QUATRO** cartões da Caçula — e
 * nenhum deles tem fatura desse valor (os nets são 13.779,73 · 7.305,55 · 8.094,78 ·
 * 2.666,44). Usado como palpite, isso poria um botão verde gigante *"baixa a fatura"*
 * sobre o cartão errado. **Quem segurou foi a trava do empate** (4 candidatos ALTA
 * empatados → nenhum palpite), mas depender dela seria depender de sorte.
 */
export function mesQueBateOValor(netByMonth: Map<string, number>, amount: number): string | null {
  let best: string | null = null
  let bestDiff = Infinity
  for (const [m, net] of netByMonth) {
    const d = Math.abs(round2(net) - amount)
    if (d < bestDiff) { bestDiff = d; best = m }
  }
  return best && bestDiff <= tolerânciaDaFatura(amount) ? best : null
}

