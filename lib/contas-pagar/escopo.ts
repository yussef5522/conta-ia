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

/** ⭐ os três estados do mundo real — "vence em breve" NÃO é um deles */
import { janelaDoMes } from '@/lib/periodo/mes-corrente'

export type StatusDaConta = 'VENCIDA' | 'A_PAGAR' | 'PAGA'

/**
 * ⭐ QUEM É FLUXO E QUEM É ESTOQUE — a régua da casa, num lugar só.
 *
 * ⚠️ É ela que decide se o período se aplica. Um `boolean` solto em cada tela viraria a
 * segunda régua no dia em que um status novo aparecer.
 */
export const ehFluxo = (s: StatusDaConta): boolean => s === 'PAGA'

/**
 * ⚠️ meia-noite do dia do BRASIL, em UTC — a fronteira que decide vencida × a pagar.
 * O relógio só EXIBE; quem decide é a data, e a data é a do fuso de quem paga.
 */
export function inicioDoDiaBrasil(now: Date = new Date()): Date {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000) // UTC−3
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()))
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
  return d < inicioDoDiaBrasil(now) ? 'VENCIDA' : 'A_PAGAR'
}

/**
 * ⭐⭐ O MESMO RECORTE, em `where` do Prisma — pros números do topo e pra lista.
 *
 * ⚠️ **Devolve o FRAGMENTO, não o where inteiro**: quem chama combina com o `lifecycleScope`
 * e o multi-tenant do `buildPayableListWhere`. Montar o where completo aqui criaria a
 * segunda porta de multi-tenant, que é onde o vazamento entre empresas nasce.
 */
export function whereDoStatus(
  status: StatusDaConta,
  now: Date = new Date(),
  /** ⭐ `YYYY-MM` — o recorte de FLUXO. Ignorado de propósito pelos dois de ESTOQUE. */
  mes?: string | null,
): Record<string, unknown> {
  const hoje = inicioDoDiaBrasil(now)
  if (status === 'PAGA') {
    /**
     * ⭐⭐ PAGAS É FLUXO — aconteceu no tempo, e o padrão é o MÊS CORRENTE.
     *
     * O dono: *"pagas em setembro: R$ X. Pagas de junho/julho/agosto só quando eu escolher
     * o período. É o número que muda com o filtro."* ⛔ Sem isto o card somava **R$ 220 mil
     * desde sempre** — um número que não responde pergunta nenhuma do mês.
     */
    if (!mes) return { paymentDate: { not: null } }
    const { de, ate } = janelaDoMes(mes)
    return { paymentDate: { gte: de, lt: ate } }
  }
  if (status === 'VENCIDA') return { status: 'PENDING', paymentDate: null, dueDate: { lt: hoje } }
  /**
   * ⛔⛔ VENCIDA E A PAGAR SÃO **ESTOQUE**, e o `mes` é IGNORADO aqui de propósito.
   *
   * *"Dívida aberta não expira com a virada do mês — esconder vencida de agosto seria
   * mentir que não devo."* ⚠️ E a decisão mora **nesta função**, não em cada tela: se
   * dependesse de cada chamador lembrar de não passar o mês, a primeira tela nova
   * esconderia dívida em silêncio. **Aqui é impossível.**
   */
  // ⚠️ A PAGAR inclui a SEM VENCIMENTO — ela deve e ninguém combinou a data; some-la
  // faria a soma dos três não fechar com o total, que é o defeito que isto conserta.
  return { status: 'PENDING', paymentDate: null, OR: [{ dueDate: { gte: hoje } }, { dueDate: null }] }
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
