import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { salvarTrilho } from '@/lib/tema/servidor'
import { TRILHOS } from '@/lib/trilho/preferencia'

/**
 * ⭐ A PORTA DO TRILHO — PUT só (14/10/2026).
 *
 * ⛔ **NÃO existe GET aqui, de propósito** — a mesma razão do `/api/tema`: quem precisa do
 * estado do trilho é o LAYOUT, que roda no servidor e lê direto pelo `lerPreferenciaDeTela`. Um
 * GET seria uma 2ª porta pra mesma pergunta, e o cliente que a usasse desenharia o menu DEPOIS
 * do primeiro paint — o flash de menu na largura errada que a renderização no servidor existe
 * pra matar.
 *
 * ⭐⭐ **ROTA SEPARADA, PORTA ÚNICA — não é contradição.** A escrita mora toda em
 * `gravarPreferencia` (`lib/tema/servidor.ts`); esta rota é **casca fina** sobre ela, igual o
 * `/apply-marks` é casca sobre o `aplicarMarcacao` (*"uma lógica, dois chamadores"*, 29/08).
 * ⚠️ Enfiar o `trilho` no corpo do `/api/tema` seria mais curto e PIOR: a rota passaria a aceitar
 * dois gestos diferentes no mesmo contrato, e o dia em que um deles ganhasse validação própria
 * a outra metade herdaria a recusa. Contrato por GESTO; porta única por FATO.
 *
 * ⚠️ Não é por empresa: largura de menu é da PESSOA. Logo a trava é "estar logado", sem
 * `requirePermission` — não há permissão de "pode escolher a própria largura de menu".
 */
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  let corpo: unknown
  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Corpo inválido' }, { status: 400 })
  }

  const bruto = (corpo as { trilho?: unknown } | null)?.trilho
  /**
   * ⚠️ A rota RECUSA o desconhecido em vez de normalizar pro default em silêncio. O
   * `normalizarTrilho` é defensivo na LEITURA (dado velho/estranho no banco não pode derrubar o
   * layout); na ESCRITA, aceitar `'gaveta'` e gravar `'recolhido'` faria o «» responder "ok" e
   * fazer outra coisa — a família do *"salvo que mentia"*.
   */
  if (
    typeof bruto !== 'string' ||
    !(TRILHOS as readonly string[]).includes(bruto.trim().toLowerCase())
  ) {
    return NextResponse.json(
      { erro: `Estado inválido — use ${TRILHOS.join(' ou ')}` },
      { status: 400 },
    )
  }

  try {
    const trilho = await salvarTrilho(user.sub, bruto)
    return NextResponse.json({ trilho })
  } catch (e) {
    console.error('[trilho] falha ao gravar a preferência:', e)
    return NextResponse.json(
      { erro: 'Não consegui guardar a escolha do menu — tente de novo.' },
      { status: 500 },
    )
  }
}
