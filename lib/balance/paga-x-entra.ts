/**
 * ⭐⭐⭐ PAGA × ENTRA · 7 DIAS — o módulo que o dono pediu por nome (15/10/2026).
 *
 * **O que ele responde:** *"nos próximos 7 dias, quanto entra e quanto sai — e em que dia eu
 * aperto"*. Verde = entrada projetada pela média DAQUELE dia-da-semana; coral = contas
 * agendadas do dia; acima de cada dia o SALDO (entra − paga).
 *
 * ⛔⛔ **MÓDULO PURO, ZERO ACESSO A BANCO — e isso é o que o torna testável.** Ele recebe a
 * média por dia-da-semana (do dono único em `lib/vendas/dia-a-dia.ts`) e as contas agendadas
 * (do dono único em `lib/contas-pagar/escopo.ts`). ⚠️ Uma média própria aqui seria a **2ª
 * derivação** de *"quanto este dia-da-semana vende"*, e ela divergiria da projeção do mês na
 * primeira borda — a doença que esta casa mais paga.
 *
 * ⛔⛔⛔ **DIA SEM MÉDIA → "a apurar", NUNCA ZERO.** Zero é uma afirmação (*"este dia não
 * vende"*) e ele entraria no saldo como se fosse fato, pintando de vermelho um dia que ninguém
 * mediu. ⚠️ E o limiar é o `MIN_AMOSTRAS_DO_DIA` da casa (2): *"média de uma amostra"* é o que
 * o dono recusou em 10/10, e repetir o número aqui seria a segunda régua.
 *
 * ⚠️ **`hoje` é PARÂMETRO** — o relógio só diz que dia é hoje na TELA, nunca decide (a régua
 * desde 13/08). E o dia é o **dia do BRASIL**: quem resolve isso é a ROTA, não esta função.
 */
import { MIN_AMOSTRAS_DO_DIA, type MediaDoDiaDaSemana } from '@/lib/vendas/dia-a-dia'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const

/** uma conta agendada, na forma mínima que o módulo precisa */
export interface ContaAgendada {
  /** YYYY-MM-DD (dia do vencimento) */
  dia: string
  valor: number
  descricao: string
}

export interface DiaDaSemanaProjetado {
  /** YYYY-MM-DD */
  dia: string
  /** 0 = domingo … 6 = sábado */
  dow: number
  /** "seg", "ter" … — o rótulo curto da coluna */
  rotulo: string
  ehHoje: boolean
  /**
   * ⛔ `null` = **a apurar**. A tela escreve "a apurar" e a barra verde não existe —
   * nunca um zero que se lê como "não vende".
   */
  entra: number | null
  /** quantas amostras formaram a média (a tela pode dizer "média de 3 quartas") */
  amostras: number
  /** Σ das contas agendadas do dia */
  paga: number
  contas: ContaAgendada[]
  /**
   * ⭐ `entra − paga`, **só quando `entra` é conhecido**. Com `entra: null` o saldo é `null`:
   * subtrair contas de uma entrada desconhecida daria um negativo inventado.
   */
  saldo: number | null
}

export interface PagaXEntra {
  dias: DiaDaSemanaProjetado[]
  /** Σ das entradas CONHECIDAS (os dias "a apurar" ficam fora, e a tela diz quantos) */
  totalEntra: number
  diasAApurar: number
  totalPaga: number
  /** `totalEntra − totalPaga` — e carrega a ressalva dos dias a apurar */
  totalSaldo: number
  /**
   * ⭐ UMA frase, gerada por regra, na língua do balcão: o pior dia e quem o cobre.
   * `null` quando não há nada a dizer (nenhum dia negativo).
   */
  aviso: string | null
}

export interface PagaXEntraInput {
  /** YYYY-MM-DD do dia do Brasil — decidido pela ROTA */
  hoje: string
  medias: MediaDoDiaDaSemana[]
  contas: ContaAgendada[]
  /** quantos dias a janela mostra (contando hoje) */
  dias?: number
}

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⚠️ A janela anda em UTC a partir do dia do Brasil que a rota resolveu — somar 86.400.000 ms
 * sobre um `Date` local atravessaria o horário de verão de alguns fusos e pularia um dia.
 */
