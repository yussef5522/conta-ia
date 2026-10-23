/**
 * ⭐⭐⭐ REAL × TEÓRICO v2 — A MESA DE PERÍCIA (29/09/2026)
 *
 * **A lei do dono:** *"a tela passa a ler EXCLUSIVAMENTE o motor do Radar
 * (`calcularFechamentoDoDia`) — o cálculo próprio que ela tem hoje MORRE. Duas telas, uma
 * verdade."*
 *
 * ⛔⛔ **`calcularRealVsTeorico` NÃO É MAIS CHAMADO AQUI**, e o guard de página proíbe que
 * volte. Ele e o motor do Radar **discordavam de verdade**: aquele somava TODOS os
 * `AJUSTE_CONTAGEM` do período, o Radar usa a ÚLTIMA contagem de cada item — item contado
 * duas vezes no período dava dois números, e nenhuma tela dizia qual era o certo.
 *
 * ⚠️ O `PISO_DADOS` e os `TIPOS` continuam vindo de `real-vs-teorico.ts`: **eles são o
 * vocabulário do módulo** (o próprio Radar os importa), não a segunda conta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { calcularFechamentoDoDia } from '@/lib/stock/radar/fechamento'
import { itensPorLista } from '@/lib/stock/radar/watchlist'
import { gruposDoRadar } from '@/lib/stock/radar/grupos'
import { seloDaAgenda, rotuloCurtoDaAgenda, rotuloLongoDaAgenda, textoDaUltima } from '@/lib/stock/radar/agenda-da-contagem'
import { universoDoGrupo } from '@/lib/stock/radar/universo-do-grupo'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { janelaDoPeriodo, type ChavePeriodo } from '@/lib/stock/radar/periodo'
import { montarMesa, somaDaMesa, colunasValidas, COLUNAS, COLUNAS_PADRAO } from '@/lib/stock/radar/mesa'
import { formatarQtd } from '@/lib/stock/quantidade'

interface Params { params: Promise<{ id: string }> }

const CHAVES: ChavePeriodo[] = ['ONTEM_HOJE', 'SETE_DIAS', 'MES', 'LIVRE']

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const sp = request.nextUrl.searchParams
  const chave = (CHAVES.includes(sp.get('periodo') as ChavePeriodo) ? sp.get('periodo') : 'SETE_DIAS') as ChavePeriodo
  // ⚠️ a janela e o RÓTULO saem do mesmo lugar (a lição dos 5 textos "12/08" literais em tela)
  const janela = janelaDoPeriodo(chave, { de: sp.get('de'), ate: sp.get('ate') })
  const itensFiltro = (sp.get('itens') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

  /**
   * ⭐⭐ OS GRUPOS DO DONO (RT2) — e eles são a MESMA membership do Radar.
   *
   * ⛔⛔ `stock_radar_item` continua sendo a **única** tabela de vínculo item↔lista (desde
   * 20/09). Uma segunda daria DUAS verdades pra *"quais itens o dono acompanha"*: ele poria
   * o FRANGO nos CAROS por esta tela e o Radar não saberia. O que nasceu novo é só a tabela
   * de **grupos** (nome, emoji, ordem, agenda) — o vínculo é o de sempre.
   *
   * ⚠️ `gruposDoRadar` SEMEIA os três atuais na primeira leitura, com nome/emoji/ordem
   * copiados do que a tela cravava — é isso que torna "antes==depois" provável.
   */
  const { grupos } = await gruposDoRadar(companyId, prisma, auth.userId)
  const porLista = await itensPorLista(companyId, grupos.map((g) => g.slug), prisma)

  /**
   * ⚠️ As três listas nomeadas continuam indo pro motor **exatamente como antes** (Lei C0:
   * o Radar não muda), e os grupos vão no campo ADITIVO `grupos`. Grupo legado aparece nas
   * duas pontas de propósito — o motor dedupa por `itemId` ao montar o placar.
   */
  const radar = await calcularFechamentoDoDia(
    {
      companyId,
      de: janela.de,
      ate: janela.ate,
      caros: porLista['CAROS'] ?? [],
      revenda: porLista['REVENDA'] ?? [],
      porcoes: porLista['PORCOES'] ?? [],
      grupos: grupos.map((g) => ({ slug: g.slug, itemIds: porLista[g.slug] ?? [] })),
    },
    prisma,
  )

  const secoes = montarMesa(
    grupos.map((g) => ({
      slug: g.slug,
      nome: g.nome,
      emoji: g.emoji,
      linhas: radar.porGrupo?.[g.slug] ?? [],
    })),
    itensFiltro,
  )

  /**
   * ⭐⭐ A AGENDA DE CONTAGEM DE CADA GRUPO (RT3) — o selo que a tela pinta.
   *
   * ⛔ `hoje` é o **dia do BRASIL**, resolvido AQUI, no servidor: deixar a tela derivar faria
   * o selo dizer "CONTAR HOJE" num aparelho e "próxima SEX" noutro (a cicatriz do tablet que
   * mentiu zero por dois dias, 08/09). **Um relógio manda.**
   *
   * ⚠️ E a "última contagem do grupo" é a MAIS RECENTE entre as linhas dele — não existe
   * carimbo de "contei o grupo": o que existe é contagem por item. Chutar uma data aqui
   * inventaria um fato; a MAIS RECENTE é a única leitura defensável, e `null` (nunca
   * contado) segue sendo estado próprio.
   */
  const hoje = diaEmSaoPaulo(new Date())
  const agenda = grupos.map((g) => {
    const linhas = radar.porGrupo?.[g.slug] ?? []
    const dias = linhas.map((l) => l.ultimaContagem).filter((d): d is string => !!d)
    const ultima = dias.length ? dias.sort().at(-1)! : null
    return {
      /**
       * ⭐ O **id** vai junto porque os quatro gestos de grupo (✎ renomear · chips da agenda ·
       * adicionar item · criar) resolvem o alvo por **id escopado pela empresa** (REGRA 8). A
       * tela não tem como derivá-lo do slug, e mandar o slug como alvo faria a rota resolver
       * por nome — a cicatriz da conta `'sicredi '`.
       */
      id: g.id,
      slug: g.slug,
      /**
       * ⭐⭐ O universo da busca vem **PRONTO do servidor** (RT2). ⛔ A tela é `'use client'`:
       * importar a régua junto de `grupos.ts` arrastaria o PrismaClient pro bundle do
       * navegador. E quem decide tem um dono só — duas respostas pra *"que itens este grupo
       * oferece?"* divergiriam no primeiro grupo novo.
       */
      universo: universoDoGrupo(g.slug),
      todoDia: g.agenda.todoDia,
      dias: g.agenda.dias,
      rotuloCurto: rotuloCurtoDaAgenda(g.agenda),
      rotuloLongo: rotuloLongoDaAgenda(g.agenda),
      ultimaTexto: textoDaUltima(hoje, ultima),
      selo: seloDaAgenda({ agenda: g.agenda, hoje, ultimaContagem: ultima }),
    }
  })

  // ⭐ a escolha de colunas desta pessoa nesta empresa (sem linha = o padrão)
  const pref = await prisma.stockMesaPreferencia.findUnique({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    select: { colunas: true },
  })
  const colunas = colunasValidas(pref?.colunas.split(','))

  if (sp.get('formato') === 'csv') {
    const cab = ['Seção', 'Item', 'Un', 'Desde', 'Até', 'Início', 'Entrou', 'Produzido', 'Vendeu', 'Perdeu', 'Separado', 'Teórico', 'Real', 'Variância', 'R$', '%']
    const linhas = secoes.flatMap((s) => s.linhas.map((l) => [
      s.titulo, l.nome, l.unidade, l.desde ?? '', l.ate ?? '',
      l.inicio ?? '', l.entrou, l.produziu, l.vendeu, l.perdeu, l.separado,
      l.teorico ?? '', l.real ?? 'falta contar', l.variancia ?? '', l.varianciaValor ?? '',
      l.pct == null ? '' : (l.pct * 100).toFixed(1),
    ]))
    const csv = [cab, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    return new NextResponse(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="real-x-teorico-${janela.de}-a-${janela.ate}.csv"`,
      },
    })
  }

  return NextResponse.json({
    janela,
    secoes,
    // ⭐ RT3 — o selo vem PRONTO do servidor; a tela só pinta (um relógio, uma régua)
    agenda,
    colunas,
    colunasDisponiveis: COLUNAS,
    /**
     * ⭐⭐ O PLACAR DO RADAR VIAJA JUNTO — é o que torna o guard de página POSSÍVEL na
     * própria tela: sem filtro, `soma.valor` tem que bater com `placar.valor`. Mandar só um
     * dos dois deixaria a divergência invisível até alguém abrir as duas telas lado a lado.
     */
    placarDoRadar: { valor: radar.placar.valor, itensContados: radar.placar.itensContados },
    soma: somaDaMesa(secoes),
    filtrado: itensFiltro.length > 0,
    avisos: radar.avisos,
  })
}

/** ⭐ salvar a escolha de colunas — é preferência de tela, então `stock.view` basta */
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const body = await request.json().catch(() => ({}))
  const escolhidas = Array.isArray(body?.colunas) ? body.colunas.map(String) : null
  // ⛔ a validação é a MESMA da leitura — lista vazia ou chave inventada cai no padrão,
  //    nunca grava tela sem coluna nenhuma (o dono não conseguiria nem ligar de volta)
  const colunas = colunasValidas(escolhidas)
  const texto = colunas.join(',')

  await prisma.stockMesaPreferencia.upsert({
    where: { companyId_userId: { companyId, userId: auth.userId } },
    create: { companyId, userId: auth.userId, colunas: texto },
    update: { colunas: texto },
  })
  return NextResponse.json({ colunas, padrao: COLUNAS_PADRAO, exemplo: formatarQtd(0.0003, 'KG') })
}
