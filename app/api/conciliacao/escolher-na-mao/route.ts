// GET /api/conciliacao/escolher-na-mao?empresaId=…
//
// ⭐ OS CARDS do Find & Match: cada linha do extrato que NOMEIA um fornecedor e não fecha
// na soma, contra as notas abertas dele.
//
// ⛔⛔ **DEVOLVE A LISTA INTEIRA, e essa é a correção de 10/09/2026.**
//
// A primeira versão carregava UMA linha por vez, sob demanda (`?extratoId=`). Na tela isso
// virou **porta sem maçaneta**: a seção nascia colapsada, o dono precisava (1) expandir,
// (2) clicar "escolher na mão" numa linha, e o card aparecia no RODAPÉ da página, longe do
// clique. Ele abriu `/conciliacao` e disse: *"continua a mensagem antiga… sem os cards
// novos"*. **A seção dos que não fecham VIRA os cards.**
//
// ⚠️ E o modo de uma-linha-só saiu junto: sem chamador, ele seria o campo decorativo que
// esta casa já pagou caro no `registry.parse` (existia, ninguém chamava, e o bug ficou
// invisível por semanas).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
// ⭐ 23/09: a orquestração saiu daqui pra lib — o CAIXA precisa dos mesmos cards, e
// copiá-la seria a 2ª derivação. A rota é casca fina.
import { cardsDeEscolha } from '@/lib/conciliacao/cards-de-escolha'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  /**
   * ⭐⭐ A PORTA DOS DOIS LADOS precisa montar o card de UMA LINHA QUALQUER (10/09/2026).
   *
   * ⛔ A fila só lista o que o motor de LOTE marcou como "não fecha", e o lote exige
   * 2+ notas. Fornecedor com UMA nota aberta (Oesa depois de conciliar uma, Focatto)
   * **não entra na fila** — e sem isto o "Casar com conta a pagar…" abriria a tela sem
   * card nenhum, que é a porta sem maçaneta de novo, agora do outro lado.
   *
   * ⚠️ É o MESMO `montarCardDeEscolha` — o card continua morando num lugar só.
   */
  abrir: z.string().cuid().optional(),
  /**
   * ⭐⭐ A PORTA DO OUTRO LADO (13/09): veio do "procurar no extrato" de uma CONTA A PAGAR.
   *
   * ⚠️ Aqui o alvo não é uma linha — é uma NOTA. A rota resolve as linhas candidatas
   * dela (mesmo fornecedor, ou as compatíveis por valor quando não há fornecedor) e as
   * trata como se tivessem vindo pelo `abrir=`. Sem isto, o dono clicava na conta da
   * `isabel camera fria` e caía numa tela sem card nenhum dela.
   */
  conta: z.string().cuid().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))
    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const visiveis = await cardsDeEscolha(data, prisma)

    return NextResponse.json({ cards: visiveis })
  } catch (error) {
    return handleApiError(error)
  }
}
