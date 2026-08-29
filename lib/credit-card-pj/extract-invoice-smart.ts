// Sprint BUG B FASE a (14/08/2026) — orquestrador de extração de fatura.
//
// ORDEM (decisão do Yussef): pdftotext -layout PRIMEIRO. Se o PDF tem camada de
// texto E há parser determinístico do banco → lê por regex (custo zero, sem
// timeout, sem truncamento) e VALIDA contra os totais do PDF (falha se não fecha).
// Vision é só FALLBACK: PDF escaneado (sem texto) OU banco ainda sem parser.
//
// Isto mata o "Timeout Claude Vision" do Sicredi na raiz — o Sicredi tem texto,
// então nunca mais toca o Vision. Banrisul/Caixa (que hoje leem por Vision a 82%
// do teto de 60s) ganham parser depois; até lá seguem no Vision (que funciona pra
// eles). Auto-decide por arquivo.

import { extractPdfText, PdfExtractError } from '@/lib/bank-statement-pdf/extract-pdf-text'
import { extractInvoice, type ExtractInvoiceDeps, type ExtractInvoiceResult } from './extract'
import { parseSicrediFatura } from './deterministic/sicredi-fatura-parser'
import { validateSicrediFatura, type FaturaValidation } from './deterministic/validate-fatura'
import { parseBanrisulFatura } from './deterministic/banrisul-fatura-parser'
import { validateBanrisulFatura } from './deterministic/validate-banrisul-fatura'
import { parseCaixaFatura } from './deterministic/caixa-fatura-parser'
import { validateCaixaFatura } from './deterministic/validate-caixa-fatura'
import { parseMercadoPagoFatura } from './deterministic/mercadopago-fatura-parser'
import { validateMercadoPagoFatura } from './deterministic/validate-mercadopago-fatura'
import { CreditCardPjExtractError, type InvoiceExtraction } from './types'

export interface SmartExtractResult extends ExtractInvoiceResult {
  /** de onde veio a leitura — pra log/tela. */
  source: 'PDFTEXT' | 'VISION'
  validation?: FaturaValidation
}

interface DeterministicParser {
  bank: string
  /** casa o banco no texto extraído. */
  match: RegExp
  parse: (text: string) => { extraction: InvoiceExtraction }
  validate: (parsed: ReturnType<DeterministicParser['parse']>) => FaturaValidation
}

// Registry — adicionar banco = adicionar objeto (mesmo padrão dos bank-profiles).
const DETERMINISTIC: DeterministicParser[] = [
  {
    bank: 'Sicredi',
    match: /sicredi/i,
    parse: parseSicrediFatura,
    validate: (p) => validateSicrediFatura(p as ReturnType<typeof parseSicrediFatura>),
  },
  {
    bank: 'Banrisul',
    match: /banrisul/i,
    parse: parseBanrisulFatura,
    validate: (p) => validateBanrisulFatura(p as ReturnType<typeof parseBanrisulFatura>),
  },
  {
    bank: 'Caixa',
    match: /caixa/i,
    parse: parseCaixaFatura,
    validate: (p) => validateCaixaFatura(p as ReturnType<typeof parseCaixaFatura>),
  },
  {
    // ⚠️ o match casa no CONTEÚDO do PDF, não no nome cadastrado da conta. "Mercado Pago"
    // aparece no rodapé e "MERCADOPAGO*" no prefixo dos estabelecimentos — os dois servem,
    // e exigir os dois seria frágil (o banco pode mudar o rodapé).
    bank: 'Mercado Pago',
    match: /mercado\s*pago|MERCADOPAGO\*/i,
    parse: (text) => ({ extraction: parseMercadoPagoFatura(text) }),
    validate: (p) => validateMercadoPagoFatura((p as { extraction: unknown }).extraction as ReturnType<typeof parseMercadoPagoFatura>),
  },
]

