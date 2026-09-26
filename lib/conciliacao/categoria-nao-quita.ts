// ⭐⭐⭐ "CATEGORIZADA" SÓ É DESFECHO PRA QUEM NÃO TEM NOTA (25/09/2026) — decisão do dono.
//
// **O achado que a motivou (o mapa do problema 3):** o selo `categorizada` mandava a linha
// pro ARQUIVO, e havia **68 saídas (R$ 93.893,78)** resolvidas assim. Separando por natureza,
// **18 delas (R$ 16.201,01) são de fornecedor que EMITE NOTA** — DOCEOLI 5.234,88, as duas do
// CASPER de 04/09, DIVINE, CEREALISTA, E-CAIXAS, frete… ***Cada uma é um pagamento que saiu e
// não baixou conta a pagar nenhuma, fora da caixa e sem ninguém cobrando.***
//
// ⚠️⚠️ **E O COMENTÁRIO DA LEI DA ESTAÇÃO DEFENDIA ISSO**, com estas palavras: *"ter
// categoria conta como resolvida AQUI, e isso NÃO contradiz a régua de 07/09 — lá a pergunta
// era «esta linha ainda pode pagar um boleto?»; aqui é «esta linha ainda pede decisão
// minha?», e não pede"*. **O argumento vale pro salário e pra retirada de sócio; não vale pro
// fornecedor** — ali a linha ainda pede uma decisão, e a decisão é *qual nota ela pagou*.
//
// ⭐⭐ **A RÉGUA É POR GRUPO DO DRE, NUNCA POR NOME DA CATEGORIA.** O dono foi explícito:
// *"LISTA FECHADA por grupo do DRE (a régua de quem decide, não palpite por nome)"*. Nome de
// categoria é texto livre que cada cliente escreve como quer — casar por nome seria a
// família do *"o memo diz Transferência"*. O `dreGroup` é escolha estrutural.

/**
 * ⭐ OS GRUPOS QUE **NÃO PASSAM** POR CONTAS A PAGAR — aqui a categoria É o destino final.
 *
 * ⚠️ Salário, retirada de sócio, juros do banco, tarifa: **não existe boleto pra casar**.
 * Cobrar vínculo nessas seria uma parede sem porta — e parede é como o dono aprende a
 * contornar o sistema por fora.
 *
 * ⛔ **LISTA FECHADA**: grupo novo cai no lado que EXIGE vínculo (ver `categoriaResolveSozinha`),
 * que é o erro seguro — o inseguro é um pagamento de fornecedor sumindo da caixa em silêncio.
 */
export const GRUPOS_QUE_A_CATEGORIA_RESOLVE: readonly string[] = [
  'DESPESAS_PESSOAL', // salários, FGTS, férias, pró-labore
  'DISTRIBUICAO_LUCROS', // retirada de sócio
  'DESPESAS_FINANCEIRAS', // juros, tarifas, encargos do banco
  'RECEITAS_FINANCEIRAS',
  'DEDUCOES', // devolução de venda, maquininha
  'RECEITA_BRUTA', // entrada de venda: não há conta a pagar
  'OUTRAS_RECEITAS',
  'IMPOSTOS_SOBRE_LUCRO',
  'APORTES_CAPITAL',
  /**
   * ⭐⭐ 25/09 — **INVESTIMENTOS (consórcio, capitalização) não passa por contas a pagar.**
   *
   * Decisão do dono: *"o grupo «investimentos» entra na lista fechada dos que NÃO passam
   * por contas a pagar"*. ⛔ Era por não estar aqui que o CONSÓRCIO de R$ 1.478,51 ficava
   * entre as 18 com o aviso *"categorizada, mas sem vínculo"* — cobrando uma nota que
   * **não existe**: o consórcio debita direto, não emite boleto pro financeiro.
   *
   * ⚠️ E isto NÃO afrouxa a régua de 24/09: a linha continua tendo um desfecho NOMEADO —
   * o gesto 📈 vincula ao CONTRATO e escreve *"aporte no Consórcio X, parcela de set/2026"*.
   * *Decisão, nunca silêncio.*
   */
  'INVESTIMENTOS',
  'TRANSFERENCIA',
  'AJUSTE_SALDO',
]

