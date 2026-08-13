// Sprint Contraparte PIX (31/07/2026) — parser DETERMINÍSTICO do extrato PDF do
// Banrisul (camada de texto, pdftotext -layout). Sem Claude Vision: sem custo,
// sem timeout, sem alucinação. Layout real (Pro Fit Itaqui, ag 0230, jul/2026):
//
//   DIA HISTORICO           DOCUMENTO        V A L O R
//   01   REND CDB AUT       0000RC                0,03
//        PIX RECEBIDO       355540              129,90
//         NOME: JOAO FRANCISCO RODRIGUES FILHO
//   06   PIX ENVIADO        198074            1.215,00-
//         NOME: MARCOS ADRIEL LEAL KERNBAUM
//
// Regras (verificadas no arquivo real):
//  - DD só na 1ª linha do dia; as demais herdam o dia corrente.
//  - Colunas separadas por 2+ espaços: DIA | HISTORICO | DOCUMENTO | VALOR.
//  - VALOR pt-BR (1.234,56); NEGATIVO = '-' NO FIM.
//  - "NOME:" (sem pontos) vem logo abaixo e pertence ao lançamento anterior. Opcional.
//  - \f (form feed) pode grudar o "NOME:" no topo da página seguinte — tratado
//    (form feed vira \n e o NOME sempre gruda no ÚLTIMO lançamento visto).
//  - DOCUMENTO alfanumérico (0000RC) ou 000000 (placeholder compartilhado).

import type {
  BankStatementHeader,
  BankStatementLine,
  BankStatementPdfParser,
  ParsedBankStatement,
  StatementPeriod,
} from './types'
import { BankStatementParseError } from './types'

const VALOR_RE = /^\d[\d.]*,\d{2}-?$/
const DOC_RE = /^[A-Za-z0-9]+$/

/** Linhas que NÃO são lançamento (cabeçalho, rodapé, saldos). */
function isIgnorable(line: string): boolean {
  const u = line.trim().toUpperCase()
  if (!u) return true
  return (
    u.startsWith('SALDO') || // SALDO NA DATA, SALDO ANT EM
    u.includes('MOVIMENTOS') || // ++ MOVIMENTOS
    u.includes('HIST') && u.includes('DOCUMENTO') || // cabeçalho da tabela
    u.startsWith('BANRISUL') ||
    u.replace(/\s+/g, '').startsWith('BANRISUL') || // "B A N R I S U L"
    u.startsWith('AGENCIA') ||
    u.startsWith('CONTA') ||
    /^NOME\.{2,}/.test(u) || // "NOME...:" do cabeçalho (com pontos)
    u.startsWith('SAC') ||
    u.includes('OUVIDORIA') ||
    u.includes('EXTRATO EMITIDO') ||
    u.includes('IDENTIFICACAO') ||
    u.includes('IDENTIFICAÇÃO')
  )
}

/** "1.215,00-" → { amount: 1215, signed: -1215 } · "0,03" → { amount: 0.03, signed: 0.03 } */
export function parseBrlAmount(raw: string): { amount: number; signed: number } | null {
  const s = raw.trim()
  if (!VALOR_RE.test(s)) return null
  const neg = s.endsWith('-')
  const num = parseFloat(s.replace(/-$/, '').replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(num)) return null
  return { amount: Math.abs(num), signed: neg ? -Math.abs(num) : Math.abs(num) }
}

/** "03/08/2026" → "2026-08-03" (ISO). Null se inválida. */
function brDateToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = +dd, mo = +mm
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Extrai o PERÍODO do extrato Banrisul. Necessário pro Nível 2 (chave data+valor)
 * ser seguro: sem período, um "dia 05 + R$ 1.215" de agosto casaria com um de
 * junho. Tenta o rótulo "PERÍODO ... a ..." e, como reforço, duas datas dd/mm/aaaa
 * ligadas por "a"/"à"/"até"/"-". Se não achar, devolve null → o caller AVISA e
 * NÃO liga o Nível 2 (conservador: melhor não enriquecer que casar mês errado).
 */
export function extractStatementPeriod(text: string): StatementPeriod | null {
  const D = String.raw`(\d{2}\/\d{2}\/\d{4})`
  const SEP = String.raw`\s*(?:a|à|até|ate|A|-|\/)\s*`
  const patterns = [
    new RegExp(String.raw`PER[IÍ]ODO[^\d]{0,40}${D}${SEP}${D}`, 'i'),
    new RegExp(String.raw`(?:MOVIMENTA[ÇC][ÃA]O|EXTRATO|LAN[ÇC]AMENTOS?)[^\d]{0,40}${D}${SEP}${D}`, 'i'),
    new RegExp(`${D}${SEP}${D}`),
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const start = brDateToIso(m[1])
      const end = brDateToIso(m[2])
      if (start && end && start <= end) return { start, end }
    }
  }
  return null
}

