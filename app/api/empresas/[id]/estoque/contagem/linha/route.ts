// ESTOQUE FASE 3 PARTE 2 — POST conta UMA linha (grava o AJUSTE_CONTAGEM na hora).
// O FREIO mora aqui: divergência grande sem `confirmarFreio` volta 409 code=FREIO e o
// ledger NÃO se move. A 2ª confirmação é do SERVIDOR, não da tela (REGRA 5).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { contarLinha, ContagemError } from '@/lib/stock/contagem'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  contagemId: z.string().min(1),
  itemId: z.string().min(1),
  qtdContada: z.number().min(0),
  confirmarFreio: z.boolean().optional(),
  // ⭐ CONTAGEM CEGA: ela apertou "ver o que o sistema diz"? Não é proibição, é rastro.
  viuSistema: z.boolean().optional(),
  // ⭐ observação de QUEM VIU ("estava molhado") — não é decisão, é o que faz o dono
  // investigar certo depois. Por isso a operadora pode escrever (é `stock.operate`).
  observacao: z.string().max(300).nullish(),
  /**
   * ⛔⛔ O MOTIVO do negativo (05/10) — **a lista fechada é validada na LIB**, não aqui.
   * ⚠️ Repetir o `z.enum` aqui seria a 2ª lista do mesmo vocabulário, e foi exatamente isso
   * que deixou 2 gestos MORTOS por dias em 25/09 (o enum da rota digitado à mão). O schema
   * garante a FORMA; quem conhece os motivos é `MOTIVOS_DO_NEGATIVO`.
   */
  motivoDoNegativo: z.string().max(40).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.operate')
  if (!auth.ok) return auth.res
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe a contagem, o item e a quantidade contada.' }, { status: 400 })
  try {
    const r = await contarLinha({ companyId, ...parsed.data, userId: auth.userId, userName: auth.userName }, prisma)
    return NextResponse.json(r)
  } catch (e) {
    /**
     * ⭐⭐ RECUSA ENSINA A SAÍDA (16/09) — o tradutor único do estoque.
     * ⛔ Antes daqui existia um `throw e` que virava **500 sem corpo**, e o cliente caía
     * no fallback genérico. Foi assim que a contagem do fermento disse *"não consegui
     * gravar"* enquanto o servidor tinha a explicação inteira na mão.
     * ⚠️ Erro que ninguém previu CONTINUA re-lançado: inventar frase amigável pra bug
     * desconhecido esconde o bug.
     */
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId, itemId: parsed.data.itemId })
    if (r) {
      /**
       * ⭐⭐ A PERGUNTA LEVA AS RESPOSTAS. Pedir o motivo sem mandar a lista obrigaria a tela a
       * ter uma cópia dela — a 2ª régua do mesmo vocabulário (a cicatriz de 25/09). Aqui ela
       * desce do servidor e a tela só desenha os botões.
       */
      const extra = e instanceof ContagemError && (e as ContagemError & { motivos?: unknown }).motivos
        ? { motivos: (e as ContagemError & { motivos?: unknown }).motivos }
        : {}
      return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida, ...extra }, { status: r.status })
    }
    throw e
  }
}
