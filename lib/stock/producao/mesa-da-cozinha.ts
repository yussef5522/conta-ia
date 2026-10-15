/**
 * ⭐⭐⭐ A MESA DA COZINHA — a mesa ② da referência (15/10/2026).
 *
 * `docs/dashboard-referencia.html` é a LEI: a tela ② tem **6 blocos, nesta ordem** — placar da
 * cozinha (c12) · radar da cozinha (c5) · quem fez o dia (c7) · a fita da cozinha (c12) ·
 * últimas conclusões (c6) · a semana da cozinha (c6).
 *
 * ⛔⛔ **ESTE É O ÚNICO ARQUIVO DA MESA ② QUE TOCA O BANCO — e ele não CALCULA NADA.** Cada
 * número sai de uma porta que já existe e que já serve outra tela:
 *
 *   | o bloco mostra              | a porta que responde                                    |
 *   |-----------------------------|---------------------------------------------------------|
 *   | em aberto · na bancada · concluídas · R$ · rendimento | `cardsDoPainel`              |
 *   | o que saiu hoje (UN · KG)   | `lotesDaJanela` + `somarQuantidades`                    |
 *   | etapas paradas · agora · fita · quem fez | `diaAoVivo`                                |
 *   | esperando conferência       | `filaDeConferencia`                                     |
 *   | rendimento fora da faixa    | `lotesDoPeriodo` (a faixa CONGELADA que o P8 lê)        |
 *   | itens negativos             | `saldosDaEmpresa`                                       |
 *   | retalho declarado           | `retalhoDasOrdens`                                      |
 *   | ✓✓ / ✓✓ corrigida           | `carimbosDasConclusoes`                                 |
 *   | pedido → entregue (%)       | `pedidoDaOrdem` + `pilulaDoPedido`                      |
 *
 * ⚠️ **ZERO ESCRITA.** A mesa só lê — e por isso ela não tem como criar uma segunda verdade
 * sobre o dia que a cozinha já viveu.
 *
 * ⭐⭐ **E ELA DEVOLVE O `diaAoVivo` JUNTO, de propósito.** A tela do HOJE já desenha a lista
 * do dia embaixo; se ela buscasse as duas coisas em duas requisições, os dois números viriam de
 * **instantes diferentes** e a mesa poderia dizer *"18 concluídas"* com a lista mostrando 19 —
 * duas verdades na mesma tela, a doença que esta casa mais paga. Uma leitura, um instante.
 */

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { janelaDoDiaSP, somarDias, horaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { formatBRL } from '@/lib/format/money'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { cardsDoPainel, lotesDoPeriodo, type CardsPainel } from './painel-producao'
import { diaAoVivo, type DiaAoVivo } from './dia-ao-vivo'
import { filaDeConferencia } from './fila-de-conferencia'
import { conclusoesNoPeriodo } from './conclusao'
import { carimbosDasConclusoes, type EstadoDaConferencia } from './conferencia'
import { retalhoDasOrdens } from './retalho'
import { lotesDaJanela } from './lotes'
import { pilulaDoPedido, fmtPedido, type PilulaDoPedido } from './pedido-na-tela'
import { somarQuantidades, foiMedido, type DesempenhoDaPessoa, type Quantidade } from './desempenho'
import { montarRadarDaCozinha, placarDoRadar, type LinhaDoRadar } from './radar-da-cozinha'
import { fitaDaCozinha, type EventoDaFitaDaCozinha } from './fita-da-cozinha'

/** ⚠️ 7 dias = a semana da referência (`qui…HOJE`), sempre terminando em HOJE */
const DIAS_DA_SEMANA_DA_COZINHA = 7

export interface ConclusaoNaMesa {
  conclusaoId: string
  ordemId: string
  produto: string
  /** o que saiu, já com a unidade ("370 UN", "34,296 KG") */
  saiuTxt: string
  /** ⭐ o estado do carimbo — é ele que separa os dois ✓✓ (`CORRIGIDA_E_CONFERIDA`) */
  estado: EstadoDaConferencia
  /** `null` quando a ordem não tem pedido registrado — ⛔ nunca 100% inventado */
  pilula: PilulaDoPedido | null
  /** o rastro "era 107" — só existe quando houve correção */
  corrigiuDe: number | null
}

export interface DiaDaSemanaDaCozinha {
  dia: string
  /** o rótulo curto da referência: `qui` · `sex` · … · `HOJE` */
  rotulo: string
  ehHoje: boolean
  /** 0..1 — a altura da barra (relativa ao maior dia da semana) */
  proporcao: number
  /** o texto do dia ("370 UN · 12 KG"), pelo dono único `somarQuantidades` */
  texto: string
  lotes: number
}

export interface SemanaDaCozinha {
  dias: DiaDaSemanaDaCozinha[]
  /**
   * ⚠️ `true` = as unidades da semana são MISTAS, então **a barra mede LOTES**, não unidades
   * — e a tela tem que DIZER. Somar UN com KG numa barra só seria o `1.415,84 un` de 13/09
   * (porção somada com massa), agora em forma de gráfico.
   */
  barraEmLotes: boolean
}

export interface MesaDaCozinha {
  empresaId: string
  dia: string
  /** ⚠️ o instante do SERVIDOR — a tela conta os segundos do cronômetro a partir dele */
  agoraServidor: string

  /** bloco 1 — o placar, inteiro de `cardsDoPainel` */
  placar: CardsPainel & {
    /** o que saiu hoje, por unidade (nunca uma soma cruzada) */
    saiuHoje: Quantidade
    /** a faixa do rodapé, já montada */
    faixa: string
  }

  /** bloco 2 */
  radar: LinhaDoRadar[]
  placarDoRadar: { coral: number; ambar: number; emOrdem: number }

  /** bloco 3 — o MESMO placar por pessoa que os Relatórios usam */
  quemFezODia: DesempenhoDaPessoa[]

  /** bloco 4 — os eventos do dia JÁ TRADUZIDOS pelo tradutor puro, mais recente primeiro */
  fita: EventoDaFitaDaCozinha[]

  /** bloco 5 */
  ultimasConclusoes: ConclusaoNaMesa[]
  /** quantas conclusões o dia tem no total (a tela diz "as N de hoje →") */
  conclusoesNoDia: number

  /** bloco 6 */
  semana: SemanaDaCozinha

  /** ⭐ o dia inteiro, pra a lista de baixo — uma leitura, um instante (ver o cabeçalho) */
  diaAoVivo: DiaAoVivo

  /** ⚠️ portas que falharam — fail-soft, mas NUNCA silencioso */
  naoAlcancado: string[]
}

/** ⚠️ quantas conclusões a lista do bloco 5 mostra (o resto vai atrás do "as N de hoje →") */
const CONCLUSOES_NA_MESA = 5

/**
 * ⭐ Fail-soft que **NÃO cala**: porta que estourar entra em `naoAlcancado` e a tela diz que
 * aquele bloco não foi lido. Ausência silenciosa é indistinguível de "está tudo bem" — e esta
 * casa já pagou por isso (o empty state que mentia na home PF).
 */
async function porta<T>(nome: string, f: () => Promise<T>, falhas: string[]): Promise<T | null> {
  try {
    return await f()
  } catch {
    falhas.push(nome)
    return null
  }
}

export async function lerMesaDaCozinha(
  empresaId: string,
  dia: string,
  agora: Date,
  db: PrismaClient = defaultPrisma,
): Promise<MesaDaCozinha> {
  const falhas: string[] = []
  const janela = janelaDoDiaSP(dia, dia)
  const inicioDaSemana = somarDias(dia, -(DIAS_DA_SEMANA_DA_COZINHA - 1))
  const janelaDaSemana = janelaDoDiaSP(inicioDaSemana, dia)

  const [cards, vivo, fila, lotesDoDia, lotesSemana, saldos, conclusoes] = await Promise.all([
    porta('placar', () => cardsDoPainel(empresaId, janela, agora, db), falhas),
    porta('dia ao vivo', () => diaAoVivo({ companyId: empresaId, dia, agora }, db), falhas),
    porta('fila de conferência', () => filaDeConferencia(empresaId, db, agora), falhas),
    porta('lotes do dia', () => lotesDoPeriodo(empresaId, janela, db), falhas),
    porta('a semana', () => lotesDaJanela(empresaId, janelaDaSemana, db), falhas),
    porta('saldos', () => saldosDaEmpresa(db, empresaId), falhas),
    porta('conclusões', () => conclusoesNoPeriodo(empresaId, janela.de, janela.ate, db), falhas),
  ])

  /* ───────────── bloco 5 — as últimas conclusões, com o carimbo ───────────── */
  const cs = conclusoes ?? []
  const ordemIds = [...new Set(cs.map((c) => c.ordemId))]
  /**
   * ⚠️ O RETALHO É DECLARADO NA **CRIAÇÃO** DA ORDEM — então ele existe em ordem que ainda
   * não fechou lote nenhum. Buscar só pelas ordens COM conclusão esconderia o retalho do lote
   * que está na panela agora, que é justamente quando o dono quer ver que ele foi declarado.
   */
  const ordensDoDia = [
    ...new Set([...ordemIds, ...(vivo?.pessoas ?? []).flatMap((p) => p.tarefas.map((t) => t.ordemId))]),
  ]
  const [carimbos, retalhos] = await Promise.all([
    porta('carimbos', () => carimbosDasConclusoes(empresaId, cs.map((c) => c.id), db), falhas),
    porta('retalho', () => retalhoDasOrdens(empresaId, ordensDoDia, db), falhas),
  ])

  /**
   * ⭐⭐ O NOME, A UNIDADE E O PEDIDO SAEM DO **`lotesDaJanela`**, que já os resolveu pra a
   * semana — não de uma 4ª consulta por ordem.
   *
   * ⚠️ Ele agrega por ORDEM (produção PARCIAL soma num lote só), então ele responde
   * *"que produto é esta ordem e quanto foi pedido nela"* — que é exatamente o que a linha
   * precisa. O que saiu em CADA conclusão vem da própria conclusão (`qtdGerada`), nunca do
   * agregado: numa parcial, usar o total diria que a 1ª metade entregou o lote inteiro.
   *
   * ⛔ E **sem meta declarada não existe pílula** (`pilulaDoPedido` devolve `null`): a régua de
   * 11/10 é que *"pedido 0"* e *"100% inventado"* são proibidos — a ausência aparece como
   * ausência.
   */
  const ordem = new Map(
    (lotesSemana ?? []).map((l) => [l.ordemId, { nome: l.tarefa, unidade: l.unidade, pedido: l.pedido }]),
  )

  const ultimasConclusoes: ConclusaoNaMesa[] = cs.slice(0, CONCLUSOES_NA_MESA).map((c) => {
    const o = ordem.get(c.ordemId)
    const unidade = o?.unidade ?? 'UN'
    const carimbo = carimbos?.get(c.id)
    return {
      conclusaoId: c.id,
      ordemId: c.ordemId,
      produto: o?.nome ?? '—',
      saiuTxt: `${fmtPedido(c.qtdGerada, unidade) ?? c.qtdGerada} ${unidade}`,
      estado: carimbo?.estado ?? 'AGUARDANDO_CONFERENCIA',
      pilula: pilulaDoPedido(c.qtdGerada, o?.pedido ?? null, unidade),
      corrigiuDe: carimbo?.corrigiuDe ?? null,
    }
  })

  /* ───────────── bloco 1 — o que saiu hoje, por unidade ───────────── */
  const saiuHoje = somarQuantidades(
    (lotesSemana ?? [])
      .filter((l) => l.dia === dia)
      .map((l) => ({ unidades: l.entregue, unidade: l.unidade })),
  )

  /* ───────────── bloco 2 — os fatos do radar ───────────── */
  const foraDaFaixa = (lotesDoDia ?? []).filter((l) => l.faixa === 'ACIMA' || l.faixa === 'ABAIXO')
  /** ⚠️ "pior" = o que mais destoa de 100%, pros dois lados (excesso é custo parado) */
  const pior = foraDaFaixa
    .filter((l) => l.pct != null)
    .sort((a, b) => Math.abs((b.pct ?? 1) - 1) - Math.abs((a.pct ?? 1) - 1))[0]
  const negativos = (saldos ?? []).filter((s) => s.saldo < 0)
  const piorNegativo = [...negativos].sort((a, b) => a.saldo - b.saldo)[0]
  const nomeDoItem = piorNegativo
    ? await porta(
        'nome do item',
        async () =>
          (await db.stockItem.findFirst({
            where: { companyId: empresaId, id: piorNegativo.itemId },
            select: { nome: true, unidadeControle: true },
          })) ?? null,
        falhas,
      )
    : null
  const retalhoDoDia = [...(retalhos?.values() ?? [])][0] ?? null
  /**
   * ⛔ "sem tempo medido" pela régua ÚNICA `foiMedido` (que já exclui zero **e** relâmpago)
   * — escrever `minutos > 0` aqui seria a 8ª cópia daquela decisão, e o piso de 5 min
   * (13/09) não valeria nesta tela.
   */
  const semTempo = (vivo?.pessoas ?? []).reduce(
    (s, p) =>
      s + p.tarefas.filter((t) => t.finalizadoEm != null && !foiMedido(t.minutos)).length,
    0,
  )

  const radar = montarRadarDaCozinha({
    empresaId,
    conferencia: { aguardando: fila?.aguardando ?? 0, atrasados: fila?.atrasados ?? 0 },
    rendimento: {
      foraDaFaixa: foraDaFaixa.length,
      pior:
        pior && pior.pct != null
          ? { tarefa: ordem.get(pior.ordemId)?.nome ?? 'uma receita', pct: pior.pct }
          : null,
    },
    negativos: {
      quantos: negativos.length,
      pior:
        piorNegativo && nomeDoItem
          ? {
              nome: nomeDoItem.nome,
              texto: `${piorNegativo.saldo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${nomeDoItem.unidadeControle}`,
            }
          : null,
    },
    retalho: retalhoDoDia
      ? { kg: retalhoDoDia.kg, receita: ordem.get(retalhoDoDia.ordemId)?.nome ?? 'uma ordem' }
      : null,
    semTempoMedido: semTempo,
  })

  /* ───────────── bloco 6 — a semana ───────────── */
  const porDia = new Map<string, { unidades: number; unidade: string }[]>()
  for (const l of lotesSemana ?? []) {
    const arr = porDia.get(l.dia) ?? []
    arr.push({ unidades: l.entregue, unidade: l.unidade })
    porDia.set(l.dia, arr)
  }
  const unidadesDaSemana = new Set((lotesSemana ?? []).map((l) => l.unidade))
  const barraEmLotes = unidadesDaSemana.size > 1
  const brutos = Array.from({ length: DIAS_DA_SEMANA_DA_COZINHA }, (_, i) => {
    const d = somarDias(inicioDaSemana, i)
    const itens = porDia.get(d) ?? []
    const q = somarQuantidades(itens)
    return {
      dia: d,
      ehHoje: d === dia,
      lotes: itens.length,
      texto: q.texto,
      /** ⚠️ a medida da barra: unidades quando há UMA só na semana; LOTES quando é mista */
      medida: barraEmLotes ? itens.length : (q.total ?? 0),
    }
  })
  const maior = Math.max(...brutos.map((b) => b.medida), 0)
  const semana: SemanaDaCozinha = {
    barraEmLotes,
    dias: brutos.map((b) => ({
      dia: b.dia,
      rotulo: b.ehHoje ? 'HOJE' : rotuloCurto(b.dia),
      ehHoje: b.ehHoje,
      proporcao: maior > 0 ? b.medida / maior : 0,
      texto: b.texto,
      lotes: b.lotes,
    })),
  }

  const abertas = cards?.emAberto ?? 0
  const paradas = vivo?.abertasDemais ?? 0

  return {
    empresaId,
    dia,
    agoraServidor: agora.toISOString(),
    placar: {
      emAberto: abertas,
      valorEmProducao: cards?.valorEmProducao ?? 0,
      concluidasNoPeriodo: cards?.concluidasNoPeriodo ?? 0,
      valorProduzidoNoPeriodo: cards?.valorProduzidoNoPeriodo ?? 0,
      rendimentoPeriodo: cards?.rendimentoPeriodo ?? null,
      lotesNaMedia: cards?.lotesNaMedia ?? 0,
      faixaRendimento: cards?.faixaRendimento ?? 'SEM_REGUA',
      abertasDeOntem: cards?.abertasDeOntem ?? 0,
      saiuHoje,
      faixa: faixaDoRodape({
        saiu: saiuHoje.texto,
        nadaSaiu: saiuHoje.porUnidade.length === 0,
        paradas,
        aguardando: fila?.aguardando ?? 0,
      }),
    },
    radar,
    placarDoRadar: placarDoRadar(radar),
    quemFezODia: vivo?.placar ?? [],
    /**
     * ⭐ A FITA JÁ SAI TRADUZIDA — o `hora` é INJETADO aqui porque o orquestrador é quem tem
     * relógio; a lib pura não conhece fuso, e formatar nela faria a fita mostrar a hora do
     * datacenter (UTC), 3 horas à frente do balcão.
     */
    fita: fitaDaCozinha({
      empresaId,
      eventos: vivo?.linhaDoTempo ?? [],
      hora: horaEmSaoPaulo,
    }),
    ultimasConclusoes,
    conclusoesNoDia: cs.length,
    semana,
    diaAoVivo:
      vivo ?? {
        placar: [],
        dia,
        agora: [],
        pessoas: [],
        linhaDoTempo: [],
        abertasDemais: 0,
        ehHoje: false,
      },
    naoAlcancado: falhas,
  }
}

/**
 * ⭐ A FAIXA DO RODAPÉ do placar — a frase da referência: *"a cozinha já produziu **1.616 UN ·
 * 34,30 KG** hoje · 0 etapas paradas · conferência em dia"*.
 *
 * ⛔ **Dia sem produção DIZ isso**, nunca "produziu 0" — zero é uma afirmação, e a cozinha que
 * ainda não fechou lote não produziu zero: ela não fechou lote.
 */
export function faixaDoRodape(e: {
  saiu: string
  nadaSaiu: boolean
  paradas: number
  aguardando: number
}): string {
  const produziu = e.nadaSaiu
    ? 'nenhum lote fechado ainda hoje'
    : `a cozinha já produziu ${e.saiu} hoje`
  const paradas =
    e.paradas > 0 ? `${e.paradas} etapa(s) parada(s) há horas` : 'nenhuma etapa parada'
  const conferencia =
    e.aguardando > 0 ? `${e.aguardando} esperando conferência` : 'conferência em dia'
  return `${produziu} · ${paradas} · ${conferencia}`
}

/** ⚠️ o rótulo sai do TEXTO da data, nunca de `new Date(dia)` — em fuso negativo isso volta um dia */
function rotuloCurto(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getUTCDay()]
}

/** ⚠️ reexportado só pra a rota não precisar conhecer o formatador de dinheiro da casa */
export { formatBRL }
