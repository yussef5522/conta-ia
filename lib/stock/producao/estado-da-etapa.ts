// ⭐⭐ OS CINCO ESTADOS DA ETAPA — UMA DERIVAÇÃO SÓ, PRA TODAS AS TELAS (07/09/2026).
//
// **A ordem do dono:** *"Etapa só tem 5 estados e cada um com UMA cara em TODAS as telas.
// 'Na fila' + ordem concluída — a contradição do print — não pode existir por construção: o
// estado deriva da ordem, e o card da pessoa usa a MESMA derivação da tela da ordem."*
//
// ⛔⛔ **ERAM DUAS DERIVAÇÕES** e por isso a tela se contradizia: a tela da ordem tinha o seu
// `estadoDaEtapa` (AGUARDANDO/EM_ANDAMENTO/FEITA) e o "HOJE ao vivo" calculava o dele inline
// (NA_FILA/AGUARDA_ANTERIOR/FAZENDO/FEITA). Duas respostas pra mesma pergunta, calculadas em
// pontos diferentes — **é a lição do B1**, e foi assim que "na fila" sobreviveu numa ordem já
// concluída. Agora existe UMA função pura; as telas só pintam.
//
// ⚠️ **O ESTADO DERIVA DA ORDEM, não de um registro.** Os registros (`stock_etapa_encerrada`,
// `stock_etapa_finalizada_gerente`) carregam o RASTRO — quem, quando, por quê. Se a tela
// dependesse deles pra não mentir, toda linha antiga (as de antes do fix) mentiria.

export type EstadoDaEtapa =
  /** designada ou solta, ninguém começou */
  | 'AGUARDANDO'
  /** alguém está com a mão na massa — ⛔ SÓ em ordem VIVA */
  | 'EM_ANDAMENTO'
  /** a pessoa apertou FINALIZAR: tempo MEDIDO, entra nas médias */
  | 'FEITA'
  /** o gerente finalizou no lugar dela: tempo A APURAR, fora das médias */
  | 'FINALIZADA_PELO_GERENTE'
  /** a ordem encerrou e levou a etapa junto: tempo A APURAR, fora das médias */
  | 'ENCERRADA_SEM_FINALIZAR'

export interface ContextoDaEtapa {
  iniciadoEm: Date | null
  finalizadoEm: Date | null
  /** existe registro de finalização pelo gerente */
  finalizadaPeloGerente: boolean
  /** a ordem desta etapa NÃO está CONCLUIDA nem CANCELADA */
  ordemViva: boolean
}

/**
 * ⭐⭐ A ÚNICA DERIVAÇÃO. PURA.
 *
 * ⚠️ A ORDEM DOS TESTES IMPORTA e cada degrau tem motivo:
 *  1. **gerente primeiro** — se ele finalizou, o fato é esse, mesmo que a ordem tenha
 *     encerrado depois; o rastro dele é mais específico que "a ordem levou junto".
 *  2. **`finalizadoEm` depois** — a pessoa apertou o botão; é o único caso com tempo medido.
 *  3. **ordem morta** — ⛔ é AQUI que a contradição do print morre: etapa não finalizada em
 *     ordem encerrada NUNCA volta a ser "em andamento" nem "na fila", tenha ela começado
 *     ou não.
 *  4. iniciada → em andamento · 5. nada → aguardando.
 */
export function derivarEstadoDaEtapa(e: ContextoDaEtapa): EstadoDaEtapa {
  if (e.finalizadaPeloGerente) return 'FINALIZADA_PELO_GERENTE'
  if (e.finalizadoEm) return 'FEITA'
  if (!e.ordemViva) return 'ENCERRADA_SEM_FINALIZAR'
  if (e.iniciadoEm) return 'EM_ANDAMENTO'
  return 'AGUARDANDO'
}

/**
 * ⛔⛔ OS ESTADOS SEM TEMPO MEDIDO — a lista que mantém as médias honestas.
 *
 * ⚠️ Existe como CONSTANTE, e não como um `if` repetido, porque a pergunta *"esta etapa tem
 * tempo pra entrar na média?"* é feita no relatório, no alarme, na tela da ordem e no dia ao
 * vivo. Quatro cópias divergiriam no primeiro estado novo — e a que ficasse pra trás
 * colocaria tempo inventado dentro de um número que o dono usa pra conversar com a equipe.
 */
export const SEM_TEMPO_MEDIDO: readonly EstadoDaEtapa[] = [
  'AGUARDANDO', 'EM_ANDAMENTO', 'FINALIZADA_PELO_GERENTE', 'ENCERRADA_SEM_FINALIZAR',
]

/** ⭐ o tempo desta etapa entrou no relógio de verdade? Só FEITA tem tempo medido. */
export function temTempoMedido(estado: EstadoDaEtapa): boolean {
  return estado === 'FEITA'
}

/** ⭐ o trabalho terminou (de um jeito ou de outro)? FEITA e FINALIZADA_PELO_GERENTE. */
export function trabalhoConcluido(estado: EstadoDaEtapa): boolean {
  return estado === 'FEITA' || estado === 'FINALIZADA_PELO_GERENTE'
}

/**
 * ⭐ O RÓTULO — a MESMA frase nas três telas.
 *
 * ⚠️ Ele mora aqui e não em cada componente porque *"cada estado com UMA cara em TODAS as
 * telas"* (dono) só é verificável se a frase tiver um dono. Texto copiado em três telas
 * diverge na primeira revisão de uma delas.
 */
export function rotuloDoEstado(
  estado: EstadoDaEtapa,
  ctx?: { iniciou: boolean; ordemCancelada?: boolean; gerente?: string | null; pessoa?: string | null },
): string {
  switch (estado) {
    case 'AGUARDANDO': return 'na fila'
    case 'EM_ANDAMENTO': return 'em andamento'
    case 'FEITA': return 'finalizada'
    case 'FINALIZADA_PELO_GERENTE':
      // ⛔ o rastro diz QUEM APERTOU — nunca "entrar na conta dela" (regra do dono)
      return ctx?.gerente
        ? `finalizada por ${ctx.gerente}${ctx.pessoa ? ` em nome de ${ctx.pessoa}` : ''} · tempo a apurar`
        : 'finalizada pelo gerente · tempo a apurar'
    case 'ENCERRADA_SEM_FINALIZAR':
      // ⚠️ duas leituras diferentes, e a diferença importa pra quem confere o dia: uma etapa
      // que COMEÇOU e ficou aberta ≠ uma que ninguém chegou a pegar.
      return ctx?.iniciou === false
        ? `não foi feita — a ordem foi ${ctx?.ordemCancelada ? 'cancelada' : 'concluída pela Produção'}`
        : `ficou aberta — a ordem foi ${ctx?.ordemCancelada ? 'cancelada' : 'concluída pela Produção'}`
  }
}
