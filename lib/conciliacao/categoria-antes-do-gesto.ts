// ⭐⭐⭐ CATEGORIA ANTES DO GESTO — a régua do dono (20/09/2026).
//
// **A decisão:** *"escolher categoria é OBRIGATÓRIO ANTES de resolver a linha — os gestos da
// direita ficam com aviso «escolha a categoria primeiro →» enquanto vazio."*
//
// ⛔⛔ **MAS NEM TODO GESTO PEDE ESCOLHA, e essa é a metade que faz a régua funcionar.**
// Exigir categoria de um pagamento de fatura seria **cobrar duas vezes pelo mesmo fato**: a
// despesa são as compras da fatura, já categorizadas; o pagamento é quitação. Foi por isso
// que o Fluxo de Caixa criou os **rótulos estruturais** em 26/08 (`[sistema]`) em vez de
// mandar o dono classificar fatura e parcela na mão.
//
// ⭐ Então a pergunta certa não é *"tem categoria?"* — é ***"de onde vem a categoria desta
// linha?"***, e ela tem três respostas:
//
//   **ESCOLHER** — é despesa/receita avulsa: quem diz é o dono, no seletor da esquerda.
//   **ESTRUTURAL** — fatura, parcela, transferência, ignorar: o próprio gesto é a natureza.
//   **HERDA_DA_CONTA** — casar: a conta a pagar já tem a dela, e a linha herda no reconcile
//                       (e quando a conta NÃO tem, o servidor **pergunta** — a régua de hoje
//                       de manhã, `PEDE_CATEGORIA`).
//
// ⚠️ A lista é FECHADA por construção (o `switch` é exaustivo no tipo): ação nova entra aqui
// ou **não compila** — é a mesma disciplina do menu por sentido.

import type { AcaoDoBalcao } from './caixa-de-entrada'

export type OrigemDaCategoria = 'ESCOLHER' | 'ESTRUTURAL' | 'HERDA_DA_CONTA'

/** ⭐ de onde vem a categoria da linha, por gesto */
export function origemDaCategoria(acao: AcaoDoBalcao): OrigemDaCategoria {
  switch (acao) {
    // ── o dono escolhe: são os gestos cuja NATUREZA é a categoria ──
    case 'CATEGORIA':
    case 'RECEBIMENTO_VENDA':
    case 'ESTORNO':
      return 'ESCOLHER'
    // ── a conta casada manda ──
    case 'CASAR_PAGAR':
    case 'CASAR_RECEBER':
      return 'HERDA_DA_CONTA'
    /**
     * ── estrutural: o gesto JÁ É a classificação ──
     * ⛔ `IGNORAR` entra aqui de propósito: o dono já disse que a linha não é pra cá, e
     * cobrar categoria de algo que ele classificou como nada seria cobrar duas vezes.
     */
    case 'PGTO_CARTAO':
    case 'PARCELA_EMPRESTIMO':
    /**
     * ⭐ 25/09 — o APORTE é ESTRUTURAL: o gesto já diz o que a linha é (dinheiro que virou
     * patrimônio no contrato X). ⛔ Pedir categoria aqui seria cobrar duas vezes pelo mesmo
     * fato — a mesma razão do pagamento de fatura e da parcela de empréstimo.
     */
    case 'APORTE_INVESTIMENTO':
    case 'TRANSFERENCIA_ENVIADA':
    case 'TRANSFERENCIA_RECEBIDA':
    /**
     * ⭐ `AVULSA_CONFIRMADA` é ESTRUTURAL de propósito (25/09): ela só existe **depois** de
     * a linha já ter categoria — o gesto responde *"não tem nota"*, não *"o que é isto"*.
     * Cobrar categoria aqui seria cobrar duas vezes o mesmo fato.
     */
    case 'AVULSA_CONFIRMADA':
    case 'IGNORAR':
      return 'ESTRUTURAL'
  }
}

/**
 * ⭐⭐ O GESTO PODE SER DISPARADO AGORA?
 *
 * ⛔ Só o `ESCOLHER` fica bloqueado sem categoria. *Travar o estrutural transformaria a
 * regra "nada sai sem categoria" numa parede que impede de resolver fatura e parcela — e
 * parede é como o dono aprende a contornar o sistema por fora.*
 */
