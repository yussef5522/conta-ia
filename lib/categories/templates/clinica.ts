// Template de Plano de Contas — CLÍNICA / SAÚDE
// CNAEs: 8630-5/02 (médica), 8650-0/04 (odontologia), 8650-0/06 (psicologia)
// Particularidades: receita por consulta/procedimento, materiais médicos
// descartáveis, anuidade CRM/CRO/CRP, equipamentos médicos depreciáveis,
// recebimento via plano de saúde com glosa (20-30% impact), coparticipação.

import { buildTemplate, type CategoryTemplateNode } from './_common'

const especificas: CategoryTemplateNode[] = [
  // 1.0/1.1/1.2
  { code: '1.0', name: 'Receitas Operacionais', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: null, description: 'Raiz das receitas da clínica.', color: '#10b981', icon: 'trending-up', visibleInRegimes: null, order: 100 },
  { code: '1.1', name: 'Receita de Atendimentos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Atividade-fim da clínica (consultas + procedimentos).', color: '#10b981', icon: 'stethoscope', visibleInRegimes: null, order: 110 },
  { code: '1.1.01', name: 'Particular', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Pagamento direto pelo paciente (à vista, cartão, pix).', color: '#16a34a', icon: 'wallet', visibleInRegimes: null, order: 111 },
  { code: '1.1.02', name: 'Convênios', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Receita BRUTA dos planos de saúde (sujeito a glosa em 2.2).', color: '#16a34a', icon: 'shield', visibleInRegimes: null, order: 112 },
  { code: '1.1.02.01', name: 'Plano de Saúde A', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Convênio principal — renomeie pra nome do plano (ex: Unimed, Bradesco Saúde).', color: '#22c55e', icon: 'shield-check', visibleInRegimes: null, order: 1121 },
  { code: '1.1.02.02', name: 'Plano de Saúde B', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Segundo convênio — renomeie (ex: Amil, SulAmérica).', color: '#22c55e', icon: 'shield-check', visibleInRegimes: null, order: 1122 },
  { code: '1.1.02.03', name: 'Outros Convênios', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.02', description: 'Convênios menores agregados.', color: '#22c55e', icon: 'shield', visibleInRegimes: null, order: 1123 },
  { code: '1.1.03', name: 'Procedimentos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Detalhamento por tipo de atendimento.', color: '#16a34a', icon: 'syringe', visibleInRegimes: null, order: 113 },
  { code: '1.1.03.01', name: 'Consultas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Atendimento padrão.', color: '#22c55e', icon: 'user-plus', visibleInRegimes: null, order: 1131 },
  { code: '1.1.03.02', name: 'Procedimentos Cirúrgicos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Cirurgias ambulatoriais e hospitalares.', color: '#22c55e', icon: 'scissors', visibleInRegimes: null, order: 1132 },
  { code: '1.1.03.03', name: 'Exames Diagnósticos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Exames próprios (raio-X, ultrassom, sangue, etc).', color: '#22c55e', icon: 'microscope', visibleInRegimes: null, order: 1133 },
  { code: '1.1.03.04', name: 'Tratamentos Estéticos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Botox, preenchimento, harmonização (NÃO cobertos por plano de saúde).', color: '#22c55e', icon: 'sparkles', visibleInRegimes: null, order: 1134 },
  { code: '1.1.04', name: 'Laudos e Pareceres', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Laudos médicos pagos avulsos.', color: '#16a34a', icon: 'file-text', visibleInRegimes: null, order: 114 },
  { code: '1.2', name: 'Receita Acessória', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Receitas vinculadas mas fora do core de atendimento.', color: '#10b981', icon: 'plus-circle', visibleInRegimes: null, order: 120 },
  { code: '1.2.01', name: 'Venda de Produtos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Cremes pós-procedimento, escovas, kits home-care.', color: '#16a34a', icon: 'package', visibleInRegimes: null, order: 121 },
  { code: '1.2.02', name: 'Sublocação de Sala', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Médicos parceiros / aluguel hora.', color: '#16a34a', icon: 'home', visibleInRegimes: null, order: 122 },

  // 2.2 Glosas (PARENT específico de clínica)
  { code: '2.2', name: 'Glosas e Coparticipação Convênio', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.0', description: 'Diferencial: separar glosa do convênio reduz tributação sobre receita não recebida (pode chegar a 20-30% do faturamento de convênio).', color: '#dc2626', icon: 'alert-triangle', visibleInRegimes: null, order: 220 },
  { code: '2.2.01', name: 'Coparticipação Convênio', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.2', description: 'Parte da consulta que o convênio NÃO paga (paciente paga). Tratada como dedução.', color: '#ef4444', icon: 'minus-circle', visibleInRegimes: null, order: 221 },
  { code: '2.2.02', name: 'Glosas Definitivas', type: 'EXPENSE', dreGroup: 'DEDUCOES', parentCode: '2.2', description: 'Faturamento recusado pelo plano de saúde (não recebido). Reduz tributação corretamente.', color: '#ef4444', icon: 'x-circle', visibleInRegimes: null, order: 222 },

  // 3.0 Custos
  { code: '3.0', name: 'Custo dos Serviços Prestados', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: null, description: 'Custos diretamente atribuíveis ao atendimento.', color: '#ea580c', icon: 'cog', visibleInRegimes: null, order: 300 },
  { code: '3.1', name: 'Pessoal Médico Direto', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Folha + comissão dos prestadores que atendem paciente.', color: '#ea580c', icon: 'users', visibleInRegimes: null, order: 310 },
  { code: '3.1.01', name: 'Salários Médicos CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Médicos contratados pela clínica.', color: '#f97316', icon: 'user', visibleInRegimes: null, order: 311 },
  { code: '3.1.02', name: 'Honorário Médicos PJ', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'NF tomada de PJ médica (modelo mais comum).', color: '#f97316', icon: 'briefcase', visibleInRegimes: null, order: 312 },
  { code: '3.1.03', name: 'Comissão Médicos Parceiros', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: '% por procedimento (médicos sócios/parceiros).', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 313 },
  { code: '3.1.04', name: 'Encargos Médicos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'FGTS+RAT (Simples) sobre folha CLT médica.', color: '#f97316', icon: 'shield', visibleInRegimes: null, order: 314 },
  { code: '3.2', name: 'Materiais Médicos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Insumos diretos do procedimento.', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 320 },
  { code: '3.2.01', name: 'Materiais Descartáveis', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Luvas, agulhas, gaze, máscaras.', color: '#f97316', icon: 'syringe', visibleInRegimes: null, order: 321 },
  { code: '3.2.02', name: 'Medicamentos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Anestésicos, corticoides, analgésicos.', color: '#f97316', icon: 'pill', visibleInRegimes: null, order: 322 },
  { code: '3.2.03', name: 'Material de Laboratório', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Reagentes, tubos de coleta, kits.', color: '#f97316', icon: 'flask-conical', visibleInRegimes: null, order: 323 },
  { code: '3.2.04', name: 'Material Odontológico', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Resinas, brocas, fios (clínicas odonto).', color: '#f97316', icon: 'sparkles', visibleInRegimes: null, order: 324 },

  // 5.x específicas
  { code: '5.0', name: 'Despesas Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Gastos pra manter a clínica funcionando.', color: '#fb923c', icon: 'building-2', visibleInRegimes: null, order: 500 },
  { code: '5.2', name: 'Manutenção e Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Conservação do espaço e equipamentos.', color: '#fb923c', icon: 'wrench', visibleInRegimes: null, order: 520 },
  { code: '5.2.01', name: 'Limpeza Terceirizada', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'NF tomada de empresa de limpeza (saúde exige certificações).', color: '#fbbf24', icon: 'sparkles', visibleInRegimes: null, order: 521 },
  { code: '5.2.07', name: 'Manut. Equipamentos Médicos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Calibração, manutenção preventiva (obrigação ANVISA).', color: '#fbbf24', icon: 'stethoscope', visibleInRegimes: null, order: 527 },
  { code: '5.2.08', name: 'Material de Esterilização', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Autoclave, embalagens cirúrgicas, indicadores biológicos.', color: '#fbbf24', icon: 'shield-check', visibleInRegimes: null, order: 528 },
  { code: '5.3', name: 'Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Software e infra digital.', color: '#fb923c', icon: 'laptop', visibleInRegimes: null, order: 530 },
  { code: '5.3.01', name: 'Software de Gestão Clínica', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Doctoralia, Clinicorp, AmoSaúde, prontuário eletrônico.', color: '#fbbf24', icon: 'monitor', visibleInRegimes: null, order: 531 },
  { code: '5.5', name: 'Depreciação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Reconhecimento contábil do desgaste de imobilizado.', color: '#fb923c', icon: 'trending-down', visibleInRegimes: null, order: 550 },
  { code: '5.5.01', name: 'Depreciação Equipamentos Médicos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10-20% a.a. típico (5-10 anos vida útil).', color: '#fbbf24', icon: 'stethoscope', visibleInRegimes: null, order: 551 },

  // 6.0
  { code: '6.0', name: 'Despesas Comerciais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Investimento em captação e retenção de paciente.', color: '#f97316', icon: 'megaphone', visibleInRegimes: null, order: 600 },

  // 7.0/7.4
  { code: '7.0', name: 'Despesas Administrativas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Serviços profissionais e custos da gestão.', color: '#fbbf24', icon: 'briefcase', visibleInRegimes: null, order: 700 },
  { code: '7.4', name: 'Anuidades de Conselhos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.0', description: 'Contribuições obrigatórias a conselhos profissionais de saúde.', color: '#fbbf24', icon: 'award', visibleInRegimes: null, order: 740 },
  { code: '7.4.01', name: 'Anuidade CRM (PJ)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Conselho Regional de Medicina.', color: '#fde047', icon: 'award', visibleInRegimes: null, order: 741 },
  { code: '7.4.02', name: 'Anuidade CRO (PJ)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Conselho Regional de Odontologia.', color: '#fde047', icon: 'award', visibleInRegimes: null, order: 742 },
  { code: '7.4.03', name: 'Anuidade CRP / CREFITO / Outras', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Psicologia, fisioterapia, fonoaudiologia, conforme especialidades.', color: '#fde047', icon: 'award', visibleInRegimes: null, order: 743 },

  // 9.2 Investimentos
  { code: '9.2', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: null, description: 'Aquisições de longo prazo (capitalizar e depreciar).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 920 },
  { code: '9.2.01', name: 'Cadeira Odontológica / Maca', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Mobiliário fixo de atendimento.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 921 },
  { code: '9.2.02', name: 'Equipamentos de Imagem', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Ultrassom, raio-X, tomógrafo, microscópio.', color: '#c084fc', icon: 'scan', visibleInRegimes: null, order: 922 },
  { code: '9.2.03', name: 'Autoclave / Esterilização', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Equipamento de esterilização (obrigatório).', color: '#c084fc', icon: 'shield-check', visibleInRegimes: null, order: 923 },
  { code: '9.2.04', name: 'Reformas e Benfeitorias', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Adequação predial (ANVISA, RDC 50).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 924 },
  { code: '9.2.05', name: 'Mobiliário de Recepção', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Sofás, balcão, decoração.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 925 },
  { code: '9.2.06', name: 'Equipamentos de TI', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Computadores, impressoras, monitores médicos.', color: '#c084fc', icon: 'cpu', visibleInRegimes: null, order: 926 },
  { code: '9.2.07', name: 'Sistema de Vigilância', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Câmeras, alarme.', color: '#c084fc', icon: 'camera', visibleInRegimes: null, order: 927 },
]

export const clinicaTemplate: CategoryTemplateNode[] = buildTemplate(especificas)
