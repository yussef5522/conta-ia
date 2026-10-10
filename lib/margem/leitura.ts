/**
 * ⭐⭐⭐ A LEITURA DA TELA "QUEM PAGA A CASA" (07/10/2026).
 *
 * ⛔⛔ **ORQUESTRADOR, não motor.** Ele busca e COMPÕE; toda decisão mora numa lib pura
 * (`sobra` · `casa` · `liga` · `dia` · `janela` · `por-dia` · `ficha-de-margem`). É isso que
 * permite ao guard provar `Σ(tijolos) == sobra bruta == Σ da liga` sem subir Postgres.
 *
 * ⛔ **UMA execução do `hubCardapio` por carregamento** — nunca uma por dia. A tela abre todo
 * dia, e `for (dia) await hubCardapio(...)` é literalmente os 4.909 ms / 1.786 consultas de
 * 28/09.
 *
 * ⚠️ `agora` é PARÂMETRO em toda a cadeia: *o relógio só serve pra exibir "hoje" na tela*.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { hubCardapio } from '@/lib/stock/cardapio/hub'
import { lerCustosFixos } from '@/lib/custos-fixos/leitura'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { sobrasDoPeriodo, type Sobras } from './sobra'
import { montarCasa, type Casa } from './casa'
import { montarLiga, type Liga, type AbaDaLiga } from './liga'
import { linhaDeChegada, type LinhaDeChegada } from './dia'
import { janelaDaMargem, custoFixoDaJanela, type JanelaDaMargem, type PeriodoDaMargem } from './janela'
import { sobraPorDia, custoComplementoPorDia, acumular } from './por-dia'

export interface SaborSemFicha {
  nomeSuitable: string
  ocorrencias: number
}

export interface MargemDaTela {
  janela: JanelaDaMargem
  linhaDeChegada: LinhaDeChegada
  casa: Casa
  liga: Liga
  sobras: Sobras
  /** ⭐ a fila: sabores/complementos vendidos SEM ficha, por ocorrências */
  saboresSemFicha: SaborSemFicha[]
  /** nomes do PDV por produto — a tela usa pros apelidos e o `por-dia` pro mapa */
  nomesPorChave: Record<string, string[]>
  /** ⚠️ o aviso de qualidade de dado: dias em que a razão sabor/pizza é impossível */
  diasComRelatorioSuspeito: { dia: string; pizzas: number; sabores: number; razao: number }[]
  /**
   * ⭐ O CMV POR COMPRA (as notas) do MESMO período — a comparação do ⓘ da cascata.
   *
   * ⚠️ Vem do dono único (`somarCmvPorCompra`), que o Custos fixos também consome; **a janela
   * é a do SELETOR**, não os 30 dias fixos do `medirMargem` — são perguntas diferentes.
   * ⛔ `0` é um FATO aqui ("nenhuma nota de custo no período"), mas a tela diz "a apurar"
   * quando não há nota nenhuma, pra não afirmar CMV zero.
   */
  cmvPorCompra: number
}

import { ehPizza, ehSaborDeVerdade, vereditoDoDia, PISO_DE_PIZZAS } from '@/lib/stock/vendas/razao-sabor-pizza'
/**
 * ⚠️ `custos-fixos/margem.ts` importa `prisma` no topo — seguro AQUI (`leitura.ts` é
 * servidor). ⛔ A TELA nunca importa dele: é por isso que `cascata.ts` é PURA e recebe o
 * `cmvPorCompra` por parâmetro (a lição de 07/10, quando a fórmula do equilíbrio mudou de
 * arquivo pra não arrastar o prisma pro bundle do navegador).
 */
