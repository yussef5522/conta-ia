// Sprint 5.0.2.b — CNAE Expert Engine.
//
// Função PURA que recebe CNAE + perfil tributário + dados financeiros e
// retorna análise completa com benefícios aplicáveis, otimizações,
// alertas e recomendações priorizadas pelo impacto financeiro.
//
// Sem DB, sem fetch — alimentado por `expertiseForCNAE()` do catálogo
// local. Endpoints carregam do banco e passam pra cá.

import {
  ALL_EXPERTISE,
  expertiseForCNAE,
  findCNAE,
  type ExpertiseRamo,
  type Ramo,
} from './expertise'

export interface ExpertiseAnalysisInput {
  /** CNAE no formato "9999-9/99" */
  cnae: string
  /** Regime atual SIMPLES_NACIONAL | LUCRO_PRESUMIDO | LUCRO_REAL */
  regime: string
  /** Anexo Simples (quando aplicável): ANEXO_I..V */
  anexoSimples?: string | null
  /** Faturamento mensal médio em R$ */
  receitaMensal: number
  /** Receita Bruta Acumulada 12m em R$ */
  rba12m: number
  /** Folha últimos 12 meses (CLT + pró-labore) em R$ */
  folha12m: number
  /** UF (2 letras) */
  estado?: string | null
  /** Tem operação delivery? (afeta restaurantes) */
  hasDelivery?: boolean
  /** Vende bebidas alcoólicas? (afeta restaurantes) */
  vendeBebidas?: boolean
}

export type AlertaSeveridade = 'INFO' | 'WARNING' | 'CRITICAL'

export interface BeneficioAplicavel {
  tipo: string
  descricao: string
  detalhes: string
  economiaPotencial: string
  comoAproveitar: string[]
}

export interface Otimizacao {
  titulo: string
  descricao: string
  economiaEstimada: number // R$/mês
}

export interface Alerta {
  severidade: AlertaSeveridade
  mensagem: string
}

export interface Recomendacao {
  prioridade: number // 1 = mais alta
  titulo: string
  descricao: string
  impactoFinanceiro: number // R$/mês
}

export interface CNAEExpertAnalysis {
  cnae: string
  ramo: Ramo
  cnaeNome: string
  anexoRecomendado: string

  beneficiosAplicaveis: BeneficioAplicavel[]
  otimizacoes: Otimizacao[]
  alertas: Alerta[]
  recomendacoes: Recomendacao[]

  // Métricas derivadas pra UI
  fatorR: number // 0.0 a 1.0
  fatorROK: boolean
  economiaTotalEstimada: number // R$/mês (soma das otimizações)

  // Snapshot da expertise inteira (UI usa pra mostrar tudo)
  expertise: ExpertiseRamo
}

const SIMPLES_REGIME = 'SIMPLES_NACIONAL'

/**
 * Calcula Fator R = folha12m / rba12m. Retorna 0 se RBA = 0.
 */
export function calculateFatorR(folha12m: number, rba12m: number): number {
  if (rba12m <= 0) return 0
  return folha12m / rba12m
}

/**
 * Engine principal.
 */
export function analyzeCNAEExpertise(input: ExpertiseAnalysisInput): CNAEExpertAnalysis | null {
  const cnaeEntry = findCNAE(input.cnae)
  const expertise = expertiseForCNAE(input.cnae)
  if (!cnaeEntry || !expertise) return null

  const fatorR = calculateFatorR(input.folha12m, input.rba12m)
  const fatorROK = fatorR >= 0.28

  const beneficiosAplicaveis: BeneficioAplicavel[] = []
  const otimizacoes: Otimizacao[] = []
  const alertas: Alerta[] = []
  const recomendacoes: Recomendacao[] = []

  // === Benefícios sempre aplicáveis (do snapshot) ===
  for (const b of expertise.beneficios) {
    beneficiosAplicaveis.push({
      tipo: b.tipo,
      descricao: b.descricao,
      detalhes: b.detalhes,
      economiaPotencial: b.economiaPotencial,
      comoAproveitar: b.comoAproveitar ?? [],
    })
  }

  // === Lógica específica por ramo ===
  switch (expertise.ramo) {
    case 'RESTAURANTE':
      analyzeRestaurante(input, expertise, fatorR, fatorROK, { otimizacoes, alertas, recomendacoes })
      break
    case 'ACADEMIA':
      analyzeAcademia(input, expertise, fatorR, fatorROK, { otimizacoes, alertas, recomendacoes })
      break
    case 'COMERCIO_ROUPA':
      analyzeComercioRoupa(input, expertise, fatorR, fatorROK, { otimizacoes, alertas, recomendacoes })
      break
  }

  // === Sort recomendações por impacto desc ===
  recomendacoes.sort((a, b) => b.impactoFinanceiro - a.impactoFinanceiro)
  // Re-numera prioridade após sort
  recomendacoes.forEach((r, i) => (r.prioridade = i + 1))

  const economiaTotalEstimada = otimizacoes.reduce((s, o) => s + o.economiaEstimada, 0)

  return {
    cnae: input.cnae,
    ramo: expertise.ramo,
    cnaeNome: cnaeEntry.name,
    anexoRecomendado: expertise.anexoPreferido,
    beneficiosAplicaveis,
    otimizacoes,
    alertas,
    recomendacoes,
    fatorR,
    fatorROK,
    economiaTotalEstimada,
    expertise,
  }
}

