import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { salvarTema } from '@/lib/tema/servidor'
import { TEMAS } from '@/lib/tema/preferencia'

/**
 * ⭐ A PORTA DO TEMA — PUT só (04/10/2026).
 *
 * ⛔ **NÃO existe GET aqui, de propósito.** Quem precisa do tema é o LAYOUT, que roda no
 * servidor e lê direto pelo `lerTema` — um GET seria uma 2ª porta pra mesma pergunta, e o
 * cliente que a usasse pintaria a tela DEPOIS do primeiro paint (o flash de tema errado que
 * a renderização no servidor existe pra matar).
 *
 * ⚠️ Não é por empresa: tema é da PESSOA. Logo a trava é "estar logado", sem `requirePermission`
 * — não há permissão de "pode escolher a própria cor de tela".
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

  const bruto = (corpo as { tema?: unknown } | null)?.tema
  /**
   * ⚠️ A rota RECUSA o desconhecido em vez de normalizar pro claro em silêncio. O
   * `normalizarTema` é defensivo na LEITURA (dado velho/estranho no banco não pode derrubar o
   * layout); na ESCRITA, aceitar `'roxo'` e gravar `'claro'` faria o botão responder "ok" e
   * fazer outra coisa — a família do *"salvo que mentia"*.
   */
  if (typeof bruto !== 'string' || !(TEMAS as readonly string[]).includes(bruto.trim().toLowerCase())) {
    return NextResponse.json(
      { erro: `Tema inválido — use ${TEMAS.join(' ou ')}` },
      { status: 400 },
    )
  }

  try {
    const tema = await salvarTema(user.sub, bruto)
    return NextResponse.json({ tema })
  } catch (e) {
    console.error('[tema] falha ao gravar a preferência:', e)
    return NextResponse.json(
      { erro: 'Não consegui guardar a escolha de tema — tente de novo.' },
      { status: 500 },
    )
  }
}
