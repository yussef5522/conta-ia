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

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const empresaId = url.searchParams.get('empresaId') ?? ''
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  if (!ctx.permissions.some((k) => k === '*' || k === 'transaction.view')) {
    return NextResponse.json({ erro: 'Sem permissão.', permission: 'transaction.view' }, { status: 403 })
  }

  const { rows, contadores, nomeConta } = await lerCaixa(empresaId)

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
    }
  })

  return NextResponse.json({
    contadores,
    // ⚠️ a tela desenha SÓ a caixa; o arquivo tem casa própria (Movimentações)
    linhas: linhas.filter((l) => l.estacao === 'CAIXA'),
  })
}
