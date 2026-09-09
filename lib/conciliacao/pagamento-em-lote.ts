// ⭐⭐⭐ UM PIX PAGA N NOTAS (09/09/2026) — o "one payment covers several bills".
//
// **O dono:** *"~30 contas VENCIDAS não apareceram na conciliação, e os pagamentos EXISTEM
// no extrato. O padrão delas: fornecedor pequeno com VÁRIAS notinhas (Odissea ×12, Alan ×7,
// Ivan ×3…) — eu pago JUNTO, num PIX só. Aposto que o matcher só casa 1-pra-1."*
//
// **Ele estava certo.** O `sugerirVinculos` compara UMA linha com UMA conta: o PIX
// consolidado não bate com nota nenhuma individualmente, então nem a linha nem as notas
// aparecem na tela. Medido em prod (09/09): **2 pagamentos em lote reais** de 08/09 na
// Stone, cobrindo **9 das 31 contas vencidas**.
//
// ⛔⛔⛔ **A TRAVA MAIS IMPORTANTE DESTE ARQUIVO, e ela veio de um erro meu medido:**
// **subset-sum SEM âncora de fornecedor é caça-níquel.** A primeira versão da investigação
// procurava "existe soma de N notas que dê o valor da linha?" e casou a ODISSEA com uma
// linha *"YUSSEF ABU ZAHRY MUSA · Distribuição de Lucros"* de R$ 500,00 — porque com 6
// notinhas pequenas **quase qualquer alvo é alcançável**. Medido depois, com os números
// reais: nas listas do Alan e da Odissea, **9% de valores ALEATÓRIOS na faixa também
// fechariam**. Uma soma que fecha não é prova de nada sozinha.
//
// ⭐ POR ISSO SÃO **TRÊS** ÂNCORAS, e nenhuma é opcional:
//   1. **A LINHA NOMEIA O FORNECEDOR** (FK, ou o nome reconhecido pela régua da casa) —
//      quem resolve isso é o chamador, e sem fornecedor resolvido este motor não roda.
//   2. **JANELA DE VENCIMENTO** em volta da data do pagamento — ninguém paga hoje uma nota
//      que vence em três meses.
//   3. **COMBINAÇÃO ÚNICA** — se DUAS combinações diferentes fecham no mesmo valor, o
//      sistema **não sabe qual foi** e não sugere. Escolher uma seria a régua decidindo
//      quais notas o dono pagou, que é exatamente o que ele nunca pediu.
//
// ⛔ E o motor **não grava nada**: devolve a lista com o motivo escrito. O dono confirma
// com as notas à vista e pode desmarcar — igual ao Find & Match do Xero.

export interface NotaAberta {
  id: string
  descricao: string
  /** sempre positivo */
  valor: number
  vencimento: Date
  fornecedorId: string
}

export interface LinhaParaLote {
  id: string
  descricao: string
  /** sempre positivo */
  valor: number
  data: Date
  tipo: 'CREDIT' | 'DEBIT'
  /** ⛔ o fornecedor JÁ RESOLVIDO (FK ou nome reconhecido). Sem ele, não há lote. */
  fornecedorId: string | null
  contaBancariaId: string | null
  /** o nome da conta bancária, só pra tela */
  contaBancaria?: string | null
}

export interface SugestaoDeLote {
  extratoId: string
  fornecedorId: string
  fornecedorNome: string
  notas: NotaAberta[]
  soma: number
  valorDaLinha: number
  /** linha − soma. Positivo = pagou mais (juros/tarifa de boleto). */
  diferenca: number
  /** ⛔ a frase obrigatória — sugestão sem motivo não existe nesta casa */
  porQue: string
  /** quantas notas abertas o fornecedor tem no total (contexto pro dono) */
  abertasDoFornecedor: number
}

/**
 * ⭐ O CASO IVAN / MARIA LUIZA / OESA — medido em prod: a linha **nomeia** o fornecedor,
 * ele **tem** várias notas abertas, e **nenhuma combinação fecha**.
 *
 * ⚠️ Isso não é "nada a ver": quase sempre é pagamento que cobre uma nota que não está no
 * sistema, ou pagamento parcial. Sumir com essa linha é o "erro disfarçado de vazio" que a
 * casa já pagou caro — ela aparece dizendo o que é, e o gesto oferecido é a escolha na mão.
 */
export interface LoteQueNaoFecha {
  extratoId: string
  descricao: string
  valorDaLinha: number
  data: Date
  contaBancaria: string | null
  fornecedorId: string
  fornecedorNome: string
  abertasDoFornecedor: number
  somaDasAbertas: number
  motivo: 'NAO_FECHA' | 'AMBIGUO'
  /** quantas combinações fecham, quando o motivo é AMBIGUO */
  combinacoes: number
}

/** o mínimo pra ser "lote" — 1 nota é o caminho 1:1, que já existe */
export const MIN_NOTAS_NO_LOTE = 2
/** ⚠️ teto de segurança: acima disso a busca explode e a soma perde significado */
export const MAX_NOTAS_NO_LOTE = 15
/** dois centavos — a mesma tolerância do endpoint que grava o N:1 */
export const TOLERANCIA_LOTE = 0.02
/** quantos dias antes do pagamento uma nota ainda pode ter vencido */
export const DIAS_ANTES = 45
/** e quantos depois — pagar adiantado é comum; três meses depois, não */
export const DIAS_DEPOIS = 15

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐⭐ TODAS as combinações que fecham no alvo — para na SEGUNDA.
 *
 * ⛔ Parar na segunda não é economia: **duas combinações que fecham é a resposta
 * "não sei"**, e a única coisa que o chamador precisa saber é se existe mais de uma.
 * Contar todas seria gastar tempo pra saber melhor um "não sei".
 */
