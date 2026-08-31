// ⭐⭐ FATURA NUBANK PF (31/08/2026) — o 2º layout do caminho PF.
//
// ⚠️⚠️ A CONFERÊNCIA É PELA **COMPOSIÇÃO DECLARADA**, NUNCA PELA SOMA BRUTA. Medido pelo
// dono na fatura real: somar TODAS as linhas dá **−2.340,37**, porque o Nubank mistura
// pagamentos, créditos e saldo em atraso no mesmo bloco de transações. O que fecha é:
//
//     compras (2.692,12) + IOF (33,91) + outros lançamentos (327,29) = 3.053,32
//                                                          = "Total a pagar"  ✓ exato
//
// Somar tudo e comparar com o total seria inventar uma régua que o documento não usa — e
// ela reprovaria uma fatura correta.
//
// ⚠️ TOLERÂNCIA DE 1 CENTAVO NOS SUBTOTAIS, e não é folga por conveniência: o PRÓPRIO PDF
// do Nubank declara "Pagamentos e Financiamentos −R$ 5.066,39" enquanto as linhas dele
// somam −5.066,40. O total principal fecha exato; o subtotal não. Tratar isso como erro de
// parser mandaria o dono caçar um centavo que é do banco.

export interface LinhaNubank {
  /** ISO da data resolvida (o ano vem do período — ver `resolverAno`) */
  data: string
  /** 4 últimos do cartão; **null no IOF**, que vem sem eles (mania nº 1) */
  final: string | null
  descricao: string
  /** sempre POSITIVO — o sinal mora em `credito` (mesma regra do resto do módulo) */
  valor: number
  credito: boolean
  /** "Parcela 2/4" no nome vira estrutura */
  parcelaNumero: number | null
  parcelaTotal: number | null
  /** ⭐ IOF é LANÇAMENTO PRÓPRIO, não detalhe da compra — mas sai do "Total de compras" */
  ehIof: boolean
  /** de qual bloco veio ("Yussef A Z Musa", "Pagamentos e Financiamentos") */
  bloco: string
}

export interface DeclaradosNubank {
  totalAPagar: number | null
  compras: number | null
  iof: number | null
  outrosLancamentos: number | null
  faturaAnterior: number | null
  pagamentoRecebido: number | null
}

export interface BlocoNubank {
  nome: string
  /** o subtotal que o PDF declara pro bloco */
  declarado: number | null
  /** a soma das linhas que eu li */
  somado: number
  /** ⚠️ 1 centavo de folga — o próprio Nubank diverge nesse subtotal */
  fecha: boolean
}

export interface FaturaNubankParsed {
  banco: 'Nubank'
  vencimento: string | null
  linhas: LinhaNubank[]
  declared: DeclaradosNubank
  blocos: BlocoNubank[]
  computed: {
    /** soma das linhas de compra (exclui IOF e exclui blocos de pagamento) */
    compras: number
    iof: number
  }
}

const MESES: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
}

const round2 = (n: number) => Math.round(n * 100) / 100
const brl = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

/** ⚠️ o Nubank usa MENOS UNICODE (−, U+2212) nas linhas e HÍFEN ASCII (-) nos subtotais.
 *  Os DOIS aparecem no mesmo documento; tratar só um deixaria metade dos créditos positivos. */
const SINAL_NEGATIVO = /[−-]/

/** o bloco de pagamentos não entra na composição do "Total a pagar" */
const BLOCO_PAGAMENTOS = /pagamentos?\s+e\s+financiamentos/i

/**
 * ⭐ O ANO VEM DO PERÍODO, não do relógio.
 *
 * ⚠️ A linha traz só "08 JUL". Regra do dono, medida no documento: o ano é o do
 * vencimento, **e vira o anterior quando o mês do lançamento é MAIOR que o do vencimento**
 * (fatura de agosto com lançamento de dezembro = dezembro do ano passado). Sem isso, uma
 * compra parcelada antiga entraria com data no futuro.
 */
