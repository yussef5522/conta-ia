// ⭐⭐ A MEDIDA DA SANIDADE TEM UM DONO SÓ (11/09/2026).
//
// ⚠️ Ela nasceu dentro do `venda-map.ts` (a tela de MAPEAMENTO) e a prova em prod mostrou
// que estava na porta errada: **quem BAIXA o estoque é o `processar`**, não o preview do
// mapa. O guard vivia numa tela que o dono pode nem abrir no dia.
//
// Aqui ela é uma função só, que os DOIS caminhos chamam — senão seriam duas réguas pra
// mesma pergunta, e elas divergiriam no 1º ajuste de fator.

import type { PrismaClient } from '@prisma/client'
import { avaliarSanidade, DIAS_DE_HISTORICO, type ResultadoDaSanidade } from './sanidade-do-import'

export interface LinhaPraMedir { produto: string; quantidade: number }

/**
 * A média é por dia em que o produto APARECEU, não por dia de calendário: um produto que
 * só vende no fim de semana teria a média diluída por 5 zeros e qualquer sábado viraria
 * suspeita — alarme falso repetido é como um alarme morre.
 */
export async function medirSanidade(
  companyId: string, linhas: LinhaPraMedir[], db: PrismaClient,
): Promise<ResultadoDaSanidade> {
  const desde = new Date(Date.now() - DIAS_DE_HISTORICO * 86_400_000)
  const imports = await db.stockVendaImport.findMany({
    where: { companyId, data: { gte: desde } }, select: { id: true, totalUnidades: true },
  })
  if (!imports.length) {
    // ⚠️ sem histórico não há régua: a 1ª importação da vida não pode ser suspeita.
    return { suspeitas: [], totalDoArquivo: linhas.reduce((s, l) => s + l.quantidade, 0), totalMedioDoDia: 0, vezesNoTotal: 0, precisaConfirmar: false }
  }
  const passadas = await db.stockVendaLinha.groupBy({
    by: ['nomeSuitable'],
    where: { importId: { in: imports.map((i) => i.id) } },
    _sum: { quantidade: true }, _count: true,
  })
  const historico = passadas.map((p) => ({
    produto: p.nomeSuitable,
    mediaDiaria: (p._sum.quantidade ?? 0) / Math.max(1, p._count),
    dias: p._count,
  }))
  const totalMedio = imports.reduce((s, i) => s + i.totalUnidades, 0) / imports.length
  return avaliarSanidade(linhas.map((l) => ({ produto: l.produto, quantidade: l.quantidade })), historico, totalMedio)
}

/**
 * ⛔⛔ A RECUSA É DO SERVIDOR, NÃO DA TELA — a régua do FREIO da contagem (23/08).
 * Um aviso que só existe no componente é um aviso que some no dia em que alguém chamar a
 * rota por outro caminho; e foi exatamente por outro caminho que o estrago de 10/09 entrou.
 * ⚠️ E ela PERGUNTA, não recusa cega: com `confirmouSanidade` o import passa — dia de
 * evento existe, e parser que recusa venda de verdade manda o dono lançar por fora.
 */
export class SanidadeNaoConfirmadaError extends Error {
  code = 'SANIDADE' as const
  sanidade: ResultadoDaSanidade
  constructor(sanidade: ResultadoDaSanidade) {
    super(sanidade.suspeitas[0]?.frase
      ?? `O arquivo traz ${sanidade.totalDoArquivo.toLocaleString('pt-BR')} unidades num dia — o normal é ${sanidade.totalMedioDoDia.toLocaleString('pt-BR')}. Confirma?`)
    this.name = 'SanidadeNaoConfirmadaError'
    this.sanidade = sanidade
  }
}
