// ⛔⛔⛔ O DIA É O DE QUEM OPERA — NUNCA O DIA UTC (05/09/2026).
//
// **CASO REAL, medido em prod:** o dono concluiu **9 lotes** em 05/09 (17:49–17:58 SP) e, ao
// abrir o painel às **22:16 SP**, o filtro **"hoje" mostrou ZERO** — as mesmas 9 apareciam em
// "semana". Não era gravação errada: `criadoEm` guarda o INSTANTE, e isso está certo. O erro
// era a **pergunta "que dia é hoje?"** ser respondida com `new Date().toISOString()`, que é
// UTC: às 22:16 de São Paulo já é **06/09** em UTC, então a tela pedia o dia seguinte e o
// servidor devolvia, corretamente, o nada que existe nele.
//
// ⚠️ **DAS 21H À MEIA-NOITE, TODO DIA** — e é justamente o horário em que a cozinha fecha e
// lança a produção. Zero numa tela minutos depois de trabalhar é o tipo de zero que faz
// alguém achar que o sistema perdeu o dado.
//
// ⛔ E A CLASSE É "N CAMINHOS, 1 ESQUECIDO", DE NOVO: em 02/09 o recorte do painel foi
// corrigido pra BRT **no ramo sem parâmetros** — e a tela **sempre** manda `?de=&ate=`, então
// o ramo consertado é o único que ela nunca usa. Corrigir o vizinho e não o vizinho do lado
// é a assinatura da família (o fóssil do LEDGERBAL, a régua do bloco de fim de semana).
//
// ⭐ AS DUAS PERGUNTAS, SEPARADAS E COM DONO ÚNICO:
//     1. que DIA é agora, pra quem está na cozinha?   → `diaEmSaoPaulo`
//     2. que INSTANTES UTC esse dia cobre?            → `janelaDoDiaSP`
//
// ⚠️ **`Intl` em vez do offset fixo −3:** o projeto tem `SAO_PAULO_OFFSET_HOURS = -3` em três
// lugares, com o comentário *"quando voltar o horário de verão, trocar pra Intl"*. O horário
// de verão é decisão política e volta por decreto; quando voltar, um `-3` cravado erra por
// uma hora **na fronteira do dia**, que é exatamente onde este bug vive. O fuso responde por
// si.

const TZ = 'America/Sao_Paulo'

/** 'YYYY-MM-DD' — en-CA é o locale que já formata nessa ordem, sem montagem manual */
const FMT_DIA = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
})

/**
 * ⭐ QUE DIA É AGORA EM SÃO PAULO ('YYYY-MM-DD'). PURA (o instante é PARÂMETRO).
 *
 * ⚠️ `agora` é parâmetro porque **o relógio nunca decide sozinho num teste** — é a regra que
 * este projeto já pagou pra aprender (as bombas de data fixa de 01/09). Em produção o default
 * é o relógio; num teste, o instante é escrito.
 */
export function diaEmSaoPaulo(agora: Date = new Date()): string {
  return FMT_DIA.format(agora)
}

/**
 * O offset do fuso NAQUELE instante, em minutos (SP hoje: −180).
 *
 * Deriva do próprio fuso comparando a hora de parede com a hora UTC — assim um eventual
 * horário de verão futuro entra sozinho, sem ninguém lembrar de mudar um `-3`.
 */
function offsetMinutos(instante: Date): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instante)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  // `hour` pode vir '24' à meia-noite em algumas engines — normaliza pra 0
  const parede = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'))
  return Math.round((parede - Math.floor(instante.getTime() / 1000) * 1000) / 60000)
}

/**
 * ⭐⭐ OS INSTANTES UTC QUE UM INTERVALO DE DIAS DE SÃO PAULO COBRE. PURA.
 *
 * `de`/`ate` são dias de calendário ('YYYY-MM-DD') como o usuário os enxerga. A saída é o
 * par de instantes pra comparar contra um `timestamp` gravado (`criadoEm`, `finalizadoEm`).
 *
 * ⛔ **Isto é o que faltava:** o recorte antigo (`${dia}T00:00:00.000Z`) cobria o dia UTC, que
 * começa **21h do dia anterior** em São Paulo e termina 21h do próprio dia — perdendo as três
 * últimas horas de trabalho de todo dia e emprestando três horas do dia anterior.
 */
export function janelaDoDiaSP(de: string, ate: string = de): { de: Date; ate: Date } {
  // 00:00 do dia `de` em SP: parte do palpite UTC e corrige pelo offset REAL daquele instante
  const inicioPalpite = new Date(`${de}T00:00:00.000Z`)
  const inicio = new Date(inicioPalpite.getTime() - offsetMinutos(inicioPalpite) * 60_000)
  const fimPalpite = new Date(`${ate}T23:59:59.999Z`)
  const fim = new Date(fimPalpite.getTime() - offsetMinutos(fimPalpite) * 60_000)
  return { de: inicio, ate: fim }
}

/**
 * Anda N dias no CALENDÁRIO ('YYYY-MM-DD' → 'YYYY-MM-DD'), pra montar "últimos 7 dias".
 *
 * ⚠️ Anda em UTC de propósito: aqui não há hora nenhuma envolvida, só a contagem de dias do
 * calendário — e é o único jeito de "menos 6 dias" não escorregar num dia de 23 ou 25 horas.
 */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
