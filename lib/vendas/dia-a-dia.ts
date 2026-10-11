/**
 * ⭐⭐⭐ O DIA A DIA DE VENDAS — PDV é a verdade, extrato é o fallback (10/10/2026).
 *
 * **Ordem do dono:** *"Venda importada do PDV (dia a dia, da central de importação) = número
 * LISO, sem ~. Extrato vira só fallback pro dia sem import, com ~ e a explicação no ⓘ. Dia de
 * venda sem import = célula «importar ⚠» clicável."*
 *
 * ⛔⛔⛔ **AS DUAS FONTES MEDEM COISAS DIFERENTES, e é por isso que elas divergem — não é bug.**
 * Medido em prod (outubro):
 * ```
 *   02/10 sex  PDV R$ 21.687,63  ·  extrato R$ 36.835,34   ← o extrato traz o BLOCO do fds
 *   06/10 ter  PDV R$ 15.873,77  ·  extrato R$ 15.926,36   ← dia normal: batem de perto
 * ```
 * O PDV diz **o que foi vendido NAQUELE dia**; o extrato diz **o que CAIU na conta atribuído
 * àquele dia pela régua de competência** — e o cartão liquida sex+sáb+dom **junto na segunda**,
 * então o extrato tem um BLOCO de 3 dias onde o PDV tem 3 números. ⭐ É exatamente por isso
 * que o PDV manda: com ele, cada dia é o dia.
 *
 * ⛔⛔ **O BLOCO NÃO SE DIVIDE POR 3.** Quando o dia do fim de semana NÃO tem import, o número
 * dele não existe: o banco não diz quanto de cada dia. A célula então aponta pro bloco
 * (`noBloco`) em vez de mostrar um terço inventado — *"saldo não se chuta"*, a régua da casa.
 *
 * ⚠️ ZERO conta nova de dinheiro: o PDV vem de `totaisDoPdvPorDia` (a lib do estoque, dona
 * daquelas tabelas) e o extrato de `VendaDiaria` (derivada de `Transaction`). Este arquivo
 * **escolhe a fonte e monta o calendário** — ele não soma transação nenhuma.
 */
import { pctBR } from '@/lib/format/percentual'

/** ⭐ de onde o número daquele dia veio — e é ele que decide o `~` na tela */
export type FonteDoDia = 'PDV' | 'EXTRATO' | 'BLOCO' | 'SEM_DADO' | 'FUTURO'

export interface DiaDeVenda {
  /** `YYYY-MM-DD` */
  dia: string
  /** 0=dom … 6=sáb (UTC — a data é de calendário, não instante) */
  diaDaSemana: number
  /** `null` quando não dá pra dizer (sem import e dentro de um bloco, ou sem dado) */
  total: number | null
  fonte: FonteDoDia
  /** ⭐ `true` só quando a fonte é o extrato — é ele que carrega o `~` */
  estimado: boolean
  /** unidades vendidas (só o PDV sabe) */
  unidades: number | null
  /**
   * ⭐⭐ o dia É de venda e NÃO tem import → a célula vira *"importar ⚠"* clicável.
   * ⚠️ Só vale pra dia que já ACABOU: cobrar import do dia de hoje é cobrar o impossível
   * (o relatório do PDV entra na madrugada — a cicatriz do import de 08/10).
   */
  pedeImport: boolean
  /** quando a célula aponta pro bloco do extrato: `'2026-10-02→2026-10-04'` */
  noBloco: string | null
  /** intensidade 0..1 pro mapa de calor — escala do PRÓPRIO recorte */
  calor: number
  /** ⭐ o recorde do recorte leva ★ */
  recorde: boolean
  /** o dia de hoje, marcado */
  hoje: boolean
}

/** ⭐ o bloco do extrato que cobre mais de um dia (fds liquidado junto) */
export interface BlocoDoExtrato {
  inicio: string
  fim: string
  total: number
  meio: string
}

