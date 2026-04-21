# Conta IA - Sistema Financeiro Empresarial com IA

## Visão geral

Conta IA é um SaaS de gestão financeira para empresas brasileiras com agente de IA contadora integrado. O sistema se conecta às contas bancárias via Open Finance e automatiza conciliação, categorização, apuração de impostos e relatórios.

**Nome do produto:** Conta IA  
**Domínio ideal:** contaia.com.br (verificar disponibilidade)  
**Tagline sugerida:** "Seu contador inteligente que nunca dorme"

**Público-alvo inicial:** pequenas e médias empresas brasileiras de qualquer setor (academias, lojas, restaurantes, clínicas, salões, prestadores de serviço, comércios, etc.)

**Fase atual:** FASE 2 concluída — em FASE 2.1 (correções de interface antes da FASE 3)

## Diferenciais competitivos

1. IA agentica que aprende e raciocina sobre contabilidade (não só categoriza)
2. Pronto para a Reforma Tributária (IBS/CBS/Split Payment) desde o dia 1
3. Open Finance nativo em tempo real
4. Multi-empresa com consolidação automática
5. Preço acessível (R$ 149 a R$ 999/mês)
6. Interface em português, design moderno e intuitivo

## Stack técnica

- **Backend:** Next.js 14 API Routes + TypeScript (não Express — fullstack Next.js)
- **Banco de dados:** SQLite (desenvolvimento local) / PostgreSQL (produção futura)
- **ORM:** Prisma
- **Frontend:** Next.js 14 + TailwindCSS + shadcn/ui
- **Autenticação:** JWT + bcrypt (sem refresh token ainda — previsto FASE 3)
- **Open Finance:** Pluggy.ai (implementado na FASE 2, adiado para FASE 8 — bancos do usuário não suportados bem)
- **Importação bancária:** OFX/QFX (principal método atual — SGML e XML)
- **IA Contadora:** API Anthropic (Claude) com BrasilAPI — previsto FASE 3
- **OCR:** Google Document AI ou AWS Textract (futuro)
- **Pagamentos SaaS:** Stripe ou Kiwify (futuro)
- **Hospedagem:** localhost durante desenvolvimento (Windows)

**Ambiente de desenvolvimento:** Windows do Yussef (mesma máquina do AcadOS)

## Arquitetura de dados

### Modelo multi-tenant
- `users` - donos das empresas (Yussef é o primeiro usuário)
- `companies` - cada CNPJ é uma empresa separada e independente
- `user_companies` - relação N:N (um user pode ter várias empresas)
- `bank_accounts` - cada conta bancária pertence a uma empresa
- `transactions` - movimentações, ligadas a uma conta bancária
- `categories` - plano de contas customizável por empresa
- `suppliers` - fornecedores identificados por CNPJ
- `invoices` - NF-e, NFC-e, NFS-e emitidas e recebidas
- `ai_learning_rules` - regras aprendidas pela IA por empresa

### Tipos de empresa suportados
O sistema deve suportar categorização específica por setor desde o início, com um enum `company_type`:
- `service` - academias, clínicas, salões, prestadores (foco ISS, mensalidades recorrentes)
- `retail` - lojas, comércios, roupas (foco ICMS, estoque, NFC-e)
- `restaurant` - bares, restaurantes, delivery (misto, SAT, alto giro, insumos)
- `industry` - indústrias e fabricantes (IPI, insumos, produção)
- `mixed` - empresas híbridas
- `other` - outros tipos

O cadastro de empresa permite ao usuário escolher o tipo no momento do cadastro, e o sistema ajusta automaticamente plano de contas sugerido, categorias de receita/despesa típicas, relatórios relevantes e alertas customizados.

## Módulos do sistema (MVP)

### 1. Painel Admin SaaS
- Gestão de clientes/assinaturas
- Planos: Starter (R$ 149), Business (R$ 399), Enterprise (R$ 999)
- Dashboard de MRR, churn, novos clientes
- Logs de uso da IA
- Gestão de features por plano

