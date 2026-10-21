/**
 * ⭐⭐⭐ AS FAIXAS DO TEMPO DO CONTAS A PAGAR — e elas são um **REFINAMENTO do `A_PAGAR`**,
 * nunca uma régua nova (21/10).
 *
 * **O pedido do dono:** *"FAIXAS DO TEMPO no topo, clicáveis como filtro, SEMPRE com data no
 * rótulo (lei: rótulo adulto = nome + data): VENCIDAS (até ontem) · VENCE HOJE · PRÓXIMOS 7
 * DIAS (datas) · RESTO DO MÊS (datas) — e, se existir conta além do mês, a seção «DEPOIS DE
 * <fim do mês>» segue o mesmo padrão."*
 *
 * ⛔⛔ **A DECISÃO QUE SEGURA TUDO: os dois primeiros degraus DERIVAM de `statusDaConta`, por
 * RECURSÃO — eles NÃO são recalculados aqui.** `whereDoStatus` já particiona
 * `]-∞, hoje[ · [hoje, amanhã[ · [amanhã, +∞[` desde 26/09, e as faixas só **subdividem o
 * terceiro pedaço**. ⚠️ Escrever "vencida" de novo aqui seria a **SEGUNDA definição da mesma
 * palavra** — exatamente o que fez o card dizer `34 · 48.502,57` e a tabela pintar
 * `9 · 20.635,54` em 13/09, porque um comparava por TIMESTAMP e o outro por DIA. Com a
 * recursão, **a faixa e o cartão não têm COMO divergir**.
 *
 * ⭐ E é por isso que `faixaDaConta` pergunta o STATUS primeiro: ele é quem sabe que conta
 * paga não tem faixa, e que conta `RECONCILED` sem `paymentDate` já saiu da fila.
 *
 * ⚠️⚠️ **`SEM_VENCIMENTO` existe porque o `A_PAGAR` a carrega** (a régua de 14/09: *"somê-la
 * faria a soma dos estados não fechar com o total"*). Conta sem data não cabe em faixa de
 * data — então ela tem faixa própria, e **o invariante Σ(faixas) == total em aberto fecha por
 * CONSTRUÇÃO**. ⛔ A lei do rótulo-com-data não se aplica a ela, e inventar uma data pra
 * caber seria mentir sobre um combinado que ninguém fez.
 *
 * ⭐⭐ **A FRONTEIRA DOS 7 DIAS TRANSBORDA O MÊS, e as faixas continuam DISJUNTAS.** No dia
 * 28/10 os "próximos 7 dias" vão até 04/11: aí o RESTO DO MÊS fica **vazio** e o DEPOIS
 * começa em 05/11, não em 01/11. Por isso cada faixa declara o seu **intervalo
 * `[de, ate)`** e o RÓTULO é DERIVADO dele — rótulo escrito à mão diria *"DEPOIS DE 31/10"*
 * sobre uma faixa que começa em 05/11.
 */
import {
  statusDaConta,
  whereDoStatus,
  inicioDoDiaBrasil,
  inicioDoDiaSeguinteBrasil,
  type ContaParaStatus,
} from './escopo'
import { janelaDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'

export type FaixaDoTempo =
  | 'VENCIDAS'
  | 'VENCE_HOJE'
  | 'SETE_DIAS'
  | 'RESTO_DO_MES'
  | 'DEPOIS_DO_MES'
  | 'SEM_VENCIMENTO'

/**
 * ⭐ A ORDEM É A DO TEMPO, e é ela que a tela e as seções da tabela seguem.
 *
 * ⚠️ `SEM_VENCIMENTO` vai por ÚLTIMO de propósito: ela não tem lugar na linha do tempo, e
 * pôr no meio faria o dono ler as faixas fora de ordem de data.
 */
export const FAIXAS: readonly FaixaDoTempo[] = [
  'VENCIDAS',
  'VENCE_HOJE',
  'SETE_DIAS',
  'RESTO_DO_MES',
  'DEPOIS_DO_MES',
  'SEM_VENCIMENTO',
] as const

export const ehFaixaDoTempo = (s: string): s is FaixaDoTempo =>
  (FAIXAS as readonly string[]).includes(s)

/**
 * ⭐ As TRÊS que aparecem mesmo em ZERO — e isso é informação, não ruído.
 *
 * *"Nada vencido"* é a notícia que o dono quer ler; esconder a faixa quando ela zera o
 * obrigaria a procurar a ausência. As outras três só aparecem quando existem (a régua do
 * *"móvel zerado treina o dono a não olhar"*).
 */
export const FAIXAS_SEMPRE_VISIVEIS: readonly FaixaDoTempo[] = [
  'VENCIDAS',
  'VENCE_HOJE',
  'SETE_DIAS',
] as const

const diaUtc = (d: Date, somaDias: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + somaDias))

