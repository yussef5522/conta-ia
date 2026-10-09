/**
 * ⭐⭐⭐ O ESTADO DE UMA PARCELA — UMA RÉGUA PRAS TRÊS TELAS (02/10/2026).
 *
 * ⛔⛔⛔ **O DEFEITO QUE A CRIOU, medido em prod:** a parcela 22 do **C41033828-8** tem os
 * **dois** pagamentos vinculados pela ponte N:1 — `7.568,91 + 2.665,44 = 10.234,35`, que é
 * **exatamente** o devido — e as telas davam **três respostas diferentes**:
 *
 * ```
 * LISTA de empréstimos  → EM DIA      (a próxima OPEN é a #23, de 25/10)
 * CONTRATO (cabeçalho)  → EM DIA      (mesma régua)
 * A PARCELA 22          → ATRASADA + botão "Marcar paga"   ⛔
 * ```
 *
 * **As duas causas, em camadas:**
 *
 * 1. **O DADO:** `paidTotal` ficou em **2.665,44** — só o ÚLTIMO pagamento. O
 *    `vincularPagamentoDeParcela` somava as tx **DO GESTO** e **sobrescrevia** o campo, então
 *    vincular em dois gestos **perdia o primeiro**. (A #21, com 3 mordidas num gesto só,
 *    ficou certa — é por isso que o defeito passou.) Daí `status: PARTIAL`.
 * 2. **A LEITURA:** o `statusUI` da tela do contrato só conhecia **PAID vs resto** —
 *    `i.status === 'PAID' ? 'PAID' : dueDate < now ? 'LATE' : 'OPEN'`. Parcela `PARTIAL`
 *    vencida virava **LATE**, com os dois pagamentos desenhados logo abaixo.
 *
 * ⚠️⚠️ **E HAVIA DUAS IMPLEMENTAÇÕES DE "ATRASADA":** a LISTA compara por **DIA (UTC)**, com o
 * comentário explicando o porquê (*"parcela vencendo HOJE não está atrasada; o débito cai ao
 * longo do dia"*); o CONTRATO e o `statusUI` comparavam por **INSTANTE**. Divergiam no
 * próprio dia do vencimento — a cicatriz de fuso que esta casa já pagou no card do cartão
 * (09/09) e no Contas a Pagar (13/09). Mais um terceiro vocabulário em `parcelas-do-mes`
 * (`status === 'ATRASADA'`).
 *
 * ═══ ⛔⛔ A DECISÃO MAIS IMPORTANTE DESTE ARQUIVO: **PROMOVE, NUNCA REBAIXA** ═══
 *
 * A régua ingênua — *"PAGA ⟺ Σ dos vínculos >= devido"* — foi **MEDIDA contra as 353
 * parcelas da empresa antes de ser escrita**, e ela **rebaixaria 3 que estão legitimamente
 * pagas**:
 *
 * ```
 * Arafat #1    devido 41.428,57 · pago 40.000,00   ← mútuo FLEXIBLE: a agenda é NOMINAL
 * Banrisul #58 devido  2.449,08 · pago  2.444,62   ← faltam 4,46 e ninguém deve isso
 * Banrisul #59 devido  2.422,62 · pago  2.413,86   ← faltam 8,76
 * ```
 *
 * ⚠️ E **180 parcelas estão `PAID` sem vínculo nenhum** (pagas por documento, histórico
 * anterior ao sistema). Uma régua que exigisse a soma as rebaixaria todas.
 *
 * ⭐ Por isso: ***`PAID` gravado é DECISÃO e ganha da aritmética; a soma só PROMOVE.*** É a
 * lição que esta casa escreveu em 14/08 — *"invariante ERRADO é pior que invariante nenhum:
 * se a regra falha no caso legítimo, alguém vai 'consertar' o DADO pra bater com a régua
 * errada"*.
 */

export type EstadoDaParcela = 'PAGA' | 'PARCIAL' | 'ATRASADA' | 'VENCE_HOJE' | 'A_VENCER'

/** o que basta saber de uma parcela pra dizer em que estado ela está */
export interface ParcelaParaEstado {
  dueDate: Date
  /** o devido nominal da agenda (interest + amortization) */
  payment: number
  /** o status GRAVADO — `PAID` é decisão e ganha da aritmética */
  status: string
  /** o campo gravado; usado só como último recurso (parcela sem vínculo) */
  paidTotal?: number | null
  /** ⭐ os vínculos N:1 (as mordidas) — a FONTE do quanto foi pago */
  pagamentos?: readonly { amount: number }[] | null
  /** o vínculo 1:1, com o valor da transação */
  valorDoVinculo11?: number | null
}

export interface VereditoDaParcela {
  estado: EstadoDaParcela
  /** quanto foi pago, DERIVADO (Σ dos vínculos; nunca o campo gravado quando há vínculo) */
  pago: number
  /** quanto falta — 0 quando quitada */
  falta: number
  /** quantos pagamentos compõem o pago (as "mordidas") */
  mordidas: number
  /** ⭐ a frase pronta pra tela: estado sem o número não ajuda o dono a decidir */
  selo: string
}

/** ⚠️ 2 centavos: ruído de arredondamento, o mesmo degrau `FECHA` do resto da casa */
/** ⚠️ exportado porque a REFERÊNCIA FLEXÍVEL DO MÊS (07/10) compara o caixa do mês com o
 *  nominal e precisa do MESMO degrau — duas tolerâncias divergiriam no primeiro centavo. */
export const TOL = 0.02
/** ⚠️ exportado porque a GRAVAÇÃO soma os mesmos centavos que a LEITURA — duas
 *  implementações de arredondamento divergem no primeiro meio-centavo. */
