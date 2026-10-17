/**
 * ⭐⭐⭐ A LEI DO DIA FECHADO — ZERO DE VERDADE × "A APURAR" (refina a lei C2)
 *
 * **O CASO QUE PARIU A LEI** (Coxão Mole, semana 11→17/10, palavra do dono em 17/10): a casa
 * produziu porção dom/seg/ter e **NÃO abriu coxão de qua a sex porque já tinha porção pronta no
 * estoque**. A tela mostrou qua–sáb como **"—"** (a apurar) e o herói disse *"56 KG · ▼ −17,7%"*.
 * ⛔ **O defeito não era o número, era o RÓTULO**: `porDia.has(dia)` era a única pergunta, então
 * **ausência de MOVIMENTO virava ausência de DADO** — e dia que o dono conhece inteiro aparecia
 * como dúvida, ficava fora da média, e a cobertura dizia *"7,6 dias"* ao lado de *"sem média
 * medida ainda"*.
 *
 * ═══ A LEI, em três estados e nenhum silêncio ═══
 *
 * **FECHADO** — dia PASSADO sem nada pendente de conferência pra aquele item naquele dia.
 *   ⭐ **ZERO É DADO:** barra no chão com o "0" escrito, e **ENTRA na média**. Não houve consumo
 *   porque não houve consumo — isso é um fato medido, não uma lacuna.
 *
 * **PENDENTE** — o livro daquele dia **ainda vai mudar** pra aquele item. Só aqui o traço "—"
 *   aparece, e ele **diz o motivo no título**. ⛔ Fica **FORA** da média: não é zero nem número.
 *
 * **HOJE** — dia ABERTO. Mostra o parcial que já saiu, com selo *"hoje · parcial"*, e
 *   ⛔ **não entra como dia completo em média nenhuma**. (`FUTURO` é o irmão do hoje do outro
 *   lado: dia que não aconteceu não tem barra nem média — só existe quando o dono escolhe uma
 *   faixa de datas que passa de hoje.)
 *
 * ⛔⛔ **ESTE ARQUIVO É PURO** — ele não conhece `prisma`, não sabe de onde vem a pendência e não
 * consulta nada. Quem MEDE quais dias estão pendentes é `pendencia-do-livro.ts`; quem decide o
 * RÓTULO é aqui. Misturar as duas coisas faria a régua depender de banco e deixaria de ser
 * testável sem ele — e é a régua que a tela, a média, a cobertura e o `contaDoPedido` leem.
 */

/**
 * `FUTURO` só aparece em faixa de datas que passa de hoje (o seletor livre permite).
 *
 * ⚠️⚠️ **`SEM_LIVRO` nasceu de um teste de 16/10 reprovando a lei de 17/10** — e ele estava
 * certo. Com "dia passado sem movimento = 0", a baseline de 28 dias inventava **21 dias de
 * consumo zero pra um item que entrou no sistema há 7** — e aí a média por dia-da-semana saía
 * diluída a 1/4 do real. ***Número plausível e errado é pior que "a apurar"***: o pedido sairia
 * menor e a prateleira acabaria. Dia ANTES do primeiro movimento do item **não é zero, é
 * ausência de livro** — o item não estava na casa.
 */
export type EstadoDoDia = 'FECHADO' | 'PENDENTE' | 'HOJE' | 'FUTURO' | 'SEM_LIVRO'

export interface DiaDoConsumo {
  dia: string
  /** SEG-first (0 = segunda) — a régua da tela */
  diaDaSemana: number
  estado: EstadoDoDia
  /**
   * FECHADO → o número (**0** quando não houve movimento) · HOJE → o parcial já lançado ·
   * PENDENTE e FUTURO → **`null`**, que é o único "a apurar" que sobrou.
   */
  valor: number | null
}

/**
 * ⭐ A ORDEM DAS PERGUNTAS É A LEI, e ela não é arbitrária.
 *
 * **HOJE vem antes de PENDENTE** porque hoje é dia aberto por natureza: a venda do dia ainda
 * está acontecendo, e chamá-lo de pendente faria o dono esperar um arquivo que só chega de
 * noite. **FUTURO vem antes de tudo**: dia que não aconteceu não pode estar pendente de nada.
 */
export function estadoDoDia(
  dia: string,
  hoje: string,
  pendentes: ReadonlySet<string>,
  /** o 1º dia que o livro cobre pra este item (o 1º movimento dele); `null` = cobre sempre */
  cobertoDesde?: string | null,
): EstadoDoDia {
  if (dia > hoje) return 'FUTURO'
  if (dia === hoje) return 'HOJE'
  // ⛔ antes do item existir no ledger não há zero a medir — há ausência
  if (cobertoDesde && dia < cobertoDesde) return 'SEM_LIVRO'
  return pendentes.has(dia) ? 'PENDENTE' : 'FECHADO'
}

