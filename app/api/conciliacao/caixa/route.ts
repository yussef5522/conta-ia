// ⭐⭐ A CAIXA DE ENTRADA DO BANCO — a lista das duas abas (15/09/2026).
//
// ⛔ **UMA LINHA, UMA ESTAÇÃO:** o payload devolve os contadores das TRÊS (saídas, entradas,
// arquivo) e o total, porque o invariante `saídas + entradas + arquivo == total` só é
// verificável se ele estiver **na tela**. Número que fecha por fora é promessa.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { estacaoDaLinha, comoFoiResolvida, sentidoDaLinha, acoesDoSentido } from '@/lib/conciliacao/caixa-de-entrada'
/**
 * ⭐ A CONSULTA NÃO MORA MAIS AQUI (faxina de 15/09) — ela é de `leitura-da-caixa`, a MESMA
 * que o **badge do menu** chama. Rota e badge lendo o mesmo recorte é o que impede o menu
 * de dizer um número e a tela mostrar outro (o defeito de 10/09).
 */
import { lerCaixa, paraLei } from '@/lib/conciliacao/leitura-da-caixa'
import { progressoDoMes } from '@/lib/conciliacao/palpite-da-linha'
/**
 * ⭐ O PALPITE do cartão ≍ (mock v3). ⚠️ Ele NÃO tem matcher próprio: chama os motores
 * provados (`resolvePaidInvoiceMonth`, `sugerirVinculoEmprestimo`, `sugerirVinculos`) e
 * só ESCOLHE entre o que eles devolveram. É fail-soft: sem palpite, a linha aparece com
 * os chips de sempre — a caixa de ontem, que funciona.
 */
import { palpitesDaCaixa } from '@/lib/conciliacao/palpites-da-caixa'
import { dividirPorCasa, fraseDoCasoNoCard } from '@/lib/conciliacao/uma-casa-por-caso'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const empresaId = url.searchParams.get('empresaId') ?? ''
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  if (!ctx.permissions.some((k) => k === '*' || k === 'transaction.view')) {
    return NextResponse.json({ erro: 'Sem permissão.', permission: 'transaction.view' }, { status: 403 })
  }

  const { rows, contadores, nomeConta, corte } = await lerCaixa(empresaId)

  // ⚠️ só as linhas que ESTÃO na caixa ganham palpite — palpitar sobre o arquivo é
  // trabalho (e consulta) pra quem já está resolvido.
  const naCaixa = rows.filter((r) => estacaoDaLinha(paraLei(r)) === 'CAIXA')
  const palpites = await palpitesDaCaixa(empresaId, naCaixa).catch(() => new Map())

  /**
   * ⭐⭐ A CATEGORIA DA CONTA CASADA — pra o seletor da esquerda DIZER *"herda da conta: X"*
   * em vez de pedir uma escolha que o reconcile vai descartar (ele faz backfill da conta).
   *
   * ⛔ E quando a conta **não tem**, a tela mostra *"a conta casada não tem categoria —
   * escolha"* — a mesma recusa que o servidor daria no clique (`PEDE_CATEGORIA`), só que
   * **antes** dele. *Descobrir no confirmar o que dava pra dizer no cartão é fazer o dono
   * clicar pra levar um não.*
   */
  const alvosDeCasar = [...palpites.values()].flatMap((p: { alvo?: Record<string, unknown> }) => {
    const a = p?.alvo ?? {}
    if (Array.isArray(a.contaIds)) return a.contaIds as string[]
    return typeof a.contaId === 'string' ? [a.contaId] : []
  })
  const catDaConta = new Map<string, string | null>()
  if (alvosDeCasar.length) {
    const contas = await prisma.transaction.findMany({
      where: { id: { in: alvosDeCasar } },
      select: { id: true, category: { select: { name: true } } },
    })
    for (const c of contas) catDaConta.set(c.id, c.category?.name ?? null)
  }
  /** ⚠️ a 1ª conta do palpite basta: o seletor fala do gesto, não de cada nota do lote */
  const categoriaDoAlvo = (p: { alvo?: Record<string, unknown> } | null | undefined) => {
    const a = p?.alvo ?? {}
    const id = Array.isArray(a.contaIds) ? (a.contaIds as string[])[0] : typeof a.contaId === 'string' ? a.contaId : null
    return id ? catDaConta.get(id) ?? null : null
  }

  /**
   * ⭐⭐⭐ UMA PERGUNTA, UMA CASA (20/09) — a mesma régua que os cards consultam.
   *
   * ⛔ Sem ela, a linha aparecia na caixa **com palpite e botão** e o MESMO par aparecia
   * embaixo como card, **com botões próprios**. Duas superfícies decidindo o mesmo par é a
   * família do caso Cancian: o desenho certo é **nem criar a disputa visual**.
   */
  const casas = dividirPorCasa(naCaixa.map((r) => {
    const p = palpites.get(r.id) as { alvo?: Record<string, unknown>; titulo?: string } | undefined
    const a = p?.alvo ?? {}
    const contaIds = Array.isArray(a.contaIds)
      ? (a.contaIds as string[])
      : typeof a.contaId === 'string' ? [a.contaId] : []
    return { linhaId: r.id, contaIds, nomeDoCaso: p?.titulo?.trim() || (r.description ?? 'este pagamento') }
  }))

  const linhas = rows.map((r) => {
    const l = paraLei(r)
    return {
      id: r.id, tipo: r.type, valor: r.amount, data: r.date.toISOString().slice(0, 10),
      descricao: r.description ?? '', contraparte: r.counterpartyName,
      conta: nomeConta.get(r.bankAccountId ?? '') ?? null,
      sentido: sentidoDaLinha(r.type),
      estacao: estacaoDaLinha(l),
      // ⭐ o selo do ARQUIVO diz COMO foi resolvida — nunca um "ok" genérico
      resolvidaComo: comoFoiResolvida(l),
      acoes: estacaoDaLinha(l) === 'CAIXA' ? acoesDoSentido(sentidoDaLinha(r.type)) : [],
      palpite: palpites.get(r.id) ?? null,
      /** ⭐ o que o seletor da esquerda mostra quando o palpite é CASAR */
      categoriaDaConta: categoriaDoAlvo(palpites.get(r.id)),
      /**
       * ⭐ quando o caso mora no CARD, a linha perde o botão e ganha o CAMINHO.
       * ⛔ Nunca as duas com botão — e nunca a linha muda sem dizer pra onde ir.
       */
      casoNoCard: casas.get(r.id)?.casa === 'CARD'
        ? { texto: fraseDoCasoNoCard(casas.get(r.id)!), ancora: casas.get(r.id)!.ancora! }
        : null,
    }
  })

  return NextResponse.json({
    contadores,
    /** ⭐ o anel do mês sai dos MESMOS contadores — nunca de uma consulta própria */
    progresso: progressoDoMes(contadores),
    /** a tela DIZ de quando ela conta: fila que mostra menos precisa dizer por quê */
    corte: corte ? corte.toISOString().slice(0, 10) : null,
    // ⚠️ a tela desenha SÓ a caixa; o arquivo tem casa própria (Movimentações)
    linhas: linhas.filter((l) => l.estacao === 'CAIXA'),
  })
}
