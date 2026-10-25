/**
 * ⭐⭐⭐ O RÓTULO DOS CARTÕES DO TEMPO — nome + data, DERIVADA do intervalo (23/10).
 *
 * **O pedido do dono (1.2, item 2):** *"morrem PRÓXIMOS 7 DIAS e RESTO DO MÊS (janelas
 * deslizantes que o dono não entende). Volta o card único A VENCER com as datas do período
 * no rótulo (A VENCER · 24 A 31/10). A fileira fica: VENCIDAS · VENCE HOJE · A VENCER ·
 * PAGAS."*
 *
 * ⛔⛔ **ESTE ARQUIVO NÃO TEM RÉGUA DE RECORTE — só de TEXTO.** Quem diz *"esta conta está
 * vencida"* é o `whereDoStatus`/`statusDaConta` desde 26/09, e os três estados de aberto são
 * **PARTIÇÃO PERFEITA** (`]-∞,hoje[ · [hoje,amanhã[ · [amanhã,+∞[` mais a sem-vencimento).
 * Escrever *"vencida"* uma segunda vez aqui é **exatamente o defeito de 13/09**, em que o
 * card dizia 34 e a tabela pintava 9 — duas réguas pra mesma palavra, nenhuma sabendo da
 * outra.
 *
 * ⭐⭐ **A DATA DO «A VENCER» É A INTERSEÇÃO COM A JANELA DO FILTRO**, e é isso que faz o
 * rótulo do dono existir: o estado começa em AMANHÃ e o filtro dele termina em 31/10 → *"24 a
 * 31/10"*. Sem a interseção o rótulo diria *"a partir de 24/10"* numa lista que para no dia
 * 31, e o dono leria uma promessa que a tabela não cumpre.
 *
 * ⛔⛔ **E A JANELA SÓ CONTA QUANDO O FILTRO É DE VENCIMENTO.** Com `dataField=paymentDate` o
 * período do dono **não restringe `dueDate` nenhum** — dizer *"24 a 31/10"* ali seria inventar
 * um recorte que o `where` não aplicou. Quem chama passa `janela` só nesse caso.
 *
 * ⚠️ **VENCIDAS e VENCE HOJE ficam INTOCADOS** (ordem do dono: *"os 3 que ele entende"*).
 * Recortar o rótulo deles pela janela também seria defensável — e seria **invenção minha**,
 * num texto que ele já lê sem dúvida.
 */
import { inicioDoDiaBrasil, inicioDoDiaSeguinteBrasil } from './escopo'

/**
 * ⭐ Os três estados de ABERTO — o MESMO vocabulário do `EscopoDaLista`, sem apelido novo.
 *
 * ⚠️ Em 21/10 existia um 2º vocabulário (`FaixaDoTempo`, com 6 valores) pra dizer a mesma
 * coisa. Ele morreu em 23/10: `VENCIDAS|VENCE_HOJE` eram **cópia** de `whereDoStatus`, e as
 * três faixas de data só subdividiam o `A_PAGAR` — subdivisão que o dono aposentou.
 */
export type EscopoEmAberto = 'VENCIDA' | 'VENCE_HOJE' | 'A_PAGAR'

/** ⭐ a ORDEM é a do TEMPO — e é ela que a fileira de cartões e as seções da tabela seguem */
export const ESCOPOS_EM_ABERTO: readonly EscopoEmAberto[] = [
  'VENCIDA',
  'VENCE_HOJE',
  'A_PAGAR',
] as const

export const ehEscopoEmAberto = (s: string): s is EscopoEmAberto =>
  (ESCOPOS_EM_ABERTO as readonly string[]).includes(s)

/**
 * A janela de VENCIMENTO que o filtro do dono aplicou, em dias de CALENDÁRIO (00:00Z).
 *
 * ⚠️ `ate` é **INCLUSIVO** (é o último dia que a lista mostra), ao contrário do `lte` do
 * `where`, que carrega `23:59:59.999`. Converter aqui mantém a formatação de data limpa.
 */
export interface JanelaDeVencimento {
  de: Date | null
  ate: Date | null
}

const diaUtc = (d: Date, somaDias: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + somaDias))

