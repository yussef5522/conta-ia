// ⭐⭐⭐ A CARTEIRA DE EMPRÉSTIMOS — as funções da LEI e a leitura em lote (25/11/2026).
// Lei: docs/emprestimos-referencia.html (R54–R65; o último <script> é a especificação executável
// — o guard `emprestimos-bate-com-a-lei` roda os 18 pinos dela CONTRA as funções daqui).
//
// R56 dívida na cara · R57 a montanha · R58 compromisso mês a mês (MESMA fonte da Mesa/Custos
// Fixos: `avaliarParcela`) · R59 custo se prova (apurado manda, agenda ao lado) · R61 mútuo é
// outra natureza · R62 estimativa se declara (`~`) · R64 cheque especial no custo do dinheiro.
//
// ⚠️ DISCIPLINA DE VETO da lei: nenhuma previsão/simulação inventada. Tudo aqui é registro ou
// derivado de registro (a agenda do banco, os pagos, o saldo da conta).

import type { Prisma, PrismaClient } from '@prisma/client'
import { saldoDevedorAtual, capitalDevolvidoNaPaga } from './saldo'
import { prepararContrato, avaliarParcela, type ContratoParaValor } from './valor-da-parcela'
import { cadastroIncompleto, CONTRATO_VISIVEL, type PendenciaDeCadastro } from './ficha'
import { lerChequeEspecial, somaCheque, type ChequeDaConta } from './cheque-especial'
import { janelaDoMes, mesCorrente } from '@/lib/periodo/mes-corrente'
import { fmtRateMonthly } from './format'

