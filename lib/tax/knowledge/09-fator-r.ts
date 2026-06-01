// Sprint 5.0.2.c — Knowledge Base: Fator R (Simples Nacional)

export const FATOR_R = {
  versao: '2026',

  baseLegal: {
    lei: 'LC 123/2006 art. 18 §5º-A a §5º-O',
    introducao: 'LC 155/2016',
    regulamentacao: 'Resolução CGSN 140/2018 art. 26',
  },

  conceito: {
    oQueE:
      'Razão entre a folha de salários e a receita bruta nos últimos 12 meses. Define se atividades de serviços ficam no Anexo III (favorável) ou Anexo V (oneroso) do Simples.',
    threshold: 0.28, // 28%
    comportamento: {
      fatorRMaiorIgual28pct: 'Atividade enquadrada no ANEXO III (alíquota inicial 6%)',
      fatorRMenor28pct: 'Atividade migra para ANEXO V (alíquota inicial 15,5%)',
    },
    importancia: 'Pode representar economia de 9,5 pontos percentuais (R$ ~95k/ano em empresa R$ 1M)',
  },

  formula: {
    expressao: 'Fator R = Folha de Salários (12m) / Receita Bruta (12m)',
    simbolico: 'FR = FS / RB',
    detalhamento: {
      folhaSalarios: 'Soma dos últimos 12 meses (rolling window)',
      receitaBruta: 'Soma dos últimos 12 meses (RBA12m)',
      novaEmpresa: 'Proporcionalidade — usa meses já decorridos',
    },
  },

  // === O QUE COMPUTA NA FOLHA ===
  oQueComputaFolha: {
    incluso: [
      {
        item: 'Salários CLT',
        detalhe: 'Vencimentos brutos (antes dos descontos do funcionário)',
        baseLegal: 'CGSN 140/2018 art. 26 §1º',
      },
      {
        item: 'Pró-labore de sócios',
        detalhe: 'Valor declarado mensalmente, sujeito a INSS 11%',
        observacao: 'Maior alavanca de Fator R em empresas pequenas',
      },
      {
        item: 'INSS patronal (cota empresa)',
        detalhe: 'Contribuição previdenciária patronal sobre folha (CPP)',
        aliquota: '20% padrão (variável por enquadramento)',
      },
      {
        item: 'FGTS',
        detalhe: '8% sobre a folha (depositado mensalmente)',
      },
      {
        item: '13º salário',
        detalhe: 'Provisionado ao longo do ano + adicional de 1/3',
      },
      {
        item: 'Férias + adicional 1/3',
        detalhe: 'Provisão proporcional',
      },
      {
        item: 'Outros encargos sociais',
        detalhe: 'RAT, FAP, salário-educação, INCRA, SEBRAE, SENAI, SESI, etc',
      },
    ],
    excluso: [
      'Aluguel de imóvel/equipamentos',
      'Energia elétrica, água, telecomunicações',
      'Material de consumo e expediente',
      'Despesas com terceiros (PJ ou MEI)',
      'Despesas financeiras (juros, IOF)',
      'Distribuição de lucros aos sócios',
      'Pagamentos a profissionais autônomos PF (RPA) — geram ISS mas não entram na folha',
      'Despesas de marketing, publicidade',
      'Impostos e taxas em geral',
    ],
  },

  // === ATIVIDADES SUJEITAS A FATOR R ===
  atividadesSujeitas: {
    descricao: 'Atividades listadas no §5º-D do art. 18 da LC 123/2006',
    exemplos: [
      'Academias de ginástica/condicionamento físico (9313-1/00)',
      'Empresas montadoras de estandes',
      'Laboratórios de análises clínicas',
      'Medicina, medicina laboratorial e tratamento de dependentes químicos',
      'Odontologia',
      'Psicologia',
      'Fisioterapia, fonoaudiologia, terapia ocupacional',
      'Atividades de jardinagem',
      'Limpeza, conservação, manutenção predial',
      'Engenharia, arquitetura, geologia, agronomia',
      'Consultoria empresarial, em gestão',
      'Auditoria',
      'Tradução, interpretação',
      'Cinegrafia, fotografia',
      'Outras atividades de serviços profissionais',
    ],
    naoSujeitas: 'Comércio (Anexo I), Indústria (Anexo II), Serviços §5º-C art. 18 LC 123 (sempre Anexo IV)',
  },

  // === ESTRATÉGIAS DE OTIMIZAÇÃO ===
  estrategiasOtimizacao: [
    {
      tatica: 'Aumentar pró-labore dos sócios',
      explicacao:
        'Pró-labore conta como folha. Cada R$ 1 de pró-labore aumenta o Fator R sem precisar de contratação CLT',
      custoAdicional: 'INSS sócio 11% (limite teto INSS)',
      quandoUsar: 'Empresa pequena/média com folha próxima ao threshold',
    },
    {
      tatica: 'Contratar CLT em vez de MEI/PJ',
      explicacao: 'Funcionários CLT geram salário + encargos que entram no Fator R. MEI/PJ não conta',
      custoAdicional: 'Encargos trabalhistas ~70-80% sobre salário base',
      quandoUsar: 'Quando atividade é estrutural (não terceirização legítima)',
    },
    {
      tatica: 'Internalizar funções terceirizadas',
      explicacao: 'Funções operacionais que estão terceirizadas via PJ podem voltar pra CLT',
      atencao: 'Análise de viabilidade econômica (CLT mais caro mas ganha 9,5 p.p. no Simples)',
    },
    {
      tatica: 'Monitorar mensalmente',
      explicacao:
        'NÃO esperar fechamento anual. Calcular Fator R todo mês e ajustar pró-labore antes do fechamento',
      ferramenta: 'CAIXAOS calcula automaticamente (expertise engine)',
    },
    {
      tatica: 'Sazonalizar pró-labore',
      explicacao:
        'Pró-labore pode variar mês a mês. Em meses de receita alta, aumentar pró-labore pra manter razão',
      atencao: 'Documentar formalmente em alteração contratual',
    },
  ],

  // === CASOS DE USO ===
  casosUso: {
    academia: {
      perfilTipico: 'Receita R$ 50k/mês, funcionários (instrutores, recepção) custam R$ 15k+/mês',
      fatorRTipico: '~30-40% (folha pesada)',
      diagnostico: 'GERALMENTE Anexo III. Mas se terceirizar tudo via MEI, despenca pro Anexo V',
      acao: 'Manter CLT, monitorar mensalmente',
    },
    restauranteBuffet: {
      perfilTipico: 'Restaurante com buffet/eventos — parte cai no Anexo I (comércio), parte no III/V',
      atencao: 'LC 192/2022 garante Anexo I para serviço presencial; buffet/eventos podem cair III/V',
      acao: 'Segregar receitas, calcular Fator R para porção elegível',
    },
    consultoriaSP: {
      perfilTipico: 'Consultoria com 2 sócios, folha baixa (CLT zero), receita R$ 30k/mês',
      fatorRTipico: '0% (sem folha)',
      diagnostico: 'ANEXO V — alíquota inicial 15,5%',
      acao: 'Aumentar pró-labore dos sócios para R$ ~9k/mês total (28% de R$ 30k)',
      observacao: 'Custo adicional INSS 11% × R$ 9k = R$ 990/mês; economia Fator R = R$ 30k × 9,5% = R$ 2.850/mês. Vale a pena',
    },
    serviçosTI: {
      perfilTipico: 'Software house, desenvolvimento sob encomenda',
      receitaAltaFolhaBaixa: 'TI tipicamente tem margem 30-50%, folha < 28%',
      diagnostico: 'Anexo V provável',
      acao: 'Avaliar contratação CLT vs pró-labore alto',
    },
  },

  // === ERROS COMUNS ===
  errosComuns: [
    {
      erro: 'Não computar pró-labore como folha',
      consequencia: 'Subestima Fator R — fica no Anexo V quando deveria estar no III',
      correcao: 'Incluir pró-labore na soma da folha 12m',
    },
    {
      erro: 'Computar despesa com PJ/MEI como folha',
      consequencia: 'Superestima Fator R — autuação retroativa quando descoberto',
      correcao: 'PJ/MEI não conta. Só CLT + pró-labore + encargos',
    },
    {
      erro: 'Calcular apenas anualmente',
      consequencia: 'Descobrir tarde demais. Não tem como ajustar retroativo',
      correcao: 'Calcular mensalmente, ajustar pró-labore antes do fechamento',
    },
    {
      erro: 'Não considerar 13º e férias provisionados',
      consequencia: 'Subestima folha',
      correcao: 'Provisão proporcional (1/12 do salário + adicional)',
    },
  ],

  // === REFORMA TRIBUTÁRIA E FATOR R ===
  reformaImpacto: {
    permanenceSimples: 'Simples Nacional continua existindo na reforma',
    fatorRPermanente: 'Mecanismo do Fator R mantido enquanto o Simples existir',
    decisao2026: 'Empresa decide em setembro/2026 se mantém regime Simples ou migra parcialmente',
  },
} as const

export type FatorRKnowledge = typeof FATOR_R
