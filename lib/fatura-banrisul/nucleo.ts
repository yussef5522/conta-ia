// NÚCLEO COMPARTILHADO DA FATURA BANRISUL (26/08) — PJ e PF.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE: a fatura PJ e a fatura PF do Banrisul têm o MESMO
// dialeto de linha (data dd/mm, valor com vírgula, parcela dd/dd embutida na descrição,
// internacional com US$+R$, IOF como continuação sem data, "TX DÓLAR" informativa,
// negativo = estorno) e LAYOUTS DE COLUNA diferentes:
//   · PJ  → transações só na coluna ESQUERDA; a direita é BanriClube/pontos/limites.
//   · PF  → transações nas DUAS colunas (dois portadores), e a fronteira MUDA de página.
//
// Então o que é compartilhado é a LEITURA DA LINHA; o que é específico é COMO FATIAR a
// página em colunas. Duplicar a leitura seria a segunda cópia da mesma decisão — o
// padrão que já custou caro neste projeto (5 detectores de par, 3 cópias da regra de
// competência). Aqui: um motor, duas estratégias de coluna.
//
// As ARMADILHAS abaixo vieram todas de fatura real e viram teste (REGRA 3):
//  1) internacional = linha datada com DOIS números (US$ e R$): valor = o ÚLTIMO
//     (R$ convertido), o penúltimo é US$. Vai pro bucket EXTERIOR.
//  2) IOF sobre transação no exterior vem em linha SEM data (continuação da compra
//     internacional acima) — é VALOR, soma como encargo, bucket IOF.
//  3) "USD 200,00 TX DÓLAR R$ 5,2621" é INFORMATIVA (a cotação) — NÃO é transação.
//  4) pagamento da fatura anterior vem como "DEB 0230/06 ... -2.677,29" (negativo,
//     prefixo DEB) — NÃO importa (já está no extrato; entra em Pagamentos/Créditos).
//  5) par de anuidade: "DESC. ANUID. ... -18,00" (CRÉDITO) + "ANUIDADEINT DIFER ...
//     18,00" (DÉBITO). Net 0. NÃO deduplicar — os dois entram.
//  6) "TOTAL DE GASTOS" é a Σ declarada (validação), não transação.
//  7) datas sem ano: mês > mês do vencimento ⇒ ano anterior.

import type { InvoiceExtraction, InvoiceLine, InvoiceLineKind } from '@/lib/credit-card-pj/types'

export const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** "-2.677,29" → -2677.29 · "85,70" → 85.70. Null se não casar (comma + 2 decimais). */
export function parseBRNumber(raw: string): number | null {
  const m = raw.match(/(-?)\s*([\d.]+),(\d{2})/)
  if (!m) return null
  const v = Number(`${m[2].replace(/\./g, '')}.${m[3]}`)
  return isNaN(v) ? null : round2((m[1] === '-' ? -1 : 1) * v)
}

/** Todos os tokens monetários (comma + 2 decimais) da string, na ordem. */
export function allBRNumbers(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(/-?[\d.]+,\d{2}/g)) {
    const n = parseBRNumber(m[0])
    if (n != null) out.push(n)
  }
  return out
}

/** Parcela dd/dd na descrição (01/06, 09/10). n≤total, total≤24, ambos>0. */
export function extractParcela(desc: string): { number: number; total: number } | null {
  let found: { number: number; total: number } | null = null
  for (const m of desc.matchAll(/\b(\d{2})\/(\d{2})\b/g)) {
    const n = Number(m[1]), t = Number(m[2])
    if (n > 0 && t > 0 && n <= t && t <= 24) found = { number: n, total: t } // última ocorrência
  }
  return found
}


export const MONTHS_TX = /^(\d{2})\/(\d{2})\s+(.*)$/

