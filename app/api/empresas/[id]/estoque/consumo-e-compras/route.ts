/**
 * ⭐⭐ CONSUMO & COMPRAS — GET (16/10/2026).
 *
 * ⚠️ `stock.view`: é LEITURA pura — nenhum caminho daqui escreve uma linha. A config de compra
 * (que é escrita) tem rota própria, com `stock.manage`.
 *
 * ⛔ A rota é **CASCA FINA**: ela não decide nada de compra. Quem monta é `lerConsumoECompras`,
 * e é por isso que o radar ① e esta tela não têm como divergir — os dois chamam a MESMA função.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { lerConsumoECompras } from '@/lib/compras/leitura'
import type { PeriodoDaMargem } from '@/lib/margem/janela'

interface Params { params: Promise<{ id: string }> }

const PERIODOS: PeriodoDaMargem[] = ['HOJE', 'SEMANA', 'MES', 'DATAS']

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  try {
    const sp = request.nextUrl.searchParams
    /**
     * ⭐ O PADRÃO É **SEMANA** (lei C2 — *"dia · SEMANA (padrão) · mês · datas"*).
     * ⚠️ Período desconhecido cai no padrão, nunca num `if` que devolve lista vazia: a tela
     * abrindo vazia por causa de um parâmetro torto é a família do *"erro disfarçado de vazio"*.
     */
    const bruto = sp.get('periodo') as PeriodoDaMargem | null
    const periodo = bruto && PERIODOS.includes(bruto) ? bruto : 'SEMANA'

    // ⭐ o nome da empresa entra no texto do WhatsApp — e ele vem do CADASTRO, nunca cravado
    const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })

    const dados = await lerConsumoECompras(
      {
        companyId,
        empresa: empresa?.name ?? 'pedido',
        periodo,
        datas: { de: sp.get('de'), ate: sp.get('ate') },
        agora: new Date(),
      },
      prisma,
    )
    return NextResponse.json(dados)
  } catch (e) {
    // ⭐ o tradutor único do módulo: erro de domínio vira 422 que ENSINA; o que ninguém previu
    // continua 500 — ali o genérico é honesto (a régua de 16/09).
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json({ erro: r.erro, code: r.code, saida: r.saida }, { status: r.status })
    throw e
  }
}