export function resolverAno(mesLancamento: number, vencimento: Date): number {
  const anoV = vencimento.getFullYear()
  return mesLancamento > vencimento.getMonth() + 1 ? anoV - 1 : anoV
}

/**
 * ⛔⛔ O "TOTAL A PAGAR" APARECE DUAS VEZES, E A PRIMEIRA É PROPAGANDA (achado no arquivo
 * REAL, 31/08/2026).
 *
 * Linha 48: `Total a pagar   R$ 3.634,43   R$ 4.137,00` — está dentro do bloco
 * **"Parcele a sua fatura"**: é quanto você pagaria se financiasse em 3× ou 6×.
 * Linha 134: `Total a pagar   R$ 3.053,32` — o do RESUMO, o que se deve.
 *
 * ⚠️ Pegar a primeira ocorrência conferiria a fatura contra um número de SIMULAÇÃO. E o
 * pior: se um dia os dois coincidissem, o gate daria verde sobre a régua errada — o selo
 * viraria enfeite sem ninguém notar.
 *
 * ⚠️ A CORREÇÃO É ESTRUTURAL, NÃO "REGEX MAIS ESPERTO": leio dentro do RESUMO, e o resumo
 * é ancorado no rótulo que só ele tem ("Total de compras de todos os cartões"). Regex mais
 * específico continuaria dependendo de a propaganda não mudar de texto.
 */
function trechoDoResumo(texto: string): string {
  const i = texto.search(/Total de compras de todos os cart[õo]es/i)
  return i >= 0 ? texto.slice(i) : texto
}

export function lerVencimento(texto: string): Date | null {
  const ext = texto.match(/Data de vencimento[:\s]+(\d{1,2})\s+([A-Za-zÀ-ÿ]{3})\s+(\d{4})/i)
  if (ext) {
    const mes = MESES[ext[2].toUpperCase()]
    if (mes) return new Date(Number(ext[3]), mes - 1, Number(ext[1]))
  }
  const br = texto.match(/vencimento[^\d]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i)
  return br ? new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1])) : null
}

export function lerDeclaradosNubank(texto: string): DeclaradosNubank {
  const resumo = trechoDoResumo(texto)
  const pega = (re: RegExp, onde: string = resumo): number | null => {
    const m = onde.match(re)
    if (!m) return null
    const v = brl(m[1])
    return Number.isFinite(v) ? v : null
  }
  return {
    totalAPagar: pega(/Total a pagar\s+R\$\s*([\d.]+,\d{2})/i),
    compras: pega(/Total de compras de todos os cart[õo]es[^\n]*?R\$\s*([\d.]+,\d{2})/i),
    iof: pega(/IOF de compras internacionais\s+R\$\s*([\d.]+,\d{2})/i),
    outrosLancamentos: pega(/Outros lan[çc]amentos\s+R\$\s*([\d.]+,\d{2})/i),
    // ⚠️ estas duas ficam ACIMA do "Total de compras" no resumo, então leem no texto todo
    faturaAnterior: pega(/Fatura anterior\s+R\$\s*([\d.]+,\d{2})/i, texto),
    pagamentoRecebido: pega(/Pagamento recebido\s+[−-]?\s*R\$\s*([\d.]+,\d{2})/i, texto),
  }
}

/**
 * ⚠️⚠️ LINHAS DO RESUMO — E A REGRA É "O VÍNCULO IMPORTA, NÃO A FLAG".
 *
 * **A FRASE É A FLAG. TER DATA É O VÍNCULO.** "Pagamento recebido" e "Fatura anterior"
 * aparecem no RESUMO (sem data, sem cartão), e o que impede as duas de virarem lançamento
 * não é esta lista de frases — é o regex `LINHA` exigir **data no começo**. Elas nem
 * chegam aqui.
 *
 * ⛔ POR ISSO ESTA LISTA NÃO É USADA NO LAÇO DE TRANSAÇÃO, e não dá pra "simplificar"
 * movendo-a pra lá: filtrar por TEXTO mataria uma transação verdadeira que por acaso tenha
 * a mesma frase. Na fatura real o pagamento se chama "Pagamento em 22 JUL" e escaparia —
 * mas o Nubank pode escrever "Pagamento recebido" com data amanhã, e aí o pagamento de
 * R$ 5.393,69 sumiria do bloco em silêncio.
 *
 * A lista serve **só** pro cabeçalho de bloco, que é onde a linha do resumo pode se
 * disfarçar (rótulo + valor, sem data — a mesma forma de um "Yussef A Z Musa R$ 2.726,03").
 */
