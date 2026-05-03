// Template de Plano de Contas — SALÃO DE BELEZA / ESTÉTICA
// CNAEs: 9602-5/01 (cabeleireiros), 9602-5/02 (estética)
// Particularidades: Lei 12.592/2012 + 13.352/2016 (Salão Parceiro), comissão
// profissionais autônomos/parceiros, produtos consumo + revenda, booth rental.

import { buildTemplate, type CategoryTemplateNode } from './_common'

const especificas: CategoryTemplateNode[] = [
  // 1.0/1.1/1.2
  { code: '1.0', name: 'Receitas Operacionais', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: null, description: 'Raiz das receitas do salão.', color: '#10b981', icon: 'trending-up', visibleInRegimes: null, order: 100 },
  { code: '1.1', name: 'Receita de Serviços', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Atividade-fim do salão (serviços de beleza).', color: '#10b981', icon: 'sparkles', visibleInRegimes: null, order: 110 },
  { code: '1.1.01', name: 'Cabelo', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Serviços capilares.', color: '#16a34a', icon: 'scissors', visibleInRegimes: null, order: 111 },
  { code: '1.1.01.01', name: 'Corte', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Corte feminino, masculino, infantil.', color: '#22c55e', icon: 'scissors', visibleInRegimes: null, order: 1111 },
  { code: '1.1.01.02', name: 'Coloração / Mechas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Serviços químicos (tintura, luzes, ombré, balaiagem).', color: '#22c55e', icon: 'palette', visibleInRegimes: null, order: 1112 },
  { code: '1.1.01.03', name: 'Tratamentos / Hidratação', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Cronograma capilar, hidratação, reconstrução.', color: '#22c55e', icon: 'droplets', visibleInRegimes: null, order: 1113 },
  { code: '1.1.01.04', name: 'Escova / Penteado', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Eventos, casamentos, formaturas.', color: '#22c55e', icon: 'wind', visibleInRegimes: null, order: 1114 },
  { code: '1.1.02', name: 'Manicure / Pedicure', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Mãos e pés.', color: '#16a34a', icon: 'hand', visibleInRegimes: null, order: 112 },
  { code: '1.1.03', name: 'Estética Facial / Corporal', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Procedimentos estéticos (não-invasivos).', color: '#16a34a', icon: 'sparkles', visibleInRegimes: null, order: 113 },
  { code: '1.1.03.01', name: 'Limpeza Facial', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Limpeza de pele profissional.', color: '#22c55e', icon: 'sparkles', visibleInRegimes: null, order: 1131 },
  { code: '1.1.03.02', name: 'Massagem', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Modeladora, relaxante, drenagem.', color: '#22c55e', icon: 'hand', visibleInRegimes: null, order: 1132 },
  { code: '1.1.03.03', name: 'Depilação', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Cera, laser, fotodepilação.', color: '#22c55e', icon: 'zap', visibleInRegimes: null, order: 1133 },
  { code: '1.1.03.04', name: 'Procedimentos Estéticos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.03', description: 'Botox capilar, peelings, microagulhamento.', color: '#22c55e', icon: 'syringe', visibleInRegimes: null, order: 1134 },
  { code: '1.1.04', name: 'Barba / Barbearia', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Serviços masculinos especializados.', color: '#16a34a', icon: 'user', visibleInRegimes: null, order: 114 },
  { code: '1.1.05', name: 'Maquiagem', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Eventos, noivas, ensaios.', color: '#16a34a', icon: 'palette', visibleInRegimes: null, order: 115 },
  { code: '1.2', name: 'Receita Acessória', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Receitas vinculadas mas fora do core de serviços.', color: '#10b981', icon: 'plus-circle', visibleInRegimes: null, order: 120 },
  { code: '1.2.01', name: 'Revenda de Produtos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Cosméticos para uso doméstico do cliente (xampu, condicionador, máscaras).', color: '#16a34a', icon: 'package', visibleInRegimes: null, order: 121 },
  { code: '1.2.02', name: 'Aluguel de Cadeira / Booth', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Booth rental — espaço alugado a profissional independente.', color: '#16a34a', icon: 'armchair', visibleInRegimes: null, order: 122 },
  { code: '1.2.03', name: 'Pacotes Combo / Day Spa', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Combos de serviços com desconto.', color: '#16a34a', icon: 'gift', visibleInRegimes: null, order: 123 },

  // 3.0 Custos
  { code: '3.0', name: 'Custo dos Serviços Prestados', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: null, description: 'Custos diretamente atribuíveis ao serviço prestado ao cliente.', color: '#ea580c', icon: 'cog', visibleInRegimes: null, order: 300 },
  { code: '3.1', name: 'Profissionais Diretos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Quem atende cliente direto.', color: '#ea580c', icon: 'users', visibleInRegimes: null, order: 310 },
  { code: '3.1.01', name: 'Salários Profissionais CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Cabeleireiros, esteticistas, manicures CLT.', color: '#f97316', icon: 'user', visibleInRegimes: null, order: 311 },
  { code: '3.1.02', name: 'Comissão Parceiros (Lei 12.592)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Cota-parte do profissional parceiro autônomo/MEI sob regime Salão Parceiro (Lei 12.592/2012 + 13.352/2016).', color: '#f97316', icon: 'handshake', visibleInRegimes: null, order: 312 },
  { code: '3.1.03', name: 'Comissão Autônomos (RPA/NFS-e)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Pagamentos a autônomos não-parceiros (com retenção INSS+ISS).', color: '#f97316', icon: 'user-cog', visibleInRegimes: null, order: 313 },
  { code: '3.1.04', name: 'Encargos Profissionais CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'FGTS+RAT (Simples) sobre folha CLT.', color: '#f97316', icon: 'shield', visibleInRegimes: null, order: 314 },
  { code: '3.2', name: 'Insumos de Beleza', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Materiais aplicados nos serviços.', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 320 },
  { code: '3.2.01', name: 'Cosméticos de Consumo', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Produtos profissionais usados no atendimento (não revendidos).', color: '#f97316', icon: 'droplet', visibleInRegimes: null, order: 321 },
  { code: '3.2.02', name: 'CMV Cosméticos Revenda', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Custo dos produtos vendidos para cliente levar pra casa.', color: '#f97316', icon: 'package', visibleInRegimes: null, order: 322 },
  { code: '3.2.03', name: 'Material de Manicure', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Esmaltes, alicates, lixas, removedores.', color: '#f97316', icon: 'hand', visibleInRegimes: null, order: 323 },
  { code: '3.2.04', name: 'Produtos Capilares Profissionais', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.2', description: 'Coloração, descolorante, química profissional.', color: '#f97316', icon: 'palette', visibleInRegimes: null, order: 324 },

  // 5.x específicas
  { code: '5.0', name: 'Despesas Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Gastos pra manter o salão funcionando.', color: '#fb923c', icon: 'building-2', visibleInRegimes: null, order: 500 },
  { code: '5.2', name: 'Manutenção e Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Conservação do espaço e equipamentos.', color: '#fb923c', icon: 'wrench', visibleInRegimes: null, order: 520 },
  { code: '5.2.01', name: 'Limpeza Terceirizada', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'NF tomada de empresa de limpeza.', color: '#fbbf24', icon: 'sparkles', visibleInRegimes: null, order: 521 },
  { code: '5.2.07', name: 'Manut. Equipamentos Estética', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Aparelhos de laser, RF, ultrassom estético, secador.', color: '#fbbf24', icon: 'zap', visibleInRegimes: null, order: 527 },
  { code: '5.3', name: 'Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Software de gestão e infra digital.', color: '#fb923c', icon: 'laptop', visibleInRegimes: null, order: 530 },
  { code: '5.3.01', name: 'Software de Gestão Salão', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Belle, Trinks, BeautyTech, agendamento + pagamento.', color: '#fbbf24', icon: 'monitor', visibleInRegimes: null, order: 531 },
  { code: '5.5', name: 'Depreciação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Reconhecimento contábil do desgaste de imobilizado.', color: '#fb923c', icon: 'trending-down', visibleInRegimes: null, order: 550 },
  { code: '5.5.01', name: 'Depreciação Equipamentos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10-20% a.a. (cadeira, lavatório, aparelhos).', color: '#fbbf24', icon: 'armchair', visibleInRegimes: null, order: 551 },

  // 6.0
  { code: '6.0', name: 'Despesas Comerciais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Investimento em captação e retenção de cliente.', color: '#f97316', icon: 'megaphone', visibleInRegimes: null, order: 600 },

  // 7.0
  { code: '7.0', name: 'Despesas Administrativas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Serviços profissionais e custos da gestão.', color: '#fbbf24', icon: 'briefcase', visibleInRegimes: null, order: 700 },

  // 9.2 Investimentos
  { code: '9.2', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: null, description: 'Aquisições de longo prazo (capitalizar e depreciar).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 920 },
  { code: '9.2.01', name: 'Cadeiras e Lavatórios', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Cadeiras hidráulicas, lavatórios profissionais.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 921 },
  { code: '9.2.02', name: 'Aparelhos de Estética', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Laser, radiofrequência, ultrassom, fotodepilação.', color: '#c084fc', icon: 'zap', visibleInRegimes: null, order: 922 },
  { code: '9.2.03', name: 'Reformas e Benfeitorias', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Obras estruturais, pintura especial, decoração.', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 923 },
  { code: '9.2.04', name: 'Mobiliário', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Recepção, vitrine de produtos, espelhos.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 924 },
  { code: '9.2.05', name: 'Equipamentos de TI', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Computador caixa, tablets de agendamento.', color: '#c084fc', icon: 'cpu', visibleInRegimes: null, order: 925 },
]

export const salaoTemplate: CategoryTemplateNode[] = buildTemplate(especificas)
