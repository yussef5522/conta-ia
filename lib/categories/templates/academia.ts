// Template de Plano de Contas — ACADEMIA (CNAE 9313-1/00)
// Cobertura: 116 categorias (52+ comuns + 64 específicas).
// Decisões Yussef 03/05/2026:
//   - 7 modalidades de mensalidade (Mensal, Trim, Sem, Anual, Família, Gympass, Diária)
//   - 7 modalidades de aula em grupo (Yoga, Lutas, Crossfit/Funcional, Dança, Spinning,
//     Hidro, Treinamento Funcional)
//   - Estagiários como instrutores (Bolsa Estagiários 3.1.05)
//   - Royalties oculto por default (sem franqueada)
//   - Comissão Plataformas Gympass/TotalPass como Despesa Comercial (6.4.01)

import { buildTemplate, type CategoryTemplateNode } from './_common'

const especificas: CategoryTemplateNode[] = [
  // ========== 1.0 RECEITAS OPERACIONAIS ==========
  { code: '1.0', name: 'Receitas Operacionais', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: null, description: 'Raiz das receitas da operação da academia.', color: '#10b981', icon: 'trending-up', visibleInRegimes: null, order: 100 },

  // 1.1 Receita Principal de Serviços
  { code: '1.1', name: 'Receita Principal de Serviços', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Atividade-fim da academia: mensalidades + aulas + serviços a alunos.', color: '#10b981', icon: 'activity', visibleInRegimes: null, order: 110 },
  { code: '1.1.01', name: 'Mensalidades', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Cobrança recorrente do plano do aluno.', color: '#16a34a', icon: 'repeat', visibleInRegimes: null, order: 111 },
  { code: '1.1.01.01', name: 'Plano Mensal', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Pagamento mês a mês, sem fidelidade.', color: '#22c55e', icon: 'calendar', visibleInRegimes: null, order: 1111 },
  { code: '1.1.01.02', name: 'Plano Trimestral', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Pacote de 3 meses com desconto.', color: '#22c55e', icon: 'calendar', visibleInRegimes: null, order: 1112 },
  { code: '1.1.01.03', name: 'Plano Semestral', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Pacote de 6 meses.', color: '#22c55e', icon: 'calendar', visibleInRegimes: null, order: 1113 },
  { code: '1.1.01.04', name: 'Plano Anual', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Pacote 12 meses (maior desconto, gera caixa antecipado).', color: '#22c55e', icon: 'calendar', visibleInRegimes: null, order: 1114 },
  { code: '1.1.01.05', name: 'Plano Família / Múltiplos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Plano coletivo com 2+ membros vinculados.', color: '#22c55e', icon: 'users', visibleInRegimes: null, order: 1115 },
  { code: '1.1.01.06', name: 'Plano Gympass/TotalPass', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Receita BRUTA cobrada do aluno via plataforma. A comissão é registrada separadamente em 6.4.01.', color: '#22c55e', icon: 'star', visibleInRegimes: null, order: 1116 },
  { code: '1.1.01.07', name: 'Plano Diária Avulsa', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.01', description: 'Cobrança por treino sem fidelização.', color: '#22c55e', icon: 'clock', visibleInRegimes: null, order: 1117 },
  { code: '1.1.02', name: 'Adesões e Matrículas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Taxa única de entrada do aluno novo.', color: '#16a34a', icon: 'user-plus', visibleInRegimes: null, order: 112 },
  { code: '1.1.03', name: 'Personal Training', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Acompanhamento individualizado (interno ou autônomo do espaço).', color: '#16a34a', icon: 'user-check', visibleInRegimes: null, order: 113 },
  { code: '1.1.04', name: 'Aulas em Grupo', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Modalidades coletivas — separar permite ver mix.', color: '#16a34a', icon: 'users', visibleInRegimes: null, order: 114 },
  { code: '1.1.04.01', name: 'Yoga / Pilates', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Aulas de yoga e pilates (mat/aparelho).', color: '#22c55e', icon: 'flower', visibleInRegimes: null, order: 1141 },
  { code: '1.1.04.02', name: 'Lutas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Boxe, Muay Thai, Jiu-Jitsu, MMA.', color: '#22c55e', icon: 'swords', visibleInRegimes: null, order: 1142 },
  { code: '1.1.04.03', name: 'Crossfit / Funcional Licenciado', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Crossfit (metodologia licenciada Crossfit Inc.) e variações funcionais.', color: '#22c55e', icon: 'dumbbell', visibleInRegimes: null, order: 1143 },
  { code: '1.1.04.04', name: 'Dança / Ritmos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Zumba, ritmos, dança contemporânea.', color: '#22c55e', icon: 'music', visibleInRegimes: null, order: 1144 },
  { code: '1.1.04.05', name: 'Spinning / Indoor', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Bike indoor coletiva.', color: '#22c55e', icon: 'bike', visibleInRegimes: null, order: 1145 },
  { code: '1.1.04.06', name: 'Hidroginástica', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Atividades aquáticas em grupo.', color: '#22c55e', icon: 'droplets', visibleInRegimes: null, order: 1146 },
  { code: '1.1.04.07', name: 'Treinamento Funcional', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1.04', description: 'Funcional genérico (não licenciado), HIIT, mobilidade.', color: '#22c55e', icon: 'activity', visibleInRegimes: null, order: 1147 },
  { code: '1.1.05', name: 'Avaliações Físicas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Bioimpedância, anamnese, reavaliação.', color: '#16a34a', icon: 'clipboard-list', visibleInRegimes: null, order: 115 },
  { code: '1.1.06', name: 'Eventos Pagos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.1', description: 'Workshops, intensivos, retiros.', color: '#16a34a', icon: 'calendar-check', visibleInRegimes: null, order: 116 },

  // 1.2 Receita Acessória
  { code: '1.2', name: 'Receita Acessória', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.0', description: 'Receitas vinculadas mas fora do core (mercadoria, sublocação).', color: '#10b981', icon: 'shopping-bag', visibleInRegimes: null, order: 120 },
  { code: '1.2.01', name: 'Venda de Suplementos', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Whey, creatina, termogênicos. Exige IE + ICMS.', color: '#16a34a', icon: 'package', visibleInRegimes: null, order: 121 },
  { code: '1.2.02', name: 'Venda de Roupas e Acessórios', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Camisetas, regatas, luvas, garrafas. Exige IE + ICMS.', color: '#16a34a', icon: 'shirt', visibleInRegimes: null, order: 122 },
  { code: '1.2.03', name: 'Sublocação de Espaço', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Aluguel pra personal externo, aulas particulares, outros profissionais.', color: '#16a34a', icon: 'home', visibleInRegimes: null, order: 123 },
  { code: '1.2.04', name: 'Estacionamento', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Cobrança de vaga (próprio ou parceria).', color: '#16a34a', icon: 'car', visibleInRegimes: null, order: 124 },
  { code: '1.2.05', name: 'Vending Machines', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentCode: '1.2', description: 'Comissão sobre máquinas de bebida/snacks.', color: '#16a34a', icon: 'coffee', visibleInRegimes: null, order: 125 },

  // ========== 3.0 CUSTOS DOS SERVIÇOS ==========
  { code: '3.0', name: 'Custo dos Serviços Prestados', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: null, description: 'Custos diretamente atribuíveis ao serviço entregue ao aluno.', color: '#ea580c', icon: 'cog', visibleInRegimes: null, order: 300 },
  { code: '3.1', name: 'Pessoal Operacional Direto', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Folha dos profissionais que atendem aluno direto (instrutores).', color: '#ea580c', icon: 'users', visibleInRegimes: null, order: 310 },
  { code: '3.1.01', name: 'Salários Instrutores CLT', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Folha CLT dos instrutores efetivos.', color: '#f97316', icon: 'user', visibleInRegimes: null, order: 311 },
  { code: '3.1.02', name: 'Encargos Instrutores', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'FGTS+RAT (Simples) ou +CPP+Terceiros (Não-Simples) sobre folha de instrutores.', color: '#f97316', icon: 'shield', visibleInRegimes: null, order: 312 },
  { code: '3.1.03', name: 'Comissão Personal Autônomo', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'RPA ou NFS-e de personal autônomo (com retenção INSS 11% + ISS).', color: '#f97316', icon: 'user-cog', visibleInRegimes: null, order: 313 },
  { code: '3.1.04', name: 'Comissão Personal PJ', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'NF tomada de personal com CNPJ próprio (não conta no Fator R).', color: '#f97316', icon: 'briefcase', visibleInRegimes: null, order: 314 },
  { code: '3.1.05', name: 'Bolsa Estagiários', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.1', description: 'Lei 11.788/2008. Bolsa-auxílio sem encargos (sem FGTS, INSS, 13º, férias). Auxílio transporte vai em 4.4.01.', color: '#f97316', icon: 'graduation-cap', visibleInRegimes: null, order: 315 },
  { code: '3.2', name: 'Royalties (Franqueada)', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Royalties pagos à franqueadora. Oculto por default (ativar se franqueada).', color: '#ea580c', icon: 'crown', visibleInRegimes: null, order: 320, isActive: false },
  { code: '3.3', name: 'CMV - Mercadorias Vendidas', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.0', description: 'Custo das mercadorias revendidas (suplementos/roupas).', color: '#ea580c', icon: 'package', visibleInRegimes: null, order: 330 },
  { code: '3.3.01', name: 'CMV Suplementos', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.3', description: 'Custo de aquisição dos suplementos vendidos.', color: '#f97316', icon: 'package', visibleInRegimes: null, order: 331 },
  { code: '3.3.02', name: 'CMV Roupas e Acessórios', type: 'EXPENSE', dreGroup: 'CUSTO_PRODUTO_VENDIDO', parentCode: '3.3', description: 'Custo de aquisição de vestuário esportivo revendido.', color: '#f97316', icon: 'shirt', visibleInRegimes: null, order: 332 },

  // ========== 5.0/5.2/5.3/5.5 — Operacionais não-comuns ==========
  { code: '5.0', name: 'Despesas Operacionais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Gastos pra manter o espaço funcionando (estrutura).', color: '#fb923c', icon: 'building-2', visibleInRegimes: null, order: 500 },
  { code: '5.2', name: 'Manutenção e Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Conservação do espaço e equipamentos.', color: '#fb923c', icon: 'wrench', visibleInRegimes: null, order: 520 },
  { code: '5.2.01', name: 'Limpeza Terceirizada', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'NF tomada de empresa de limpeza.', color: '#fbbf24', icon: 'sparkles', visibleInRegimes: null, order: 521 },
  { code: '5.2.02', name: 'Manut. Equipamentos Musculação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Reparos pequenos em halteres, máquinas, racks (sem capitalizar).', color: '#fbbf24', icon: 'dumbbell', visibleInRegimes: null, order: 522 },
  { code: '5.2.03', name: 'Manut. Equipamentos Cardio', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Esteiras, bikes, elípticos, transports (manutenção corretiva e preventiva).', color: '#fbbf24', icon: 'activity', visibleInRegimes: null, order: 523 },
  { code: '5.2.04', name: 'Manut. Predial', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Pinturas, vazamentos, elétrica, pequenos reparos do imóvel.', color: '#fbbf24', icon: 'hammer', visibleInRegimes: null, order: 524 },
  { code: '5.2.05', name: 'Material de Limpeza', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Detergentes, desinfetantes, panos, vassouras.', color: '#fbbf24', icon: 'spray-can', visibleInRegimes: null, order: 525 },
  { code: '5.2.06', name: 'Material de Higiene', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.2', description: 'Papel toalha, sabonete líquido, álcool, papel higiênico.', color: '#fbbf24', icon: 'hand', visibleInRegimes: null, order: 526 },
  { code: '5.3', name: 'Tecnologia', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Software e infra digital.', color: '#fb923c', icon: 'laptop', visibleInRegimes: null, order: 530 },
  { code: '5.3.01', name: 'Software de Gestão', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Tecnofit, Pacto, NextFit, MFit (gestão de alunos/treinos).', color: '#fbbf24', icon: 'monitor', visibleInRegimes: null, order: 531 },
  { code: '5.3.02', name: 'Aplicativo de Membros', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'App de aluno (treinos, presença, agendamento).', color: '#fbbf24', icon: 'smartphone', visibleInRegimes: null, order: 532 },
  { code: '5.3.03', name: 'Hospedagem/Servidores', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'AWS, hospedagem de site, e-commerce próprio.', color: '#fbbf24', icon: 'server', visibleInRegimes: null, order: 533 },
  { code: '5.3.04', name: 'Equipamentos de TI (manut.)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.3', description: 'Reparos de PC, impressora, totem de auto-atendimento.', color: '#fbbf24', icon: 'cpu', visibleInRegimes: null, order: 534 },
  { code: '5.5', name: 'Depreciação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.0', description: 'Reconhecimento contábil do desgaste de imobilizado.', color: '#fb923c', icon: 'trending-down', visibleInRegimes: null, order: 550 },
  { code: '5.5.01', name: 'Depreciação Equip. Musculação', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10% a.a. típico (vida útil 10 anos).', color: '#fbbf24', icon: 'dumbbell', visibleInRegimes: null, order: 551 },
  { code: '5.5.02', name: 'Depreciação Equip. Cardio', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '20% a.a. típico (vida útil 5 anos — desgaste maior).', color: '#fbbf24', icon: 'activity', visibleInRegimes: null, order: 552 },
  { code: '5.5.03', name: 'Depreciação Móveis/Climatização', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '5.5', description: '10% a.a. típico (móveis, ar condicionado).', color: '#fbbf24', icon: 'armchair', visibleInRegimes: null, order: 553 },

  // ========== 6.0/6.4 — Comerciais não-comuns ==========
  { code: '6.0', name: 'Despesas Comerciais', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: null, description: 'Investimento em captação e retenção de aluno.', color: '#f97316', icon: 'megaphone', visibleInRegimes: null, order: 600 },
  { code: '6.4', name: 'Comissões e Plataformas', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.0', description: 'Taxas pagas a plataformas de mensalidade e comissões de vendas.', color: '#f97316', icon: 'percent', visibleInRegimes: null, order: 640 },
  { code: '6.4.01', name: 'Comissão Plataformas (Gympass/TotalPass)', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: 'Comissão paga a plataformas de mensalidade (Gympass, TotalPass etc). Tipicamente 30-40% do bruto. Permite calcular margem real do canal.', color: '#fb923c', icon: 'star', visibleInRegimes: null, order: 641 },
  { code: '6.4.02', name: 'Comissão de Vendas', type: 'EXPENSE', dreGroup: 'DESPESAS_COMERCIAIS', parentCode: '6.4', description: '% pra consultor que vende plano (interno ou parceiro).', color: '#fb923c', icon: 'percent', visibleInRegimes: null, order: 642 },

  // ========== 7.0/7.4 — Administrativas não-comuns ==========
  { code: '7.0', name: 'Despesas Administrativas', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: null, description: 'Serviços profissionais e custos da gestão.', color: '#fbbf24', icon: 'briefcase', visibleInRegimes: null, order: 700 },
  { code: '7.4', name: 'Anuidades de Conselhos', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.0', description: 'Contribuições obrigatórias a conselhos profissionais.', color: '#fbbf24', icon: 'award', visibleInRegimes: null, order: 740 },
  { code: '7.4.01', name: 'Anuidade CREF (PJ)', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Anuidade da PJ no Conselho Regional de Educação Física (~R$ 1.569 em 2026).', color: '#fde047', icon: 'award', visibleInRegimes: null, order: 741 },
  { code: '7.4.02', name: 'Outras Anuidades Setoriais', type: 'EXPENSE', dreGroup: 'DESPESAS_ADMINISTRATIVAS', parentCode: '7.4', description: 'Associações setoriais (ACAD, IHRSA local).', color: '#fde047', icon: 'users', visibleInRegimes: null, order: 742 },

  // ========== 9.2 INVESTIMENTOS (CapEx) ==========
  { code: '9.2', name: 'Investimentos', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: null, description: 'Aquisições de longo prazo (capitalizar e depreciar).', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 920 },
  { code: '9.2.01', name: 'Equipamentos Musculação', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Halteres, anilhas, máquinas guiadas, racks.', color: '#c084fc', icon: 'dumbbell', visibleInRegimes: null, order: 921 },
  { code: '9.2.02', name: 'Equipamentos Cardio', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Esteiras, bikes, elípticos, transports.', color: '#c084fc', icon: 'activity', visibleInRegimes: null, order: 922 },
  { code: '9.2.03', name: 'Equipamentos Funcional/Crossfit', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Kettlebells, cordas, racks de crossfit, GHD.', color: '#c084fc', icon: 'move', visibleInRegimes: null, order: 923 },
  { code: '9.2.04', name: 'Reformas e Benfeitorias', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Obras que aumentam vida útil do imóvel.', color: '#c084fc', icon: 'hammer', visibleInRegimes: null, order: 924 },
  { code: '9.2.05', name: 'Móveis e Utensílios', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Recepção, vestiário, escritório, armários.', color: '#c084fc', icon: 'armchair', visibleInRegimes: null, order: 925 },
  { code: '9.2.06', name: 'Software (licenças perpétuas)', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Licenças de software adquiridas (não SaaS).', color: '#c084fc', icon: 'disc', visibleInRegimes: null, order: 926 },
  { code: '9.2.07', name: 'Sistema de Som', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Caixas, microfones, amplificadores.', color: '#c084fc', icon: 'volume-2', visibleInRegimes: null, order: 927 },
  { code: '9.2.08', name: 'Climatização', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Ar condicionado, ventilação, exaustão.', color: '#c084fc', icon: 'wind', visibleInRegimes: null, order: 928 },
  { code: '9.2.09', name: 'Sistema de Vigilância', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Câmeras, alarme, controle de acesso (catraca, biometria).', color: '#c084fc', icon: 'camera', visibleInRegimes: null, order: 929 },
  { code: '9.2.10', name: 'Sinalização e Comunicação Visual', type: 'EXPENSE', dreGroup: 'INVESTIMENTOS', parentCode: '9.2', description: 'Placas, fachada, painéis, comunicação interna.', color: '#c084fc', icon: 'sign-post', visibleInRegimes: null, order: 930 },
]

export const academiaTemplate: CategoryTemplateNode[] = buildTemplate(especificas)
