/**
 * KNOWLEDGE BASE PROFUNDA — RESTAURANTES
 *
 * Cobertura: LC 192/2022, PERSE (Lei 14.148/2021 + 14.859/2024), combo Mc/BK,
 * ICMS-ST bebidas (Convênio CONFAZ 142/2018), PIS/COFINS monofásico,
 * créditos não-cumulativos Lucro Real, segregação canais, benchmarks.
 *
 * Versão: 2026
 */

export const RESTAURANTES_KB = {
  cnaes: {
    principais: [
      {
        code: '5611-2/01',
        nome: 'Restaurantes e similares',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022 + Resolução CGSN 140/2018',
        observacao:
          'Restaurantes foram migrados do Anexo III/V pro Anexo I em 2022. Anexo I é o mais barato (4-19%).',
        elegivelPERSE: true,
        atividade: 'Comércio de mercadorias (alimentos preparados)',
      },
      {
        code: '5611-2/02',
        nome: 'Bares e outros estabelecimentos especializados em servir bebidas, sem entretenimento',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
      },
      {
        code: '5611-2/03',
        nome: 'Lanchonetes, casas de chá, de sucos e similares',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
        observacao:
          'Inclui hamburguerias menores, lanchonetes de rua, casas de açaí, sucos. CNAE preferido para fast food de pequeno porte.',
      },
      {
        code: '5611-2/04',
        nome: 'Bares e outros estabelecimentos especializados em servir bebidas, com entretenimento',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
        observacao:
          'Inclui bares com música ao vivo, karaoke. Bom enquadramento porque pega benefício PERSE (setor de eventos/entretenimento).',
      },
      {
        code: '5611-2/05',
        nome: 'Restaurantes e similares com serviço de entrega (delivery)',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
      },
      {
        code: '5620-1/01',
        nome: 'Fornecimento de alimentos preparados preponderantemente para empresas',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
        observacao: 'Catering corporativo, marmita PJ.',
      },
      {
        code: '5620-9/02',
        nome: 'Serviços de alimentação para eventos e recepções - bufê',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
      },
      {
        code: '5620-9/04',
        nome: 'Fornecimento de alimentos preparados preponderantemente para consumo domiciliar',
        anexoSimples: 'I',
        baseLegal: 'LC 192/2022',
        elegivelPERSE: true,
      },
      {
        code: '1091-1/02',
        nome: 'Fabricação de produtos de padaria e confeitaria com predominância de produção própria',
        anexoSimples: 'II',
        baseLegal: 'LC 123/2006',
        elegivelPERSE: false,
        observacao:
          'Padaria com produção própria pode ser Anexo II (indústria) - alíquota inicial 4.5%. Verificar se faz sentido vs Anexo I.',
      },
    ],
  },

  lc192_2022: {
    titulo: 'Lei Complementar 192/2022 - Tributação de Restaurantes no Simples',
    publicacao: 'Março 2022',
    oQueMudou: `Antes da LC 192/2022, restaurantes eram tributados como serviços (Anexo III ou V).
Anexo III alíquota inicial 6%, mas com problemas (Fator R). Anexo V alíquota 15.5%.
LC 192/2022 GARANTIU enquadramento no ANEXO I (Comércio): alíquota inicial 4%, sem Fator R.`,
    aliquotasAnexoI: [
      { faixa: 1, receita: '0 a 180k', aliquota: '4.00%', deducao: 0 },
      { faixa: 2, receita: '180k a 360k', aliquota: '7.30%', deducao: 5940 },
      { faixa: 3, receita: '360k a 720k', aliquota: '9.50%', deducao: 13860 },
      { faixa: 4, receita: '720k a 1.8M', aliquota: '10.70%', deducao: 22500 },
      { faixa: 5, receita: '1.8M a 3.6M', aliquota: '14.30%', deducao: 87300 },
      { faixa: 6, receita: '3.6M a 4.8M', aliquota: '19.00%', deducao: 378000 },
    ],
    impactoPratico: `Restaurante R$ 1M/ano: ANTES (Anexo V) R$ 155.000/ano DAS. DEPOIS (Anexo I) R$ 89.000/ano. ECONOMIA R$ 66.000/ano (43% menos).`,
    importante:
      'LC 192/2022 só vale Simples. Restaurantes no Lucro Presumido/Real seguem regras normais. Combinando com PERSE (Lucro Presumido), restaurante fica muito competitivo.',
  },

  perse: {
    titulo: 'PERSE - Programa Emergencial de Retomada do Setor de Eventos',
    leis: {
      original: 'Lei 14.148/2021',
      alteracoes: ['Lei 14.859/2024 (mantém até fev/2027)', 'Solução de Consulta COSIT 89/2024', 'Solução de Consulta COSIT 215/2023'],
    },
    beneficio: `ALÍQUOTA ZERO sobre PIS, COFINS, IRPJ e CSLL.
- LUCRO PRESUMIDO: zero em TODOS os 4 até fev/2027
- LUCRO REAL: zero em PIS+COFINS até fev/2027 (IRPJ/CSLL voltaram em 2025)
- SIMPLES NACIONAL: NÃO se aplica`,
    vigencia: { inicio: '18/03/2022', fim: '28/02/2027', observacao: '60 meses originalmente, mantido por Lei 14.859/2024.' },
    requisitos: {
      cnaePrincipal: 'CNAE elegível como principal ou preponderante em 18/03/2022',
      cadastur:
        'CNAE 5611-2/01 (Restaurantes): PRECISA Cadastur cadastrado em 18/03/2022. Outros CNAEs (Anexos I/II Portaria 7.163/2021): verificar.',
      regime: 'Lucro Real ou Lucro Presumido',
      situacaoFiscal: 'Regularidade fiscal',
    },
    cnaesElegiveis_grupo1: [
      '5611-2/01',
      '5611-2/03',
      '5611-2/04',
      '5611-2/05',
      '9001-9/99',
      '9003-5/00',
      '9319-1/01',
      '9329-8/01',
    ],
    cnaesElegiveis_grupo2: ['5620-1/02', '5620-9/01', '5620-9/04'],
    comoAderir: [
      '1. Verificar CNAE elegível em 18/03/2022',
      '2. Se CNAE 5611-2/01: verificar Cadastur ativo desde 18/03/2022',
      '3. Apurar receitas vinculadas APENAS ao CNAE elegível',
      '4. Adotar alíquota zero PIS+COFINS no DCTFWeb',
      '5. Se Lucro Presumido: zerar IRPJ/CSLL também',
      '6. Guardar documentação para fiscalização',
      '7. Validar com contador antes',
    ],
    impactoFinanceiro_exemplo: `Restaurante Lucro Presumido R$ 1.2M/ano:
SEM PERSE: PIS 7.800 + COFINS 36.000 + IRPJ 18.000 + CSLL 12.960 = R$ 74.760/ano federal
COM PERSE: ZERO em todos. ECONOMIA R$ 74.760/ano até fev/2027.
Continua ICMS, ISS, INSS, FGTS.`,
    armadilhas: [
      'Empresa com múltiplas atividades: só receita do CNAE elegível',
      'PERSE Lucro Real: IRPJ/CSLL voltaram em 2025',
      'CNAE alterado APÓS 18/03/2022 NÃO retroage',
      'Sem Cadastur (quando exigido) = sem benefício',
      'Receita Federal fiscaliza intensamente',
    ],
  },

  combo_mc_bk: {
    titulo: 'Estratégia Combo - Segregação Fiscal de Bebidas (McDonald\'s/Burger King)',
    conceito: `Combo no Mc/BK NÃO é estratégia de venda - é PLANEJAMENTO TRIBUTÁRIO legal.
LANCHE+BATATA: ICMS normal + PIS/COFINS normal.
REFRIGERANTE: ICMS já recolhido (ST Convênio 142/2018) + PIS/COFINS já recolhido (Monofásico Lei 10.485/2002).
Restaurante COMPRA com tudo pago, REVENDE sem tributar de novo.`,
    comoFunciona: `Combo R$ 30 (Lanche R$ 22 + Refri R$ 8):
SEM SEGREGAR: tributa R$ 30. PIS+COFINS 1,095 + ICMS 3,60 = R$ 4,695
COM SEGREGAR: tributa R$ 22 (refri excluído). PIS+COFINS 0,803 + ICMS 2,64 = R$ 3,443
ECONOMIA: R$ 1,252 por combo (26.6%). Em 30.000 combos/mês (Mc grande): R$ 450.720/ano.`,
    requisitosLegais: [
      'NF-e deve discriminar item por item',
      'Cada item com NCM correto',
      'Refrigerante: NCM 2202.10.00 (ST/monofásico)',
      'Cerveja: NCM 2203.00.00 (ST/monofásico)',
      'Lanche: NCM 1601, 1602 conforme composição',
      'Apuração separada na contabilidade',
      'Segregação no PGDAS (se Simples)',
    ],
    aplicabilidade: {
      simplesNacional: 'Reduz alíquota efetiva DAS - segregar no PGDAS',
      lucroPresumido: 'Exclui da base PIS/COFINS e ICMS',
      lucroReal: 'Maior economia - exclui da base + permite créditos sobre demais insumos',
    },
    armadilha: 'NF que não discrimina itens permite Receita Federal autuar tudo. NF item-por-item é OBRIGATÓRIO.',
  },

  icms_st_bebidas: {
    titulo: 'ICMS-ST Bebidas - Exclusão da Base',
    baseLegal: ['Convênio CONFAZ 142/2018', 'Lei Kandir LC 87/1996', 'Convênios estaduais'],
    conceito: 'ICMS-ST: cobrado UMA VEZ na cadeia pelo fabricante. Restaurante revende SEM novo ICMS. Excluir da base do DAS/PGDAS.',
    produtosComST: [
      { produto: 'Cerveja', ncm: '2203.00.00', mvaMedio: '70-100%' },
      { produto: 'Refrigerante', ncm: '2202.10.00', mvaMedio: '40-70%' },
      { produto: 'Água mineral', ncm: '2201.10.00', mvaMedio: '40-60%' },
      { produto: 'Energético', ncm: '2202.99.00', mvaMedio: '50-80%' },
      { produto: 'Suco industrializado', ncm: '2009.xx.xx', mvaMedio: '40-60%' },
      { produto: 'Bebida alcoólica (vinho, destilados)', ncm: '2204/2206/2208', mvaMedio: 'Varia' },
    ],
    economiaReal: `Restaurante Simples R$ 100k/mês, 25% bebidas (R$ 25k):
Sem segregar: DAS R$ 100k × 10.7% = R$ 10.700
Com segregar: DAS R$ 75k × 10.7% = R$ 8.025
ECONOMIA: R$ 2.675/mês = R$ 32.100/ano`,
    comoFazerNoPGDAS: [
      '1. PGDAS > Apuração > separar receitas',
      '2. Identificar campo "Receita com ST/monofásico"',
      '3. Esse valor é EXCLUÍDO da base',
      '4. PGDAS recalcula DAS',
      '5. Manter NF-e dos fornecedores como prova',
    ],
    erroComum:
      'Muitos restaurantes NÃO segregam bebidas. Pagam DAS sobre tudo, incluindo bebidas que já tinham ICMS recolhido. Pode pedir RESTITUIÇÃO últimos 5 anos via PER/DCOMP.',
  },

  pis_cofins_monofasico: {
    titulo: 'PIS/COFINS Monofásico em Bebidas',
    baseLegal: ['Lei 10.485/2002', 'Lei 10.147/2000', 'Lei 10.833/2003 art. 51', 'Lei 10.560/2002'],
    conceito:
      'Monofásico = tributação concentrada no fabricante/importador. Os comerciantes seguintes vendem com ALÍQUOTA ZERO. Diferente de ST do ICMS (estadual). Monofásico é FEDERAL.',
    produtosMonofasicos_bebidas: [
      'Cervejas (2203)',
      'Refrigerantes (2202.10)',
      'Águas (2201, 2202.91)',
      'Energéticos (2202.99)',
      'Isotônicos (2202.99)',
      'Sucos industrializados (2009)',
    ],
    aliquotas: {
      cerveja: 'PIS 1.46% + COFINS 6.74% (fabricante paga, revendedor zero)',
      refrigerante: 'PIS 1.46% + COFINS 6.74%',
      observacao: 'Restaurante COMPRA com PIS/COFINS já incluso. Não recolhe de novo.',
    },
    economiaReal: `Restaurante Lucro Real R$ 200k/mês, R$ 40k bebidas monofásicas:
SEM SEGREGAR: PIS+COFINS R$ 200k × 9.25% = R$ 18.500/mês
SEGREGANDO: R$ 160k × 9.25% = R$ 14.800/mês
ECONOMIA: R$ 3.700/mês = R$ 44.400/ano (sem contar ICMS-ST que é separado).`,
  },

  creditos_pis_cofins_real: {
    titulo: 'Créditos PIS/COFINS no Lucro Real (Não-Cumulativo)',
    baseLegal: ['Lei 10.637/2002', 'Lei 10.833/2003', 'IN RFB 1.911/2019'],
    aliquotas: { pis: '1.65%', cofins: '7.60%', total: '9.25% débito' },
    direitoACredito_restaurantes: [
      { item: 'Matéria-prima (carnes, hortifruti, ingredientes)', baseLegal: 'Lei 10.637/2002 art. 3º, II', observacao: 'CRÉDITO INTEGRAL' },
      { item: 'Embalagens (descartáveis, sacolas, delivery)', baseLegal: 'Lei 10.833/2003 art. 3º, II', observacao: 'CRÉDITO INTEGRAL' },
      { item: 'Energia elétrica', baseLegal: 'Lei 10.637/2002 art. 3º, III', observacao: 'CRÉDITO INTEGRAL - alto consumo' },
      { item: 'Aluguel imóvel comercial (PJ)', baseLegal: 'Lei 10.833/2003 art. 3º, IV', observacao: 'CRÉDITO INTEGRAL' },
      { item: 'Frete sobre compras', baseLegal: 'Lei 10.833/2003 art. 3º, IX', observacao: 'CRÉDITO INTEGRAL' },
      { item: 'Bens do ativo (fornos, fogões, geladeiras)', baseLegal: 'Lei 10.637/2002 art. 3º, VI', observacao: 'CRÉDITO sobre depreciação' },
      { item: 'Material de limpeza', baseLegal: 'SC COSIT 76/2013', observacao: 'É insumo essencial' },
      { item: 'Manutenção de equipamentos', baseLegal: 'IN RFB 1.911/2019', observacao: 'CRÉDITO INTEGRAL se essencial' },
      { item: 'Gás (cozinha)', baseLegal: 'Lei 10.637/2002 art. 3º, II', observacao: 'CRÉDITO INTEGRAL' },
    ],
    semDireitoACredito: [
      'Folha de pagamento (exceto vale-transporte)',
      'Pró-labore',
      'Material de escritório (uso administrativo)',
      'Marketing/propaganda',
      'Comissões e honorários',
    ],
    calculoReal: `Restaurante Lucro Real R$ 200k receita, R$ 80k compras qualificadas:
DÉBITO: R$ 200k × 9.25% = R$ 18.500
CRÉDITOS: Insumos R$ 60k×9.25%=5.550 + Embalagens R$ 8k×9.25%=740 + Energia R$ 6k×9.25%=555 + Aluguel R$ 6k×9.25%=555 = R$ 7.400
PIS/COFINS líquido: R$ 11.100/mês. ECONOMIA pelos créditos: R$ 88.800/ano.`,
  },

  segregacao_canais: {
    titulo: 'Segregação Salão × Delivery × Balcão × Apps',
    conceito: 'Restaurante moderno tem 3-4 canais. Cada um pode ter tributação ligeiramente diferente.',
    salao: { caracteristica: 'Consumo no local com serviço', ICMS: 'Cobrado normalmente', ISS: 'Geralmente não há ISS sobre refeição (maioria dos estados ICMS-only)' },
    delivery: { caracteristica: 'Venda com entrega', ICMS: 'Normal', ISS: 'NÃO incide sobre delivery próprio', armadilha: 'iFood/Rappi: comissão pode gerar ISS retido na fonte' },
    apps: {
      iFood: {
        tributacao: 'Você emite NF-e como restaurante. iFood retém comissão.',
        comissaoIFood: '12-23% da venda',
        impactoFiscal: 'Comissão é DESPESA (Real/Presumido) ou redutor (Simples)',
        retencao: 'iFood pode reter ISS em alguns municípios',
      },
    },
    benchmark_grandes_redes:
      'Mc/BK separam contabilmente cada canal + NF discriminada + combo identificado. Restaurante pequeno típico paga ~50% MAIS imposto proporcional.',
  },

  benchmark_grandes_redes: {
    titulo: 'Como Grandes Redes Pagam Menos (Legal)',
    mcDonalds: {
      regime: 'Lucro Real',
      estrategias: [
        'Combo NF discriminada',
        'Refri ICMS-ST + monofásico = ALÍQUOTA ZERO no Mc',
        'Créditos PIS/COFINS sobre embalagens',
        'Créditos energia elétrica (alto consumo)',
        'Créditos frete compras',
        'Holding gestão royalties marca',
        'Aproveitamento prejuízos consolidados',
        'NCM correto (sorvete, café têm alíquotas diferentes)',
      ],
    },
    burgerKing: {
      regime: 'Lucro Real',
      estrategias: [
        'Mesma estratégia combo segregado',
        'Foco delivery app próprio',
        'Plant-based NCM diferente',
        'Aproveitamento bonificações fornecedores',
      ],
    },
    madero: {
      regime: 'Lucro Real (pós-IPO 2024)',
      estrategias: [
        'PERSE integral até fev/2027',
        'Créditos PIS/COFINS sobre carnes',
        'Importação direta equipamentos',
        'Marca com royalties intra-grupo',
      ],
      economiaEstimada: 'PERSE economiza ~R$ 30M/ano no Madero',
    },
    outback: {
      regime: 'Lucro Real',
      estrategias: [
        'Importação direta Angus (créditos importação)',
        'PERSE até 2027',
        'NCM correto cervejas importadas',
        'Holding cervejaria própria (Bloomin Brands)',
      ],
    },
    girafas: {
      regime: 'Simples Nacional',
      estrategias: ['Faturamento por unidade dentro Simples', 'Anexo I LC 192/2022', 'Cada unidade CNPJ separado'],
    },
    subway: {
      regime: 'Simples Nacional ou Presumido',
      estrategias: ['Franqueado é PJ independente', 'Anexo I LC 192/2022', 'Royalties à matriz dedutíveis Real/Presumido'],
    },
  },

  erros_comuns: [
    { erro: 'Não segregar bebidas no PGDAS', impacto: '15-30% imposto a mais', solucao: 'Segregar + pedir restituição 5 anos' },
    { erro: 'NF de combo sem discriminação', impacto: 'Receita Federal autua e cobra sobre tudo', solucao: 'NF item por item' },
    { erro: 'CNAE genérico errado', impacto: 'Pode jogar pra Anexo III/V', solucao: 'CNAE 5611-2/01 correto' },
    { erro: 'Não aderir ao PERSE', impacto: 'Perde até fev/2027 alíquota zero', solucao: 'Verificar Cadastur + adotar' },
    { erro: 'Misturar atividades sem segregar', impacto: 'Tributação ineficiente', solucao: 'Segregar ou 2 CNPJs' },
    { erro: 'Lucro Real sem créditos PIS/COFINS', impacto: '30-50% imposto a mais', solucao: 'Identificar todos insumos com crédito' },
    { erro: 'Ignorar Fator R em CNAE híbrido', impacto: 'Anexo errado', solucao: 'Monitorar mensalmente folha/receita' },
  ],

  reforma_tributaria_restaurantes: {
    titulo: 'Reforma Tributária - Impacto em Restaurantes',
    baseLegal: ['EC 132/2023', 'LC 214/2025'],
    cronograma: {
      '2026': 'Teste IBS 0.1% + CBS 0.9%',
      '2027': 'CBS substitui PIS/COFINS - ~9-10%',
      '2028': 'IBS começa substituir ICMS - transição',
      '2029-2032': 'Transição gradual',
      '2033': 'Sistema novo - IBS + CBS + IS',
    },
    impacto_restaurantes: `Restaurantes terão REDUÇÃO de 60% nas alíquotas IBS+CBS (LC 214/2025 art. 274 - alimentação como serviço essencial).
Atual Lucro Real (~22-28% sem PERSE) → Pós-reforma com redução 60%: ~10.8% efetiva.
REDUÇÃO de carga: 50-60% para restaurantes.`,
    decisao_setembro_2026: `Em setembro/2026, Simples decide:
- Continuar Simples (regras antigas)
- Migrar para IBS+CBS (regras novas)
Para restaurantes:
- Faturamento até R$ 4.8M e Anexo I (4-10%): GERALMENTE CONTINUAR Simples
- Faturamento > R$ 4.8M ou Real/Presumido: migrar pode compensar (redução 60%)`,
    imposto_seletivo:
      'IS (substituto IPI) vai TAXAR bebidas alcoólicas + bebidas açucaradas (refri) + cigarros. Pode aumentar custo bebidas. Mas continua creditando ao comprar.',
  },

  encargos_folha_restaurantes: {
    titulo: 'INSS, FGTS e Encargos',
    aliquotas: {
      inssPatronal: '20% (Real/Presumido) - Simples incluído no DAS',
      fgts: '8%',
      rat_sat: '1-3% (varia CNAE) - restaurante geralmente 2-3%',
      terceiros_sistemaS: '5.8%',
      total_encargos: '35-37% sobre folha fora Simples',
    },
    desoneracao_restaurantes: `Lei 14.973/2024: restaurantes CNAE 5611 podem optar entre INSS folha (20%) OU CPRB (alíquota reduzida sobre receita bruta).
Para 2025-2026: CPRB restaurantes ~3% sobre receita.
Folha alta + receita média = manter INSS folha. Folha baixa + receita alta = CPRB compensa.`,
    estrategia_pro_labore: `Pró-labore mínimo: 1 salário mínimo. Pró-labore alto: aumenta INSS (20%) mas dedutível IRPJ/CSLL.
Real: pró-labore reduz lucro real = menos IRPJ/CSLL. INSS 20% compensado por economia IRPJ (15+10) + CSLL (9). Líquido pode economizar 4-9 p.p.`,
    rat_fap: 'RAT 1-3% × FAP 0.5-2.0 = RAT efetivo. Investimento em segurança reduz FAP = economia anual.',
  },

  solucoes_consulta_receita: {
    cosit_89_2024: {
      assunto: 'PERSE - Vigência e CNAEs',
      principais: [
        'PERSE vigente até fev/2027 para PIS/COFINS',
        'IRPJ/CSLL para Lucro Real volta em 2025',
        'CNAE 5611-2/01: PRECISA Cadastur ativo desde 18/03/2022',
        'Atividade preponderante = maior receita absoluta',
      ],
    },
    cosit_215_2023: { assunto: 'PERSE - Mudança de CNAE', principal: 'CNAE alterado após 18/03/2022 NÃO retroage' },
    cosit_76_2013: { assunto: 'Material de limpeza', principal: 'É INSUMO no estabelecimento que produz alimentos. Gera crédito PIS/COFINS.' },
  },
} as const
