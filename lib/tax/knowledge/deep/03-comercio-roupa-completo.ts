/**
 * KNOWLEDGE BASE PROFUNDA — COMÉRCIO VAREJISTA DE ROUPAS
 *
 * Cobertura: Renner/Riachuelo/C&A estratégias, ICMS-ST por UF, DIFAL,
 * NCMs vestuário (Cap. 61/62/64), Reintegra, bonificação fornecedores,
 * sazonalidade Black Friday, Reforma Tributária impacto varejo.
 *
 * Versão: 2026
 */

export const COMERCIO_ROUPA_KB = {
  cnaes: {
    principais: [
      { code: '4781-4/00', nome: 'Comércio varejista de artigos do vestuário e acessórios', anexoSimples: 'I', aliquotaInicial: '4% (Faixa 1)', observacao: 'CNAE principal de loja de roupa. Anexo I é o mais barato. ICMS no DAS.' },
      { code: '4782-2/01', nome: 'Comércio varejista de calçados', anexoSimples: 'I', aliquotaInicial: '4%' },
      { code: '4782-2/02', nome: 'Comércio varejista de artigos de viagem', anexoSimples: 'I' },
      { code: '4783-1/01', nome: 'Comércio varejista de joalheria', anexoSimples: 'I', observacao: 'Tributação maior em alguns estados (joia = supérfluo).' },
      { code: '4789-0/01', nome: 'Comércio varejista de suvenires, bijuterias e artesanatos', anexoSimples: 'I' },
      { code: '4755-5/01', nome: 'Comércio varejista de tecidos', anexoSimples: 'I' },
      { code: '4755-5/02', nome: 'Comércio varejista de artigos de armarinho', anexoSimples: 'I' },
      { code: '4755-5/03', nome: 'Comércio varejista de cama, mesa e banho', anexoSimples: 'I' },
      { code: '4759-8/01', nome: 'Comércio varejista de tapeçaria, cortinas, persianas', anexoSimples: 'I' },
    ],
  },

  icms_st_vestuario: {
    titulo: 'ICMS-ST em Roupas e Calçados - Por Estado',
    baseLegal: ['Convênio CONFAZ 142/2018', 'Convênios estaduais', 'Protocolos ICMS bilaterais'],
    conceito: 'ALGUNS produtos têxteis e calçados estão em SUBSTITUIÇÃO TRIBUTÁRIA. ICMS cobrado UMA VEZ na cadeia (fabricante/importador). Revendedor NÃO PAGA de novo. Nem todo vestuário tem ST.',
    produtos_geralmente_com_st: {
      vestuario: ['Roupas em geral (varia por estado)', 'Roupas íntimas', 'Meias', 'Acessórios (cintos, lenços)'],
      calcados: ['Calçados em geral (NCM 6403, 6404)', 'Chinelos (6402)', 'Botas (6403)'],
    },
    estados_com_st_vestuario: {
      SP: { status: 'NÃO tem ST geral', observacao: 'Excluído Decreto 61.741/2015', impacto: 'Lojas SP cobram ICMS normalmente' },
      RJ: { status: 'TEM ST diversos produtos têxteis', baseLegal: 'Decreto 27.815/2001', produtos: 'Vestuário, roupas íntimas, meias, fios, tecidos', mva: '40-80%' },
      MG: { status: 'TEM ST vestuário', baseLegal: 'RICMS-MG Art. 12', produtos: 'Vestuário, calçados, acessórios', mva: '50-95%' },
      RS: { status: 'TEM ST alguns produtos têxteis', baseLegal: 'RICMS-RS', produtos: 'Confecção, malharia' },
      PR: { status: 'TEM ST', produtos: 'Confecção, vestuário' },
      SC: { status: 'PARCIAL', observacao: 'Grande produtor têxtil - regras especiais' },
      BA: { status: 'TEM ST', produtos: 'Vestuário e calçados' },
      PE: { status: 'TEM ST', mva: '40-60%' },
      CE: { status: 'TEM ST', mva: '40-60%' },
    },
    como_funciona: `Loja MG compra de fabricante SP:
1. Fabricante SP vende camiseta R$ 50 (sem ICMS-ST)
2. Indo pra MG (ST): MVA 70% → Base ST R$ 85
3. ICMS-ST MG 18%: R$ 15.30. Crédito ICMS origem SP 12%: R$ 6.00. Líquido: R$ 9.30
4. Fabricante paga R$ 9.30 ICMS-ST pra MG na entrada
5. Loja MG vende R$ 100 ao consumidor - NÃO PAGA ICMS de novo`,
    economia_no_simples: `Loja MG Simples Anexo I, R$ 50k/mês, R$ 30k com ST:
Sem segregar: DAS R$ 50k × 7.3% = R$ 3.650
Com segregar (excluir R$ 30k): DAS R$ 20k × 7.3% = R$ 1.460
ECONOMIA: R$ 2.190/mês = R$ 26.280/ano`,
    como_segregar_pgdas: [
      '1. Identificar produtos com ICMS-ST (NCM + legislação estadual)',
      '2. Apurar receita ST mensal',
      '3. PGDAS: campo "Receita sujeita à ST" - excluir base ICMS',
      '4. NF-e entrada como prova (CFOP 1410, 1411, 2410, 2411)',
      '5. PIS/COFINS continua sobre receita (vestuário não é monofásico)',
    ],
  },

  difal: {
    titulo: 'DIFAL - Diferencial de Alíquota Interestadual',
    baseLegal: ['EC 87/2015', 'LC 190/2022', 'Convênio ICMS 93/2015'],
    conceito: `DIFAL em VENDAS PARA CONSUMIDOR FINAL EM OUTRO ESTADO.
Loja SP vende online consumidor RJ:
- ICMS origem SP: 12% interestadual
- DIFAL: alíq interna RJ (20%) - interestadual (12%) = 8%
- DIFAL devido AO ESTADO DESTINO (RJ)
Quem paga: contribuinte PJ → destinatário; consumidor final PF → VENDEDOR.`,
    aliquotas_interestaduais: {
      '12%': 'Sul/Sudeste (exceto ES) para outras regiões',
      '7%': 'N, NE, CO, ES para Sul/Sudeste',
      '4%': 'Produtos importados (Resolução 13/2012)',
    },
    impacto_e_commerce: `Loja virtual SP, R$ 100k/mês: 50% SP (ICMS 18% normal) + 50% outros estados (12% origem + DIFAL destino).
DIFAL varia: RJ (20%) = 8%, MG (18%) = 6%, AM (18% normal mas ZFM) = 6% ou isento.
LC 190/2022: SIMPLES PAGA DIFAL desde 2022 em vendas interestaduais para consumidor final.`,
    simples_nacional_difal: `Forma de pagamento: GUIA específica DIFAL por estado destino, mensalmente.
Loja online Simples: software com cálculo DIFAL automático ou contador especializado.`,
  },

  ncm_vestuario: {
    titulo: 'NCM - Classificação Fiscal Vestuário',
    importancia: 'NCM correto define: ST aplicável, alíquota IPI importação, benefícios fiscais, Reintegra. NCM ERRADO = autuação + multa.',
    capitulos_principais: {
      'Capítulo 61': {
        descricao: 'Vestuário e acessórios de malha',
        principais_ncm: [
          '6101 - Sobretudos masculino malha',
          '6102 - Sobretudos feminino malha',
          '6103 - Ternos masculinos malha',
          '6104 - Ternos femininos malha',
          '6105 - Camisas masculinas malha',
          '6106 - Camisas femininas malha',
          '6107 - Cuecas, pijamas masculinos',
          '6108 - Calcinhas, sutiãs, pijamas femininos',
          '6109 - Camisetas (T-shirts)',
          '6110 - Pulôveres, cardigans',
          '6111 - Roupa infantil',
          '6112 - Roupa de esporte',
          '6115 - Meias',
        ],
      },
      'Capítulo 62': {
        descricao: 'Vestuário NÃO de malha (tecido plano)',
        principais_ncm: [
          '6201 - Sobretudos masculinos',
          '6202 - Sobretudos femininos',
          '6203 - Ternos, casacos, calças masculinas',
          '6204 - Ternos, casacos, calças femininas',
          '6205 - Camisas masculinas',
          '6206 - Camisas femininas',
          '6207 - Cuecas, pijamas masculinos',
          '6208 - Calcinhas, sutiãs',
          '6209 - Roupa infantil',
          '6211 - Maiôs, biquinis',
          '6212 - Sutiãs, cintas',
        ],
      },
      'Capítulo 64': {
        descricao: 'Calçados, polainas',
        principais_ncm: ['6401 - Impermeáveis', '6402 - Borracha (chinelos)', '6403 - Couro', '6404 - Sola couro/borracha + têxtil', '6405 - Outros'],
      },
    },
    armadilhas_ncm: [
      'Misturar tecido plano (Cap. 62) com malha (Cap. 61)',
      'Camiseta = 6109 sempre (T-shirt)',
      'Roupa infantil NCM específico - alíquotas menores',
      'Roupa esportiva NCM próprio (6112)',
      'Importação NCM errado = retenção alfândega',
    ],
  },

  creditos_pis_cofins_real: {
    titulo: 'Créditos PIS/COFINS em Loja de Roupa Lucro Real',
    aliquotas: 'PIS 1.65% + COFINS 7.60% = 9.25% (débito)',
    direitos_a_credito: [
      { item: 'Compra de mercadorias para revenda', baseLegal: 'Lei 10.637/2002 art. 3º, I', observacao: 'Crédito INTEGRAL sobre valor compra (sem ICMS-ST na base)' },
      { item: 'Frete sobre compras', baseLegal: 'Lei 10.833/2003 art. 3º, IX' },
      { item: 'Aluguel imóvel comercial (PJ)', baseLegal: 'Lei 10.833/2003 art. 3º, IV' },
      { item: 'Energia elétrica', baseLegal: 'Lei 10.637/2002 art. 3º, III' },
      { item: 'Embalagens (sacolas, papel presente, etiquetas)', baseLegal: 'Lei 10.833/2003' },
    ],
    nao_geram_credito: ['Folha (exceto vale-transporte)', 'Comissões vendedores', 'Taxas cartão', 'Aluguel PF', 'Multas/juros', 'Investimentos publicitários incertos'],
    calculo_exemplo: `Loja Lucro Real R$ 200k/mês:
DÉBITO: R$ 200k × 9.25% = R$ 18.500
CRÉDITOS: Compras R$ 100k×9.25%=9.250 + Frete R$ 3k×9.25%=277 + Aluguel R$ 8k×9.25%=740 + Energia R$ 2k×9.25%=185 + Embalagens R$ 1k×9.25%=92 = R$ 10.544
PIS/COFINS líquido: R$ 7.956/mês. ECONOMIA: R$ 10.544/mês = R$ 126.528/ano.`,
  },

  regimes: {
    simples_nacional: {
      anexo: 'Anexo I (Comércio)',
      aliquotas: [
        { faixa: 1, receita: '0-180k', aliquota: '4.00%' },
        { faixa: 2, receita: '180-360k', aliquota: '7.30%' },
        { faixa: 3, receita: '360-720k', aliquota: '9.50%' },
        { faixa: 4, receita: '720k-1.8M', aliquota: '10.70%' },
        { faixa: 5, receita: '1.8M-3.6M', aliquota: '14.30%' },
        { faixa: 6, receita: '3.6M-4.8M', aliquota: '19.00%' },
      ],
      vantagens: ['DAS único (IRPJ+CSLL+PIS+COFINS+ICMS+CPP+ISS)', 'CPP incluída', 'Menor burocracia'],
      desvantagens: ['Limite R$ 4.8M', 'Sem créditos PIS/COFINS', 'DIFAL fora do DAS'],
      indicado_para: 'Loja até R$ 4.8M/ano',
    },
    lucro_presumido: {
      base_calculo: { irpj: '8% sobre receita (margem presumida comércio)', csll: '12% sobre receita' },
      aliquotas: { irpj: '15% + 10% adicional (>R$ 240k/ano)', csll: '9%', pis: '0.65%', cofins: '3%' },
      vantagens: ['Margem 8% baixa pra comércio (favorável)', 'PIS/COFINS cumulativo (3.65%)', 'Bonificações'],
      desvantagens: ['ICMS separado', 'Sem créditos PIS/COFINS', 'Se margem real > 8%, paga mais que Real'],
      indicado_para: 'R$ 4.8M-78M com margem real > 8%',
    },
    lucro_real: {
      conceito: 'IRPJ/CSLL sobre lucro EFETIVO contábil',
      aliquotas: { irpj: '15% + 10% adicional', csll: '9%', pis: '1.65% não-cum', cofins: '7.60% não-cum' },
      vantagens: ['Créditos PIS/COFINS', 'Tributação sobre lucro REAL', 'Compensa prejuízos'],
      desvantagens: ['Contabilidade rigorosa', 'Mais burocracia', 'Custo contador maior'],
      indicado_para: '> R$ 78M ou margem baixa',
    },
  },

  benchmark_grandes_redes: {
    titulo: 'Como Renner, Riachuelo, C&A pagam menos imposto',
    renner: {
      ticker: 'LREN3',
      regime: 'Lucro Real',
      faturamento_2024: '~R$ 14 bilhões',
      estrategias_principais: [
        'CRÉDITO PIS/COFINS sobre estoque massivo (~R$ 1bi/ano)',
        'IMPORTAÇÃO DIRETA + hedge cambial dedutível',
        'REALIZE SOLUÇÕES FINANCEIRAS (cartão Renner) - PJ separada',
        'MARKETING DEDUTÍVEL pesado (Black Friday, etc)',
        'CENTRO DE DISTRIBUIÇÃO PRÓPRIO (logística + créditos)',
        'MARCA PRÓPRIA + LICENCIADAS (produção Bangladesh/China)',
      ],
      economia_estimada: '3-5 p.p. via planejamento',
    },
    riachuelo_guararapes: {
      ticker: 'RIAA3 (Riachuelo) / GUAR3 (Guararapes)',
      regime: 'Lucro Real',
      faturamento_2024: '~R$ 9 bilhões',
      estrategias: [
        'INTEGRAÇÃO VERTICAL (Guararapes indústria + Riachuelo varejo)',
        'Preço transferência intra-grupo otimizado',
        'MIDWAY FINANCEIRA (cartão Riachuelo)',
        'Centro logístico Manga/RN (SUDENE)',
        'Marcas próprias (Pool, AKWA, MOB, Carmim)',
      ],
    },
    cea: {
      ticker: 'CEAB3',
      regime: 'Lucro Real',
      controladora: 'C&A Holanda',
      estrategias: [
        'Royalties matriz holandesa (Tratado Brasil-Holanda)',
        'Importação Ásia intensiva + Drawback',
        'Fundos de investimento p/ gestão caixa',
        'Negociação ICMS estados (incentivos)',
        'E-commerce DIFAL otimizado',
      ],
    },
    pequena_media_loja: {
      titulo: 'O que loja média pode copiar',
      o_que_pequena_pode_copiar: [
        'SEGREGAÇÃO ICMS-ST',
        'NCM CORRETO',
        'CNAEs SECUNDÁRIOS (acessórios, calçados)',
        'BONIFICAÇÃO fornecedores',
        'MARKETING dedutível',
        'NF-E correta (CFOPs)',
        'FRETES (créditos no Real)',
      ],
      o_que_pequena_nao_consegue: ['Importação direta', 'Holding múltiplas marcas', 'Negociação estados', 'Drawback', 'Cartão próprio'],
    },
  },

  bonificacao_fornecedores: {
    titulo: 'Tratamento Tributário de Bonificação',
    conceito: 'Bonificação = mercadoria EXTRA do fornecedor sem custo. Ex: compra 100, leva 110 (10 = bonificação).',
    cenarios: {
      bonificacao_na_nf: 'Vem NA MESMA NF: sem custo (preço diluído). NF discrimina como "bonificação". ICMS sobre toda quantidade. PIS/COFINS na compra: crédito sobre total.',
      bonificacao_separada: 'NF separada (gratuita): mais polêmico. Pode ser DOAÇÃO. Tributação como receita acessória. Cuidado IRPJ/CSLL.',
      desconto_comercial: 'Desconto = redução preço (na NF). Bonificação = quantidade extra. Tratamento diferente.',
    },
    estrategia_loja_de_roupa: 'Negociar bonificação NA MESMA NF. Reduz custo médio unitário. Lucro Real: créditos PIS/COFINS sobre VALOR TOTAL.',
  },

  sazonalidade_loja_roupa: {
    titulo: 'Sazonalidade e Planejamento Anual',
    picos_vendas: {
      'Black Friday (novembro)': '+150% receita normal',
      'Natal (dezembro)': '+200%',
      'Volta às aulas (fevereiro)': '+50%',
      'Dia das Mães (maio)': '+80%',
      'Dia dos Pais (agosto)': '+60%',
      'Inverno (junho/julho)': '+40%',
    },
    impacto_simples_nacional: `Alíquota depende RBT12. Dezembro vende R$ 200k → eleva RBT12 → pode jogar próxima faixa → DAS janeiro vem maior.
Estratégia: acompanhar RBT12 mensal. Dezembro pode ANTECIPAR estoque pra janeiro OU desacelerar finais para não estourar faixa.`,
    impacto_lucro_presumido: `IRPJ tem adicional: até R$ 60k/trim 15%, acima +10% = 25% total.
4º trimestre fatura muito mais. Estratégia: antecipar despesas (compras, marketing), aumentar pró-labore 4º tri, provisionar 13º.`,
    impacto_lucro_real:
      'Lucro líquido contábil anual. Sazonalidade impacta menos direto. Provisionar despesas 4º tri, estoque alto não impacta (só sai no CMV ao vender), aproveitamento prejuízos.',
  },

  reforma_tributaria_varejo: {
    titulo: 'Reforma Tributária - Impacto Varejo Moda',
    baseLegal: ['EC 132/2023', 'LC 214/2025'],
    classificacao: 'Vestuário = bens essenciais (alíquota cheia IBS+CBS, sem redução geral)',
    cronograma_impacto: {
      '2026': 'Teste IBS 0.1% + CBS 0.9%',
      '2027': 'CBS substitui PIS/COFINS - ~9%',
      '2028-2032': 'Transição ICMS → IBS',
      '2033': 'Sistema novo',
    },
    impacto_varejo: `Vestuário NÃO na cesta básica reduzida. Alíquota IBS+CBS cheia ~27%.
Comparação: Anexo I Simples R$ 1M (8.9% efetiva) vs IBS+CBS 27% bruto.
NÃO-CUMULATIVIDADE muda tudo: loja compra R$ 600k com IBS+CBS embutido (R$ 162k), vende R$ 1M (R$ 270k embutido).
DEVE R$ 270k, CREDITA R$ 162k, PAGA R$ 108k. Efetiva sobre receita: 10.8%.`,
    decisao_setembro_2026: `Loja decide:
- Faturamento até R$ 4.8M Anexo I (8-19%): GERALMENTE CONTINUAR Simples
- Faturamento maior (Presumido/Real): IBS+CBS pode compensar
- Grande volume compras (créditos altos): IBS+CBS pode favorecer`,
    cashback_consumidor: 'Cashback consumidores baixa renda pode impulsionar moda popular (C&A, Marisa).',
  },

  erros_comuns: [
    { erro: 'Não segregar ICMS-ST em estados com ST', impacto: '15-30% imposto a mais', solucao: 'Excluir base ICMS no PGDAS' },
    { erro: 'NCM errado nos produtos', impacto: 'Autuação, multa, ICMS errado, ST aplicado errado', solucao: 'Revisar NCM, consultar TIPI atualizada' },
    { erro: 'Não declarar DIFAL vendas interestaduais', impacto: 'Autuação estado destino + multa pesada', solucao: 'Software e-commerce com DIFAL automático' },
    { erro: 'Misturar calçados com roupas no mesmo CNAE', impacto: 'Não consegue otimizar', solucao: 'Cadastrar CNAEs secundários' },
    { erro: 'Sazonalidade joga pra faixa maior Simples', impacto: 'DAS meses normais inflado', solucao: 'Acompanhar RBT12, planejar Black Friday' },
    { erro: 'Lucro Real sem créditos PIS/COFINS', impacto: 'Paga 9.25% sem deduzir crédito compras', solucao: 'Identificar todas compras com direito' },
    { erro: 'Comprar de PF sem NF', impacto: 'Sem crédito ICMS/PIS/COFINS + risco fiscal', solucao: 'Sempre fornecedor PJ com NF-e' },
  ],
} as const
