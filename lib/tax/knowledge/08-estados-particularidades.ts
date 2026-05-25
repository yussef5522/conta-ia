// Sprint 5.0.2.c — Knowledge Base: Particularidades por UF

export const ESTADOS_PARTICULARIDADES = {
  versao: '2026',

  // === ICMS ALÍQUOTA INTERNA PADRÃO ===
  aliquotasInternasPadrao: {
    AC: 19,
    AL: 19,
    AM: 20,
    AP: 18,
    BA: 19,
    CE: 18,
    DF: 18,
    ES: 17,
    GO: 19,
    MA: 22,
    MG: 18,
    MS: 17,
    MT: 17,
    PA: 19,
    PB: 18,
    PE: 18.5,
    PI: 21,
    PR: 19.5,
    RJ: 22, // Inclui adicional FECP 2%
    RN: 18,
    RO: 19.5,
    RR: 20,
    RS: 17,
    SC: 17,
    SE: 19,
    SP: 18,
    TO: 20,
    observacao: 'Alíquotas atualizadas 2026. Variam pra produtos específicos.',
  },

  // === ALÍQUOTAS INTERESTADUAIS ===
  aliquotasInterestaduais: {
    geral: 12,
    sulSudeste_para_NorteNordestesCentroOeste: 7,
    exceto: 'ES (sul/sudeste alguns produtos podem ser 12%)',
    aliquotaProdutosImportados: 4, // Resolução SF 13/2012
    fundamentacao: 'Resolução Senado 22/1989 + 13/2012',
  },

  // === DIFAL (Diferencial de Alíquota) ===
  difal: {
    baseLegal: 'EC 87/2015 + LC 190/2022',
    aplicacao: 'Operações interestaduais destinadas a CONSUMIDOR FINAL não-contribuinte',
    formula: '(Alíquota interna destino − Alíquota interestadual) × Valor da operação',
    quemRecolhe: {
      eCommerce: 'Vendedor (origem) recolhe DIFAL para UF do destinatário',
      simplesNacional: 'Empresa do Simples recolhe DIFAL na entrada (LC 123 art. 13)',
    },
    fundo: 'Parte do DIFAL vai pro FECP (Fundo de Combate à Pobreza) em alguns estados',
  },

  // === SUBLIMITES SIMPLES POR ESTADO ===
  sublimitesSimples: {
    R$_1_800_000: ['AC', 'AP', 'RR'],
    R$_3_600_000: 'Demais 24 estados + DF (sublimite padrão)',
    observacao: 'Estados com sublimite menor: empresas perdem ICMS no Simples antes do limite global',
  },

  // === PARTICULARIDADES POR ESTADO (DESTAQUES) ===
  particularidadesEstaduais: {
    SP: {
      icms: '18% padrão; 12% para alguns produtos essenciais',
      regimesEspeciais: ['PEPRO (programa pra indústrias)', 'Crédito presumido para alguns setores'],
      stForte: 'SP tem ampla aplicação de ST',
      observacao: 'Maior arrecadação ICMS do país; fiscalização agressiva',
    },
    RJ: {
      icms: '20% padrão + 2% FECP = 22%',
      observacao: 'Inclusão do FECP eleva alíquota efetiva',
      regimesEspeciais: 'RECOMPE-RJ pra TI/audiovisual',
    },
    MG: {
      icms: '18% padrão; 12% pra cesta básica',
      regimesEspeciais: ['Crédito presumido pra MG-Cooperativas', 'PRODEMG (indústria)'],
      stForte: 'MG aplica ST em vestuário e construção',
    },
    RS: {
      icms: '17% padrão; reduções pra cesta básica e essenciais',
      regimesEspeciais: ['Programa Avançar', 'Diferimento de ICMS em setores estratégicos'],
      cashback: 'RS é pioneiro em cashback ICMS estadual',
      stVestuario: 'RS aplica ST em vestuário desde 2010',
    },
    PR: {
      icms: '19,5% padrão; 12% cesta básica',
      regimesEspeciais: 'Paraná Competitivo (indústrias)',
      stForte: 'PR aplica ST ampla em comércio',
    },
    SC: {
      icms: '17% padrão',
      regimesEspeciais: 'TTD (Tratamento Tributário Diferenciado) — programa estadual',
      polos: 'SC tem polos textil e moveleiro com regimes específicos',
    },
    BA: {
      icms: '19% padrão (subiu de 18% em 2024)',
      sudene: 'Empresas habilitadas BA têm redução IRPJ SUDENE',
    },
    GO: {
      icms: '19% padrão (subiu)',
      regimesEspeciais: 'Goiás aplicação de FOMENTAR pra atrair indústrias',
    },
    AM: {
      icms: 'Padrão 20%, mas com isenções pela ZFM',
      zfm: 'Centro principal da Zona Franca de Manaus',
      regimesEspeciais: 'Suframa administra incentivos',
    },
    DF: {
      icms: '18% padrão',
      observacao: 'Brasília tem regime próprio (não está em estado)',
      iss: 'ISS padrão 5% pra serviços',
    },
  },

  // === BENEFÍCIOS REGIONAIS ===
  beneficiosRegionais: {
    sudam: {
      area: 'Amazônia Legal (AC, AM, AP, MA-oeste, MT-norte, PA, RO, RR, TO)',
      reducaoIRPJ: '75% sobre lucro da exploração',
      atividades: 'Indústria, agropecuária, agroindústria, turismo, infraestrutura',
    },
    sudene: {
      area: 'Nordeste + parte norte de MG e ES',
      reducaoIRPJ: '75% sobre lucro da exploração',
      atividades: 'Indústria, agropecuária, agroindústria, turismo, infraestrutura',
    },
    zonaFrancaManaus: {
      area: 'Manaus e municípios autorizados de AM',
      incentivos: 'IPI, ICMS, IRPJ, PIS/COFINS',
      preservacao: 'Mantida pela EC 132/2023',
    },
  },

  // === REGRAS DE ISS (Municipal) ===
  iss: {
    competencia: 'Município (CF/88 art. 156 III)',
    aliquotaMinima: 2,
    aliquotaMaxima: 5,
    listaServicos: 'LC 116/2003',
    observacao: 'Aplica no local da prestação ou do estabelecimento prestador (varia por item)',
    municipiosComplexos: {
      SaoPaulo: '5% padrão pra maior parte dos serviços',
      RioJaneiro: '5% padrão',
      capitais: 'Maioria adota 5% pra maioria dos serviços',
      cidadeMenor: 'Algumas reduzem pra 2% pra atrair empresas (planejamento tributário)',
    },
  },

  // === REFORMA TRIBUTÁRIA E ESTADOS ===
  reformaImpacto: {
    icmsExtinto: '2033',
    issExtinto: '2033',
    ibsSubstitui: 'Gestão compartilhada via Comitê Gestor',
    perdaCompensacao: 'Estados/municípios compensados via FNDR (R$ 60 bi/ano)',
    incentivos: 'Incentivos estaduais ICMS extintos junto com o ICMS',
  },
} as const

export type EstadosParticularidadesKnowledge = typeof ESTADOS_PARTICULARIDADES