/**
 * ⭐⭐⭐ A COTAÇÃO É UM FRAGMENTO, NÃO UMA LINHA (16/09/2026) — e tratá-la como linha
 * custava dinheiro em silêncio.
 *
 * Numa compra internacional o Banrisul imprime TRÊS coisas: a transação (`US$` + `R$`), o
 * `IOF SOBRE TRANSACAO NO EXTERIOR` e — puramente informativa — a moeda de origem com a
 * taxa: `JOD 49,95 TX DÓLAR R$ 5,2264`. A régua antiga era *"linha que fala TX DÓLAR não é
 * transação → pula a LINHA INTEIRA"*, e ela só funciona enquanto a cotação estiver
 * **sozinha** na linha física.
 *
 * ⛔⛔ **E ela não fica sozinha quando a calha some.** O PDF tem duas colunas; quando
 * `colunasDaRegiao` não acha a faixa em branco (foi o que aconteceu na última página de
 * setembro, com 2 lançamentos na direita), a página vira uma banda só e o fragmento de uma
 * coluna passa a dividir a linha com o conteúdo REAL da outra. Medido, com os três
 * desfechos:
 *
 * ```
 *  06/07 HOT CAFECA … 617,00 │ JOD 49,95 TX DÓLAR R$ 5,2264  → lê R$ 5,22 (a TAXA!) em EXTERIOR
 *  IOF … 0,06             │ JOD 3,00 TX DÓLAR R$ 5,2711      → some
 *  JOD 19,50 TX DÓLAR R$ 5,2621 │ 19/07 … 106,13 559,42      → some
 * ```
 *
 * ⚠️ O primeiro é o pior dos três: **não falta linha, falta DINHEIRO dentro de uma linha
 * que existe** — a conferência acusa uma diferença e o dono procura uma transação inteira
 * que está lá. ⚠️ E repare que a taxa tem **4 casas**: `allBRNumbers('R$ 5,2504')` devolve
 * `[5.25]`, porque o leitor casa `[\d.]+,\d{2}`. A taxa não é dinheiro em lugar nenhum
 * desta fatura — ela não pode chegar ao leitor de valor.
 *
 * ⭐ A CURA É TIRAR O FRAGMENTO, NUNCA A LINHA. Sobrou conteúdo? é transação. Não sobrou?
 * era só a cotação. Funciona com calha e sem calha — e é por isso que ela é a régua, e não
 * um segundo remendo de coluna.
 *
 * ⚠️ O token da moeda só é comido quando é ALFABÉTICO (`JOD`, `USD`): exigir letras impede
 * o caso em que não há token e o `\S+` engoliria o **valor da compra** que vem antes.
 */
const COTACAO_INFORMATIVA =
  /(?:[A-Za-zÀ-ú]{2,5}\s+)?[\d.]+,\d{2}\s+TX\s*D(?:[ÓO]LAR)?\.?\s*(?:R\$\s*)?[\d.]+,\d{2,6}/gi

export function removerCotacaoInformativa(linha: string): string {
  return linha.replace(COTACAO_INFORMATIVA, '  ')
}