/**
 * Resolve a data COMPLETA de cada linha a partir do período + dia. O Banrisul
 * lista cronologicamente; quando o dia DECRESCE, virou o mês (cobre PDF de vários
 * meses num upload só). Sem período → todas as datas ficam null (Nível 2 off).
 */
function resolveLineDates(lines: BankStatementLine[], period: StatementPeriod | null): void {
  if (!period) return
  const [sy, sm] = period.start.split('-').map(Number)
  let year = sy
  let month = sm
  let prevDay = 0
  for (const l of lines) {
    if (l.day <= 0) continue
    if (prevDay > 0 && l.day < prevDay) {
      month++
      if (month > 12) { month = 1; year++ }
    }
    prevDay = l.day
    l.date = `${year}-${String(month).padStart(2, '0')}-${String(l.day).padStart(2, '0')}`
  }
}

function extractHeader(text: string): BankStatementHeader {
  const ag = text.match(/AG[EÊ]NCIA\.*\s*:\s*([\dXx.\-]+)/i)
  // BUG 11/08: o Banrisul tem DOIS formatos de conta no cabeçalho —
  //   "CONTA..: 0605534106"    (sem formatação, jul/2026)
  //   "CONTA..: 06.055341.0-6" (com pontos/hífen, ago/2026)
  // O char class antigo `[\dXx-]` NÃO incluía o ponto → parava no 1º ponto e
  // pegava só "06". Inclui `.` no class; a comparação normaliza (só dígitos).
  const cc = text.match(/CONTA\.*\s*:\s*([\dXx.\-]+)/i)
  const nome = text.match(/NOME\.{2,}\s*:\s*(.+)/i)
  return {
    agencia: ag ? ag[1].trim() : null,
    conta: cc ? cc[1].trim() : null,
    titular: nome ? nome[1].trim() : null,
  }
}

class BanrisulPdfParser implements BankStatementPdfParser {
  readonly bank = 'BANRISUL'

  parse(text: string): ParsedBankStatement {
    if (!text || text.replace(/\s/g, '').length < 20) {
      throw new BankStatementParseError(
        'NO_TEXT_LAYER',
        'PDF sem texto — use o extrato digital do banco (não a versão escaneada).',
      )
    }
    // form feed vira quebra de linha (trata gluing do "NOME:" no topo da página).
    const norm = text.replace(/\r\n?/g, '\n').replace(/\f/g, '\n')
    const rawLines = norm.split('\n')

    const header = extractHeader(norm)
    const lines: BankStatementLine[] = []
    let currentDay: number | null = null

    for (const raw of rawLines) {
      if (!raw.trim()) continue

      // NOME: (sem pontos) → pertence ao ÚLTIMO lançamento
      const nameM = raw.match(/^\s*NOME\s*:\s*(.+?)\s*$/i)
      if (nameM && !/^\s*NOME\.{2,}/.test(raw)) {
        const last = lines[lines.length - 1]
        if (last && last.counterpartyName == null) last.counterpartyName = nameM[1].trim()
        continue
      }

      if (isIgnorable(raw)) continue

      // Dia no começo? (DD seguido de 2+ espaços, sem indentação)
      let body = raw
      const dayM = raw.match(/^(\d{2})\s{2,}(.+)$/)
      if (dayM && +dayM[1] >= 1 && +dayM[1] <= 31) {
        currentDay = +dayM[1]
        body = dayM[2]
      }

      const parts = body
        .trim()
        .split(/\s{2,}/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parts.length < 3) continue // saldo/summary sem documento → ignora

      const valor = parseBrlAmount(parts[parts.length - 1])
      const documento = parts[parts.length - 2]
      if (!valor || !DOC_RE.test(documento)) continue // não é lançamento padrão

      const historico = parts.slice(0, parts.length - 2).join(' ').trim()
      lines.push({
        day: currentDay ?? 0,
        historico,
        documento,
        amount: valor.amount,
        signed: valor.signed,
        counterpartyName: null,
        date: null,
      })
    }

    // Sprint Contraparte-Banrisul FASE 4 (13/08): período + data completa por
    // linha (chave segura do Nível 2). Ambos podem faltar (período ilegível).
    const period = extractStatementPeriod(norm)
    resolveLineDates(lines, period)

    return { header, lines, period }
  }
}

export const banrisulPdfParser: BankStatementPdfParser = new BanrisulPdfParser()
