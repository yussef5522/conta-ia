// ⭐⭐⭐ O DASHBOARD DA PF (13/09/2026) — régua: `docs/mocks/pf-dashboard-mock.html`.
//
// **O dono:** *"o mock é a RÉGUA — igual primeiro, melhoria só com meu pedido"*, e
// *"fonte única dos totais — o painel /mes atual vira esse ou morre, NUNCA dois painéis"*.
//
// ⭐ Por isso este arquivo **não recalcula ENTROU/SAIU/SOBROU**: ele chama `painelDoMes`,
// que já é o dono dessa conta (e que já sabe tirar o pagamento de fatura do SAIU). O que
// nasce aqui são só os widgets que o painel não respondia — previsto, donut, limite,
// balanço, a vencer.
//
// ⛔⛔ **ZERO WIDGET SEM DADO** (régua do dono): investimento, metas e recorrentes **não
// aparecem nem cinza**. Widget vazio treina o dono a não olhar a tela — foi o que o card de
// dupla contagem da Conciliação ensinou em 10/09.

import { painelDoMes, type LinhaDoMes, type PainelDoMes } from '@/lib/pf-extrato/painel-do-mes'

const r2 = (n: number) => Math.round(n * 100) / 100

/** ⭐ as cores do donut, na ordem do mock — 4 fatias nomeadas + "outras" */
export const CORES_DO_DONUT = ['#534AB7', '#e5484d', '#0d9488', '#ea580c'] as const
export const COR_OUTRAS = '#c9c5ee'
/** ⚠️ "sem categoria" tem cor PRÓPRIA (âmbar): ele não é "outras", é um convite pra agir */
export const COR_SEM_CATEGORIA = '#d97706'

export interface FaturaDoDash {
  invoiceId: string
  cardId: string
  cardNome: string
  lastDigits: string | null
  fechaDia: number
  /** ⚠️ 0 = limite não informado. **Sem limite não há barra** — nunca um teto inventado. */
  limite: number
  referencia: string
  vencimento: Date
  total: number
  pago: number
}

export interface CartaoDoDash {
  cardId: string
  nome: string
  lastDigits: string | null
  fechaDia: number
  emAberto: number
  /** `null` quando o cartão não tem limite informado — a tela NÃO desenha barra */
  usoPct: number | null
  disponivel: number | null
  estado: 'PAGA' | 'VENCIDA' | 'ABERTA' | 'SEM_FATURA'
  selo: string
}

export interface FatiaDoDonut { nome: string; valor: number; pct: number; cor: string; semCategoria: boolean }

export interface MesDoBalanco { mes: string; rotulo: string; entrou: number; saiu: number; atual: boolean }

