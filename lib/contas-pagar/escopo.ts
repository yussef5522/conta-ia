// ⭐⭐⭐ "VENCIDA" TEM UM DONO SÓ (13/09/2026) — os três números do topo brigavam.
//
// **O dono, com o print:** *"VENCIDAS: 34 · R$ 48.502,57 × Análise de inadimplência: 9 ·
// R$ 20.635,54 × lista visível: muito menos."*
//
// **MEDIDO EM PROD, e fecha ao centavo:**
// ```
// KPI VENCIDAS  34 · R$ 48.502,57   ← `dueDate < now`, um TIMESTAMP
// AGING          9 · R$ 20.635,54   ← `bucketFor`, que compara por DIA
// a diferença:  25 · R$ 27.867,03   ← contas que vencem HOJE
// ```
// 9 + 25 = 34 · 20.635,54 + 27.867,03 = 48.502,57. **Duas réguas pra mesma palavra.**
//
// ⚠️⚠️ E HÁ UM SEGUNDO ERRO NO MESMO LUGAR: o servidor roda em UTC. Às 23h12 de São Paulo
// o `new Date()` já diz **14/09**, então a conta que vence amanhã entra como "vencida hoje"
// — e o dono, olhando às 23h, vê 25 contas vermelhas que ele ainda tem o dia inteiro pra
// pagar. É o mesmo fuso que fazia o card do cartão PF mentir 3 horas por dia (09/09).
//
// ⭐ **A RÉGUA, dele:** *"VENCIDA = conta EM ABERTO com vencimento < hoje; paga-sem-vínculo
// NÃO é vencida (é assunto do card PAGAS)."* E "hoje" é o dia do **BRASIL**.

/**
 * ⭐ os estados do mundo real — *"vence em breve"* NÃO é um deles.
 *
 * ⚠️⚠️ **`VENCE_HOJE` entrou em 26/09, e ele NÃO é o "a vencer (3d)" que morreu em 13/09.**
 * Aquele era um **subconjunto** de `A_PAGAR` escolhido a dedo (*"3 dias"* é número, não
 * estado), então a soma dos cards contava a mesma conta **2×**. Este é uma **PARTIÇÃO**: o
 * que vence hoje SAI do `A_PAGAR`, e a soma continua fechando — o guard afirma isso.
 *
 * ⭐ E ele é um estado de verdade porque muda a AÇÃO: vencida já passou, a pagar ainda dá
 * tempo, e *hoje* é o dia em que o dono precisa fazer alguma coisa antes do banco fechar.
 */
import { janelaDoMes } from '@/lib/periodo/mes-corrente'

export type StatusDaConta = 'VENCIDA' | 'VENCE_HOJE' | 'A_PAGAR' | 'PAGA'

/**
 * ⭐⭐ 26/09 — AS DUAS METADES DE `PAGA`, pro dono separar quando quiser.
 *
 * **Decisão dele:** o cartão conta **TODAS** as pagas do mês (*"não importa o meio:
 * conciliada com o banco, paga em dinheiro, marcada na mão"*), e a divisão honesta aparece
 * como **detalhe dentro do cartão**, não como recorte.
 *
 * ⛔ **Elas são PARTIÇÃO de `PAGA`, nunca um 5º card** — a lição do *"a vencer (3d)"*: card
 * que é pedaço de outro faz a Σ contar a mesma conta 2×. Aqui vivem no **dropdown**.
 */
export type RecorteDasPagas = 'PAGA_CONCILIADA' | 'PAGA_SEM_VINCULO'
export type EscopoDaLista = StatusDaConta | RecorteDasPagas

export const ehRecorteDasPagas = (e: EscopoDaLista): e is RecorteDasPagas =>
  e === 'PAGA_CONCILIADA' || e === 'PAGA_SEM_VINCULO'

/**
 * ⭐ QUEM É FLUXO E QUEM É ESTOQUE — a régua da casa, num lugar só.
 *
 * ⚠️ É ela que decide se o período se aplica. Um `boolean` solto em cada tela viraria a
 * segunda régua no dia em que um status novo aparecer.
 */