/** ⚠️ `dueDate` é data de CALENDÁRIO (00:00Z) — formatar em UTC, senão o dia desliza. */
const dd = (d: Date) => String(d.getUTCDate()).padStart(2, '0')
const mm = (d: Date) => String(d.getUTCMonth() + 1).padStart(2, '0')
const ddmm = (d: Date) => `${dd(d)}/${mm(d)}`

const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const diaDaSemana = (d: Date) => DIAS_DA_SEMANA[d.getUTCDay()]

/**
 * ⭐ `YYYY-MM-DD` → dia de calendário (00:00Z). `undefined` quando não há filtro.
 *
 * ⚠️ Montado do TEXTO, nunca de `new Date(iso)` com hora: a 1ª versão do módulo de vendas
 * fez isso e o dia rolava pra trás em fuso negativo (cicatriz de 14/09).
 */
export function diaDoFiltro(iso: string | undefined): Date | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  if (!a || !m || !d) return null
  return new Date(Date.UTC(a, m - 1, d))
}

/** o nome, sem a data — o que fica em destaque no cartão */
export function nomeDoEscopo(e: EscopoEmAberto): string {
  switch (e) {
    case 'VENCIDA': return 'VENCIDAS'
    case 'VENCE_HOJE': return 'VENCE HOJE'
    case 'A_PAGAR': return 'A VENCER'
  }
}

/**
 * ⭐⭐ A DATA DO RÓTULO — **derivada**, nunca escrita à mão.
 *
 * `null` quando não há data a dizer: janela inteiramente no passado (o estado não tem um
 * único dia dentro do filtro). ⛔ **Dizer uma data ali seria afirmar um intervalo que não
 * existe** — e a tela mostra o nome sozinho, que é o honesto.
 */
export function dataDoEscopo(
  e: EscopoEmAberto,
  now: Date = new Date(),
  janela?: JanelaDeVencimento,
): string | null {
  const hoje = inicioDoDiaBrasil(now)
  const amanha = inicioDoDiaSeguinteBrasil(now)

  // ⚠️ `ate` é exclusivo no estado VENCIDA (começa em hoje) → o último dia vencido é ONTEM
  if (e === 'VENCIDA') return `até ${ddmm(diaUtc(hoje, -1))}`
  if (e === 'VENCE_HOJE') return `${diaDaSemana(hoje)} · ${ddmm(hoje)}`

  // ⭐ A VENCER: começa em AMANHÃ e termina onde o filtro do dono terminar
  const de = janela?.de && janela.de > amanha ? janela.de : amanha
  const ate = janela?.ate ?? null
  if (!ate) return `a partir de ${ddmm(de)}`
  if (ate < de) return null
  return mm(de) === mm(ate)
    ? `${dd(de)} a ${ddmm(ate)}`
    : `${ddmm(de)} a ${ddmm(ate)}`
}

/**
 * ⭐⭐ O rótulo cheio — o que o CARTÃO e a LINHA-CABEÇALHO da tabela mostram.
 *
 * ⚠️ Montado AQUI e não na tela: os dois falam do mesmo recorte, e dois textos pro mesmo
 * estado divergiriam no primeiro ajuste (*"nenhum rótulo promete mais do que entrega"*,
 * 13/09).
 *
 * ⛔⛔ **E QUEM O MONTA É O SERVIDOR** (`route.ts`, no mesmo instante do agregado). Um
 * cliente com a hora torta escreveria a data de uma janela sobre o número de outra — a
 * cicatriz do cronômetro do tablet (08/09) e do mês default do PF (30/09). **Um relógio só
 * manda.**
 */
export function rotuloDoEscopo(
  e: EscopoEmAberto,
  now: Date = new Date(),
  janela?: JanelaDeVencimento,
): string {
  const nome = nomeDoEscopo(e)
  const data = dataDoEscopo(e, now, janela)
  return data ? `${nome} · ${data}` : nome
}

/**
 * ⭐ O que o servidor mede por estado de aberto — o que o cartão desenha.
 *
 * ⛔ O `rotulo` vem **medido junto do número**, nunca derivado na tela (ver acima).
 */
export interface MedidaDoTempo {
  contagem: number
  total: number
  rotulo: string
}
