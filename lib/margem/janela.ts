/**
 * ⭐ A JANELA DO PERÍODO — hoje · semana · mês · datas (07/10/2026).
 *
 * ⛔⛔ **UMA janela pra a tela inteira**: linha de chegada, casa, liga e ficha recortam JUNTO.
 * Se cada bloco calculasse a dele, bastaria um usar "últimos 30 dias" e outro "mês" pra a
 * casa e a liga discordarem do mesmo período — a doença que este projeto mais paga.
 *
 * ⚠️ O dia é o do **BRASIL** (a cicatriz de 09/09: às 21h de São Paulo o servidor em UTC já
 * diz amanhã). E `agora` é PARÂMETRO — *o relógio só serve pra exibir "hoje" na tela*.
 */
import { rotuloDoMes } from '@/lib/periodo/mes-corrente'

export type PeriodoDaMargem = 'HOJE' | 'SEMANA' | 'MES' | 'DATAS'

export interface JanelaDaMargem {
  periodo: PeriodoDaMargem
  /** inclusivo, YYYY-MM-DD */
  de: string
  /** inclusivo, YYYY-MM-DD */
  ate: string
  /** `de` como instante UTC (início do dia) */
  deUtc: Date
  /** EXCLUSIVO: o dia seguinte a `ate` — é o `lt` da consulta */
  ateUtc: Date
  /** quantos dias a janela cobre (inclusivo) */
  dias: number
  rotulo: string
}

const DIA = 86400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

/** o dia do Brasil como YYYY-MM-DD */
export function hojeBrasil(agora: Date): string {
  return iso(new Date(agora.getTime() - 3 * 3600_000))
}

export function janelaDaMargem(
  periodo: PeriodoDaMargem,
  agora: Date,
  datas?: { de?: string | null; ate?: string | null },
): JanelaDaMargem {
  const hoje = hojeBrasil(agora)

  let de = hoje
  let ate = hoje

  if (periodo === 'SEMANA') {
    // ⚠️ bloco de 7 dias terminando HOJE, não semana de calendário: *"a 1ª barra sai menor
    // por ter menos dias, não menos trabalho"* (a lição da sparkline, 06/09)
    de = iso(new Date(Date.parse(`${hoje}T00:00:00Z`) - 6 * DIA))
  } else if (periodo === 'MES') {
    de = `${hoje.slice(0, 7)}-01`
    ate = hoje
  } else if (periodo === 'DATAS') {
    de = datas?.de || hoje
    ate = datas?.ate || hoje
    // ⚠️ invertido pelo dono: ordena em vez de devolver janela vazia (que a tela leria
    // como "não houve venda" — a família do erro disfarçado de vazio)
    if (de > ate) [de, ate] = [ate, de]
  }

  const deUtc = new Date(`${de}T00:00:00.000Z`)
  const ateUtc = new Date(Date.parse(`${ate}T00:00:00.000Z`) + DIA)
  const dias = Math.round((ateUtc.getTime() - deUtc.getTime()) / DIA)

  const rotulo =
    periodo === 'HOJE'
      ? `hoje (${ddmm(de)})`
      : periodo === 'SEMANA'
        ? `últimos 7 dias (${ddmm(de)} a ${ddmm(ate)})`
        : periodo === 'MES'
          ? `${rotuloDoMes(hoje.slice(0, 7), agora)} (até ${ddmm(ate)})`
          : `${ddmm(de)} a ${ddmm(ate)}`

  return { periodo, de, ate, deUtc, ateUtc, dias, rotulo }
}

/**
 * ⭐⭐ O CUSTO FIXO DA JANELA — e ele é **diário × dias**, nunca o total do mês cravado.
 *
 * ⛔ Uma semana não custa um mês de casa. E quando a janela atravessa a virada do mês, cada
 * mês contribui com os dias DELE e o diário DELE (o aluguel reajusta; o plano é por mês —
 * é a razão de `custo_fixo_planejado` ser por MÊS desde 06/10).
 *
 * ⚠️ `diarioPorMes` é PARÂMETRO (o chamador busca cada mês pela `lerCustosFixos`): esta
 * função é pura pra o guard poder provar a virada de mês sem subir banco.
 */
export function custoFixoDaJanela(
  j: JanelaDaMargem,
  diarioPorMes: ReadonlyMap<string, number | null>,
): { total: number | null; porque: string | null; mesesSemPlano: string[] } {
  const mesesSemPlano: string[] = []
  let total = 0

  for (let t = j.deUtc.getTime(); t < j.ateUtc.getTime(); t += DIA) {
    const mes = new Date(t).toISOString().slice(0, 7)
    const d = diarioPorMes.get(mes)
    if (d == null) {
      if (!mesesSemPlano.includes(mes)) mesesSemPlano.push(mes)
      continue
    }
    total += d
  }

  // ⛔⛔ UM mês sem plano torna o total da janela INCOMPLETO — e total incompleto com cara de
  // completo é a pior mentira possível aqui (a casa pareceria menor e o placar acenderia
  // cedo). "A apurar" nunca vira R$ 0,00.
  if (mesesSemPlano.length > 0) {
    return {
      total: null,
      porque:
        mesesSemPlano.length === 1
          ? `o plano de custo fixo de ${mesesSemPlano[0]} não foi declarado`
          : `o plano de custo fixo não foi declarado em ${mesesSemPlano.join(' e ')}`,
      mesesSemPlano,
    }
  }

  return { total: Math.round((total + 1e-9) * 100) / 100, porque: null, mesesSemPlano: [] }
}