export const arredondar2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const round2 = arredondar2
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** o mesmo dia em UTC — ⚠️ por DIA, nunca por instante (a cicatriz de fuso) */
const diaDe = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/**
 * ⭐⭐ QUANTO FOI PAGO — e a ordem das fontes é deliberada.
 *
 * **1. a Σ dos vínculos N:1** quando existirem: é o FATO, e é o único que não se perde
 * quando o dono vincula em dois gestos. *O valor pago é a soma das baixas* — a doutrina da
 * baixa parcial (10/09), agora no módulo de empréstimo.
 *
 * **2. o vínculo 1:1**, que não tem linhas de soma.
 *
 * **3. o `paidTotal` gravado**, só pra parcela SEM vínculo nenhum (as 180 pagas por
 * documento). ⛔ Nunca na frente dos vínculos: era justamente ele que estava errado.
 */
export function quantoFoiPago(p: ParcelaParaEstado): { pago: number; mordidas: number } {
  const n1 = p.pagamentos ?? []
  if (n1.length > 0) return { pago: round2(n1.reduce((s, x) => s + x.amount, 0)), mordidas: n1.length }
  if (p.valorDoVinculo11 != null) return { pago: round2(p.valorDoVinculo11), mordidas: 1 }
  return { pago: round2(p.paidTotal ?? 0), mordidas: 0 }
}

export function estadoDaParcela(
  p: ParcelaParaEstado,
  opts: { flexible: boolean; hoje: Date },
): VereditoDaParcela {
  const { pago, mordidas } = quantoFoiPago(p)
  const devido = round2(p.payment)
  const falta = round2(Math.max(0, devido - pago))
  const quitadaPelaSoma = pago + TOL >= devido && devido > 0

  // ⛔ `PAID` gravado é DECISÃO: pode ter vindo de documento, de 1:1, ou da mão do dono.
  // A aritmética PROMOVE (o caso da #22) e nunca rebaixa (o caso do Arafat e das 4,46).
  if (p.status === 'PAID' || quitadaPelaSoma) {
    return {
      estado: 'PAGA',
      pago,
      falta: 0,
      mordidas,
      selo: mordidas > 1 ? `paga em ${mordidas} pagamentos` : 'paga',
    }
  }

  /**
   * ⛔⛔ MÚTUO FLEXIBLE NUNCA É "ATRASADA" — e nem PARCIAL pelo nominal.
   *
   * A agenda de 7× do mútuo Arafat é **só referência**: a devolução é conforme caixa. Medido:
   * a #1 tem devido nominal 41.428,57 e devolução de 40.000 — chamar isso de *"parcial,
   * faltam 1.428,57"* inventaria uma dívida de parcela que não existe.
   */
  if (opts.flexible) {
    return { estado: 'A_VENCER', pago, falta, mordidas, selo: pago > TOL ? `devolvido ${brl(pago)}` : 'em aberto' }
  }

  // ⭐ parcial DE VERDADE: tem pagamento, não fecha — e a tela DIZ o que falta
  if (pago > TOL) {
    return {
      estado: 'PARCIAL',
      pago,
      falta,
      mordidas,
      selo: `parcial — ${brl(pago)} de ${brl(devido)}, faltam ${brl(falta)}`,
    }
  }

  const dHoje = diaDe(opts.hoje)
  const dVenc = diaDe(p.dueDate)
  if (dVenc < dHoje) return { estado: 'ATRASADA', pago, falta, mordidas, selo: 'atrasada' }
  if (dVenc === dHoje) return { estado: 'VENCE_HOJE', pago, falta, mordidas, selo: 'vence hoje' }
  return { estado: 'A_VENCER', pago, falta, mordidas, selo: 'a vencer' }
}

/**
 * ⭐ O BOTÃO "MARCAR PAGA" APARECE? — e a régua é a mesma, pra não existir uma segunda.
 *
 * ⛔⛔ **O risco que o dono nomeou:** o botão aparecia numa parcela **que já tem os dois
 * pagamentos vinculados**, porque o `statusUI` a chamava de `LATE`. Clicar ali levaria a um
 * terceiro vínculo e o `paidTotal` seria sobrescrito de novo — **dupla contagem**.
 *
 * ⭐ Agora: **quitada não oferece** (não há o que completar), e **parcial oferece dizendo o
 * que falta** — o gesto completa a diferença, nunca recomeça.
 */
export function ofereceMarcarPaga(
  v: VereditoDaParcela,
  opts?: { flexible?: boolean },
): boolean {
  /**
   * ⛔⛔⛔ NO FLEXÍVEL A JANELA BANCÁRIA NÃO SERVE — e o botão sai da tela (09/10/2026).
   *
   * **O dono, com a devolução de 40.000 na mão:** *"o «Marcar paga» só concilia débito de
   * extrato com valor ±R$ 1 e janela ±7d do vencimento — régua de banco que não serve pra mútuo
   * de cofre com valor livre."*
   *
   * ⚠️ E o problema não é o botão aparecer: é ele **não poder funcionar por construção**. A
   * janela de `installment-match` casa valor conhecido perto do vencimento; no mútuo o valor é
   * livre (40k · 50k · 50k nas três reais) e a data é a do CAIXA. Resultado: lista sempre vazia,
   * com o dono achando que o pagamento dele não importou. ⭐ A porta do flexível é
   * «Registrar devolução» (`devolucao-flexivel.ts`), e **ter duas portas pro mesmo fato seria
   * a doença que esta casa mais paga.**
   */
  if (opts?.flexible) return false
  return v.estado !== 'PAGA'
}

/** ⚠️ o rótulo do gesto muda com o estado: "completar" ≠ "marcar paga" */
export function rotuloDoGesto(v: VereditoDaParcela): string {
  return v.estado === 'PARCIAL' ? `completar — faltam ${brl(v.falta)}` : 'Marcar paga'
}