/** ⚠️ `dueDate` é data de CALENDÁRIO (00:00Z) — formatar em UTC, senão o dia desliza. */
const dd = (d: Date) => String(d.getUTCDate()).padStart(2, '0')
const mm = (d: Date) => String(d.getUTCMonth() + 1).padStart(2, '0')
const ddmm = (d: Date) => `${dd(d)}/${mm(d)}`

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const diaDaSemana = (d: Date) => DIAS_DA_SEMANA[d.getUTCDay()]

/**
 * ⭐ O intervalo `[de, ate)` de cada faixa. `null` em `de`/`ate` = aberto; `null` no retorno
 * = a faixa não é de data (a sem-vencimento).
 *
 * ⛔ **As fronteiras são de CALENDÁRIO, derivadas do dia do BRASIL** (`inicioDoDiaBrasil`),
 * nunca de `now + N horas`: somar horas erra no dia em que o fuso mudar, e a pergunta aqui é
 * *"que DIA vence"* (a lição da régua da data, 25/09).
 */
export interface IntervaloDaFaixa {
  de: Date | null
  ate: Date | null
}

export function intervaloDaFaixa(
  faixa: FaixaDoTempo,
  now: Date = new Date(),
): IntervaloDaFaixa | null {
  if (faixa === 'SEM_VENCIMENTO') return null

  const hoje = inicioDoDiaBrasil(now)
  const amanha = inicioDoDiaSeguinteBrasil(now)
  /** ⭐ exclusivo: `[amanhã, hoje+8)` são os dias `hoje+1 .. hoje+7` — SETE dias */
  const fimDosSete = diaUtc(hoje, 8)
  /** `ate` do mês corrente já é o 1º do mês seguinte (exclusivo) — o dono da janela é o `janelaDoMes` */
  const primeiroDoProximoMes = janelaDoMes(mesCorrente(now)).ate
  /**
   * ⚠️ `max` porque os 7 dias podem ULTRAPASSAR o fim do mês (dia 28 em diante). Sem isso,
   * `RESTO_DO_MES` e `DEPOIS_DO_MES` se sobreporiam com `SETE_DIAS` e a mesma conta contaria
   * em duas faixas — a dupla contagem que matou o *"a vencer (3d)"* em 13/09.
   */
  const inicioDoDepois =
    fimDosSete > primeiroDoProximoMes ? fimDosSete : primeiroDoProximoMes

  switch (faixa) {
    case 'VENCIDAS':
      return { de: null, ate: hoje }
    case 'VENCE_HOJE':
      return { de: hoje, ate: amanha }
    case 'SETE_DIAS':
      return { de: amanha, ate: fimDosSete }
    case 'RESTO_DO_MES':
      return { de: fimDosSete, ate: inicioDoDepois }
    case 'DEPOIS_DO_MES':
      return { de: inicioDoDepois, ate: null }
  }
}