export const ehFluxo = (s: EscopoDaLista): boolean =>
  s === 'PAGA' || ehRecorteDasPagas(s)

/**
 * ⚠️ meia-noite do dia do BRASIL, em UTC — a fronteira que decide vencida × a pagar.
 * O relógio só EXIBE; quem decide é a data, e a data é a do fuso de quem paga.
 */
export function inicioDoDiaBrasil(now: Date = new Date()): Date {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000) // UTC−3
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()))
}

/**
 * ⭐ a meia-noite do dia SEGUINTE, no fuso do Brasil — o fim do "vence hoje".
 *
 * ⚠️ Derivada do `inicioDoDiaBrasil`, nunca de `now + 24h`: somar horas erra no dia em que
 * o fuso mudar, e a fronteira aqui é de CALENDÁRIO (a mesma lição da régua da data, 25/09).
 */
export function inicioDoDiaSeguinteBrasil(now: Date = new Date()): Date {
  const h = inicioDoDiaBrasil(now)
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + 1))
}

export interface ContaParaStatus {
  status: string
  dueDate: Date | string | null
  paymentDate: Date | string | null
}

/**
 * ⭐⭐ O STATUS DE UMA CONTA — a função que a LISTA, os STATS e o AGING consomem.
 *
 * ⛔ PAGA ganha de tudo: conta com pagamento registrado não é vencida, mesmo que o
 * vencimento tenha passado — não há ação pendente quando o dinheiro já saiu (a mesma
 * régua do card do cartão, 09/09). **Paga-sem-vínculo é assunto do card PAGAS.**
 */
export function statusDaConta(c: ContaParaStatus, now: Date = new Date()): StatusDaConta {
  if (c.paymentDate) return 'PAGA'
  if (c.status !== 'PENDING') return 'PAGA' // RECONCILED/EFFECTED sem paymentDate: já saiu da fila
  if (!c.dueDate) return 'A_PAGAR' // ⚠️ sem prazo não é atraso — não há data pra ter passado
  const d = c.dueDate instanceof Date ? c.dueDate : new Date(c.dueDate)
  if (d < inicioDoDiaBrasil(now)) return 'VENCIDA'
  // ⭐ 26/09 — o que vence HOJE tem estado próprio, e ele PARTICIONA o `A_PAGAR`
  if (d < inicioDoDiaSeguinteBrasil(now)) return 'VENCE_HOJE'
  return 'A_PAGAR'
}

/**
 * ⭐⭐ O MESMO RECORTE, em `where` do Prisma — pros números do topo e pra lista.
 *
 * ⚠️ **Devolve o FRAGMENTO, não o where inteiro**: quem chama combina com o `lifecycleScope`
 * e o multi-tenant do `buildPayableListWhere`. Montar o where completo aqui criaria a
 * segunda porta de multi-tenant, que é onde o vazamento entre empresas nasce.
 */