export function combinacoesQueFecham(
  valores: number[], alvo: number, tolerancia = TOLERANCIA_LOTE,
): number[][] {
  // ⚠️ do maior pro menor: poda muito mais cedo (o resto fica negativo antes)
  const ordem = valores.map((_, i) => i).sort((a, b) => valores[b] - valores[a])
  const achados: number[][] = []
  const busca = (pos: number, resta: number, atual: number[]) => {
    if (achados.length >= 2) return
    if (Math.abs(resta) <= tolerancia && atual.length >= MIN_NOTAS_NO_LOTE) {
      achados.push([...atual]); return
    }
    if (pos >= ordem.length || resta < -tolerancia || atual.length >= MAX_NOTAS_NO_LOTE) return
    const i = ordem[pos]
    if (valores[i] <= resta + tolerancia) busca(pos + 1, resta - valores[i], [...atual, i])
    busca(pos + 1, resta, atual)
  }
  busca(0, alvo, [])
  return achados
}

export interface EntradaDeLote {
  linhas: LinhaParaLote[]
  /** as contas em aberto, COM fornecedor — sem fornecedor não há âncora */
  notas: NotaAberta[]
  /** id → nome, só pra escrever a frase */
  nomeDoFornecedor: (id: string) => string
  diasAntes?: number
  diasDepois?: number
}

export interface ResultadoDeLote {
  lotes: SugestaoDeLote[]
  naoFecham: LoteQueNaoFecha[]
}

/**
 * ⭐ O MOTOR. Puro: recebe as linhas com o fornecedor JÁ resolvido e devolve o que fecha.
 *
 * ⚠️ Uma linha entra em NO MÁXIMO um lote (a primeira combinação única que fechar), e uma
 * nota pode aparecer em lotes de linhas diferentes — quem decide é o dono, e esconder a
 * segunda opção seria a régua escolhendo por ele. A tela avisa quando há disputa.
 */
export function sugerirPagamentosEmLote(entrada: EntradaDeLote): ResultadoDeLote {
  const antes = (entrada.diasAntes ?? DIAS_ANTES) * 86400000
  const depois = (entrada.diasDepois ?? DIAS_DEPOIS) * 86400000

  const porFornecedor = new Map<string, NotaAberta[]>()
  for (const n of entrada.notas) {
    porFornecedor.set(n.fornecedorId, [...(porFornecedor.get(n.fornecedorId) ?? []), n])
  }

  const lotes: SugestaoDeLote[] = []
  const naoFecham: LoteQueNaoFecha[] = []

  for (const linha of entrada.linhas) {
    // ⛔ ÂNCORA 1: sem fornecedor resolvido, nem tenta. É esta linha que separa
    // "reconhecer um pagamento" de "achar uma soma que dá o número".
    if (!linha.fornecedorId) continue
    const todas = porFornecedor.get(linha.fornecedorId) ?? []
    // ⛔ ÂNCORA 2: só as notas plausíveis pra ESTA data de pagamento
    const candidatas = todas.filter((n) =>
      n.vencimento.getTime() >= linha.data.getTime() - antes &&
      n.vencimento.getTime() <= linha.data.getTime() + depois)
    if (candidatas.length < MIN_NOTAS_NO_LOTE) continue

    const nome = entrada.nomeDoFornecedor(linha.fornecedorId)
    const valores = candidatas.map((n) => n.valor)
    const combos = combinacoesQueFecham(valores, linha.valor)
    const somaDasAbertas = Math.round(valores.reduce((a, b) => a + b, 0) * 100) / 100
    const base = {
      extratoId: linha.id, descricao: linha.descricao, valorDaLinha: linha.valor,
      data: linha.data, contaBancaria: linha.contaBancaria ?? null,
      fornecedorId: linha.fornecedorId, fornecedorNome: nome,
      abertasDoFornecedor: candidatas.length, somaDasAbertas,
    }

    if (combos.length === 0) { naoFecham.push({ ...base, motivo: 'NAO_FECHA', combinacoes: 0 }); continue }
    // ⛔ ÂNCORA 3: duas combinações fecham = o sistema NÃO SABE qual foi.
    if (combos.length > 1) { naoFecham.push({ ...base, motivo: 'AMBIGUO', combinacoes: combos.length }); continue }

    const escolhidas = combos[0].map((i) => candidatas[i]).sort((a, b) => b.valor - a.valor)
    const soma = Math.round(escolhidas.reduce((s, n) => s + n.valor, 0) * 100) / 100
    lotes.push({
      extratoId: linha.id,
      fornecedorId: linha.fornecedorId,
      fornecedorNome: nome,
      notas: escolhidas,
      soma,
      valorDaLinha: linha.valor,
      diferenca: Math.round((linha.valor - soma) * 100) / 100,
      porQue: frasePorQueLote(nome, escolhidas.length, soma, candidatas.length),
      abertasDoFornecedor: candidatas.length,
    })
  }
  return { lotes, naoFecham }
}

/** a frase que a tela é obrigada a mostrar, montada dos MESMOS dados do casamento */
export function frasePorQueLote(
  fornecedor: string, quantas: number, soma: number, abertas: number,
): string {
  return `o nome no extrato é ${fornecedor} · ${quantas} das ${abertas} notas abertas dele`
    + ` somam ${brl(soma)} exatamente`
}
