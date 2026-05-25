// Sprint 5.0.2.c — Knowledge Base: Reforma Tributária 2026-2033
//
// Fonte: EC 132/2023, LC 214/2025, regulamentações 2025-2026.

export const REFORMA_TRIBUTARIA = {
  versao: '2026',

  baseLegal: {
    emenda: 'EC 132/2023',
    leiComplementar: 'LC 214/2025 (regulamentação principal)',
    leisComplementaresAdicionais: [
      'LC 215/2025 (Comitê Gestor IBS)',
      'LC 216/2025 (administração tributária)',
    ],
  },

  // === TRIBUTOS NOVOS ===
  tributos: {
    cbs: {
      nome: 'Contribuição sobre Bens e Serviços',
      esfera: 'Federal',
      substitui: ['PIS', 'COFINS', 'IPI (parcialmente)'],
      aliquotaPadraoEstimada: 8.8, // Estimativa CGN 2024
      regime: 'Não-cumulativo pleno (crédito amplo)',
    },
    ibs: {
      nome: 'Imposto sobre Bens e Serviços',
      esfera: 'Estados + Municípios (gestão compartilhada via Comitê Gestor)',
      substitui: ['ICMS', 'ISS'],
      aliquotaPadraoEstimada: 17.7, // Estimativa CGN 2024
      regime: 'Não-cumulativo pleno (crédito amplo)',
    },
    impostoSeletivo: {
      nome: 'Imposto Seletivo (IS)',
      esfera: 'Federal',
      aplicacao: 'Bens e serviços prejudiciais à saúde ou meio ambiente',
      exemplos: ['Cigarros', 'Bebidas alcoólicas', 'Bebidas açucaradas', 'Combustíveis fósseis', 'Veículos poluentes'],
      objetivo: 'Desestímulo ao consumo (sucessor do IPI seletivo)',
    },
  },

  // === CRONOGRAMA ===
  cronograma: {
    '2026': {
      cbs: 'Implementação experimental: 0,9% (sem cobrança efetiva, apenas declaratória)',
      ibs: 'Teste de 0,1% (também sem cobrança efetiva)',
      pisCofins: 'Continuam vigentes na cobrança',
      icmsIss: 'Continuam vigentes',
      observacao: 'Empresas devem se preparar (sistemas, contabilidade)',
    },
    '2027': {
      cbs: 'PLENA — extingue PIS e COFINS no mesmo ano',
      ibs: '0,05% efetivo (calibração estados)',
      pisCofins: 'EXTINTOS',
      icmsIss: 'Continuam',
      reducaoIPI: 'Alíquotas zeradas (exceto ZFM)',
    },
    '2028': {
      cbs: 'Plena',
      ibs: 'Mantém 0,05%',
      icmsIss: 'Inalterados',
    },
    '2029': {
      ibs: 'Inicia transição: 10% do ICMS substituído pelo IBS',
      icmsIss: '90% do volume original',
    },
    '2030': {
      ibs: '20%',
      icmsIss: '80%',
    },
    '2031': {
      ibs: '30%',
      icmsIss: '70%',
    },
    '2032': {
      ibs: '40%',
      icmsIss: '60%',
    },
    '2033': {
      ibs: '100% (plena)',
      icmsIss: 'EXTINTOS',
      observacao: 'Reforma totalmente implementada',
    },
  },

  // === REGIMES DIFERENCIADOS ===
  regimesDiferenciados: {
    saude: {
      reducao: 60, // % de redução nas alíquotas IBS+CBS
      atividadesCobertas: [
        'Hospitais, clínicas, laboratórios',
        'Consultas médicas, odontológicas',
        'Academias e atividades físicas (saúde preventiva)',
        'Medicamentos de uso humano (lista PMVG)',
        'Dispositivos médicos',
      ],
      baseLegal: 'LC 214/2025 art. 124',
    },
    educacao: {
      reducao: 60,
      atividadesCobertas: [
        'Ensino infantil, fundamental, médio, superior',
        'Cursos profissionalizantes',
        'Material didático específico',
      ],
    },
    transporte: {
      reducao: 60,
      atividadesCobertas: ['Transporte coletivo público de passageiros'],
    },
    cultura: {
      reducao: 60,
      atividadesCobertas: ['Atividades culturais cadastradas', 'Produção audiovisual'],
    },
    agropecuaria: {
      reducao: 60,
      detalhes: 'Insumos agropecuários, produtos in natura',
    },
    aliquotaZero: {
      atividadesCobertas: [
        'Cesta básica nacional (lista LC 214/2025 anexo)',
        'Produtos hortícolas, frutas, ovos',
        'Medicamentos de doenças graves',
        'Dispositivos para pessoas com deficiência',
      ],
    },
  },

  // === SPLIT PAYMENT ===
  splitPayment: {
    descricao: 'Recolhimento de IBS/CBS no momento do pagamento',
    funcionamento: 'Adquirente segrega valor do tributo e recolhe direto ao governo',
    pagador: 'Adquirente (cliente)',
    afeta: 'Toda cadeia (B2B principalmente)',
    vantagens: ['Reduz inadimplência fiscal', 'Acelera recebimento pelo governo'],
    desafios: ['Sistemas precisam adaptar', 'Fluxo de caixa diferente'],
    implementacao: 'Gradual a partir de 2027',
  },

  // === CASHBACK ===
  cashback: {
    descricao: 'Devolução de tributo a famílias de baixa renda',
    publicoAlvo: 'Cadastrados CadÚnico com renda até 1/2 SM per capita',
    operacionalizacao: 'Devolução automática via cartão social ou conta poupança',
    itens: 'Determinados produtos da cesta básica + serviços essenciais (energia, água, gás)',
    baseLegal: 'LC 214/2025 art. 87',
  },

  // === COMITÊ GESTOR DO IBS ===
  comiteGestor: {
    composicao: '27 Estados + DF + representantes municipais',
    funcao: 'Gestão compartilhada da arrecadação IBS',
    sede: 'Brasília-DF',
    baseLegal: 'LC 215/2025',
  },

  // === REGIME DE TRANSIÇÃO ===
  regimeTransicao: {
    creditosAcumulados: {
      icms: 'Empresas com créditos de ICMS acumulados poderão usá-los até 240 meses (20 anos) a partir de 2033',
      pisCofins: 'Saldo credor convertido em CBS proporcionalmente',
    },
    incentivosFiscais: {
      regra: 'Incentivos ICMS/ISS extintos junto com os tributos (2033)',
      compensacao: 'Fundo Nacional de Desenvolvimento Regional (FNDR) — R$ 60 bi/ano',
    },
    zonaFrancaManaus: {
      preservacao: 'Mantida em texto constitucional (EC 132 art. 92-A do ADCT)',
      detalhes: 'Estudos de operacionalização em curso',
    },
  },

  // === IMPACTOS POR SETOR ===
  impactosPorSetor: {
    comercio: {
      diagnostico: 'Beneficiado pela não-cumulatividade ampla',
      vantagens: ['Crédito sobre tudo que entra', 'Reduz cumulatividade do ICMS-ST'],
      atencao: ['Adequação de sistemas', 'Renegociação com fornecedores'],
    },
    industria: {
      diagnostico: 'Tendência neutra a positiva',
      vantagens: ['Crédito de IBS/CBS sobre insumos', 'Fim do IPI cumulativo'],
      atencao: ['Imposto Seletivo se aplicável (cigarros, bebidas)', 'Logística inter-estadual'],
    },
    servicos: {
      diagnostico: 'CARGA TENDE A AUMENTAR (alíquota IBS/CBS > ISS 5% atual)',
      mitigacoes: ['Crédito de IBS sobre insumos (não tinha no ISS)', 'Redução de 60% se saúde/educação'],
      atencao: 'Setor que mais perde no regime padrão',
    },
    restaurantes: {
      diagnostico: 'Setor recebe atenção especial',
      detalhe: 'Pode haver alíquota reduzida específica para o setor (em negociação)',
      perse: 'Continua vigente até dezembro/2026',
    },
    academias: {
      diagnostico: 'BENEFICIADAS — redução de 60% por classificação saúde',
      baseLegal: 'LC 214/2025 art. 124',
    },
  },

  // === DECISÃO PARA EMPRESAS DO SIMPLES ===
  decisaoSimples: {
    prazo: 'Setembro de 2026',
    alternativas: [
      {
        opcao: 'A — Manter Simples 100%',
        funcionamento: 'DAS unificado continua, sem destaque de IBS/CBS na NF',
        prosCons: {
          pro: ['Simples como sempre', 'Sem complexidade'],
          contra: ['Clientes PJ não têm direito a crédito', 'Pode perder competitividade B2B'],
        },
      },
      {
        opcao: 'B — Híbrido (destaque IBS/CBS)',
        funcionamento: 'Mantém Simples mas destaca IBS/CBS na NF (clientes PJ ganham crédito)',
        prosCons: {
          pro: ['Competitivo no B2B', 'Cliente PJ aproveita crédito'],
          contra: ['Empresa paga IBS/CBS ADICIONAL ao DAS', 'Complexidade fiscal'],
        },
      },
      {
        opcao: 'C — Sair do Simples',
        funcionamento: 'Optar por Lucro Presumido ou Real',
        prosCons: {
          pro: ['Crédito pleno de IBS/CBS', 'Possível economia em margens baixas'],
          contra: ['Mais obrigações acessórias', 'Cálculo mais complexo'],
        },
      },
    ],
    fatoresDecisao: [
      'Mix B2B vs B2C (PJ valoriza crédito, PF não)',
      'Margem de operação',
      'Setor (alguns têm redução 60%)',
      'Complexidade aceitável',
    ],
  },
} as const

export type ReformaTributariaKnowledge = typeof REFORMA_TRIBUTARIA
