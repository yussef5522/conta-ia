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
import { guardStock } from '@/lib/stock/require-stock'
import { relatorioPorDia } from '@/lib/stock/producao/relatorio-por-dia'
import { diaEmSaoPaulo, somarDias } from '@/lib/datas/dia-sao-paulo'

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

  const r = await relatorioPorDia(companyId, {
    de: janela.de,
    ate: janela.ate,
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
      tarefas: [...new Set(r.linhas.map((l) => l.tarefa))].sort((x, y) => x.localeCompare(y)),
      setores: [...new Set(r.linhas.map((l) => l.setor).filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y)),
      pessoas: [...new Set(r.linhas.map((l) => l.quemConcluiu).filter((x): x is string => !!x))].sort((x, y) => x.localeCompare(y)),
    },
  })
}