export interface DashboardPF extends PainelDoMes {
  saldoNasContas: number
  /**
   * ⭐ **SÓ COM FATURA CONHECIDA** (régua do dono): saldo atual − o que falta pagar das
   * faturas em aberto/vencidas. ⛔ **Nada de projetar gasto futuro inventado** — projeção
   * de recorrente é Fase 2, e sem histórico ela seria chute com cara de número.
   */
  previstoFimDoMes: number
  faturasNoPrevisto: number
  recebidoDaEmpresa: { total: number; transferencias: number }
  donut: FatiaDoDonut[]
  cartoes: CartaoDoDash[]
  balanco: MesDoBalanco[]
  aVencer: { nome: string; valor: number; vencimento: Date; diasDeAtraso: number; estimada: boolean }[]
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** ⭐ o estado da fatura — DERIVADO do pago vs total, nunca do status gravado (09/09) */
export function estadoDaFatura(f: { total: number; pago: number; vencimento: Date }, hoje: Date): { estado: CartaoDoDash['estado']; selo: string } {
  const emAberto = r2(f.total - f.pago)
  // ⛔ "paga" é pagamento REGISTRADO. `CreditCardInvoice.status` nasce OPEN e ninguém o
  // transiciona com o tempo — foi assim que ele ficou eternamente OPEN depois de vencer.
  if (emAberto <= 0.005) return { estado: 'PAGA', selo: 'paga ✓' }
  const dias = Math.floor((hoje.getTime() - f.vencimento.getTime()) / 86_400_000)
  if (dias > 0) return { estado: 'VENCIDA', selo: `venceu ${f.vencimento.getUTCDate()}/${String(f.vencimento.getUTCMonth() + 1).padStart(2, '0')}` }
  return { estado: 'ABERTA', selo: 'aberta' }
}

export function montarDashboard(input: {
  mes: string
  hoje: Date
  linhas: LinhaDoMes[]
  /** todas as linhas da história — o balanço dos 4 meses sai daqui, não de outra consulta */
  historico: LinhaDoMes[]
  saldoNasContas: number
  faturas: FaturaDoDash[]
  pontesDoMes: { valor: number }[]
}): DashboardPF {
  const base = painelDoMes(input.mes, input.linhas)

  // ── CARTÕES + LIMITE ───────────────────────────────────────────────────────
  const porCartao = new Map<string, FaturaDoDash>()
  for (const f of input.faturas) {
    // ⚠️ a fatura que INTERESSA é a mais recente de cada cartão
    const a = porCartao.get(f.cardId)
    if (!a || f.referencia > a.referencia) porCartao.set(f.cardId, f)
  }
  const cartoes: CartaoDoDash[] = [...porCartao.values()].map((f) => {
    const emAberto = r2(f.total - f.pago)
    const { estado, selo } = estadoDaFatura(f, input.hoje)
    // ⛔ SEM LIMITE INFORMADO → sem barra. Inventar um teto faria a tela afirmar uma folga
    // que ninguém conferiu — e é o número que decide se o dono compra ou não.
    const temLimite = f.limite > 0
    return {
      cardId: f.cardId, nome: f.cardNome, lastDigits: f.lastDigits, fechaDia: f.fechaDia,
      emAberto, estado, selo,
      usoPct: temLimite ? Math.round((emAberto / f.limite) * 100) : null,
      disponivel: temLimite ? r2(f.limite - emAberto) : null,
    }
  }).sort((a, b) => b.emAberto - a.emAberto)

  // ── O PREVISTO ─────────────────────────────────────────────────────────────
  const aPagar = cartoes.filter((c) => c.estado === 'VENCIDA' || c.estado === 'ABERTA')
  const previsto = r2(input.saldoNasContas - aPagar.reduce((s, c) => s + c.emAberto, 0))

  // ── O DONUT ────────────────────────────────────────────────────────────────
  const gastos = base.gastosPorCategoria
  const total = gastos.reduce((s, g) => s + g.total, 0)
  const semCat = gastos.find((g) => g.categoriaId == null)
  const comCat = gastos.filter((g) => g.categoriaId != null)
  const topN = comCat.slice(0, 4)
  const resto = comCat.slice(4)
  const donut: FatiaDoDonut[] = topN.map((g, i) => ({
    nome: g.nome, valor: g.total, pct: total ? Math.round((g.total / total) * 100) : 0,
    cor: CORES_DO_DONUT[i], semCategoria: false,
  }))
  const restoTotal = resto.reduce((s, g) => s + g.total, 0)
  if (restoTotal > 0) {
    donut.push({ nome: `outras (${resto.length})`, valor: r2(restoTotal), pct: total ? Math.round((restoTotal / total) * 100) : 0, cor: COR_OUTRAS, semCategoria: false })
  }
  // ⭐⭐ "sem categoria" SEMPRE aparece quando existe, com cor própria — é o convite pra
  // categorizar, e enterrá-lo em "outras" seria esconder justamente o que pede ação.
  if (semCat && semCat.total > 0) {
    donut.push({ nome: 'sem categoria', valor: semCat.total, pct: total ? Math.round((semCat.total / total) * 100) : 0, cor: COR_SEM_CATEGORIA, semCategoria: true })
  }

  // ── O BALANÇO DOS 4 MESES ──────────────────────────────────────────────────
  const balanco: MesDoBalanco[] = []
  for (let i = 3; i >= 0; i--) {
    const d = new Date(`${input.mes}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i)
    const m = d.toISOString().slice(0, 7)
    // ⭐ a MESMA `painelDoMes` de novo: um mês do balanço e o mês do topo não têm como
    // discordar, porque são a mesma função com outra janela
    const p = painelDoMes(m, input.historico)
    balanco.push({ mes: m, rotulo: MESES[d.getUTCMonth()], entrou: p.entrou, saiu: p.saiu, atual: m === input.mes })
  }

  // ── A VENCER ───────────────────────────────────────────────────────────────
  // ⛔ SÓ FATURA CONHECIDA. Recorrente é Fase 2 — e um placeholder fingindo que existe
  // seria pior que a ausência (a régua do "zero widget sem dado").
  const aVencer = cartoes
    .filter((c) => c.estado === 'VENCIDA' || c.estado === 'ABERTA')
    .map((c) => {
      const f = porCartao.get(c.cardId)!
      return {
        nome: `fatura ${c.nome}`, valor: c.emAberto, vencimento: f.vencimento,
        diasDeAtraso: Math.max(0, Math.floor((input.hoje.getTime() - f.vencimento.getTime()) / 86_400_000)),
        // ⚠️ "estimada" quando a fatura ainda não fechou — o número pode crescer
        estimada: c.estado === 'ABERTA' && f.vencimento > input.hoje,
      }
    })
    .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())

  return {
    ...base,
    saldoNasContas: r2(input.saldoNasContas),
    previstoFimDoMes: previsto,
    faturasNoPrevisto: aPagar.length,
    recebidoDaEmpresa: {
      total: r2(input.pontesDoMes.reduce((s, p) => s + p.valor, 0)),
      transferencias: input.pontesDoMes.length,
    },
    donut, cartoes, balanco, aVencer,
  }
}
