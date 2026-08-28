// ESTOQUE — DIGITAÇÃO DE QUANTIDADE (28/08). Puro, testável, um lugar só.
//
// ⚠️ O BUG QUE PEDIU ISTO: no modal da receita o campo de quantidade era
// `value={numero}` + `onChange={parse}`. Digitar "0,050" é IMPOSSÍVEL assim: no instante em
// que o dono digita a vírgula, o texto "0," vira o número 0 e a vírgula **some da tela**. Só
// dava pra escrever inteiro (1, 5, 10) — e receita de lanche é feita de FRAÇÃO de quilo
// (50 g de acém, 80 g de queijo). O modal ficava inútil pro caso principal.
//
// ⭐ A CURA É ESTRUTURAL: o que o dono DIGITA é TEXTO e fica texto enquanto ele digita. O
// número é DERIVADO. Estados intermediários ("0", "0,", "0,0") são legítimos e precisam
// sobreviver — é isso que um `value` numérico não permite.
//
// REGRAS por unidade:
//   KG/LT → até 3 casas (grama / mililitro é o menor que a cozinha usa)
//   UN    → INTEIRO. Não existe 0,5 pão. Se um dia existir meio pão, o item vira uma
//           unidade menor (é o mesmo princípio da reunitização pacote → unidade).

const MAX_CASAS = 3

export type UnidadeQtd = 'KG' | 'LT' | 'UN' | string

/** Unidade fracionável? KG e LT sim; UN e qualquer outra, não. */
export function aceitaFracao(unidade: UnidadeQtd): boolean {
  const u = (unidade ?? '').trim().toUpperCase()
  return u === 'KG' || u === 'LT'
}

/**
 * Limpa a DIGITAÇÃO preservando estados intermediários ("0," continua "0,").
 * Aceita vírgula (padrão BR) e ponto — o dono digita como quiser.
 */
export function sanitizarQtd(texto: string, unidade: UnidadeQtd): string {
  const bruto = (texto ?? '').replace(/[^\d.,]/g, '')
  if (!aceitaFracao(unidade)) return bruto.replace(/[.,].*$/, '') // UN: corta no separador

  // um separador só — o primeiro que aparecer manda; e vira vírgula (padrão BR na tela)
  const i = bruto.search(/[.,]/)
  if (i < 0) return bruto
  const inteiro = bruto.slice(0, i)
  const decimais = bruto.slice(i + 1).replace(/[.,]/g, '').slice(0, MAX_CASAS)
  return `${inteiro},${decimais}`
}

/** Texto → número. "0,050" → 0.05 · "" e lixo → null (NUNCA 0: vazio não é zero). */
export function valorQtd(texto: string): number | null {
  const t = (texto ?? '').trim().replace(',', '.')
  if (t === '' || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Número → texto do campo, em pt-BR. 0.05 → "0,05". */
export function textoQtd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return String(n).replace('.', ',')
}

/**
 * ⭐ CONFIRMAÇÃO VISUAL — "0,050 KG = 50 g". Existe pra o dono não errar UM ZERO: 0,05 e
 * 0,005 são visualmente parecidos e 10× diferentes no custo. Só faz sentido abaixo de 1
 * (acima disso "1,5 KG" já se lê sozinho).
 */
export function descreverQtd(valor: number | null, unidade: UnidadeQtd): string | null {
  if (valor == null || valor <= 0 || valor >= 1) return null
  const u = (unidade ?? '').trim().toUpperCase()
  if (u === 'KG') return `${arredonda(valor * 1000)} g`
  if (u === 'LT') return `${arredonda(valor * 1000)} ml`
  return null
}

function arredonda(n: number): string {
  const r = Math.round(n * 100) / 100
  return String(r).replace('.', ',')
}

/** Validação na hora de salvar: devolve o erro em pt-BR, ou null se está bom. */
export function validarQtd(texto: string, unidade: UnidadeQtd, nomeItem: string): string | null {
  const v = valorQtd(texto)
  if (v == null || v <= 0) return `Informe a quantidade de "${nomeItem}" (maior que zero).`
  if (!aceitaFracao(unidade) && !Number.isInteger(v)) {
    return `"${nomeItem}" é contado em ${unidade} — não dá pra usar fração. Se você usa meia unidade, o item precisa ser cadastrado numa unidade menor.`
  }
  return null
}