type Buckets = {
  otimizacoes: Otimizacao[]
  alertas: Alerta[]
  recomendacoes: Recomendacao[]
}

function analyzeRestaurante(
  input: ExpertiseAnalysisInput,
  exp: ExpertiseRamo,
  fatorR: number,
  fatorROK: boolean,
  b: Buckets,
): void {
  // Bebidas com ICMS-ST: ~8% economia se vende bebidas
  if (input.vendeBebidas) {
    const economiaICMSST = input.receitaMensal * 0.08 * 0.3 // assume 30% da receita é bebida
    b.otimizacoes.push({
      titulo: 'Excluir bebidas com ICMS-ST da base do Simples',
      descricao: 'Bebidas (refri, cerveja, água) já têm ICMS recolhido. Segregar receita evita dupla tributação.',
      economiaEstimada: economiaICMSST,
    })
    b.recomendacoes.push({
      prioridade: 1,
      titulo: 'Configurar PDV pra segregar bebidas',
      descricao: 'Cada item de bebida deve sair com NCM e flag ICMS-ST.',
      impactoFinanceiro: economiaICMSST,
    })
  }

  // PERSE — alíquota zero PIS/COFINS/IRPJ/CSLL
  if (input.regime === SIMPLES_REGIME && input.cnae.startsWith('5611')) {
    const economiaPERSE = input.receitaMensal * 0.0365
    b.otimizacoes.push({
      titulo: 'Aderir ao PERSE (alíquota zero PIS/COFINS/IRPJ/CSLL)',
      descricao: 'CNAEs 5611* são elegíveis até 2027. Requer CADASTUR em alguns casos.',
      economiaEstimada: economiaPERSE,
    })
    b.recomendacoes.push({
      prioridade: 1,
      titulo: 'Verificar elegibilidade PERSE',
      descricao: 'CADASTUR + adesão via e-CAC. Validade até março/2027.',
      impactoFinanceiro: economiaPERSE,
    })
  }

  // Fator R pra buffet/eventos
  if (!fatorROK && input.receitaMensal > 30_000) {
    const aliqDiff = 0.06 // ~6 p.p. de diferença média entre Anexo I e Anexo V (em eventos)
    const economiaFatorR = input.receitaMensal * aliqDiff * 0.25 // 25% receita é evento/buffet
    b.alertas.push({
      severidade: 'WARNING',
      mensagem: `Fator R em ${(fatorR * 100).toFixed(1)}% (precisa 28%). Eventos/buffet caem no Anexo V (15,5%) em vez de III (6%).`,
    })
    b.recomendacoes.push({
      prioridade: 2,
      titulo: 'Aumentar pró-labore pra Fator R >= 28%',
      descricao: `Subir pró-labore eleva folha. Estimativa: R$ ${Math.ceil((input.rba12m * 0.28 - input.folha12m) / 12).toLocaleString('pt-BR')}/mês pra atingir 28%.`,
      impactoFinanceiro: economiaFatorR,
    })
  }

  if (input.hasDelivery) {
    b.recomendacoes.push({
      prioridade: 3,
      titulo: 'Segregar receita salão × delivery',
      descricao: 'Canais distintos permitem otimização fiscal por canal (taxas diferentes em plataformas).',
      impactoFinanceiro: input.receitaMensal * 0.005,
    })
  }
}

