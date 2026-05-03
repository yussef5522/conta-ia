// Estrutura compartilhada dos templates profissionais de plano de contas.
// Inspirado em Conta Azul / QuickBooks / Plano de Contas Referencial SPED,
// adaptado pra PMEs brasileiras.
//
// Decisões registradas em docs/PRODUTO-NORTE.md (NORTE estratégico).

import {
  REGIMES_PRESUMIDO_REAL,
  REGIMES_SIMPLES,
  REGIMES_NAO_SIMPLES,
  type RegimeTributario,
} from '@/lib/categories/regimes'

// Estrutura achatada — hierarquia via parentCode (resolvido em aplicarTemplate).
export interface CategoryTemplateNode {
  code: string
  name: string
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER'
  // Grupo do DRE Gerencial. null pra TRANSFER (não vai pro DRE).
  dreGroup:
    | 'RECEITA_BRUTA'
    | 'DEDUCOES'
    | 'CUSTO_PRODUTO_VENDIDO'
    | 'DESPESAS_COMERCIAIS'
    | 'DESPESAS_ADMINISTRATIVAS'
    | 'DESPESAS_PESSOAL'
    | 'RECEITAS_FINANCEIRAS'
    | 'DESPESAS_FINANCEIRAS'
    | 'OUTRAS_RECEITAS'
    | 'OUTRAS_DESPESAS'
    | 'IMPOSTOS_SOBRE_LUCRO'
    | 'DISTRIBUICAO_LUCROS'
    | 'INVESTIMENTOS'
    | 'TRANSFERENCIA'
  // Referência ao parent dentro do template (resolvido em runtime). null = raiz.
  parentCode: string | null
  description: string
  color: string
  icon: string | null
  // Multi-regime: null = visível em todos.
  visibleInRegimes: RegimeTributario[] | null
  // Ordenação manual. Float pra suportar drag-and-drop futuro.
  order: number
  isActive?: boolean
  isSystemDefault?: boolean
}

export const DRE_GROUPS = [
  'RECEITA_BRUTA',
  'DEDUCOES',
  'CUSTO_PRODUTO_VENDIDO',
  'DESPESAS_COMERCIAIS',
  'DESPESAS_ADMINISTRATIVAS',
  'DESPESAS_PESSOAL',
  'RECEITAS_FINANCEIRAS',
  'DESPESAS_FINANCEIRAS',
  'OUTRAS_RECEITAS',
  'OUTRAS_DESPESAS',
  'IMPOSTOS_SOBRE_LUCRO',
  'DISTRIBUICAO_LUCROS',
  'INVESTIMENTOS',
  'TRANSFERENCIA',
] as const

// Paleta de cores por DRE Group (decisão A.1: cores curadas).
export const COLOR_BY_DRE_GROUP: Record<CategoryTemplateNode['dreGroup'], string> = {
  RECEITA_BRUTA: '#10b981',
  RECEITAS_FINANCEIRAS: '#4ade80',
  OUTRAS_RECEITAS: '#86efac',
  DEDUCOES: '#ef4444',
  CUSTO_PRODUTO_VENDIDO: '#ea580c',
  DESPESAS_COMERCIAIS: '#f97316',
  DESPESAS_ADMINISTRATIVAS: '#fbbf24',
  DESPESAS_PESSOAL: '#3b82f6',
  DESPESAS_FINANCEIRAS: '#dc2626',
  IMPOSTOS_SOBRE_LUCRO: '#7c3aed',
  DISTRIBUICAO_LUCROS: '#a855f7',
  INVESTIMENTOS: '#c084fc',
  OUTRAS_DESPESAS: '#71717a',
  TRANSFERENCIA: '#a3a3a3',
}

// =============================================================================
// COMMON CATEGORIAS — compartilhadas em todos os 5 templates
// =============================================================================
// Cobre: receitas financeiras, outras receitas, deduções (cancelamentos +
// impostos sobre vendas), pessoal administrativo (folha CLT + provisões +
// encargos + benefícios + treinamento + uniformes + rescisões), pró-labore,
// ocupação, marketing comum, honorários, seguros, anuidades base, despesas
// financeiras (incluindo maquininha), impostos sobre lucro, outras despesas
// e transferências.