/** ⭐ `true` quando o intervalo da faixa não tem um único dia — ela não pode ter conta. */
export function faixaTemIntervaloVazio(faixa: FaixaDoTempo, now: Date = new Date()): boolean {
  const i = intervaloDaFaixa(faixa, now)
  if (!i || !i.de || !i.ate) return false
  return i.de >= i.ate
}

/**
 * ⭐⭐ A FAIXA DE UMA CONTA — e os dois primeiros degraus são do `statusDaConta`.
 *
 * Devolve `null` pra conta PAGA: faixa é recorte do que está **em ABERTO**, e dar faixa a uma
 * paga a faria aparecer nos subtotais do que o dono ainda deve.
 */
export function faixaDaConta(
  c: ContaParaStatus,
  now: Date = new Date(),
): FaixaDoTempo | null {
  const s = statusDaConta(c, now)
  if (s === 'PAGA') return null
  // ⭐ RECURSÃO: quem diz "vencida" e "vence hoje" é o dono do status, não esta função
  if (s === 'VENCIDA') return 'VENCIDAS'
  if (s === 'VENCE_HOJE') return 'VENCE_HOJE'

  // ⚠️ só sobra `A_PAGAR` — e é ele que esta função SUBDIVIDE
  if (!c.dueDate) return 'SEM_VENCIMENTO'
  const d = c.dueDate instanceof Date ? c.dueDate : new Date(c.dueDate)

  for (const faixa of ['SETE_DIAS', 'RESTO_DO_MES', 'DEPOIS_DO_MES'] as const) {
    const i = intervaloDaFaixa(faixa, now)!
    if (i.de && d < i.de) continue
    if (i.ate && d >= i.ate) continue
    return faixa
  }
  /**
   * ⚠️ Inalcançável por construção (os três intervalos cobrem `[amanhã, +∞)`), e o fallback
   * é o SEGURO: cair no último degrau é melhor que devolver `null` e a conta **sumir** da Σ
   * das faixas — sumiço é a classe que este módulo mais paga.
   */
  return 'DEPOIS_DO_MES'
}

/**
 * ⭐⭐ O MESMO RECORTE EM `where` DO PRISMA — e ele também DERIVA por recursão.
 *
 * ⚠️ **Devolve o FRAGMENTO**, como o `whereDoStatus`: quem chama combina com o
 * `lifecycleScope` e o multi-tenant do `buildPayableListWhere`. Montar o where completo aqui
 * criaria a segunda porta de multi-tenant, que é onde o vazamento entre empresas nasce.
 *
 * ⛔ As três faixas de data são `AND [ whereDoStatus('A_PAGAR'), { dueDate: {...} } ]` —
 * **nunca um `status: 'PENDING'` reescrito à mão**. Assim, se a base do `A_PAGAR` mudar, as
 * faixas acompanham de graça. ⭐ E o `dueDate: { gte }` mata o ramo `dueDate: null` do `OR`
 * do A_PAGAR por construção, então as faixas de data e a sem-vencimento ficam disjuntas.
 */
export function whereDaFaixa(
  faixa: FaixaDoTempo,
  now: Date = new Date(),
): Record<string, unknown> {
  if (faixa === 'VENCIDAS') return whereDoStatus('VENCIDA', now)
  if (faixa === 'VENCE_HOJE') return whereDoStatus('VENCE_HOJE', now)
  if (faixa === 'SEM_VENCIMENTO') {
    return { AND: [whereDoStatus('A_PAGAR', now), { dueDate: null }] }
  }
  const i = intervaloDaFaixa(faixa, now)!
  const dueDate: Record<string, Date> = {}
  if (i.de) dueDate.gte = i.de
  if (i.ate) dueDate.lt = i.ate
  return { AND: [whereDoStatus('A_PAGAR', now), { dueDate }] }
}

