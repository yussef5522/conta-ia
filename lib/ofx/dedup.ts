// Deduplicação de transações OFX.
//
// Por que não usar só o FITID:
// O OFX define FITID como "Financial Institution Transaction ID" e teoricamente
// deveria ser único. Na prática, alguns bancos brasileiros (Banrisul é o caso
// observado) reusam números curtos como "000001", "000002" entre transações
// distintas no mesmo arquivo. Usar FITID como chave de dedup levava a violação
// de @@unique([bankAccountId, externalId]) na importação.
//
// A solução: chave interna composta (fitid + data + valor com sinal + memo).
// — Transações distintas com mesmo FITID (Banrisul) → hashes distintos. ✅
// — Reimport do mesmo arquivo → mesma 4-tupla → mesmo hash → dedup acerta. ✅

import { createHash } from 'crypto'
import type { OFXTransaction } from './parser'

// Apenas os campos necessários para o cálculo do hash, para a função ser
// usável tanto em testes unitários quanto na pipeline real de importação.
export type TransacaoParaHash = Pick<OFXTransaction, 'fitid' | 'datePosted' | 'amount' | 'type' | 'memo'>

export function dedupHashOFX(t: TransacaoParaHash): string {
  // Data como YYYY-MM-DD: ignora horário pra ser robusto a OFX que vêm com
  // timezone diferente entre exports.
  const dateKey = t.datePosted.toISOString().slice(0, 10)
  // Valor com sinal e 2 casas: evita drift de float; CREDIT vs DEBIT do mesmo
  // valor não colidem.
  const signed = (t.type === 'CREDIT' ? 1 : -1) * t.amount
  const amountKey = signed.toFixed(2)
  // Memo trimado e com whitespace colapsado: bancos às vezes adicionam espaços
  // extras entre exports da mesma transação.
  const memoKey = t.memo.trim().replace(/\s+/g, ' ')
  const raw = `${t.fitid}|${dateKey}|${amountKey}|${memoKey}`
  return createHash('sha256').update(raw).digest('hex')
}

export interface TransacaoComHash extends TransacaoParaHash {
  dedupHash: string
}

// Filtra transações novas em duas etapas:
// 1. Dedup intra-arquivo: se o próprio OFX tiver duplicatas reais (mesma 4-tupla
//    repetida), só a primeira passa.
// 2. Dedup contra DB: remove as que já têm hash equivalente persistido.
//
// O parâmetro `existingHashes` deve ser o conjunto de dedupHash já presentes
// na conta. Quem chamar é responsável por consultar o DB.
export function filtrarNovasOFX(
  transacoes: ReadonlyArray<TransacaoParaHash>,
  existingHashes: ReadonlySet<string>,
): { novas: TransacaoComHash[]; duplicadasNoArquivo: number; duplicadasNoBanco: number } {
  const seen = new Set<string>()
  const novas: TransacaoComHash[] = []
  let duplicadasNoArquivo = 0
  let duplicadasNoBanco = 0

  for (const t of transacoes) {
    const hash = dedupHashOFX(t)
    if (seen.has(hash)) {
      duplicadasNoArquivo++
      continue
    }
    seen.add(hash)
    if (existingHashes.has(hash)) {
      duplicadasNoBanco++
      continue
    }
    novas.push({ ...t, dedupHash: hash })
  }

  return { novas, duplicadasNoArquivo, duplicadasNoBanco }
}
