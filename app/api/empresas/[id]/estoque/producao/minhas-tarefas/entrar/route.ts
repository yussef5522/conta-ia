// ⭐⭐ A JANELA DA COZINHA — entrar com o PIN e ver as próprias tarefas (06/09/2026).
//
// ⛔⛔ O SERVIDOR NUNCA ACEITA UM `colaboradorId` VINDO DA TELA. Em toda ação o PIN volta e
// o servidor resolve QUEM é. Aceitar o id do cliente deixaria qualquer um escolher o nome de
// outro **sem saber o PIN dele** — e aí o PIN não protegeria nada, que é pior que não ter.
//
// ⚠️ E o PIN só chega aqui depois de a rota já ter provado, pelo RBAC, que este aparelho
// pertence a esta empresa: quatro dígitos identificam DENTRO da empresa, nunca a empresa.
//
// ⛔ AS CHAVES SÃO `executar` OU `operate` — **nunca `view`**. Pego pelo guard estrutural na
// primeira rodada: com `stock.view` na lista, o papel LEITURA_ESTOQUE (que existe pra "vê,
// não mexe") poderia iniciar e finalizar tarefa. `operate` está aí porque executar tarefa É
// operar — sem ela o próprio encarregado ficaria de fora do tablet.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { minhasTarefasDeHoje } from '@/lib/stock/producao/minhas-tarefas'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({ pin: z.string().regex(/^\d{4}$/) })

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, ['stock.executar', 'stock.operate'])
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  // ⚠️ a MESMA resposta pra formato inválido e pra PIN que não existe: distinguir ensinaria
  // a enumerar, e "PIN não confere" é a única coisa que a pessoa precisa saber.
  if (!parsed.success) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  const quem = await quemEstaComOPin(companyId, parsed.data.pin, prisma)
  if (!quem) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  return NextResponse.json({
    colaborador: { id: quem.colaboradorId, nome: quem.nome },
    tarefas: await minhasTarefasDeHoje(companyId, quem.colaboradorId, new Date(), prisma),
    // ⭐⭐ O INSTANTE DO SERVIDOR (08/09) — é ele que o cronômetro do tablet usa.
    //
    // ⛔ O RELÓGIO DO APARELHO NÃO SERVE DE RÉGUA. O cronômetro fazia
    // `Math.max(0, Date.now() - iniciadoEm)`: num tablet com a hora atrasada, a conta dá
    // NEGATIVO e o `max` parava o relógio em **00:00** — exatamente o que o dono viu. E a
    // casa já sabia disso: *"o cronômetro é da TELA, o instante é do servidor (…) relógio
    // de aparelho pode estar torto"* está escrito desde 06/09, na tela do HOJE.
    agoraServidor: new Date().toISOString(),
  })
}
