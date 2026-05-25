// Sprint 5.0.2.c — Knowledge Base: Lucro Real 2026
//
// Fonte: Decreto 9.580/2018 (RIR), Lei 10.637/2002 (PIS), Lei 10.833/2003 (COFINS).

export const LUCRO_REAL = {
  versao: '2026',

  baseLegal: {
    regulamento: 'Decreto 9.580/2018 (RIR/2018)',
    pisCofinsLeis: ['Lei 10.637/2002 (PIS não-cumulativo)', 'Lei 10.833/2003 (COFINS não-cumulativo)'],
    instrucoesNormativas: [
      'IN RFB 1.700/2017 (IRPJ/CSLL)',
      'IN RFB 1.911/2019 (PIS/COFINS)',
      'IN RFB 2.121/2022 (atualizações)',
    ],
  },

  // === OBRIGATORIEDADE ===
  obrigatoriedade: {
    receitaSuperior78M: 'Pessoa jurídica com receita bruta total > R$ 78M no ano anterior',
    atividadesEspecificas: [
      'Bancos comerciais, investimentos, desenvolvimento, caixas econômicas',
      'Sociedades de crédito, financeiras, factoring',
      'Empresas de seguros privados, capitalização, previdência aberta',
      'Distribuidoras de valores mobiliários, corretoras de câmbio',
      'Empresas com lucros oriundos do exterior',
      'Empresas que gozem de benefícios fiscais de redução/isenção IRPJ',
      'Empresas que tenham efetuado pagamento mensal pelo regime de estimativa',
    ],
    facultativo: 'Toda PJ pode optar voluntariamente pelo Lucro Real',
  },

  // === FORMAS DE APURAÇÃO ===
  formasApuracao: {
    anual: {
      descricao: 'Apuração definitiva ao final do ano-calendário',
      antecipacoes: 'Estimativas mensais (com base na receita ou em balancete de redução/suspensão)',
      vantagem: 'Aproveitamento de prejuízos do ano sem limite',
      desvantagem: 'Mais complexo (precisa fazer balancetes mensais)',
    },
    trimestral: {
      descricao: 'Apuração trimestral definitiva',
      datasVencimento: ['1T → último dia útil de abril', '2T → julho', '3T → outubro', '4T → janeiro'],
      vantagem: 'Cálculo simples, sem estimativa',
      desvantagem: 'Limite de 30% para compensação de prejuízos trimestrais',
    },
  },

  // === ALÍQUOTAS ===
  aliquotas: {
    irpj: 15.0,
    irpjAdicional: {
      aliquota: 10.0,
      limiteTrimestral: 60_000, // R$ 20k/mês × 3
      limiteAnual: 240_000, // R$ 20k/mês × 12
      observacao: 'Sobre excedente. MVP do sistema usa cálculo mensal (R$ 20k)',
    },
    csll: 9.0,
    pisNaoCumulativo: 1.65,
    cofinsNaoCumulativo: 7.6,
  },

  // === LUCRO REAL — APURAÇÃO ===
  apuracaoLucroReal: {
    pontoPartida: 'Lucro Líquido contábil (após CPC/ICPC/normas CFC)',

    adicoes: [
      'Despesas indedutíveis (multas punitivas, contribuições/doações não autorizadas)',
      'Pagamento a beneficiários no exterior em paraísos fiscais',
      'Prejuízos não operacionais (limite trimestral)',
      'CSLL contabilizada como despesa (ela mesma não é dedutível)',
      'Pró-labore pago a sócios em montante superior ao razoável',
      'Reservas técnicas em excesso',
      'Brindes acima de R$ 100/unidade',
      'Despesas com alimentação a empregados acima de R$ 1,99/refeição (limite RIR)',
    ],

    exclusoes: [
      'Receita de equivalência patrimonial (já tributada na controlada)',
      'Dividendos recebidos (isentos)',
      'Reversão de provisões adicionadas em anos anteriores',
      'Lucros e dividendos de empresas controladas no exterior (regimes específicos)',
    ],

    compensacaoPrejuizos: {
      limite: '30% do lucro real do período',
      lei: 'Lei 9.065/1995, art. 42',
      observacao: 'Prejuízo fiscal pode ser usado sem prazo, mas com limite de 30% por período',
    },
  },

  // === PIS/COFINS NÃO-CUMULATIVO ===
  pisCofinsNaoCumulativo: {
    base: 'Receita (com exclusões da Lei 10.637/02 art. 1º §3º)',
    aliquotaPIS: 1.65,
    aliquotaCOFINS: 7.6,

    creditosPermitidos: [
      'Mercadorias adquiridas para revenda',
      'Insumos utilizados na produção',
      'Energia elétrica consumida nos estabelecimentos',
      'Aluguéis de prédios, máquinas, equipamentos',
      'Arrendamento mercantil de pessoa jurídica',
      'Frete na operação de venda (quando suportado pelo vendedor)',
      'Bens incorporados ao ativo imobilizado (depreciação)',
      'Edificações e benfeitorias adquiridas/construídas',
      'Combustíveis e lubrificantes (quando relacionados à produção)',
      'Vale-transporte, vale-alimentação, fardamento (limites)',
      'Despesas com armazenagem e fretes na operação de venda',
    ],

    creditosVedados: [
      'Mão de obra paga a pessoa física',
      'Aquisição de bens/serviços não sujeitos ao pagamento de PIS/COFINS',
      'Despesas com fretes de operações que não geram crédito',
      'Aquisição de bens ou serviços do exterior (regimes próprios)',
      'Gastos com publicidade (exceto se diretamente relacionados à venda)',
    ],

    creditoPresumido: {
      aplicacao: 'Setores específicos (agropecuária, agroindustrial)',
      exemplo: 'Indústria láctea, soja, café podem ter crédito presumido sobre matéria-prima',
    },
  },

  // === ESTIMATIVAS MENSAIS (Real Anual) ===
  estimativasMensais: {
    baseEstimativa: {
      receita: 'Receita bruta do mês × percentual de presunção do setor',
      adicoes: 'Ganhos de capital, juros, demais receitas',
    },
    percentualPresuncaoEstimativa: 'Mesma do Lucro Presumido (Lei 9.249/95 art. 15)',
    quandoUsarBalancete: 'Quando lucro mensal real < lucro estimado → reduzir/suspender estimativa',
    deduções: 'IRPJ retido na fonte + IRPJ pago no exterior (com limites)',
  },

  // === OBRIGAÇÕES ACESSÓRIAS ===
  obrigacoesAcessorias: {
    mensais: [
      'DCTFWeb',
      'EFD-Contribuições',
      'EFD-ICMS/IPI',
      'EFD-Reinf',
      'eSocial',
    ],
    anuais: ['ECF (Escrituração Contábil Fiscal)', 'ECD (Escrituração Contábil Digital)'],
    eventuais: ['DIRF', 'DIMOB', 'DASN', 'DCP'],
  },

  // === QUANDO LUCRO REAL VALE A PENA ===
  quandoVantajoso: [
    {
      cenario: 'Margem real baixa (< margem presumida)',
      explicacao: 'Tributa lucro REAL em vez de presumido inflado',
      exemplo: 'Comércio com margem 5% paga ~3% efetivo no Real vs ~5% no Presumido',
    },
    {
      cenario: 'Muitos insumos com PIS/COFINS na entrada',
      explicacao: 'Crédito não-cumulativo abate o devido (1,65% + 7,6%)',
      exemplo: 'Indústria, comércio com fornecedor PJ tributado',
    },
    {
      cenario: 'Receitas de exportação',
      explicacao: 'Manutenção dos créditos PIS/COFINS na exportação (Lei 10.833 art. 6º)',
    },
    {
      cenario: 'Prejuízos acumulados a compensar',
      explicacao: 'Aproveita 30% do lucro pra reduzir tributação',
    },
    {
      cenario: 'Investimentos em P&D, Lei do Bem',
      explicacao: 'Benefícios só funcionam no Lucro Real',
    },
  ],

  // === ESCRITURAÇÃO ===
  escrituracao: {
    livrosObrigatorios: ['Diário', 'Razão', 'LALUR (Livro de Apuração do Lucro Real)', 'Caixa (se aplicável)'],
    formato: 'Digital (ECD/ECF) — entrega via SPED',
    prazo: 'Anual, último dia útil de julho do ano seguinte',
  },

  // === REGRAS ESPECIAIS ===
  regrasEspeciais: {
    transferPricing: {
      aplicacao: 'Operações com partes vinculadas no exterior',
      lei: 'Lei 9.430/1996 + Lei 14.596/2023 (atualização OCDE)',
    },
    subcapitalizacao: {
      aplicacao: 'Limite endividamento com PJ vinculada no exterior',
      regra: 'Endividamento ≤ 2× patrimônio líquido (Lei 12.249/2010)',
    },
    juresSobreCapitalProprio: {
      aplicacao: 'Distribuição de juros sobre capital próprio (TJLP)',
      vantagem: 'Dedutível na PJ pagadora (até limite)',
      tributacaoBeneficiario: '15% IRRF (PJ ou PF)',
    },
  },
} as const

export type LucroRealKnowledge = typeof LUCRO_REAL
