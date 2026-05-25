// Sprint 5.0.2.c — Knowledge Base: Substituição Tributária do ICMS

export const SUBSTITUICAO_TRIBUTARIA = {
  versao: '2026',

  baseLegal: {
    constituicao: 'CF/88 art. 150 §7º',
    leiKandir: 'LC 87/1996 art. 6º-10',
    convenioPrincipal: 'Convênio CONFAZ ICMS 142/2018 (regras gerais)',
    ricmsEstaduais: 'Cada UF tem seu regulamento (RICMS/SP, RICMS/RJ, etc)',
  },

  conceito: {
    oQueE: 'Atribuição da responsabilidade pelo recolhimento do ICMS a um contribuinte diferente daquele que pratica a operação tributada',
    funcionamento:
      'Fabricante/atacadista calcula e recolhe o ICMS de toda a cadeia (incluindo o que o varejo "venderia" no futuro). Varejo recebe a mercadoria já com ICMS pago.',
    impactoSimples: 'Receita de produto ST NÃO entra na base de cálculo do Simples (Resolução CGSN 140/2018 art. 25)',
  },

  modalidades: {
    operacoesAnteriores: {
      descricao: 'ST sobre operações já praticadas (rara)',
      exemplo: 'Cooperativa retém ICMS do produtor rural',
    },
    operacoesConcomitantes: {
      descricao: 'ST simultânea à operação',
      exemplo: 'Frete contratado por industrial',
    },
    operacoesSubsequentes: {
      descricao: 'MODALIDADE MAIS COMUM — recolhimento antecipado pela cadeia',
      exemplo: 'Fabricante de cerveja recolhe ICMS de toda venda até o consumidor final',
    },
  },

  // === PRODUTOS NORMALMENTE SUJEITOS À ST ===
  produtosTipicos: {
    bebidas: {
      cervejas: 'Convênio ICMS 110/2006 (alíquota fabricante)',
      refrigerantes: 'Convênio ICMS 110/2006',
      aguas: 'Convênio ICMS 110/2006',
      energeticos: 'Convênio ICMS 110/2006',
      bebidasAlcoolicas: 'Convênio ICMS 142/2018',
      cafes: 'Convênio ICMS 142/2018 (alguns estados)',
    },
    combustiveis: {
      gasolina: 'Convênio ICMS 110/2007',
      diesel: 'Convênio ICMS 110/2007',
      gnv: 'Convênio ICMS 110/2007',
    },
    cigarrosTabaco: 'Convênio ICMS 142/2018',
    medicamentos: 'Convênio ICMS 76/1994',
    autopecas: 'Convênio ICMS 142/2018',
    sorvetes: 'Convênio ICMS 142/2018',
    materialConstrucao: 'Variável por UF',
    cimentos: 'Protocolo ICMS 11/1985',
    vestuario: 'Variável: SP, RJ, MG, RS, PR, SC aplicam; outros não',
    calcados: 'Variável por UF',
    cosmeticos: 'Convênio ICMS 142/2018',
  },

  // === CÁLCULO DA ST ===
  calculo: {
    formulaBase: 'ICMS-ST = (Base Cálculo × Alíquota Interna) − ICMS Próprio da Operação',

    baseCalculo: {
      formula: 'BC = (Preço da operação + IPI + Frete + Seguro + Outras Despesas) × (1 + MVA)',
      mva: 'Margem de Valor Agregado — % fixo por produto/UF',
      mvaAjustada: 'MVA ajustada quando UF origem ≠ UF destino (Convênio ICMS 35/2011)',
    },

    aliquotaInternaTipica: {
      SP: 18,
      RJ: 22, // adicional 2% FECP
      MG: 18,
      RS: 17,
      PR: 18,
      SC: 17,
      BA: 19,
      DF: 18,
    },

    exemploNumerico: {
      cenario: 'Cerveja de R$ 100 com MVA 50%, alíquota interna 18%, ICMS próprio 12%',
      bc: 100 * (1 + 0.5), // 150
      icmsTotal: 150 * 0.18, // 27
      icmsProprio: 100 * 0.12, // 12
      icmsST: 27 - 12, // 15
      observacao: 'R$ 15 recolhido pelo fabricante; varejo já recebe pago',
    },
  },

  // === COMO EXCLUIR DA BASE DO SIMPLES ===
  exclusaoSimples: {
    fundamento: 'Resolução CGSN 140/2018 art. 25 §1º IV',
    procedimento: [
      '1. Identificar mercadorias com ST (consultar nota de compra — campo "vICMSST" preenchido)',
      '2. Segregar a receita de venda dessas mercadorias',
      '3. No PGDAS-D, declarar a receita de ST separadamente',
      '4. Sistema desconta a parcela ICMS do DAS automaticamente',
    ],
    erroComum:
      'Comerciante que NÃO segrega paga ICMS dentro do DAS sobre produto que já teve ICMS recolhido pelo fabricante. Economia de 5-15% sobre vendas ST.',
  },

  // === ATENÇÕES E ARMADILHAS ===
  atencoes: [
    {
      tipo: 'Operações interestaduais',
      explicacao: 'MVA ajustada para evitar acumulação de ICMS',
      lei: 'Convênio ICMS 35/2011',
    },
    {
      tipo: 'Devoluções de mercadorias com ST',
      explicacao: 'Procedimento específico para reaver ICMS-ST pago',
      lei: 'Convênio ICMS 81/1993',
    },
    {
      tipo: 'Mudança de regime tributário',
      explicacao: 'Estoque de produtos ST pode gerar crédito/débito de transição',
      atencao: 'Calcular cuidadosamente saídas vs entradas',
    },
    {
      tipo: 'Diferencial de alíquota (DIFAL)',
      explicacao: 'Aplicável em compras interestaduais para uso/consumo',
      lei: 'EC 87/2015 + LC 190/2022',
    },
    {
      tipo: 'Restituição de ICMS-ST quando preço final < BC presumida',
      explicacao: 'Pode pleitear restituição se preço efetivo < preço presumido',
      lei: 'STF Tema 201 (Recurso Extraordinário 593849)',
      observacao: 'Direito reconhecido em 2017, restituição via processo administrativo',
    },
  ],

  // === REFORMA TRIBUTÁRIA E ST ===
  reformaImpacto: {
    extincaoICMS: 'ST do ICMS desaparece em 2033 (extinção do ICMS)',
    impostoSeletivo: 'Tributos como cigarro e bebida alcoólica passam a ter Imposto Seletivo federal',
    transicao: 'Empresas com estoque ST em 31/12/2032 podem usar créditos por 240 meses',
  },
} as const

export type SubstituicaoTributariaKnowledge = typeof SUBSTITUICAO_TRIBUTARIA
