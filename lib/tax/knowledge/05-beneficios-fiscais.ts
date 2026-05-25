// Sprint 5.0.2.c — Knowledge Base: Benefícios Fiscais Federais e Regionais

export const BENEFICIOS_FISCAIS = {
  versao: '2026',

  // === PERSE (Programa Emergencial de Retomada do Setor de Eventos) ===
  perse: {
    baseLegal: 'Lei 14.148/2021 + LC 195/2022 + Portaria ME 7.163/2021',
    descricao: 'Alíquota zero de PIS, COFINS, IRPJ e CSLL para empresas do setor de eventos',
    validade: 'Até março/2027 (com extensões)',

    requisitos: [
      'CNAE principal ou secundário na lista da Portaria',
      'Cadastur ativo (em alguns casos)',
      'Comprovação de impacto pela pandemia',
      'Regularidade fiscal',
    ],

    cnaesElegiveis: [
      '5611-2/01 Restaurantes',
      '5611-2/02 Restaurante self-service',
      '5611-2/03 Lanchonetes',
      '5611-2/04 Bar com refeição',
      '5611-2/05 Bar sem refeição',
      '5620-1/01 Pizzaria delivery',
      '7990-2/00 Serviços de reservas e outros agenciamentos',
      '8230-0/01 Promoção e organização de feiras',
      '8230-0/02 Organização de festas',
      '9001-9/01 Produção teatral',
      '9001-9/02 Produção musical',
      '9319-1/01 Personal trainer (em algumas interpretações)',
      '9329-8/01 Discotecas, danceterias, salões de dança',
      '9329-8/04 Exploração de boliches',
      '9329-8/99 Outras atividades de recreação e lazer',
    ],

    comoAderir: [
      'Acessar e-CAC > Cadastro > PERSE',
      'Confirmar CNAE elegível',
      'Anexar Cadastur (quando aplicável)',
      'Confirmar regularidade fiscal',
      'Efetivar adesão (efeito imediato)',
    ],

    economia: {
      pisCofinsCumulativo: 3.65, // % sobre receita
      pisCofinsNaoCumulativo: 9.25,
      irpjCsll: 'Variável (~5-15% sobre lucro)',
      totalEstimado: '~10-20% sobre faturamento bruto',
    },
  },

  // === ZONA FRANCA DE MANAUS ===
  zonaFrancaManaus: {
    baseLegal: 'Decreto-Lei 288/1967 + EC 83/2014 + EC 132/2023 (preservou)',
    territorio: 'Manaus-AM e municípios do interior do estado (com regras específicas)',
    administracao: 'Suframa',

    incentivos: {
      ipi: 'Isenção/redução em produtos manufaturados',
      icms: 'Crédito presumido + restituição parcial',
      irpj: 'Redução de 75% pra empresas industriais',
      pisCofins: 'Alíquota zero em vendas pra ZFM',
    },

    requisitosBasicos: [
      'Sede em Manaus ou municípios autorizados',
      'PPB (Processo Produtivo Básico) aprovado pela Suframa',
      'Geração de empregos locais',
      'Investimentos em P&D (mínimo 5% da receita)',
    ],

    preservacaoReforma: 'EC 132/2023 manteve ZFM no ADCT — operacionalização em LC futura',
  },

  // === LEI DO BEM ===
  leiDoBem: {
    baseLegal: 'Lei 11.196/2005',
    descricao: 'Incentivo a P&D em empresas de inovação tecnológica',
    requisito: 'Empresa no Lucro Real (vedado Simples e Presumido)',

    beneficios: [
      'Dedução de 60% a 100% das despesas com P&D no LALUR',
      'Depreciação acelerada de máquinas/equipamentos pra P&D',
      'Amortização acelerada de bens intangíveis',
      'Redução a zero do IRRF sobre remessas a registros de patentes/marcas no exterior',
    ],

    comprovacao: 'Relatório enviado ao MCTI até julho do ano seguinte',
    setoresTipicos: ['TI', 'biotech', 'indústria farmacêutica', 'engenharia de inovação'],
  },

  // === REPETRO (Petróleo e Gás) ===
  repetro: {
    baseLegal: 'Decreto 6.759/2009 + IN RFB 1.781/2017',
    descricao: 'Suspensão de tributos federais para importação/aquisição de bens da indústria de petróleo',
    aplicacao: 'Empresas do setor petrolífero, gás natural',
    beneficios: ['Suspensão de IPI, II, PIS/COFINS Importação', 'Redução de IRPJ em alguns casos'],
  },

  // === REIDI (Infraestrutura) ===
  reidi: {
    baseLegal: 'Lei 11.488/2007',
    descricao: 'Regime Especial de Incentivos para o Desenvolvimento da Infraestrutura',
    aplicacao: 'Projetos de infraestrutura (energia, transporte, saneamento, irrigação)',
    beneficios: [
      'Suspensão PIS/COFINS sobre aquisição/importação de bens e serviços para o projeto',
      'Suspensão IPI sobre bens',
    ],
    habilitacao: 'Receita Federal + ministério setorial',
  },

  // === LEI ROUANET ===
  leiRouanet: {
    baseLegal: 'Lei 8.313/1991',
    descricao: 'Incentivo fiscal a projetos culturais',
    quemPodeUsar: 'Empresas no Lucro Real',
    limite: '4% do IRPJ devido (com sublimites por modalidade)',
    contrapartida: 'Apoiar projetos culturais aprovados pelo Minc',
    naoSimples: 'Não vale pra Simples Nacional nem Lucro Presumido',
  },

  // === LEI DO AUDIOVISUAL ===
  leiAudiovisual: {
    baseLegal: 'Lei 8.685/1993',
    descricao: 'Incentivo a obras audiovisuais brasileiras',
    limite: '3% do IRPJ devido',
    investimento: 'Aquisição de cotas de obras audiovisuais',
  },

  // === FUNDO DA CRIANÇA E DO ADOLESCENTE ===
  fia: {
    baseLegal: 'Lei 8.069/1990 (ECA) + Lei 12.594/2012',
    descricao: 'Doações aos Fundos dos Direitos da Criança e do Adolescente',
    limite: '1% do IRPJ devido (no Lucro Real)',
    publicoAlvo: 'Empresas no Lucro Real',
  },

  // === PROGRAMA MOVER ===
  mover: {
    baseLegal: 'Lei 14.902/2024',
    descricao: 'Programa de Mobilidade Verde e Inovação (sucessor do Rota 2030)',
    aplicacao: 'Indústria automobilística',
    beneficios: [
      'Crédito de IRPJ proporcional a investimentos em P&D',
      'Redução de IPI conforme eficiência energética',
      'Apoio a tecnologias de descarbonização',
    ],
    vigencia: '2024-2028 (atualmente)',
  },

  // === SUDAM / SUDENE ===
  incentivosRegionais: {
    sudam: {
      regiao: 'Amazônia Legal',
      reducaoIRPJ: '75% sobre lucro da exploração (atividades prioritárias)',
      baseLegal: 'Lei 9.808/1999',
    },
    sudene: {
      regiao: 'Nordeste + parte de MG/ES',
      reducaoIRPJ: '75% sobre lucro da exploração',
      baseLegal: 'Lei 9.808/1999',
    },
    atividadesPrioritarias: ['Agricultura/agroindústria', 'Indústria de transformação', 'Turismo'],
    prazo: 'Até 10 anos por projeto',
  },

  // === DRAWBACK ===
  drawback: {
    baseLegal: 'Lei 11.945/2009 + IN RFB 1.911/2019',
    descricao: 'Suspensão/restituição de tributos sobre insumos importados para produtos exportados',
    modalidades: [
      'Drawback Suspensão (mais comum)',
      'Drawback Isenção',
      'Drawback Restituição',
      'Drawback Integrado (PIS/COFINS + IPI + II)',
    ],
    publicoAlvo: 'Indústria exportadora',
  },

  // === SIMPLES NACIONAL — BENEFÍCIOS ESTADUAIS ===
  beneficiosEstaduaisSimples: {
    descricao: 'Estados podem conceder benefícios ICMS específicos para Simples',
    exemplos: [
      'SP — Programa de Estímulo (REPI) para indústrias',
      'MG — REGIME ESPECIAL ICMS para varejo',
      'RS — Reduções em produtos específicos (cesta básica, vestuário infantil)',
      'PR — Diferimento ICMS em algumas operações',
    ],
    naoSimulado: 'Validar caso a caso com contador local',
  },

  // === EVENTUAIS DESONERAÇÕES SETORIAIS ===
  desoneracaoFolha: {
    baseLegal: 'Lei 12.546/2011 (CPRB)',
    status: 'Em fase de extinção gradual (Lei 14.973/2024)',
    setores: 'Tecnologia, calçados, têxtil, construção (vários setores)',
    funcionamento: 'Empresa paga 1-4,5% sobre receita bruta em vez de 20% sobre folha',
    cronograma: 'Reoneração gradual até 2027',
  },
} as const

export type BeneficiosFiscaisKnowledge = typeof BENEFICIOS_FISCAIS
