// Sprint Parser Banrisul (08/08/2026) — parser determinístico do "EXTRATO/
// DOCUMENTO DESCRITIVO DE CRÉDITO" ("BBH - CRÉDITO GERAL") do Banrisul
// (pdftotext -layout). Regex, sem IA. UM contrato por arquivo. Função PURA.
//
// ⚠️ COLUNAS (diferentes de Sicredi/Caixa — ler com o parser errado dá número
//   plausível e ERRADO; ver teste cruzado):
//   PAGAMENTOS EFETUADOS: DATA | PAGAMENTOS | JUROS | CORREÇÃO | AMORTIZAÇÃO | MORA | SALDO
//     IDENTIDADE (aborta se não fechar): JUROS+CORREÇÃO+AMORTIZAÇÃO+MORA = PAGAMENTOS.
//   PARCELAS A PAGAR:    NUM | VENCIMENTO | PARCELA | DESCONTO | MORA | TOTAL  (TOTAL=PARCELA−DESCONTO).
//   LIBERAÇÃO:           DATA | LIBERAÇÃO | IOF FIN | IOF ADIC | TARIFA | VALOR FINANCIADO
//     → amortização é sobre o FINANCIADO (103.398,17 / 134.807,03), não o liberado.
//
// SALDO DEVEDOR = coluna SALDO do ÚLTIMO pagamento (48.888,59 / 36.075,15) — NÃO o
//   "Valor para Liquidação na Data" do cabeçalho (esse é payoff com encargos).
//
// CASOS: (1) parcela em DUAS COTAS = 2 linhas de pagamento na MESMA data → 1
//   parcela (soma cotas). (2) CARÊNCIA de principal (SAC CDI) = 1ªs parcelas com
//   amort 0 (pagas, contam nas "Pagas"; saldo parado). (3) PRÉ: correção 0.
//   PÓS (CDI): correção varia, é o grosso do encargo, parcela futura = estimativa.

import {
  type BankScheduleParser,
  type ParsedScheduleContract,
  type ParsedScheduleInstallment,
  parseBRNumber,
} from './bank-schedule-parser'

const NUM = '[\\d.]+,\\d{2}'
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// As DUAS marcas são obrigatórias (1.2): zero → recusa; documento de outro banco → recusa.
const RE_MARK1 = /EXTRATO\/DOCUMENTO DESCRITIVO DE CR[ÉE]DITO/i
const RE_MARK2 = /BBH\s*-\s*CR[ÉE]DITO GERAL/i

const RE_CONTRATO = /N[ºo]\s*Contrato\.+:\s*(\d+)/i
const RE_SISTEMA = /Sistema de Pagamento\.+:\s*([^\n]+)/i
const RE_CONTRAT_DATA = /Data da Contrata[çc][ãa]o\.+:\s*(\d{2}\/\d{2}\/\d{4})/
const RE_QTD = /Quantidade de Presta[çc][õo]es\.+:\s*(\d+)/
const RE_PAGAS = /Presta[çc][õo]es Pagas\.+:\s*(\d+)/
const RE_APAGAR = /Presta[çc][õo]es a Pagar\.+:\s*(\d+)/
const RE_TAXA_MENSAL = /Taxa de Juros Pr[ée] Fixada \(a\.m\.\)\.+:\s*([\d.]+,\d+)%/
const RE_INDEXADOR = /Indexador\.+:\s*([^\n]+)/

// LIBERAÇÃO: data dd/mm/YYYY + 5 valores com "R$". VALOR FINANCIADO = último.
const RE_LIBERACAO = new RegExp(
  `^\\s*(\\d{2}\\/\\d{2}\\/\\d{4})\\s+R\\$\\s*(${NUM})\\s+R\\$\\s*(${NUM})\\s+R\\$\\s*(${NUM})\\s+R\\$\\s*(${NUM})\\s+R\\$\\s*(${NUM})\\s*$`,
)
// PAGAMENTO: data dd/mm/yy + 6 números (pagamentos, juros, correção, amort, mora, saldo).
const RE_PAGAMENTO = new RegExp(
  `^\\s*(\\d{2}\\/\\d{2}\\/\\d{2})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`,
)
// PARCELA A PAGAR: num + venc dd/mm/yy + 4 números (parcela, desconto, mora, total).
const RE_APAGAR_LINHA = new RegExp(
  `^\\s*(\\d{1,3})\\s+(\\d{2}\\/\\d{2}\\/\\d{2})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`,
)

