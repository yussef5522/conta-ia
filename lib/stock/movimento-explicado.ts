// ⭐⭐⭐ O QUE É ESTA LINHA DO LEDGER, QUEM FEZ E DE ONDE VEIO (08/09/2026) — dono único.
//
// **O CASO DO DONO:** *"A tela 'Histórico de compras' mistura tudo e mente no rótulo: linhas
// NEGATIVAS (consumo!) aparecem como 'recibo' de compra, entradas grandes sem dizer se foi
// contagem/ajuste/estorno, e NADA diz quem fez."*
//
// **MEDIDO NO BACON, em prod, antes de qualquer linha de código:** das **19 linhas** da tela
// de "compras", **16 NÃO eram compra** e **14 eram NEGATIVAS** — consumo de produção e
// separação, exibidos numa tabela com coluna *"Preço un."*. O `buildFichaItem` fazia
// `findMany` **sem filtro de tipo** e jogava o ledger inteiro num campo chamado `compras`.
//
// ⛔⛔ **E O LINK ESTAVA QUEBRADO EM 84% DAS LINHAS.** O `receiptId` é **polimórfico** — ele
// aponta pra conferência, ordem de produção, sessão de contagem, import de venda ou entrada
// manual, e **quem desambigua é o `tipo`** (decisão de 21/08: não dava pra ter colunas
// próprias, o isolamento do módulo proíbe ALTER em `stock_movement`). A tela ignorava isso e
// mandava **tudo** pra `/estoque/recibos/{receiptId}`. O par ±222 do BACON, que é CONTAGEM,
// linkava pra um recibo de conferência com o id de uma sessão de contagem.
//
// ⛔ **A MESMA MENTIRA VIVIA NO EXTRATO** (`lib/stock/movimentos.ts`): lá o `referencia`
// colapsava **tudo** que não tinha nota em `label: 'conferência'`. Duas telas, a mesma
// pergunta, duas respostas erradas — a lição do B1. Por isso este arquivo é um **dono único**
// e as duas telas o consomem, em vez de eu consertar a que o dono viu.
//
// ⚠️ **A ROTA DE DESTINO MORA AQUI**, e não em cada tela: se cada uma montasse a própria URL,
// a próxima divergiria no primeiro tipo novo — que é exatamente como o `/recibos/` acabou
// valendo pra contagem.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export type FamiliaMovimento = 'COMPRA' | 'CONTAGEM' | 'PRODUCAO' | 'VENDA' | 'SAIDA' | 'ESTORNO' | 'OUTRO'
/** ⭐ o sinal do dinheiro na prateleira — não o sinal cru da quantidade */
export type SentidoMovimento = 'ENTROU' | 'SAIU' | 'AJUSTE'

export interface FaceDoTipo {
  /** o rótulo do chip: o TIPO REAL, com a cara do movimento */
  chip: string
  familia: FamiliaMovimento
  sentido: SentidoMovimento
  /**
   * ⛔⛔ O PREÇO DESTA LINHA É PREÇO DE COMPRA?
   *
   * Só na COMPRA o `custoUnitario` é o que o fornecedor cobrou. Numa baixa ele é o **custo
   * médio do estoque no instante** — exibi-lo sob o rótulo "Preço un." faz o dono comparar
   * preço de fornecedor contra uma média interna e concluir besteira sobre a negociação.
   */
  precoEhDeCompra: boolean
}

/**
 * ⭐ A TABELA DOS TIPOS — pura, sem banco, e é ela que os testes travam.
 *
 * ⚠️ Tipo desconhecido **não vira "recibo" nem some**: aparece com o próprio nome cru e
 * família `OUTRO`. Foi o fallback silencioso que produziu o defeito original — melhor uma
 * linha feia e honesta que uma linha bonita e errada.
 */
