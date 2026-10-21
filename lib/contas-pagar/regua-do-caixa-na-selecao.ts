/**
 * ⭐⭐⭐ A RÉGUA DO CAIXA NA SELEÇÃO — *"saldo hoje R$ X → pagando fica R$ Y"* (21/10).
 *
 * **O pedido do dono:** *"A BARRA DA SELEÇÃO: «N contas selecionadas» + TOTAL gigante + A
 * RÉGUA DO CAIXA: «saldo hoje R$ X → pagando fica R$ Y» (verde quando cobre, coral quando
 * estoura) — a MESMA régua da mesa ①, nada de conta nova."*
 *
 * ⚠️⚠️ **CORREÇÃO DE PREMISSA, MEDIDA:** o brief manda buscar o saldo em `saldosDaEmpresa` —
 * e aquela é a porta do **ESTOQUE** (`lib/stock/saldo.ts`). Usá-la faria a régua somar **valor
 * de mercadoria na prateleira** e dizer que dá pra pagar o fornecedor com queijo. O dono da
 * pergunta *"quanto tem no caixa agora"* é `lib/balance/regua-do-caixa.ts`, consumido por
 * `serieDeSaldo` — **o MESMO número que a mesa ① mostra em «NO CAIXA AGORA»**, que é o que o
 * dono quis dizer.
 *
 * ⛔⛔ **E O `saldoHoje` É `number | null`, NUNCA `?? 0`.** Falha ao ler o caixa é **ausência
 * de MEDIÇÃO**, não caixa vazio — e `0` ali diria *"pagando fica −R$ 2.886"* em CORAL sobre
 * uma empresa que talvez tenha o dinheiro, mandando o dono não pagar um boleto que ele pode
 * pagar. É a família do *"zero é uma afirmação"* (o "sem contagem" do estoque) e do
 * `?? 'CAIXA'` que sumiu com o CASPER em 20/09: **default que resolve é default que
 * esconde.** Sem saldo, a barra DIZ *"saldo a apurar"* e mostra só o total.
 *
 * ⚠️ E a função é **PURA**: o saldo chega por PARÂMETRO. Ela não conhece `prisma`, então
 * quem decide *"o que é caixa"* continua sendo o dono único em `lib/balance/` — e esta régua
 * nunca pode virar a segunda resposta pra isso.
 */

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export type TomDaRegua = 'cobre' | 'estoura' | 'a-apurar'

export interface ReguaDoCaixaNaSelecao {
  /** quantas contas o dono marcou */
  contagem: number
  /** ⭐ o TOTAL GIGANTE — Σ da seleção */
  total: number
  /** `null` quando não deu pra ler o caixa */
  saldoHoje: number | null
  /** `saldoHoje − total`; `null` sem saldo lido */
  depois: number | null
  tom: TomDaRegua
  /** a frase pronta — montada aqui, pra a tela não ter régua própria */
  frase: string
}

/**
 * ⚠️ `total` vem por parâmetro (a Σ das linhas que o dono marcou), nunca recalculado aqui:
 * quem sabe quais contas estão selecionadas é a tela, e somar de novo criaria o segundo
 * número do mesmo fato a dez centímetros do primeiro.
 */
export function reguaDoCaixaNaSelecao(
  contagem: number,
  total: number,
  saldoHoje: number | null,
): ReguaDoCaixaNaSelecao {
  const t = round2(total)

  if (saldoHoje === null || !Number.isFinite(saldoHoje)) {
    return {
      contagem,
      total: t,
      saldoHoje: null,
      depois: null,
      tom: 'a-apurar',
      // ⛔ NÃO diz quanto sobra: sem o saldo, qualquer número ali seria inventado
      frase: 'saldo de caixa a apurar — não consegui ler o saldo das contas agora',
    }
  }

  const s = round2(saldoHoje)
  const depois = round2(s - t)
  /**
   * ⚠️ `>= 0` e não `> 0`: pagar o que zera o caixa **cobre** (o dinheiro deu). Coral é pra
   * dizer *"vai faltar"*, e alarme onde não falta é como o dono aprende a ignorar coral.
   */
  const cobre = depois >= 0

  return {
    contagem,
    total: t,
    saldoHoje: s,
    depois,
    tom: cobre ? 'cobre' : 'estoura',
    /**
     * ⭐ A frase do dono, ao pé da letra. O número vai formatado pela TELA (o `formatBRL` da
     * casa) — aqui mora a REGRA, não a moeda: formatar em dois lugares daria dois jeitos de
     * escrever dinheiro na mesma barra.
     */
    frase: cobre
      ? 'saldo hoje → pagando fica'
      : 'saldo hoje → pagando fica NEGATIVO',
  }
}
