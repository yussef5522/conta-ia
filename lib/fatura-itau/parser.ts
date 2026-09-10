// ⭐⭐⭐ FATURA ITAÚ / LUIZACRED PF (09/09/2026) — o 3º layout do caminho PF, 7º da casa.
//
// Emissor **LUIZACRED S/A SCFI** (o cartão Magazine Luiza), boleto do **Banco Itaú**,
// diagramação **Quadient**. O dono: *"o sistema não consegue ler"* — e não conseguia
// mesmo: o caminho PF só tinha régua de Banrisul.
//
// ⭐⭐ **A CONFERÊNCIA É PELA COMPOSIÇÃO DECLARADA**, a mesma disciplina do Nubank:
//
//     cartão 8818 (1.070,89) + cartão 2971 (3.285,23) + produtos e serviços (14,67)
//                                            = 4.370,79 = "Total dos lançamentos atuais" ✓
//
// e o total do boleto fecha por outro caminho, que o próprio resumo escreve:
//
//     fatura anterior (1.635,08) − pagamento (1.635,08) + saldo financiado (0,00)
//                    + encargos (120,39) + lançamentos (4.370,79) = 4.491,18 ✓
//
// ⛔⛔ **E O TOTAL SAI DO BLOCO DO RESUMO, NUNCA DE UM REGEX SOLTO.** Esta fatura tem
// **"Total a pagar" DUAS VEZES** fora do resumo — R$ 5.185,79 e R$ 5.387,96 — e as duas
// são **SIMULAÇÃO de parcelamento**, não o que se deve. É exatamente a armadilha que
// custou o parser do Nubank em 31/08 ("Total a pagar" da propaganda × do resumo). Aqui o
// resumo é ancorado em *"Resumo da fatura em R$"* e nada é lido fora dele.

import {
  linhasEmOrdemDeLeitura, DATA_NA_COLUNA, MOEDA_NO_FIM,
} from './colunas'

export interface LinhaItau {
  /** ISO — o ano vem do fechamento (ver `resolverAno`) */
  data: string
  descricao: string
  /** sempre POSITIVO; o sinal mora em `credito` (a régua do módulo inteiro) */
  valor: number
  credito: boolean
  parcelaNumero: number | null
  parcelaTotal: number | null
  /** ⭐ os 4 finais do cartão — a fatura tem DOIS, e cada linha sabe de qual é */
  portador: string | null
  /** ⚠️ encargo de atraso é lançamento da FATURA, não de um cartão: portador null */
  encargo: boolean
}

export interface CartaoItau {
  final: string
  titular: string
  /** o subtotal que o PDF declara pro bloco ("Lançamentos no cartão (final XXXX)") */
  declarado: number | null
  /** a soma das linhas que eu li desse cartão */
  somado: number
  fecha: boolean
}

export interface DeclaradosItau {
  totalDaFatura: number | null
  lancamentosAtuais: number | null
  produtosEServicos: number | null
  encargos: number | null
  faturaAnterior: number | null
  pagamentoEfetuado: number | null
  saldoFinanciado: number | null
}

/** ⛔ NÃO ENTRAM na fatura — são as parcelas que o banco vai cobrar nos meses seguintes */
export interface ProximasItau {
  proxima: number | null
  demais: number | null
  total: number | null
  /** só pra conferência/tela: quantas linhas o bloco listou */
  linhas: number
}