export const commonCategorias: CategoryTemplateNode[] = [
  // ========== 1.3 RECEITAS FINANCEIRAS ==========
  { code: '1.3', name: 'Receitas Financeiras', type: 'INCOME', dreGroup: 'RECEITAS_FINANCEIRAS', parentCode: null, description: 'Rendimentos não-operacionais de natureza financeira (aplicações, juros recebidos).', color: '#4ade80', icon: 'percent', visibleInRegimes: null, order: 130 },
  { code: '1.3.01', name: 'Rendimentos de Aplicações', type: 'INCOME', dreGroup: 'RECEITAS_FINANCEIRAS', parentCode: '1.3', description: 'CDB, Tesouro Direto, fundos, poupança.', color: '#4ade80', icon: 'trending-up', visibleInRegimes: null, order: 131 },
  { code: '1.3.02', name: 'Juros Recebidos', type: 'INCOME', dreGroup: 'RECEITAS_FINANCEIRAS', parentCode: '1.3', description: 'Juros e multa cobrados de clientes em atraso.', color: '#4ade80', icon: 'clock', visibleInRegimes: null, order: 132 },
  { code: '1.3.03', name: 'Descontos Financeiros Obtidos', type: 'INCOME', dreGroup: 'RECEITAS_FINANCEIRAS', parentCode: '1.3', description: 'Abatimento por antecipação de pagamento a fornecedores.', color: '#4ade80', icon: 'tag', visibleInRegimes: null, order: 133 },

  // ========== 1.9 OUTRAS RECEITAS ==========
  { code: '1.9', name: 'Outras Receitas', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS', parentCode: null, description: 'Receitas eventuais não-recorrentes (não-operacional).', color: '#86efac', icon: 'gift', visibleInRegimes: null, order: 190 },
  { code: '1.9.01', name: 'Indenizações Recebidas', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS', parentCode: '1.9', description: 'Seguros pagos, processos a favor.', color: '#86efac', icon: 'shield', visibleInRegimes: null, order: 191 },
  { code: '1.9.02', name: 'Venda de Ativo Imobilizado', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS', parentCode: '1.9', description: 'Venda de equipamento usado, móveis, veículo.', color: '#86efac', icon: 'tag', visibleInRegimes: null, order: 192 },
  { code: '1.9.03', name: 'Doações Recebidas', type: 'INCOME', dreGroup: 'OUTRAS_RECEITAS', parentCode: '1.9', description: 'Aporte sem contrapartida (raro em PME).', color: '#86efac', icon: 'gift', visibleInRegimes: null, order: 193 },

  // ========== 2.0 DEDUÇÕES (cancelamentos) ==========
  { code: '2.0', name: 'Deduções da Receita Bruta', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: null, description: 'Reduções da receita bruta — somam negativo no DRE Gerencial.', color: '#ef4444', icon: 'minus-circle', visibleInRegimes: null, order: 200 },
  { code: '2.0.01', name: 'Devoluções de Vendas', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Mercadoria/serviço devolvido pelo cliente com estorno.', color: '#ef4444', icon: 'corner-down-left', visibleInRegimes: null, order: 201 },
  { code: '2.0.02', name: 'Descontos Comerciais Concedidos', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Descontos por pontualidade, fidelidade, campanhas.', color: '#ef4444', icon: 'tag', visibleInRegimes: null, order: 202 },
  { code: '2.0.03', name: 'Cancelamentos com Estorno', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Estornos integrais por desistência ou problema.', color: '#ef4444', icon: 'x-circle', visibleInRegimes: null, order: 203 },

  // ========== 2.1 IMPOSTOS SOBRE VENDAS (com multi-regime) ==========
  { code: '2.1', name: 'Impostos sobre Vendas', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Tributos incidentes sobre faturamento (não sobre lucro).', color: '#dc2626', icon: 'landmark', visibleInRegimes: null, order: 210 },
  { code: '2.1.01', name: 'ISS', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: 'Imposto Sobre Serviços (2-5% varia por município). No Simples está embutido no DAS.', color: '#dc2626', icon: 'building', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 211 },
  { code: '2.1.02', name: 'DAS Simples Nacional', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: 'Guia única do Simples Nacional. Engloba IRPJ+CSLL+PIS+COFINS+CPP+ICMS/ISS.', color: '#dc2626', icon: 'receipt', visibleInRegimes: REGIMES_SIMPLES, order: 212 },
  { code: '2.1.03', name: 'PIS Cumulativo', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '0,65% sobre faturamento no Lucro Presumido (sem créditos).', color: '#dc2626', icon: 'percent', visibleInRegimes: ['LUCRO_PRESUMIDO'], order: 213 },
  { code: '2.1.04', name: 'COFINS Cumulativo', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '3% sobre faturamento no Lucro Presumido (sem créditos).', color: '#dc2626', icon: 'percent', visibleInRegimes: ['LUCRO_PRESUMIDO'], order: 214 },
  { code: '2.1.05', name: 'PIS Não-Cumulativo', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '1,65% no Lucro Real (com créditos sobre insumos).', color: '#dc2626', icon: 'percent', visibleInRegimes: ['LUCRO_REAL'], order: 215 },
  { code: '2.1.06', name: 'COFINS Não-Cumulativo', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '7,6% no Lucro Real (com créditos sobre insumos).', color: '#dc2626', icon: 'percent', visibleInRegimes: ['LUCRO_REAL'], order: 216 },
  { code: '2.1.07', name: 'CBS (Reforma Tributária 2026)', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '0,9% destaque informativo em 2026 (LC 214/2025). Vira recolhimento real em 2027.', color: '#dc2626', icon: 'flag', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 217 },
  { code: '2.1.08', name: 'IBS (Reforma Tributária 2026)', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.1', description: '0,1% destaque informativo em 2026. Substitui ICMS+ISS gradualmente até 2033.', color: '#dc2626', icon: 'flag', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 218 },

  // ========== 4.0 PESSOAL ADMINISTRATIVO ==========
  { code: '4.0', name: 'Pessoal Administrativo', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: null, description: 'Folha de quem NÃO atende cliente direto (gestão, recepção, limpeza).', color: '#3b82f6', icon: 'briefcase', visibleInRegimes: null, order: 400 },
  { code: '4.1', name: 'Folha CLT Administrativa', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Salários efetivos do staff de apoio (CLT).', color: '#3b82f6', icon: 'users', visibleInRegimes: null, order: 410 },
  { code: '4.1.01', name: 'Salários Recepção/Atendimento', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.1', description: 'Atendentes de balcão, secretaria, caixa.', color: '#60a5fa', icon: 'user', visibleInRegimes: null, order: 411 },
  { code: '4.1.02', name: 'Salários Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.1', description: 'Funcionários CLT de limpeza interna.', color: '#60a5fa', icon: 'sparkles', visibleInRegimes: null, order: 412 },
  { code: '4.1.03', name: 'Salários Manutenção', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.1', description: 'Zelador, manutenção interna efetiva.', color: '#60a5fa', icon: 'wrench', visibleInRegimes: null, order: 413 },
  { code: '4.1.04', name: 'Salários Gerência', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.1', description: 'Gerentes de unidade, supervisores, administrativo.', color: '#60a5fa', icon: 'user-cog', visibleInRegimes: null, order: 414 },

  // ========== 4.2 PROVISÕES DE FOLHA ==========
  { code: '4.2', name: 'Provisões de Folha', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Encargos contábeis mensais (regime competência).', color: '#3b82f6', icon: 'calendar', visibleInRegimes: null, order: 420 },
  { code: '4.2.01', name: 'Provisão 13º Salário', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.2', description: '1/12 do salário a cada mês (~8,33%).', color: '#60a5fa', icon: 'gift', visibleInRegimes: null, order: 421 },
  { code: '4.2.02', name: 'Provisão Férias + 1/3', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.2', description: '1/12 + 1/3 a cada mês (~11,11%).', color: '#60a5fa', icon: 'umbrella', visibleInRegimes: null, order: 422 },

  // ========== 4.3 ENCARGOS SOBRE FOLHA ==========
  { code: '4.3', name: 'Encargos sobre Folha', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Tributos do empregador sobre folha.', color: '#3b82f6', icon: 'shield', visibleInRegimes: null, order: 430 },
  { code: '4.3.01', name: 'FGTS', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.3', description: '8% sobre folha + 13º + férias. Aplicável em todos os regimes.', color: '#60a5fa', icon: 'landmark', visibleInRegimes: null, order: 431 },
  { code: '4.3.02', name: 'INSS Patronal', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.3', description: '20% sobre folha. Apenas Não-Simples e Simples Anexo IV (CPP via DAS no Simples I-III/V).', color: '#60a5fa', icon: 'landmark', visibleInRegimes: REGIMES_NAO_SIMPLES, order: 432 },
  { code: '4.3.03', name: 'RAT (Risco Acidente)', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.3', description: '1-3% conforme grau de risco da atividade.', color: '#60a5fa', icon: 'alert-triangle', visibleInRegimes: null, order: 433 },
  { code: '4.3.04', name: 'Terceiros (Sistema S)', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.3', description: '~5,8% (SENAI, SESC, SEBRAE etc). Apenas regimes Não-Simples e Anexo IV.', color: '#60a5fa', icon: 'building', visibleInRegimes: REGIMES_NAO_SIMPLES, order: 434 },

  // ========== 4.4 BENEFÍCIOS ==========
  { code: '4.4', name: 'Benefícios', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Vantagens não-salariais aos colaboradores.', color: '#3b82f6', icon: 'heart', visibleInRegimes: null, order: 440 },
  { code: '4.4.01', name: 'Vale Transporte', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.4', description: 'Custeio de deslocamento (CLT e estagiários). Até 6% descontado do funcionário.', color: '#60a5fa', icon: 'bus', visibleInRegimes: null, order: 441 },
  { code: '4.4.02', name: 'Vale Refeição/Alimentação', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.4', description: 'VR/VA via PAT (Programa de Alimentação do Trabalhador).', color: '#60a5fa', icon: 'utensils', visibleInRegimes: null, order: 442 },
  { code: '4.4.03', name: 'Plano de Saúde', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.4', description: 'Convênio médico subsidiado pela empresa.', color: '#60a5fa', icon: 'heart-pulse', visibleInRegimes: null, order: 443 },
  { code: '4.4.04', name: 'Plano Odontológico', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.4', description: 'Convênio dental subsidiado.', color: '#60a5fa', icon: 'smile', visibleInRegimes: null, order: 444 },

  // ========== 4.5/4.6 — Treinamento, Uniformes ==========
  { code: '4.5', name: 'Treinamento e Desenvolvimento', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Cursos, certificações, eventos para a equipe.', color: '#3b82f6', icon: 'book-open', visibleInRegimes: null, order: 450 },
  { code: '4.6', name: 'Uniformes e EPIs', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Vestimenta padrão da equipe e equipamentos de proteção.', color: '#3b82f6', icon: 'shirt', visibleInRegimes: null, order: 460 },

  // ========== 4.7 RESCISÕES ==========
  { code: '4.7', name: 'Rescisões', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.0', description: 'Verbas pagas em desligamento.', color: '#3b82f6', icon: 'log-out', visibleInRegimes: null, order: 470 },
  { code: '4.7.01', name: 'Multa 40% FGTS', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.7', description: 'Demissão sem justa causa: 40% sobre FGTS depositado.', color: '#60a5fa', icon: 'alert-circle', visibleInRegimes: null, order: 471 },
  { code: '4.7.02', name: 'Aviso Prévio Indenizado', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.7', description: 'Pagamento em dinheiro do aviso prévio não trabalhado.', color: '#60a5fa', icon: 'clock', visibleInRegimes: null, order: 472 },
  { code: '4.7.03', name: 'Outras Verbas Rescisórias', type: 'EXPENSE', dreGroup: 'DESPESAS_PESSOAL', parentCode: '4.7', description: 'Saldo de salário, férias proporcionais, 13º proporcional.', color: '#60a5fa', icon: 'file-text', visibleInRegimes: null, order: 473 },

  // ========== 4.9 PRÓ-LABORE E DISTRIBUIÇÃO ==========
  { code: '4.9', name: 'Pró-labore e Distribuição', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', parentCode: null, description: 'Remuneração dos sócios — separada da folha CLT pra DRE Gerencial honesto.', color: '#a855f7', icon: 'crown', visibleInRegimes: null, order: 490 },
  { code: '4.9.01', name: 'Pró-labore Sócios', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', parentCode: '4.9', description: 'Salário do sócio (com encargos próprios — INSS 11%, IRRF tabela).', color: '#a855f7', icon: 'user-cog', visibleInRegimes: null, order: 491 },
  { code: '4.9.02', name: 'INSS sobre Pró-labore', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', parentCode: '4.9', description: '11% retido do sócio sobre pró-labore (até teto INSS).', color: '#a855f7', icon: 'landmark', visibleInRegimes: null, order: 492 },
  { code: '4.9.03', name: 'Distribuição de Lucros', type: 'EXPENSE', dreGroup: 'DISTRIBUICAO_LUCROS', parentCode: '4.9', description: 'Saída ISENTA de IR (regra PJ→PF). Exige apuração contábil sustentando o lucro.', color: '#a855f7', icon: 'trending-up', visibleInRegimes: null, order: 493 },

  // ========== 5.1 OCUPAÇÃO ==========
  { code: '5.1', name: 'Ocupação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Custos do imóvel onde a empresa opera.', color: '#fb923c', icon: 'home', visibleInRegimes: null, order: 510 },
  { code: '5.1.01', name: 'Aluguel', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Locação do imóvel.', color: '#fbbf24', icon: 'key', visibleInRegimes: null, order: 511 },
  { code: '5.1.02', name: 'Condomínio', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Taxa condominial mensal.', color: '#fbbf24', icon: 'building', visibleInRegimes: null, order: 512 },
  { code: '5.1.03', name: 'IPTU', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Imposto Predial e Territorial Urbano.', color: '#fbbf24', icon: 'landmark', visibleInRegimes: null, order: 513 },
  { code: '5.1.04', name: 'Seguro Predial', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Seguro do imóvel/conteúdo contra incêndio, roubo etc.', color: '#fbbf24', icon: 'shield', visibleInRegimes: null, order: 514 },
  { code: '5.1.05', name: 'Energia Elétrica', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Conta de luz.', color: '#fbbf24', icon: 'zap', visibleInRegimes: null, order: 515 },
  { code: '5.1.06', name: 'Água/Esgoto', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Conta de água e esgoto.', color: '#fbbf24', icon: 'droplets', visibleInRegimes: null, order: 516 },
  { code: '5.1.07', name: 'Internet/Telefonia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Banda larga, telefonia fixa e móvel corporativa.', color: '#fbbf24', icon: 'wifi', visibleInRegimes: null, order: 517 },
  { code: '5.1.08', name: 'Gás', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.1', description: 'Gás (caldeira, cozinha, aquecedor).', color: '#fbbf24', icon: 'flame', visibleInRegimes: null, order: 518 },

  // ========== 5.4 INSUMOS OPERACIONAIS ==========
  { code: '5.4', name: 'Insumos Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Consumíveis do dia-a-dia (não-produção).', color: '#fb923c', icon: 'box', visibleInRegimes: null, order: 540 },
  { code: '5.4.01', name: 'Material de Escritório', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.4', description: 'Papel, caneta, toner, formulários.', color: '#fbbf24', icon: 'pen-tool', visibleInRegimes: null, order: 541 },
  { code: '5.4.02', name: 'Café / Água', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.4', description: 'Cortesia oferecida ao cliente/equipe.', color: '#fbbf24', icon: 'coffee', visibleInRegimes: null, order: 542 },
  { code: '5.4.03', name: 'Lavanderia / Toalhas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.4', description: 'Lavagem de toalhas e tecidos próprios.', color: '#fbbf24', icon: 'shirt', visibleInRegimes: null, order: 543 },

  // ========== 6.1 MARKETING DIGITAL (comum a todos) ==========
  { code: '6.1', name: 'Marketing Digital', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Anúncios online e ferramentas digitais.', color: '#f97316', icon: 'smartphone', visibleInRegimes: null, order: 610 },
  { code: '6.1.01', name: 'Meta Ads', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.1', description: 'Anúncios em Facebook + Instagram.', color: '#fb923c', icon: 'facebook', visibleInRegimes: null, order: 611 },
  { code: '6.1.02', name: 'Google Ads', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.1', description: 'Search + display + YouTube.', color: '#fb923c', icon: 'search', visibleInRegimes: null, order: 612 },
  { code: '6.1.03', name: 'TikTok Ads', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.1', description: 'Vídeo Ads na TikTok.', color: '#fb923c', icon: 'video', visibleInRegimes: null, order: 613 },
  { code: '6.1.04', name: 'Influenciadores', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.1', description: 'Cachês ou permutas com criadores de conteúdo.', color: '#fb923c', icon: 'star', visibleInRegimes: null, order: 614 },
  { code: '6.1.05', name: 'Email Marketing / CRM', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.1', description: 'RD Station, Mailchimp, ActiveCampaign.', color: '#fb923c', icon: 'mail', visibleInRegimes: null, order: 615 },

  // ========== 6.2 MARKETING TRADICIONAL ==========
  { code: '6.2', name: 'Marketing Tradicional', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Mídias físicas e materiais impressos.', color: '#f97316', icon: 'newspaper', visibleInRegimes: null, order: 620 },
  { code: '6.2.01', name: 'Material Gráfico', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.2', description: 'Panfletos, banners, faixas.', color: '#fb923c', icon: 'file-text', visibleInRegimes: null, order: 621 },
  { code: '6.2.02', name: 'Outdoor / Mídia Externa', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.2', description: 'Painéis de rua, busdoor, fachada.', color: '#fb923c', icon: 'map-pin', visibleInRegimes: null, order: 622 },
  { code: '6.2.03', name: 'Brindes Promocionais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.2', description: 'Sacolas, garrafas, acessórios com marca.', color: '#fb923c', icon: 'gift', visibleInRegimes: null, order: 623 },

  // ========== 6.3 EVENTOS E PROMOÇÕES ==========
  { code: '6.3', name: 'Eventos e Promoções', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Ações de ativação, captação e relacionamento.', color: '#f97316', icon: 'calendar', visibleInRegimes: null, order: 630 },
  { code: '6.3.01', name: 'Eventos de Captação', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.3', description: 'Aulão aberto, degustação, demonstração gratuita.', color: '#fb923c', icon: 'users', visibleInRegimes: null, order: 631 },
  { code: '6.3.02', name: 'Confraternizações Internas', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.3', description: 'Eventos para clientes/equipe.', color: '#fb923c', icon: 'party-popper', visibleInRegimes: null, order: 632 },
  { code: '6.3.03', name: 'Patrocínios Locais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.3', description: 'Time amador, evento de bairro, escola.', color: '#fb923c', icon: 'award', visibleInRegimes: null, order: 633 },

  // ========== 7.1 HONORÁRIOS PROFISSIONAIS ==========
  { code: '7.1', name: 'Honorários Profissionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'NF tomada de PJ pra serviços profissionais.', color: '#fbbf24', icon: 'scale', visibleInRegimes: null, order: 710 },
  { code: '7.1.01', name: 'Contabilidade', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.1', description: 'Honorários do escritório de contabilidade.', color: '#fde047', icon: 'calculator', visibleInRegimes: null, order: 711 },
  { code: '7.1.02', name: 'Consultoria Jurídica', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.1', description: 'Advogado fixo ou eventual.', color: '#fde047', icon: 'scale', visibleInRegimes: null, order: 712 },
  { code: '7.1.03', name: 'Consultoria de Negócios', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.1', description: 'Mentoria, coaching empresarial, análise estratégica.', color: '#fde047', icon: 'trending-up', visibleInRegimes: null, order: 713 },

  // ========== 7.2 SEGUROS NÃO-PREDIAL ==========
  { code: '7.2', name: 'Seguros (não-predial)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Apólices operacionais.', color: '#fbbf24', icon: 'shield', visibleInRegimes: null, order: 720 },
  { code: '7.2.01', name: 'Seguro Resp. Civil', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.2', description: 'Cobertura por danos a terceiros (acidente com cliente, etc).', color: '#fde047', icon: 'shield-check', visibleInRegimes: null, order: 721 },
  { code: '7.2.02', name: 'Seguro de Equipamentos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.2', description: 'Cobertura contra roubo, incêndio, dano elétrico.', color: '#fde047', icon: 'shield', visibleInRegimes: null, order: 722 },

  // ========== 7.3 CARTORÁRIAS / TAXAS ==========
  { code: '7.3', name: 'Cartorárias e Taxas Públicas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Cartório, alvarás, vigilância sanitária, bombeiros.', color: '#fbbf24', icon: 'file-text', visibleInRegimes: null, order: 730 },

  // ========== 7.5 ASSINATURAS ==========
  { code: '7.5', name: 'Assinaturas e Eventos Setoriais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Conhecimento e relacionamento profissional.', color: '#fbbf24', icon: 'book', visibleInRegimes: null, order: 750 },
  { code: '7.5.01', name: 'Eventos Setoriais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.5', description: 'Congressos, feiras, conferências.', color: '#fde047', icon: 'calendar-check', visibleInRegimes: null, order: 751 },
  { code: '7.5.02', name: 'Assinaturas Profissionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.5', description: 'Revistas, plataformas de conteúdo, cursos online.', color: '#fde047', icon: 'book-open', visibleInRegimes: null, order: 752 },

  // ========== 8.0 DESPESAS FINANCEIRAS (inteiras) ==========
  { code: '8.0', name: 'Despesas Financeiras', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: null, description: 'Custos com instituições financeiras e operações de crédito.', color: '#dc2626', icon: 'banknote', visibleInRegimes: null, order: 800 },
  { code: '8.1', name: 'Juros e Encargos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'Custo do capital tomado em terceiros.', color: '#dc2626', icon: 'trending-up', visibleInRegimes: null, order: 810 },
  { code: '8.1.01', name: 'Juros sobre Empréstimos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.1', description: 'Capital de giro, expansão.', color: '#ef4444', icon: 'percent', visibleInRegimes: null, order: 811 },
  { code: '8.1.02', name: 'Juros sobre Financiamentos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.1', description: 'Financiamento de equipamentos e veículos.', color: '#ef4444', icon: 'percent', visibleInRegimes: null, order: 812 },
  { code: '8.1.03', name: 'Juros Cheque Especial', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.1', description: 'Uso eventual de limite emergencial.', color: '#ef4444', icon: 'alert-triangle', visibleInRegimes: null, order: 813 },
  { code: '8.2', name: 'Tarifas Bancárias', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'Cobranças do banco por serviços.', color: '#dc2626', icon: 'landmark', visibleInRegimes: null, order: 820 },
  { code: '8.2.01', name: 'Tarifas de Manutenção', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.2', description: 'Pacote/cesta da conta, mensalidades.', color: '#ef4444', icon: 'building', visibleInRegimes: null, order: 821 },
  { code: '8.2.02', name: 'Taxa de Boleto Emitido', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.2', description: 'Por boleto bancário gerado.', color: '#ef4444', icon: 'file-text', visibleInRegimes: null, order: 822 },
  { code: '8.2.03', name: 'Custódia de Títulos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.2', description: 'Cobrança bancária por administração de títulos.', color: '#ef4444', icon: 'folder', visibleInRegimes: null, order: 823 },
  { code: '8.3', name: 'Maquininha de Cartão', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'MDR (Merchant Discount Rate) cobrado pelo adquirente.', color: '#dc2626', icon: 'credit-card', visibleInRegimes: null, order: 830 },
  { code: '8.3.01', name: 'Taxa Cartão Crédito', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.3', description: 'MDR ~3-3,5% sobre vendas no crédito.', color: '#ef4444', icon: 'credit-card', visibleInRegimes: null, order: 831 },
  { code: '8.3.02', name: 'Taxa Cartão Débito', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.3', description: 'MDR ~1,9-2,5% sobre vendas no débito.', color: '#ef4444', icon: 'credit-card', visibleInRegimes: null, order: 832 },
  { code: '8.3.03', name: 'Taxa Cartão Recorrente', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.3', description: 'Cobrança automática mensal ~2,5-4,2% (cartão recorrente).', color: '#ef4444', icon: 'repeat', visibleInRegimes: null, order: 833 },
  { code: '8.3.04', name: 'Aluguel de Maquininha', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.3', description: 'Mensalidade do equipamento (Stone, Cielo, Rede etc).', color: '#ef4444', icon: 'hash', visibleInRegimes: null, order: 834 },
  { code: '8.4', name: 'Antecipação de Recebíveis', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'Custo financeiro de antecipar venda no cartão.', color: '#dc2626', icon: 'fast-forward', visibleInRegimes: null, order: 840 },
  { code: '8.5', name: 'IOF', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'Imposto sobre Operações Financeiras.', color: '#dc2626', icon: 'landmark', visibleInRegimes: null, order: 850 },
  { code: '8.6', name: 'Multas e Juros de Mora Pagos', type: 'EXPENSE', dreGroup: 'DESPESAS_FINANCEIRAS', parentCode: '8.0', description: 'Atraso em pagamento de tributos ou fornecedores.', color: '#dc2626', icon: 'alert-circle', visibleInRegimes: null, order: 860 },

  // ========== 9.1 IMPOSTOS SOBRE LUCRO ==========
  { code: '9.1', name: 'Impostos sobre Lucro', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', parentCode: null, description: 'Tributos sobre lucro presumido/real (não Simples).', color: '#7c3aed', icon: 'landmark', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 910 },
  { code: '9.1.01', name: 'IRPJ', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', parentCode: '9.1', description: '15% sobre lucro presumido/real.', color: '#8b5cf6', icon: 'percent', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 911 },
  { code: '9.1.02', name: 'IRPJ Adicional 10%', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', parentCode: '9.1', description: '10% sobre excedente de R$ 60k/trimestre (R$ 240k/ano).', color: '#8b5cf6', icon: 'trending-up', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 912 },
  { code: '9.1.03', name: 'CSLL', type: 'EXPENSE', dreGroup: 'IMPOSTOS_SOBRE_LUCRO', parentCode: '9.1', description: '9% no Lucro Presumido/Real.', color: '#8b5cf6', icon: 'percent', visibleInRegimes: REGIMES_PRESUMIDO_REAL, order: 913 },

  // ========== 9.9 OUTRAS DESPESAS ==========
  { code: '9.9', name: 'Outras Despesas', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', parentCode: null, description: 'Eventos não-recorrentes fora da operação.', color: '#71717a', icon: 'package-x', visibleInRegimes: null, order: 990 },
  { code: '9.9.01', name: 'Doações e Patrocínios Sociais', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', parentCode: '9.9', description: 'ONGs, eventos beneficentes, ação social.', color: '#a3a3a3', icon: 'heart', visibleInRegimes: null, order: 991 },
  { code: '9.9.02', name: 'Multas Administrativas', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', parentCode: '9.9', description: 'ANVISA, Vigilância Sanitária, Procon, multas trânsito.', color: '#a3a3a3', icon: 'alert-triangle', visibleInRegimes: null, order: 992 },
  { code: '9.9.03', name: 'Perdas em Imobilizado', type: 'EXPENSE', dreGroup: 'OUTRAS_DESPESAS', parentCode: '9.9', description: 'Equipamento perdido, roubado ou inservível.', color: '#a3a3a3', icon: 'x-circle', visibleInRegimes: null, order: 993 },

  // ========== 0.0 TRANSFERÊNCIAS (fora do DRE) ==========
  { code: '0.0', name: 'Transferências', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: null, description: 'Movimentações sem efeito patrimonial — não vão pro DRE.', color: '#a3a3a3', icon: 'arrow-left-right', visibleInRegimes: null, order: 1 },
  { code: '0.0.01', name: 'Entre Contas Próprias', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Banco A → Banco B da mesma empresa.', color: '#a3a3a3', icon: 'repeat', visibleInRegimes: null, order: 2 },
  { code: '0.0.02', name: 'Aplicação Financeira (saída)', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Conta corrente → CDB/Tesouro/fundo.', color: '#a3a3a3', icon: 'arrow-up', visibleInRegimes: null, order: 3 },
  { code: '0.0.03', name: 'Resgate de Aplicação (entrada)', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Aplicação → conta corrente.', color: '#a3a3a3', icon: 'arrow-down', visibleInRegimes: null, order: 4 },
  { code: '0.0.04', name: 'Mútuo entre Sócios', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Empréstimo do sócio à empresa (devolutivo, não é aporte).', color: '#a3a3a3', icon: 'handshake', visibleInRegimes: null, order: 5 },
  { code: '0.0.05', name: 'Aporte de Capital', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Sócio coloca dinheiro na empresa (aumenta PL).', color: '#a3a3a3', icon: 'plus-circle', visibleInRegimes: null, order: 6 },
  { code: '0.0.06', name: 'Devolução de Aporte', type: 'TRANSFER', dreGroup: 'TRANSFERENCIA', parentCode: '0.0', description: 'Empresa devolve aporte ao sócio.', color: '#a3a3a3', icon: 'minus-circle', visibleInRegimes: null, order: 7 },
]

// =============================================================================
// HELPERS
// =============================================================================

// Concatena common + específicas, retornando o template completo achatado.
export function buildTemplate(specifics: CategoryTemplateNode[]): CategoryTemplateNode[] {
  return [...commonCategorias, ...specifics]
}

// Valida que toda categoria com parentCode aponta pra um code que existe no template.
// Retorna lista de erros (vazia = válido).
export function validarHierarquia(template: CategoryTemplateNode[]): string[] {
  const codes = new Set(template.map((c) => c.code))
  const erros: string[] = []
  for (const c of template) {
    if (c.parentCode && !codes.has(c.parentCode)) {
      erros.push(`Categoria "${c.code}" (${c.name}) tem parent "${c.parentCode}" que não existe no template`)
    }
  }
  return erros
}

// Detecta ciclos na hierarquia (parent ancestral de si mesmo).
export function detectarCiclos(template: CategoryTemplateNode[]): string[] {
  const byCode = new Map(template.map((c) => [c.code, c]))
  const erros: string[] = []
  for (const c of template) {
    const seen = new Set<string>([c.code])
    let cur: string | null = c.parentCode
    while (cur) {
      if (seen.has(cur)) {
        erros.push(`Ciclo detectado a partir de "${c.code}" via parent "${cur}"`)
        break
      }
      seen.add(cur)
      const node: CategoryTemplateNode | undefined = byCode.get(cur)
      if (!node) break
      cur = node.parentCode
    }
  }
  return erros
}

// Verifica que códigos SPED são únicos no template.
export function validarCodigosUnicos(template: CategoryTemplateNode[]): string[] {
  const seen = new Map<string, number>()
  for (const c of template) {
    seen.set(c.code, (seen.get(c.code) ?? 0) + 1)
  }
  const duplicados: string[] = []
  for (const [code, count] of seen) {
    if (count > 1) duplicados.push(`Código "${code}" aparece ${count}x no template`)
  }
  return duplicados
}