/**
 * ⭐⭐ O ROTEADOR — escolhe por FORÇA DE EVIDÊNCIA, não por ordem (29/08/2026).
 *
 * ⚠️ O BUG QUE ISTO CONSERTA, pego na validação ponta a ponta do Mercado Pago: o roteador
 * fazia `DETERMINISTIC.find(d => d.match.test(text))` — **o PRIMEIRO que casa**. O texto da
 * fatura do MP diz *"saque no CAIXA eletrônico"*, o match da Caixa é `/caixa/i`, e a Caixa
 * vem antes no array. Resultado: a fatura do Mercado Pago era roteada pro parser da CAIXA,
 * que falhava com *"não encontrei o Valor total desta fatura da Caixa"* — uma recusa que
 * culpava o PDF do cliente por um erro de roteamento nosso.
 *
 * ⚠️ E "só reordenar o array" resolveria por ACIDENTE: o próximo banco cujo texto contenha
 * "sicredi" ou "banrisul" de passagem quebraria de novo. Palavra comum não identifica
 * emissor — QUANTIDADE de evidência identifica.
 *
 * Conta as ocorrências do padrão e fica com o maior. No caso real: MP 8 × Caixa 2.
 * Empate (ou zero) → nenhum parser dedicado, e a decisão sobe pra camada de cima.
 */
export function escolherParser(text: string): DeterministicParser | undefined {
  const pontuados = DETERMINISTIC.map((d) => {
    const re = new RegExp(d.match.source, d.match.flags.includes('g') ? d.match.flags : d.match.flags + 'g')
    return { d, score: (text.match(re) ?? []).length }
  }).filter((x) => x.score > 0)
  if (pontuados.length === 0) return undefined
  pontuados.sort((a, b) => b.score - a.score)
  // ⚠️ empate técnico: não adivinha. Melhor subir pra camada de cima do que rotear errado —
  // rotear errado devolve "seu PDF está errado" pra um PDF que está certo.
  if (pontuados.length > 1 && pontuados[0].score === pontuados[1].score) return undefined
  return pontuados[0].d
}

/** Banco tem parser determinístico? (K7 do juiz: fatura de banco SEM parser entrou
 *  por Vision — meta é zero). Casa pelo `match` do registry no nome do banco. */
export function hasDeterministicParser(bankName: string | null | undefined): boolean {
  if (!bankName) return false
  return DETERMINISTIC.some((d) => d.match.test(bankName))
}

export async function extractInvoiceSmart(
  input: { pdfBytes: Uint8Array; fileName: string },
  deps: ExtractInvoiceDeps = {},
): Promise<SmartExtractResult> {
  // 1. pdftotext -layout. NO_TEXT_LAYER (escaneado) → Vision. Outros erros de PDF
  //    (não-PDF, grande demais) → sobem como erro claro.
  let text: string | null = null
  try {
    text = await extractPdfText(input.pdfBytes)
  } catch (err) {
    if (err instanceof PdfExtractError) {
      if (err.code === 'NOT_A_PDF') throw new CreditCardPjExtractError('NOT_A_PDF', err.message)
      if (err.code === 'FILE_TOO_LARGE') throw new CreditCardPjExtractError('FILE_TOO_LARGE', err.message)
      // NO_TEXT_LAYER / EXTRACT_FAILED → tenta Vision (pode ser escaneado).
      text = null
    } else {
      text = null
    }
  }

  if (text) {
    const det = escolherParser(text)
    if (det) {
      const parsed = det.parse(text)
      const validation = det.validate(parsed)
      if (!validation.ok) {
        // NÃO cai pro Vision: o Yussef mandou FALHAR quando não fecha (impossibilidade).
        throw new CreditCardPjExtractError('VALIDATION_FAILED', validation.message ?? 'Fatura não fecha.', validation.checks)
      }
      return {
        extraction: parsed.extraction,
        metrics: { durationMs: 0, inputTokens: 0, outputTokens: 0, model: 'pdftotext-layout', pdfSize: input.pdfBytes.length },
        source: 'PDFTEXT',
        validation,
      }
    }
    // banco com texto mas sem parser determinístico → Vision (Banrisul/Caixa hoje).
  }

  // 2. Fallback Vision (escaneado ou banco sem parser).
  const r = await extractInvoice(input, deps)
  return { ...r, source: 'VISION' }
}
