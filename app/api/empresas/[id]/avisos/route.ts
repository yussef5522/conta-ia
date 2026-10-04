import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext, AuthenticationError } from '@/lib/auth/rbac'
import { avisosAbertos, marcarTodosLidos } from '@/lib/avisos/central'
import { setoresVisiveis } from '@/lib/avisos/visibilidade'
import { ehSetor, ROTULO_DO_SETOR, type Setor } from '@/lib/avisos/tipos'

/**
 * ⭐⭐ O QUE O SININHO E O BLOCO POR SETOR LEEM — a MESMA rota, a MESMA leitura.
 *
 * ⛔⛔ **Uma rota só, de propósito.** Duas (uma pro contador do sininho, outra pro bloco)
 * divergiriam no primeiro ajuste de régua — e esta casa já pagou isso por meses: o badge da
 * Conciliação contava os pares 1:1 **sem os lotes** enquanto a tela desenhava os dois, então o
 * menu dizia um número e a tela mostrava outro (10/09). Aqui o `total` do sininho é o
 * `avisos.length` que a tela recebe: **não têm COMO divergir**.
 *
 * ⛔⛔ **E O FILTRO DE SETOR É POR PERMISSÃO, NO SERVIDOR.** O sininho é global; sem isto ele
 * mostraria *"a fatura venceu"* pra quem só opera estoque — o MESMO vazamento de 30/08, em que
 * a operadora viu "entrou: 475.739,55" no Fluxo de Caixa. Esconder na tela não resolve: a rota
 * teria mandado o dado.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    if (!ctx.company) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })

    const permitidos = setoresVisiveis(ctx.permissions)
    if (!permitidos.length) {
      return NextResponse.json(
        { erro: 'Sem permissão pra ver avisos desta empresa' },
        { status: 403 },
      )
    }

    /**
     * ⚠️ O `?setor=` é RECORTE sobre o que a permissão já liberou, nunca um jeito de pedir
     * mais: `?setor=financeiro` pra quem não tem `transaction.view` leva 403, não a lista.
     */
    const pedido = request.nextUrl.searchParams.get('setor')
    let setores: Setor[] = permitidos
    if (pedido) {
      if (!ehSetor(pedido)) return NextResponse.json({ erro: 'Setor desconhecido' }, { status: 400 })
      if (!permitidos.includes(pedido)) {
        return NextResponse.json(
          { erro: `Sem permissão pra ver avisos de ${ROTULO_DO_SETOR[pedido]}` },
          { status: 403 },
        )
      }
      setores = [pedido]
    }

    const todos = await avisosAbertos(companyId)
    const avisos = todos.filter((a) => setores.includes(a.setor))

    return NextResponse.json({
      avisos,
      total: avisos.length,
      naoLidos: avisos.filter((a) => !a.lido).length,
      setoresVisiveis: permitidos,
    })
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    console.error('[avisos] falha ao ler:', e)
    return NextResponse.json({ erro: 'Não consegui carregar os avisos.' }, { status: 500 })
  }
}

/**
 * ⭐ "marcar tudo lido" — o gesto de quem acabou de ler o painel.
 *
 * ⚠️ Lido ≠ resolvido, e a diferença é do dono: **lido** é "eu vi"; **resolvido** é "o problema
 * acabou", e quem decide isso é o PRODUTOR (o juiz da noite seguinte deixa de reportar e o
 * aviso sai sozinho). Deixar o dono "resolver" na mão faria ele apagar o aviso de um problema
 * que continua lá — e aí a central mente.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  try {
    const ctx = await getAuthContext(request, companyId)
    if (!ctx.company) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
    if (!setoresVisiveis(ctx.permissions).length) {
      return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
    }
    const marcados = await marcarTodosLidos(companyId)
    return NextResponse.json({ marcados })
  } catch (e) {
    if (e instanceof AuthenticationError) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    console.error('[avisos] falha ao marcar lidos:', e)
    return NextResponse.json({ erro: 'Não consegui marcar como lido.' }, { status: 500 })
  }
}