export const FACE_DO_TIPO: Record<string, FaceDoTipo> = {
  ENTRADA_NF:         { chip: 'Compra (NF-e)',          familia: 'COMPRA',    sentido: 'ENTROU', precoEhDeCompra: true },
  ENTRADA_MANUAL:     { chip: 'Compra sem nota',        familia: 'COMPRA',    sentido: 'ENTROU', precoEhDeCompra: true },
  AJUSTE_CONTAGEM:    { chip: 'Contagem',               familia: 'CONTAGEM',  sentido: 'AJUSTE', precoEhDeCompra: false },
  PRODUCAO_GERACAO:   { chip: 'Produção · gerou',       familia: 'PRODUCAO',  sentido: 'ENTROU', precoEhDeCompra: false },
  PRODUCAO_CONSUMO:   { chip: 'Produção · consumiu',    familia: 'PRODUCAO',  sentido: 'SAIU',   precoEhDeCompra: false },
  SEPARACAO_SAIDA:    { chip: 'Separação',              familia: 'PRODUCAO',  sentido: 'SAIU',   precoEhDeCompra: false },
  DEVOLUCAO_PRODUCAO: { chip: 'Devolveu da produção',   familia: 'PRODUCAO',  sentido: 'ENTROU', precoEhDeCompra: false },
  BAIXA_VENDA:        { chip: 'Baixa de venda',         familia: 'VENDA',     sentido: 'SAIU',   precoEhDeCompra: false },
  PERDA:              { chip: 'Perda',                  familia: 'SAIDA',     sentido: 'SAIU',   precoEhDeCompra: false },
  USO_INTERNO:        { chip: 'Uso interno',            familia: 'SAIDA',     sentido: 'SAIU',   precoEhDeCompra: false },
  ESTORNO:            { chip: 'Estorno',                familia: 'ESTORNO',   sentido: 'AJUSTE', precoEhDeCompra: false },
}

export function faceDoTipo(tipo: string): FaceDoTipo {
  return FACE_DO_TIPO[tipo] ?? { chip: tipo, familia: 'OUTRO', sentido: 'AJUSTE', precoEhDeCompra: false }
}

/** ⭐ o rótulo da coluna de preço, que muda com a natureza da linha */
export function rotuloDoPreco(face: FaceDoTipo): string {
  return face.precoEhDeCompra ? 'Preço un.' : 'Custo médio un.'
}

export interface LinhaDoHistorico {
  movimentoId: string
  data: string
  tipo: string
  chip: string
  familia: FamiliaMovimento
  sentido: SentidoMovimento
  quantidade: number
  custoUnitario: number
  custoTotal: number
  /** ⭐ "Preço un." só na compra — na baixa é custo médio, e a tela DIZ isso */
  precoRotulo: string
  precoEhDeCompra: boolean
  /** de onde veio, em uma linha: "NF nº 1234 · Frigorífico Silva" */
  detalhe: string
  /** ⭐ o autor do gesto — o rastro já existia em `criadoPorId`, ninguém o mostrava */
  quem: string | null
  /** ⭐ clico e chego na fonte. `null` quando o tipo não tem tela própria */
  href: string | null
  /** entra na aba "só compras" (comparar preço de fornecedor) */
  ehCompra: boolean
  /** ⭐ ESTORNO diz o que estornou */
  estornoDe: { movimentoId: string; tipo: string; chip: string; data: string } | null
}

const nNFdaChave = (chave: string | null) => (chave && chave.length === 44 ? String(Number(chave.slice(25, 34))) : null)
const dia = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** o mínimo que o resolvedor precisa de cada movimento */
export interface MovimentoCru {
  id: string
  tipo: string
  quantidade: number
  custoUnitario: number
  custoTotal: number
  nfeChave: string | null
  receiptId: string | null
  estornoDeId: string | null
  dataMovimento: Date
  criadoPorId: string | null
  origem: string
}

/**
 * ⭐⭐ RESOLVE O LOTE INTEIRO — nome do autor, origem e link, em consultas agrupadas.
 *
 * ⚠️ Recebe os movimentos já lidos: o `where` de cada tela é diferente (um item, um período,
 * um tipo) e só a EXPLICAÇÃO é comum. Fazer a query aqui obrigaria a um canivete de filtros.
 */
