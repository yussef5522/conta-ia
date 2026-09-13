// ⭐⭐⭐ A LINHA DO EXTRATO É O FATO; A TX MANUAL É O REGISTRO DO MESMO FATO (13/09/2026).
//
// **Régua confirmada pelo dono:** *"a linha do extrato é o FATO, a tx da ponte é o REGISTRO
// do mesmo fato — o import CASA com a ponte existente (marca origem OFX nela, herda
// categoria), NUNCA cria segunda. Vale pras 152 manuais de conta: as que o OFX cobrir viram
// casadas, as que o OFX não trouxer ficam manuais como estão."*
//
// **O QUE ISTO IMPEDE, medido antes de existir:** o perfil tem **84 pontes PJ→PF** e as 3
// transferências de setembro (10.000 · 3.500 · 21.000) já vivem na PF como crédito criado
// pela ponte. Quando o OFX do banrisul PF entrar, **essas mesmas linhas vêm no arquivo** — e
// como as 152 tx de conta são `origin: MANUAL` **sem `dedupHash`**, elas virariam transação
// nova. *O mesmo dinheiro duas vezes*, que é a doença que esta casa mais paga.
//
// ⛔⛔ **E O CASAMENTO AQUI NÃO PODE OLHAR O TEXTO.** A tx da ponte diz *"Distribuição de
// Lucros caçula"* (as palavras do dono) e o OFX dirá *"PIX RECEBIDO…"* (as palavras do
// banco) — **o mesmo fato com dois nomes**. Por isso a régua é DATA + VALOR + SENTIDO, e
// por isso ela é estreita: sem o texto pra desempatar, qualquer folga a mais vira palpite.

import { stableKey } from '@/lib/reconciliation/stable-key'

/** ⚠️ a janela do dono pro par PJ→PF: ±2 dias (o PIX cai no mesmo dia ou no seguinte) */
export const JANELA_DE_CASAMENTO_DIAS = 2

export interface LinhaDoExtrato {
  fitid: string
  data: Date
  /** positivo = entrou, negativo = saiu */
  valorComSinal: number
  memo: string
}

export interface TxExistente {
  id: string
  data: Date
  valorComSinal: number
  descricao: string
  /** 'OFX' | 'MANUAL' | 'BRIDGE'… — o que distingue registro de fato */
  origem: string
  /** já veio de um import? então casa pelo stableKey, não pela régua larga */
  dedupHash: string | null
  /** ⭐ tem ponte PJ→PF? é o sinal mais forte de que é o MESMO dinheiro */
  temPonte: boolean
  categoriaId: string | null
}

export type Desfecho =
  /** a MESMA linha já importada antes — re-import não duplica */
  | { tipo: 'JA_IMPORTADA'; txId: string }
  /** o mesmo fato já registrado à mão (ponte ou lançamento) — CASA, não cria */
  | { tipo: 'CASA_COM_MANUAL'; txId: string; temPonte: boolean; porQue: string }
  /** ⛔ dois candidatos igualmente plausíveis — o sistema NÃO escolhe */
  | { tipo: 'AMBIGUA'; candidatos: string[]; porQue: string }
  /** dinheiro novo */
  | { tipo: 'NOVA' }

const diasEntre = (a: Date, b: Date) =>
  Math.abs(Math.floor((a.getTime() - b.getTime()) / 86_400_000))

/** ⚠️ centavo a centavo: "quase o mesmo valor" não é o mesmo dinheiro */
const mesmoValor = (a: number, b: number) => Math.abs(a - b) < 0.005

/**
 * ⭐⭐ O DESFECHO DE UMA LINHA. Puro.
 *
 * A ordem das camadas importa e cada uma tem um motivo:
 *  1. **`dedupHash`/stableKey** — a linha já entrou por um import. É identidade, não palpite.
 *  2. **manual com ponte** — o fato mais forte: alguém já disse que aquele dinheiro é este.
 *  3. **manual sem ponte** — mesmo valor, mesmo sentido, dentro da janela.
 *
 * ⛔ Em 2 e 3, **dois candidatos = AMBÍGUA** e o sistema não escolhe: casar com o errado
 * amarraria a categoria de um gasto no outro, e desfazer isso é bem mais caro que um clique.
 */