/**
 * ⛔ **E A A_CLASSIFICAR NUNCA RESOLVE NADA** — ela é o balde de *"ninguém sabe o que é"*.
 * Ela não está na lista acima e cai no lado que exige decisão, que é exatamente o certo.
 */

/**
 * ⭐⭐ A categoria, por si, encerra esta linha?
 *
 * ⚠️ **Sem `dreGroup` a resposta é NÃO.** Categoria sem grupo é configuração incompleta, e
 * tratar ausência como *"pode arquivar"* é a mesma classe do `?? 'CAIXA'` que sumiu com o
 * CASPER em 20/09 — **default que resolve é default que esconde**.
 */
export function categoriaResolveSozinha(dreGroup: string | null | undefined): boolean {
  if (!dreGroup) return false
  return GRUPOS_QUE_A_CATEGORIA_RESOLVE.includes(dreGroup)
}

/**
 * ⭐ O AVISO da linha que ficou na caixa **por causa disso** — e ele diz as DUAS saídas.
 *
 * ⛔ Aviso que só acusa é beco: a compra pré-sistema (ou o pix pro entregador que nunca teve
 * nota) é caso **legítimo**, e sem a segunda porta o dono ficaria preso. *"Decisão, nunca
 * silêncio"* — palavras dele.
 */
export const AVISO_CATEGORIZADA_SEM_VINCULO =
  'categorizada, mas sem vínculo — casa com a nota ou confirma que não tem'

/** ⭐ o selo do arquivo quando o dono confirma que não há nota */
export const SELO_AVULSA_CONFIRMADA = 'avulsa confirmada'

/**
 * ⭐⭐⭐ 25/09 — **O APORTE COBRA O CONTRATO, NUNCA A NOTA.**
 *
 * ⚠️ Medido em prod: com o gesto 📈 no ar, as 5 linhas de aporte voltaram pra caixa
 * **com o aviso errado** — *"casa com a nota ou confirma que não tem"*. ⛔ Consórcio e
 * capitalização **debitam direto e não emitem boleto**: o aviso mandava o dono caçar um
 * documento que não existe. *É a lição de 16/09 — "mensagem que acusa o campo errado faz o
 * dono caçar um erro que não existe"* — na frase que eu mesmo acabei de pôr na tela.
 */
export const AVISO_APORTE_SEM_CONTRATO =
  'falta dizer em qual contrato este dinheiro entrou — escolha no 📈 aporte em investimento'

/**
 * ⭐⭐ A FRASE QUE A LINHA NA CAIXA MOSTRA — uma régua, um lugar.
 *
 * ⛔ Ela vivia **inline na rota**, e regra que mora numa rota é regra que ninguém prova
 * (a lição do prefill do cardápio, 28/08). Aqui ela é pura e testada.
 *
 * ⚠️ E ela é por CASO, não uma frase pra tudo: o que a linha DEVE é diferente em cada um,
 * e cobrar a coisa errada é pior que não cobrar nada.
 */
export function avisoDaLinhaNaCaixa(l: {
  categoryId: string | null
  dreGroupDaCategoria: string | null
  avulsaConfirmada: boolean
  temAporteVinculado: boolean
}): string | null {
  if (!l.categoryId || l.avulsaConfirmada) return null
  // ⭐ o aporte pede o CONTRATO — e vem ANTES, senão a frase da nota o alcança
  if (l.dreGroupDaCategoria === 'INVESTIMENTOS') {
    return l.temAporteVinculado ? null : AVISO_APORTE_SEM_CONTRATO
  }
  // ⚠️ grupo que a categoria resolve sozinha não pede nada
  if (categoriaResolveSozinha(l.dreGroupDaCategoria)) return null
  return AVISO_CATEGORIZADA_SEM_VINCULO
}
