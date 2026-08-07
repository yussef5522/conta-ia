// Sprint Parser Caixa (06/08/2026) — parser determinístico do "DEMOSTRATIVO DE
// EVOLUÇÃO CONTRATUAL" da Caixa (pdftotext -layout). Regex, sem IA. Um arquivo =
// UM contrato (diferente do Sicredi, que traz vários). Função PURA.
//
// ⚠️ ARMADILHA (as colunas significam OUTRA coisa que no Sicredi):
//   CAIXA: "Valor da Parcela" = AMORTIZAÇÃO · "Valor total pago" = TOTAL PAGO
//          juros vêm no movimento (Tipo=Juros) · enc. por atraso em sub-linha.
//   Mapeamento pra interface genérica: valorPrincipal=amort, valorParcela=total,
//   encargosTotais = total − amort (= juros + enc + resíduo).
//
// VALIDAÇÃO OBRIGATÓRIA (nunca gravar leitura errada):
//   amortização <= total pago  E  resíduo (total−amort−juros−enc) >= 0.
//   Resíduo é um 2º encargo de mora real (cresce: #18 3,62 … #29 18,13) que o
//   relatório não lista como linha → classificado como DESPESA FINANCEIRA.
//
// Saldo: ancorado no "Saldo Devedor Atualizado" do CABEÇALHO (14.116,29), NÃO na
// coluna Saldo Devedor da última linha (artefato do relatório: 102.427,10).

import {
  type BankScheduleParser,
  type ParsedScheduleContract,
  type ParsedScheduleInstallment,
  type ParsedCarencia,
  parseBRNumber,
  brDateToISO,
  monthsBetweenISO,
} from './bank-schedule-parser'

const NUM = '[\\d.]+,\\d{2}'
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const RE_MARKER = /EVOLU[ÇC][ÃA]O CONTRATUAL/i
// contractNumber VERBATIM (com zeros à esquerda) — o Loan é cadastrado com o
// número zero-padded ("000000000001837311"), e o match do preview é exato
// (`loan.contractNumber === c.contractNumber`). Tirar os zeros quebraria o match.
const RE_CONTRATO = /Nr\.?\s*Contrato:\s*(\d+)/i
const RE_SALDO = new RegExp(`Saldo Devedor Atualizado\\s+(${NUM})`)
const RE_FINANC = new RegExp(`Total financiado\\s+(${NUM})`)
const RE_CONTRAT_DATA = /Data de Contrata[çc][ãa]o\s+(\d{2}\/\d{2}\/\d{4})/
const RE_PRAZO = /Prazo total \(Meses\)\s+(\d+)/
const RE_REMANESCENTE = /Prazo Remanescente\s+(\d+)/
const RE_ULTIMO_VENC = /Data [úu]ltimo vencimento\s+(\d{2}\/\d{2}\/\d{4})/
const RE_JUROS_ANUAL = /Taxa de juros anual nominal\s+([\d.]+,\d{2,4})/
const RE_TAXA_MENSAL = /Taxa de juros contratada\s+([\d.]+,\d{2,4})/
const RE_SISTEMA = /Sistema de pagamento\s+(\w+)/i
// indexador: só o resto DA MESMA linha (nunca cruza \n — senão pega a linha
// seguinte). Vazio = pré-fixado.
const RE_INDEXADOR = /Indexador[ \t]*([^\n]*)/

// linha de parcela: N | venc | AMORT | Juros | JUROS | (N )?PG | saldo | total
const RE_PARCELA = new RegExp(
  `^\\s*(\\d{1,3})\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(${NUM})\\s+Juros\\s+(${NUM})\\s+(N PG|PG)\\s+(${NUM})\\s+(${NUM})\\s*$`,
)
// carência: "CARÊNCIA" | valorParcela(0,00) | movimento(juro capitalizado) | (N )?PG | saldo | total(0,00)
const RE_CARENCIA = new RegExp(
  `^\\s*CAR[ÊE]NCIA\\s+(${NUM})\\s+(${NUM})\\s+(N PG|PG)\\s+(${NUM})\\s+(${NUM})\\s*$`,
)
// sub-linha de encargo por atraso (pertence à parcela acima)
const RE_ENC_ATRASO = new RegExp(`^\\s*ENC\\.?\\s*POR\\s+ATRASO\\s+(${NUM})\\s+(N PG|PG)\\s*$`)