export async function explicarMovimentos(
  companyId: string,
  movs: MovimentoCru[],
  db: Db = defaultPrisma,
): Promise<LinhaDoHistorico[]> {
  if (!movs.length) return []

  const porFamilia = (f: FamiliaMovimento) => movs.filter((m) => faceDoTipo(m.tipo).familia === f)
  const refs = (ms: MovimentoCru[]) => [...new Set(ms.map((m) => m.receiptId).filter((x): x is string => !!x))]

  // ⚠️ o ESTORNO herda `receiptId`/`nfeChave` do original (ver `estornarMovimento`), então
  // ele precisa entrar nas MESMAS buscas de origem — senão o estorno de uma compra ficaria
  // sem fornecedor e sem link, justo na linha que corrige dinheiro.
  const idsEstornados = [...new Set(movs.map((m) => m.estornoDeId).filter((x): x is string => !!x))]
  const originais = idsEstornados.length
    ? await db.stockMovement.findMany({
        where: { companyId, id: { in: idsEstornados } },
        select: { id: true, tipo: true, dataMovimento: true, receiptId: true, nfeChave: true },
      })
    : []
  const origPorId = new Map(originais.map((o) => [o.id, o]))
  /** a face que o ESTORNO deve herdar pra achar a origem certa */
  const tipoEfetivo = (m: MovimentoCru) =>
    m.tipo === 'ESTORNO' && m.estornoDeId ? origPorId.get(m.estornoDeId)?.tipo ?? m.tipo : m.tipo
  const familiaEfetiva = (m: MovimentoCru) => faceDoTipo(tipoEfetivo(m)).familia
  const porFamiliaEf = (f: FamiliaMovimento) => movs.filter((m) => familiaEfetiva(m) === f)

  const chaves = [...new Set(movs.map((m) => m.nfeChave).filter((c): c is string => !!c))]
  const userIds = [...new Set(movs.map((m) => m.criadoPorId).filter((u): u is string => !!u))]
  const idsMov = movs.map((m) => m.id)

  const [notas, users, ordens, contagens, contItens, imports, entradas, saidas] = await Promise.all([
    chaves.length ? db.stockNfe.findMany({ where: { companyId, chave: { in: chaves } }, select: { id: true, chave: true, emitNome: true } }) : Promise.resolve([]),
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : Promise.resolve([]),
    refs(porFamiliaEf('PRODUCAO')).length
      ? db.stockProductionOrder.findMany({ where: { companyId, id: { in: refs(porFamiliaEf('PRODUCAO')) } }, select: { id: true, dataProducao: true, itemProduzidoId: true } })
      : Promise.resolve([]),
    refs(porFamiliaEf('CONTAGEM')).length
      ? db.stockContagem.findMany({ where: { companyId, id: { in: refs(porFamiliaEf('CONTAGEM')) } }, select: { id: true, tipo: true, iniciadaEm: true } })
      : Promise.resolve([]),
    // ⭐ "quem contou" mora na LINHA da contagem (desnormalizado de propósito) e é mais
    // preciso que o autor do movimento: numa sessão longa, quem conta pode não ser quem abriu.
    db.stockContagemItem.findMany({ where: { companyId, movementId: { in: idsMov } }, select: { movementId: true, contadoPorNome: true } }),
    refs(porFamiliaEf('VENDA')).length
      ? db.stockVendaImport.findMany({ where: { companyId, id: { in: refs(porFamiliaEf('VENDA')) } }, select: { id: true, data: true } })
      : Promise.resolve([]),
    refs(porFamiliaEf('COMPRA')).length
      ? db.stockEntradaManual.findMany({ where: { companyId, id: { in: refs(porFamiliaEf('COMPRA')) } }, select: { id: true, fornecedorNome: true, data: true } })
      : Promise.resolve([]),
    // ⚠️ PERDA/USO_INTERNO amarram ao contrário: a saída é que guarda o `movementId`
    db.stockSaida.findMany({ where: { companyId, movementId: { in: idsMov } }, select: { movementId: true, motivo: true, motivoTexto: true } }),
  ])

  const itemIdsProduzidos = [...new Set(ordens.map((o) => o.itemProduzidoId))]
  const itensProduzidos = itemIdsProduzidos.length
    ? await db.stockItem.findMany({ where: { companyId, id: { in: itemIdsProduzidos } }, select: { id: true, nome: true } })
    : []

  const notaPorChave = new Map(notas.map((n) => [n.chave, n]))
  const nomeUser = new Map(users.map((u) => [u.id, (u.name || u.email || '').trim() || null]))
  const ordemPorId = new Map(ordens.map((o) => [o.id, o]))
  const nomeProduzido = new Map(itensProduzidos.map((i) => [i.id, i.nome]))
  const contagemPorId = new Map(contagens.map((c) => [c.id, c]))
  const contouPorMov = new Map(contItens.map((c) => [c.movementId!, c.contadoPorNome]))
  const importPorId = new Map(imports.map((i) => [i.id, i]))
  const entradaPorId = new Map(entradas.map((e) => [e.id, e]))
  const saidaPorMov = new Map(saidas.map((s) => [s.movementId, s]))

  const linkDe = (m: MovimentoCru): string | null => {
    const ref = m.receiptId ?? origPorId.get(m.estornoDeId ?? '')?.receiptId ?? null
    switch (familiaEfetiva(m)) {
      case 'COMPRA':
        if (!ref) return null
        // ⚠️ compra COM nota abre o recibo da conferência; sem nota abre a entrada manual —
        // são telas diferentes, e mandar uma pra outra é o defeito que este arquivo cura.
        return entradaPorId.has(ref)
          ? `/empresas/${companyId}/estoque/entradas/${ref}`
          : `/empresas/${companyId}/estoque/recibos/${ref}`
      case 'PRODUCAO':
        return ref ? `/empresas/${companyId}/estoque/producao/${ref}` : null
      case 'CONTAGEM':
        // ⚠️ não existe página POR SESSÃO; a âncora leva à linha dela na lista
        return ref ? `/empresas/${companyId}/estoque/contagens#c-${ref}` : null
      case 'VENDA': {
        const imp = ref ? importPorId.get(ref) : null
        return imp ? `/empresas/${companyId}/estoque/vendas?aba=processados#dia-${iso(imp.data)}` : null
      }
      case 'SAIDA':
        return `/empresas/${companyId}/estoque/perdas`
      default:
        return null
    }
  }

  const detalheDe = (m: MovimentoCru): string => {
    const ref = m.receiptId ?? origPorId.get(m.estornoDeId ?? '')?.receiptId ?? null
    const chave = m.nfeChave ?? origPorId.get(m.estornoDeId ?? '')?.nfeChave ?? null
    switch (familiaEfetiva(m)) {
      case 'COMPRA': {
        const ent = ref ? entradaPorId.get(ref) : null
        if (ent) return `sem nota · ${ent.fornecedorNome}`
        const nota = chave ? notaPorChave.get(chave) : null
        const n = nNFdaChave(chave)
        return nota?.emitNome ? `NF nº ${n ?? '—'} · ${nota.emitNome}` : n ? `NF nº ${n}` : 'compra'
      }
      case 'PRODUCAO': {
        const o = ref ? ordemPorId.get(ref) : null
        if (!o) return 'ordem de produção'
        const nome = nomeProduzido.get(o.itemProduzidoId)
        return `ordem de ${dia(o.dataProducao)}${nome ? ` · ${nome}` : ''}`
      }
      case 'CONTAGEM': {
        const c = ref ? contagemPorId.get(ref) : null
        return c ? `contagem de ${dia(c.iniciadaEm)} · ${c.tipo === 'INICIAL' ? 'inicial' : 'rotina'}` : 'contagem'
      }
      case 'VENDA': {
        const imp = ref ? importPorId.get(ref) : null
        return imp ? `vendas de ${dia(imp.data)}` : 'baixa de venda'
      }
      case 'SAIDA': {
        const s = saidaPorMov.get(m.id)
        if (!s) return 'saída'
        const motivo = s.motivo === 'OUTRO' && s.motivoTexto ? s.motivoTexto : s.motivo.toLowerCase().replace(/_/g, ' ')
        return `motivo: ${motivo}`
      }
      default:
        return '—'
    }
  }

  return movs.map((m) => {
    const face = faceDoTipo(m.tipo)
    const orig = m.estornoDeId ? origPorId.get(m.estornoDeId) : null
    // ⭐ "quem contou" ganha do autor do movimento na contagem; nos demais, o autor do gesto.
    // ⚠️ E quando ninguém assinou, mostra a ORIGEM ('SEFAZ'/'MANUAL') em vez de inventar nome
    // — foi assim que o extrato já fazia, e é honesto: diz de onde veio, não quem foi.
    const quem = contouPorMov.get(m.id)
      ?? (m.criadoPorId ? nomeUser.get(m.criadoPorId) ?? null : null)
      ?? null
    return {
      movimentoId: m.id,
      data: m.dataMovimento.toISOString(),
      tipo: m.tipo,
      chip: face.chip,
      familia: face.familia,
      sentido: m.tipo === 'ESTORNO' ? 'AJUSTE' : face.sentido,
      quantidade: m.quantidade,
      custoUnitario: m.custoUnitario,
      custoTotal: m.custoTotal,
      precoRotulo: rotuloDoPreco(face),
      precoEhDeCompra: face.precoEhDeCompra,
      detalhe: detalheDe(m),
      quem,
      href: linkDe(m),
      // ⭐ o estorno de uma COMPRA continua sendo assunto de compra (ele cancela um preço),
      // então entra na aba "só compras" junto com o que ele corrige.
      ehCompra: face.familia === 'COMPRA' || (m.tipo === 'ESTORNO' && familiaEfetiva(m) === 'COMPRA'),
      estornoDe: orig
        ? { movimentoId: orig.id, tipo: orig.tipo, chip: faceDoTipo(orig.tipo).chip, data: orig.dataMovimento.toISOString() }
        : null,
    }
  })
}

/** os tipos presentes num lote — alimenta o filtro da tela sem inventar opção vazia */
export function tiposPresentes(linhas: LinhaDoHistorico[]): { tipo: string; chip: string; n: number }[] {
  const m = new Map<string, { tipo: string; chip: string; n: number }>()
  for (const l of linhas) {
    const cur = m.get(l.tipo)
    if (cur) cur.n++
    else m.set(l.tipo, { tipo: l.tipo, chip: l.chip, n: 1 })
  }
  return [...m.values()].sort((a, b) => b.n - a.n)
}