/**
 * ⚠️ `bruto` é o que o ledger tem pro dia (`undefined` quando não há movimento nenhum). A régua
 * **nunca** clampa negativo pra cima nem arredonda — quem faz isso é o chamador, que sabe a
 * precisão do módulo (3 casas, grama/ml).
 */
export function valorDoDia(estado: EstadoDoDia, bruto: number | undefined): number | null {
  if (estado === 'PENDENTE' || estado === 'FUTURO' || estado === 'SEM_LIVRO') return null
  return bruto ?? 0
}

/**
 * ⛔⛔ **A trava que impede o laço:** só o dia **FECHADO** entra em média. HOJE fica fora porque
 * é parcial (entrar puxaria toda média pra baixo no meio do dia, justamente quando o dono
 * confere), PENDENTE fica fora porque o número dele vai mudar, e FUTURO não existe.
 */
export function entraNaMedia(estado: EstadoDoDia): boolean {
  return estado === 'FECHADO'
}

/** ⭐ Tem dia PENDENTE DE VERDADE no recorte? É o que acende **UM** selo no herói (anti-spam). */
export function temDiaAApurar(dias: readonly DiaDoConsumo[]): boolean {
  return dias.some((d) => d.estado === 'PENDENTE')
}

/**
 * ⭐ Monta os dias de uma janela `[de, ate]` (ate INCLUSIVO) pela lei, com o consumo bruto vindo
 * do mapa do ledger. É o dono único usado pelas BARRAS do herói e pela BASELINE da média — duas
 * montagens divergiriam no primeiro estado novo, e aí a barra diria "0" num dia que a média
 * tratou como pendente.
 */
export function montarDias(input: {
  de: string
  ate: string
  hoje: string
  pendentes: ReadonlySet<string>
  /** o 1º dia que o livro cobre pra este item; `null`/ausente = cobre toda a janela */
  cobertoDesde?: string | null
  /** dia ISO → consumo bruto do ledger */
  porDia: ReadonlyMap<string, number>
  /** converte o dia ISO no índice SEG-first */
  diaDaSemana: (dia: string) => number
  /** a precisão do módulo (o chamador manda a dele) */
  arredonda: (n: number) => number
}): DiaDoConsumo[] {
  const DIA_MS = 86_400_000
  const out: DiaDoConsumo[] = []
  const fim = Date.parse(`${input.ate}T00:00:00Z`)
  for (let t = Date.parse(`${input.de}T00:00:00Z`); t <= fim; t += DIA_MS) {
    const dia = new Date(t).toISOString().slice(0, 10)
    const estado = estadoDoDia(dia, input.hoje, input.pendentes, input.cobertoDesde)
    const bruto = input.porDia.get(dia)
    const v = valorDoDia(estado, bruto)
    out.push({
      dia,
      diaDaSemana: input.diaDaSemana(dia),
      estado,
      valor: v == null ? null : input.arredonda(Math.max(0, v)),
    })
  }
  return out
}

/**
 * ⭐⭐ A LEGENDA DA COBERTURA (lei C13) — **morre a contradição** de *"7,6 dias"* embaixo de
 * *"sem média medida ainda"*.
 *
 * São DUAS perguntas que a tela colapsava numa: **a cobertura existe?** (precisa de média
 * medida) e **o farol existe?** (precisa dos dias de CHEGADA configurados). Com média e sem
 * config, a cobertura é um número honesto e o farol é que não dá pra acender — e a legenda
 * passa a dizer isso em vez de negar a média que ela mesma acabou de usar.
 *
 * ⚠️ A janela vem por PARÂMETRO (`diasDaBaseline`): digitar "28" aqui seria a segunda régua no
 * dia em que a baseline mudar — a cicatriz do `TETO = 25` cravado em tela.
 */
export function legendaDaCobertura(input: {
  cobertura: number | null
  farol: 'CORAL' | 'AMBAR' | 'VERDE' | 'A_APURAR'
  /** quantos dos 7 dias-da-semana têm média medida */
  diasComMedia: number
  diasDaBaseline: number
}): string {
  if (input.cobertura == null) {
    return input.diasComMedia === 0
      ? 'sem consumo medido ainda'
      : `o item não consome na média de ${input.diasDaBaseline}d`
  }
  const janela = `média de ${input.diasDaBaseline}d · ${input.diasComMedia} de 7 dias da semana`
  if (input.farol === 'CORAL') return `acaba antes da chegada · ${janela}`
  if (input.farol === 'AMBAR') return `apertado · ${janela}`
  if (input.farol === 'VERDE') return `tranquilo · ${janela}`
  // ⭐ tem média, falta a CONFIG — a tela cobra o que falta, nunca nega o que tem
  return `${janela} · falta os dias de chegada pro farol`
}
