// ⭐⭐ A CONFERÊNCIA DO SALDO PF + O PAGAMENTO DE FATURA QUE SE RECONHECE (13/09/2026).
//
// Duas perguntas pequenas que o extrato responde sozinho, cada uma com a régua da casa.

const r2 = (n: number) => Math.round(n * 100) / 100

// ──────────────────────────────────────────────────────────────────────────────
// 1. O SALDO CONFERE COM O QUE O BANCO DECLAROU?
// ──────────────────────────────────────────────────────────────────────────────

/** ⚠️ um centavo de arredondamento não é divergência — é ruído (a régua do FECHA da PJ) */
export const TOLERANCIA_DO_SALDO = 0.02

export interface ConferenciaDeSaldo {
  estado: 'BATE' | 'DIVERGE' | 'SEM_DECLARADO'
  calculado: number
  declarado: number | null
  diferenca: number | null
  frase: string
}

/**
 * ⭐ `saldoAntes + Σ(o que entra) == LEDGERBAL`?
 *
 * ⛔ **Sem `<LEDGERBAL>` no arquivo a resposta é SEM_DECLARADO, nunca "bate"** — é a lição
 * do invariante circular de 28/08: *"invariante que não pode falhar é pior que nenhum: dá
 * selo verde de graça"*. Dizer que confere sem ter contra o que conferir é exatamente isso.
 */
export function conferirSaldo(input: {
  saldoAntes: number
  entram: number[]
  declarado: number | null
}): ConferenciaDeSaldo {
  const calculado = r2(input.saldoAntes + input.entram.reduce((s, v) => s + v, 0))
  if (input.declarado == null) {
    return {
      estado: 'SEM_DECLARADO', calculado, declarado: null, diferenca: null,
      frase: 'o arquivo não trouxe o saldo do banco — dá pra importar, mas não dá pra conferir',
    }
  }
  const dif = r2(calculado - input.declarado)
  if (Math.abs(dif) <= TOLERANCIA_DO_SALDO) {
    return {
      estado: 'BATE', calculado, declarado: input.declarado, diferenca: dif,
      frase: `confere com o banco: ${brl(calculado)}`,
    }
  }
  // ⚠️ a mensagem NÃO chuta a causa: sobrar de um lado tem DUAS explicações (falta entrada
  // ou sobra saída), e afirmar uma manda o dono procurar no lugar errado (a lição de 28/08).
  return {
    estado: 'DIVERGE', calculado, declarado: input.declarado, diferenca: dif,
    frase: `não fecha com o banco: calculado ${brl(calculado)} × declarado ${brl(input.declarado)}`
      + ` — diferença de ${brl(Math.abs(dif))}`,
  }
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ──────────────────────────────────────────────────────────────────────────────
// 2. ESTE DÉBITO É O PAGAMENTO DE UMA FATURA?
// ──────────────────────────────────────────────────────────────────────────────

/** ⚠️ a janela em torno do vencimento — paga-se no dia, antes, ou com algum atraso */
export const JANELA_DO_VENCIMENTO = { antes: 10, depois: 10 } as const

export interface FaturaAberta {
  invoiceId: string
  cardId: string
  cardNome: string
  bankName: string | null
  lastDigits: string | null
  referencia: string
  vencimento: Date
  /** o que falta pagar (total − pago) */
  emAberto: number
  cardAtivo: boolean
}

export interface PagamentoDeFatura {
  invoiceId: string
  cardId: string
  cardNome: string
  porQue: string
}

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ⭐⭐ O casamento do pagamento — **valor EXATO, sempre** (a régua do dono desde 09/09:
 * *"só valor EXATO é oferecido; ele tem 4 cartões e valores se parecem"*).
 *
 * ⛔ E **só cartão ATIVO entra**: o perfil tem um `banrisul pf ****9113` vazio e inativo ao
 * lado do `banrisul ****9113` que tem as 277 transações. Casar pelos 4 dígitos sem olhar o
 * estado escolheria o cadastro abandonado — é a família do Cancian (08/09), em que dois
 * candidatos quase idênticos fizeram a nota errada ser vinculada.
 *
 * ⚠️ **Dois candidatos exatos = NENHUM.** O dono aponta; o sistema não desempata no escuro.
 */
export function reconhecerPagamentoDeFatura(
  debito: { data: Date; valor: number; memo: string },
  faturas: FaturaAberta[],
): PagamentoDeFatura | { ambiguo: FaturaAberta[] } | null {
  const alvo = Math.abs(debito.valor)
  const dentroDaJanela = (f: FaturaAberta) => {
    const d = Math.floor((debito.data.getTime() - f.vencimento.getTime()) / 86_400_000)
    return d >= -JANELA_DO_VENCIMENTO.antes && d <= JANELA_DO_VENCIMENTO.depois
  }
  const candidatas = faturas.filter((f) =>
    f.cardAtivo && f.emAberto > 0 && Math.abs(f.emAberto - alvo) < 0.005 && dentroDaJanela(f))

  if (!candidatas.length) return null
  if (candidatas.length === 1) {
    const f = candidatas[0]
    return {
      invoiceId: f.invoiceId, cardId: f.cardId, cardNome: f.cardNome,
      porQue: `valor exato da fatura ${f.referencia} (${brl(f.emAberto)}), que vence ${f.vencimento.toISOString().slice(0, 10)}`,
    }
  }

  // ⭐ o EMISSOR no texto é o desempate — e ele só vale pra desempatar, nunca pra afrouxar
  // o valor exato. Sem ele, duas faturas do mesmo valor ficam pro dono.
  const memo = normal(debito.memo)
  const pelaMarca = candidatas.filter((f) =>
    (f.bankName && memo.includes(normal(f.bankName)))
    || memo.includes(normal(f.cardNome))
    || (f.lastDigits && memo.includes(f.lastDigits)))
  if (pelaMarca.length === 1) {
    const f = pelaMarca[0]
    return {
      invoiceId: f.invoiceId, cardId: f.cardId, cardNome: f.cardNome,
      porQue: `valor exato da fatura ${f.referencia} e o nome do emissor na descrição`,
    }
  }
  return { ambiguo: candidatas }
}

export const ehAmbiguo = (r: ReturnType<typeof reconhecerPagamentoDeFatura>): r is { ambiguo: FaturaAberta[] } =>
  r != null && 'ambiguo' in r
