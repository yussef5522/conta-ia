// ⭐⭐⭐ CARTÕES v3 — a especificação executável da lei (24/11/2026).
//
// A LEI: `docs/cartoes-referencia.html` (título "CARTÕES (financeiro) — referência v3 APROVADA"),
// leis R44–R52 no comentário do topo e os 14 PINOS no último <script>. Este módulo é o PORTO desses
// pinos pra lib: puro, sem Prisma, importável do cliente e do servidor (PORTA ÚNICA — a página, a
// fatura, o backfill, o import e o sininho leem DAQUI, nunca uma cópia).

export type EstadoCiclo = 'aberta' | 'fechada' | 'parcial' | 'paga'

export const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')

/** R45 — UMA régua do disponível, em toda tela */
export function disponivel(limite: number, aberta: number, fechadasNaoPagas: number): number {
  return limite - aberta - fechadasNaoPagas
}

/** R46 — o estado do ciclo é um só */
export function estadoCiclo(f: { total: number; pago: number; fechada: boolean }): EstadoCiclo {
  if (f.pago >= f.total && f.total > 0) return 'paga'
  if (f.pago > 0) return 'parcial'
  if (f.fechada) return 'fechada'
  return 'aberta'
}

/** R44 — vencimento relativo */
export function venceEm(dias: number): string {
  if (dias < 0) return 'venceu há ' + (-dias) + (dias === -1 ? ' dia' : ' dias')
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  return 'vence em ' + dias + ' dias'
}

/** R47 — parcelas que faltam a partir de "NN/MM" */
export function faltamParcelas(sel: string): number {
  const [n, m] = sel.split('/').map(Number)
  return m - n
}
export function somaFuturo(compras: { sel: string; vmes: number }[]): number {
  return Math.round(compras.reduce((s, c) => s + faltamParcelas(c.sel) * c.vmes, 0) * 100) / 100
}
export function porMes(compras: { sel: string; vmes: number }[], meses: unknown[]): number[] {
  return meses.map((_, k) =>
    Math.round(compras.reduce((s, c) => s + (faltamParcelas(c.sel) > k ? c.vmes : 0), 0)))
}

/** R48 — uma porta: casar grava fatura + lançamento juntos */
export function casar(fatura: { id: string; total: number }, lanc: { id: string; valor: number }) {
  return { faturaId: fatura.id, lancId: lanc.id, pago: Math.min(-lanc.valor, fatura.total) }
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// O que a lei pressupõe e a casa precisa decidir UMA vez (datas, centavo, grupo da parcela).
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ O MARCO DA CAÇULA (agosto/2026, CLAUDE.md): meses anteriores foram DADOS POR ENCERRADOS pelo
 * dono. Fatura antes do marco aparece com o estado que tem, mas não entra na régua do disponível
 * nem no "a pagar" — cobrar arqueologia é como o sininho morre.
 */
export const INICIO_DO_MODULO = '2026-08'

/** R46 — o pago da fatura: Σ dos pagamentos vinculados, com o centavo do banco absorvido */
export function pagoDaFatura(total: number, pagamentos: number[]): number {
  const s = Math.round(pagamentos.reduce((a, v) => a + Math.abs(v), 0) * 100) / 100
  // ⚠️ pagamento que difere do total por ≤ R$ 0,02 QUITA (a mesma tolerância do casamento por valor)
  if (total > 0 && Math.abs(s - total) <= 0.02) return total
  return Math.min(s, Math.max(total, 0))
}

const pad = (n: number) => String(n).padStart(2, '0')
export const mesSoma = (ym: string, k: number): string => {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + k
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}
export const mesesEntre = (de: string, ate: string): number => {
  const [a, b] = de.split('-').map(Number)
  const [c, d] = ate.split('-').map(Number)
  return (c * 12 + d) - (a * 12 + b)
}

/**
 * ⭐⭐ O VENCIMENTO DA COMPETÊNCIA — derivado do `dueDay`, nunca gravado.
 *
 * ⚠️ **O `invoiceMonth` É o mês do VENCIMENTO** (é assim que o módulo o define desde a Fase
 * 2: *"`invoiceMonth` YYYY-MM do vencimento"*), então o vencimento é o `dueDay` DENTRO dele —
 * não o mês seguinte. Somar um mês aqui erraria a data em toda fatura.
 *
 * ⛔ E a data é montada em **UTC**, como o resto do módulo: `new Date(ano, mes, dia)` usa o
 * fuso do processo, e o servidor roda em UTC — em São Paulo isso puxaria o dia pra trás.
 */
export function vencimentoDaCompetencia(invoiceMonth: string, dueDay: number): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(invoiceMonth)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  // ⚠️ dia 31 num mês de 30 cai no último dia dele, não no 1º do seguinte
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const dia = Math.min(Math.max(1, dueDay), ultimo)
  return new Date(Date.UTC(ano, mes - 1, dia)).toISOString().slice(0, 10)
}

