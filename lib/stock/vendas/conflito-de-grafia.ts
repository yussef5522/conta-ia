/**
 * ⭐⭐ 08/11/2026 — A MAÇANETA DO CONFLITO: o comparador e o gesto de escolher.
 *
 * O sprint da grafia canônica criou o estado CONFLITO (grafias irmãs apontando pra fichas
 * ATIVAS diferentes — casos reais da Caçula: `XIS COMPLETO` × `XIS - COMPLETO`, e as duas
 * pizzas 35/45cm). A linha dizia *"escolher →"* e o clique abria a central geral: porta
 * oferecida sem nada atrás.
 *
 * Aqui mora o que fica atrás dela, em DUAS funções com dono:
 *   · `lerComparadorDoConflito` — LÊ, nunca grava: as fichas do conflito lado a lado e quem
 *     ainda consome cada uma (pra o "inativar a outra" vir marcado SÓ quando é seguro);
 *   · `escolherFichaDoConflito` — o gesto do dono: todas as grafias irmãs passam a apontar
 *     pra ficha escolhida **pela porta única do mapa** (`upsertVendaMap`), nunca INSERT de mão.
 *
 * ⛔ O conflito é achado pela MESMA porta que o criou (`resolvedorDeGrafia`). Uma 2ª régua
 * aqui poderia abrir um comparador pra um nome que a revisão não chama de conflito — ou
 * calar um que ela chama.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { getFicha, atualizarFicha } from '@/lib/stock/producao/fichas'
import { canonicoDaGrafia, resolvedorDeGrafia } from './grafia-canonica'
import { upsertVendaMap } from './venda-map'
import { avisoDosConsumidores, type ConsumidoresDeFora } from './aviso-de-consumidores'
import { diffDeFichas, type ComponenteDaFicha, type DiffDeFichas } from '@/lib/stock/producao/diff-de-fichas'

export { avisoDosConsumidores, type ConsumidoresDeFora }

export class ConflitoDeGrafiaError extends Error {}

/** ⚠️ estados de ordem que ainda vão CONSUMIR a ficha (concluída/cancelada já não) */
const ORDEM_ABERTA = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO']
const DIAS_DE_VENDA_RECENTE = 30

export interface FichaNoConflito {
  fichaId: string
  nome: string
  ativo: boolean
  ingredientes: number
  /** ⭐ 09/11 — o MIOLO: os ingredientes da versão atual (nome · dose · custo médio) */
  componentes: ComponenteDaFicha[]
  custoLote: number | null
  /** ISO — a mais recente entre a cabeça da ficha e a última versão */
  ultimaEdicao: string
  /** as grafias DESTE produto que hoje apontam pra ela */
  grafias: string[]
  /** vendas dos últimos 30 dias pelas grafias que apontam pra ela (todas) */
  vendasRecentes: { unidades: number; ultimoDia: string | null }
  consumidores: ConsumidoresDeFora
  /** ⭐ `true` = nada de fora a usa: inativar vem MARCADO por padrão */
  inativarSemAviso: boolean
}

export interface ComparadorDoConflito {
  nome: string
  canonico: string
  fichas: FichaNoConflito[]
  /** ⭐ 09/11 — o diff calculado entre as DUAS fichas (A = fichas[0]); null com 3+ fichas */
  diff: DiffDeFichas | null
}

function semConsumidores(c: ConsumidoresDeFora): boolean {
  return avisoDosConsumidores(c).length === 0
}

async function mapaDaEmpresa(companyId: string, db: PrismaClient) {
  return db.stockVendaProdutoMap.findMany({
    where: { companyId },
    select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true },
  })
}

/**
 * ⭐ LÊ O COMPARADOR. Devolve `null` quando o nome NÃO está em conflito (a porta da revisão
 * diz outra coisa) — o chamador mostra "não há mais conflito", nunca um comparador vazio.
 */