interface CaixaHeader {
  base: Omit<ParsedScheduleContract, 'installments' | 'carencia' | 'numParcelas'>
  prazoTotalMeses: number | null
  prazoRemanescente: number | null
  ultimoVencimento: string | null // ISO
}

function parseHeader(text: string): CaixaHeader | null {
  const contrato = text.match(RE_CONTRATO)?.[1]
  if (!contrato) return null
  const sistemaRaw = text.match(RE_SISTEMA)?.[1]?.toUpperCase()
  const sistema: 'PRICE' | 'SAC' | null =
    sistemaRaw === 'PRICE' ? 'PRICE' : sistemaRaw === 'SAC' ? 'SAC' : null
  const indexadorRaw = text.match(RE_INDEXADOR)?.[1]?.trim()
  const ultimoVenc = text.match(RE_ULTIMO_VENC)?.[1]
  return {
    base: {
      contractNumber: contrato, // verbatim (zero-padded) → match exato com o Loan
      dataContratacao: text.match(RE_CONTRAT_DATA)?.[1] ? brDateToISO(text.match(RE_CONTRAT_DATA)![1]) : null,
      saldoDevedor: text.match(RE_SALDO)?.[1] ? parseBRNumber(text.match(RE_SALDO)![1]) : 0,
      valorFinanciado: text.match(RE_FINANC)?.[1] ? parseBRNumber(text.match(RE_FINANC)![1]) : 0,
      jurosNormaisAnual: text.match(RE_JUROS_ANUAL)?.[1] ? parseBRNumber(text.match(RE_JUROS_ANUAL)![1]) : null,
      sistemaAmortizacao: sistema,
      taxaJurosMensal: text.match(RE_TAXA_MENSAL)?.[1] ? parseBRNumber(text.match(RE_TAXA_MENSAL)![1]) : null,
      indexador: indexadorRaw ? indexadorRaw : null,
    },
    prazoTotalMeses: text.match(RE_PRAZO)?.[1] ? parseInt(text.match(RE_PRAZO)![1], 10) : null,
    prazoRemanescente: text.match(RE_REMANESCENTE)?.[1] ? parseInt(text.match(RE_REMANESCENTE)![1], 10) : null,
    ultimoVencimento: ultimoVenc ? brDateToISO(ultimoVenc) : null,
  }
}

