// ⭐⭐ A BANCADA DE VÍNCULOS — lei docs/bancada-referencia.html (v1 APROVADA, R32–R35, 19/11/2026).
//
// R32 — UMA FILA SÓ: produtos sem vínculo + complementos sem ficha, na MESMA lista (antes moravam em abas
//       separadas). As abas Produtos e Complementos continuam sendo o catálogo; a Bancada é a fila.
// R33 — O VAZAMENTO NA CARA: R$ vendidos sem baixar em 30 dias, ~custo/dia ESTIMADO (razão custo/faturamento
//       do que baixa) e N na fila. ⛔ O placar é SEMPRE derivado das linhas (`placarDe`) — nunca guardado à
//       parte: é isso que faz cada ligação descontar na hora.
// R34 — ORDENADO PELO DINHEIRO: maior R$ primeiro; R$ 0 (incluso no preço) ordena por ocorrências.
// R35 — AÇÕES HERDADAS (as MESMAS gravações das abas): apontar ficha · criar ficha · ignorar · desfazer.
//       A sugestão é clicável e NUNCA liga sozinha: esta leitura não grava nada.
//
// ⭐ A RÉGUA DO "SEM VÍNCULO" É A DA BAIXA (porta única): produto pelo `resolvedorDeGrafia` + `mapaQueDecide`
// (grafia exata ou irmã canônica) e pelo ignorado do dono (`stock_venda_ignorado`); complemento pela
// `prateleiraDeComplementos` (mapa exato). Se a Bancada dissesse "pendente" e a baixa baixasse (ou o
// contrário), o placar mentiria.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { resolvedorDeGrafia, mapaQueDecide, sugestoesDeTamanho } from '../vendas/grafia-canonica'
import { prateleiraDeComplementos } from '../vendas/complemento-map'
import { sugerirGruposDeGrafia } from '../vendas/sugerir-grupos'
import { normalizarNome } from '../vendas/grupo-complemento'
import { saoParecidos } from '../itens/fila-de-gemeos'

export * from './bancada-regras'
import { DIAS_DA_BANCADA, ordenarFila, dicaDeCasca, type LinhaDaBancada, type EstadoNaBancada, type SugestaoDaBancada, type Bancada } from './bancada-regras'

// ─────────────────────────────── a LEITURA (não grava nada) ───────────────────────────────

interface FichaParaSugestao { id: string; nome: string; tipoProduto: string; apelidos: string[] }

/** ⭐ ficha de nome igual sob a régua (ou apelido), e depois parecida — a candidata da sugestão */
function fichaCandidata(nome: string, fichas: readonly FichaParaSugestao[]): SugestaoDaBancada | null {
  const k = reguaDoNome(nome)
  if (!k) return null
  for (const f of fichas) if (reguaDoNome(f.nome) === k) return { fichaId: f.id, nomeFicha: f.nome, motivo: 'mesmo nome' }
  for (const f of fichas) if (f.apelidos.some((a) => reguaDoNome(a) === k)) return { fichaId: f.id, nomeFicha: f.nome, motivo: 'apelido' }
  for (const f of fichas) if (saoParecidos(k, reguaDoNome(f.nome))) return { fichaId: f.id, nomeFicha: f.nome, motivo: 'parecido' }
  return null
}

const diaIso = (d: Date) => d.toISOString().slice(0, 10)