/**
 * ⭐⭐⭐ DUAS COLUNAS COLADAS NA MESMA LINHA FÍSICA — o backstop da calha (16/09/2026).
 *
 * ⚠️ **Por que isto existe se já existe `colunasDaRegiao`:** a calha é a defesa certa e
 * continua sendo a primeira. Mas ela **já falhou uma vez em documento real** (setembro,
 * última página com 2 lançamentos na direita) — e quando ela falha a página inteira vira
 * uma banda só, colando as duas colunas. Medido nas linhas REAIS da fatura de agosto, o
 * motor perdia dinheiro de **quatro** jeitos diferentes, todos calados:
 *
 * ```
 *  IOF … 9,62 │ 22/07 CAFECA … 3,44  18,00   → lia IOF 18,00 (o valor do VIZINHO) e perdia a compra
 *  06/07 … 347,50 │ 15/07 … 8,70 45,49       → lia UMA transação de 45,49 e perdia 347,50
 * ```
 *
 * ⭐ A régua: onde uma **data de lançamento** começa depois de uma faixa de 3+ espaços, ali
 * começa outra coluna. É o mesmo princípio da calha — *o documento diz onde ele se divide* —
 * só que aplicado à linha, e não à página.
 *
 * ⭐⭐ A RÉGUA É **POSIÇÃO, NÃO QUANTIDADE DE ESPAÇO**: coluna nova começa logo depois do
 * VALOR da coluna anterior. É a estrutura de uma tabela de dinheiro em duas colunas.
 *
 * ```
 *   02/09 MERCADOLIVRE MERCAD 11/12   79,08  07/09 ANUIDADEINT DIFER 05/12 0123   18,00
 *                                          ↑ dois espaços só — e é outra coluna
 * ```
 *
 * ⚠️⚠️ **A 1ª VERSÃO CONTAVA ESPAÇO (3+) E ISSO ERRAVA DOS DOIS LADOS, medido:** o gap
 * apertado acima **não partia** (lia 18,00 e perdia os 79,08), e uma descrição com 3
 * espaços antes de uma parcela **partia onde não devia** — `06/07 PADARIA RESTA   01/04
 * HOT   347,50` virava uma transação datada em **01/04**, com a data e o começo da
 * descrição inventados. *Contar espaço é heurística de aparência; a posição relativa ao
 * valor é a estrutura.*
 *
 * ⛔ **O QUE ISSO TRAVA:** a parcela vem **antes** do valor, dentro da descrição; a coluna
 * vizinha vem **depois** dele. Como a régua exige o valor imediatamente atrás, parcela
 * nenhuma parte linha — e **inventar transação é pior que perder**, porque ninguém
 * desconfia de um número a mais.
 */
export function fatiarColunasColadas(linha: string): string[] {
  const re = /(?<=\d,\d{2})\s{2,}(?=\d{2}\/\d{2}\s+[A-Za-zÀ-ú])/g
  const out: string[] = []
  let ini = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(linha)) !== null) {
    if (m.index > ini) out.push(linha.slice(ini, m.index))
    ini = m.index + m[0].length
  }
  out.push(linha.slice(ini))
  return out
}


export interface Bucketed {
  bucket: 'BRASIL' | 'EXTERIOR' | 'IOF' | 'ESTORNO' | 'PAYMENT'
  description: string
  value: number // COM sinal
  date: string
  parcela: { number: number; total: number } | null
  card: string | null
}


export interface BanrisulFaturaParsed {
  extraction: InvoiceExtraction
  declared: {
    totalGastos: number | null // "TOTAL DE GASTOS" — Σ de todos os débitos do período
    saldoAtual: number | null // "Saldo da fatura atual" — o que se paga (net)
    anterior: number | null // "Total da fatura anterior"
    pagamentosCreditos: number | null // "Pagamentos / Créditos"
    brasil: number | null // "Despesas / Débitos no Brasil"
    exterior: number | null // "Saldo Convertido em Reais (+)"
    iof: number | null // "IOF sobre transações no exterior"
  }
  computed: {
    sumBrasil: number
    sumExterior: number
    sumIof: number
    sumPositives: number // brasil + exterior + iof (débitos)
    sumEstornos: number // créditos/estornos (negativo, não-pagamento)
    sumPayments: number // pagamento(s) da fatura anterior
    net: number // sumPositives + sumEstornos = Saldo da fatura atual
    count: number // linhas importáveis (exclui pagamento)
  }
}


/**
 * ⭐⭐⭐ SOMA TODAS AS OCORRÊNCIAS DO RÓTULO — e isto conserta um defeito que estava
 * **registrado como LATENTE desde 31/08** e virou o bug real de 16/09.
 *
 * ⛔⛔ **O DEFEITO:** `TOTAL DE GASTOS` aparece **uma vez por PORTADOR** na fatura do
 * Banrisul, e o `match` pegava só a **PRIMEIRA**. Na fixture de agosto isso lê **23.648,03**
 * quando o total é **39.302,64** (= 23.648,03 + 15.654,61, os dois portadores). Na fatura
 * que o dono subiu hoje a primeira ocorrência era **151,56** — e a conferência recusou,
 * **corretamente**.
 *
 * ⚠️ E o comentário do campo **já prometia** *"Σ de todos os débitos do período"*: o código
 * dizia uma coisa e entregava outra. **É o padrão que o Caixa já resolveu certo** (ele
 * coleta com `matchAll` indexado pelos 4 dígitos do cartão) e que o próprio CLAUDE.md
 * chamou de *"seguro por CONSTRUÇÃO"* em 31/08, contra o *"seguro por coincidência"* daqui.
 */
