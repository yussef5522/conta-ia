// VENDAS FASE 1 (17/08/2026) — item 3. Agrega as Transaction de venda em
// VendaDiaria (derivada, recomputável, NUNCA fonte primária). Função PURA: mesma
// entrada → mesma saída (idempotência sai de graça). A persistência (delete
// EXTRATO_INFERIDO + insert, preserva AJUSTE_DONO) fica no recompute-vendas.
//
// Uma VendaDiaria por (intervalo de competência, meio, tipo). Meios que DIVIDEM o
// fim de semana (Tuna PIX, cofre) viram 1 VendaDiaria por dia; cartão vem em BLOCO
// (dataCompetencia=14, dataCompetenciaFim=16) e NÃO divide — a tela soma. Guarda o
// link N:1 com as Transaction de origem (o "ver operações do dia").
//
// ⭐ FOCO AGOSTO: competência com fim < moduleInicio (12/08) é DESCARTADA (o 11/08
// das entradas de 12/08 é dia incompleto — decisão do dono).

import { computeCompetencia } from './compute-competencia'
import { diaUTC } from './feriados-nacionais'
import type { Meio, RegraRecebimento } from './perfil-recebimento'

export interface VendaTxInput {
  id: string
  bankAccountId: string
  meio: Meio
  date: Date // dataEntrada (quando o dinheiro entrou)
  valorLiquido: number // CREDIT positivo; ESTORNO negativo
  tipo: 'VENDA' | 'ESTORNO'
  createdAt?: Date // desempate de ordem no split (após date)
}

export interface VendaOrigem {
  transactionId: string
  valor: number
  competenciaDia: string // 'YYYY-MM-DD' (dia atribuído; no bloco = inicio)
}

export interface VendaDiariaComputada {
  dataCompetencia: Date // inicio
  dataCompetenciaFim: Date // fim (= inicio se dia único)
  meio: Meio
  tipo: 'VENDA' | 'ESTORNO'
  valorLiquido: number
  isBloco: boolean
  confirmado: boolean // todas as origens com perfil confirmado
  status: 'ESTIMADO' // extrato-inferido é sempre ~ (fase 2: CONFIRMADO por adquirente)
  origens: VendaOrigem[]
}

/** txs devem vir ordenadas cronologicamente (date asc, createdAt asc) — o caller
 *  garante; a ordem define o split (1º lançamento do dia = dia mais antigo do bloco). */
export function computeVendasDiarias(
  txs: ReadonlyArray<VendaTxInput>,
  regras: ReadonlyArray<RegraRecebimento>,
  feriados: Set<string>,
  moduleInicio: Date,
): VendaDiariaComputada[] {
  // 1. Conta quantos lançamentos por (conta, meio, dia de entrada) — pro split.
  const grupoDia = new Map<string, VendaTxInput[]>()
  for (const t of txs) {
    const k = `${t.bankAccountId}|${t.meio}|${diaUTC(t.date)}`
    const arr = grupoDia.get(k) ?? []
    arr.push(t)
    grupoDia.set(k, arr)
  }

  // 2. Cada tx → competência (com split), agrupa em VendaDiaria.
  const agg = new Map<string, VendaDiariaComputada>()
  for (const [, grupo] of grupoDia) {
    grupo.forEach((t, i) => {
      const c = computeCompetencia(t.date, t.bankAccountId, t.meio, regras, feriados, {
        moduleInicio,
        ordinal: i,
        totalNoDia: grupo.length,
      })
      if (c.fora || !c.inicio || !c.fim) return
      if (c.fim.getTime() < moduleInicioMeiaNoite(moduleInicio)) return // competência pré-corte (11/08)

      const key = `${diaUTC(c.inicio)}|${diaUTC(c.fim)}|${t.meio}|${t.tipo}`
      const cur = agg.get(key)
      if (cur) {
        cur.valorLiquido = round2(cur.valorLiquido + t.valorLiquido)
        cur.confirmado = cur.confirmado && c.confirmado
        cur.origens.push({ transactionId: t.id, valor: t.valorLiquido, competenciaDia: diaUTC(c.inicio) })
      } else {
        agg.set(key, {
          dataCompetencia: c.inicio,
          dataCompetenciaFim: c.fim,
          meio: t.meio,
          tipo: t.tipo,
          valorLiquido: round2(t.valorLiquido),
          isBloco: c.isBloco,
          confirmado: c.confirmado,
          status: 'ESTIMADO',
          origens: [{ transactionId: t.id, valor: t.valorLiquido, competenciaDia: diaUTC(c.inicio) }],
        })
      }
    })
  }

  // Ordena determinístico (competência, meio, tipo) — saída estável = idempotência.
  return [...agg.values()].sort((a, b) => {
    const ka = `${diaUTC(a.dataCompetencia)}|${diaUTC(a.dataCompetenciaFim)}|${a.meio}|${a.tipo}`
    const kb = `${diaUTC(b.dataCompetencia)}|${diaUTC(b.dataCompetenciaFim)}|${b.meio}|${b.tipo}`
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const moduleInicioMeiaNoite = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
