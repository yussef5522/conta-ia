/**
 * KNOWLEDGE BASE PROFUNDA — ACADEMIAS / FITNESS
 *
 * Cobertura: Fator R (LC 123/06 § 5º-J e 5º-M), Anexo III vs V, segregação
 * suplementos/serviço, personal CLT vs PJ, holding Smart Fit, planos anuais,
 * ISS uniprofissional, Reforma Tributária (academias = saúde).
 *
 * Versão: 2026
 */

export const ACADEMIAS_KB = {
  cnaes: {
    principais: [
      {
        code: '9313-1/00',
        nome: 'Atividades de condicionamento físico',
        anexoSimples: 'III/V (depende Fator R)',
        baseLegal: 'LC 123/2006 art. 18 § 5º-B e 5º-D',
        observacao: 'CNAE principal. Sujeito a Fator R - se folha/receita ≥ 28%, Anexo III (6%). Senão Anexo V (15.5%).',
      },
      {
        code: '9311-5/00',
        nome: 'Gestão de instalações de esportes',
        anexoSimples: 'III/V (Fator R)',
        baseLegal: 'LC 123/2006',
        observacao: 'Quadras esportivas, society, beach tennis.',
      },
      {
        code: '9312-3/00',
        nome: 'Clubes sociais, esportivos e similares',
        anexoSimples: 'III/V (Fator R)',
      },
      {
        code: '8591-1/00',
        nome: 'Ensino de esportes (natação, lutas, ciclismo)',
        anexoSimples: 'III/V (Fator R)',
        observacao: 'CrossFit boxes, jiu-jitsu, muay thai.',
      },
      { code: '8592-9/01', nome: 'Ensino de dança', anexoSimples: 'III/V (Fator R)' },
      { code: '8592-9/02', nome: 'Ensino de artes cênicas (yoga, pilates)', anexoSimples: 'III/V (Fator R)' },
    ],
    secundarios_estrategicos: [
      {
        code: '4774-1/00',
        nome: 'Comércio varejista de artigos uso pessoal',
        observacao: 'Suplementos, roupas, acessórios. Anexo I 4-19% - muito mais barato.',
        estrategia: 'Segregar receita venda produtos (Anexo I) vs serviço (III/V).',
      },
      { code: '4772-5/00', nome: 'Comércio varejista cosméticos/higiene', observacao: 'Whey protein, vitaminas, suplementos. Anexo I.' },
      { code: '4744-0/01', nome: 'Comércio varejista ferragens/ferramentas', observacao: 'Equipamentos esportivos revendidos.' },
      { code: '8650-0/01', nome: 'Atividades profissionais nutrição', observacao: 'Nutricionista vinculado - Anexo III/V + ISS.' },
      { code: '8650-0/04', nome: 'Atividades fisioterapia', observacao: 'Fisio vinculado - Anexo III/V.' },
    ],
  },

  fator_r: {
    titulo: 'Fator R - A Diferença entre 6% e 15.5%',
    baseLegal: ['LC 123/2006 art. 18 § 5º-J', 'LC 123/2006 art. 18 § 5º-M', 'Resolução CGSN 140/2018 art. 25 §§ 4º-9º'],
    formula: `Fator R = Folha 12m / RBT12
Folha 12m = salários + pró-labore + INSS patronal + FGTS últimos 12m
RBT12 = receita bruta últimos 12m
DECISÃO: Fator R ≥ 28% → Anexo III (6%). Fator R < 28% → Anexo V (15.5%).`,
    impactoFinanceiro: `Academia R$ 50k/mês (R$ 600k/ano):
ANEXO V: 15.5% efetiva = R$ 93.000/ano DAS
ANEXO III: 6-9% efetiva = R$ 48.000/ano DAS
ECONOMIA R$ 45.000/ano migrando III.
Pra atingir 28%: folha precisa ser R$ 14k/mês (R$ 168k/ano).`,
    estrategias_atingir_28pct: {
      proLabore: `Pró-labore conta integral na Folha (Res. CGSN 140/2018).
INSS sócio 11% (desconto sócio, não empresa).
Academia R$ 50k/mês, pró-labore R$ 14k/mês = 28% Fator R.
Custo extra INSS: R$ 11.880/ano. Economia DAS: R$ 45.000/ano. LÍQUIDO: R$ 33.120/ano.`,
      contratarCLT: `Custo CLT: salário + ~50% encargos. Compensa SÓ se já era necessário operacionalmente. Contratar SÓ pra Fator R = prejuízo.`,
      segregar_receitas: `Academia vende suplementos R$ 5k/mês:
Anexo I (Comércio): 4-10%. Misturado III/V: 6-15.5%.
Segregar reduz receita do CNAE serviço E aumenta proporcionalmente o Fator R. DUPLA VITÓRIA.`,
    },
    armadilhas_fator_r: [
      'Não atualizar Folha 12m mensalmente = oscila entre anexos',
      'Esquecer pró-labore = subestima Folha',
      'PLR sem regulamento formal = descaracterização',
      'Aumentar folha SÓ pra Fator R sem necessidade = perde dinheiro',
    ],
  },

  segregacao_suplementos: {
    titulo: 'Segregação Suplementos (Anexo I) vs Serviço (Anexo III/V)',
    conceito: 'Academia que vende suplementos faz 2 atividades distintas. Receita NÃO pode ser misturada. Cada CNAE no SEU anexo.',
    como_segregar: [
      '1. Inscrever CNAE secundário (4772-5/00, 4774-1/00)',
      '2. No PGDAS: separar receita por CNAE',
      '3. Receita serviço → Anexo III/V',
      '4. Receita suplementos → Anexo I',
      '5. NFS-e serviço + NF-e produto',
    ],
    economia_real: `Academia R$ 50k/mês (R$ 40k serviço + R$ 10k suplementos):
SEM SEGREGAR (Anexo III 6%): R$ 50k × 6% = R$ 3.000/mês
COM SEGREGAR: R$ 40k Anexo III + R$ 10k Anexo I = R$ 2.800/mês
ECONOMIA: R$ 200/mês = R$ 2.400/ano (sem contar melhora Fator R).`,
    cuidado_fator_r_segregado:
      'Folha precisa ser SEGREGADA proporcionalmente ao trabalho dos funcionários. Personal 100% serviço = folha 100% no CNAE serviço. Documentar bem.',
  },

  personal_trainer: {
    titulo: 'Personal Trainer - CLT vs PJ vs Autônomo',
    modelos: {
      clt: {
        custoEmpresa: 'Salário + INSS 20% + FGTS 8% + 13º + férias + RAT/SAT + Sistema S = ~150% salário',
        beneficios: 'Conta INTEGRAL na Folha 12m (favorável Fator R)',
        risco: 'Vínculo trabalhista, custos rescisórios',
        ideal_para: 'Academias com Fator R baixo querendo migrar pra III',
      },
      pj_aluguel: {
        modelo: 'Personal aluga sala/horário da academia',
        receita_academia: 'Aluguel fixo ou % faturamento',
        observacao: 'NÃO conta na Folha 12m - Fator R NÃO melhora',
        ideal_para: 'Academias com Fator R alto',
      },
      pj_parceria: {
        modelo: 'Personal MEI/ME fatura pra academia',
        risco: 'PRINCIPAL ARMADILHA - RF pode descaracterizar e cobrar como CLT',
        criterios_descaracterizacao: ['Exclusividade', 'Subordinação', 'Habitualidade', 'Pessoalidade'],
      },
      autonomo: {
        modelo: 'RPA',
        custo: 'Academia retém INSS 11% + IRRF',
        observacao: 'Conta na Folha 12m com restrições',
      },
    },
    estrategia_smart_fit: `Smart Fit modelo HÍBRIDO:
- Funcionários CLT (gestão, atendimento, manutenção) - alta folha
- Personal trainers via PARCERIA (uso dos espaços) - não funcionários
- Fator R alto pela folha CLT
- Personal cobra do aluno (academia não tributa)
Vantagens: 1) Folha alta = Anexo III; 2) Receita personal não tributa academia; 3) Aluguel/parceria = receita extra.`,
  },

  planos_anuais: {
    titulo: 'Planos Anuais e Receita Antecipada',
    conceito: 'Plano R$ 1.200 anual: Real/Presumido reconhece mês a mês (competência). Simples geralmente caixa.',
    estrategia_competencia: 'Real/Presumido: receita reconhecida R$ 100/mês × 12 = dilui tributos no ano.',
    risco_simples:
      'Simples + planos anuais: pode jogar empresa pra faixa maior naquele mês. Solução: recorrência mensal PIX/cartão recorrente.',
  },

  estrutura_franquia: {
    titulo: 'Estrutura Holding Smart Fit/Bodytech',
    modelo_smart_fit: `Holding Bio Ritmo Participações (Smart Fit International):
- Detém MARCA "Smart Fit"
- Recebe ROYALTIES ~5% sobre faturamento das unidades
- TAXA DE MARKETING ~4.5%
- Total: ~10% sobre faturamento de todas unidades
Cada UNIDADE = CNPJ separado (franquia ou própria). Fatura R$ 2-6M/ano.`,
    vantagens_fiscais_holding: [
      { vantagem: 'Concentração royalties na matriz', explicacao: 'Matriz Lucro Real. Despesa dedutível franqueado.' },
      { vantagem: 'Aproveitamento prejuízos', explicacao: 'Lucros unidades positivas compensam prejuízos novas/ruins.' },
      { vantagem: 'Cada unidade pode ser Simples', explicacao: 'Franqueado R$ 2-4M cabe Simples Anexo III/V.' },
      { vantagem: 'Separar riscos jurídicos', explicacao: 'Problema 1 unidade não contamina rede.' },
      { vantagem: 'Centralizar compras', explicacao: 'Matriz negocia equipamentos pra todas (volume).' },
    ],
    quando_vale_holding:
      'Vale: 2+ unidades, receita >R$5M/ano, planos expansão, risco operacional. NÃO vale: 1 unidade, <R$2M, sem expansão, custo (R$30-50k/ano) > economia.',
  },

  iss_academias: {
    titulo: 'ISS - Imposto Sobre Serviços',
    baseLegal: 'LC 116/2003',
    item_lista: '6.01 - Educação física',
    aliquotas_principais_cidades: {
      'São Paulo': '2-5% (varia subzona)',
      'Rio de Janeiro': '5%',
      'Belo Horizonte': '5%',
      'Brasília': '5%',
      'Porto Alegre': '2-5%',
      'Curitiba': '2-5%',
      'Florianópolis': '2-5%',
      'Recife': '5%',
      'Fortaleza': '5%',
    },
    no_simples: 'ISS embutido no DAS Anexo III/V - NÃO paga separado',
    no_presumido: 'ISS à parte do imposto federal',
    no_real: 'ISS à parte',
    ISS_fixo_sociedade_uniprofissional: `Sociedade UNIPROFISSIONAL paga ISS FIXO (por profissional, não % faturamento).
SP: ISS fixo Educação Física ~R$ 2.000/ano por profissional.
Academia 5 educadores físicos sócios: R$ 10.000/ano TOTAL.
Vs ISS % faturamento: 5% × R$ 1.2M = R$ 60.000/ano.
ECONOMIA: R$ 50.000/ano se enquadrar uniprofissional.
Regra restrita: profissionais devem ser sócios. Não vale academia comum LTDA/S/A.`,
  },

  reforma_tributaria_academias: {
    titulo: 'Reforma Tributária - Impacto Específico em Academias',
    baseLegal: ['EC 132/2023', 'LC 214/2025'],
    classificacao: 'Academias = "Serviços essenciais à saúde" (LC 214/2025 art. 268)',
    beneficio_60pct: `Academias têm REDUÇÃO de 30% no IBS+CBS (cesta saúde/atividade física).
Alíquota cheia estimada IBS+CBS: 27%. Com redução 30%: 18.9% efetiva.
Comparação:
- Anexo III Simples (6%): MUITO mais barato
- Anexo V (15.5%): pode compensar migrar
- Lucro Real: depende muito - geralmente pior atualmente`,
    decisao_setembro_2026: `Setembro/2026, academias decidem:
- Anexo III com Fator R: GERALMENTE CONTINUAR Simples
- Anexo V (Fator R baixo): avaliar
- Lucro Real: avaliar caso a caso (créditos IBS+CBS)`,
    creditos_ibs_cbs_academias: `Novo sistema IBS+CBS: academia COMPRA com IBS+CBS embutido, pode CREDITAR.
Energia, internet, aluguel PJ, equipamentos, manutenção.
Interessante pra academias com: alta despesa energia, equipamentos novos, aluguel alto.`,
  },

  benchmark_grandes_redes: {
    titulo: 'Como Smart Fit, Bodytech e outras pagam menos',
    smart_fit: {
      grupo: 'Bio Ritmo Participações',
      total_unidades: '~1.500 (Brasil + LatAm)',
      regime_estimado: 'Cada unidade Lucro Presumido ou Real',
      estrategias_principais: [
        'HOLDING + UNIDADES INDIVIDUAIS (cada R$ 4-6M/ano vai Lucro Presumido)',
        'ROYALTIES 5% + Marketing 4.5% para matriz Bio Ritmo (Lucro Real)',
        'Franqueado deduz como despesa = reduz lucro tributável',
        'MODELO LOW COST = ALTA FOLHA CLT (recepção, manutenção, instrutores)',
        'Fator R alto = Anexo III (6%) se fosse Simples',
        'COMPRA equipamentos volume = menor preço + créditos PIS/COFINS depreciação',
        'Holding offshore (Caymans) pré-IPO',
      ],
      economia_estimada: '5-8 pontos percentuais alíquota efetiva vs concorrente sem planejamento',
    },
    bodytech: {
      grupo: 'Bodytech Participações',
      total_unidades: '~150',
      modelo: 'Premium',
      estrategias: [
        'FOLHA ALTA premium (personal CLT) = Fator R confortável',
        'App BTFIT em PJ separada (tecnologia)',
        'Segregação rigorosa academia/loja/nutricionista',
        'PERSE parcial em aulas yoga/dança (CNAE elegível)',
        'Nutricionistas como sociedade uniprofissional (ISS fixo)',
      ],
    },
    bluefit: {
      grupo: 'Fundo Pátria (2024)',
      total_unidades: '~100',
      estrategias: ['Modelo similar Smart Fit', 'Cada unidade Lucro Presumido', 'Royalties pra controladora'],
    },
    allpfit: {
      modelo: 'Franquia 24h auto-serviço',
      desafio_fiscal: 'Folha BAIXA → Fator R cai → Anexo V (15.5%). Solução: pró-labore alto franqueado, centralizar admin, considerar Presumido.',
    },
    competex_crossfit: {
      modelo: 'CrossFit/treinamento funcional',
      cnae: '9313-1/00 ou 8591-1/00',
      estrategia: 'Simples Anexo III + instrutores CLT (Fator R alto). PERSE se CNAE 8591 (ensino esportes elegível).',
    },
  },

  erros_comuns: [
    { erro: 'Não monitorar Fator R mensalmente', impacto: 'Pode estar Anexo V quando podia III', solucao: 'Calcular Fator R todo mês' },
    { erro: 'Misturar academia + suplementos', impacto: 'Paga III sobre venda produtos', solucao: 'CNAEs secundários + segregar' },
    { erro: 'Personal PJ sem contrato robusto', impacto: 'RF descaracteriza CLT, cobra encargos 36 meses', solucao: 'Sem exclusividade, sem subordinação' },
    { erro: 'Plano anual integral joga faixa maior', impacto: 'DAS inflado naquele mês', solucao: 'Recorrência mensal' },
    { erro: 'Não aproveitar PERSE yoga/dança', impacto: 'Perde alíq zero Lucro Presumido', solucao: 'Verificar CNAEs aulas - 9001, 9329' },
    { erro: 'Não criar holding com 3+ unidades', impacto: 'Perde consolidação + royalties intra-grupo', solucao: 'Avaliar quando >R$5M' },
    { erro: 'Aumentar folha SÓ pra Fator R', impacto: 'Custo > economia', solucao: 'Calcular custo-benefício' },
  ],

  encargos_folha_academias: {
    titulo: 'INSS, FGTS e Encargos',
    encargos_clt: {
      inss_patronal: '20% (Simples: incluído DAS)',
      fgts: '8%',
      rat_sat: '2% (CNAE 9313 risco médio) + FAP',
      sistema_s: '5.8% (Simples isento)',
      total_simples: '8% FGTS + custos empresa',
      total_presumido_real: '~36% (todos encargos)',
    },
    estrategia_pro_labore_academia: `Pró-labore mínimo legal: 1 salário mínimo.
Simples Anexo III/V: pró-labore conta Fator R. Sócio INSS 11%. NÃO impacta DAS.
Estratégia: pró-labore alto favorece Fator R.
R$ 5.000/mês × 12 = R$ 60.000/ano Folha. INSS sócio R$ 6.600/ano.
Economia DAS migrando V→III: R$ 30-50k/ano. LÍQUIDO: R$ 25-45k/ano.`,
  },
} as const