const LINHA_DE_RESUMO = /^(fatura anterior|pagamento recebido|total a pagar|total de compras|iof de compras|outros lan[çc]amentos|saldo em atraso)/i

/** detalhe de encargo — não é lançamento */
const DETALHE_ENCARGO = /^\s*(•|Referente ao valor)/i

/**
 * Uma linha de lançamento: DATA · (•••• 4 dígitos) · descrição · R$ valor.
 * ⚠️ Os bullets são U+2022 (••••), não asterisco.
 * ⚠️ O IOF vem SEM os 4 dígitos — por isso o grupo do cartão é OPCIONAL.
 */
const LINHA = new RegExp(
  '^\\s*(\\d{2})\\s+([A-Z]{3})\\s+' +          // 08 JUL
  '(?:[\\u2022]{2,}\\s*(\\d{4})\\s+)?' +        // •••• 8685  (opcional: IOF não tem)
  '(.+?)\\s{2,}' +                              // descrição
  '([−-])?\\s*R\\$\\s*([\\d.]+,\\d{2})\\s*$',   // −R$ 595,05
)

/** cabeçalho de bloco: rótulo + subtotal, SEM data ("Yussef A Z Musa   R$ 2.726,03") */
const CABECALHO_BLOCO = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.]{3,60}?)\s{2,}([−-])?\s*R\$\s*([\d.]+,\d{2})\s*$/

