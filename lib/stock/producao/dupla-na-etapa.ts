// ⭐⭐⭐ A DUPLA NA MESMA ETAPA (08/09/2026) — desenho aprovado pelo dono.
//
// *"A cozinha provou o caso: beef de xis/burger tem produção em que UMA etapa precisa de
// DUAS pessoas trabalhando juntas."*
//
// ⛔⛔ A v1 TRAVOU EM 1 RESPONSÁVEL POR ETAPA DE PROPÓSITO — pra não ratear tempo no chute.
// A evolução mantém a honestidade inteira e só admite que duas pessoas podem estar na mesma
// etapa: **dois relógios individuais**, cada um do próprio PIN, e nenhum minuto dividido.
//
// AS DUAS DECISÕES DO DONO, e elas são o coração deste arquivo:
//
//   1. **O SEGUNDO É OPCIONAL — "quem pegou, pegou".** *"Designação é plano, não contrato:
//      se só um iniciou e terminou, o trabalho aconteceu."* A etapa fica FEITA quando todos
//      que **INICIARAM** finalizarem. ⛔ Quem foi designado e nunca iniciou **não trava
//      nada** — *"travar a etapa esperando quem não veio pararia a cozinha por um plano
//      furado"*.
//
//   2. **A ETAPA 2 LIBERA COM A 1 FEITA.** *"A dependência é física — o moldar precisa do
//      gessado PRONTO; com um da dupla ainda trabalhando, o material não está inteiro."*
//      ⭐ E isso NÃO muda a regra de sequência: ela continua olhando `etapa.finalizadoEm`,
//      que passa a ser carimbado exatamente quando o último participante finaliza. **Uma
//      regra só, igual à de hoje.**

/** ⛔ o teto, travado na gravação — não é conselho de tela */
export const MAX_PARTICIPANTES = 2

export interface Participante {
  colaboradorId: string
  nome?: string
  iniciadoEm: Date | null
  finalizadoEm: Date | null
  /** ⚠️ o gerente fechou por ela: tem fim, mas NÃO tem tempo medido */
  finalizadaPeloGerente?: boolean
}

export class DuplaError extends Error {}

/**
 * Pode entrar mais uma pessoa nesta etapa?
 *
 * ⛔ O teto é **2** e vale na GRAVAÇÃO. Deixar a tela cuidar disso seria a trava que some no
 * dia em que alguém chamar a rota por fora.
 */
export function validarEntrada(atuais: readonly Participante[], novoId: string): void {
  if (atuais.some((p) => p.colaboradorId === novoId)) return   // já está: idempotente
  if (atuais.length >= MAX_PARTICIPANTES) {
    throw new DuplaError(
      `Uma etapa aceita no máximo ${MAX_PARTICIPANTES} pessoas. Tire alguém antes de colocar outra.`,
    )
  }
}

/**
 * ⭐⭐ QUEM DE FATO TRABALHOU: quem **iniciou**.
 *
 * ⚠️ É a decisão 1 virando função. O designado que nunca tocou no INICIAR não é
 * participante do trabalho — ele era plano.
 */
export function quemTrabalhou(ps: readonly Participante[]): Participante[] {
  return ps.filter((p) => p.iniciadoEm != null)
}

/**
 * ⭐⭐ A ETAPA ESTÁ FEITA? **Quando todos que iniciaram finalizaram.**
 *
 * ⛔ `false` quando NINGUÉM iniciou: etapa sem toque nenhum não é "feita", é aguardando —
 * e devolver `true` aqui faria a etapa seguinte liberar sem nada ter sido produzido.
 */
export function etapaEstaFeita(ps: readonly Participante[]): boolean {
  const trabalharam = quemTrabalhou(ps)
  if (!trabalharam.length) return false
  return trabalharam.every((p) => p.finalizadoEm != null)
}

/** quem começou e ainda não fechou — é quem segura a etapa (e quem o gerente resolve) */
export function aindaTrabalhando(ps: readonly Participante[]): Participante[] {
  return ps.filter((p) => p.iniciadoEm != null && p.finalizadoEm == null)
}

/**
 * ⚠️ O DESIGNADO QUE NÃO VEIO — sai com RASTRO, não em silêncio.
 *
 * *"Sai da etapa na conclusão com rastro ('designado, não participou') e some da fila dele."*
 * Sumir calado apagaria o plano; e o plano é informação de gestão (quem foi escalado e não
 * apareceu), não lixo.
 */
export function designadosQueNaoParticiparam(ps: readonly Participante[]): Participante[] {
  return ps.filter((p) => p.iniciadoEm == null)
}

export interface FatiaDaEtapa {
  colaboradorId: string
  /** as unidades que entram no relatório DELE */
  unidades: number
  /** os minutos do relógio DELE — `null` quando não há tempo medido */
  minutos: number | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * ⭐⭐ A DIVISÃO DAS UNIDADES — **só entre quem MEDIU**.
 *
 * ⛔⛔ E ESTA É A REGRA QUE MAIS IMPORTA, pelas palavras do dono: *"quem foi finalizado pelo
 * gerente NÃO divide — dividir com quem não tem relógio inflaria a velocidade, a família do
 * tempo-zero"*.
 *
 * O raciocínio, ao pé da letra: `min/un = minutos ÷ unidades`. Dar unidades a quem não tem
 * minutos medidos **aumenta o denominador de alguém sem aumentar o numerador de ninguém** —
 * é exatamente o defeito de 06/09, em que "0 min/un" se lia como "a mais rápida de todas".
 *
 * ⚠️ Se NINGUÉM mediu (os dois foram fechados pelo gerente), a divisão é igual entre eles e
 * os minutos ficam `null`: as unidades existem — alguém produziu —, mas **a velocidade é a
 * apurar**. O volume conta; o que não dá pra medir é o ritmo.
 */
export function dividirUnidades(ps: readonly Participante[], unidades: number): FatiaDaEtapa[] {
  const trabalharam = quemTrabalhou(ps)
  if (!trabalharam.length) return []

  const minutosDe = (p: Participante): number | null => {
    if (p.finalizadaPeloGerente) return null       // ⛔ tem fim, não tem tempo
    if (!p.iniciadoEm || !p.finalizadoEm) return null
    return Math.max(0, Math.round((p.finalizadoEm.getTime() - p.iniciadoEm.getTime()) / 60000))
  }

  const comRelogio = trabalharam.filter((p) => minutosDe(p) != null)
  // ⭐ quem divide: quem MEDIU. Sem ninguém medido, todos dividem — mas sem minutos.
  const dividem = comRelogio.length ? comRelogio : trabalharam
  const fatia = round2(unidades / dividem.length)

  return trabalharam.map((p) => ({
    colaboradorId: p.colaboradorId,
    unidades: dividem.some((d) => d.colaboradorId === p.colaboradorId) ? fatia : 0,
    minutos: minutosDe(p),
  }))
}
