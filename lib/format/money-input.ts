/**
 * ⭐⭐ DIGITAR DINHEIRO — o que se DIGITA é TEXTO; o número é DERIVADO (09/10/2026).
 *
 * ⛔⛔ **A armadilha que isto existe pra matar é a mesma do campo de quantidade (08/09):** um
 * `value={numero}` com conversão no `onChange` **destrói o estado intermediário** — no instante
 * em que a vírgula é digitada, `"40000,"` vira o número `40000` e **a vírgula some da tela**.
 * Só inteiro passa, e não por regra: por efeito colateral.
 *
 * ⚠️ **E O PONTO É MILHAR, NÃO DECIMAL.** `40.000` em pt-BR são quarenta mil, não quarenta. Num
 * campo de devolução de mútuo, ler isso como R$ 40,00 seria errar por mil vezes — e o dono
 * digita exatamente assim.
 *
 * ⛔ **POR QUE NÃO REUSAR `sanitizarQtd` do estoque:** ele responde a pergunta *"quanto deste
 * ITEM?"*, e ali a precisão vem da UNIDADE (6 casas em KG pra dose de fermento; **fração
 * recusada em UN**). Dinheiro é sempre fracionável e sempre 2 casas — reusar aquele deixaria
 * `40.000,123456` entrar como valor. *Duas perguntas diferentes, duas réguas.*
 */

/** ⚠️ 2 casas, sempre: centavo é o menor que dinheiro tem */
export const CASAS_DE_DINHEIRO = 2

/**
 * Sanitiza o texto EM DIGITAÇÃO, preservando os estados intermediários (`"40"` → `"40,"` →
 * `"40,0"` → `"40,05"`) — que é justamente o que um `value` numérico destrói.
 */
export function sanitizarDinheiro(texto: string): string {
  const bruto = (texto ?? '').replace(/[^\d.,]/g, '')
  if (!bruto) return ''

  // ⭐ o separador DECIMAL é o ÚLTIMO `,` ou `.`; tudo antes dele é milhar e se descarta.
  const ultimaVirgula = bruto.lastIndexOf(',')
  const ultimoPonto = bruto.lastIndexOf('.')
  const i = Math.max(ultimaVirgula, ultimoPonto)

  /**
   * ⚠️ PONTO SEGUIDO DE 3 DÍGITOS É MILHAR, NUNCA DECIMAL — `40.000` são quarenta mil.
   * ⛔ E a regra vale só pro PONTO: quem digita `40,000` quis três casas e vai levar duas
   * (dinheiro não tem a terceira), mas a intenção dele era decimal, não milhar.
   */
  const pontoEhMilhar = i >= 0 && bruto[i] === '.' && /^\d{3}$/.test(bruto.slice(i + 1))
  if (i < 0 || pontoEhMilhar) return bruto.replace(/[.,]/g, '')

  const inteiros = bruto.slice(0, i).replace(/[.,]/g, '')
  const decimais = bruto.slice(i + 1).replace(/[.,]/g, '').slice(0, CASAS_DE_DINHEIRO)
  return `${inteiros},${decimais}`
}

/**
 * O número por trás do texto. ⛔ **Vazio devolve `null`, NUNCA 0** — ausência não é zero (a
 * mesma régua do *"sem contagem"* do estoque e do *"a apurar"* das telas de dinheiro).
 */
export function valorDinheiro(texto: string): number | null {
  const s = sanitizarDinheiro(texto).replace(',', '.')
  if (!s || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
