// ESTOQUE FASE 2 item 2.4 — SUGESTÃO de produção (min/max). Olha itens PRODUZIDOS (têm
// ficha) com saldo < mínimo e propõe "produzir ~N pra voltar ao máximo" (o "Sugestão de
// Produção" do Vuca). Só LÊ.
//
// ⚠️ O CARDÁPIO/MARGEM SAIU DAQUI (27/08) → `lib/stock/cardapio/hub.ts`. Motivo: aquela
// versão calculava o custo do produto pelo `custoMedio` do item PRODUZIDO, que só existe
// depois de uma produção em lote — produto montado na venda (xis, combo) ficava sem custo
// pra sempre. O hub calcula pela MESMA explosão que a venda usa pra baixar o estoque
// (REGRA 4). Manter as duas seria ter dois custos pro mesmo produto.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem, saldosDaEmpresa } from '../saldo'
import { calcularMargem } from './custo-teorico'
import { rendimentoMedioDaFicha } from './conclusao'
import { escalaDoPedido } from './escala-da-ordem'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface SugestaoProducao {
  fichaId: string
  itemProduzidoId: string
  nome: string
  unidade: string
  saldo: number
  estoqueMin: number
  estoqueMax: number | null
  faltam: number // (max ?? min) − saldo, em unidades do produto
  /**
   * ⛔⛔ `faltam ÷ loteBase` — **pela FICHA, nunca pelo rendimento medido** (decisão do dono,
   * 03/10: *"receita é lei, rendimento é só relatório"*).
   *
   * ⚠️⚠️ **ESTA ERA A SEGUNDA PORTA, e ela gravava separação torta sem passar por tela nenhuma:**
   * era `faltam ÷ rendimentoMedio`, e o botão "criar ordem" do painel manda este número direto
   * como `escalaReceitas`. Consertar só a tela de criar ordem teria deixado o defeito vivo pelo
   * caminho do min/máx — é a REGRA 4 (*achar TODAS as cópias da decisão*) cobrando no mesmo dia.
   */
  escalaSugerida: number | null
  /** ⭐ ESPELHO — só pra tela dizer quanto a cozinha vem rendendo. Fora da conta. */
  rendimentoMedio: number | null
}

/** Itens produzidos (com ficha ATIVA) cujo saldo caiu abaixo do mínimo. */
export async function sugestoesDeProducao(companyId: string, db: PrismaClient = defaultPrisma): Promise<SugestaoProducao[]> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, itemProduzidoId: true, versaoAtual: true } })
  if (!fichas.length) return []
  const produzidoIds = fichas.map((f) => f.itemProduzidoId)
  const [itens, saldos, versoes] = await Promise.all([
    db.stockItem.findMany({ where: { companyId, id: { in: produzidoIds } }, select: { id: true, nome: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } }),
    saldosDaEmpresa(db, companyId),
    // ⭐ o `loteBase` da versão VIGENTE de cada ficha — é ele que divide o pedido agora
    db.stockFichaVersao.findMany({
      where: { companyId, fichaId: { in: fichas.map((f) => f.id) } },
      select: { fichaId: true, versao: true, loteBase: true },
    }),
  ])
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  const metaDe = new Map(itens.map((i) => [i.id, i]))
  const loteDe = new Map(versoes.map((v) => [`${v.fichaId}#${v.versao}`, v.loteBase]))

  const out: SugestaoProducao[] = []
  for (const f of fichas) {
    const it = metaDe.get(f.itemProduzidoId)
    if (!it || it.estoqueMin == null) continue // sem mínimo definido → sem sugestão
    const saldo = saldoDe.get(f.itemProduzidoId) ?? 0
    if (saldo >= it.estoqueMin) continue // acima do mínimo → ok
    const alvo = it.estoqueMax ?? it.estoqueMin
    const faltam = round2(alvo - saldo)
    if (faltam <= 0) continue
    const rendimentoMedio = await rendimentoMedioDaFicha(companyId, f.id, db)
    const loteBase = loteDe.get(`${f.id}#${f.versaoAtual}`) ?? null
    /** ⛔ `escalaDoPedido` é a porta única da separação — aqui ela entra pelo min/máx. */
    const esc = loteBase != null ? escalaDoPedido({ pedido: faltam, loteBase }) : null
    const escalaSugerida = esc != null ? round2(esc) : null
    out.push({ fichaId: f.id, itemProduzidoId: f.itemProduzidoId, nome: it.nome, unidade: it.unidadeControle, saldo, estoqueMin: it.estoqueMin, estoqueMax: it.estoqueMax, faltam, escalaSugerida, rendimentoMedio })
  }
  return out.sort((a, b) => a.saldo / a.estoqueMin - b.saldo / b.estoqueMin) // mais crítico primeiro
}