export interface FaturaItauParsed {
  banco: 'Itaú/Luizacred'
  vencimento: string | null
  emissao: string | null
  beneficiario: string | null
  linhas: LinhaItau[]
  cartoes: CartaoItau[]
  declared: DeclaradosItau
  computed: { lancamentos: number }
  proximas: ProximasItau
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const brl = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'))

/** ⭐ o final do cartão no cabeçalho do bloco: "DANIELA LEITE O (final 8818)" */
const CABECALHO_DO_CARTAO = /^(.+?)\s*\(final (\d{4})\)\s*$/
/** e o fechamento dele, que traz o subtotal */
const FECHA_O_CARTAO = /^Lançamentos no cartão \(final (\d{4})\)\s+(.+)$/

/**
 * ⭐ A PARCELA VEM COLADA NO NOME, com e sem espaço: "LOJAS RIACHUELO SA03/03",
 * "PACCOBY *Pacco01/04", "Leiturinha S.A 12/12", "DM*helphbomaxcom 08/12".
 *
 * ⚠️ Guardas pra não transformar qualquer par de números em parcela: a parcela nunca é
 * maior que o total, e um total de 1 não é parcelamento.
 */
export function separarParcela(descricao: string): {
  descricao: string; parcelaNumero: number | null; parcelaTotal: number | null
} {
  const m = /^(.*?)\s*(\d{2})\/(\d{2})$/.exec(descricao.trim())
  if (!m) return { descricao: descricao.trim(), parcelaNumero: null, parcelaTotal: null }
  const n = Number(m[2]), t = Number(m[3])
  if (n < 1 || t < 2 || n > t) return { descricao: descricao.trim(), parcelaNumero: null, parcelaTotal: null }
  return { descricao: m[1].trim(), parcelaNumero: n, parcelaTotal: t }
}

/**
 * ⭐ O ANO NÃO ESTÁ NA LINHA — só "DD/MM". Quem dá o ano é o fechamento da fatura.
 *
 * ⚠️ Esta fatura tem compras de **27/01, 16/04 e 20/05** ainda correndo em parcelas: mês
 * MAIOR que o do fechamento é do ano anterior. É a mesma regra do Nubank.
 */
export function resolverAno(diaMes: string, referencia: { ano: number; mes: number }): string {
  const [dd, mm] = diaMes.split('/').map(Number)
  const ano = mm > referencia.mes ? referencia.ano - 1 : referencia.ano
  return `${ano}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** dd/mm/aaaa → ISO */
function isoDeData(s: string | undefined): string | null {
  if (!s) return null
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

/**
 * ⛔⛔⛔ ONDE O BLOCO DO RESUMO TERMINA — e isto foi um bug REAL em prod (09/09/2026).
 *
 * **O dono:** *"a tela não acha o total que o golden acha, NO MESMO PDF"*. A primeira
 * versão cortava o bloco por **contagem de linhas** (`slice(i, i + 14)`), com o comentário
 * *"14 linhas cobrem com folga"*. Cobriam — **na extração do meu Mac**. O poppler do
 * servidor (24.02.0) devolve o mesmo PDF com **uma linha a mais** antes do resumo:
 *
 * ```
 *   Mac        "Resumo da fatura em R$" no índice  9 · "Total desta fatura" no 19  (dist 10)
 *   servidor   "Resumo da fatura em R$" no índice  6 · "Total desta fatura" no 20  (dist 14)
 * ```
 *
 * `slice(6, 6+14)` para no índice 19 e **exclui o 20 por UMA linha**: `totalDaFatura`
 * virava `null` e a tela pedia o total digitado, com o número impresso na página 1.
 *
 * ⭐ A REGRA: **o fim do bloco é o FATO que o fecha**, não uma contagem. O resumo termina
 * na linha do `= Total desta fatura`; contagem de linhas é exatamente o tipo de número que
 * quebra quando o extrator muda de versão — e extrator muda de versão sozinho.
 */
function fimDoResumo(linhas: string[], inicio: number): number {
  const depois = linhas.slice(inicio, inicio + 30)
  // o próprio fechamento do bloco, INCLUSIVE
  const fecha = depois.findIndex((l) => /Total desta fatura/.test(l))
  if (fecha >= 0) return fecha + 1
  // ⚠️ fallback: o bloco do titular vem logo abaixo do resumo — para nele. E os 6 rótulos
  // que este parser lê são ÚNICOS no documento (teste em `golden-fatura-itau`), então a
  // âncora é cinto E suspensório, nunca a única defesa.
  const titular = depois.findIndex((l) => /^\s*Titular\b/.test(l))
  return titular > 0 ? titular : 30
}

/**
 * ⛔⛔ O RESUMO É LIDO DENTRO DO BLOCO DELE. Ver a nota do topo: "Total a pagar" aparece
 * 2× nas simulações de parcelamento desta mesma fatura, com números MAIORES.
 */
function lerResumo(texto: string): DeclaradosItau {
  const linhas = texto.split('\n')
  const i = linhas.findIndex((l) => /Resumo da fatura em R\$/.test(l))
  const bloco = i >= 0 ? linhas.slice(i, i + fimDoResumo(linhas, i)).join('\n') : ''
  const pega = (rotulo: RegExp): number | null => {
    const m = new RegExp(`${rotulo.source}[^\\n]*?(-\\s*)?(\\d{1,3}(?:\\.\\d{3})*,\\d{2})`).exec(bloco)
    if (!m) return null
    const v = brl(m[2])
    return m[1] ? -v : v
  }
  return {
    totalDaFatura: pega(/Total desta fatura/),
    lancamentosAtuais: pega(/Lançamentos atuais/),
    encargos: pega(/Encargos \(financiamento/),
    faturaAnterior: pega(/Total da fatura anterior/),
    pagamentoEfetuado: pega(/Pagamento efetuado/),
    saldoFinanciado: pega(/Saldo financiado/),
    // ⚠️ este vive no corpo, não no resumo — e o rótulo SEM dois-pontos é o do fechamento
    // da seção ("Lançamentos produtos e serviços   14,67"), não o do cabeçalho dela.
    produtosEServicos: (() => {
      const m = /Lançamentos produtos e serviços\s+(\d{1,3}(?:\.\d{3})*,\d{2})/.exec(texto)
      return m ? brl(m[1]) : null
    })(),
  }
}

/** ⛔ o bloco "Compras parceladas - próximas faturas" — declarado, NUNCA importado */
function lerProximas(texto: string): ProximasItau {
  const i = texto.indexOf('Compras parceladas - próximas faturas')
  if (i < 0) return { proxima: null, demais: null, total: null, linhas: 0 }
  const bloco = texto.slice(i, i + 3000)
  const pega = (r: RegExp) => {
    const m = new RegExp(`${r.source}\\s+(\\d{1,3}(?:\\.\\d{3})*,\\d{2})`).exec(bloco)
    return m ? brl(m[1]) : null
  }
  const fim = bloco.indexOf('Total para próximas faturas')
  const linhas = (fim > 0 ? bloco.slice(0, fim) : bloco)
    .split('\n').filter((l) => DATA_NA_COLUNA.test(l.replace(/^\s+/, '  '))).length
  return {
    proxima: pega(/Próxima fatura/),
    demais: pega(/Demais faturas/),
    total: pega(/Total para próximas faturas/),
    linhas,
  }
}

export function parseItauFaturaPF(texto: string): FaturaItauParsed {
  const vencimento = isoDeData(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/.exec(texto)?.[1])
    ?? isoDeData(/Data de Vencimento[\s\S]{0,200}?(\d{2}\/\d{2}\/\d{4})/.exec(texto)?.[1])
  const emissao = isoDeData(/Emissão:\s*(\d{2}\/\d{2}\/\d{4})/.exec(texto)?.[1])
  // ⚠️ o rótulo é "Nome do Beneficiário/CPF/CNPJ" — sem exigir os 2+ espaços do fim do
  // rótulo, a captura engolia "CPF/CNPJ" junto com o nome.
  const beneficiario = /Nome do Beneficiário[^\n]*?\s{2,}([^\n]+?)\s+-\s+[\d./-]{14,}/
    .exec(texto)?.[1]?.trim() ?? null

  // ⭐ a âncora do ANO é a EMISSÃO (o fechamento do ciclo), não o vencimento: comprar em
  // 03/09 numa fatura que vence 09/09 é normal, e o vencimento pode virar o mês.
  const ancora = emissao ?? vencimento
  const ref = ancora
    ? { ano: Number(ancora.slice(0, 4)), mes: Number(ancora.slice(5, 7)) }
    : { ano: new Date().getUTCFullYear(), mes: new Date().getUTCMonth() + 1 }

  const linhas: LinhaItau[] = []
  const cartoes: CartaoItau[] = []
  const titulares = new Map<string, string>()
  const declaradoPorCartao = new Map<string, number>()

  let portador: string | null = null
  let emProximas = false
  let emProdutos = false

  for (const cru of linhasEmOrdemDeLeitura(texto)) {
    const s = cru.trim()
    if (!s) continue

    const fecha = FECHA_O_CARTAO.exec(s)
    if (fecha) {
      const v = MOEDA_NO_FIM.exec(fecha[2])
      if (v) declaradoPorCartao.set(fecha[1], brl(v[2]))
      portador = null
      continue
    }
    const cab = CABECALHO_DO_CARTAO.exec(s)
    if (cab) { portador = cab[2]; titulares.set(cab[2], cab[1].trim()); continue }

    // ⛔ daqui pra baixo é parcela FUTURA — o banco cobra nas faturas dela
    if (/^Compras parceladas/.test(s)) { emProximas = true; emProdutos = false; portador = null; continue }
    // ⭐ e aqui volta a ser lançamento desta fatura (encargo de atraso)
    if (/^Lançamentos: produtos/.test(s)) { emProximas = false; emProdutos = true; portador = null; continue }
    if (/^Lançamentos: compras/.test(s)) { emProximas = false; emProdutos = false; continue }
    if (emProximas) continue

    const d = DATA_NA_COLUNA.exec(cru)
    if (!d) continue
    const v = MOEDA_NO_FIM.exec(cru.replace(/\s+$/, ''))
    if (!v) continue

    const bruta = cru.slice(d.index + d[0].length, v.index).trim()
    const { descricao, parcelaNumero, parcelaTotal } = separarParcela(bruta)
    if (!descricao) continue
    linhas.push({
      data: resolverAno(d[1], ref),
      descricao,
      valor: brl(v[2]),
      credito: !!v[1],
      parcelaNumero,
      parcelaTotal,
      portador: emProdutos ? null : portador,
      encargo: emProdutos,
    })
  }

  for (const [final, declarado] of declaradoPorCartao) {
    const somado = round2(linhas
      .filter((l) => l.portador === final)
      .reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0))
    cartoes.push({
      final, titular: titulares.get(final) ?? '—', declarado, somado,
      fecha: declarado != null && Math.abs(somado - declarado) <= 0.02,
    })
  }

  const lancamentos = round2(linhas.reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0))
  return {
    banco: 'Itaú/Luizacred',
    vencimento, emissao, beneficiario,
    linhas, cartoes,
    declared: lerResumo(texto),
    computed: { lancamentos },
    proximas: lerProximas(texto),
  }
}

export interface ConferenciaItau {
  /** Σ das linhas lidas (compras dos dois cartões + produtos e serviços) */
  lancamentos: number
  /** o que o PDF declara em "Total dos lançamentos atuais" */
  declarado: number | null
  fecha: boolean
  /** cada cartão bate com o subtotal do próprio bloco? */
  cartoesFecham: boolean
  /** ⭐ o total do boleto, reconstruído pela composição que o resumo escreve */
  totalRecomposto: number | null
  totalDeclarado: number | null
  totalFecha: boolean
}

/**
 * ⭐⭐ A CONFERÊNCIA, com as DUAS provas que o dono pediu.
 *
 * ⛔ E o teto é de 2 centavos, o mesmo do resto do módulo — não é folga de conveniência:
 * é o arredondamento possível numa soma de dezenas de linhas. Esta fatura fecha EXATO.
 */
export function conferirItau(r: FaturaItauParsed): ConferenciaItau {
  const d = r.declared
  const fecha = d.lancamentosAtuais != null
    && Math.abs(r.computed.lancamentos - d.lancamentosAtuais) <= 0.02
  const partes = [d.faturaAnterior, d.pagamentoEfetuado, d.saldoFinanciado, d.encargos, d.lancamentosAtuais]
  const totalRecomposto = partes.every((x) => x != null)
    ? round2(partes.reduce((s, x) => s + (x as number), 0))
    : null
  return {
    lancamentos: r.computed.lancamentos,
    declarado: d.lancamentosAtuais,
    fecha,
    cartoesFecham: r.cartoes.length > 0 && r.cartoes.every((c) => c.fecha),
    totalRecomposto,
    totalDeclarado: d.totalDaFatura,
    totalFecha: totalRecomposto != null && d.totalDaFatura != null
      && Math.abs(totalRecomposto - d.totalDaFatura) <= 0.02,
  }
}
