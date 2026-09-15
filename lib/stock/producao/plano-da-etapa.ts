// ⭐⭐⭐ O PLANO DA ETAPA — DIA PRÓPRIO, E QUEM PODE VER (15/09/2026).
//
// **Duas dores do dono, e as duas viram régua PURA aqui** porque as três telas que dependem
// delas (tablet, HOJE da gestão, tela da ordem) precisam da MESMA resposta — três cópias
// divergiriam no primeiro caso de borda, que é a doença que este módulo mais paga.
//
//   1. ***"O lote precisa poder DORMIR entre etapas"*** — massa que descansa, molho que apura.
//      Terminar a etapa 1 **não obriga** começar a 2.
//   2. ***"Sem nome = rascunho MEU. O silêncio não publica."*** — planejado sem responsável
//      não aparece pra equipe nenhuma.

/** o dia em São Paulo, no formato YYYY-MM-DD */
export type DiaSP = string

export interface EtapaParaPlano {
  /** quem a gerência designou (o 1º nome) */
  colaboradorId: string | null
  /** os demais designados (a dupla) */
  participantes?: readonly string[]
  /** ⭐ o dia previsto DESTA etapa; `null` = o dia da ordem */
  diaPrevisto: DiaSP | null
  /** ⛔ escolha explícita do dono: qualquer um da equipe pode pegar */
  liberadaParaEquipe: boolean
}

/**
 * ⭐⭐ EM QUE DIA ESTA ETAPA APARECE.
 *
 * ⚠️ O padrão é o dia da ORDEM — que é o caso comum (tudo no mesmo dia) e o que faz a regra
 * nova valer pro histórico inteiro **sem backfill**: etapa sem plano continua exatamente
 * onde sempre esteve.
 */
export function diaDaEtapa(e: Pick<EtapaParaPlano, 'diaPrevisto'>, diaDaOrdem: DiaSP): DiaSP {
  return e.diaPrevisto ?? diaDaOrdem
}

/**
 * ⭐⭐⭐ QUEM VÊ ESTA ETAPA NO TABLET.
 *
 * **A regra nova (ordem do dono):** *"a etapa só aparece no tablet/HOJE da equipe quando tem
 * RESPONSÁVEL escolhido — e aparece SÓ pra ele"*.
 *
 * ⛔ **O QUE MUDOU E POR QUÊ:** até 14/09 a etapa **solta** (sem responsável) aparecia pra
 * TODO MUNDO e qualquer um iniciava. O dono punha uma produção em "planejado" ainda pensando
 * e ela já estava publicada. *Sem nome não é "de todos" — é rascunho.*
 *
 * ⚠️ E a saída existe, mas é **explícita**: `liberadaParaEquipe` é um gesto ("liberar pra
 * equipe"), nunca o padrão por omissão. **O silêncio não publica.**
 */
export function quemVeAEtapa(e: EtapaParaPlano): 'NOMEADOS' | 'EQUIPE' | 'NINGUEM' {
  const nomeados = nomeadosDaEtapa(e)
  if (nomeados.length > 0) return 'NOMEADOS'
  // ⚠️ liberar SEM nomear é o caso "quem pegar, pegou" — continua existindo, agora escolhido
  if (e.liberadaParaEquipe) return 'EQUIPE'
  return 'NINGUEM'
}

/** os designados da etapa (o 1º nome + a dupla), sem repetir */
export function nomeadosDaEtapa(e: Pick<EtapaParaPlano, 'colaboradorId' | 'participantes'>): string[] {
  return [...new Set([e.colaboradorId, ...(e.participantes ?? [])].filter((x): x is string => !!x))]
}

/** ⭐ esta pessoa vê esta etapa? É a pergunta que o tablet faz, uma vez, por etapa. */
export function pessoaVeAEtapa(e: EtapaParaPlano, colaboradorId: string): boolean {
  const quem = quemVeAEtapa(e)
  if (quem === 'NINGUEM') return false
  if (quem === 'EQUIPE') return true
  return nomeadosDaEtapa(e).includes(colaboradorId)
}

/**
 * ⭐ O SELO DA TELA DE GESTÃO — o dono precisa SABER que aquilo não está publicado.
 *
 * ⛔ Invisível pra equipe **e** invisível pro dono seria a fila que some quando o trabalho
 * zera (a lição de 12/09): ele planejaria duas vezes o mesmo lote.
 */
export function seloDeVisibilidade(e: EtapaParaPlano): string | null {
  switch (quemVeAEtapa(e)) {
    case 'NINGUEM': return 'sem responsável — não aparece pra equipe'
    case 'EQUIPE': return 'liberada pra equipe — qualquer um pode pegar'
    default: return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ⛔⛔⛔ A ARMADILHA DO RELÓGIO — O TEMPO DO LOTE É SOMA, NUNCA FIM−INÍCIO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * **O dono, antes de o defeito aparecer:** *"o TEMPO do lote é a SOMA dos cronômetros das
 * etapas, NUNCA fim−início atravessando a noite. Lote que dorme 16h não produziu 16h."*
 *
 * ⛔⛔ **E O DEFEITO JÁ EXISTIA** — `lotes.ts` dizia, em comentário: *"a duração do LOTE é da
 * 1ª etapa iniciada à última finalizada"*. Qualquer lote com intervalo grande entre etapas
 * **já inflava** a média por lote, o gráfico por dia e o "melhor ritmo". A feature de etapas
 * em dias diferentes só tornaria isso rotina.
 *
 * ⚠️ E a régua de honestidade não afrouxa: **etapa sem `finalizadoEm` = lote sem tempo
 * medido** (`null`), porque inventar o fim seria inventar minutos. `null` ≠ 0.
 */
export function minutosDoLote(
  etapas: readonly { iniciadoEm: Date | null; finalizadoEm: Date | null }[],
): number | null {
  const iniciadas = etapas.filter((e) => e.iniciadoEm)
  if (!iniciadas.length) return null
  // ⛔ alguma começou e não terminou → o lote NÃO tem tempo medido
  if (iniciadas.some((e) => !e.finalizadoEm)) return null
  return iniciadas.reduce(
    (s, e) => s + Math.max(0, Math.round((e.finalizadoEm!.getTime() - e.iniciadoEm!.getTime()) / 60_000)),
    0,
  )
}

/**
 * ⭐ O LOTE DORMIU? — quantas horas o relógio ficou parado entre as etapas.
 *
 * ⚠️ Serve pra a tela **explicar** (o selo "começou ontem") e pro alarme **não** gritar: se o
 * descanso é intencional (a etapa seguinte tem dia previsto pra frente), parada não é atraso.
 * ⛔ Nunca entra em NENHUMA média — é informação, não tempo de trabalho.
 */
export function horasDormindo(
  etapas: readonly { iniciadoEm: Date | null; finalizadoEm: Date | null }[],
): number {
  const ord = etapas.filter((e) => e.iniciadoEm).sort((a, b) => a.iniciadoEm!.getTime() - b.iniciadoEm!.getTime())
  let total = 0
  for (let i = 1; i < ord.length; i++) {
    const fimAnterior = ord[i - 1].finalizadoEm
    if (!fimAnterior) continue
    const gap = ord[i].iniciadoEm!.getTime() - fimAnterior.getTime()
    if (gap > 0) total += gap
  }
  return Math.round((total / 3_600_000) * 10) / 10
}
