// Sprint Rearquitetura-Import FASE 2 (13/08) — helpers compartilhados dos
// tradutores. A DECISÃO por banco (qual identidade, qual âncora) vive em cada
// tradutor; aqui só o que é idêntico pra todos (classificar por âncora, montar).
//
// ZERO relógio: a âncora vem SEMPRE do arquivo. `maxLineDate` é a última data do
// próprio arquivo — usada por bancos cujo DTASOF não é confiável (Sicredi no fim
// do mês) ou desconhecidos.

import { stableKey } from '@/lib/reconciliation/stable-key'
import type {
  BankTranslator,
  CanonicalStatement,
  CanonicalStatus,
  CanonicalTransaction,
  StatementFileFields,
  TranslatorInput,
} from './types'

const day = (d: Date) => d.toISOString().slice(0, 10)

/** Última data de linha do arquivo (âncora dos bancos com DTASOF não-confiável). */
export function maxLineDate(input: TranslatorInput): Date | null {
  if (input.lines.length === 0) return null
  return new Date(Math.max(...input.lines.map((l) => l.datePosted.getTime())))
}

/** max(DTASOF, DTEND) — âncora dos bancos cujo DTASOF é a emissão (Banrisul/Stone). */
export function dtasofAnchor(file: StatementFileFields): Date | null {
  const a = file.dtAsOf
  const b = file.dtEnd
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

/** EFETIVADA se data <= âncora; AGENDADA se depois; DESCONHECIDA se sem âncora. */
export function classifyByAnchor(datePosted: Date, anchor: Date | null): CanonicalStatus {
  if (!anchor) return 'DESCONHECIDA'
  return day(datePosted) > day(anchor) ? 'AGENDADA' : 'EFETIVADA'
}

/** Identidade estável por data+valor+descrição (bancos com FITID instável). */
export function stableIdentity(l: TranslatorInput['lines'][number]): string {
  return stableKey({ date: l.datePosted, signedAmount: l.signedAmount, memo: l.description })
}

export interface TranslatorSpec {
  id: string
  conservative: boolean
  /** Âncora do banco (clock-free). Null → status DESCONHECIDA. */
  anchor: (input: TranslatorInput) => Date | null
  /** Identidade estável escolhida pelo banco. */
  identityOf: (l: TranslatorInput['lines'][number]) => string
  /** Favorecido, se o banco fornece (Banrisul → sempre null). */
  counterpartyOf: (l: TranslatorInput['lines'][number]) => string | null
  /** Avisos fixos do tradutor (ex: conservador). */
  baseWarnings?: (input: TranslatorInput) => string[]
}

/** Monta o CanonicalStatement a partir da spec do banco. Igual pra todos — o que
 *  varia (identidade/âncora/contraparte) veio da spec. */
export function buildCanonical(spec: TranslatorSpec, input: TranslatorInput): CanonicalStatement {
  const anchor = spec.anchor(input)
  const warnings = spec.baseWarnings ? [...spec.baseWarnings(input)] : []
  if (!input.file.dtAsOf) {
    warnings.push('O arquivo não declara DTASOF (data do saldo) — validação de saldo fica limitada.')
  }
  if (input.file.ledgerBalance == null) {
    warnings.push('O arquivo não traz LEDGERBAL (saldo declarado) — o juiz de saldo não pode confirmar o fechamento.')
  }

  // DESEMPATE POR OCORRÊNCIA: duas linhas com a MESMA identidade base no mesmo
  // arquivo são transações REAIS distintas (caso real: 2× "CAPITALIZACAO RG"
  // 70,02 no mesmo dia, docs 590242 e 590243 — quase apagamos uma achando que era
  // duplicata). O nº de ocorrência (ordem no arquivo, estável entre re-imports)
  // desempata — mesma técnica do line-dedup-hash. Vale pra qualquer banco: com
  // FITID único (Stone/Sicredi) o sufixo é sempre #1 (inócuo); com identidade
  // data+valor+descrição (Banrisul) ele separa as colisões reais.
  const occ = new Map<string, number>()
  const transactions: CanonicalTransaction[] = input.lines.map((l) => {
    const base = spec.identityOf(l)
    const n = (occ.get(base) ?? 0) + 1
    occ.set(base, n)
    return {
      stableId: `${base}#${n}`,
      datePosted: l.datePosted,
      signedAmount: l.signedAmount,
      description: l.description,
      counterpartyName: spec.counterpartyOf(l),
      document: l.fitid || null,
      status: classifyByAnchor(l.datePosted, anchor),
    }
  })

  return {
    bankId: input.file.bankId,
    translatorId: spec.id,
    conservative: spec.conservative,
    warnings,
    period: { start: input.file.dtStart, end: input.file.dtEnd },
    ledger: { balance: input.file.ledgerBalance, asOf: input.file.dtAsOf },
    transactions,
  }
}

/** Cria um BankTranslator a partir de uma spec (fecha a spec por construção). */
export function translatorFromSpec(spec: TranslatorSpec): BankTranslator {
  return {
    id: spec.id,
    conservative: spec.conservative,
    translate: (input) => buildCanonical(spec, input),
  }
}
