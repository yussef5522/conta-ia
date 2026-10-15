// ⭐⭐⭐ O RESÍDUO DO CUSTO MÉDIO — ZERAR QUANTIDADE ZERA VALOR (19/09/2026).
//
// **O dono, travado numa baixa de 58 itens:** *"o confirmar recusa com «Este item ficaria
// com 0 unidades e valor R$ -0.04» mas NÃO DIZ QUAL ITEM — e os outros 57 ficam reféns."*
//
// ⭐⭐ **DE ONDE O CENTAVO NEGATIVO NASCE, medido:** `custoMedioPorItem` devolve o custo
// **arredondado em 2 casas** (`round2(valor / saldo)`), e a baixa multiplica esse número
// pela quantidade. O erro do arredondamento **cresce com a quantidade**:
//
// ```
// OVO BRANCO · 1019 un · R$ 555,64 · custo médio arredondado 0,55
//    baixa total: 1019 × 0,55 = R$ 560,45   →  sobra R$ -4,81
// ```
//
// ⚠️⚠️ **E ISSO DERRUBA O TETO DE 5 CENTAVOS** que o dono propôs: medido em prod, **55 dos
// 215 itens** ficariam negativos ao zerar, e o maior resíduo é de **R$ 113,63** (a CUBA
// MAIONESE, com 22 mil "kg"). *Cinco centavos recusaria quase todos.*
//
// ⭐ **O TETO CERTO É O LIMITE MATEMÁTICO DO ARREDONDAMENTO**, não um número escolhido a
// dedo — a mesma régua do E16 (*"0,005 × Σ|quantidade|"*, 29/08): um custo arredondado na
// 2ª casa erra no máximo meio centavo POR UNIDADE.
//
// ⛔ E a cura de fundo é a lição que esta casa já aprendeu duas vezes (a reunitização do pão
// e a conclusão de produção): ***o ledger guarda precisão cheia; quem arredonda é a
// leitura***. Com o custo em precisão cheia o resíduo **não nasce** — o teto abaixo é só
// pra o que JÁ está gravado.
//
// ⚠️⚠️ **EM 15/10 ESTE ARQUIVO PASSOU A IMPORTAR A LEI DO CUSTO** (`custoMedioComMemoria`),
// pra o ramo de saldo ≤ 0 — a alternativa era reescrever a lei aqui, e aí seriam duas réguas
// pra mesma pergunta.
//
// ⛔⛔ **E O IMPORT TEM QUE SER O MÓDULO PURO (`lei-do-custo-medio`), NUNCA `custo-vigente`:**
// importar o `custo-vigente` fecha um CICLO (ele → `contagem-ancora` → `entrada-cruza-o-zero`
// → de volta pra cá, pelo `ERRO_POR_UNIDADE`) e o sintoma não é erro de módulo — é
// `TIPOS_COM_CUSTO_CONHECIDO` chegando **undefined** no meio da gravação de um movimento.
// Foram **177 testes vermelhos** até a suíte apontar isso.

import { custoMedioComMemoria } from './lei-do-custo-medio'

/** meio centavo por unidade é o pior caso de um custo arredondado na 2ª casa */
export const ERRO_POR_UNIDADE = 0.005

/** piso: abaixo disto é ruído de ponto flutuante, não arredondamento de custo */
export const PISO = 0.05

export interface EstadoDoItem {
  saldoAntes: number
  valorAntes: number
  qtdDaBaixa: number
  valorDaBaixa: number
}

export interface VeredictoDoResiduo {
  saldoDepois: number
  valorDepois: number
  /** ⭐ a baixa zera a quantidade? só aí o resíduo pode ir junto */
  zeraQuantidade: boolean
  /** o quanto sobraria de valor com quantidade zero */
  residuo: number
  /** o teto que ESTE item aceita (limite matemático do arredondamento) */
  teto: number
  decisao: 'OK' | 'AJUSTA_RESIDUO' | 'RECUSA'
}

/**
 * ⭐⭐ A DECISÃO, pura.
 *
 * ⛔ **`AJUSTA_RESIDUO` só existe quando a quantidade vai a ZERO.** Com saldo remanescente,
 * um valor negativo é dado torto de verdade (consumo lançado antes da compra — o caso do
 * fermento) e continua sendo recusado: *zerar valor de um item que ainda está na prateleira
 * esconderia a compra que falta*.
 *
 * ⚠️ E o teto é **por item**, proporcional ao que saiu: 5 centavos num item de 3 unidades é
 * outra coisa que 5 centavos num item de 2.000.
 */
