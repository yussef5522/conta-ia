// INFRA — a CHAVE RESERVA vigiada (FASE 0 PASSO 4, 26/10/2026).
//
// "Backup sem teste é esperança, não cópia" — e backup que PAROU de rodar sem ninguém
// avisar é a mesma coisa com outro nome. Os dois scripts da madrugada gravam um arquivo
// de estado; este módulo é quem LÊ e grita.
//
//   /opt/conta-ia/scripts/backup-diario.sh  (cron 02:30) → backup-diario.state
//   /opt/conta-ia/scripts/backup-prova.sh   (cron dom 04:00) → backup-prova.state
//
// Formato de cada .state, UMA linha:  <OK|FALHOU> <ISO-8601> <detalhe livre>
//
// ⚠️ MÓDULO PRÓPRIO, e não dentro do health.ts, por três razões concretas:
//   (a) a PERGUNTA é outra — health.ts responde "a máquina tem folga?", este responde
//       "a cópia de fora existe e foi provada?";
//   (b) a FONTE é outra (arquivo de estado × /proc/meminfo) e o GATE é outro (o diretório
//       /var/lib/conta-ia existir × o /proc existir) — enfiar estado de backup dentro de
//       `LeituraInfra`, que é a leitura do /proc, seria mentir sobre o que aquele tipo é;
//   (c) é o padrão que o cron-judge já tem: ele junta health + deploy-health + rotas-lentas.
//       Este é o 4º módulo de infra, não uma exceção.
//
// ⭐ E ELE NASCE VERMELHO DE PROPÓSITO: enquanto o dono não der as 2 chaves do cofre, o
// backup-diario.sh é INERTE e grava FALHOU. Não é alarme falso — é a verdade (não existe
// cópia fora da máquina). Ele apaga sozinho no primeiro backup que subir.

import { readFileSync, existsSync } from 'fs'

export const DIR_ESTADO = '/var/lib/conta-ia'
export const ESTADO_DIARIO = `${DIR_ESTADO}/backup-diario.state`
export const ESTADO_PROVA = `${DIR_ESTADO}/backup-prova.state`

/**
 * Idade máxima do backup DIÁRIO antes de gritar.
 *
 * ⚠️ 36h é escolha MEDIDA, não número redondo. O backup roda 02:30 e o juiz 03:00, então
 * a idade normal é ~30 min. Um teto curto (ex. 20h) pegaria uma noite perdida, mas daria
 * ALARME FALSO em toda rodada manual do juiz depois das 22h — e alarme falso repetido é
 * como um alarme morre. Com 36h: a rodada manual a qualquer hora passa calada, duas noites
 * perdidas gritam, e — o que mais importa — o modo de falha COMUM (o backup rodou e deu
 * erro) dispara NA HORA pelo status FALHOU, independente de idade.
 */
export const N5_IDADE_MAX_H = 36
/**
 * Idade máxima da PROVA semanal. O cron é domingo 04:00, então a idade normal chega a ~7
 * dias; 10 dias deixa o ciclo normal calado e faz UM domingo perdido (14 dias) gritar.
 */
export const N6_IDADE_MAX_DIAS = 10

export interface EstadoDaRotina {
  status: 'OK' | 'FALHOU'
  quando: Date
  detalhe: string
}

export interface CheckChaveReserva {
  invariante: 'N5' | 'N6'
  nivel: 'erro' | 'aviso'
  detalhe: string
}

/**
 * Lê UM arquivo de estado. Devolve `null` quando não dá pra ler OU quando a linha não tem
 * a forma esperada.
 *
 * ⛔ Linha malformada vira `null`, nunca um estado "OK" otimista: um .state truncado é
 * exatamente o caso em que não se pode afirmar que o backup correu bem.
 */
export function lerEstado(caminho: string): EstadoDaRotina | null {
  let txt: string
  try {
    txt = readFileSync(caminho, 'utf-8')
  } catch {
    return null
  }
  const m = txt.trim().match(/^(OK|FALHOU)\s+(\S+)(?:\s+([\s\S]*))?$/)
  if (!m) return null
  const quando = new Date(m[2])
  if (Number.isNaN(quando.getTime())) return null
  return { status: m[1] as 'OK' | 'FALHOU', quando, detalhe: (m[3] ?? '').trim() }
}

function horas(de: Date, ate: Date): number {
  return (ate.getTime() - de.getTime()) / 36e5
}