/**
 * ⭐⭐ O FECHAMENTO DA COMPETÊNCIA — o irmão do `vencimentoDaCompetencia`, e ele mora AQUI
 * de propósito: *derivar as datas da fatura VIRTUAL do PJ a partir dos dias do cartão* é UMA
 * pergunta, e ela tem um endereço só. Escrever a conta do fechamento noutro arquivo faria as
 * duas metades da mesma data divergirem no primeiro mês de 30 dias.
 *
 * ⚠️ **O fechamento é ANTES do vencimento, e pode ser no mês ANTERIOR.** `fecha 26 · vence 12`
 * (o banco caixa, medido em prod) significa: fechou em 26 do mês passado e vence em 12 deste.
 * Cravar "mesmo mês" diria que a fatura fecha 14 dias DEPOIS de vencer.
 */
export function fechamentoDaCompetencia(
  invoiceMonth: string,
  closingDay: number,
  dueDay: number,
): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(invoiceMonth)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return null
  // fecha no mesmo mês do vencimento só quando o dia de fechar vem ANTES do de vencer
  const deslocamento = closingDay < dueDay ? 0 : -1
  const alvo = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  const dia = Math.min(Math.max(1, closingDay), ultimo)
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), dia)).toISOString().slice(0, 10)
}

/** R46 — as datas do ciclo de uma competência — pelas DUAS portas acima, nunca uma conta nova */
export function datasDoCiclo(mes: string, closingDay: number, dueDay: number): { fechamento: string; vencimento: string } {
  return { vencimento: vencimentoDaCompetencia(mes, dueDay)!, fechamento: fechamentoDaCompetencia(mes, closingDay, dueDay)! }
}

/** dias corridos de `hoje` (YYYY-MM-DD, dia do Brasil) até `data` */
export function diasAte(hoje: string, data: string): number {
  return Math.round((Date.parse(data + 'T00:00:00Z') - Date.parse(hoje + 'T00:00:00Z')) / 86_400_000)
}

/**
 * ⭐⭐ R47 — O GRUPO DA PARCELA SE LIGA ENTRE FATURAS.
 *
 * ⛔ MEDIDO EM PROD (24/11): o grupo antigo era sha1(cartão|descrição|total|valor) e a descrição
 * TRAZ o "NN/MM" — muda todo mês. 144 pares (mesma compra, mês seguinte, parcela n+1), 100 deles
 * em grupos diferentes; 186 de 205 grupos com UMA linha só.
 * ⛔ E a descrição limpa ainda não basta (2ª medida): o banco anexa cidade, "03 de 10", número de
 * loja, e trunca o nome — 14 dos 144 pares seguiam soltos com a descrição normalizada.
 *
 * ⭐ A CHAVE: cartão + valor da parcela + total + **mês de origem** (competência − (n−1)). O mês de
 * origem fica parado enquanto a compra anda; nos 144 pares medidos ele bateu em TODOS. A descrição
 * só entra como DESEMPATE, quando duas compras do mesmo cartão colidem na chave (mesmo valor,
 * total e origem) — aí cada uma vira `chave|descrição`.
 */
export interface LinhaParcelada { id: string; cardId: string; description: string; amount: number; installmentNumber: number; installmentTotal: number; invoiceMonth: string }