export function desfechoDaLinha(linha: LinhaDoExtrato, existentes: TxExistente[]): Desfecho {
  const chave = stableKey({ date: linha.data, signedAmount: linha.valorComSinal, memo: linha.memo })

  // 1 ── identidade: a mesma linha, do mesmo arquivo ou de outro download
  const mesma = existentes.find((t) => t.dedupHash === chave)
  if (mesma) return { tipo: 'JA_IMPORTADA', txId: mesma.id }

  // 2/3 ── o mesmo FATO registrado à mão
  const candidatos = existentes.filter((t) =>
    t.dedupHash == null                                   // ⚠️ quem já veio de OFX não entra aqui
    && mesmoValor(t.valorComSinal, linha.valorComSinal)
    && Math.sign(t.valorComSinal) === Math.sign(linha.valorComSinal)
    && diasEntre(t.data, linha.data) <= JANELA_DE_CASAMENTO_DIAS)

  if (!candidatos.length) return { tipo: 'NOVA' }

  // ⭐ a ponte ganha: ela é uma afirmação explícita de que aquele dinheiro veio da empresa
  const comPonte = candidatos.filter((t) => t.temPonte)
  const pool = comPonte.length ? comPonte : candidatos

  if (pool.length > 1) {
    return {
      tipo: 'AMBIGUA',
      candidatos: pool.map((t) => t.id),
      porQue: `${pool.length} lançamentos do mesmo valor na janela — o sistema não escolhe qual é`,
    }
  }
  const t = pool[0]
  return {
    tipo: 'CASA_COM_MANUAL',
    txId: t.id,
    temPonte: t.temPonte,
    porQue: t.temPonte
      ? 'já registrado como dinheiro vindo da empresa (ponte PJ→PF)'
      : `lançamento manual de mesmo valor em ${t.data.toISOString().slice(0, 10)}`,
  }
}

export interface PlanoDoExtrato {
  novas: LinhaDoExtrato[]
  jaImportadas: number
  /** ⭐ as que CASAM com registro manual — recebem a marca do OFX, não viram tx nova */
  casadas: { linha: LinhaDoExtrato; txId: string; temPonte: boolean; porQue: string }[]
  /** ⛔ precisam do dono: o sistema viu mais de um candidato */
  ambiguas: { linha: LinhaDoExtrato; candidatos: string[]; porQue: string }[]
}

/**
 * ⭐ O plano do arquivo inteiro.
 *
 * ⚠️ **Uma tx manual só casa com UMA linha** — sem isso, um extrato com duas linhas iguais
 * casaria as duas no mesmo lançamento e a segunda sumiria sem virar nada.
 */
export function planoDoExtrato(linhas: LinhaDoExtrato[], existentes: TxExistente[]): PlanoDoExtrato {
  const plano: PlanoDoExtrato = { novas: [], jaImportadas: 0, casadas: [], ambiguas: [] }
  const gastos = new Set<string>()

  for (const linha of linhas) {
    const d = desfechoDaLinha(linha, existentes.filter((t) => !gastos.has(t.id)))
    if (d.tipo === 'JA_IMPORTADA') { plano.jaImportadas++; gastos.add(d.txId); continue }
    if (d.tipo === 'CASA_COM_MANUAL') {
      plano.casadas.push({ linha, txId: d.txId, temPonte: d.temPonte, porQue: d.porQue })
      gastos.add(d.txId)
      continue
    }
    if (d.tipo === 'AMBIGUA') { plano.ambiguas.push({ linha, candidatos: d.candidatos, porQue: d.porQue }); continue }
    plano.novas.push(linha)
  }
  return plano
}