function diasDaJanela(hoje: string, n: number): { dia: string; dow: number }[] {
  const base = new Date(`${hoje}T00:00:00.000Z`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getTime() + i * 86_400_000)
    return { dia: d.toISOString().slice(0, 10), dow: d.getUTCDay() }
  })
}

export function montarPagaXEntra(i: PagaXEntraInput): PagaXEntra {
  const janela = diasDaJanela(i.hoje, Math.max(1, i.dias ?? 7))
  const porDow = new Map(i.medias.map((m) => [m.dow, m]))

  /**
   * ⚠️ As contas são agrupadas por dia ANTES do laço: um `filter` por dia dentro do laço
   * seria O(dias × contas) e, pior, deixaria a conta fora da janela **invisível** —
   * ela aparece no `foraDaJanela` do consumidor, nunca engolida aqui.
   */
  const contasPorDia = new Map<string, ContaAgendada[]>()
  for (const c of i.contas) {
    const a = contasPorDia.get(c.dia) ?? []
    a.push(c)
    contasPorDia.set(c.dia, a)
  }

  const dias: DiaDaSemanaProjetado[] = janela.map(({ dia, dow }) => {
    const m = porDow.get(dow)
    /**
     * ⛔ O corte é `>= MIN_AMOSTRAS_DO_DIA`, o MESMO da casa. Média com uma amostra é o
     * número de um dia atípico virando previsão — recusado pelo dono em 10/10.
     */
    const entra =
      m != null && m.media != null && m.amostras >= MIN_AMOSTRAS_DO_DIA ? m.media : null
    const contas = contasPorDia.get(dia) ?? []
    const paga = round2(contas.reduce((s, c) => s + c.valor, 0))
    return {
      dia,
      dow,
      rotulo: DOW[dow].slice(0, 3),
      ehHoje: dia === i.hoje,
      entra,
      amostras: m?.amostras ?? 0,
      paga,
      contas,
      saldo: entra == null ? null : round2(entra - paga),
    }
  })

  const comEntrada = dias.filter((d) => d.entra != null)
  const totalEntra = round2(comEntrada.reduce((s, d) => s + (d.entra ?? 0), 0))
  const totalPaga = round2(dias.reduce((s, d) => s + d.paga, 0))

  return {
    dias,
    totalEntra,
    diasAApurar: dias.length - comEntrada.length,
    totalPaga,
    totalSaldo: round2(totalEntra - totalPaga),
    aviso: avisoDoPiorDia(dias),
  }
}

/**
 * ⭐⭐ O AVISO — UMA frase, a do dia que mais aperta, na língua do balcão.
 *
 * ⛔ **Só fala de dia com saldo CONHECIDO e NEGATIVO.** Dia "a apurar" não entra: avisar sobre
 * um aperto que ninguém mediu é inventar o alarme — e *alarme falso repetido é como um alarme
 * morre* (os 111 de 26/08).
 *
 * ⭐ E ela **DIZ QUEM COBRE**: a sobra dos dias anteriores da janela. Sem isso o dono lê
 * *"falta R$ 3.000 na quarta"* e não sabe se o dinheiro de hoje alcança — o número viraria
 * susto em vez de informação.
 */
export function avisoDoPiorDia(dias: DiaDaSemanaProjetado[]): string | null {
  const negativos = dias.filter((d) => d.saldo != null && d.saldo < 0)
  if (negativos.length === 0) return null

  const pior = negativos.reduce((a, b) => ((b.saldo ?? 0) < (a.saldo ?? 0) ? b : a))
  const idx = dias.findIndex((d) => d.dia === pior.dia)
  const sobraAntes = dias
    .slice(0, idx)
    .reduce((s, d) => s + (d.saldo != null && d.saldo > 0 ? d.saldo : 0), 0)
  const falta = -(pior.saldo ?? 0)
  const nome = pior.ehHoje ? 'hoje' : DOW[pior.dow]

  if (sobraAntes >= falta) {
    return `${nome} as contas passam o que entra em ${brl(falta)} — a sobra dos dias antes cobre (${brl(round2(sobraAntes))}).`
  }
  const buraco = round2(falta - sobraAntes)
  return sobraAntes > 0
    ? `${nome} as contas passam o que entra em ${brl(falta)} — a sobra dos dias antes cobre só ${brl(round2(sobraAntes))}, faltam ${brl(buraco)}.`
    : `${nome} as contas passam o que entra em ${brl(falta)} e não há sobra nos dias antes pra cobrir.`
}
