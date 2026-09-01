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
  SaldoDoDia,
  SaldoSnapshot,
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
const MESES_PT: Record<string, string> = {
  JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
  JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
}

export function extractStatementPeriod(text: string): StatementPeriod | null {
  const D = String.raw`(\d{2}\/\d{2}\/\d{4})`
  const SEP = String.raw`\s*(?:a|à|até|ate|A|-)\s*` // NÃO inclui "/" (quebrava dd/mm/aaaa)

  // 1. Rótulo explícito "PERÍODO ... a ..." (dois dd/mm/aaaa).
  for (const re of [
    new RegExp(String.raw`PER[IÍ]ODO[^\d]{0,40}${D}${SEP}${D}`, 'i'),
    new RegExp(String.raw`(?:MOVIMENTA[ÇC][ÃA]O|LAN[ÇC]AMENTOS?)[^\d]{0,40}${D}${SEP}${D}`, 'i'),
  ]) {
    const m = text.match(re)
    const start = m && brDateToIso(m[1])
    const end = m && brDateToIso(m[2])
    if (start && end && start <= end) return { start, end }
  }

  // 2. BANRISUL (13/08): o cabeçalho NÃO traz "PERÍODO dd/mm a dd/mm". Traz:
  //    "++ MOVIMENTOS AGO/2026"       → mês/ano (resolve o dia-só das linhas)
  //    "SALDO ANT EM 31/07/2026"      → dia ANTERIOR ao início (start = +1)
  //    "EXTRATO EMITIDO AS HH:MM DE 13/08/2026" → emissão (fim do período)
  const mov = text.match(/MOVIMENTOS?\s+([A-Za-z]{3})\s*\/\s*(\d{4})/)
  if (mov) {
    const mm = MESES_PT[mov[1].toUpperCase()]
    if (mm) {
      const year = mov[2]
      // início: dia seguinte ao "SALDO ANT EM"; senão 1º do mês.
      let start = `${year}-${mm}-01`
      const saldoAnt = text.match(/SALDO\s+ANT.*?(\d{2})\/(\d{2})\/(\d{4})/i)
      if (saldoAnt) {
        const d = new Date(`${saldoAnt[3]}-${saldoAnt[2]}-${saldoAnt[1]}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + 1)
        start = d.toISOString().slice(0, 10)
      }
      // fim: data do "EXTRATO EMITIDO"; senão último dia do mês.
      let end = new Date(Date.UTC(Number(year), Number(mm), 0)).toISOString().slice(0, 10)
      const emit = text.match(/EXTRATO\s+EMITIDO.*?(\d{2})\/(\d{2})\/(\d{4})/i)
      if (emit) end = `${emit[3]}-${emit[2]}-${emit[1]}`
      if (start <= end) return { start, end }
    }
  }

  // 3. Fallback genérico: dois dd/mm/aaaa adjacentes (menos confiável).
  const g = text.match(new RegExp(`${D}${SEP}${D}`))
  const gs = g && brDateToIso(g[1])
  const ge = g && brDateToIso(g[2])
  if (gs && ge && gs <= ge) return { start: gs, end: ge }
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

    // ⭐⭐ A RÉGUA (01/09/2026). O PDF do Banrisul é a única fonte do saldo CONTÁBIL —
    // o LEDGERBAL do OFX vem DISPONÍVEL, já descontando o bloqueado de 24h, e por isso
    // o saldo da conta carregava um −1.700 fantasma com o ledger 100% correto.
    const saldosDiarios: SaldoDoDia[] = []
    const futuros: BankStatementLine[] = []
    let saldoAnterior: SaldoSnapshot | null = null
    let bloqueado: number | null = null
    let saldoDisponivel: number | null = null
    let emitidoEm: string | null = null
    // mês/ano vêm dos marcadores EXPLÍCITOS "++ MOVIMENTOS AGO/2026" — mais confiável
    // que deduzir pela virada do dia, e o arquivo sempre os traz.
    let mesAtual: string | null = null
    let anoAtual: string | null = null
    // ⚠️ depois de "MOVIMENTOS FUTUROS" nada é lançamento realizado. Antes deste flag o
    // parser lia o consórcio agendado de 09/09 como se fosse do dia 01/09 — e ele iria
    // parar na conferência de saldo como movimento que nunca aconteceu.
    let emFuturos = false

    for (const raw of rawLines) {
      if (!raw.trim()) continue

      const u = raw.trim().toUpperCase()
      if (u.includes('MOVIMENTOS FUTUROS')) { emFuturos = true; currentDay = null; continue }
      let mm: RegExpMatchArray | null
      if ((mm = raw.match(/\+\+\s*MOVIMENTOS\s+([A-Za-z]{3})\s*\/\s*(\d{4})/))) {
        mesAtual = MESES_PT[mm[1].toUpperCase()] ?? null
        anoAtual = mm[2]
        continue
      }
      if ((mm = raw.match(/SALDO\s+ANT\s+EM\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\S+)\s*$/i))) {
        const v = parseBrlAmount(mm[4])
        if (v) saldoAnterior = { data: `${mm[3]}-${mm[2]}-${mm[1]}`, valor: v.signed }
        continue
      }
      if ((mm = raw.match(/^\s*SALDO\s+NA\s+DATA\s+(\S+)\s*$/i))) {
        const v = parseBrlAmount(mm[1])
        if (v && currentDay && mesAtual && anoAtual) {
          saldosDiarios.push({ data: `${anoAtual}-${mesAtual}-${String(currentDay).padStart(2, '0')}`, valor: v.signed })
        }
        continue
      }
      if ((mm = raw.match(/\(\+\)\s*BLOQUEADO[^R]*R\$\s+(\S+)/i))) {
        const v = parseBrlAmount(mm[1]); if (v) bloqueado = v.signed
        continue
      }
      if ((mm = raw.match(/SALDO\s+DEVEDOR\.*\s*R\$\s+(\S+)/i))) {
        const v = parseBrlAmount(mm[1]); if (v) saldoDisponivel = v.signed
        continue
      }
      if ((mm = raw.match(/EXTRATO\s+EMITIDO\s+AS\s+(\d{2}:\d{2})\s+DE\s+(\d{2})\/(\d{2})\/(\d{4})/i))) {
        emitidoEm = `${mm[4]}-${mm[3]}-${mm[2]}T${mm[1]}`
        continue
      }

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
      // ⚠️ no bloco de FUTUROS o Banrisul não indenta e usa UM espaço depois do dia
      // ("09 PAGAMENTO CONSORCIO"), então lá a régua de 2+ espaços não serve.
      const dayM = raw.match(emFuturos ? /^(\d{2})\s+(.+)$/ : /^(\d{2})\s{2,}(.+)$/)
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
      // ⚠️ O FUTURO TEM MÊS PRÓPRIO: o bloco vem com "++ MOVIMENTOS SET/2026" depois do
      // corpo de agosto. Resolver a data pelo PERÍODO do extrato (que termina em agosto)
      // datava o consórcio de 09/09 como 09/08 — um mês no passado, dentro da janela que
      // a conferência confere. Aqui o mês vem do marcador EXPLÍCITO.
      const dataFutura = emFuturos && currentDay && mesAtual && anoAtual
        ? `${anoAtual}-${mesAtual}-${String(currentDay).padStart(2, '0')}`
        : null
      ;(emFuturos ? futuros : lines).push({
        day: currentDay ?? 0,
        historico,
        documento,
        amount: valor.amount,
        signed: valor.signed,
        counterpartyName: null,
        date: dataFutura,
      })
    }

    // Sprint Contraparte-Banrisul FASE 4 (13/08): período + data completa por
    // linha (chave segura do Nível 2). Ambos podem faltar (período ilegível).
    const period = extractStatementPeriod(norm)
    resolveLineDates(lines, period)

    return {
      header, lines, period,
      saldoAnterior, saldosDiarios, bloqueado, saldoDisponivel, emitidoEm, futuros,
    }
  }
}

export const banrisulPdfParser: BankStatementPdfParser = new BanrisulPdfParser()