/** Formata a idade do jeito que o dono lê: "há 3h" / "há 2 dias". */
function idade(h: number): string {
  if (h < 48) return `há ${Math.floor(h)}h`
  return `há ${Math.floor(h / 24)} dias`
}

/**
 * PURA — a decisão, testável sem máquina e sem relógio (o `agora` entra por PARÂMETRO:
 * teste com data fixa comparada ao relógio real é bomba de calendário, a REGRA 12 de 01/09).
 *
 * Lista vazia = a chave reserva está de pé.
 */
export function avaliarChaveReserva(e: {
  diario: EstadoDaRotina | null
  prova: EstadoDaRotina | null
  agora: Date
}): CheckChaveReserva[] {
  const out: CheckChaveReserva[] = []

  // ───────── N5 — o backup diário fora da máquina ─────────
  if (!e.diario) {
    out.push({
      invariante: 'N5', nivel: 'erro',
      detalhe: `o backup diário NUNCA gravou estado em ${ESTADO_DIARIO} — ou o cron de 02:30 não existe, ou ele morre antes da 1ª linha. Rodar à mão pra ver o motivo: \`bash /opt/conta-ia/scripts/backup-diario.sh\`.`,
    })
  } else if (e.diario.status === 'FALHOU') {
    out.push({
      invariante: 'N5', nivel: 'erro',
      detalhe: `o backup diário FALHOU (${idade(horas(e.diario.quando, e.agora))}): ${e.diario.detalhe || 'sem detalhe'}. ⛔ Enquanto isto estiver vermelho NÃO EXISTE cópia do banco fora desta máquina — se o droplet morrer, morre o dado com ele.`,
    })
  } else {
    const h = horas(e.diario.quando, e.agora)
    if (h > N5_IDADE_MAX_H) {
      out.push({
        invariante: 'N5', nivel: 'erro',
        detalhe: `o último backup diário que deu certo foi ${idade(h)} (teto ${N5_IDADE_MAX_H}h) — o cron de 02:30 parou de rodar. O ÚLTIMO estado era OK, então a cópia de ontem existe; o que não está acontecendo é a de hoje. Conferir com \`crontab -l\` e rodar à mão.`,
      })
    }
  }

  // ───────── N6 — a prova semanal do restore ─────────
  if (!e.prova) {
    out.push({
      invariante: 'N6', nivel: 'erro',
      detalhe: `a prova de restore NUNCA gravou estado em ${ESTADO_PROVA}. Backup sem teste é esperança, não cópia — rodar \`bash /opt/conta-ia/scripts/backup-prova.sh\`.`,
    })
  } else if (e.prova.status === 'FALHOU') {
    out.push({
      invariante: 'N6', nivel: 'erro',
      detalhe: `a prova de restore FALHOU (${idade(horas(e.prova.quando, e.agora))}): ${e.prova.detalhe || 'sem detalhe'}. ⛔ Isto é mais grave que o backup não ter rodado: significa que existe um arquivo de backup que NÃO volta.`,
    })
  } else {
    const h = horas(e.prova.quando, e.agora)
    if (h > N6_IDADE_MAX_DIAS * 24) {
      out.push({
        invariante: 'N6', nivel: 'erro',
        detalhe: `a última prova de restore que passou foi ${idade(h)} (teto ${N6_IDADE_MAX_DIAS} dias) — o cron de domingo 04:00 parou. A cópia pode estar sendo gravada e ninguém está conferindo que ela VOLTA.`,
      })
    }
  }

  return out
}

/**
 * Atalho pro cron: lê os dois estados + avalia.
 *
 * ⚠️ GATE: se o diretório de estado não existe, esta máquina não é o servidor da chave
 * reserva (dev/Mac) → devolve lista vazia, do mesmo jeito que o `lerInfra` se cala sem
 * /proc. ⛔ Mas se o diretório EXISTE e o arquivo não, aí é erro — ali o silêncio
 * significaria "o backup nunca rodou e ninguém soube".
 */
export function checkChaveReserva(
  agora: Date = new Date(),
  dir: string = DIR_ESTADO,
): { habilitado: boolean; diario: EstadoDaRotina | null; prova: EstadoDaRotina | null; checks: CheckChaveReserva[] } {
  if (!existsSync(dir)) return { habilitado: false, diario: null, prova: null, checks: [] }
  const diario = lerEstado(`${dir}/backup-diario.state`)
  const prova = lerEstado(`${dir}/backup-prova.state`)
  return { habilitado: true, diario, prova, checks: avaliarChaveReserva({ diario, prova, agora }) }
}
