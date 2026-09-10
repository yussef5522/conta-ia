// ⭐⭐⭐ A FORMA ÚNICA DE UMA FATURA PF LIDA (09/09/2026).
//
// ⛔⛔⛔ **O BUG QUE ISTO EXISTE PRA MATAR, e ele estava vivo em prod:** o registry de
// bancos do caminho PF foi criado em 31/08 pra acabar com o fallback silencioso (o dono
// subiu um Nubank e o sistema aplicou os regex do Banrisul) — e **a porta foi só até a
// metade**. Medido hoje, linha 155 do `importar-fatura-pf.ts`:
//
// ```
//   const parser = reconhecerBancoPF(input.texto)   // ⭐ reconhece o banco…
//   if (!parser) { …falha com a frase certa… }
//   const r = parseBanrisulFaturaPF(input.texto)    // ⛔ …e parseia SEMPRE com o Banrisul
// ```
//
// O `parser.parse` do registry **nunca foi chamado por ninguém**. Ou seja: uma fatura do
// Nubank passava no reconhecimento, era lida com a régua do Banrisul, e caía em
// *"não consegui ler nenhum lançamento"*. **É a MESMA classe do "N caminhos, 1 esquecido"**
// — e passou despercebida porque o import do Nubank nunca foi validado em prod (está
// registrado como REGRA 2 pendente desde 31/08).
//
// ⚠️ E não dava pra chamar `parser.parse` e pronto: **cada parser devolve um formato
// diferente** (o Banrisul tem `extraction/declared/computed/proximas`, o Nubank tem
// `linhas/blocos/computed`, o Itaú tem `cartoes/declared/computed`). O import consumia a
// forma do Banrisul direto. Este arquivo é a forma COMUM: cada banco traz um adaptador, e
// o import passa a conhecer **uma** forma.
//
// ⭐ A CONFERÊNCIA CONTINUA SENDO DE CADA BANCO, de propósito: a composição que fecha o
// Nubank (compras + IOF + outros) não é a do Banrisul (brasil + estornos + encargos) nem a
// do Itaú (cartão A + cartão B + produtos e serviços). Uma régua única aqui reprovaria
// fatura correta — foi o que a lição do Nubank ensinou em 31/08. O que se unifica é o
// FORMATO do resultado, nunca a régua.

/** uma linha de fatura, do jeito que o import PF grava */
export interface LinhaLidaPF {
  /** ISO */
  data: string
  descricao: string
  /** sempre POSITIVO — o sinal mora em `credito` */
  valor: number
  credito: boolean
  parcelaNumero: number | null
  parcelaTotal: number | null
  /** final do cartão, quando a fatura tem mais de um portador */
  portador: string | null
  internacional: boolean
}

export interface ConferenciaLidaPF {
  despesasCalculado: number
  despesasDeclarado: number | null
  saldoCalculado: number
  saldoDeclarado: number | null
  /** encargo que só existe no resumo (não é linha) */
  encargosDeclarados: number
  /**
   * ⭐ COMO O DOCUMENTO CHAMA esse encargo. O confirm cria uma LINHA com ele (senão a
   * fatura fecha curta — foi o bug dos R$ 0,62 do Banrisul em 26/08), e a linha tem que
   * usar o nome do próprio banco: no Itaú é *"Encargos (financiamento + moratório)"*, e
   * gravar "Encargos sobre rotativo" ali seria pôr na tela um rótulo que não existe na
   * fatura que o dono tem na mão.
   */
  encargosRotulo: string
  fecha: boolean
  /**
   * ⭐⭐ TUDO QUE DAVA PRA CONFERIR NESTE DOCUMENTO FECHOU — menos o total, que ele não
   * declara (09/09/2026).
   *
   * ⛔ É o que autoriza o **total digitado pelo dono** a valer como régua. Sem este campo
   * o `fecha` do banco era a única palavra, e a saída manual criada em 31/08 **nunca
   * podia dar verde**: o dono digitava o número, o preview mostrava `origemTotal:
   * DIGITADO`… e `ok` continuava `false`, porque ele nunca foi consultado.
   *
   * ⚠️ E o total digitado NÃO resgata fatura que o PDF declara e não bate — isso seria o
   * `force` disfarçado que a casa recusa desde o caso Cancian. Ele só entra onde o
   * documento é omisso.
   */
  fechaSemOTotal: boolean
  /** o detalhe numérico que a mensagem de falha anexa — lido × declarado, ao centavo */
  detalhe: string | null
}

export interface ProximasLidasPF {
  proxima: number | null
  seguinte: number | null
  demais: number | null
  total: number | null
  rotuloProxima: string | null
  rotuloSeguinte: string | null
}

export interface FaturaPFLida {
  banco: string
  vencimento: string | null
  linhas: LinhaLidaPF[]
  conferencia: ConferenciaLidaPF
  portadores: string[]
  proximas: ProximasLidasPF
}

export const PROXIMAS_VAZIAS: ProximasLidasPF = {
  proxima: null, seguinte: null, demais: null, total: null,
  rotuloProxima: null, rotuloSeguinte: null,
}