function somarTodas(text: string, re: RegExp): number | null {
  const todas = [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))]
  if (todas.length === 0) return null
  let soma = 0
  for (const m of todas) {
    const v = parseBRNumber(m[1]!)
    if (v == null) return null // ⛔ não soma pela metade: ou lê todas, ou diz que não leu
    soma += v
  }
  return Math.round(soma * 100) / 100
}

export function readDeclared(text: string): BanrisulFaturaParsed['declared'] {
  const grab = (re: RegExp): number | null => {
    const m = text.match(re)
    return m ? parseBRNumber(m[1]) : null
  }
  return {
    totalGastos: somarTodas(text, /TOTAL DE GASTOS\s+([\d.]+,\d{2})/i),
    saldoAtual: grab(/Saldo da fatura atual\s+([\d.]+,\d{2})/i),
    anterior: grab(/Total da fatura anterior\s+([\d.]+,\d{2})/i),
    pagamentosCreditos: grab(/Pagamentos\s*\/\s*Cr[eé]ditos\s+([\d.]+,\d{2})/i),
    brasil: grab(/Despesas\s*\/\s*D[eé]bitos no Brasil\s+([\d.]+,\d{2})/i),
    exterior: grab(/Saldo Convertido em Reais\s*\(\+\)\s+([\d.]+,\d{2})/i),
    iof: grab(/IOF sobre transa[çc][õo]es no exterior\s+([\d.]+,\d{2})/i),
  }
}

/**
 * ⭐ "Despesas parceladas - Próximas Faturas" — o BANCO já projeta as próximas faturas
 * e imprime no resumo. Todo PDF do Banrisul traz.
 *
 * ⚠️ ISTO É FATO, e a projeção calculada a partir das linhas NÃO É. Medido na fatura
 * real: projetar "restam N parcelas × valor" dá **R$ 71.733,16** contra **28.989,62**
 * declarados — porque uma compra grande aparece com 4 parcelas cobradas na MESMA
 * fatura E um estorno de −20.954,54 (parcelamento antecipado/cancelado). Projetar dali
 * inventaria 47 mil de cobranças que nunca virão. Mesma regra do resto do sistema:
 * quando o arquivo TRAZ o dado, usa o dado; a conta própria vira só conferência.
 */
export interface ProximasFaturas {
  proxima: number | null      // o mês seguinte
  seguinte: number | null     // o mês depois desse
  demais: number | null       // todas as outras somadas
  total: number | null        // "Total de despesas parceladas a vencer"
  rotuloProxima: string | null
  rotuloSeguinte: string | null
}

const MESES_PT = 'Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro'

export function readProximasFaturas(text: string): ProximasFaturas {
  const vazio: ProximasFaturas = { proxima: null, seguinte: null, demais: null, total: null, rotuloProxima: null, rotuloSeguinte: null }
  const i = text.search(/Despesas parceladas\s*-\s*Pr[óo]ximas Faturas/i)
  if (i < 0) return vazio
  // a seção fica na coluna direita do resumo; pega dali até o fim do bloco
  const trecho = text.slice(i, i + 1200)
  const meses = [...trecho.matchAll(new RegExp(`\\b(${MESES_PT})\\b\\s+([\\d.]+,\\d{2})`, 'gi'))]
  const demaisM = trecho.match(/Demais Faturas\s+([\d.]+,\d{2})/i)
  const totalM = trecho.match(/Total de despesas parceladas a vencer\s+([\d.]+,\d{2})/i)
  return {
    proxima: meses[0] ? parseBRNumber(meses[0][2]) : null,
    seguinte: meses[1] ? parseBRNumber(meses[1][2]) : null,
    demais: demaisM ? parseBRNumber(demaisM[1]) : null,
    total: totalM ? parseBRNumber(totalM[1]) : null,
    rotuloProxima: meses[0] ? meses[0][1] : null,
    rotuloSeguinte: meses[1] ? meses[1][1] : null,
  }
}

