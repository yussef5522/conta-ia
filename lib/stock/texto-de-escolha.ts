/**
 * ⭐⭐⭐ `'   '` NÃO É UMA ESCOLHA — a régua, com UM dono (14/10/2026).
 *
 * **Ordem do dono (item 3 do sprint do trilho):** *"mesma família do `'   '` (espaço passando por
 * escolha) em 2 campos `stock_`"*.
 *
 * ═══ ⛔⛔ O BURACO QUE ELA FECHA, medido ═══
 *
 * Os dois CHECKs do estoque usam `"coluna" <> ''`, e **`<> ''` só pega a string VAZIA** — `'   '`
 * é `true` nos dois. É a forma fraca que a prova de 14/10 pegou em prod no CHECK do trilho
 * (*"5 de 6 recusados"*), ali consertada por ALTER — caminho que **o estoque não tem** (migration
 * de estoque é CREATE-only, com guard no CI).
 *
 * ⚠️ E as duas portas não são igualmente alcançáveis, o que mudou o desenho:
 *   · `stock_radar_item.lista` → a rota valida com `z.enum(LISTAS)`: `'   '` é **impossível** por
 *     ali. A trava aqui é CINTO, pro caminho que não passa pela rota (script, lib nova) — foi
 *     por um caminho desses que o `IGNORAR` ficou 9 dias morto em 23/09.
 *   · `stock_venda_ignorado.nomeSuitable` → a rota valida com `z.string().min(1)`, e **`'   '`
 *     tem comprimento 3**. ***Ali o buraco é REAL e alcançável pela rota de hoje.***
 *
 * ═══ ⭐⭐ POR QUE UM DONO SÓ ═══
 *
 * A mesma pergunta — *"isto é uma escolha ou é espaço?"* — é feita na PORTA (TypeScript, que dá a
 * frase que ensina) e no TRIGGER (SQL, que é a camada 1). Duas definições divergiriam no primeiro
 * caractere novo (NBSP, zero-width space) e o dono levaria um **500 sem corpo** no lugar da
 * recusa que explica. O TS é o dono do TEXTO; o trigger é o espelho, e o comentário dele diz isso.
 *
 * ⛔⛔ **E O `trim()` DO JS NÃO É O `trim()` DO POSTGRES — isto está declarado, não escondido.**
 * O `trim()` do JS come todo espaço Unicode (NBSP, zero-width); o `trim()` do SQL come só espaço
 * ASCII. Então a PORTA é mais estrita que o trigger, e **isso é a direção segura**: o que a porta
 * recusa nunca chega ao banco, e o que escapar pela porta (um caminho que não passe por aqui)
 * ainda bate no trigger. O inverso — banco mais estrito que a porta — é que produz o 500 mudo.
 */

/** ⚠️ erro próprio pra a rota traduzir em 422 com a frase, nunca um 500 genérico */
export class EscolhaVaziaError extends Error {}

/**
 * ⭐ `true` quando o texto é uma escolha de verdade (tem conteúdo depois de aparar).
 *
 * ⚠️ Aceita `unknown` de propósito: o valor chega de corpo de requisição e de arquivo do PDV, e
 * tipar `string` aqui faria o chamador fazer o cast — que é exatamente onde o lixo entra calado
 * (a cicatriz do `as never` de 19/09).
 */
export function ehEscolha(bruto: unknown): boolean {
  return typeof bruto === 'string' && bruto.trim().length > 0
}

/**
 * ⭐⭐ RECUSA COM A FRASE QUE ENSINA, ou devolve o texto **como veio**.
 *
 * ⛔⛔ **ELA NÃO APARA — e isso é decisão, não esquecimento.** O `nomeSuitable` é a CHAVE do mapa
 * de venda e tem que casar **exatamente** com o nome que o relatório do PDV escreve; aparar aqui
 * faria a gravação guardar um nome que o arquivo não tem, e a baixa deixaria de achar o produto.
 * *O nome cru continua gravado como veio* — a mesma disciplina do resto do módulo.
 */
export function exigirEscolha(bruto: unknown, oQue: string): string {
  if (!ehEscolha(bruto)) {
    throw new EscolhaVaziaError(
      `${oQue} não pode ser vazio nem só espaço — espaço em branco não é uma escolha, ` +
        'e uma linha dessas não casa com nada depois.',
    )
  }
  return bruto as string
}