export function parseNubankFaturaPF(texto: string): FaturaNubankParsed {
  // ⚠️ o Nubank escreve o vencimento POR EXTENSO: "Data de vencimento: 17 AGO 2026".
  // A forma dd/mm/aaaa fica como 2ª tentativa (outros documentos podem usar).
  const vencimento = lerVencimento(texto)

  const declared = lerDeclaradosNubank(texto)
  const linhas: LinhaNubank[] = []
  const subtotais = new Map<string, number | null>()
  let blocoAtual = '(sem bloco)'
  // ⛔ SÓ vira cabeçalho de bloco DEPOIS de "TRANSAÇÕES DE …". Sem essa cerca, o resumo e
  // a página de limites viravam "blocos" com zero linha: "Saque no crédito R$ 2.130,00",
  // "Pix no crédito R$ 14.200,00", "Pagamento mínimo…", e até "nem multa. R$ 3.053,32"
  // (fim de um parágrafo de propaganda quebrado pelo -layout). Nenhum é bloco de
  // transação — e todos apareceriam como subtotal que não fecha.
  let dentroDeTransacoes = false

  for (const bruta of texto.split('\n')) {
    if (DETALHE_ENCARGO.test(bruta)) continue
    if (/^\s*TRANSA[ÇC][ÕO]ES\s+DE\s/i.test(bruta)) { dentroDeTransacoes = true; continue }

    const m = LINHA.exec(bruta)
    if (m) {
      const [, dia, mesTxt, final, descBruta, sinal, valorTxt] = m
      const desc = descBruta.trim()
      // ⚠️⚠️ NÃO filtrar por LINHA_DE_RESUMO aqui — bug meu, pego na 1ª execução do
      // golden: "Pagamento recebido" existe DUAS vezes no documento, uma no RESUMO (sem
      // data, sem cartão) e outra como TRANSAÇÃO real (com data e cartão). Filtrar pelo
      // TEXTO matava a transação verdadeira e o bloco passava a somar 327,29 em vez de
      // −5.066,40. O que separa as duas não é a frase — é **ter data**, e a linha do
      // resumo nem chega aqui (o regex exige data no começo). O filtro fica só no
      // cabeçalho de bloco, que é onde a linha do resumo pode se disfarçar.
      const mes = MESES[mesTxt.toUpperCase()]
      if (!mes) continue

      const ano = vencimento ? resolverAno(mes, vencimento) : new Date().getFullYear()
      const p = desc.match(/Parcela\s+(\d+)\s*\/\s*(\d+)/i)

      linhas.push({
        data: `${ano}-${String(mes).padStart(2, '0')}-${dia}`,
        final: final ?? null,
        descricao: desc,
        valor: brl(valorTxt),
        credito: !!sinal && SINAL_NEGATIVO.test(sinal),
        parcelaNumero: p ? Number(p[1]) : null,
        parcelaTotal: p ? Number(p[2]) : null,
        // ⭐ IOF é lançamento próprio (mania nº 1), mas sai do "Total de compras"
        ehIof: /^IOF\b/i.test(desc),
        bloco: blocoAtual,
      })
      continue
    }

    // ⚠️ linha SEM valor na direita = continuação da compra internacional
    // ("BRL 550.00 = USD 107.02" / "Conversão: …"). NÃO é lançamento — e não muda bloco.
    if (!/R\$\s*[\d.]+,\d{2}\s*$/.test(bruta)) continue

    if (!dentroDeTransacoes) continue
    const c = CABECALHO_BLOCO.exec(bruta)
    if (c) {
      const nome = c[1].trim()
      if (LINHA_DE_RESUMO.test(nome)) continue
      blocoAtual = nome
      subtotais.set(nome, (c[2] && SINAL_NEGATIVO.test(c[2]) ? -1 : 1) * brl(c[3]))
    }
  }

  const blocos: BlocoNubank[] = [...subtotais.entries()].map(([nome, declarado]) => {
    const somado = round2(
      linhas.filter((l) => l.bloco === nome).reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0),
    )
    return {
      nome, declarado, somado,
      // ⚠️ 1 centavo: o próprio PDF do Nubank declara −5.066,39 pra linhas que somam
      // −5.066,40. É divergência DELE, não da leitura.
      fecha: declarado == null ? false : Math.abs(somado - declarado) <= 0.01,
    }
  })

  const deCompra = linhas.filter((l) => !BLOCO_PAGAMENTOS.test(l.bloco))
  return {
    banco: 'Nubank',
    vencimento: vencimento ? vencimento.toISOString().slice(0, 10) : null,
    linhas,
    declared,
    blocos,
    computed: {
      compras: round2(deCompra.filter((l) => !l.ehIof).reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0)),
      iof: round2(deCompra.filter((l) => l.ehIof).reduce((s, l) => s + l.valor, 0)),
    },
  }
}

export interface ConferenciaNubank {
  fecha: boolean
  composicao: number
  totalAPagar: number | null
  diferenca: number
  detalhe: string
}

/**
 * ⭐⭐ A CONFERÊNCIA — pela COMPOSIÇÃO declarada, jamais pela soma bruta.
 * `compras + IOF + outros lançamentos == Total a pagar`
 */
export function conferirNubank(r: FaturaNubankParsed): ConferenciaNubank {
  const d = r.declared
  const outros = d.outrosLancamentos ?? 0
  const composicao = round2(r.computed.compras + r.computed.iof + outros)
  const total = d.totalAPagar
  const diferenca = total == null ? 0 : round2(composicao - total)
  const f = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return {
    fecha: total != null && Math.abs(diferenca) <= 0.01,
    composicao,
    totalAPagar: total,
    diferenca,
    detalhe:
      `   compras ${f(r.computed.compras)} + IOF ${f(r.computed.iof)} + outros ${f(outros)}` +
      ` = ${f(composicao)}` +
      (total != null ? ` · declarado ${f(total)}` : ' · o PDF não declarou o total a pagar'),
  }
}