export async function lerComparadorDoConflito(
  companyId: string,
  nome: string,
  db: PrismaClient = defaultPrisma,
): Promise<ComparadorDoConflito | null> {
  const mapa = await mapaDaEmpresa(companyId, db)
  const r = resolvedorDeGrafia(mapa)(nome)
  if (r.tipo !== 'CONFLITO') return null
  const canonico = canonicoDaGrafia(nome)

  const fichaIds = [...new Set(r.candidatas.map((c) => c.fichaId).filter((x): x is string => !!x))]
  // ⛔ candidata sem ficha (revenda legada por itemId) não tem o que comparar — não inventa
  if (fichaIds.length < 2 || r.candidatas.some((c) => !c.fichaId)) {
    throw new ConflitoDeGrafiaError('Este conflito envolve um destino que não é ficha — resolva pelo mapear.')
  }

  const desde = new Date(Date.now() - DIAS_DE_VENDA_RECENTE * 86_400_000)
  const fichas: FichaNoConflito[] = []
  for (const fichaId of fichaIds) {
    const g = await getFicha(companyId, fichaId, db)
    if (!g) throw new ConflitoDeGrafiaError('Ficha do conflito não encontrada.')
    const cabeca = await db.stockFicha.findFirst({ where: { id: fichaId, companyId }, select: { atualizadoEm: true, itemProduzidoId: true } })
    const datas = [cabeca!.atualizadoEm.toISOString(), ...g.versoes.map((v) => v.criadoEm)].sort()

    const todasAsGrafias = mapa.filter((m) => m.fichaId === fichaId).map((m) => m.nomeSuitable)
    const grafias = todasAsGrafias.filter((n) => canonicoDaGrafia(n) === canonico)
    const outrasGrafias = todasAsGrafias.filter((n) => canonicoDaGrafia(n) !== canonico)

    const [comp, bases, ordens, usos, vendas] = await Promise.all([
      db.stockVendaComplementoMap.findMany({ where: { companyId, fichaId }, select: { nomeSuitable: true } }),
      db.stockBaseDoTamanho.findMany({ where: { companyId, fichaId }, select: { tamanho: true } }),
      db.stockProductionOrder.count({ where: { companyId, fichaId, estado: { in: ORDEM_ABERTA } } }),
      db.stockFichaComponente.findMany({ where: { companyId, itemId: cabeca!.itemProduzidoId }, select: { versaoId: true } }),
      db.stockVendaLinha.findMany({
        where: { companyId, nomeSuitable: { in: todasAsGrafias }, data: { gte: desde } },
        select: { quantidade: true, data: true },
      }),
    ])
    // ⚠️ só conta a ficha ATIVA cuja VERSÃO ATUAL usa esta — versão velha não consome mais
    const versoes = usos.length
      ? await db.stockFichaVersao.findMany({ where: { companyId, id: { in: usos.map((u) => u.versaoId) } }, select: { fichaId: true, versao: true } })
      : []
    const pais = versoes.length
      ? await db.stockFicha.findMany({ where: { companyId, id: { in: versoes.map((v) => v.fichaId) }, ativo: true }, select: { id: true, versaoAtual: true, itemProduzidoId: true } })
      : []
    const paisAtuais = pais.filter((p) => versoes.some((v) => v.fichaId === p.id && v.versao === p.versaoAtual))
    const nomesPais = paisAtuais.length
      ? (await db.stockItem.findMany({ where: { companyId, id: { in: paisAtuais.map((p) => p.itemProduzidoId) } }, select: { nome: true } })).map((i) => i.nome)
      : []

    const consumidores: ConsumidoresDeFora = {
      outrasGrafias,
      complementos: comp.map((c) => c.nomeSuitable),
      basesDeTamanho: bases.map((b) => b.tamanho),
      emOutrasFichas: nomesPais,
      ordensAbertas: ordens,
    }
    const ultimo = vendas.map((v) => v.data.toISOString().slice(0, 10)).sort().pop() ?? null
    fichas.push({
      fichaId,
      nome: g.ficha.nomeProduzido,
      ativo: g.ficha.ativo,
      ingredientes: g.ficha.componentes.length,
      componentes: g.ficha.componentes.map((c) => ({ itemId: c.itemId, nome: c.nome, qtdPlanejada: c.qtdPlanejada, unidade: c.unidade, custoMedio: c.custoMedio })),
      custoLote: g.ficha.custoLote,
      ultimaEdicao: datas[datas.length - 1],
      grafias,
      vendasRecentes: { unidades: vendas.reduce((s, v) => s + v.quantidade, 0), ultimoDia: ultimo },
      consumidores,
      inativarSemAviso: semConsumidores(consumidores),
    })
  }
  // ⭐ o diff vem da MESMA leitura que desenha os cards (um custo só, nunca dois)
  const diff = fichas.length === 2 ? diffDeFichas(fichas[0], fichas[1]) : null
  return { nome, canonico, fichas, diff }
}

