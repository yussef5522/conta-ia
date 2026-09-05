// ⛔⛔⛔ O BANCO MUDA A DATA DE UMA LINHA JÁ PUBLICADA (05/09/2026).
//
// **CASO REAL, provado com os dois downloads.** As duas `CAPITALIZACAO RG` (R$ 297,84 cada,
// FITID 590244/590245) vieram assim:
//
//     Extrato_20260901.ofx (baixado 02/09 02:18)  →  data 01/09   ← foi este que importamos
//     Extrato_20260902 / _0903 / _0904            →  data 02/09   (os três concordam)
//
// A identidade da linha é `data|valor|memo` — **o FITID não entra, de propósito**, porque o
// Banrisul renumera FITID entre downloads. Então a data mudar quebra a chave e a MESMA linha
// volta como nova: **R$ 595,68 duplicados** no próximo confirmar. É a família do PIX 7.000
// (chave que diverge entre dois caminhos), com outra causa.
//
// ⚠️ RARO E REAL: varri os **32 blobs** do Banrisul — só estas 2 linhas mudaram de data de
// verdade. (O `PACOTE SERVICOS` aparece em 4 datas, mas é o FITID **reciclado todo mês**,
// não deslocamento.) Raro não é motivo pra não tratar: cada ocorrência custa uma duplicata
// silenciosa e uma divergência falsa na conferência do dia.
//
// ⭐⭐⭐ A TOLERÂNCIA É ESTREITA POR EXIGÊNCIA DO DONO, e a 4ª condição é a que segura tudo:
//
//     1. mesmo VALOR, ao centavo (com sinal)
//     2. mesmo HISTÓRICO na forma canônica
//     3. a data difere em EXATAMENTE 1 dia
//     4. ⭐ a linha **SUMIU do dia original** no arquivo novo — o arquivo NÃO lista mais
//        nada com aquela identidade na data em que a nossa está
//     5. o casamento é 1:1 e **ambiguidade de DIA não casa** — candidata no dia anterior
//        E no seguinte é palpite sobre pra que lado a linha foi, e palpite aqui apaga
//        dinheiro. (Linhas idênticas no MESMO dia vizinho são intercambiáveis: é o multiset
//        do Tier 1, e é o próprio caso real — as duas CAPITALIZACAO.)
//
// ⛔⛔ SEM A CONDIÇÃO 4 ISTO VIRA O BUG QUE ELA EXISTE PRA EVITAR: dois PIX de R$ 7.000 em
// dias VIZINHOS DE VERDADE (os dois listados no arquivo) seriam fundidos em um só, e o
// segundo **sumiria** — perder lançamento é pior que duplicar, porque duplicata a gente vê.
// Com a condição 4, o arquivo ainda lista o do dia original → não há deslocamento → os dois
// seguem separados.

import type { StatementLine, DbBankTransaction } from './types'
import { canonizarHistorico } from '@/lib/bank-profiles/historico-canonico'

const UM_DIA_MS = 86_400_000

/** identidade SEM data: valor com sinal + histórico canônico */
export function identidadeSemData(t: { signedAmount: number; memo: string }): string {
  return `${t.signedAmount.toFixed(2)}|${canonizarHistorico(t.memo)}`
}

const dia = (d: Date) => d.toISOString().slice(0, 10)

export interface DeslocamentoDeDia {
  dbTx: DbBankTransaction
  statementLine: StatementLine
  /** a data que está no NOSSO ledger */
  deData: string
  /** a data que o arquivo novo dá */
  paraData: string
}

export interface ResultadoFronteira {
  /** pares (nossa linha × linha do arquivo) que são A MESMA linha, deslocada um dia */
  deslocamentos: DeslocamentoDeDia[]
  /** o que sobrou de cada lado, pra seguir pro tier seguinte */
  dbRestante: DbBankTransaction[]
  linhasRestantes: StatementLine[]
}

