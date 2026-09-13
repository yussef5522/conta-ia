// ⭐⭐⭐ LANÇAR POR FRASE (13/09/2026) — estilo "Meu Assessor".
//
// **O dono:** *"digito 'mercado 280,50' ou 'gastei 45 na farmácia' ou 'recebi 500 pix' → o
// sistema monta o lançamento (…) confiro num preview de 1 tela e salvo. Frase que não
// parseia = formulário normal preenchido com o que deu (**nunca trava, NUNCA inventa
// valor**)."*
//
// ⛔⛔ **A REGRA QUE SEGURA TUDO: SEM VALOR, SEM LANÇAMENTO.** Descrição a gente deduz,
// sentido a gente deduz, categoria é sugestão — **valor, não**. Um lançamento com valor
// chutado é dinheiro errado no extrato dele, e o erro só aparece no fim do mês.
//
// ⚠️ E isto aqui é PARSE, não IA: a categoria vem depois, do pipeline aprendido da casa.
// Misturar as duas coisas faria "não entendi a frase" e "não sei a categoria" virarem o
// mesmo silêncio.

/** ⭐ as palavras que dizem o SENTIDO — listas fechadas, em pt-BR do dia a dia */
const ENTRADA = ['recebi', 'recebido', 'entrou', 'ganhei', 'salario', 'salário', 'caiu', 'deposito', 'depósito', 'pix recebido', 'rendimento', 'reembolso']
const SAIDA = ['gastei', 'paguei', 'comprei', 'saiu', 'gasto', 'pagamento', 'compra', 'debitado']

/** ⚠️ ruído que não é descrição — tirar deixa "gastei 45 na farmácia" virar "farmácia" */
const RUIDO = new Set([...ENTRADA, ...SAIDA, 'de', 'do', 'da', 'no', 'na', 'em', 'com', 'pra', 'para', 'por', 'r$', 'rs', 'reais', 'real', 'o', 'a', 'um', 'uma', 'hoje', 'ontem'])

export interface FraseLida {
  /** ⛔ `null` quando a frase não traz valor — e aí NÃO há lançamento, só o formulário */
  valor: number | null
  descricao: string
  /** 'SAIDA' é o default do dia a dia; só vira ENTRADA com palavra explícita */
  sentido: 'ENTRADA' | 'SAIDA'
  /** ⚠️ o que a tela DIZ quando não deu pra montar — nunca um silêncio */
  porQue: string | null
  /** `true` quando dá pra pré-montar o lançamento; `false` = formulário com o que deu */
  montou: boolean
}

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * ⭐⭐ Acha o VALOR na frase. Puro.
 *
 * ⚠️ Aceita `280,50` · `280.50` · `1.280,50` · `45` · `R$ 45`. **A vírgula manda**: em
 * pt-BR `1.280,50` tem ponto de milhar, e ler o ponto como decimal viraria R$ 1,28 — a
 * mesma armadilha que o campo de quantidade do estoque pagou em 08/09.
 */
export function acharValor(texto: string): number | null {
  // pega o último número "grande" da frase (o primeiro costuma ser parte do nome: "posto 24h")
  const achados = [...texto.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/gi)]
  if (!achados.length) return null
  for (let i = achados.length - 1; i >= 0; i--) {
    const cru = achados[i][1]
    const n = cru.includes(',')
      ? Number(cru.replace(/\./g, '').replace(',', '.'))   // pt-BR: ponto é milhar
      : cru.includes('.') && /\.\d{3}(?!\d)/.test(cru)
        ? Number(cru.replace(/\./g, ''))                    // 1.280 = mil duzentos e oitenta
        : Number(cru)
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  return null
}

/** ⭐ o sentido: SAÍDA por default, ENTRADA só com palavra que diz isso */
export function acharSentido(texto: string): 'ENTRADA' | 'SAIDA' {
  const t = semAcento(texto)
  if (ENTRADA.some((p) => t.includes(semAcento(p)))) return 'ENTRADA'
  return 'SAIDA'
}

/** ⭐ a descrição = o que sobra depois de tirar valor, moeda e as palavras de ligação */
export function acharDescricao(texto: string): string {
  const palavras = texto
    .replace(/(?:r\$\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|(?:r\$\s*)?\d+(?:[.,]\d{1,2})?/gi, ' ')
    .split(/\s+/)
    .filter((p) => p && !RUIDO.has(semAcento(p)))
  if (!palavras.length) return ''
  // ⚠️ a primeira letra em maiúscula e o resto como o dono escreveu — o texto é DELE
  const d = palavras.join(' ').trim()
  return d.charAt(0).toUpperCase() + d.slice(1)
}

export function lerFrase(texto: string): FraseLida {
  const limpo = texto.trim()
  if (!limpo) return { valor: null, descricao: '', sentido: 'SAIDA', montou: false, porQue: 'escreva alguma coisa, tipo "mercado 280,50"' }

  const valor = acharValor(limpo)
  const descricao = acharDescricao(limpo)
  const sentido = acharSentido(limpo)

  if (valor == null) {
    // ⛔ NUNCA INVENTA VALOR — o formulário abre com o que deu pra ler
    return { valor: null, descricao, sentido, montou: false, porQue: 'não achei o valor — completa aí embaixo' }
  }
  if (!descricao) {
    // ⚠️ valor sem descrição ainda MONTA: o dono escreveu "45" e sabe o que é; a descrição
    // ele completa no preview. Travar aqui seria cobrar formalidade de quem tem pressa.
    return { valor, descricao: '', sentido, montou: true, porQue: 'não entendi a descrição — escreve aí' }
  }
  return { valor, descricao, sentido, montou: true, porQue: null }
}
