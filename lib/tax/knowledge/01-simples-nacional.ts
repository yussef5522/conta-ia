// Sprint 5.0.2.c — Knowledge Base: Simples Nacional 2026
//
// Fonte primária: Lei Complementar 123/2006 + atualizações (LC 147/2014,
// LC 155/2016, LC 167/2019, LC 192/2022, LC 199/2023).
// Tabelas e limites válidos pra ano-calendário 2026.

export const SIMPLES_NACIONAL = {
  versao: '2026',

  baseLegal: {
    lei: 'Lei Complementar 123/2006',
    regulamento: 'Resolução CGSN 140/2018',
    atualizacoes: [
      { norma: 'LC 147/2014', escopo: 'Universalização de atividades de serviço' },
      { norma: 'LC 155/2016', escopo: 'Fator R, MEI, novos tetos' },
      { norma: 'LC 167/2019', escopo: 'Investidor-anjo' },
      { norma: 'LC 192/2022', escopo: 'Lei dos Restaurantes (garantia Anexo I)' },
      { norma: 'LC 199/2023', escopo: 'Estatuto Nacional de Simplificação Tributária' },
    ],
  },

  // === LIMITES VIGENTES 2026 ===
  limites: {
    globalAnual: 4_800_000, // R$ 4,8M
    sublimiteICMS_ISS: 3_600_000, // R$ 3,6M (estados podem optar entre 1,8M / 2,52M / 3,6M)
    mei: 81_000, // R$ 81 mil/ano (LC 167/2019)
    meiCaminhoneiro: 251_600, // R$ 251.600 (LC 188/2021)
    mensalProporcional: 400_000, // R$ 400k/mês (4,8M / 12)

    // Extrapolações
    extrapolacaoAte20pct: {
      teto: 5_760_000, // 4,8M × 1,20
      consequencia: 'Continua no Simples até dezembro, exclusão a partir do ano seguinte',
    },
    extrapolacaoAcima20pct: {
      consequencia: 'Exclusão imediata, retroativa ao mês de excesso',
    },

    datasCriticas: {
      adesaoNovasEmpresas: 'Até 30 dias da inscrição CNPJ ou até janeiro do ano-calendário',
      adesaoExistentes: 'Janeiro — até o último dia útil',
      desistencia: 'Janeiro — até o último dia útil (efeito no mesmo ano)',
      pagamentoDAS: 'Dia 20 do mês seguinte ao período de apuração',
      defisDeclaracao: 'Anual, até 31 de março do ano seguinte',
      pgdasD: 'Mensal, até dia 20 (mesmo dia do DAS)',
    },
  },

  // === IMPEDIMENTOS / VEDAÇÕES ===
  impedimentos: {
    socioPJ: {
      regra: 'Sócio pessoa jurídica veda Simples',
      excecoes: [
        'Investidor-anjo via LC 155/2016 (capital social até 50%)',
        'Cooperativa de produtores rurais (situações específicas)',
      ],
    },
    socioEmOutraEmpresa: {
      regra: 'Sócio que possui >10% em outra empresa pode impedir, se soma de receitas > R$ 4,8M',
      atencao: 'Análise caso a caso',
    },
    debitosFiscais: {
      regra: 'Empresa não pode ter débitos exigíveis com União/Estado/Município',
      remediacao: 'Parcelar débitos pela Lei 11.941/09 ou similar antes da adesão',
    },
    atividadesVedadas: [
      'Bancos comerciais, de investimentos, de desenvolvimento, caixas econômicas',
      'Cooperativas (exceto consumo e crédito)',
      'Sociedades de crédito, financeiras, factoring',
      'Corretoras de títulos, valores mobiliários, câmbio',
      'Distribuidoras de valores mobiliários',
      'Sociedades de capitalização',
      'Empresas de seguros privados',
      'Sociedades de arrendamento mercantil (leasing)',
      'Empresas de previdência privada aberta',
      'Loteamento e incorporação de imóveis',
      'Locação de imóveis próprios (exceto quando explorado por meio de imobiliária)',
      'Cessão ou locação de mão de obra (exceto vigilância, limpeza, conservação)',
      'Importação ou fabricação de automóveis e motocicletas',
      'Importação de combustíveis',
      'Geração, transmissão, distribuição ou comercialização de energia elétrica',
      'Geração e venda de bens com benefício fiscal de zona franca/região',
      'Atividades de serviços previstas no §5º-D do art. 17 da LC 123 (exceto Anexo IV)',
    ],
  },

  // === ANEXOS ===
  anexos: {
    anexoI: {
      titulo: 'Comércio',
      atividadesPrincipais: 'Comércio varejista e atacadista em geral',
      cnaesExemplos: [
        '4711-3/01 Hipermercados',
        '4712-1/00 Minimercados, mercearias',
        '4721-1/02 Padarias e confeitarias (revenda)',
        '4741-5/00 Material de construção',
        '4744-0/01 Comércio de ferragens',
        '4751-2/00 Equipamentos de informática',
        '4754-7/01 Móveis',
        '4761-0/01 Livrarias',
        '4771-7/01 Farmácias',
        '4781-4/00 Vestuário',
        '4782-2/01 Calçados',
        '4789-0/01 Artigos esportivos',
        '5611-2/01 Restaurantes (LC 192/2022 — garantido Anexo I)',
      ],
      faixas: [
        { num: 1, rbaMin: 0, rbaMax: 180_000, aliquota: 4.0, deduzir: 0 },
        { num: 2, rbaMin: 180_000.01, rbaMax: 360_000, aliquota: 7.3, deduzir: 5_940 },
        { num: 3, rbaMin: 360_000.01, rbaMax: 720_000, aliquota: 9.5, deduzir: 13_860 },
        { num: 4, rbaMin: 720_000.01, rbaMax: 1_800_000, aliquota: 10.7, deduzir: 22_500 },
        { num: 5, rbaMin: 1_800_000.01, rbaMax: 3_600_000, aliquota: 14.3, deduzir: 87_300 },
        { num: 6, rbaMin: 3_600_000.01, rbaMax: 4_800_000, aliquota: 19.0, deduzir: 378_000 },
      ],
      distribuicaoFaixa1: {
        irpj: 5.5,
        csll: 3.5,
        cofins: 12.74,
        pis: 2.76,
        cpp: 41.5,
        icms: 34.0,
      },
      observacoes: [
        'ICMS-ST: produtos com substituição tributária NÃO entram na base de cálculo do Simples',
        'PIS/COFINS monofásico (bebidas, combustíveis): segregar do faturamento',
        'Devoluções: deduzir da receita do mês',
      ],
    },

    anexoII: {
      titulo: 'Indústria',
      atividadesPrincipais: 'Indústria de transformação, beneficiamento e montagem',
      cnaesExemplos: [
        '1011-2/01 Frigoríficos',
        '1052-0/00 Fabricação de laticínios',
        '1061-9/01 Beneficiamento de arroz',
        '1071-6/00 Fabricação de açúcar',
        '1411-8/01 Confecção de peças do vestuário',
        '1611-9/00 Desdobramento de madeira',
        '1731-1/00 Fabricação de embalagens de papel',
        '2542-0/00 Fabricação de artigos de metal para uso doméstico',
      ],
      faixas: [
        { num: 1, rbaMin: 0, rbaMax: 180_000, aliquota: 4.5, deduzir: 0 },
        { num: 2, rbaMin: 180_000.01, rbaMax: 360_000, aliquota: 7.8, deduzir: 5_940 },
        { num: 3, rbaMin: 360_000.01, rbaMax: 720_000, aliquota: 10.0, deduzir: 13_860 },
        { num: 4, rbaMin: 720_000.01, rbaMax: 1_800_000, aliquota: 11.2, deduzir: 22_500 },
        { num: 5, rbaMin: 1_800_000.01, rbaMax: 3_600_000, aliquota: 14.7, deduzir: 85_500 },
        { num: 6, rbaMin: 3_600_000.01, rbaMax: 4_800_000, aliquota: 30.0, deduzir: 720_000 },
      ],
      observacoes: [
        'IPI substitui ICMS em algumas operações (verificar TIPI)',
        'Crédito presumido pra exportação não se aplica ao Simples',
      ],
    },

    anexoIII: {
      titulo: 'Serviços com Fator R',
      atividadesPrincipais:
        'Serviços de natureza intelectual + atividades onde a folha de salários é relevante',
      cnaesExemplos: [
        '5611-2/01 Restaurantes (categorizado no I por LC 192/2022, mas eventos podem cair aqui)',
        '8011-1/01 Serviços de jardinagem',
        '8121-4/00 Limpeza em prédios e domicílios',
        '8650-0/03 Atividades de psicologia',
        '8650-0/04 Atividades de fonoaudiologia',
        '9001-9/01 Produção teatral',
        '9101-5/00 Atividades de bibliotecas e arquivos',
        '9313-1/00 Academia de ginástica (se Fator R ≥ 28%)',
      ],
      faixas: [
        { num: 1, rbaMin: 0, rbaMax: 180_000, aliquota: 6.0, deduzir: 0 },
        { num: 2, rbaMin: 180_000.01, rbaMax: 360_000, aliquota: 11.2, deduzir: 9_360 },
        { num: 3, rbaMin: 360_000.01, rbaMax: 720_000, aliquota: 13.5, deduzir: 17_640 },
        { num: 4, rbaMin: 720_000.01, rbaMax: 1_800_000, aliquota: 16.0, deduzir: 35_640 },
        { num: 5, rbaMin: 1_800_000.01, rbaMax: 3_600_000, aliquota: 21.0, deduzir: 125_640 },
        { num: 6, rbaMin: 3_600_000.01, rbaMax: 4_800_000, aliquota: 33.0, deduzir: 648_000 },
      ],
      fatorR: {
        formula: '(Folha + Pró-labore + Encargos últimos 12m) / RBA últimos 12m',
        threshold: 0.28,
        comportamento: 'Se Fator R ≥ 28%, atividade fica no III. Se < 28%, vai pro V.',
        oQueComputaNaFolha: [
          'Salários CLT (vencimentos brutos)',
          'Pró-labore dos sócios',
          'INSS patronal (cota empresa)',
          'FGTS',
          '13º salário e adicional de férias (1/3)',
          'Demais encargos da legislação trabalhista',
        ],
        oQueNaoCompta: [
          'Aluguel, energia, água',
          'Material de consumo',
          'Serviços de terceiros (PJ)',
          'Despesas financeiras',
          'Distribuição de lucros',
          'Pagamento a MEI ou pessoa jurídica',
        ],
        estrategiasOtimizacao: [
          'Aumentar pró-labore dos sócios (entra como folha + gera CPP)',
          'Contratar CLT em vez de MEI/PJ para funções-chave',
          'Não terceirizar atividade-fim',
          'Monitorar Fator R mensalmente (não esperar fechamento anual)',
        ],
      },
    },

    anexoIV: {
      titulo: 'Serviços específicos (construção, vigilância, limpeza)',
      atividadesPrincipais:
        'Construção civil, vigilância, limpeza, conservação, obras + atividades do §5º-C, art. 18 LC 123',
      cnaesExemplos: [
        '4120-4/00 Construção de edifícios',
        '4292-8/01 Montagem de estruturas metálicas',
        '4391-6/00 Obras de fundações',
        '8011-1/01 Serviços de vigilância',
        '8121-4/00 Limpeza em prédios',
        '8130-3/00 Atividades paisagísticas',
      ],
      faixas: [
        { num: 1, rbaMin: 0, rbaMax: 180_000, aliquota: 4.5, deduzir: 0 },
        { num: 2, rbaMin: 180_000.01, rbaMax: 360_000, aliquota: 9.0, deduzir: 8_100 },
        { num: 3, rbaMin: 360_000.01, rbaMax: 720_000, aliquota: 10.2, deduzir: 12_420 },
        { num: 4, rbaMin: 720_000.01, rbaMax: 1_800_000, aliquota: 14.0, deduzir: 39_780 },
        { num: 5, rbaMin: 1_800_000.01, rbaMax: 3_600_000, aliquota: 22.0, deduzir: 183_780 },
        { num: 6, rbaMin: 3_600_000.01, rbaMax: 4_800_000, aliquota: 33.0, deduzir: 828_000 },
      ],
      observacoes: [
        'CPP NÃO está incluído nas alíquotas (recolhe pela folha em GFIP)',
        'INSS sobre a folha recolhe à parte (20% empresa + RAT/FAP)',
      ],
    },

    anexoV: {
      titulo: 'Serviços sem Fator R',
      atividadesPrincipais:
        'Serviços de natureza intelectual onde a folha é baixa em relação à receita',
      cnaesExemplos: [
        '6201-5/00 Desenvolvimento de programas de computador sob encomenda',
        '7020-4/00 Atividades de consultoria em gestão empresarial',
        '7311-4/00 Agências de publicidade',
        '7320-3/00 Pesquisas de mercado',
        '7410-2/01 Design e decoração de interiores',
        '7490-1/04 Atividades de intermediação e agenciamento',
        '8230-0/02 Atividades de organização de feiras',
        '8550-3/02 Atividades de apoio à educação',
      ],
      faixas: [
        { num: 1, rbaMin: 0, rbaMax: 180_000, aliquota: 15.5, deduzir: 0 },
        { num: 2, rbaMin: 180_000.01, rbaMax: 360_000, aliquota: 18.0, deduzir: 4_500 },
        { num: 3, rbaMin: 360_000.01, rbaMax: 720_000, aliquota: 19.5, deduzir: 9_900 },
        { num: 4, rbaMin: 720_000.01, rbaMax: 1_800_000, aliquota: 20.5, deduzir: 17_100 },
        { num: 5, rbaMin: 1_800_000.01, rbaMax: 3_600_000, aliquota: 23.0, deduzir: 62_100 },
        { num: 6, rbaMin: 3_600_000.01, rbaMax: 4_800_000, aliquota: 30.5, deduzir: 540_000 },
      ],
      observacoes: [
        'Alíquota inicial de 15,5% é PUNITIVA. Fator R bem manejado evita',
        'Pode haver migração III ↔ V mês a mês conforme Fator R',
      ],
    },
  },

  // === CÁLCULO DAS ===
  calculoDAS: {
    formulaPasso1: 'Identificar Receita Bruta Acumulada últimos 12 meses (RBA12m)',
    formulaPasso2: 'Localizar faixa correspondente à RBA12m no Anexo aplicável',
    formulaPasso3: 'Aplicar fórmula da alíquota efetiva: ((RBA12m × AliquotaNominal) - ParcelaDeduzir) / RBA12m',
    formulaPasso4: 'DAS do mês = Receita Bruta do mês × Alíquota Efetiva',

    observacoes: [
      'Receita Bruta = Vendas + Serviços - Devoluções - Cancelamentos - Descontos Incondicionais',
      'NÃO inclui IPI, ICMS-ST destacado, descontos condicionais (depois da venda)',
      'Vendas a prazo: receita reconhecida no momento da emissão da NF, não do recebimento',
    ],

    quandoPagar: 'Até dia 20 do mês seguinte. Se cair em feriado/fim de semana, antecipa para o último dia útil anterior',
    comoPagar: 'DAS gerado no PGDAS-D (https://www8.receita.fazenda.gov.br/SimplesNacional/)',
    atrasoMultas: {
      multaMora: '0,33% ao dia, limitada a 20%',
      jurosSelic: 'Taxa SELIC mensal + 1% no mês de pagamento',
    },
  },

  // === SEGREGAÇÃO DE RECEITAS ===
  segregacaoReceitas: {
    importancia: 'Tributação diferenciada quando há produtos com regimes específicos',

    casos: [
      {
        situacao: 'Comércio que vende bebidas (ICMS-ST + PIS/COFINS monofásico)',
        recomendacao: 'Segregar receita de bebidas — NÃO entra na base do Simples',
        baseLegal: 'Convênio CONFAZ 142/2018 (ICMS-ST) + Lei 10.147/2000 (Monofásico)',
        economia: '5-15% sobre vendas de bebidas',
      },
      {
        situacao: 'Restaurante com salão + delivery + eventos',
        recomendacao: 'Mesmo Anexo I, mas segregar pra controle gerencial + PERSE',
        beneficio: 'Identificar receitas elegíveis ao PERSE (eventos)',
      },
      {
        situacao: 'Empresa com atividades de Anexos diferentes',
        recomendacao: 'Segregar por Anexo no PGDAS-D',
        baseLegal: 'Art. 25 da Resolução CGSN 140/2018',
      },
      {
        situacao: 'Comércio com exportação',
        recomendacao: 'Exportação tem alíquota 0% no Simples — segregar',
        baseLegal: 'Art. 14 da LC 123/2006',
      },
    ],
  },

  // === EXCLUSÕES DA BASE ===
  exclusoesDaBase: [
    {
      tipo: 'Substituição Tributária (ICMS-ST)',
      explicacao: 'ICMS já foi recolhido pelo fabricante/atacadista, não tributar de novo',
      legal: 'Convênio CONFAZ 142/2018',
      exemplosProdutos: ['Bebidas', 'Cigarros', 'Combustíveis', 'Medicamentos', 'Autopeças', 'Sorvetes'],
      comoFazer: 'No PGDAS-D, segregar receita do item ST',
    },
    {
      tipo: 'PIS/COFINS Monofásico',
      explicacao: 'PIS/COFINS recolhidos pelo fabricante/importador',
      legal: 'Lei 10.147/2000 (medicamentos, cosméticos), 10.485/2002 (autopeças), 10.336/2001 (combustíveis)',
      exemplosProdutos: ['Cervejas', 'Refrigerantes', 'Águas', 'Café', 'Medicamentos', 'Combustíveis', 'Veículos'],
      comoFazer: 'Segregar no PGDAS-D',
    },
    {
      tipo: 'Devoluções',
      explicacao: 'Mercadorias devolvidas pelos clientes — reduzir faturamento',
      comoFazer: 'Deduzir da receita do mês em que ocorreu a devolução',
    },
    {
      tipo: 'Cancelamentos de NF',
      explicacao: 'NFs canceladas no prazo legal (24h NFC-e, 168h NF-e)',
      comoFazer: 'Não computar a receita',
    },
    {
      tipo: 'Descontos incondicionais',
      explicacao: 'Descontos dados no momento da venda (impressos na NF)',
      comoFazer: 'Considerar valor líquido (faturado − desconto)',
    },
    {
      tipo: 'IPI',
      explicacao: 'IPI destacado na NF não é receita',
      comoFazer: 'Excluir da base',
    },
  ],

  // === REFORMA TRIBUTÁRIA — DECISÃO 2026 ===
  reformaTributariaImpacto: {
    decisaoSetembro2026: {
      oQueE: 'Empresa do Simples decide se mantém o regime ou opta por IBS/CBS dentro dos seus atos',
      prazoLimite: 'Setembro de 2026 (definido em LC 214/2025 transitória)',
      alternativas: [
        'Manter Simples 100% (mais simples, sem crédito para clientes)',
        'Permitir destaque de IBS/CBS (clientes PJ ganham crédito)',
        'Híbrido por atividade segregada',
      ],
      criteriosDecisao: [
        'Mix de clientes PF × PJ (PJs valorizam crédito)',
        'Cadeia de créditos próprios (compras com crédito)',
        'Margem de contribuição',
        'Setor (alguns têm redução IBS/CBS)',
      ],
    },
    cronograma2026_2033: {
      '2026': 'CBS 0,9% + IBS 0,1% (teste, sem cobrança efetiva)',
      '2027': 'CBS plena, PIS/COFINS extintos',
      '2028': 'CBS calibrada + IBS 0,05% (teste estados)',
      '2029_2032': 'Transição IBS (10% → 100%) + ICMS/ISS (90% → 0%)',
      '2033': 'IBS pleno, ICMS/ISS extintos',
    },
  },

  // === ERROS COMUNS ===
  errosComuns: [
    {
      erro: 'Não excluir ICMS-ST/monofásico da base',
      consequencia: 'Pagar tributo sobre algo já tributado (5-15% a mais)',
      prevencao: 'Segregar receitas no PGDAS-D, treinar PDV',
    },
    {
      erro: 'CNAE primário incorreto',
      consequencia: 'Anexo errado → alíquota errada → autuação retroativa',
      prevencao: 'Auditar CNAE quando mudar atividade; consultar contador',
    },
    {
      erro: 'Não monitorar Fator R',
      consequencia: 'Cair pro Anexo V (15,5%+) quando poderia ficar no III (6%+)',
      prevencao: 'Calcular Fator R mensalmente, ajustar pró-labore antes do fechamento',
    },
    {
      erro: 'Não declarar DEFIS',
      consequencia: 'Multa por atraso + exclusão do regime',
      prevencao: 'Cadastrar lembrete março/abril',
    },
    {
      erro: 'Sócio em outra empresa não declarado',
      consequencia: 'Exclusão retroativa do Simples + cobrança Lucro Presumido',
      prevencao: 'Auditoria societária anual',
    },
    {
      erro: 'Misturar receitas de Anexos diferentes sem segregar',
      consequencia: 'Alíquota maior aplicada a tudo (geralmente o pior anexo)',
      prevencao: 'Segregar no PGDAS-D, manter notas fiscais separadas',
    },
  ],

  // === MIGRAÇÃO DE REGIME ===
  migracao: {
    paraSimples: {
      requisitos: [
        'Faturamento últimos 12 meses ≤ R$ 4,8M (proporcional se < 12 meses)',
        'CNAE permitido (lista em LC 123/2006, art. 17)',
        'Sem débitos exigíveis com União/Estado/Município',
        'Sócios apenas PF (com exceções LC 155/2016)',
        'Não estar em atividade vedada',
      ],
      processoAdesao:
        'Portal do Simples Nacional > Adesão > Janeiro (último dia útil) — efeito imediato',
      documentos: 'Atualizar CNAE no CNPJ + quitar débitos + dados societários atualizados',
    },
    saidaSimples: {
      voluntaria: 'Portal Simples > Comunicação de exclusão até janeiro',
      compulsoria: 'Por extrapolação de limite ou outra vedação superveniente',
      retornoAposExclusao: 'Carência de 1 ano calendário (regra geral)',
    },
  },
} as const

export type SimplesNacionalKnowledge = typeof SIMPLES_NACIONAL
