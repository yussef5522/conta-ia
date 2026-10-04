/**
 * ⭐⭐ RELATÓRIO DE PRODUÇÃO POR DIA — item 3 do dono (04/10/2026).
 *
 * ⛔ **`stock.manage` e entra em `LEITURA_SENSIVEL` com o motivo escrito:** este relatório mostra
 * **quem concluiu cada lote** e a eficiência dele lado a lado — é a MESMA régua do relatório por
 * pessoa (06/09) e do dia-ao-vivo: *conversa de gestão, nunca telão de cozinha*. A régua geral
 * (*"ler é ler"*) continua valendo pro resto; a exceção é nomeada, não afrouxada.
 *
 * ⭐ A rota é CASCA: todo número vem de `relatorioPorDia`, que por sua vez traduz
 * `lotesDaJanela` + a eficiência CONGELADA. Nenhuma conta aqui (REGRA 11: paralela = vermelho).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { relatorioPorDia } from '@/lib/stock/producao/relatorio-por-dia'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'
import { lerOcultas, aplicarDelta } from '@/lib/stock/producao/receitas-ocultas'

interface Params { params: Promise<{ id: string }> }

/**
 * ⚠️ O dia é o de SÃO PAULO, nunca `toISOString()` (que é UTC). Das 21h à meia-noite — justo
 * quando a cozinha fecha e lança a produção — o UTC já virou e "hoje" abriria VAZIO (medido em
 * prod às 22:16 de 05/09: 9 lotes no dia, zero na tela).
 */
function janelaDaUrl(sp: URLSearchParams) {
  const hoje = diaEmSaoPaulo()
  const de = sp.get('de') || somarDias(hoje, -29)
  const ate = sp.get('ate') || hoje
  return {
    de,
    ate,
    // ⚠️ `ate` inclusivo: o fim do dia, senão o lote lançado às 18h do último dia sumiria
    janela: { de: new Date(`${de}T00:00:00.000Z`), ate: new Date(`${ate}T23:59:59.999Z`) },
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const sp = request.nextUrl.searchParams
  const { de, ate, janela } = janelaDaUrl(sp)

  /**
   * ⭐ A ESCOLHA DO DONO SOBRE O QUE ELE VÊ — lida da TABELA, por usuário.
   * ⚠️ Falha macia: preferência ilegível volta a lista vazia (tudo visível). Derrubar o
   * relatório por causa de um JSON torto seria perder o relatório pra salvar o filtro.
   */
  const ocultas = await lerOcultas(companyId, a.user.sub, prisma)

  const r = await relatorioPorDia(companyId, {
    de: janela.de,
    ate: janela.ate,
    ocultas,
    tarefa: sp.get('tarefa') || undefined,
    setor: sp.get('setor') || undefined,
    quemConcluiu: sp.get('quem') || undefined,
  })

  return NextResponse.json({
    ...r,
    /**
     * ⚠️ O período ECOA os DIAS pedidos (calendário de SP), nunca o recorte UTC — senão a tela
     * imprimiria "de 04/09" pra uma janela que começa no dia 05 (a cicatriz do painel).
     */
    periodo: { de, ate },
    /**
     * ⭐ os valores que os chips de filtro oferecem saem da PRÓPRIA lista do período — oferecer
     * um setor que não produziu nada ali é oferecer um filtro que devolve vazio.
     */
    filtros: {
      /**
       * ⚠️ Sai de `receitasDoPeriodo` (a lista COMPLETA, antes de esconder), não das linhas
       * filtradas: derivar das linhas tiraria a receita oculta do chip de filtro também — e aí
       * ela ficaria inalcançável por dois caminhos de uma vez.
       */
      tarefas: r.receitasDoPeriodo.map((x) => x.tarefa).sort((x, y) => x.localeCompare(y)),
      setores: [...new Set(r.linhas.map((l) => l.setor).filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y)),
      pessoas: [...new Set(r.linhas.map((l) => l.quemConcluiu).filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y)),
    },
  })
}

/**
 * ⭐⭐ SALVA A ESCOLHA — e ela é um **DELTA**, nunca a lista inteira.
 *
 * ⛔⛔ **POR QUE DELTA:** o painel só conhece as receitas DO PERÍODO ABERTO. Se ele mandasse a
 * lista completa, abrir "hoje" (onde o TOMATE PICADO não produziu) e mexer em qualquer coisa
 * **apagaria o TOMATE da preferência em silêncio** — o dono voltaria amanhã e o preparo miúdo
 * que ele escondeu estaria de volta, sem ninguém ter pedido. Com delta, o que ele não viu não
 * muda: *só se decide sobre o que se vê.*
 *
 * ⛔ `stock.manage`: a mesma trava do relatório que ela configura — e escrita nunca se contenta
 * com `view`.
 */
const bodySchema = z.object({
  ocultar: z.array(z.string().min(1)).max(500).optional(),
  mostrar: z.array(z.string().min(1)).max(500).optional(),
})

export async function PUT(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Corpo inválido.' }, { status: 400 })

  const ocultas = await aplicarDelta(companyId, a.user.sub, parsed.data, prisma)
  return NextResponse.json({ ocultas })
}