/** dd/mm/yy (2 dígitos de ano) → ISO YYYY-MM-DD (sempre 20yy). */
function br2ToISO(ddmmyy: string): string {
  const [d, m, y] = ddmmyy.split('/')
  return `20${y}-${m}-${d}`
}

interface RawPay { dateISO: string; pagamentos: number; juros: number; correcao: number; amort: number; mora: number; saldo: number }

export const banrisulScheduleParser: BankScheduleParser = {
  bank: 'Banrisul',
  detects(text: string): boolean {
    return RE_MARK1.test(text) && RE_MARK2.test(text)
  },
  parse(text: string): ParsedScheduleContract[] {
    const contrato = text.match(RE_CONTRATO)?.[1]
    if (!contrato) throw new Error('Banrisul: "Nº Contrato" não encontrado — importação abortada.')
    const qtdPrestacoes = text.match(RE_QTD)?.[1] ? parseInt(text.match(RE_QTD)![1], 10) : null
    const pagasHeader = text.match(RE_PAGAS)?.[1] ? parseInt(text.match(RE_PAGAS)![1], 10) : null
    const aPagarHeader = text.match(RE_APAGAR)?.[1] ? parseInt(text.match(RE_APAGAR)![1], 10) : null
    if (qtdPrestacoes == null || pagasHeader == null || aPagarHeader == null) {
      throw new Error('Banrisul: cabeçalho sem Quantidade/Pagas/A Pagar de prestações — importação abortada.')
    }
    const sistemaRaw = (text.match(RE_SISTEMA)?.[1] ?? '').toUpperCase()
    const sistema: 'PRICE' | 'SAC' | null =
      sistemaRaw.startsWith('PRICE') ? 'PRICE' : sistemaRaw.startsWith('SAC') ? 'SAC' : null
    const indexador = text.match(RE_INDEXADOR)?.[1]?.trim() || (sistemaRaw.includes('CDI') ? 'CDI' : null)
    const taxaMensal = text.match(RE_TAXA_MENSAL)?.[1] ? parseBRNumber(text.match(RE_TAXA_MENSAL)![1]) : null

    // ── 1. Liberação → VALOR FINANCIADO (última coluna) ──
    let valorFinanciado = 0
    // ── 2. Pagamentos + Parcelas a pagar, por seção ──
    const rawPays: RawPay[] = []
    const aPagar: Array<{ number: number; dueDate: string; parcela: number; desconto: number; total: number }> = []
    let secPag = false, secAPagar = false

    for (const line of text.split(/\r?\n/)) {
      if (/PAGAMENTOS\s+EFETUADOS/i.test(line)) { secPag = true; secAPagar = false; continue }
      if (/PARCELAS\s+A\s+PAGAR/i.test(line)) { secPag = false; secAPagar = true; continue }

      const lib = line.match(RE_LIBERACAO)
      if (lib) { valorFinanciado = parseBRNumber(lib[6]); continue }

      if (secPag) {
        const m = line.match(RE_PAGAMENTO)
        if (!m) continue
        const pagamentos = parseBRNumber(m[2]), juros = parseBRNumber(m[3]), correcao = parseBRNumber(m[4])
        const amort = parseBRNumber(m[5]), mora = parseBRNumber(m[6]), saldo = parseBRNumber(m[7])
        // IDENTIDADE OBRIGATÓRIA: JUROS+CORREÇÃO+AMORTIZAÇÃO+MORA = PAGAMENTOS.
        const soma = r2(juros + correcao + amort + mora)
        if (Math.abs(soma - pagamentos) > 0.02) {
          throw new Error(
            `Banrisul ${contrato}: linha de pagamento ${m[1]} não fecha — ${juros}+${correcao}+${amort}+${mora}=${soma} ≠ ${pagamentos}. Leitura inconsistente, importação abortada.`,
          )
        }
        rawPays.push({ dateISO: br2ToISO(m[1]), pagamentos, juros, correcao, amort, mora, saldo })
        continue
      }
      if (secAPagar) {
        const m = line.match(RE_APAGAR_LINHA)
        if (!m) continue
        const parcela = parseBRNumber(m[3]), desconto = parseBRNumber(m[4]), total = parseBRNumber(m[6])
        aPagar.push({ number: parseInt(m[1], 10), dueDate: br2ToISO(m[2]), parcela, desconto, total })
      }
    }

    if (valorFinanciado <= 0) throw new Error(`Banrisul ${contrato}: linha de liberação (VALOR FINANCIADO) não encontrada — importação abortada.`)
    if (rawPays.length === 0) throw new Error(`Banrisul ${contrato}: nenhum pagamento efetuado reconhecido — importação abortada.`)

    // ── 3. Merge de COTAS: pagamentos consecutivos na MESMA data = 1 parcela ──
    const paid: RawPay[] = []
    for (const p of rawPays) {
      const prev = paid[paid.length - 1]
      if (prev && prev.dateISO === p.dateISO) {
        prev.pagamentos = r2(prev.pagamentos + p.pagamentos)
        prev.juros = r2(prev.juros + p.juros)
        prev.correcao = r2(prev.correcao + p.correcao)
        prev.amort = r2(prev.amort + p.amort)
        prev.mora = r2(prev.mora + p.mora)
        prev.saldo = p.saldo // saldo da última cota
      } else {
        paid.push({ ...p })
      }
    }

    // ── 4. VALIDAÇÕES de contagem (nunca gravar leitura errada) ──
    if (paid.length !== pagasHeader) {
      throw new Error(`Banrisul ${contrato}: parcelas pagas lidas (${paid.length}) ≠ "Prestações Pagas" do cabeçalho (${pagasHeader}). Importação abortada.`)
    }
    if (aPagar.length !== aPagarHeader) {
      throw new Error(`Banrisul ${contrato}: parcelas a pagar lidas (${aPagar.length}) ≠ "Prestações a Pagar" (${aPagarHeader}). Importação abortada.`)
    }
    if (paid.length + aPagar.length !== qtdPrestacoes) {
      throw new Error(`Banrisul ${contrato}: pagas (${paid.length}) + a pagar (${aPagar.length}) ≠ Quantidade de Prestações (${qtdPrestacoes}). Importação abortada.`)
    }

    const saldoDevedor = paid[paid.length - 1].saldo

    // ── 5. Amortização ESTIMADA das parcelas a pagar (futuro) ──
    // SAC: amortização é CONSTANTE (baixa fixa) — usa a amort recorrente das pagas.
    // PRICE: amort_i = PARCELA_i − opening_i × taxaMensal (encadeado). Ambos flagados
    // como estimativa no apply (pós-fixado) — o documento avisa que futuro é estimativa.
    const amortsPagas = paid.filter((p) => p.amort > 0).map((p) => p.amort)
    const sacAmort = amortsPagas.length > 0 ? amortsPagas[amortsPagas.length - 1] : 0
    const rate = (taxaMensal ?? 0) / 100
    let openingFut = saldoDevedor
    const futuras: ParsedScheduleInstallment[] = aPagar.map((a) => {
      let amortEst: number
      if (sistema === 'SAC' && sacAmort > 0) amortEst = sacAmort
      else amortEst = r2(a.parcela - openingFut * rate)
      amortEst = Math.min(Math.max(amortEst, 0), openingFut) // clamp [0, saldo]
      openingFut = r2(openingFut - amortEst)
      return {
        number: a.number, situacao: 'NORMAL', dueDate: a.dueDate,
        encargosProvisionados: 0, encargosTotais: 0, // NORMAL: encargo futuro é estimativa, não entra no DRE
        valorPrincipal: amortEst, valorParcela: a.parcela,
      }
    })

    // ── 6. Parcelas pagas → installments (numeradas 1..P na ordem do documento) ──
    const pagas: ParsedScheduleInstallment[] = paid.map((p, i) => ({
      number: i + 1, situacao: 'LIQUIDADO', dueDate: p.dateISO,
      encargosProvisionados: 0,
      encargosTotais: r2(p.pagamentos - p.amort), // = juros + correção + mora (tudo despesa financeira)
      valorPrincipal: p.amort, valorParcela: p.pagamentos,
      juros: p.juros,
    }))

    // carência de principal (Banrisul) = 1ªs parcelas PAGAS com amort 0 (informativo).
    let carenciaMeses = 0
    for (const p of pagas) { if (p.valorPrincipal === 0) carenciaMeses++; else break }

    const installments = [...pagas, ...futuras]

    return [{
      contractNumber: contrato, // verbatim (zero-padded) → match exato com o Loan
      numParcelas: qtdPrestacoes, // total de prestações (Banrisul: carência são pagas, dentro do total)
      dataContratacao: text.match(RE_CONTRAT_DATA)?.[1] ? `${text.match(RE_CONTRAT_DATA)![1].split('/').reverse().join('-')}` : null,
      saldoDevedor,
      valorFinanciado,
      jurosNormaisAnual: null,
      sistemaAmortizacao: sistema,
      taxaJurosMensal: taxaMensal,
      indexador: indexador ?? null,
      carenciaMeses,
      prazoTotalMeses: qtdPrestacoes,
      installments,
    }]
  },
}