type Db = PrismaClient | Prisma.TransactionClient

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// ─────────────────────────── formatação (pino P1) ───────────────────────────
export const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const fmtR = (n: number) => 'R$ ' + fmt(n)
export const fmtK = (n: number) => (n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k'

// ─────────────────────────── credor (R57: cores validadas) ───────────────────────────
export type Credor = 'sicredi' | 'banrisul' | 'caixa' | 'mutuo' | 'outro'
/** ⛔ a ORDEM de empilhamento da montanha é a ordem validada no header da lei */
export const ORDEM_DO_CREDOR: readonly Credor[] = ['sicredi', 'banrisul', 'caixa', 'mutuo', 'outro']
export const COR_DO_CREDOR: Record<Credor, { claro: string; escuro: string }> = {
  sicredi: { claro: '#178A5C', escuro: '#22A06B' },
  banrisul: { claro: '#2E6BE0', escuro: '#4E7DF0' },
  caixa: { claro: '#C2600A', escuro: '#CE6F15' },
  mutuo: { claro: '#C2418B', escuro: '#D45A9E' },
  outro: { claro: '#64748B', escuro: '#94A3B8' },
}
/** o gradiente da ÁREA da montanha (GRADS da lei) */
export const GRADIENTE_DA_SERIE: Record<Credor, [string, string]> = {
  sicredi: ['#23A574', '#0F6A47'],
  banrisul: ['#4C82EC', '#2254BC'],
  caixa: ['#D9812B', '#A04E08'],
  mutuo: ['#D35BA3', '#A3326F'],
  outro: ['#94A3B8', '#64748B'],
}
/** o gradiente do CHIP do credor (`.chip.b-*` da lei) */
export const GRADIENTE_DO_CHIP: Record<Credor, [string, string]> = {
  sicredi: ['#0A3D2C', '#1E8F63'],
  banrisul: ['#0E2A66', '#2E6BE0'],
  caixa: ['#3C4654', '#7A8699'],
  mutuo: ['#5B1540', '#C2418B'],
  outro: ['#171E31', '#232D49'],
}
/**
 * ⭐ a PALETA da lei, POR VALOR (o guard compara com o <style> do HTML aprovado). ⛔ A catraca do hex
 * cravado (`zero-hex-cravado`) proíbe cor literal em tela: a tela pinta por AQUI ou por `--emp-*`.
 */
export const PALETA = {
  branco: '#fff', ponto: '#1F2937', real: '#4F46E5', rox: '#7C3AED', agenda: '#9AA3B5',
  pico: '#D97706', picoClaro: '#F59E0B',
  primario: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
  icoInd: 'linear-gradient(135deg,#6366F1,#4F46E5)', ouro: 'linear-gradient(135deg,#F59E0B,#D97706)',
  icoRox: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', icoVer: 'linear-gradient(135deg,#14B8A6,#0F766E)',
  progresso: 'linear-gradient(90deg,#4F46E5,#7C3AED)', progressoVerde: 'linear-gradient(90deg,#0F9D73,#1E8F63)',
  topoDoPodio: 'linear-gradient(90deg,#FFF6E8,#fff 75%)',
  trilhoCusto: '#F3EAD9', barraCusto: 'linear-gradient(90deg,#F59E0B,#B45309)',
  trilhoCheque: '#FBE7EC', barraCheque: 'linear-gradient(90deg,#E85D8A,#BE123C)',
  indSuave: '#EEF0FF', capTinta: '#3730A3', jurSuave: '#FEF3C7', jurTinta: '#92400E',
  corSuave: '#F4EDFF', corTinta: '#6D28D9', okSuave: '#D6F2EC', okTinta: '#0F766E',
} as const

export const NOME_DO_CREDOR: Record<Credor, string> = {
  sicredi: 'Sicredi', banrisul: 'Banrisul', caixa: 'Caixa', mutuo: 'Mútuo PF', outro: 'Outros',
}

export function credorDe(lender: string | null, scheduleSource: string | null): Credor {
  // ⛔ R61 — mútuo é a NATUREZA do contrato (agenda flexível), não o nome do credor
  if (scheduleSource === 'FLEXIBLE') return 'mutuo'
  const l = (lender ?? '').toLowerCase()
  if (l.includes('sicredi')) return 'sicredi'
  if (l.includes('banrisul')) return 'banrisul'
  if (l.includes('caixa')) return 'caixa'
  return 'outro'
}

// ─────────────────────────── funções-lei (os pinos) ───────────────────────────
interface ComSaldo { banco: string; saldo: number }

/** P2 — dívida total, bancos e mútuo SEPARADOS (R56/R61) */
export function totais(cs: readonly ComSaldo[]) {
  const bancos = r2(cs.filter((c) => c.banco !== 'mutuo').reduce((s, c) => s + c.saldo, 0))
  const mutuo = r2(cs.filter((c) => c.banco === 'mutuo').reduce((s, c) => s + c.saldo, 0))
  return { total: r2(bancos + mutuo), bancos, mutuo }
}

/** P3 — custo do dinheiro = contratos (APURADO) + cheque especial, declarados separados (R59/R64) */
export function custoDoDinheiro(contratos: { real: number; agenda: number }, cheque: ReadonlyArray<{ jurosAno: number }>) {
  const ch = somaCheque(cheque)
  return {
    contratos: r2(contratos.real), cheque: ch, total: r2(contratos.real + ch),
    agenda: r2(contratos.agenda), acima: r2(contratos.real - contratos.agenda),
  }
}

export interface MesDoCompromisso { m: string; v: number; est?: boolean }
/** P4 — o pico */
export function pico<T extends { v: number }>(comp: readonly T[]): T { return comp.reduce((p, x) => (x.v > p.v ? x : p), comp[0]) }
/** P5 — o mês de ficar livre (o último com parcela) */
export function livreEm(comp: readonly { m: string }[]): string { return comp[comp.length - 1].m }
/** P6 */
export function valorDoMes(comp: readonly { m: string; v: number }[], m: string): number { return comp.find((e) => e.m === m)?.v ?? 0 }

/** P7 — quem cobra mais caro: mútuo FORA (declarado, R61); sem custo apurado vai pro fim */
export function rankingDeCusto<T extends { banco: string; ef: number | null }>(cs: readonly T[]): T[] {
  return cs.filter((c) => c.banco !== 'mutuo').slice()
    .sort((a, b) => (b.ef ?? -Infinity) - (a.ef ?? -Infinity))
}
/** P8 */
export function progresso(p: number, t: number) { return { txt: `${p} de ${t}`, pct: t > 0 ? Math.round((p / t) * 100) : 0 } }
/** P9 — R62: estimativa se declara */
export function rotuloEstimado(v: number, est: boolean): string { return (est ? '~ ' : '') + fmtR(v) }
/** P13 — R55/R59: encargo apurado = pago − capital */
export function encargoApurado(pago: number, capital: number): number { return r2(pago - capital) }
/** P12 */
export function somaPedacos(pzs: ReadonlyArray<{ v: number }>): number { return r2(pzs.reduce((s, p) => s + p.v, 0)) }
/** P15 */
export function somaGrupo(cs: readonly ComSaldo[], b: string): number { return r2(cs.filter((c) => c.banco === b).reduce((s, c) => s + c.saldo, 0)) }

// ─────────────────────────── o custo da parcela ───────────────────────────
interface ParcelaComPago {
  status: string
  paidDate: Date | null
  openingBalance: number
  interest: number
  correcao: number
  paidInterest: number | null
  paidCorrection: number | null
  paidPenalty: number | null
}
const encargoDe = (i: ParcelaComPago) => (i.paidInterest ?? 0) + (i.paidCorrection ?? 0) + (i.paidPenalty ?? 0)
const pagaComEncargo = (i: ParcelaComPago) => i.status === 'PAID' && i.paidInterest != null

/** R59 — o custo PAGO do contrato (apurado), desde o início e no ano, com a agenda do mesmo recorte ao lado */
export function custoPagoDoContrato(parcelas: readonly ParcelaComPago[], ano: number) {
  const pagas = parcelas.filter(pagaComEncargo)
  const doAno = pagas.filter((i) => i.paidDate && i.paidDate.getUTCFullYear() === ano)
  return {
    desdeInicio: r2(pagas.reduce((s, i) => s + encargoDe(i), 0)),
    noAno: r2(doAno.reduce((s, i) => s + encargoDe(i), 0)),
    jurosAno: r2(doAno.reduce((s, i) => s + (i.paidInterest ?? 0), 0)),
    correcaoAno: r2(doAno.reduce((s, i) => s + (i.paidCorrection ?? 0), 0)),
    multaAno: r2(doAno.reduce((s, i) => s + (i.paidPenalty ?? 0), 0)),
    agendaAno: r2(doAno.reduce((s, i) => s + i.interest + i.correcao, 0)),
  }
}

/**
 * ⭐ o custo REAL em % a.m. (o pódio): Σ encargo apurado ÷ Σ saldo de abertura das parcelas pagas
 * nos últimos 12 meses. ⛔ Sem parcela apurada → `null` ("a apurar"), nunca 0 (ausência ≠ zero).
 */
export function custoEfetivoMensal(parcelas: readonly ParcelaComPago[], agora: Date): number | null {
  const desde = new Date(agora.getTime() - 365 * 86_400_000)
  const janela = parcelas.filter((i) => pagaComEncargo(i) && i.paidDate && i.paidDate >= desde && i.openingBalance > 0)
  const base = janela.reduce((s, i) => s + i.openingBalance, 0)
  if (base <= 0) return null
  return Math.round((janela.reduce((s, i) => s + encargoDe(i), 0) / base) * 10000) / 100
}

// ─────────────────────────── a leitura em lote ───────────────────────────
export interface ContratoNaCarteira {
  id: string
  banco: Credor
  rot: string
  num: string
  lender: string
  taxa: string
  saldo: number
  pagas: number
  total: number
  prox: { d: string | null; v: number | null; est: boolean; enc: boolean; estado: string } | null
  ef: number | null
  juros26: number
  pendencias: PendenciaDeCadastro[]
  flexible: boolean
  principal: number
  devolvido: number
  href: string
}

export interface CarteiraDeEmprestimos {
  hoje: string
  ano: number
  mes: string
  contratos: ContratoNaCarteira[]
  totais: ReturnType<typeof totais>
  custo: ReturnType<typeof custoDoDinheiro>
  custoPorCredor: Array<{ banco: Credor; rot: string; v: number }>
  cheque: ChequeDaConta[]
  chequeMes: number
  compromisso: MesDoCompromisso[]
  /** o que venceu antes deste mês e não está paga — fora da série, declarado à parte */
  atrasado: { v: number; n: number }
  montanha: { meses: string[]; series: Record<Credor, number[]> }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMesCurto = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`
const diaCurto = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${MESES[d.getUTCMonth()]}`
const proximoMes = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`
}

function rotuloDaTaxa(l: { scheduleSource: string | null; rateType: string | null; indexer: string | null; interestRateMonthly: number }): string {
  if (l.scheduleSource === 'FLEXIBLE') return 'sem juros · nominal'
  // ⭐ a taxa se formata num lugar só (`fmtRateMonthly` — a cura do arredondamento de 06/2026)
  const pct = fmtRateMonthly(l.interestRateMonthly)
  if (l.rateType === 'POS') return `PÓS · ${l.indexer ?? '?'} + ${pct}`
  return `PRÉ · ${pct}`
}

export async function lerCarteiraDeEmprestimos(companyId: string, agora: Date, db: Db): Promise<CarteiraDeEmprestimos> {
  const p = db as PrismaClient
  const mes = mesCorrente(agora)
  const ano = Number(mes.slice(0, 4))
  // ⭐ duas leituras: os contratos com a agenda inteira e o cheque especial (consultas constantes)
  const [loans, cheque] = await Promise.all([
    p.loan.findMany({
      where: { companyId, ...CONTRATO_VISIVEL },
      orderBy: [{ lender: 'asc' }, { contractNumber: 'asc' }],
      select: {
        id: true, lender: true, contractNumber: true, principal: true, interestRateMonthly: true, rateType: true,
        indexer: true, scheduleSource: true, installmentsPaidBefore: true, status: true,
        installments: {
          orderBy: { number: 'asc' },
          select: {
            number: true, dueDate: true, status: true, payment: true, interest: true, correcao: true, amortization: true,
            openingBalance: true, closingBalance: true, paidDate: true, paidTotal: true,
            paidInterest: true, paidCorrection: true, paidPenalty: true, reconciledTransactionId: true,
            reconciledTransaction: { select: { date: true, amount: true } },
            payments: { select: { amount: true, transaction: { select: { date: true } } } },
          },
        },
      },
    }),
    lerChequeEspecial(db, companyId, ano, mes),
  ])

  const contratos: ContratoNaCarteira[] = []
  let real = 0
  let agenda = 0
  const custoCredor = new Map<Credor, number>()
  const porMes = new Map<string, { v: number; est: boolean }>()
  const atrasado = { v: 0, n: 0 }
  const inicioDoMes = janelaDoMes(mes).de
  // a montanha: por contrato, os saldos projetados pela AGENDA (registro do banco)
  const projecoes: Array<{ banco: Credor; saldo: number; flexible: boolean; parcelas: { ym: string; closing: number; amort: number; aberta: boolean }[] }> = []
  let ultimoMes = mes

  for (const l of loans) {
    const banco = credorDe(l.lender, l.scheduleSource)
    const flexible = l.scheduleSource === 'FLEXIBLE'
    const saldo = saldoDevedorAtual(l, l.installments)
    const custo = custoPagoDoContrato(l.installments, ano)
    real += custo.noAno
    agenda += custo.agendaAno
    if (!flexible) custoCredor.set(banco, r2((custoCredor.get(banco) ?? 0) + custo.noAno))

    const valor = l as unknown as ContratoParaValor
    const prep = prepararContrato(valor)
    const parcelasAvaliadas = l.installments.map((i) => {
      const ym = i.dueDate.toISOString().slice(0, 7)
      return { i, ym, a: avaliarParcela(valor, prep, i, janelaDoMes(ym), agora) }
    })
    const naoPagas = parcelasAvaliadas.filter((x) => x.a.veredito.estado !== 'PAGA' && x.i.status !== 'PAID')
    for (const x of naoPagas) {
      // ⛔ R64/R61 — só contrato com agenda entra no compromisso (o rotativo não tem agenda)
      // ⛔ PARCIAL: o compromisso é o que FALTA, nunca o já pago (que é o que `valorDaParcela` dá
      // pro mês da Mesa — lá a pergunta é "quanto saiu"; aqui é "quanto ainda vai sair")
      const parcial = x.a.veredito.estado === 'PARCIAL'
      const est = x.a.v.valorEhPrevisto || x.a.v.valor == null || (parcial && l.rateType === 'POS')
      const v = parcial ? x.a.veredito.falta : (x.a.v.valor ?? x.i.payment)
      if (x.i.dueDate < inicioDoMes) {
        // ⛔ R61 — mútuo nunca "atrasa" (agenda nominal): referência vencida não é dívida vencida
        if (!flexible) { atrasado.v = r2(atrasado.v + v); atrasado.n += 1 }
        continue
      }
      const acc = porMes.get(x.ym) ?? { v: 0, est: false }
      acc.v = r2(acc.v + v)
      acc.est = acc.est || est
      porMes.set(x.ym, acc)
      if (x.ym > ultimoMes) ultimoMes = x.ym
    }
    const prox = flexible ? null : naoPagas.find((x) => x.i.dueDate >= inicioDoMes) ?? naoPagas[0] ?? null
    const devolvido = flexible
      ? r2(l.installments.filter((i) => i.status === 'PAID').reduce((s, i) => s + capitalDevolvidoNaPaga(i), 0))
      : 0
    contratos.push({
      id: l.id,
      banco,
      rot: NOME_DO_CREDOR[banco] === 'Outros' ? (l.lender || 'Outros') : NOME_DO_CREDOR[banco],
      num: l.contractNumber ?? (flexible ? 'mútuo' : 'sem nº'),
      lender: l.lender,
      taxa: rotuloDaTaxa(l),
      saldo,
      pagas: l.installments.filter((i) => i.status === 'PAID').length,
      total: l.installments.length,
      prox: prox
        ? {
            d: diaCurto(prox.i.dueDate),
            // ⭐ a parcial mostra o que FALTA (o card diz "falta"), nunca o nominal da agenda
            v: prox.a.veredito.estado === 'PARCIAL' ? prox.a.veredito.falta : prox.a.v.valor,
            est: prox.a.v.valorEhPrevisto || prox.a.v.valor == null,
            enc: l.rateType === 'POS' && prox.i.interest <= 0,
            estado: prox.a.veredito.estado,
          }
        : null,
      ef: flexible ? null : custoEfetivoMensal(l.installments, agora),
      juros26: custo.noAno,
      pendencias: cadastroIncompleto(l),
      flexible,
      principal: l.principal,
      devolvido,
      href: `/empresas/${companyId}/emprestimos/${l.id}`,
    })
    projecoes.push({
      banco, saldo, flexible,
      parcelas: l.installments.map((i) => ({
        ym: i.dueDate.toISOString().slice(0, 7), closing: i.closingBalance, amort: i.amortization,
        aberta: i.status !== 'PAID',
      })),
    })
  }

  // ── o compromisso: do mês corrente até a última parcela, sem buraco (mês vazio = 0)
  const compromisso: MesDoCompromisso[] = []
  for (let m = mes; m <= ultimoMes; m = proximoMes(m)) {
    const x = porMes.get(m)
    compromisso.push({ m, v: x?.v ?? 0, est: x?.est ?? false })
  }

  // ── a montanha: ponto 0 = hoje; ponto k = fim do k-ésimo mês da série (após as parcelas dele)
  const meses = compromisso.map((c) => c.m)
  const series = Object.fromEntries(ORDEM_DO_CREDOR.map((c) => [c, [] as number[]])) as Record<Credor, number[]>
  const pontos = meses.length + 1
  for (const c of ORDEM_DO_CREDOR) series[c] = new Array(pontos).fill(0)
  for (const pj of projecoes) {
    const ultimaYm = pj.parcelas.length ? pj.parcelas[pj.parcelas.length - 1].ym : mes
    series[pj.banco][0] = r2(series[pj.banco][0] + pj.saldo)
    meses.forEach((m, k) => {
      let s: number
      if (pj.flexible) {
        /**
         * ⚠️ o mútuo não tem prazo: a agenda NOMINAL é a referência, e a soma dela não fecha com o
         * saldo (as devoluções reais foram outras). O saldo desce pelas referências e ZERA no mês
         * da última — "a agenda nominal termina em X" (declarado no ⓘ), nunca uma data inventada.
         */
        const abertas = pj.parcelas.filter((x) => x.aberta)
        const ultimaRef = abertas.length ? abertas[abertas.length - 1].ym : mes
        const aDevolver = abertas.filter((x) => x.ym <= m).reduce((t, x) => t + x.amort, 0)
        s = m >= ultimaRef ? 0 : Math.max(0, pj.saldo - aDevolver)
      } else if (m >= ultimaYm) {
        s = 0
      } else {
        const ate = pj.parcelas.filter((x) => x.ym <= m && x.aberta)
        s = ate.length ? Math.max(0, Math.min(pj.saldo, ate[ate.length - 1].closing)) : pj.saldo
      }
      series[pj.banco][k + 1] = r2(series[pj.banco][k + 1] + s)
    })
  }

  return {
    hoje: agora.toISOString().slice(0, 10),
    ano,
    mes,
    contratos,
    totais: totais(contratos),
    custo: custoDoDinheiro({ real: r2(real), agenda: r2(agenda) }, cheque),
    custoPorCredor: ORDEM_DO_CREDOR.filter((b) => custoCredor.has(b)).map((b) => ({ banco: b, rot: NOME_DO_CREDOR[b], v: custoCredor.get(b)! })),
    cheque,
    chequeMes: r2(cheque.reduce((s, q) => s + q.jurosMes, 0)),
    compromisso,
    atrasado,
    montanha: { meses, series },
  }
}