export function descricaoDaCompra(desc: string): string {
  return desc
    .replace(/\s+-\s+.*$/, '')
    .replace(/\(\s*\d+\s*\)/g, '')
    .replace(/\b\d{1,2}\s*(?:\/|de)\s*\d{1,2}\b/gi, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
export function chaveDaParcela(p: Omit<LinhaParcelada, 'id' | 'description'>): string {
  const origem = mesSoma(p.invoiceMonth, -(p.installmentNumber - 1))
  return [p.cardId, Math.abs(p.amount).toFixed(2), p.installmentTotal, origem].join('|')
}

/** agrupa as linhas parceladas — devolve o grupo de cada linha (por id) */
export function agruparParcelas(linhas: LinhaParcelada[]): Map<string, string> {
  const porChave = new Map<string, LinhaParcelada[]>()
  for (const l of linhas) {
    const k = chaveDaParcela(l)
    porChave.set(k, [...(porChave.get(k) ?? []), l])
  }
  const out = new Map<string, string>()
  for (const [k, ls] of porChave) {
    // ⚠️ colisão = a MESMA parcela aparece 2× no mesmo mês: são compras diferentes → desempata
    const vistos = new Set<string>()
    const colide = ls.some((l) => { const s = `${l.installmentNumber}|${l.invoiceMonth}`; if (vistos.has(s)) return true; vistos.add(s); return false })
    for (const l of ls) out.set(l.id, colide ? `${k}|${descricaoDaCompra(l.description)}` : k)
  }
  return out
}

/** R47 — as parcelas que ainda vão cair, a partir da última vista (n/m na competência `mes`) */
export function parcelasQueFaltam(n: number, m: number, mes: string): { numero: number; mes: string }[] {
  const out: { numero: number; mes: string }[] = []
  for (let k = n + 1; k <= m; k++) out.push({ numero: k, mes: mesSoma(mes, k - n) })
  return out
}

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMes = (ym: string) => MESES_CURTOS[Number(ym.slice(5, 7)) - 1]
/** "ago/27" — o "até mês/ano" do painel de parcelas */
export const rotuloMesAno = (ym: string) => `${rotuloMes(ym)}/${ym.slice(2, 4)}`
/** "Nov/2026" */
export const rotuloFatura = (ym: string) => { const r = rotuloMes(ym); return `${r[0].toUpperCase()}${r.slice(1)}/${ym.slice(0, 4)}` }

/** R45 — o chip por banco (gradiente da lei, sem logo) */
export function classeDoBanco(bankName: string | null | undefined): 'sicredi' | 'banrisul' | 'caixa' | 'mp' | 'neutro' {
  const b = (bankName ?? '').toLowerCase()
  if (b.includes('sicredi')) return 'sicredi'
  if (b.includes('banrisul')) return 'banrisul'
  if (b.includes('caixa')) return 'caixa'
  if (b.includes('mercado')) return 'mp'
  return 'neutro'
}
export const GRADIENTE_DO_BANCO: Record<ReturnType<typeof classeDoBanco>, [string, string]> = {
  sicredi: ['#0A3D2C', '#1E8F63'],
  banrisul: ['#102A66', '#2B5CD9'],
  caixa: ['#123B74', '#1F7ACC'],
  mp: ['#0B4E8E', '#3BB3F4'],
  neutro: ['#171E31', '#232D49'],
}

/**
 * ⭐⭐⭐ R53 — CARTÃO ENCERRADO EM QUITAÇÃO (emenda 24/11/2026). O cartão foi cancelado no banco e
 * não tem mais fatura do banco, mas as parcelas continuam caindo. O sistema faz o que o banco faz:
 * a FATURA DE QUITAÇÃO do mês, a partir das parcelas previstas gravadas — nasce fechada.
 * ⛔ Fatura real do banco no mesmo mês MANDA: a quitação não nasce. Só do mês corrente em diante.
 * Puro: o semeador (on-read + cron) e o guard decidem por AQUI.
 */
export function quitacaoASemear(p: {
  encerradoEm: string | null // YYYY-MM-DD
  hoje: string
  mesesComFatura: Set<string>
  previstasDoMes: (mes: string) => number
}): { mes: string; total: number } | null {
  if (!p.encerradoEm) return null
  const mes = p.hoje.slice(0, 7)
  if (mes < p.encerradoEm.slice(0, 7)) return null
  if (p.mesesComFatura.has(mes)) return null
  const total = Math.round(p.previstasDoMes(mes) * 100) / 100
  return total > 0 ? { mes, total } : null
}