/** o nome, sem a data — o que fica em destaque no chip */
export function nomeDaFaixa(faixa: FaixaDoTempo): string {
  switch (faixa) {
    case 'VENCIDAS': return 'VENCIDAS'
    case 'VENCE_HOJE': return 'VENCE HOJE'
    case 'SETE_DIAS': return 'PRÓXIMOS 7 DIAS'
    case 'RESTO_DO_MES': return 'RESTO DO MÊS'
    case 'DEPOIS_DO_MES': return 'DEPOIS DE'
    case 'SEM_VENCIMENTO': return 'SEM VENCIMENTO'
  }
}

/**
 * ⭐⭐ A DATA DO RÓTULO — **derivada do intervalo**, nunca escrita à mão.
 *
 * É a lei do dono (*"rótulo adulto = nome + data"*), e derivar é o que a mantém verdadeira na
 * borda do mês: no dia 28 o DEPOIS começa em 05/11, e um rótulo cravado diria *"depois de
 * 31/10"* sobre dias que a faixa dos 7 já levou.
 *
 * ⚠️ `null` na sem-vencimento: ela não tem data, e **dizer que tem seria inventar o
 * combinado**. A tela mostra o nome sozinho ali, e isso é o honesto.
 */
export function dataDaFaixa(faixa: FaixaDoTempo, now: Date = new Date()): string | null {
  const i = intervaloDaFaixa(faixa, now)
  if (!i) return null

  if (faixa === 'VENCIDAS') {
    // ⚠️ `ate` é exclusivo (hoje) → o último dia vencido é ONTEM
    return `até ${ddmm(diaUtc(i.ate!, -1))}`
  }
  if (faixa === 'VENCE_HOJE') {
    return `${diaDaSemana(i.de!)} · ${ddmm(i.de!)}`
  }
  if (faixa === 'DEPOIS_DO_MES') {
    return ddmm(diaUtc(i.de!, -1))
  }
  // SETE_DIAS e RESTO_DO_MES: intervalo fechado nos dois lados
  const primeiro = i.de!
  const ultimo = diaUtc(i.ate!, -1)
  if (ultimo < primeiro) return null // intervalo vazio (borda do mês) — não há range a dizer
  // ⭐ "22 a 28/10" quando o mês é o mesmo; "29/10 a 04/11" quando vira
  return mm(primeiro) === mm(ultimo)
    ? `${dd(primeiro)} a ${ddmm(ultimo)}`
    : `${ddmm(primeiro)} a ${ddmm(ultimo)}`
}

/**
 * ⭐ O rótulo cheio — o que a LINHA-CABEÇALHO da tabela mostra.
 *
 * ⚠️ Montado AQUI e não na tela: o cabeçalho de seção e o chip do topo falam da mesma faixa,
 * e dois textos pro mesmo recorte divergiriam no primeiro ajuste (a lição dos rótulos de
 * 13/09 — *"nenhum rótulo promete mais do que entrega"*).
 */
export function rotuloDaFaixa(faixa: FaixaDoTempo, now: Date = new Date()): string {
  const nome = nomeDaFaixa(faixa)
  const data = dataDaFaixa(faixa, now)
  if (!data) return nome
  // ⭐ "DEPOIS DE 31/10" lê como frase; as outras levam o separador
  return faixa === 'DEPOIS_DO_MES' ? `${nome} ${data}` : `${nome} · ${data}`
}

/**
 * ⭐⭐ O QUE O SERVIDOR MEDE POR FAIXA — o que o chip do topo desenha.
 *
 * ⛔ O `rotulo` vem **medido junto do número**, nunca derivado na tela: o agregado é contado
 * com o relógio do SERVIDOR, e um cliente com a hora torta mostraria uma data sobre um
 * número de outra janela. **Um relógio só manda** (a cicatriz do cronômetro do tablet,
 * 08/09, e do mês default do PF, 30/09).
 */
export interface FaixaMedida {
  contagem: number
  total: number
  rotulo: string
  /** `true` quando o intervalo não tem dia nenhum (ex.: «resto do mês» no fim do mês) */
  intervaloVazio: boolean
}
