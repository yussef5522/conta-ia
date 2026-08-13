// Sprint Rearquitetura-Import FASE 2 (13/08) — O CHOKE-POINT.
//
// Esta é a ÚNICA porta do OFX cru pro resto do sistema. A Camada 3 (negócio)
// recebe CanonicalStatement e NUNCA o arquivo cru — nem por atalho. Igual ao
// createOfxImportRecord (rawOfxBlob): ponto obrigatório de passagem em vez de
// disciplina. A lição já apareceu 3× (motor de transferência em 7 lugares,
// categoria de entrada em 3, blob em 1) — sempre o mesmo padrão: sem ponto
// obrigatório, a regra vaza.
//
// ZERO relógio: os campos de arquivo vêm de parseStatementFileFields (DTASOF
// ausente = null, não hoje) e o tradutor classifica por âncora do arquivo.

import { parseOFX, type OFXParseResult } from '@/lib/ofx/parser'
import { parseStatementFileFields } from './parse-file-fields'
import { resolveTranslator } from './registry'
import type { CanonicalStatement, CanonicalStatus, TranslatorInput } from './types'
import type { TranslatorSpec } from './build'

function buildInput(parsed: OFXParseResult, rawOfx: string): TranslatorInput {
  // Campos de arquivo: extração ESTRITA, sem relógio (não o fallback do parser).
  const file = parseStatementFileFields(rawOfx)
  return {
    lines: parsed.transactions.map((t) => ({
      fitid: t.fitid,
      datePosted: t.datePosted,
      signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
      description: t.memo,
      counterpartyName: t.counterpartyName ?? null,
    })),
    // bankId vem do parser (mesmo BANKID); os outros da extração estrita.
    file: { ...file, bankId: parsed.bankId ?? file.bankId },
  }
}

/**
 * Traduz um OFX cru pro canônico. Ponto único de entrada da Camada 1.
 * @param rawOfx conteúdo do arquivo
 * @param overrides injeção de tradutor (só teste de isolamento)
 */
export function toCanonical(
  rawOfx: string,
  overrides?: Partial<Record<string, TranslatorSpec>>,
): CanonicalStatement {
  const parsed = parseOFX(rawOfx)
  const input = buildInput(parsed, rawOfx)
  return resolveTranslator(input.file.bankId, overrides).translate(input)
}

/**
 * Igual ao toCanonical, mas reusa um `parsed` JÁ existente — pra o wiring no
 * pipeline: o orchestrator/preview já têm o parseOFX, e passar o MESMO `parsed`
 * garante alinhamento 1:1 por índice com as StatementLine deles (mesma ordem de
 * parsed.transactions). Evita reparsear e evita desalinhamento.
 */
export function toCanonicalFromParsed(parsed: OFXParseResult, rawOfx: string): CanonicalStatement {
  const input = buildInput(parsed, rawOfx)
  return resolveTranslator(input.file.bankId).translate(input)
}

/**
 * Status canônico por linha (na ORDEM de parsed.transactions). Pro wiring da
 * Camada 1 no CONFIRM (orchestrator): EFETIVADA = importa; AGENDADA/DESCONHECIDA
 * = fica de fora (futuro).
 */
export function canonicalLineStatuses(parsed: OFXParseResult, rawOfx: string): CanonicalStatus[] {
  return toCanonicalFromParsed(parsed, rawOfx).transactions.map((t) => t.status)
}

/** Chave de conteúdo pra casar uma linha com seu status (status só depende de
 *  data×âncora → colisão de linhas idênticas é status-safe). */
export function contentKey(
  fitid: string,
  datePosted: Date,
  signedAmount: number,
  memo: string,
): string {
  return `${fitid}|${datePosted.toISOString().slice(0, 10)}|${signedAmount.toFixed(2)}|${memo}`
}

/**
 * Mapa conteúdo→status canônico. Pro wiring da Camada 1 no PREVIEW, que
 * classifica só as linhas NOVAS (subconjunto) — não dá pra alinhar por índice,
 * então casa por conteúdo. Faz o parse internamente (o preview só tem o raw).
 */
export function canonicalStatusMap(rawOfx: string): Map<string, CanonicalStatus> {
  const parsed = parseOFX(rawOfx)
  const canon = toCanonicalFromParsed(parsed, rawOfx)
  const map = new Map<string, CanonicalStatus>()
  parsed.transactions.forEach((t, i) => {
    const signed = t.type === 'CREDIT' ? t.amount : -t.amount
    map.set(contentKey(t.fitid, t.datePosted, signed, t.memo), canon.transactions[i].status)
  })
  return map
}
