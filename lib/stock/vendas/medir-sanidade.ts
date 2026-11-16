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
import { canonicoDaGrafia } from './grafia-canonica'

export interface LinhaPraMedir { produto: string; quantidade: number }

/**
 * A média é por dia em que o produto APARECEU, não por dia de calendário: um produto que
 * só vende no fim de semana teria a média diluída por 5 zeros e qualquer sábado viraria
 * suspeita — alarme falso repetido é como um alarme morre.
 */
export async function medirSanidade(
  companyId: string, linhas: LinhaPraMedir[], db: PrismaClient,
  /**
   * ⭐⭐ (16/11) o dia JULGADO ('YYYY-MM-DD'): o histórico é a janela de 14 dias ESTRITAMENTE ANTES
   * dele. Antes era "14 dias pra trás de AGORA, sem teto" — o próprio dia (num reprocesso) e os
   * dias depois dele entravam na régua do dia. Sem `dia` (prévia de arquivo sem data), o teto é agora.
   */
  dia?: string,
): Promise<ResultadoDaSanidade> {
  const ate = dia ? new Date(`${dia}T00:00:00`) : new Date()
  const desde = new Date(ate.getTime() - DIAS_DE_HISTORICO * 86_400_000)
  const imports = await db.stockVendaImport.findMany({
    where: { companyId, data: { gte: desde, lt: ate }, status: { not: 'ESTORNADO' } }, select: { id: true, totalUnidades: true },
  })
  if (!imports.length) {
    return { suspeitas: [], totalDoArquivo: linhas.reduce((s, l) => s + l.quantidade, 0), totalMedioDoDia: 0, vezesNoTotal: 0, precisaConfirmar: false }
  }
  // ⭐ por GRAFIA CANÔNICA e por DIA DISTINTO (um import = um dia): gêmeos somam, linha repetida não conta dia a mais
  const passadas = await db.stockVendaLinha.findMany({
    where: { importId: { in: imports.map((i) => i.id) } }, select: { nomeSuitable: true, quantidade: true, importId: true },
  })
  const porCanon = new Map<string, { produto: string; soma: number; dias: Set<string> }>()
  for (const p of passadas) {
    const k = canonicoDaGrafia(p.nomeSuitable)
    const cur = porCanon.get(k) ?? { produto: p.nomeSuitable, soma: 0, dias: new Set<string>() }
    cur.soma += p.quantidade
    cur.dias.add(p.importId)
    porCanon.set(k, cur)
  }
  const historico = [...porCanon.values()].map((c) => ({ produto: c.produto, mediaDiaria: c.soma / c.dias.size, dias: c.dias.size }))
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
