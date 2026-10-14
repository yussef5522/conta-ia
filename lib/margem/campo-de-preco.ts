/**
 * ⛔⛔⛔ O CAMPO DE PREÇO — *"quando vou troca numero eu excluir ele volta na hora mesmo numero"*
 * (dor do dono, 14/10/2026).
 *
 * **A CAUSA, exata, no cartão de produto:**
 * ```tsx
 * valor={precoTxt !== '' ? precoTxt : p.preco.toFixed(2).replace('.', ',')}
 * ```
 * Apagar tudo deixa `precoTxt === ''` → o ternário cai no fallback → **a média do PDV volta no
 * mesmo teclado**. Não dava pra digitar um preço que começasse com outro dígito: o campo
 * reescrevia o texto no meio da digitação.
 *
 * ⭐⭐ **A CURA É DISTINGUIR DOIS ESTADOS QUE ERAM UM SÓ:** `null` = *"o dono nunca tocou"*
 * (aí a média do PDV é um bom palpite inicial) e `''` = *"o dono APAGOU"* (aí o vazio é a
 * resposta dele, e repor é desfazer o gesto). Com os dois colapsados em `''`, **qualquer**
 * fallback vira reposição — não existe jeito de consertar sem separá-los.
 *
 * ⚠️ **E A RÉGUA MORA NUMA LIB PURA, não num `useState`:** o projeto roda em
 * `environment: node`, sem jsdom — regra dentro de componente é regra que ninguém prova, e foi
 * exatamente assim que o prefill do cardápio quebrou DUAS vezes (28/08) antes de virar função.
 * Aqui dá pra escrever a digitação real (apagar tudo · `"7"` · `"78,"` · vazio + blur) e travar.
 *
 * ⛔ **ZERO ESCRITA, como todo o cartão:** o preço é simulação. Este arquivo não conhece
 * `prisma` nem `react`.
 */
import { sanitizarDinheiro, valorDinheiro } from '@/lib/format/money-input'

/**
 * O que o dono digitou. ⚠️ **`null` e `''` são coisas DIFERENTES** e é nisso que o conserto
 * se apoia: `null` = nunca tocou · `''` = apagou de propósito.
 */
export type TextoDoCampo = string | null

/** ⭐ nasce "não tocado" — e é a única forma de o campo aceitar a média como palpite inicial */
export const CAMPO_INTOCADO: TextoDoCampo = null

/**
 * ⭐ O TEXTO QUE O INPUT MOSTRA.
 *
 * ⛔⛔ **Enquanto o dono digita, ele é o DONO do texto: nada reformata e nada repõe.** O que
 * sai daqui é o que entrou (`'78,'` continua `'78,'` — a vírgula pendurada é estado
 * intermediário legítimo, e foi um `value` numérico que a destruía no campo de quantidade em
 * 08/09). A média só aparece no estado `null`.
 */
export function textoDoCampo(txt: TextoDoCampo, media: number | null): string {
  if (txt !== null) return txt
  return media == null ? '' : media.toFixed(2).replace('.', ',')
}

/**
 * ⭐ O NÚMERO QUE A CONTA USA.
 *
 * ⛔ **Campo apagado ou ilegível → `null`, e a tela diz "—"/"a apurar": NUNCA cai de volta na
 * média.** Cair na média faria a tela mostrar o veredito de um preço que o dono acabou de
 * apagar — ele leria como "o sistema ignorou o que eu fiz". Ausência não é zero nem é o
 * valor anterior (a mesma régua do *"sem contagem"* do estoque).
 */
export function precoDoCampo(txt: TextoDoCampo, media: number | null): number | null {
  if (txt === null) return media
  return valorDinheiro(txt)
}

/**
 * ⭐ O "↺ VOLTAR PRA MÉDIA" — aparece **só quando o valor difere da média** (ou está vazio) e
 * some quando volta a ser ela.
 *
 * ⚠️ É o gesto EXPLÍCITO que substitui a reposição automática: a tela deixou de repor sozinha,
 * então precisa existir um caminho de volta — senão tirar o automatismo viraria um beco (*"e
 * agora, como eu volto pro número real?"*). ⛔ Sem média não há pra onde voltar, e o link não
 * aparece — botão que não faz nada é ruído.
 */
export function mostrarVoltarParaMedia(txt: TextoDoCampo, media: number | null): boolean {
  if (media == null) return false
  if (txt === null) return false
  const n = valorDinheiro(txt)
  if (n == null) return true // apagado ou ilegível: o caminho de volta tem que existir
  return Math.abs(n - media) > 0.005
}

/**
 * ⭐ O QUE O `onChange` GRAVA — texto sanitizado pela régua de DINHEIRO.
 *
 * ⛔⛔ **E NÃO É O `sanitizarQtd` DO ESTOQUE, que era o que estava ali.** Aquele responde
 * *"quanto deste ITEM?"* — a precisão vem da UNIDADE (6 casas em KG pra dose de fermento) e
 * ele RECUSA fração em UN. Dinheiro é sempre 2 casas, e o ponto é MILHAR: no `sanitizarQtd`
 * em modo KG, `1.500` vira **1,5** — o dono digitando mil e quinhentos levaria um e meio.
 * A régua de dinheiro já tem dono desde 09/10 (REGRA 4); o cartão só não a conhecia.
 */
export function digitar(texto: string): TextoDoCampo {
  return sanitizarDinheiro(texto)
}
