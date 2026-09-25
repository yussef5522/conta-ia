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
  if (best && bestDiff <= folgaDepoisDeEscolherOCartao(amount)) return best
  return [...netByMonth.keys()].sort().pop() ?? null
}

/**
 * ⭐⭐ A FOLGA DE **DEPOIS** — vale só quando o dono JÁ DISSE que a linha é daquele cartão.
 *
 * ⚠️⚠️ **25/09 — ELA DEIXOU DE SER COMPARTILHADA, e a razão é medida.** De 16/09 até hoje
 * esta mesma função servia os DOIS leitores, com o comentário *"uma régua, dois leitores"*.
 * Parecia REGRA 4 e era o oposto: **as duas perguntas são diferentes**, então a mesma folga
 * significa coisas diferentes em cada uma.
 *
 * ⭐ **AQUI (depois de escolher o cartão) 2% é CERTO:** o dono confirmou a premissa, e o que
 * sobra é juros/encargo da fatura — que a régua da diferença de 24/09 manda **nomear**.
 *
 * ⛔ **LÁ (o palpite) 2% era VENENO** — ver `mesQueBateOValor`.
 */
export function folgaDepoisDeEscolherOCartao(amount: number): number {
  return Math.max(0.02, amount * 0.02)
}

/**
 * ⭐ O CENTAVO DE ARREDONDAMENTO — não é folga, é ruído.
 *
 * ⚠️ É o mesmo degrau `FECHA` da régua da diferença (24/09): *um centavo de arredondamento
 * bancário não é diferença*. Acima disso, é.
 */
const CENTAVO = 0.02

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
 *
 * ⛔⛔⛔ **25/09 — O VALOR TEM QUE SER EXATO, E A FOLGA DE 2% ERA VENENO AQUI.** Régua do
 * dono: *"o matcher que PROPÕE «é pagamento de fatura» passa a exigir match exato; a
 * tolerância de 2% fica só pra DEPOIS que eu já escolhi o cartão"*.
 *
 * **MEDIDO EM PROD:** 2% de uma linha de R$ 5.210,78 são **R$ 104,22 de folga** — e com ela
 * **17 dos 18 palpites de fatura apontavam pagamento de FORNECEDOR**:
 * ```
 * R$ 5.210,78 «FRIGORIFICO SILVA…»     → banco caixa 2026-09 (net 5.106,99 · dif 103,79)
 * R$ 2.017,05 «CARTORIO DO REGISTRO…»  → mercado pago 2026-07 (net 1.978,14 · dif  38,91)
 * R$ 4.337,52 «LIQUIDACAO DE PARCELA…» → banco caixa 2026-06 (net 4.345,95 · dif   8,43)
 * ```
 * ⛔⛔ **E O ESTRAGO IA ALÉM DO PALPITE ERRADO:** este candidato se declara `diferenca: 0`
 * com confiança ALTA — então, no ranking, ele **ganhava** do palpite certo (casar com a
 * conta do fornecedor, que carrega a diferença real) **ou matava os dois por empate
 * técnico**, deixando a linha sem palpite nenhum. *O comentário do campo dizia "só devolve
 * o mês cujo NET BATE" — e a folga de 2% fazia dele uma afirmação falsa.*
 *
 * ⭐ **É A CLASSE DO FALSO-AMIGO (11/09):** *"quase-exato SEM nome compatível NUNCA sugere;
 * diferença de centavos não compra identidade"*. Aqui não há nome nenhum pra desempatar —
 * o único sinal é o valor —, então ele tem que ser **o valor**.
 *
 * ⚠️ Pagamento de fatura com juros continua resolvível: pelo **gesto** (o dono escolhe o
 * cartão e a competência no menu), e aí vale a `folgaDepoisDeEscolherOCartao`.
 */
export function mesQueBateOValor(netByMonth: Map<string, number>, amount: number): string | null {
  let best: string | null = null
  let bestDiff = Infinity
  for (const [m, net] of netByMonth) {
    const d = Math.abs(round2(net) - amount)
    if (d < bestDiff) { bestDiff = d; best = m }
  }
  return best && bestDiff <= CENTAVO ? best : null
}

