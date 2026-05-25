// Sprint 5.0.2.c — Knowledge Base: Lucro Presumido 2026
//
// Fonte: Lei 9.249/1995, Lei 9.430/1996, Decreto 9.580/2018 (RIR).

export const LUCRO_PRESUMIDO = {
  versao: '2026',

  baseLegal: {
    leiPrincipal: 'Lei 9.249/1995',
    leiComplementares: ['Lei 9.430/1996', 'Lei 9.718/1998'],
    regulamento: 'Decreto 9.580/2018 (RIR/2018)',
    instrucoesNormativas: ['IN RFB 1.700/2017', 'IN RFB 1.515/2014'],
  },

  // === LIMITES ===
  limites: {
    receitaBrutaAnual: 78_000_000, // R$ 78M (Lei 12.814/2013)
    receitaBrutaProporcional: 6_500_000, // R$ 6,5M/mês para enquadramento

    impedimentos: [
      'Bancos, financeiras, cooperativas de crédito',
      'Empresas com benefícios fiscais relativos a isenção/redução IRPJ',
      'Pessoas jurídicas que tenham auferido rendimentos no exterior',
      'Factoring',
      'Empresas de seguros privados, capitalização, previdência aberta',
      'Imobiliárias (loteamento, incorporação, compra/venda de imóveis próprios)',
    ],

    quandoObrigaLucroReal: [
      'Receita > R$ 78M no ano anterior',
      'Atividade impedida (bancos, factoring, etc)',
      'Tenha lucros/rendimentos oriundos do exterior',
      'Goze de benefícios fiscais de redução/isenção IRPJ',
      'Tenha efetuado pagamento mensal pelo regime de estimativa',
    ],
  },

  // === MARGENS DE PRESUNÇÃO IRPJ (Lei 9.249/95, art. 15) ===
  margensIRPJ: {
    comercio: 8.0,
    industria: 8.0,
    revendaCombustiveis: 1.6,
    transporteCargas: 8.0,
    transportePassageiros: 16.0,
    servicosHospitalares: 8.0,
    servicosEducacao: 8.0, // ensino fundamental, médio, superior
    servicosGerais: 32.0,
    construcaoCivilComMaterial: 8.0, // empreitada
    construcaoCivilSemMaterial: 32.0, // mão de obra
    intermediarioNegocios: 32.0, // agenciamento, corretagem
    administracaoLocacao: 32.0,
    revendaImovel: 8.0, // se construído pela empresa
  },

  // === MARGENS DE PRESUNÇÃO CSLL (Lei 9.249/95, art. 20) ===
  margensCSLL: {
    comercio: 12.0,
    industria: 12.0,
    servicosHospitalares: 12.0,
    transporteCargas: 12.0,
    transportePassageiros: 12.0,
    servicosGerais: 32.0,
    intermediarioNegocios: 32.0,
    administracaoLocacao: 32.0,
    revendaCombustiveis: 12.0,
  },

  // === ALÍQUOTAS ===
  aliquotas: {
    irpj: 15.0, // 15% sobre base presumida
    irpjAdicional: {
      aliquota: 10.0,
      limite: 60_000, // por trimestre (R$ 20k × 3)
      observacao: 'Aplicado sobre o excedente. MVP do sistema usa mensal (R$ 20k)',
    },
    csll: 9.0, // 9% sobre base presumida CSLL
    pis: 0.65, // cumulativo
    cofins: 3.0, // cumulativo
  },

  // === PIS/COFINS CUMULATIVO ===
  pisCofinsCumulativo: {
    baseLegal: 'Lei 9.718/1998',
    pis: 0.65,
    cofins: 3.0,
    base: 'Faturamento bruto (receita) — sem direito a crédito',

    exclusoesPermitidas: [
      'Vendas canceladas',
      'Devoluções de vendas',
      'Descontos incondicionais',
      'IPI destacado em separado',
      'ICMS-ST',
      'Receitas isentas (exportação, vendas a comerciais exportadoras)',
    ],

    vantagensCumulativo: [
      'Cálculo simples (apenas alíquota × receita)',
      'Sem precisão de controle de créditos',
      'Indicado para empresas com poucas compras tributadas',
    ],
    desvantagens: [
      'Sem direito a crédito sobre insumos',
      'Tributa em cascata (cumulativo)',
      'Geralmente pior que não-cumulativo quando há muitos insumos',
    ],
  },

  // === APURAÇÃO ===
  apuracao: {
    periodicidade: 'Trimestral (1T, 2T, 3T, 4T)',
    datasVencimento: {
      '1T': 'Último dia útil de abril',
      '2T': 'Último dia útil de julho',
      '3T': 'Último dia útil de outubro',
      '4T': 'Último dia útil de janeiro do ano seguinte',
    },
    parcelamento:
      'Pode dividir em até 3 quotas mensais (com juros SELIC), desde que cada quota ≥ R$ 1.000',
    obrigacaoAcessoria: [
      'DCTF (mensal)',
      'ECF (anual, julho)',
      'ECD (anual, julho)',
      'EFD-Contribuições (mensal)',
    ],
  },

  // === QUANDO VALE A PENA ===
  quandoVantajoso: [
    {
      cenario: 'Margem real > margem presumida do setor',
      explicacao: 'Se sua margem real é > 32% (presumida serviços), tributa menos no Presumido',
      exemplo: 'Consultoria com margem 50% paga 11,33% efetiva no Presumido vs ~25% no Real',
    },
    {
      cenario: 'Baixo custo de insumos tributados',
      explicacao: 'Sem créditos PIS/COFINS, Real cobra 9,25% sobre receita; Presumido cobra 3,65%',
      exemplo: 'Serviços de consultoria, advocacia, treinamento',
    },
    {
      cenario: 'Simplicidade operacional',
      explicacao: 'Cálculo trimestral simples, sem necessidade de controlar créditos',
      exemplo: 'Empresa pequena/média sem departamento fiscal dedicado',
    },
  ],

  // === QUANDO NÃO VALE A PENA ===
  quandoEvitar: [
    {
      cenario: 'Margem real < margem presumida',
      explicacao: 'Você tributa sobre lucro que não tem. Migrar pro Real e tributar lucro real',
      exemplo: 'Comércio com margem 5% paga IRPJ sobre 8% presumido — mais que o lucro real',
    },
    {
      cenario: 'Muitos insumos tributados (PIS/COFINS)',
      explicacao: 'No Real tem direito a crédito não-cumulativo (1,65% + 7,6%)',
      exemplo: 'Indústria com matéria-prima cara, comércio com fornecedor PJ tributado',
    },
    {
      cenario: 'Receitas de exportação relevantes',
      explicacao: 'Exportação tem benefícios mais amplos no Lucro Real',
    },
  ],

  // === REGIME DE CAIXA (LP) ===
  regimeCaixa: {
    permitido: true,
    quandoEscolher: 'Empresa com prazo médio de recebimento alto',
    requisitos: [
      'Optar pela opção no ECD/ECF do ano',
      'Manter livro caixa fiscal',
      'Reconhecer receita no recebimento',
    ],
    desvantagem: 'Controle gerencial mais complexo',
  },
} as const

export type LucroPresumidoKnowledge = typeof LUCRO_PRESUMIDO