export function whereDoStatus(
  status: EscopoDaLista,
  now: Date = new Date(),
  /** ⭐ `YYYY-MM` — o recorte de FLUXO. Ignorado de propósito pelos de ESTOQUE. */
  mes?: string | null,
): Record<string, unknown> {
  const hoje = inicioDoDiaBrasil(now)
  /**
   * ⭐⭐ 26/09 — as duas metades: o MESMO recorte de mês, mais o vínculo.
   *
   * ⛔ Derivadas do ramo `PAGA` (por recursão), nunca reescritas: duas definições de
   * *"quando uma conta conta como paga no mês"* divergiriam no primeiro ajuste, e aí a soma
   * das partes deixaria de dar o total — que é justamente o invariante que o dono pediu.
   */
  if (ehRecorteDasPagas(status)) {
    return {
      AND: [
        whereDoStatus('PAGA', now, mes),
        status === 'PAGA_CONCILIADA' ? { reconciledWithId: { not: null } } : { reconciledWithId: null },
      ],
    }
  }
  if (status === 'PAGA') {
    /**
     * ⭐⭐ PAGAS É FLUXO — aconteceu no tempo, e o padrão é o MÊS CORRENTE.
     *
     * O dono: *"pagas em setembro: R$ X. Pagas de junho/julho/agosto só quando eu escolher
     * o período. É o número que muda com o filtro."* ⛔ Sem isto o card somava **R$ 220 mil
     * desde sempre** — um número que não responde pergunta nenhuma do mês.
     */
    /**
     * ⭐⭐ 26/09 — **e ele conta TODAS as pagas do mês, por QUALQUER meio.** ⛔ Antes a tela
     * mostrava só as sem vínculo (o `reconciledWithId: null` do `lifecycleScope`): medido,
     * **40 de 236** em setembro — 8,7% do que o dono pagou. *O cartão respondia "quanto eu
     * paguei sem o banco", que não é a pergunta que ele faz.*
     *
     * ⚠️ Note que este `where` NUNCA filtrou vínculo: quem excluía era o escopo da LISTA.
     * A correção mora lá, sob gesto — aqui é só o recorte de tempo.
     */
    if (!mes) return { paymentDate: { not: null } }
    const { de, ate } = janelaDoMes(mes)
    return { paymentDate: { gte: de, lt: ate } }
  }
  if (status === 'VENCIDA') return { status: 'PENDING', paymentDate: null, dueDate: { lt: hoje } }
  /**
   * ⭐⭐ VENCE HOJE — o dia do BRASIL inteiro, de meia-noite a meia-noite.
   * ⛔ `gte: hoje, lt: amanhã` — e o `A_PAGAR` abaixo começa em `amanhã`, senão as duas
   * consultas se sobreporiam e a conta de hoje seria contada nos dois cards.
   */
  if (status === 'VENCE_HOJE') {
    return { status: 'PENDING', paymentDate: null, dueDate: { gte: hoje, lt: inicioDoDiaSeguinteBrasil(now) } }
  }
  /**
   * ⛔⛔ VENCIDA E A PAGAR SÃO **ESTOQUE**, e o `mes` é IGNORADO aqui de propósito.
   *
   * *"Dívida aberta não expira com a virada do mês — esconder vencida de agosto seria
   * mentir que não devo."* ⚠️ E a decisão mora **nesta função**, não em cada tela: se
   * dependesse de cada chamador lembrar de não passar o mês, a primeira tela nova
   * esconderia dívida em silêncio. **Aqui é impossível.**
   */
  /**
   * ⚠️ A PAGAR inclui a SEM VENCIMENTO — ela deve e ninguém combinou a data; somê-la faria
   * a soma dos estados não fechar com o total, que é o defeito que isto conserta.
   *
   * ⭐ 26/09 — e ele começa em **AMANHÃ**: o que vence hoje tem card próprio. *Sem isto a
   * conta de hoje apareceria nos dois, e a Σ dos cards passaria do total em aberto* — a
   * dupla contagem que matou o "a vencer (3d)" em 13/09.
   */
  return {
    status: 'PENDING', paymentDate: null,
    OR: [{ dueDate: { gte: inicioDoDiaSeguinteBrasil(now) } }, { dueDate: null }],
  }
}

/** ⭐ quantos dias faltam (ou passaram) — é INFORMAÇÃO DA DATA, nunca um status */
export function diasAteVencer(dueDate: Date | string | null, now: Date = new Date()): number | null {
  if (!dueDate) return null
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return null
  return Math.round((d.getTime() - inicioDoDiaBrasil(now).getTime()) / 86_400_000)
}

/**
 * ⭐ o texto pequeno que vai COLADO na data (*"14/09 · em 2d"*) — decisão do dono:
 * *"'Vence em 2 dias' é informação da COLUNA de vencimento, nunca um status próprio."*
 */
export function textoDoPrazo(dueDate: Date | string | null, now: Date = new Date()): string | null {
  const d = diasAteVencer(dueDate, now)
  if (d === null) return 'sem data'
  if (d < 0) return d === -1 ? 'há 1 dia' : `há ${-d} dias`
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  return `em ${d}d`
}