export function avaliarResiduo(e: EstadoDoItem): VeredictoDoResiduo {
  const round2 = (n: number) => Math.round(n * 100) / 100
  const saldoDepois = round2(e.saldoAntes - e.qtdDaBaixa)
  const valorDepois = round2(e.valorAntes - e.valorDaBaixa)
  const zeraQuantidade = Math.abs(saldoDepois) < 0.005
  const teto = Math.max(PISO, round2(e.qtdDaBaixa * ERRO_POR_UNIDADE))

  if (valorDepois >= -0.01) return { saldoDepois, valorDepois, zeraQuantidade, residuo: valorDepois, teto, decisao: 'OK' }
  if (zeraQuantidade && Math.abs(valorDepois) <= teto) {
    return { saldoDepois, valorDepois, zeraQuantidade, residuo: valorDepois, teto, decisao: 'AJUSTA_RESIDUO' }
  }
  return { saldoDepois, valorDepois, zeraQuantidade, residuo: valorDepois, teto, decisao: 'RECUSA' }
}

/**
 * ⭐ O custo unitário que a baixa deve usar — **precisão cheia**.
 *
 * ⛔ É isto que impede o resíduo de NASCER. `round2(valor/saldo)` é número de TELA; usá-lo
 * pra mover dinheiro no ledger é a mesma classe do `2,3125` do pão (27/08) e do custo por
 * unidade da conclusão de produção (21/08), que já morderam.
 *
 * ═══ ⛔⛔⛔ SALDO ≤ 0 SAI PELO CUSTO VIGENTE (15/10/2026) ═══
 *
 * **O furo, achado na conferência de 14/10:** este ramo devolvia **0**, e com isso a venda
 * de um item negativado entrava no ledger com **quantidade e R$ 0,00 de custo**. Medido em
 * prod: **293 movimentos a custo zero** (2.589,817 un · BAIXA_VENDA 249 + SEPARACAO_SAIDA
 * 44), crescendo ~16/dia. **Efeito: CMV menor que a verdade e lucro parecendo maior que é**
 * — e ninguém desconfia, porque o número sai plausível.
 *
 * ⭐⭐ **A LEI DO saldo ≤ 0 TEM UM DONO SÓ, E ELE JÁ EXISTIA:** `custoMedioComMemoria`
 * (13/10). Este leitor **DELEGA** o ramo negativo a ela em vez de reimplementar *"quanto
 * vale a memória"* — se reimplementasse, seriam **duas réguas pra mesma pergunta**, e elas
 * divergiriam no primeiro caso de borda (memória ≤ 0, memória ausente). É a doença que esta
 * casa mais paga. O que continua morando AQUI é a **precisão cheia** do ramo positivo.
 *
 * ⚠️ **O `vigente` é parâmetro OBRIGATÓRIO, nunca opcional com default `null`:** um default
 * faria o chamador que esquecesse de passá-lo receber **0 em silêncio** — exatamente o furo
 * que este sprint fecha, voltando invisível. Obrigatório, o `tsc` acha todos os chamadores
 * (REGRA 4 de graça) e esquecer **não compila**.
 *
 * ⛔ **Item sem vigente continua 0, honesto como hoje.** São os 15 "a definir" medidos em
 * prod: nunca tiveram entrada com valor, então não existe preço conhecido nem pra estimar.
 * **Número inventado NUNCA** — num item assim, um custo chutado entra no CMV *saindo
 * plausível*, que é o pior tipo de erro (a lição da FANTA UVA).
 *
 * ⚠️ **E a SEPARAÇÃO já obedece a MESMA lei, por outro leitor — medido, não suposto:**
 * `confirmarSeparacao` usa `custoMedioPorItem`, que desce pra `saldosDaEmpresa → montar →
 * custoMedioComMemoria`. Os dois tipos passam pela mesma lei; o que difere é a PRECISÃO, de
 * propósito — o quarteto da produção (separação · consumo · devolução · geração) usa todo
 * ele o MESMO custo arredondado, e é isso que faz o valor do armazém virtual **zerar**
 * quando a ordem fecha. Trocar só a separação pra precisão cheia deixaria centavos presos no
 * em-produção, e os invariantes P1/P4 são de QUANTIDADE — não acusariam.
 */
export function custoParaBaixar(valorAtual: number, saldoAtual: number, vigente: number | null): number {
  if (saldoAtual > 0) return valorAtual / saldoAtual
  return custoMedioComMemoria(saldoAtual, valorAtual, vigente) ?? 0
}