function analyzeAcademia(
  input: ExpertiseAnalysisInput,
  exp: ExpertiseRamo,
  fatorR: number,
  fatorROK: boolean,
  b: Buckets,
): void {
  const aliqAnexoIII = 0.06
  const aliqAnexoV = 0.155
  const diff = aliqAnexoV - aliqAnexoIII // 9.5 p.p.

  if (input.regime === SIMPLES_REGIME) {
    if (fatorROK) {
      b.otimizacoes.push({
        titulo: '✅ Você está no Anexo III (Fator R OK)',
        descricao: `Fator R em ${(fatorR * 100).toFixed(1)}% — manter folha >= 28% é crítico todo mês.`,
        economiaEstimada: input.receitaMensal * diff,
      })
      b.alertas.push({
        severidade: 'INFO',
        mensagem: `Margem de segurança: ${((fatorR - 0.28) * 100).toFixed(1)} p.p. acima do mínimo. Monitorar mensalmente.`,
      })
    } else {
      const economiaMudanca = input.receitaMensal * diff
      b.alertas.push({
        severidade: 'CRITICAL',
        mensagem: `Fator R em ${(fatorR * 100).toFixed(1)}% (precisa 28%). Operação no Anexo V — pagando ${(diff * 100).toFixed(1)} p.p. a mais que poderia.`,
      })
      b.otimizacoes.push({
        titulo: 'Subir pró-labore pra entrar no Anexo III',
        descricao: 'Maior alavanca tributária da academia. Cada R$ 1k de pró-labore pode mudar o regime.',
        economiaEstimada: economiaMudanca,
      })

      const folhaNecessaria = input.rba12m * 0.28
      const gap = folhaNecessaria - input.folha12m
      b.recomendacoes.push({
        prioridade: 1,
        titulo: 'Aumentar pró-labore mensal',
        descricao: `Precisa de +R$ ${Math.ceil(gap / 12).toLocaleString('pt-BR')}/mês na folha. Distribuir entre sócios via pró-labore evita criar vagas.`,
        impactoFinanceiro: economiaMudanca,
      })
    }
  }

  // Reforma 2026 redução 30%
  b.otimizacoes.push({
    titulo: 'Reforma Tributária 2026 — Redução 30% IBS/CBS (saúde)',
    descricao: 'Academias são classificadas como saúde na LC 214/2025 — redução de 30% nas alíquotas durante a transição.',
    economiaEstimada: input.receitaMensal * 0.03,
  })

  // Segregação personal trainer
  if (input.cnae === '9313-1/00') {
    b.recomendacoes.push({
      prioridade: 3,
      titulo: 'Separar personal trainer (CNAE 9319-1/01)',
      descricao: 'Personal pode ter CNPJ próprio (PJ ou MEI) — não derruba seu Fator R.',
      impactoFinanceiro: input.receitaMensal * 0.005,
    })
  }
}

function analyzeComercioRoupa(
  input: ExpertiseAnalysisInput,
  exp: ExpertiseRamo,
  fatorR: number,
  fatorROK: boolean,
  b: Buckets,
): void {
  // ICMS-ST varia por estado
  const estadosComST = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC']
  const estado = input.estado?.toUpperCase() ?? ''
  if (estadosComST.includes(estado)) {
    const economiaST = input.receitaMensal * 0.12
    b.otimizacoes.push({
      titulo: `ICMS-ST vestuário em ${estado}`,
      descricao: 'Estado aplica ICMS-ST em vestuário. Segregar essas vendas evita dupla tributação no Simples.',
      economiaEstimada: economiaST,
    })
    b.recomendacoes.push({
      prioridade: 1,
      titulo: 'Conferir convênio ICMS-ST vigente',
      descricao: 'Solicitar nota dos fornecedores com destaque do ICMS-ST e segregar no PGDAS-D.',
      impactoFinanceiro: economiaST,
    })
  } else if (estado) {
    b.alertas.push({
      severidade: 'INFO',
      mensagem: `${estado} pode não aplicar ICMS-ST em vestuário — confirmar com contador local antes de segregar.`,
    })
  }

  // DIFAL em compras interestaduais
  b.recomendacoes.push({
    prioridade: 2,
    titulo: 'Negociar DIFAL com fornecedores interestaduais',
    descricao: 'Pedir preço CIF (com DIFAL incluído) ou priorizar fornecedores do mesmo estado.',
    impactoFinanceiro: input.receitaMensal * 0.02,
  })

  // Sazonalidade
  if (input.receitaMensal > 20_000) {
    b.otimizacoes.push({
      titulo: 'Provisionar caixa para picos sazonais',
      descricao: 'Black Friday + Natal puxam alíquota Simples (RBA acumulado). Reserva técnica evita surpresa de DAS.',
      economiaEstimada: input.receitaMensal * 0.01,
    })
  }

  // Reforma 2026 — não-cumulatividade
  b.recomendacoes.push({
    prioridade: 4,
    titulo: 'Avaliar Lucro Real após Reforma 2026',
    descricao: 'CBS/IBS não-cumulativos podem favorecer comércio com créditos amplos (energia, aluguel, frete).',
    impactoFinanceiro: input.receitaMensal * 0.015,
  })
}

/**
 * Helper: total de CNAEs cadastrados (pra UI).
 */
export function totalCNAEsCadastrados(): number {
  return Object.values(ALL_EXPERTISE).reduce((acc, e) => acc + e.cnaes.length, 0)
}