export const caixaScheduleParser: BankScheduleParser = {
  bank: 'Caixa Econômica Federal',
  detects(text: string): boolean {
    return RE_MARKER.test(text)
  },
  parse(text: string): ParsedScheduleContract[] {
    const header = parseHeader(text)
    if (!header) return []

    const installments: ParsedScheduleInstallment[] = []
    const carenciaSaldos: number[] = []
    let carenciaJuros = 0
    let last: ParsedScheduleInstallment | null = null
    const rawByNumber = new Map<number, { amort: number; juros: number; total: number; npg: boolean }>()

    for (const line of text.split(/\r?\n/)) {
      const car = line.match(RE_CARENCIA)
      if (car) {
        carenciaJuros = r2(carenciaJuros + parseBRNumber(car[2]))
        carenciaSaldos.push(parseBRNumber(car[4]))
        last = null
        continue
      }
      const enc = line.match(RE_ENC_ATRASO)
      if (enc) {
        // pertence à parcela acima
        if (last) last.encAtraso = r2((last.encAtraso ?? 0) + parseBRNumber(enc[1]))
        continue
      }
      const m = line.match(RE_PARCELA)
      if (!m) { last = null; continue }
      const number = parseInt(m[1], 10)
      const amort = parseBRNumber(m[3])
      const juros = parseBRNumber(m[4])
      const npg = m[5] === 'N PG'
      const totalCol = parseBRNumber(m[7])
      const inst: ParsedScheduleInstallment = {
        number,
        situacao: npg ? 'NORMAL' : 'LIQUIDADO',
        dueDate: brDateToISO(m[2]),
        encargosProvisionados: 0,
        // preenchido no pós-processamento (precisa do enc. por atraso da sub-linha)
        encargosTotais: 0,
        valorPrincipal: amort,
        valorParcela: 0,
        juros,
        encAtraso: 0,
        residuo: 0,
      }
      installments.push(inst)
      rawByNumber.set(number, { amort, juros, total: totalCol, npg })
      last = inst
    }

    // Pós-processamento: fecha encargos, resíduo e valida.
    for (const inst of installments) {
      const raw = rawByNumber.get(inst.number)!
      const encAtraso = inst.encAtraso ?? 0
      if (inst.situacao === 'LIQUIDADO') {
        const total = raw.total // "Valor total pago"
        // VALIDAÇÃO: amortização não pode exceder o total pago.
        if (raw.amort > total + 0.01) {
          throw new Error(
            `Parcela #${inst.number}: amortização (${raw.amort.toFixed(2)}) > total pago (${total.toFixed(2)}) — leitura inconsistente do documento, importação abortada.`,
          )
        }
        const residuo = r2(total - raw.amort - raw.juros - encAtraso)
        // VALIDAÇÃO: resíduo negativo = leitura errada.
        if (residuo < -0.01) {
          throw new Error(
            `Parcela #${inst.number}: resíduo negativo (${residuo.toFixed(2)}) [total ${total.toFixed(2)} − amort ${raw.amort.toFixed(2)} − juros ${raw.juros.toFixed(2)} − enc ${encAtraso.toFixed(2)}] — leitura inconsistente, importação abortada.`,
          )
        }
        inst.residuo = Math.max(0, residuo)
        inst.valorParcela = total
        inst.encargosTotais = r2(total - raw.amort) // = juros + enc + resíduo
      } else {
        // N PG: "Valor total pago" = 0 (não paga). Usa o AGENDADO amort + juros.
        inst.residuo = 0
        inst.encargosTotais = raw.juros
        inst.valorParcela = r2(raw.amort + raw.juros)
      }
    }

    installments.sort((a, b) => a.number - b.number)

    // ── nº de PARCELAS derivado pelas DATAS, não pela contagem de linhas ──
    // (a 1ª linha "CARÊNCIA" é a data de contratação, não capitalização; e a
    //  última carência é implícita → contar linha dá 1 a menos). Confiável:
    //  parcelas = meses da 1ª parcela ao último vencimento (inclusive).
    if (installments.length === 0) {
      throw new Error('Documento sem parcelas amortizantes reconhecidas — importação abortada.')
    }
    const prazoTotal = header.prazoTotalMeses
    if (!prazoTotal) throw new Error('Documento sem "Prazo total (Meses)" — importação abortada.')
    if (!header.ultimoVencimento) throw new Error('Documento sem "Data último vencimento" — importação abortada.')
    const primeiraParcela = installments[0].dueDate
    const numParcelas = monthsBetweenISO(primeiraParcela, header.ultimoVencimento) + 1
    const carenciaMeses = prazoTotal - numParcelas

    // VALIDAÇÃO 1 (obrigatória): carência + parcelas == prazo total.
    if (carenciaMeses < 0 || carenciaMeses + numParcelas !== prazoTotal) {
      throw new Error(
        `Prazo inconsistente: ${numParcelas} parcelas + ${carenciaMeses} carência ≠ ${prazoTotal} (prazo total). Importação abortada.`,
      )
    }
    // VALIDAÇÃO 2: pagas + remanescente ≈ nº de parcelas (tolerância 1, pois o
    // remanescente conta a partir da data de emissão).
    const pagas = installments.filter((i) => i.situacao === 'LIQUIDADO').length
    if (header.prazoRemanescente != null) {
      const somaCheck = pagas + header.prazoRemanescente
      if (Math.abs(somaCheck - numParcelas) > 1) {
        throw new Error(
          `Contagem inconsistente: pagas (${pagas}) + remanescente (${header.prazoRemanescente}) = ${somaCheck}, esperado ~${numParcelas} parcelas. Importação abortada.`,
        )
      }
    }

    // carência: MESES derivados (não a contagem de linhas). Capitalização/saldo
    // vêm das linhas parseadas (informativo).
    const carencia: ParsedCarencia | null =
      carenciaMeses > 0
        ? {
            count: carenciaMeses,
            jurosCapitalizadoTotal: carenciaJuros,
            saldoInicial: carenciaSaldos[0] ?? 0,
            saldoFinal: carenciaSaldos[carenciaSaldos.length - 1] ?? 0,
          }
        : null

    return [{
      ...header.base,
      numParcelas,
      carenciaMeses,
      prazoTotalMeses: prazoTotal,
      installments,
      carencia,
    }]
  },
}
