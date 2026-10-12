/**
 * ⭐ A FILA DA CONVERSÃO KG→UN — *"lista de pendentes com progresso (37 → 0)"* (04/10/2026).
 *
 * ⚠️⚠️ **A TELA QUE ELA ALIMENTAVA FOI APOSENTADA EM 11/10** (item 4 do dono: *"zerada por 1+2,
 * a tela «Corrigir o lote» é aposentada"*). A ROTA ficou, e com um papel novo: ela diz à LISTA
 * DE RECEITAS **quais fichas esperam o rendimento do dono** — a fila morreu porque a lista
 * passou a ser a fila, com a pendência marcada na própria linha e o link abrindo a ficha.
 *
 * ⭐ E `esperamRendimento` é o recorte que importa: SÓ as **não-neutras**. Ficha neutra ainda
 * incoerente é trabalho do SISTEMA (a auto-conversão resolve sozinha) — marcá-la cobraria do
 * dono um gesto que ele não precisa dar.
 *
 * ⛔ **GET é `stock.view`**: ver o que falta é leitura. Quem CONVERTE é `stock.manage`, porque
 * mexer na receita é decisão do dono (a fronteira de 17/08) — e essa trava vive na rota do
 * gesto, não aqui.
 */

import { NextRequest, NextResponse } from 'next/server'
import { guardStock } from '@/lib/stock/require-stock'
import { fichasParaConverter } from '@/lib/stock/producao/fichas-para-converter'
import { sugestoesDaConversao } from '@/lib/stock/producao/converter-lote'
import { rendimentosPendentes } from '@/lib/stock/producao/auto-conversao-de-lote'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro

  const prog = await fichasParaConverter(companyId)
  const esperam = await rendimentosPendentes(companyId)

  /**
   * ⭐ Cada linha já vem com as SUGESTÕES: sem elas a tela abriria 37 fichas com um campo vazio
   * e o dono teria que descobrir o número sozinho, ficha por ficha — que é exatamente o
   * "abrir uma por uma" que este assistente existe pra matar.
   *
   * ⚠️ E a sugestão vai junto da PROVENIÊNCIA (`porque`): número sem dizer de onde veio é
   * chute com cara de autoridade numa decisão que muda a receita dele.
   */
  const pendentes = prog.pendentes.map((f) => ({
    ...f,
    sugestoes: sugestoesDaConversao({
      nomeProduto: f.nomeProduto,
      dosePrincipal: f.dosePrincipal,
      medido: f.medido,
      lotes: f.lotes,
      loteBase: f.loteBase,
    }),
  }))

  return NextResponse.json({
    total: prog.total,
    coerentes: prog.coerentes,
    pendentes,
    /** ⭐ o progresso que o dono pediu, já feito — a tela não recalcula (uma régua, um lugar) */
    progresso: { feitas: prog.coerentes, faltam: prog.pendentes.length, total: prog.total },
    /** ⭐⭐ as que esperam O NÚMERO DO DONO (não-neutras) — é o que a lista de receitas marca */
    esperamRendimento: esperam.map((f) => ({ fichaId: f.fichaId, porQue: f.porQueNao })),
  })
}