### 2. Painel Cliente (para empresas assinantes)
- **Dashboard** - visão geral com saldo, fluxo de caixa, alertas
- **Empresas** - cadastro multi-CNPJ com tipo de setor
- **Contas Bancárias** - conexão Open Finance via Pluggy
- **Transações** - listagem, categorização, conciliação
- **Fornecedores** - base de CNPJs identificados
- **Relatórios** - DRE, fluxo de caixa, balancete, centro de custo
- **Impostos** - cálculo automático DAS, IRPJ, CSLL, IBS/CBS
- **Chat IA Contadora** - perguntas e respostas sobre contabilidade
- **Configurações** - plano de contas, usuários, integrações

### 3. Motor de IA
- Categorização automática via CNPJ do destinatário
- Pergunta ao usuário quando não identifica (uma vez só)
- Aprende regras e replica em todas as próximas transações
- RAG com legislação brasileira atualizada
- Chat conversacional em português

## Regras de negócio críticas

### Identificação automática de pagamentos
Quando sai dinheiro da conta:
1. Sistema recebe notificação via Open Finance (Pluggy)
2. Identifica tipo (PIX, TED, boleto, débito automático)
3. Se tem CNPJ do destinatário, consulta base de fornecedores local ou Receita Federal
4. Se identifica o CNPJ, categoriza automaticamente
5. Se NÃO identifica, cria entrada "pendente" e notifica usuário
6. Usuário responde uma vez, sistema cria regra em `ai_learning_rules` e aplica automaticamente nas próximas transações similares

### Reforma Tributária 2026
A partir de janeiro de 2026 todas as notas fiscais DEVEM destacar IBS (0,1%) e CBS (0,9%). O sistema precisa desde o dia 1 suportar os novos campos no XML da NF-e, calcular corretamente os créditos de CBS/IBS, preparar relatórios de apuração e alertar sobre Split Payment.

### Multi-empresa
Um usuário pode ter empresas ilimitadas (limitado pelo plano SaaS). Cada empresa tem seus próprios dados isolados. Dashboard consolidado mostra visão geral de todas. É possível comparar performance entre empresas do mesmo tipo. IA aprende padrões específicos por empresa (não mistura regras entre empresas diferentes).

## Convenções de código

- TypeScript strict mode em todo lugar
- Commits semânticos (feat, fix, refactor, docs, test, chore)
- Testes em Vitest
- Validação com Zod
- ORM: Prisma
- UI components: shadcn/ui
- Textos em português brasileiro
- Logs de erro descritivos e em português
- Comentários no código em português quando explicam regra de negócio

## Segurança e compliance

- LGPD: criptografia de dados sensíveis em repouso
- Senhas com bcrypt (rounds maior ou igual a 12)
- JWT com expiração curta + refresh tokens
- Rate limiting em rotas críticas
- Logs de auditoria para ações financeiras
- Certificado digital A1/A3 para emissão de NF-e (quando implementado)

## Próximos passos imediatos (FASE 2.1 → FASE 3)

**FASE 2.1 — Correções de interface (em andamento):**
1. Adicionar botão "Nova Conta" no header de `/contas-bancarias` e no estado vazio
2. Adicionar botão "Nova Transação" na página global de transações
3. Adicionar try/catch nos handlers GET das APIs de contas e transações

**FASE 3 — IA Contadora para transações OFX:**
- Categorização automática via BrasilAPI (CNPJ)
- Claude API para sugerir categoria quando BrasilAPI não identifica
- Regras de aprendizado (`ai_learning_rules`)
- Tabela de fornecedores
- Dashboard com gráficos de fluxo de caixa

## Observações do owner (Yussef)

- Prefere desenvolvimento local no Windows antes de subir para nuvem
- Quer começar com as próprias empresas como laboratório antes de vender
- Cadastro de empresas será feito manualmente pelo próprio usuário na interface
- Projeto inspirado nos aprendizados do AcadOS (sistema anterior)
- Prioridade de features (ranking do Yussef):
  1. Relatórios e dashboards
  2. Conciliação bancária automática
  3. IA contadora que calcula impostos
  4. Integração Open Finance

## Links úteis

- Pluggy docs: https://docs.pluggy.ai
- Claude API docs: https://docs.claude.com
- Reforma Tributária: https://www.gov.br/fazenda/reforma-tributaria
- Layout NF-e 2026: https://www.nfe.fazenda.gov.br
- shadcn/ui: https://ui.shadcn.com