/**
 * Casa o que SOBROU do match exato quando a única diferença é UM DIA. PURA.
 *
 * @param todasAsLinhasDoArquivo TODAS as linhas reais do arquivo — não só as sobras.
 *   É esta lista que responde a condição 4 ("sumiu do dia original?"). Passar só as
 *   sobras faria a condição olhar um mundo parcial e voltar "sumiu" pra linha que está
 *   lá, casada com outra — exatamente o falso positivo que abriria o caso do PIX.
 */
export function casarFronteiraDeDia(
  dbSobras: DbBankTransaction[],
  linhasSobras: StatementLine[],
  todasAsLinhasDoArquivo: StatementLine[],
): ResultadoFronteira {
  // quantas linhas o ARQUIVO tem por (identidade, dia) — a régua da condição 4
  const arquivoPorIdentidadeEDia = new Map<string, number>()
  for (const l of todasAsLinhasDoArquivo) {
    const k = `${identidadeSemData(l)}@${dia(l.datePosted)}`
    arquivoPorIdentidadeEDia.set(k, (arquivoPorIdentidadeEDia.get(k) ?? 0) + 1)
  }

  const linhasPorIdentidade = new Map<string, StatementLine[]>()
  for (const l of linhasSobras) {
    const k = identidadeSemData(l)
    const arr = linhasPorIdentidade.get(k) ?? []
    arr.push(l)
    linhasPorIdentidade.set(k, arr)
  }

  const deslocamentos: DeslocamentoDeDia[] = []
  const usadas = new Set<StatementLine>()
  const dbRestante: DbBankTransaction[] = []

  for (const tx of dbSobras) {
    const id = identidadeSemData(tx)

    // ⛔ CONDIÇÃO 4: se o arquivo AINDA lista essa identidade no dia da nossa transação,
    // então a nossa é aquela — e a linha de outro dia é OUTRA linha, não um deslocamento.
    if ((arquivoPorIdentidadeEDia.get(`${id}@${dia(tx.date)}`) ?? 0) > 0) {
      dbRestante.push(tx)
      continue
    }

    const vizinhas = (linhasPorIdentidade.get(id) ?? []).filter(
      (l) => !usadas.has(l) && Math.abs(l.datePosted.getTime() - tx.date.getTime()) === UM_DIA_MS,
    )
    if (vizinhas.length === 0) {
      dbRestante.push(tx)
      continue
    }

    // ⚠️ A AMBIGUIDADE QUE IMPORTA É DE **DIA**, NÃO DE LINHA — e a 1ª versão desta função
    // errou isso: com "2+ candidatas não casa", o CASO REAL não casava, porque as duas
    // CAPITALIZACAO são **idênticas e no mesmo dia**. Linhas iguais no mesmo dia são
    // intercambiáveis (é a mesma lógica de multiset do Tier 1); o que não dá pra decidir é
    // candidata no dia ANTERIOR *e* no SEGUINTE — aí não se sabe pra que lado a linha foi,
    // e chutar apaga dinheiro.
    const diasCandidatos = new Set(vizinhas.map((l) => dia(l.datePosted)))
    if (diasCandidatos.size !== 1) {
      dbRestante.push(tx)
      continue
    }

    const l = vizinhas[0]
    usadas.add(l)
    deslocamentos.push({ dbTx: tx, statementLine: l, deData: dia(tx.date), paraData: dia(l.datePosted) })
  }

  return {
    deslocamentos,
    dbRestante,
    linhasRestantes: linhasSobras.filter((l) => !usadas.has(l)),
  }
}

/**
 * A frase que a tela mostra — **sugere, com nome**, nunca soma às cegas.
 *
 * ⚠️ O dono precisa saber que houve deslocamento pra decidir a DATA (a régua é o PDF).
 * Um casamento silencioso resolveria a duplicata e esconderia a pergunta.
 */
export function fraseDoDeslocamento(d: DeslocamentoDeDia): string {
  const br = (iso: string) => iso.split('-').reverse().join('/')
  const valor = Math.abs(d.statementLine.signedAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return `O banco moveu "${d.statementLine.memo}" (${valor}) de ${br(d.deData)} pra ${br(d.paraData)} entre dois downloads. `
    + `É a mesma linha — não vou importar de novo. A data que vale é a do PDF.`
}
