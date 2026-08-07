// Sprint Importar Agenda (04/08/2026) — parser determinístico do documento Sicredi
// "RELAÇÃO DE TÍTULOS CADASTRADOS EM ORDEM DE TÍTULO E COMPOSIÇÃO".
// Regex, sem IA. Um arquivo traz VÁRIOS contratos; cabeçalho pode repetir por
// página (merge por contractNumber). Função PURA — recebe o texto já extraído.
//
// Cabeçalho:
//   Titulo .........: C41022227-1
//   Nro de Parcelas : 058          Data Contratacao: 23/07/2024
//   Saldo Devedor ..: 157.894,84
//   Valor Financiado: 250.000,00   Juros Normais ..: 22,7200% a.a.
// Linha de parcela (8 colunas):
//   Parc Situacao Percentual Vencimento EncProvisionados EncTotais ValPrincipal ValParcela
//   022 Liquidado 2,70 15/07/2026 0,00 2.753,89 4.385,96 7.139,85

import {
  type BankScheduleParser,
  type ParsedScheduleContract,
  type ParsedScheduleInstallment,
  parseBRNumber,
  brDateToISO,
} from './bank-schedule-parser'

const NUM = '[\\d.]+,\\d{2}'
// grupos: 1 contrato
const RE_TITULO = /T[íi]tulo\s*\.*\s*:\s*([A-Za-z0-9-]+)/
const RE_PARCELAS = /Nro de Parcelas\s*:\s*(\d+)/
const RE_CONTRAT = /Data Contrata[cç][aã]o\s*:\s*(\d{2}\/\d{2}\/\d{4})/
const RE_SALDO = new RegExp(`Saldo Devedor\\s*\\.*\\s*:\\s*(${NUM})`)
const RE_FINANC = new RegExp(`Valor Financiado\\s*:\\s*(${NUM})`)
const RE_JUROS = new RegExp(`Juros Normais\\s*\\.*\\s*:\\s*([\\d.]+,\\d{2,4})\\s*%`)
// linha de parcela — 8 colunas
const RE_PARCELA = new RegExp(
  `^\\s*(\\d{1,3})\\s+(Liquidado|Normal)\\s+${NUM}\\s+(\\d{2}\\/\\d{2}\\/\\d{4})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s+(${NUM})\\s*$`,
)

function parseHeader(block: string): Omit<ParsedScheduleContract, 'installments'> | null {
  const titulo = block.match(RE_TITULO)?.[1]
  if (!titulo) return null
  const parcelas = block.match(RE_PARCELAS)?.[1]
  const saldo = block.match(RE_SALDO)?.[1]
  const financ = block.match(RE_FINANC)?.[1]
  const contrat = block.match(RE_CONTRAT)?.[1]
  const juros = block.match(RE_JUROS)?.[1]
  return {
    contractNumber: titulo,
    numParcelas: parcelas ? parseInt(parcelas, 10) : 0,
    dataContratacao: contrat ? brDateToISO(contrat) : null,
    saldoDevedor: saldo ? parseBRNumber(saldo) : 0,
    valorFinanciado: financ ? parseBRNumber(financ) : 0,
    jurosNormaisAnual: juros ? parseBRNumber(juros) : null,
  }
}

function parseInstallments(block: string): ParsedScheduleInstallment[] {
  const out: ParsedScheduleInstallment[] = []
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(RE_PARCELA)
    if (!m) continue
    out.push({
      number: parseInt(m[1], 10),
      situacao: m[2] === 'Liquidado' ? 'LIQUIDADO' : 'NORMAL',
      dueDate: brDateToISO(m[3]),
      encargosProvisionados: parseBRNumber(m[4]),
      encargosTotais: parseBRNumber(m[5]),
      valorPrincipal: parseBRNumber(m[6]),
      valorParcela: parseBRNumber(m[7]),
    })
  }
  return out
}

export const sicrediScheduleParser: BankScheduleParser = {
  bank: 'Sicredi',
  detects(text: string): boolean {
    // "Titulo ...: C4102..." + "Nro de Parcelas" são marcas do layout Sicredi.
    return RE_TITULO.test(text) && /Nro de Parcelas/i.test(text)
  },
  parse(text: string): ParsedScheduleContract[] {
    // Split em blocos por "Titulo" (o cabeçalho repete por página).
    const parts = text.split(/(?=T[íi]tulo\s*\.*\s*:)/)
    const byContract = new Map<string, ParsedScheduleContract>()
    for (const block of parts) {
      const header = parseHeader(block)
      if (!header) continue
      const insts = parseInstallments(block)
      const existing = byContract.get(header.contractNumber)
      if (existing) {
        // mesma nota repetida por quebra de página — mescla parcelas (dedupe por number)
        const seen = new Set(existing.installments.map((i) => i.number))
        for (const i of insts) if (!seen.has(i.number)) existing.installments.push(i)
        // reforça o cabeçalho quando o 1º bloco veio truncado
        if (!existing.saldoDevedor && header.saldoDevedor) existing.saldoDevedor = header.saldoDevedor
        if (!existing.valorFinanciado && header.valorFinanciado) existing.valorFinanciado = header.valorFinanciado
      } else {
        byContract.set(header.contractNumber, { ...header, installments: insts })
      }
    }
    for (const c of byContract.values()) c.installments.sort((a, b) => a.number - b.number)
    return [...byContract.values()]
  },
}
