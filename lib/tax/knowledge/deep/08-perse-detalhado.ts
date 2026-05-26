/**
 * PERSE - PROGRAMA EMERGENCIAL DE RETOMADA DO SETOR DE EVENTOS
 * Lei 14.148/2021 + Lei 14.859/2024
 * Vigência: até 28/02/2027
 */

export const PERSE_KB = {
  base_legal: [
    'Lei 14.148/2021 (original)',
    'Lei 14.859/2024 (alteração - mantém até fev/2027)',
    'Portaria ME 11.266/2022 (CNAEs elegíveis atualizada)',
    'Solução de Consulta COSIT 89/2024',
    'Solução de Consulta COSIT 215/2023',
  ],

  beneficio: {
    aliquota: 'ZERO',
    tributos: ['PIS/Pasep', 'COFINS', 'IRPJ', 'CSLL'],
    aplicacao_por_regime: {
      lucro_presumido: 'Zero em PIS+COFINS+IRPJ+CSLL até fev/2027',
      lucro_real: 'Zero em PIS+COFINS até fev/2027 (IRPJ/CSLL voltaram em 2025)',
      simples_nacional: 'NÃO se aplica (Simples tem regime próprio)',
    },
  },

  vigencia: {
    inicio: '18/03/2022',
    fim: '28/02/2027 (5 anos = 60 meses)',
    observacao: 'Lei 14.859/2024 manteve. Aproveitar enquanto vigente.',
  },

  requisitos: [
    'CNAE elegível (anexos Portaria ME 11.266/2022)',
    'CNAE como principal ou preponderante em 18/03/2022',
    'Para alguns CNAEs (restaurantes): Cadastur ativo em 18/03/2022',
    'Regime Lucro Real ou Presumido',
    'Apurar receita do CNAE elegível separadamente',
  ],

  cnaes_elegiveis_principais: {
    restaurantes_bares: [
      '5611-2/01 - Restaurantes e similares',
      '5611-2/02 - Bares sem entretenimento',
      '5611-2/03 - Lanchonetes',
      '5611-2/04 - Bares com entretenimento',
      '5611-2/05 - Restaurantes com delivery',
      '5620-1/01 - Fornecimento alimentos para empresas',
      '5620-1/02 - Catering',
      '5620-9/02 - Bufê para eventos',
    ],
    eventos_entretenimento: [
      '9001-9/99 - Artes cênicas',
      '9003-5/00 - Gestão espaços para eventos',
      '9319-1/01 - Produção eventos esportivos',
      '9329-8/01 - Discotecas, danceterias',
      '7990-2/00 - Serviços reservas',
      '9329-8/03 - Sinuca, bilhar',
    ],
    cultura_arte: [
      '9001-9/01 - Produção teatral',
      '9001-9/03 - Produção espetáculos circenses',
      '5912-0/01 - Produção fonográfica',
      '5811-5/00 - Edição de livros',
    ],
    turismo: [
      '5510-8/01 - Hotéis',
      '5510-8/02 - Apart-hotéis',
      '5590-6/02 - Camping',
      '7911-2/00 - Agências de viagem',
      '7912-1/00 - Operadores turísticos',
      '7990-2/00 - Serviços reservas',
    ],
    transporte_eventos: [
      '4929-9/02 - Transporte rodoviário coletivo turismo',
      '5099-8/01 - Transporte aquaviário turismo',
    ],
  },

  cadastur_obrigatorio: {
    titulo: 'CNAEs que precisam Cadastur (Anexo II Portaria)',
    cnaes: [
      '5611-2/01 - Restaurantes',
      '5611-2/03 - Lanchonetes',
      '5620-1/01 - Fornecimento empresas',
      '5620-1/02 - Catering',
      '5620-9/02 - Bufê',
      'Outros serviços turísticos',
    ],
    requisito: 'Inscrição ATIVA no Cadastur em 18/03/2022',
    observacao: 'Sem Cadastur ativo na data = SEM benefício, mesmo com CNAE correto',
  },

  como_aderir: [
    '1. Verificar CNAE elegível em 18/03/2022 (histórico CNPJ Receita Federal)',
    '2. Se exigir Cadastur: verificar inscrição ativa em 18/03/2022',
    '3. Apurar receitas APENAS do CNAE elegível (separar)',
    '4. DCTFWeb: lançar PIS+COFINS com alíquota zero',
    '5. Se Lucro Presumido: zerar IRPJ/CSLL também',
    '6. Se Lucro Real: zerar PIS+COFINS apenas',
    '7. Guardar TODA documentação (NF-e, Cadastur, histórico CNAE)',
    '8. Validar com contador antes',
  ],

  exemplo_restaurante: `Restaurante Lucro Presumido R$ 1.2M/ano:

SEM PERSE:
- PIS R$ 1.2M × 0.65% = R$ 7.800
- COFINS R$ 1.2M × 3% = R$ 36.000
- IRPJ base 8% × 15% = R$ 14.400 + adicional R$ 9.600 = R$ 24.000
- CSLL base 12% × 9% = R$ 12.960
TOTAL FEDERAL: R$ 80.760/ano

COM PERSE (até fev/2027):
TOTAL FEDERAL: R$ 0
ECONOMIA: R$ 80.760/ANO

Continua: ICMS, ISS, INSS, FGTS, outros.`,

  armadilhas: [
    'CNAE alterado APÓS 18/03/2022 não retroage',
    'Sem Cadastur quando exigido = perde (mesmo com CNAE certo)',
    'Atividade preponderante = maior receita absoluta',
    'Múltiplas atividades: SÓ receita do CNAE elegível',
    'Lucro Real: IRPJ/CSLL voltaram em 2025',
    'Empresa com débito fiscal pode perder benefício',
  ],

  jurisprudencia: {
    TRF3_2024: 'Decisões majoritárias exigindo Cadastur quando previsto',
    cosit_89_2024: 'Confirma vigência até fev/2027',
    cosit_215_2023: 'CNAE alterado depois NÃO retroage',
  },

  pos_perse_estrategia: `Após março/2027 voltam alíquotas normais.
PRÉ-PLANEJAR: avaliar regime tributário.
- Migração para Simples (LC 192/2022 garante Anexo I para restaurantes)
- Ou Lucro Real com créditos PIS/COFINS
Não deixar pra última hora.`,
} as const