import { somarCmvPorCompra } from '@/lib/custos-fixos/margem'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * ⚠️⚠️ A RÉGUA MUDOU DE CASA, NÃO DE CONTEÚDO (08/10/2026).
 *
 * `NAO_SAO_SABOR`, `ehSaborDeVerdade` e o `EH_PIZZA` viraram `lib/stock/vendas/razao-sabor-pizza.ts`
 * porque a **central de import** faz a MESMA pergunta (*"o relatório de sabores deste dia veio
 * completo?"*). ⛔ Duas cópias fariam a central dizer *"completo ✓"* sobre um dia que o aviso
 * do sininho acusa de incompleto — a doença que esta casa mais paga.
 *
 * ⚠️ O re-export mantém os importadores de sempre (`leitura-montador`, os testes) funcionando
 * sem que cada um saiba de onde a régua mudou.
 */
export { NAO_SAO_SABOR, ehSaborDeVerdade } from '@/lib/stock/vendas/razao-sabor-pizza'

export async function lerMargem(
  companyId: string,
  periodo: PeriodoDaMargem,
  agora: Date = new Date(),
  opts: { de?: string | null; ate?: string | null; aba?: AbaDaLiga; userId?: string } = {},
  db: PrismaClient = defaultPrisma,
): Promise<MargemDaTela> {
  const janela = janelaDaMargem(periodo, agora, { de: opts.de, ate: opts.ate })

  // ─────────── os meses que a janela toca (o custo fixo é por MÊS) ───────────
  const meses = new Set<string>()
  for (let t = janela.deUtc.getTime(); t < janela.ateUtc.getTime(); t += 86400_000) {
    meses.add(new Date(t).toISOString().slice(0, 7))
  }

  const [hub, ctx, custoDe, custosFixos, canaisDb, compLinhas, mapComp, cmvPorCompra] = await Promise.all([
    hubCardapio(companyId, { de: janela.deUtc, ate: janela.ateUtc }, db),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    Promise.all(
      [...meses].map(async (mes) => ({
        mes,
        d: await lerCustosFixos(companyId, mes, agora, db, undefined, opts.userId),
      })),
    ),
    db.stockCanalVenda.findMany({
      where: { companyId, ativo: true },
      select: { id: true, nome: true, taxaPct: true },
      orderBy: { nome: 'asc' },
    }),
    db.stockVendaComplementoLinha.findMany({
      where: { companyId, data: { gte: janela.deUtc, lt: janela.ateUtc } },
      select: { data: true, nomeSuitable: true, ocorrencias: true },
    }),
    db.stockVendaComplementoMap.findMany({
      where: { companyId },
      select: { nomeSuitable: true, fichaId: true },
    }),
    // ⭐ o CMV das NOTAS no mesmo recorte — pelo dono único, nunca por um `where` copiado
    somarCmvPorCompra(companyId, { de: janela.deUtc, ate: janela.ateUtc }, db),
  ])

  // ─────────── as sobras (a porta única) ───────────
  const sobras = sobrasDoPeriodo(hub.linhas)
  const nomesPorChave = new Map(hub.linhas.map((l) => [l.chave, l.nomesSuitable]))

  // ─────────── o custo fixo da janela, respeitando os CHIPS do dono ───────────
  const primeiro = custosFixos[0]?.d
  const chips = primeiro?.chips ?? { casa: true, banco: true, compromissos: true }
  const diarioPorMes = new Map(custosFixos.map(({ mes, d }) => [mes, d.cartaoPorDia.valor]))
  const cf = custoFixoDaJanela(janela, diarioPorMes)

  // ─────────── o custo dos COMPLEMENTOS (o achado de 07/10) ───────────
  const custoPorSabor = new Map<string, number | null>()
  for (const m of mapComp) {
    if (!m.fichaId) continue
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: m.fichaId }, 1, ctx, acc)
    let t = 0
    let falta = 0
    for (const [itemId, qtd] of acc) {
      const c = custoDe.get(itemId)
      if (c == null) falta++
      else t += c * qtd
    }
    custoPorSabor.set(m.nomeSuitable, acc.size === 0 || falta > 0 ? null : round2(t))
  }

  let custoComp = 0
  let ocCom = 0
  let ocSem = 0
  for (const l of compLinhas) {
    const c = custoPorSabor.get(l.nomeSuitable)
    if (c == null) ocSem += l.ocorrencias
    else {
      custoComp = round2(custoComp + c * l.ocorrencias)
      ocCom += l.ocorrencias
    }
  }

  // ─────────── o por-dia (placar + linha de chegada), com UMA execução do hub ───────────
  const linhasDeVenda = await db.stockVendaLinha.findMany({
    where: { companyId, data: { gte: janela.deUtc, lt: janela.ateUtc } },
    select: { data: true, nomeSuitable: true, quantidade: true },
  })
  const porDia = sobraPorDia(
    linhasDeVenda.map((l) => ({ dia: iso(l.data), nomeSuitable: l.nomeSuitable, quantidade: l.quantidade })),
    sobras.dentro,
    nomesPorChave,
  )
  const compPorDia = custoComplementoPorDia(
    compLinhas.map((l) => ({ dia: iso(l.data), nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })),
    custoPorSabor,
  )
  // ⚠️ a linha de chegada mostra o dia LÍQUIDO — senão ela diria "bateu" num dia que não bateu
  const diasLiquidos = porDia.map((d) => ({
    ...d,
    sobra: round2(d.sobra - (compPorDia.get(d.dia)?.custo ?? 0)),
  }))

  const casa = montarCasa({
    sobras,
    custoFixo: cf.total,
    dias: janela.dias,
    composicao: chips,
    complementos: { custo: custoComp, ocorrenciasComCusto: ocCom, ocorrenciasSemCusto: ocSem },
    acumuladoPorDia: acumular(porDia, compPorDia),
  })

  // ─────────── a fila dos sabores sem ficha ───────────
  const comFicha = new Set(mapComp.filter((m) => m.fichaId).map((m) => m.nomeSuitable))
  const filaMap = new Map<string, number>()
  for (const l of compLinhas) {
    if (comFicha.has(l.nomeSuitable)) continue
    // ⚠️ `GRANDE` é tamanho vazado, não sabor — fora da fila (decisão do dono)
    if (!ehSaborDeVerdade(l.nomeSuitable)) continue
    filaMap.set(l.nomeSuitable, (filaMap.get(l.nomeSuitable) ?? 0) + l.ocorrencias)
  }

  // ─────────── o aviso de qualidade: razão sabor/pizza impossível ───────────
  const pizzaPorDia = new Map<string, number>()
  for (const l of linhasDeVenda) {
    if (!ehPizza(l.nomeSuitable)) continue
    const d = iso(l.data)
    pizzaPorDia.set(d, (pizzaPorDia.get(d) ?? 0) + l.quantidade)
  }
  const saborPorDia = new Map<string, number>()
  for (const l of compLinhas) {
    if (!ehSaborDeVerdade(l.nomeSuitable)) continue
    const d = iso(l.data)
    saborPorDia.set(d, (saborPorDia.get(d) ?? 0) + l.ocorrencias)
  }
  const diasComRelatorioSuspeito: MargemDaTela['diasComRelatorioSuspeito'] = []
  for (const [dia, pizzas] of pizzaPorDia) {
    // ⚠️ dia pequeno não sustenta razão (a trava do "um lote não é média") — e o PISO mora
    //    no dono único, não digitado aqui: número solto em dois lugares é a 2ª régua
    if (pizzas < PISO_DE_PIZZAS) continue
    const sabores = saborPorDia.get(dia) ?? 0
    /**
     * ⭐ O VEREDITO VEM DO DONO ÚNICO — a central de import e este aviso não têm como
     * discordar sobre o mesmo dia. ⛔ A condição aqui é `COMPLEMENTOS_INCOMPLETOS` e não
     * "razão < 1" porque o veredito trata também o ZERO (selo próprio, gesto próprio).
     */
    const v = vereditoDoDia({ temProdutos: true, pizzas, sabores })
    if (v.selo === 'COMPLEMENTOS_INCOMPLETOS' || v.selo === 'SABORES_NAO_IMPORTADOS') {
      diasComRelatorioSuspeito.push({ dia, pizzas, sabores, razao: v.razao ?? 0 })
    }
  }
  diasComRelatorioSuspeito.sort((a, b) => a.dia.localeCompare(b.dia))

  return {
    janela,
    linhaDeChegada: linhaDeChegada(diasLiquidos, casa.custoFixoDiario, agora),
    casa,
    liga: montarLiga(sobras.dentro, opts.aba ?? 'CAIXA'),
    sobras,
    saboresSemFicha: [...filaMap]
      .map(([nomeSuitable, ocorrencias]) => ({ nomeSuitable, ocorrencias }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias),
    nomesPorChave: Object.fromEntries(nomesPorChave),
    diasComRelatorioSuspeito,
    cmvPorCompra,
  }
}