export interface EntradaDoExtrato {
  dia: string
  fim: string
  total: number
  meio: string
}

export interface MontarDiasInput {
  /** `YYYY-MM-DD` inclusivo */
  de: string
  /** `YYYY-MM-DD` INCLUSIVO — é o recorte que o dono escolheu na tela */
  ate: string
  /** o que o PDV registrou, por dia */
  pdv: Map<string, { total: number; unidades: number }>
  /** o que o extrato atribuiu (dia único ou bloco) */
  extrato: EntradaDoExtrato[]
  /** `YYYY-MM-DD` de hoje no fuso de quem olha */
  hoje: string
  /** antes disto o módulo não tem dado — a célula fica cinza "sem dado" */
  moduleInicio: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** ⚠️ data de CALENDÁRIO: sempre UTC, nunca `new Date(s)` com fuso local no meio */
const dt = (s: string) => new Date(`${s}T00:00:00.000Z`)
const str = (d: Date) => d.toISOString().slice(0, 10)

/**
 * ⭐⭐ O CALENDÁRIO DO RECORTE — uma célula por dia, SEMPRE.
 *
 * ⛔ O bloco agrupado *"fim de semana 2–4"* MORREU como célula (ordem do dono). O que
 * sobrevive é a VERDADE que ele representava: sem import, aqueles 3 dias não têm número
 * próprio, e a célula DIZ isso apontando pro bloco — em vez de inventar um terço.
 */
export function montarDias(i: MontarDiasInput): DiaDeVenda[] {
  // ── 1. o extrato, separado em dia único × bloco
  const extratoDoDia = new Map<string, number>()
  const blocos: BlocoDoExtrato[] = []
  for (const e of i.extrato) {
    if (e.dia === e.fim) {
      extratoDoDia.set(e.dia, round2((extratoDoDia.get(e.dia) ?? 0) + e.total))
    } else {
      blocos.push({ inicio: e.dia, fim: e.fim, total: e.total, meio: e.meio })
    }
  }
  /** ⚠️ um dia pode ser coberto por mais de um bloco (PIX e CARTÃO liquidam juntos) */
  const blocoQueCobre = (dia: string): BlocoDoExtrato | null => {
    for (const b of blocos) if (dia >= b.inicio && dia <= b.fim) return b
    return null
  }

  // ── 2. uma célula por dia do recorte
  const dias: DiaDeVenda[] = []
  for (let d = dt(i.de); str(d) <= i.ate; d = new Date(d.getTime() + 86_400_000)) {
    const dia = str(d)
    const p = i.pdv.get(dia)
    const ex = extratoDoDia.get(dia)
    const bl = blocoQueCobre(dia)
    const acabou = dia < i.hoje
    const antesDoInicio = i.moduleInicio != null && dia < i.moduleInicio

    let total: number | null = null
    let fonte: FonteDoDia = 'SEM_DADO'
    let noBloco: string | null = null

    if (p) {
      // ⭐ O PDV MANDA. É o que foi vendido naquele dia, liso.
      total = p.total
      fonte = 'PDV'
    } else if (ex != null) {
      total = ex
      fonte = 'EXTRATO'
    } else if (bl) {
      /**
       * ⛔⛔ Dentro de um bloco e sem import: o número do DIA não existe. A célula aponta
       * pro bloco. Dividir por 3 seria inventar — o banco não diz quanto é de cada dia.
       */
      fonte = 'BLOCO'
      noBloco = `${bl.inicio}→${bl.fim}`
    } else if (dia > i.hoje) {
      fonte = 'FUTURO'
    } else if (antesDoInicio) {
      fonte = 'SEM_DADO'
    }

    dias.push({
      dia,
      diaDaSemana: d.getUTCDay(),
      total,
      fonte,
      estimado: fonte === 'EXTRATO' || fonte === 'BLOCO',
      unidades: p?.unidades ?? null,
      /**
       * ⭐ *"dia de venda sem import"* = o extrato viu dinheiro daquele dia (direto ou em
       * bloco) e o PDV não entrou. ⚠️ E só cobra depois de o dia acabar.
       */
      pedeImport: !p && acabou && !antesDoInicio && (ex != null || bl != null),
      noBloco,
      calor: 0,
      recorde: false,
      hoje: dia === i.hoje,
    })
  }

  // ── 3. o mapa de calor — escala do PRÓPRIO recorte (mais escuro = vendeu mais)
  const comValor = dias.filter((x) => x.total != null)
  const max = comValor.reduce((a, x) => Math.max(a, x.total!), 0)
  for (const x of dias) {
    if (x.total != null && max > 0) x.calor = x.total / max
  }
  /** ⚠️ empate leva ★ nos dois — escolher um seria desempatar no escuro */
  for (const x of comValor) if (max > 0 && x.total === max) x.recorde = true

  return dias
}

/* ═══════════════════════════ OS 4 CARTÕES ═══════════════════════════ */

export interface CartaoDeVendas {
  qual: 'periodo' | 'projecao' | 'melhorDia' | 'semana'
  rotulo: string
  valor: number | null
  sub: string
  /** ⭐ a família do token sólido (a roupa da Opção A dos Custos Fixos) */
  familia: 'indigo' | 'azul' | 'verde' | 'ambar'
  /** `null` quando não há comparação — a sub acende sozinha quando houver histórico */
  delta: string | null
}

const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`

/**
 * ⭐⭐ A PROJEÇÃO PELA MÉDIA **POR DIA-DA-SEMANA** — e esse detalhe é o que a torna honesta.
 *
 * **Ordem do dono:** *"projeção pela média POR DIA-DA-SEMANA (fds pesa diferente de
 * segunda) × dias restantes"*. ⛔ Uma média simples do mês projetaria o mês que termina em
 * domingo igual ao que termina em terça — e medido em prod o sábado vende **2,6× a segunda**
 * (28.988,60 contra 11.315,86). A projeção seria otimista ou pessimista por sorte do
 * calendário.
 *
 * ⚠️ **HISTÓRICO INSUFICIENTE = "a apurar", nunca um número.** Sem nenhuma amostra de um
 * dia-da-semana que ainda falta no mês, projetá-lo exigiria inventar — e número inventado
 * numa projeção sai plausível, que é o pior tipo de erro.
 */
export function projetarOMes(
  dias: DiaDeVenda[],
  hoje: string,
): { valor: number | null; porque: string } {
  const medidos = dias.filter((d) => d.total != null && d.dia <= hoje)
  if (medidos.length === 0) return { valor: null, porque: 'nenhum dia medido neste mês ainda' }

  const porDow = new Map<number, number[]>()
  for (const d of medidos) {
    const a = porDow.get(d.diaDaSemana) ?? []
    a.push(d.total!)
    porDow.set(d.diaDaSemana, a)
  }
  const media = (n: number) => {
    const a = porDow.get(n)
    return a && a.length > 0 ? a.reduce((x, y) => x + y, 0) / a.length : null
  }

  const realizado = medidos.reduce((a, d) => a + d.total!, 0)
  const faltam = dias.filter((d) => d.dia > hoje)
  if (faltam.length === 0) return { valor: round2(realizado), porque: 'o mês já fechou' }

  let projetado = 0
  const semAmostra = new Set<number>()
  for (const d of faltam) {
    const m = media(d.diaDaSemana)
    if (m == null) semAmostra.add(d.diaDaSemana)
    else projetado += m
  }
  if (semAmostra.size > 0) {
    const nomes = [...semAmostra].map((n) => DOW[n]).join(', ')
    return { valor: null, porque: `falta histórico de ${nomes} neste mês` }
  }
  return {
    valor: round2(realizado + projetado),
    porque: `${medidos.length} dia(s) medido(s) + ${faltam.length} pela média de cada dia da semana`,
  }
}

export interface MontarCartoesInput {
  dias: DiaDeVenda[]
  hoje: string
  /** o recorte é o mês inteiro? só aí a projeção faz sentido */
  ehMesInteiro: boolean
  /** ⭐ os dias da semana ANTERIOR, pra a sub "vs semana passada" acender sozinha */
  diasSemanaPassada: DiaDeVenda[]
}

/**
 * ⭐⭐ OS 4 CARTÕES, com a roupa sólida da Opção A (10/10) — e o número é REDONDO ao real,
 * com os centavos no tooltip (quem formata é `valorDoCartao`, o dono único).
 */
export function montarCartoes(i: MontarCartoesInput): CartaoDeVendas[] {
  const medidos = i.dias.filter((d) => d.total != null)
  const totalPeriodo = medidos.length > 0 ? round2(medidos.reduce((a, d) => a + d.total!, 0)) : null

  // (a) o recorte
  const diasVendidos = medidos.filter((d) => d.total! > 0).length
  const periodo: CartaoDeVendas = {
    qual: 'periodo',
    rotulo: 'Mês até agora',
    valor: totalPeriodo,
    sub: diasVendidos > 0 ? `${diasVendidos} dias vendidos` : 'nenhum dia com venda ainda',
    familia: 'indigo',
    delta: null,
  }

  // (b) a projeção
  const p = i.ehMesInteiro ? projetarOMes(i.dias, i.hoje) : { valor: null, porque: 'projeção só no mês inteiro' }
  const projecao: CartaoDeVendas = {
    qual: 'projecao',
    rotulo: p.valor == null ? 'No ritmo, o mês fecha em' : 'No ritmo, o mês fecha em ~',
    valor: p.valor,
    sub: p.porque,
    familia: 'azul',
    delta: null,
  }

  // (c) o melhor dia
  const melhor = medidos.reduce<DiaDeVenda | null>((a, d) => (a == null || d.total! > a.total! ? d : a), null)
  const melhorDia: CartaoDeVendas = {
    qual: 'melhorDia',
    rotulo: 'Melhor dia do mês ★',
    valor: melhor?.total ?? null,
    sub: melhor ? `${DOW[melhor.diaDaSemana]} ${ddmm(melhor.dia)}` : 'nenhum dia medido',
    familia: 'verde',
    delta: null,
  }

  // (d) a semana atual + a comparação que ACENDE sozinha
  const seg = segundaDaSemana(i.hoje)
  const daSemana = medidos.filter((d) => d.dia >= seg && d.dia <= i.hoje)
  const totalSemana = daSemana.length > 0 ? round2(daSemana.reduce((a, d) => a + d.total!, 0)) : null
  /**
   * ⛔⛔ A COMPARAÇÃO É **ATÉ O MESMO DIA DA SEMANA**, nunca a semana passada INTEIRA —
   * comparar 3 dias com 7 diria *"caiu 55%"* numa quarta-feira normal, e esse é o tipo de
   * número que faz o dono deixar de olhar o cartão.
   */
  const passados = i.diasSemanaPassada.filter((d) => d.total != null).slice(0, daSemana.length)
  const totalPassada = passados.length === daSemana.length && passados.length > 0
    ? round2(passados.reduce((a, d) => a + d.total!, 0))
    : null
  let delta: string | null = null
  if (totalSemana != null && totalPassada != null && totalPassada > 0) {
    const v = (totalSemana - totalPassada) / totalPassada
    delta = `${v >= 0 ? '+' : ''}${pctBR(v)} vs semana passada`
  }
  const semana: CartaoDeVendas = {
    qual: 'semana',
    rotulo: 'Semana atual',
    valor: totalSemana,
    sub: totalSemana == null
      ? 'nenhum dia medido nesta semana'
      : `${daSemana.length} dia(s) · desde ${ddmm(seg)}`,
    familia: 'ambar',
    delta,
  }

  return [periodo, projecao, melhorDia, semana]
}

/** ⚠️ semana SEG→DOM, a do calendário brasileiro */
export function segundaDaSemana(dia: string): string {
  const d = dt(dia)
  const off = (d.getUTCDay() + 6) % 7
  return str(new Date(d.getTime() - off * 86_400_000))
}

/* ═══════════════════════════ AS SEÇÕES DE BAIXO ═══════════════════════════ */

export interface FatiaDoMeio {
  meio: string
  valor: number
  pct: number
  /** ⭐ pctBR, com vírgula — a régua do projeto */
  rotulo: string
}

/**
 * ⭐ A COMPOSIÇÃO POR MEIO — UMA barra, Σ = 100% por construção.
 *
 * ⚠️⚠️ O MEIO SÓ EXISTE NO EXTRATO. O PDV diz o que foi vendido, **não por onde o dinheiro
 * entrou** — então esta seção é do extrato por natureza, e a tela DIZ isso. Fingir que ela é
 * do PDV seria dar ao número uma precisão que a fonte não tem.
 */
export function composicaoPorMeio(extrato: EntradaDoExtrato[]): FatiaDoMeio[] {
  const por = new Map<string, number>()
  for (const e of extrato) por.set(e.meio, round2((por.get(e.meio) ?? 0) + e.total))
  const total = [...por.values()].reduce((a, b) => a + b, 0)
  if (total <= 0) return []
  return [...por]
    .map(([meio, valor]) => ({ meio, valor, pct: valor / total, rotulo: pctBR(valor / total) }))
    .sort((a, b) => b.valor - a.valor)
}

export interface BarraDoDiaTipico {
  rotulo: string
  /** `null` = a apurar (menos de 2 semanas de amostra) */
  media: number | null
  amostras: number
  /** 0..1 — relativo ao maior, pra a barra comparar entre si */
  fracao: number
}

/** ⚠️ o mínimo que o dono ditou: 2 semanas por dia, senão é média de uma amostra */
export const MIN_AMOSTRAS_DO_DIA = 2

/**
 * ⭐ O DIA TÍPICO — barras horizontais, seg · ter · qua · qui · e o FDS junto.
 *
 * ⚠️ O fim de semana é UM grupo de propósito: sex, sáb e dom se parecem entre si e não se
 * parecem com segunda; separá-los triplicaria a exigência de amostra justamente nos dias de
 * maior volume.
 */
export function diaTipico(dias: DiaDeVenda[]): BarraDoDiaTipico[] {
  const grupos: { rotulo: string; dows: number[] }[] = [
    { rotulo: 'segunda', dows: [1] },
    { rotulo: 'terça', dows: [2] },
    { rotulo: 'quarta', dows: [3] },
    { rotulo: 'quinta', dows: [4] },
    { rotulo: 'fim de semana', dows: [5, 6, 0] },
  ]
  const out = grupos.map((g) => {
    const vs = dias.filter((d) => d.total != null && g.dows.includes(d.diaDaSemana)).map((d) => d.total!)
    /**
     * ⛔ A AMOSTRA DO FDS É POR **SEMANA**, não por dia: 3 dias de um fim de semana só são
     * uma observação do comportamento de fim de semana, não três.
     */
    const amostras = g.dows.length > 1 ? Math.floor(vs.length / g.dows.length) : vs.length
    const media = amostras >= MIN_AMOSTRAS_DO_DIA && vs.length > 0
      ? round2(vs.reduce((a, b) => a + b, 0) / vs.length)
      : null
    return { rotulo: g.rotulo, media, amostras, fracao: 0 }
  })
  const max = out.reduce((a, x) => Math.max(a, x.media ?? 0), 0)
  for (const x of out) if (x.media != null && max > 0) x.fracao = x.media / max
  return out
}