export async function bancadaDeVinculos(companyId: string, db: PrismaClient = defaultPrisma, agora = new Date()): Promise<Bancada> {
  const desde = new Date(agora.getTime() - DIAS_DA_BANCADA * 86_400_000)
  const [linhasP, linhasC, mapaP, ignoradosP, fichas] = await Promise.all([
    db.stockVendaLinha.findMany({ where: { companyId, data: { gte: desde } }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } }),
    db.stockVendaComplementoLinha.findMany({ where: { companyId, data: { gte: desde } }, select: { nomeSuitable: true, ocorrencias: true, valorTotal: true } }),
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    db.stockVendaIgnorado.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, itemProduzidoId: true, tipoProduto: true } }),
  ])
  const itensDasFichas = await db.stockItem.findMany({ where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } }, select: { id: true, nome: true } })
  const apelidos = await db.stockItemNomeAnterior.findMany({ where: { companyId, itemId: { in: fichas.map((f) => f.itemProduzidoId) } }, select: { itemId: true, nomeAnterior: true } })
  const nomeItem = new Map(itensDasFichas.map((i) => [i.id, i.nome]))
  const todasFichas: FichaParaSugestao[] = fichas.map((f) => ({
    id: f.id, nome: nomeItem.get(f.itemProduzidoId) ?? '(ficha)', tipoProduto: f.tipoProduto,
    apelidos: apelidos.filter((a) => a.itemId === f.itemProduzidoId).map((a) => a.nomeAnterior),
  }))
  const nomeDaFicha = new Map(todasFichas.map((f) => [f.id, f.nome]))
  // ⛔ produto só liga em PRODUTO_FINAL (o guard dos 3 níveis do `upsertVendaMap`)
  const fichasDeProduto = todasFichas.filter((f) => f.tipoProduto === 'PRODUTO_FINAL')

  // ── complementos: a prateleira oficial
  const aggC = new Map<string, { qt: number; rs: number }>()
  for (const l of linhasC) { const c = aggC.get(l.nomeSuitable) ?? { qt: 0, rs: 0 }; c.qt += l.ocorrencias; c.rs += l.valorTotal ?? 0; aggC.set(l.nomeSuitable, c) }
  const prat = await prateleiraDeComplementos(companyId, [...aggC].map(([nomeSuitable, x]) => ({ nomeSuitable, ocorrencias: x.qt })), db)
  const comFicha = prat.filter((p) => p.destino === 'FICHA' && p.fichaId)
  const jaMapeadas = comFicha.map((p) => ({ nomeSuitable: p.nomeSuitable, fichaId: p.fichaId!, nomeFicha: p.nomeFicha ?? p.nomeSuitable }))
  const pendC = prat.filter((p) => p.destino === 'SEM_FICHA').map((p) => ({ nomeSuitable: p.nomeSuitable, ocorrencias: p.ocorrencias }))
  const grupos = new Map(sugerirGruposDeGrafia(pendC, jaMapeadas).map((g) => [g.chave, g]))
  const tamanhos = new Map(sugestoesDeTamanho(pendC, jaMapeadas).map((t) => [t.nomeSuitable, t]))
  const sugestaoDoComplemento = (nome: string): SugestaoDaBancada | null => {
    const g = grupos.get(normalizarNome(nome))
    if (g?.fichaIrma) return { fichaId: g.fichaIrma.fichaId, nomeFicha: g.fichaIrma.nomeFicha, motivo: `grafia irmã “${g.fichaIrma.viaGrafia}”` }
    const t = tamanhos.get(nome)
    if (t) return { fichaId: t.fichaId, nomeFicha: t.nomeFicha, motivo: 'tamanho/promo' }
    const p = g?.parecidasComFicha[0]
    if (p) return { fichaId: p.fichaId, nomeFicha: p.nomeFicha, motivo: p.motivo }
    return fichaCandidata(nome, todasFichas)
  }

  const linhas: LinhaDaBancada[] = []
  for (const p of prat) {
    const a = aggC.get(p.nomeSuitable)
    if (!a || a.qt <= 0) continue
    const estado: EstadoNaBancada = p.destino === 'SEM_FICHA' ? 'PENDENTE' : p.destino === 'IGNORAR' ? 'IGNORADO' : 'RESOLVIDO'
    linhas.push({
      chave: `C:${p.nomeSuitable}`, tipo: 'COMPLEMENTO', nome: p.nomeSuitable, qt: a.qt, rs: Math.round(a.rs * 100) / 100, estado,
      fichaId: estado === 'RESOLVIDO' ? p.fichaId : null, nomeFicha: estado === 'RESOLVIDO' ? p.nomeFicha : null,
      sugestao: estado === 'PENDENTE' ? sugestaoDoComplemento(p.nomeSuitable) : null, casca: null,
    })
  }

  // ── produtos: a régua da baixa
  const resolver = resolvedorDeGrafia(mapaP)
  const ignorado = new Set(ignoradosP.map((i) => i.nomeSuitable))
  const aggP = new Map<string, { qt: number; rs: number }>()
  for (const l of linhasP) { const c = aggP.get(l.nomeSuitable) ?? { qt: 0, rs: 0 }; c.qt += l.quantidade; c.rs += l.valorTotal ?? 0; aggP.set(l.nomeSuitable, c) }
  const nomesComFicha = comFicha.map((p) => p.nomeSuitable)
  for (const [nome, a] of aggP) {
    if (a.qt <= 0) continue
    const m = ignorado.has(nome) ? null : mapaQueDecide(resolver(nome))
    const estado: EstadoNaBancada = ignorado.has(nome) || m?.alvoTipo === 'IGNORAR' ? 'IGNORADO' : m ? 'RESOLVIDO' : 'PENDENTE'
    const fichaId = estado === 'RESOLVIDO' ? m?.fichaId ?? null : null
    linhas.push({
      chave: `P:${nome}`, tipo: 'PRODUTO', nome, qt: a.qt, rs: Math.round(a.rs * 100) / 100, estado,
      fichaId, nomeFicha: fichaId ? nomeDaFicha.get(fichaId) ?? null : null,
      sugestao: estado === 'PENDENTE' ? fichaCandidata(nome, fichasDeProduto) : null,
      casca: estado === 'PENDENTE' ? dicaDeCasca(nome, nomesComFicha) : null,
    })
  }

  // ── a razão custo/faturamento do que BAIXA (a base da estimativa)
  const bx = await db.stockMovement.findMany({ where: { companyId, tipo: 'BAIXA_VENDA', dataMovimento: { gte: desde } }, select: { id: true, custoTotal: true } })
  const estornadas = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: bx.map((b) => b.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
  const custoBaixado = Math.round(-bx.filter((b) => !estornadas.has(b.id)).reduce((s, b) => s + (b.custoTotal ?? 0), 0) * 100) / 100
  const faturamentoQueBaixa = Math.round(linhas.filter((l) => l.estado === 'RESOLVIDO').reduce((s, l) => s + l.rs, 0) * 100) / 100
  const razao = faturamentoQueBaixa > 0 ? custoBaixado / faturamentoQueBaixa : null

  return { linhas: ordenarFila(linhas), razao: { custoBaixado, faturamentoQueBaixa, razao }, periodo: { de: diaIso(desde), ate: diaIso(agora), dias: DIAS_DA_BANCADA } }
}
