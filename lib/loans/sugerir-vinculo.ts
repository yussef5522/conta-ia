// EMPRÉSTIMO — sugestão de vínculo direto do EXTRATO (26/08).
//
// O caso que pediu isto: a parcela #21 do C41033828 (R$ 10.234,35) foi debitada em
// TRÊS MORDIDAS no mesmo dia — a conta não tinha saldo e o banco pegou conforme o
// dinheiro entrava (dá pra ver o encadeado: a Tuna depositou 3.224,94 e o banco levou
// exatamente 3.224,94 na sequência). No import, as 3 caíram em "escolha você".
//
// ⚠️ REGRA 4 — a decisão "qual contrato" NÃO é reimplementada aqui: vem do
// `detectLoanPayment`, o mesmo que a fila /pendentes usa. Isto acrescenta só a segunda
// pergunta, que faltava: QUAL PARCELA. Se a regra de contrato mudar, muda pros dois.
//
// O que NÃO faz: não adivinha quando não sabe. Sem número de contrato na descrição
// (Banrisul manda só "EMPRESTIMO", Caixa "DEBITO PRESTA SIEMP"), devolve os candidatos
// pro dono escolher — a Cacula tem 2 contratos por conta nesses dois bancos.

import { detectLoanPayment, type DetectLoanLite } from './detect-payment'

export interface ParcelaLite {
  number: number
  dueDate: Date
  /** valor nominal da parcela (interest + amortization) */
  payment: number
  status: string
  /** quanto já foi pago por mordidas anteriores */
  paidTotal?: number | null
}

export type SugestaoVinculo =
  | {
      kind: 'SUGERIDO'
      loanId: string
      contractNumber: string
      lender: string
      installmentNumber: number
      /** frase pronta pra tela — o dono confirma, não digita */
      rotulo: string
      /** true quando esta tx sozinha NÃO fecha a parcela (débito parcial) */
      parcial: boolean
      faltaDepois: number
    }
  | { kind: 'ESCOLHER'; candidates: Array<{ loanId: string; contractNumber: string | null; lender: string }> }
  | { kind: 'NAO_CADASTRADO'; contractNumber: string }
  | null

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const TOL = 0.02
/**
 * ⚠️ ±5 dias do vencimento. O banco debita no dia ou logo depois (conta sem saldo atrasa),
 * e a janela larga transformaria *"valor exato"* em coincidência: duas parcelas iguais de
 * meses diferentes casariam, e aí o empate mata o palpite — que é o certo, mas inútil.
 */
const JANELA_DE_DIAS = 5
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * A parcela que este débito está pagando: a ABERTA cujo vencimento está mais próximo
 * da data do lançamento.
 *
 * ⚠️ Empate resolve pela MAIS ANTIGA. O banco cobra a mais velha primeiro, e numa
 * conta que já atrasou (que é exatamente o caso das mordidas) a dívida antiga vem antes.
 */
export function escolherParcela(parcelas: ParcelaLite[], dataTx: Date): ParcelaLite | null {
  const abertas = parcelas.filter((p) => p.status !== 'PAID')
  if (abertas.length === 0) return null
  const t = dataTx.getTime()
  return [...abertas].sort((a, b) => {
    const da = Math.abs(a.dueDate.getTime() - t)
    const db = Math.abs(b.dueDate.getTime() - t)
    if (da !== db) return da - db
    return a.dueDate.getTime() - b.dueDate.getTime() // empate → a mais antiga
  })[0]
}

export function sugerirVinculoEmprestimo(
  tx: { description: string; type: string; date: Date; amount: number; bankAccountId?: string | null },
  loans: DetectLoanLite[],
  parcelasPorLoan: Record<string, ParcelaLite[]>,
): SugestaoVinculo {
  const det = detectLoanPayment(tx, loans)
  if (!det) return null
  if (det.kind === 'NOT_REGISTERED') return { kind: 'NAO_CADASTRADO', contractNumber: det.contractNumber }
  if (det.kind === 'CANDIDATES') {
    /**
     * ⭐⭐⭐ A PARCELA EXATA DESEMPATA (01/10/2026) — e é o sinal mais forte do domínio.
     *
     * **O caso real:** `DEBITO PRESTA SIEMP · 26/09 · R$ 2.927,02` no banco caixa. O banco
     * **não escreve o número do contrato**, então a descrição empata os 2 contratos da
     * Caixa — e o dono ficava sem palpite numa linha que casa ***ao centavo e no dia*** com
     * a parcela **#32 do 1837311** (venc 26/09, R$ 2.927,02). O outro contrato tem parcela
     * de R$ 7.093,19: não casa nem de perto.
     *
     * ⛔⛔ **A TRAVA É O EMPATE, e ela é o que separa isto de chute:** só sugere com **UMA**
     * parcela aberta, de **UM** contrato, casando **valor EXATO** (±2 centavos, o ruído de
     * arredondamento) dentro de **±5 dias** do vencimento. Dois candidatos que fecham é
     * *"não sei qual foi"* — e aí o dono escolhe, como hoje. É a mesma régua do PAO DE MEL,
     * do pagamento de fatura (valor exato, 25/09) e do pagamento em lote.
     *
     * ⚠️ E ela **só roda no empate**: contrato identificado pelo NÚMERO continua mandando —
     * número na descrição é identidade, não semelhança, e não se discute com ele.
     */
    const exatas = det.candidates.flatMap((c) =>
      (parcelasPorLoan[c.loanId] ?? [])
        .filter((p) => {
          if (p.status === 'PAID') return false
          const falta = round2(p.payment - round2(p.paidTotal ?? 0))
          const valorBate = Math.abs(falta - tx.amount) <= TOL
          const dias = Math.abs(p.dueDate.getTime() - tx.date.getTime()) / 86_400_000
          return valorBate && dias <= JANELA_DE_DIAS
        })
        .map((p) => ({ c, p })),
    )
    if (exatas.length === 1) {
      const { c, p } = exatas[0]
      return {
        kind: 'SUGERIDO',
        loanId: c.loanId,
        contractNumber: c.contractNumber ?? '',
        lender: c.lender,
        installmentNumber: p.number,
        rotulo: `Pgto empréstimo ${c.contractNumber ?? c.lender} — parcela ${p.number}`,
        parcial: false,
        faltaDepois: 0,
      }
    }
    return { kind: 'ESCOLHER', candidates: det.candidates.map((c) => ({ loanId: c.loanId, contractNumber: c.contractNumber, lender: c.lender })) }
  }

  const parcela = escolherParcela(parcelasPorLoan[det.loanId] ?? [], tx.date)
  if (!parcela) {
    // contrato certo, mas sem parcela aberta — não inventa (pode ser tarifa/quitação)
    return { kind: 'ESCOLHER', candidates: [{ loanId: det.loanId, contractNumber: det.contractNumber, lender: det.lender }] }
  }

  const jaPago = round2(parcela.paidTotal ?? 0)
  const falta = round2(parcela.payment - jaPago)
  const depois = round2(falta - tx.amount)
  const parcial = depois > TOL

  const rotulo = parcial
    ? `Pgto empréstimo ${det.contractNumber} — parcela ${parcela.number} (parcial: ${brl(tx.amount)} de ${brl(falta)}; faltam ${brl(depois)})`
    : `Pgto empréstimo ${det.contractNumber} — parcela ${parcela.number}`

  return {
    kind: 'SUGERIDO',
    loanId: det.loanId,
    contractNumber: det.contractNumber,
    lender: det.lender,
    installmentNumber: parcela.number,
    rotulo,
    parcial,
    faltaDepois: parcial ? depois : 0,
  }
}