export function podeDisparar(acao: AcaoDoBalcao, temCategoria: boolean): boolean {
  return origemDaCategoria(acao) !== 'ESCOLHER' || temCategoria
}

/** ⭐ o aviso do chip bloqueado — ele APONTA pro seletor, em vez de só negar */
export const AVISO_CATEGORIA = 'escolha a categoria primeiro →'

/**
 * ⭐ O QUE O SELETOR DA ESQUERDA MOSTRA, dado o palpite da linha.
 *
 * ⚠️ Quando o palpite é CASAR, o seletor **não pede**: ele DIZ de onde a categoria vem, com
 * o nome da conta. *Pedir ali faria o dono classificar uma linha que já vai herdar — e a
 * resposta dele seria descartada pelo backfill do reconcile.*
 */
export interface EstadoDoSeletor {
  modo: 'PEDE' | 'HERDA' | 'ESTRUTURAL'
  /** a frase que a tela imprime (nunca vazia) */
  texto: string
  /** ⭐ quantas CONTAS a resposta vai gravar (o lote grava em N; o 1↔1 em 1) */
  gravaEm?: number
}

/**
 * ⭐⭐⭐ O SELETOR DA LINHA — e o LOTE é CASAR, nunca estrutural (23/09/2026).
 *
 * ⛔⛔ **O BECO que o dono achou navegando:** no lote da MARIA LUIZA o botão exigia
 * categoria (*"Vincular 6 · diga a categoria primeiro"*) e o seletor da esquerda dizia
 * ***"⚙ categoria vem do gesto"*** — ou seja, *"não é comigo"*. **As duas metades se
 * contradiziam e não havia onde responder.**
 *
 * ⚠️ Eram DOIS defeitos somados, e os dois meus:
 *  1. a régua lia a ação do **PALPITE** daquela linha — que ali era *pagamento de fatura*
 *     (ESTRUTURAL). ⭐ Mas quem manda é o **CASO**: lote é **CASAR**, e casar **HERDA**.
 *  2. o seletor que eu tinha construído vivia no `abaixoDoValor` do chassi do próprio
 *     card do lote — e no modo painel (a lista única) **esse chassi não é renderizado**.
 *
 * ⭐ Com as N notas sem categoria, o caso é o **herda-pedindo** — o mesmo da TOZZO
 * (*"a conta casada não tem categoria — escolha"*), só que a resposta grava **nas N**.
 */
export function estadoDoSeletorDoLote(notasSemCategoria: number, total: number): EstadoDoSeletor {
  if (notasSemCategoria === 0) {
    // ⭐ honesto: ele não pede nada, porque as contas já dizem
    return { modo: 'HERDA', texto: 'herda das contas' }
  }
  return {
    modo: 'PEDE',
    texto: notasSemCategoria === total
      ? `as ${total} notas sem categoria — escolha`
      : `${notasSemCategoria} de ${total} notas sem categoria — escolha`,
    gravaEm: notasSemCategoria,
  }
}

export function estadoDoSeletor(
  acaoDoPalpite: AcaoDoBalcao | null,
  categoriaDaConta: string | null,
): EstadoDoSeletor {
  if (!acaoDoPalpite) return { modo: 'PEDE', texto: 'categoria' }
  switch (origemDaCategoria(acaoDoPalpite)) {
    case 'HERDA_DA_CONTA':
      return categoriaDaConta
        ? { modo: 'HERDA', texto: `herda da conta: ${categoriaDaConta}` }
        // ⛔ a conta sem categoria PEDE — é o `PEDE_CATEGORIA` do servidor, dito antes do clique
        : { modo: 'PEDE', texto: 'a conta casada não tem categoria — escolha' }
    case 'ESTRUTURAL':
      return { modo: 'ESTRUTURAL', texto: 'categoria vem do gesto' }
    case 'ESCOLHER':
      return { modo: 'PEDE', texto: 'categoria' }
  }
}