export interface EscolhaDoConflito {
  fichaEscolhidaId: string
  /** fichas perdedoras que o dono pediu pra inativar */
  inativar: string[]
  /**
   * ⛔ inativar uma perdedora que AINDA tem consumidor de fora só passa com este `true` — o
   * dono viu o aviso e desmarcou-remarcou de propósito. Sem ele, a porta recusa.
   */
  inativarMesmoComConsumidores?: boolean
}

export interface ResultadoDaEscolha {
  movidas: { nomeSuitable: string; de: string }[]
  inativadas: string[]
}

/**
 * ⭐⭐ O GESTO DO DONO. Lê o comparador DE NOVO (o mundo pode ter mudado desde a tela) e só
 * então move as grafias.
 *
 * ⚠️ Não é uma `$transaction`: a porta do mapa (`upsertVendaMap`) declara que não roda dentro
 * de uma (o caminho de revenda abre a sua). O gesto é IDEMPOTENTE — repetir a escolha move
 * o que faltou e não desfaz nada — então uma falha no meio deixa, no pior caso, o conflito
 * ainda aberto, e o 2º clique termina.
 */
export async function escolherFichaDoConflito(
  companyId: string,
  nome: string,
  escolha: EscolhaDoConflito,
  userId: string | null,
  db: PrismaClient = defaultPrisma,
): Promise<ResultadoDaEscolha> {
  const comp = await lerComparadorDoConflito(companyId, nome, db)
  if (!comp) throw new ConflitoDeGrafiaError('Este nome não está mais em conflito.')
  const vencedora = comp.fichas.find((f) => f.fichaId === escolha.fichaEscolhidaId)
  if (!vencedora) throw new ConflitoDeGrafiaError('A ficha escolhida não é uma das fichas do conflito.')
  if (!vencedora.ativo) throw new ConflitoDeGrafiaError('A ficha escolhida está inativa.')
  const perdedoras = comp.fichas.filter((f) => f.fichaId !== vencedora.fichaId)
  for (const id of escolha.inativar) {
    const p = perdedoras.find((f) => f.fichaId === id)
    if (!p) throw new ConflitoDeGrafiaError('Só se inativa uma ficha perdedora deste conflito.')
    if (!p.inativarSemAviso && !escolha.inativarMesmoComConsumidores) {
      throw new ConflitoDeGrafiaError(`A ficha ${p.nome} ainda é usada (${avisoDosConsumidores(p.consumidores).join('; ')}).`)
    }
  }

  // ⭐ TODAS as grafias irmãs → a escolhida, pela porta única do mapa
  const movidas: ResultadoDaEscolha['movidas'] = []
  for (const p of perdedoras) {
    for (const g of p.grafias) {
      await upsertVendaMap(companyId, g, { tipo: 'FICHA', fichaId: vencedora.fichaId }, userId ?? undefined, db)
      movidas.push({ nomeSuitable: g, de: p.fichaId })
    }
  }
  // ⭐ inativar pela porta da ficha (a mesma do botão "desativar" do editor)
  for (const id of escolha.inativar) {
    await atualizarFicha(companyId, id, { ativo: false, userId: userId ?? undefined }, db)
  }

  // ⭐ auditoria: quem, quando, o que mudou
  const u = userId ? await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : null
  await db.auditLog.create({
    data: {
      companyId,
      userId: u ? userId : null,
      userName: u?.name ?? '(desconhecido)',
      userEmail: u?.email ?? '',
      action: 'RESOLVE_CONFLICT',
      entityType: 'StockVendaProdutoMap',
      entityId: comp.canonico,
      metadata: JSON.stringify({ nome, fichaEscolhida: { id: vencedora.fichaId, nome: vencedora.nome }, movidas, inativadas: escolha.inativar }),
    },
  })
  return { movidas, inativadas: escolha.inativar }
}