export function readVenc(text: string): { month: number; year: number; dueDate: string | null } {
  const m = text.match(/Vencimento:?\s+(\d{2})\/(\d{2})\/(\d{4})/i)
  if (m) return { month: Number(m[2]), year: Number(m[3]), dueDate: `${m[3]}-${m[2]}-${m[1]}` }
  return { month: 12, year: 0, dueDate: null }
}


export function resolveDate(dd: string, mm: string, vencMonth: number, vencYear: number): string {
  const day = Number(dd), mon = Number(mm)
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return vencYear ? `${vencYear}-01-01` : '1970-01-01'
  const year = mon > vencMonth ? vencYear - 1 : vencYear // trap 7
  return `${year || 1970}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}


export function classifyKind(bucket: Bucketed['bucket'], desc: string, parcela: Bucketed['parcela']): InvoiceLineKind {
  if (bucket === 'ESTORNO') return 'ESTORNO'
  if (bucket === 'IOF') return 'ENCARGO_FINANCEIRO'
  const d = desc.toLowerCase()
  if (/\biof\b|juros|multa|\bmora\b|anuidade|encargo|rotativo/.test(d)) return 'ENCARGO_FINANCEIRO'
  if (parcela) return 'COMPRA_PARCELADA'
  return 'COMPRA_AVISTA'
}



/**
 * O MOTOR DE LEITURA — recebe as linhas JÁ FATIADAS na coluna certa e devolve os
 * lançamentos classificados. É aqui que moram as 7 armadilhas do topo.
 *
 * ⚠️ Quem chama decide COMO fatiar: o PJ manda a coluna esquerda (a direita é lixo de
 * BanriClube); o PF manda cada banda de portador separadamente. O motor não sabe nem
 * precisa saber — é essa fronteira que permite os dois layouts sem duas cópias.
 *
 * `cartaoInicial` permite ao PF dizer de qual portador é a banda, já que o cabeçalho
 * `NR. dddd` pode estar noutra coluna (a fatura PF tem os dois lado a lado).
 */
export function classificarLinhas(
  linhas: string[],
  venc: { month: number; year: number; dueDate: string | null },
  cartaoInicial: string | null = null,
): Bucketed[] {
  const bucketed: Bucketed[] = []
  let currentCard: string | null = cartaoInicial
  let lastDate = venc.dueDate ?? (venc.year ? `${venc.year}-01-01` : '1970-01-01')

  for (const raw of linhas) {
    const full = raw.replace(/\s+$/, '')
    // header de bloco de cartão (define o cartão corrente das próximas linhas)
    const cardHdr = full.match(/NR\.\s*(\d{4})/i)
    if (cardHdr) currentCard = cardHdr[1]

    // ⭐ A COTAÇÃO SAI ANTES DE QUALQUER DECISÃO — ver `removerCotacaoInformativa`. Linha
    // que era só cotação fica vazia aqui e some; linha que tinha conteúdo real do lado
    // segue viva, com o valor certo. Depois, se DUAS colunas vieram coladas (calha que
    // falhou), a linha é fatiada e cada pedaço é lido por si.
    for (const trimmed of fatiarColunasColadas(removerCotacaoInformativa(full)).map((s) => s.trim())) {
    if (!trimmed) continue

    const dated = trimmed.match(MONTHS_TX)
    if (dated) {
      const [, dd, mm, rest] = dated
      const nums = allBRNumbers(rest)
      if (nums.length === 0) continue // linha datada sem valor (não é transação)
      const value = nums[nums.length - 1]
      const isIntl = nums.length >= 2
      const desc = rest.replace(/-?[\d.]+,\d{2}/g, ' ').replace(/\s+/g, ' ').trim()
      const parcela = extractParcela(desc)
      const date = resolveDate(dd, mm, venc.month, venc.year)
      lastDate = date

      let bucket: Bucketed['bucket']
      if (value < 0) {
        bucket = /^DEB\b/i.test(desc) || /pagamento|pagto/i.test(desc) ? 'PAYMENT' : 'ESTORNO'
      } else if (isIntl) {
        bucket = 'EXTERIOR'
      } else {
        bucket = 'BRASIL'
      }
      bucketed.push({ bucket, description: desc || '(sem descrição)', value, date, parcela, card: currentCard })
      continue
    }

    // continuação (sem data): IOF exterior · TX DÓLAR (informativa) · TOTAL DE GASTOS
    // trap 3 — BACKSTOP. O caminho normal é o `removerCotacaoInformativa` lá em cima; isto
    // aqui só pega uma cotação de forma que a régua não reconheceu (sem taxa, por exemplo).
    // ⚠️ Ele NÃO pode voltar a ser o caminho principal: pular a LINHA foi exatamente o que
    // apagou IOF e transação real quando a calha sumiu.
    if (/\bTX\s*D[ÓO]?LAR|\bTX\s*D\b/i.test(trimmed)) continue
    if (/TOTAL DE GASTOS/i.test(trimmed)) continue // trap 6: total declarado, não tx
    if (/\bIOF\b/i.test(trimmed)) {
      const nums = allBRNumbers(trimmed)
      if (nums.length > 0 && nums[nums.length - 1] > 0) {
        bucketed.push({ bucket: 'IOF', description: 'IOF sobre transação no exterior', value: nums[nums.length - 1], date: lastDate, parcela: null, card: currentCard })
      }
    }
    // qualquer outra continuação: ignora (se sobrar valor real, a validação morde)
    }
  }
  return bucketed
}

/** Monta linhas + somas por bucket a partir dos lançamentos classificados. */
export function montarResultado(
  bucketed: Bucketed[],
  declared: BanrisulFaturaParsed['declared'],
  venc: { dueDate: string | null },
  cardFinals: string[],
): BanrisulFaturaParsed {
  const invLines: InvoiceLine[] = []
  let sumBrasil = 0, sumExterior = 0, sumIof = 0, sumEstornos = 0, sumPayments = 0
  for (const b of bucketed) {
    if (b.bucket === 'PAYMENT') { sumPayments += b.value; continue } // trap 4: não entra
    if (b.bucket === 'BRASIL') sumBrasil += b.value
    else if (b.bucket === 'EXTERIOR') sumExterior += b.value
    else if (b.bucket === 'IOF') sumIof += b.value
    else if (b.bucket === 'ESTORNO') sumEstornos += b.value
    invLines.push({
      date: b.date,
      description: b.description,
      amount: round2(Math.abs(b.value)),
      suggestedKind: classifyKind(b.bucket, b.description, b.parcela),
      ...(b.parcela ? { installmentNumber: b.parcela.number, installmentTotal: b.parcela.total } : {}),
      ...(b.card ? { cardLastDigits: b.card } : {}),
      ...(b.bucket === 'ESTORNO' ? { note: 'crédito/estorno (valor negativo na fatura)' } : {}),
      ...(b.bucket === 'EXTERIOR' ? { note: 'compra internacional (R$ convertido)' } : {}),
    })
  }
  const sumPositives = round2(sumBrasil + sumExterior + sumIof)
  const net = round2(sumPositives + sumEstornos)

  const extraction: InvoiceExtraction = {
    dueDate: venc.dueDate,
    closingDate: null,
    totalDeclared: declared.totalGastos,
    totalToPay: declared.saldoAtual,
    creditLimit: null,
    availableLimit: null,
    detectedBank: 'Banrisul',
    cardLastDigitsFound: cardFinals,
    scanQuality: 'GOOD',
    lines: invLines,
    notes: [],
  }
  return {
    extraction,
    declared,
    computed: {
      sumBrasil: round2(sumBrasil),
      sumExterior: round2(sumExterior),
      sumIof: round2(sumIof),
      sumPositives,
      sumEstornos: round2(sumEstornos),
      sumPayments: round2(sumPayments),
      net,
      count: invLines.length,
    },
  }
}
