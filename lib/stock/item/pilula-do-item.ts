/**
 * ⭐⭐ A PÍLULA DE STATUS DO ITEM (06/10/2026) — a régua dos líderes, num lugar só.
 *
 * **Ordem do dono:** *"PÍLULA DE STATUS (régua dos líderes): em estoque (verde) · abaixo do
 * mínimo (âmbar) · NEGATIVO (vermelho) · zerado (cinza) · parado >30d sem movimento (cinza)"*.
 *
 * ⛔⛔ **ELA NÃO É UMA 2ª RÉGUA DE MÍN/MÁX — ela CONSOME o `statusEstoque`.** Quem responde
 * *"está abaixo do mínimo?"* continua sendo a função única que a Posição, o CSV e o juiz leem;
 * aqui só se acrescenta o que ela **não tem como saber** (o item estar negativo, zerado, ou
 * parado há mais de 30 dias). Uma comparação `saldo < min` escrita aqui seria a segunda
 * resposta pra mesma pergunta — a doença que este módulo mais paga.
 *
 * ⚠️⚠️ **E HÁ UMA DIVERGÊNCIA DE TOM, DELIBERADA E REGISTRADA:** o `statusEstoque` pinta
 * *abaixo do mínimo* de **VERMELHO** (é o alarme dele, na barra da Posição). Aqui ele sai
 * **ÂMBAR**, porque nesta tela o **vermelho é do NEGATIVO** — e dois vermelhos competindo na
 * mesma dobra fazem o dono deixar de distinguir *"preciso comprar"* de *"o dado está
 * impossível"*. ⛔ O **status** (a decisão) é o mesmo nos dois lugares; o que muda é a tinta.
 *
 * ⚠️ `ACIMA do máximo` não ganha pílula própria (o dono nomeou 5 estados). Não se perde nada:
 * a **faixa mín/máx** logo abaixo já pinta isso, e inventar um 6º estado aqui seria régua que
 * ninguém pediu.
 */
import { statusEstoque } from '../status-estoque'

export type EstadoDoItem = 'NEGATIVO' | 'ZERADO' | 'ABAIXO_DO_MINIMO' | 'PARADO' | 'EM_ESTOQUE'
export type TomDaPilula = 'vermelho' | 'ambar' | 'cinza' | 'verde'

export interface PilulaDoItem {
  estado: EstadoDoItem
  tom: TomDaPilula
  label: string
  /** ⭐ a pílula DIZ por que ela está acesa — rótulo sem o porquê é enfeite */
  porque: string | null
}

/** ⭐ o item é "parado" a partir daqui — e o número mora num lugar só */
export const DIAS_PARA_PARADO = 30

export interface EstadoParaPilula {
  saldo: number
  estoqueMin: number | null | undefined
  estoqueMax: number | null | undefined
  /** dias desde o último movimento; `null` quando o item nunca se moveu */
  diasSemMovimento: number | null
}

/**
 * ⭐ A ORDEM DE PRECEDÊNCIA É A DA AÇÃO, não a do alfabeto:
 * **negativo** (o dado está impossível e contar resolve) → **zerado** (não tem, é fato) →
 * **abaixo do mínimo** (precisa comprar) → **parado** (informação) → **em estoque**.
 *
 * ⚠️ Zerado ganha de parado de propósito: *"não tem"* é mais acionável que *"não se move"*, e
 * um item zerado está parado quase por construção — dizer "parado" ali esconderia o fato.
 */
export function pilulaDoItem(e: EstadoParaPilula): PilulaDoItem {
  if (e.saldo < 0) {
    return {
      estado: 'NEGATIVO', tom: 'vermelho', label: 'negativo',
      // ⭐ a saída vem junto: é a lei de 05/10 ("a contagem é a âncora")
      porque: 'saiu mais do que entrou — contar resolve, a contagem é a âncora',
    }
  }
  if (e.saldo === 0) {
    return { estado: 'ZERADO', tom: 'cinza', label: 'zerado', porque: 'não tem nada na prateleira' }
  }

  /** ⛔ a pergunta do mínimo tem UM dono — não se escreve `saldo < min` aqui */
  const st = statusEstoque(e.saldo, e.estoqueMin, e.estoqueMax)
  if (st.status === 'ABAIXO') {
    return { estado: 'ABAIXO_DO_MINIMO', tom: 'ambar', label: 'abaixo do mínimo', porque: st.label }
  }

  if (e.diasSemMovimento != null && e.diasSemMovimento > DIAS_PARA_PARADO) {
    return {
      estado: 'PARADO', tom: 'cinza', label: `parado há ${e.diasSemMovimento} dias`,
      porque: 'nada entrou nem saiu — confira se ainda se usa',
    }
  }
  return { estado: 'EM_ESTOQUE', tom: 'verde', label: 'em estoque', porque: null }
}
