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
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const iso = (d: Date) => d.toISOString().slice(0, 10)

/**
 * ⚠️ `GRANDE` (208 ocorrências em prod) é **TAMANHO vazado** no relatório de complementos,
 * não sabor — decisão do dono em 07/10: *"mapear como não-sabor, ignorar na fila, nunca virar
 * ficha de sabor"*. A lista é FECHADA e mora aqui, com o motivo.
 *
 * ⛔ Lista aberta (qualquer palavra de tamanho) escondería sabor legítimo: existe pizza
 * chamada `PORTUGUESA GRANDE` no cardápio, e ela É sabor.
 */
export const NAO_SAO_SABOR = new Set(['GRANDE', 'PEQUENA', 'FAMILIA', 'FAMÍLIA', 'MEDIA', 'MÉDIA', 'BROTO'])

const canon = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

export function ehSaborDeVerdade(nome: string): boolean {
  return !NAO_SAO_SABOR.has(canon(nome))
}

const EH_PIZZA = /PIZZA|PRECINHO|FAMILIA|BROTO|25\s?CM|35\s?CM|45\s?CM/i

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

  const [hub, ctx, custoDe, custosFixos, canaisDb, compLinhas, mapComp] = await Promise.all([
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
    if (!EH_PIZZA.test(l.nomeSuitable)) continue
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
    if (pizzas < 20) continue // ⚠️ dia pequeno não sustenta razão (a trava do "um lote não é média")
    const sabores = saborPorDia.get(dia) ?? 0
    const razao = sabores / pizzas
    // ⛔ razão < 1 é IMPOSSÍVEL: toda pizza obriga ao menos 1 sabor no cardápio
    if (razao < 1) diasComRelatorioSuspeito.push({ dia, pizzas, sabores, razao })
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
  }
}
