# 🎯 CONTA-IA-NORTE.md
## Documento de VISÃO ESTRATÉGICA do Produto

> **DOCUMENTO DE VISÃO ESTRATÉGICA — Atualizado 03/05/2026**
>
> **Hierarquia de documentos:**
> - Para estado **OPERACIONAL** atual (onde estamos hoje), ver `CLAUDE.md` na raiz
> - Para visão **ESTRATÉGICA** (este documento) — porquê das decisões, roadmap 12 meses
> - Para guia **TÉCNICO** de deploy, ver `docs/DEPLOY.md`
>
> **Substitui apenas:** PRODUTO-NORTE.md + UI-CATEGORIAS-DRE.md (versões anteriores)
> **NÃO substitui:** CLAUDE.md (operacional) e DEPLOY.md (técnico)
>
> **Filosofia:** Qualidade extrema. Sem dívida técnica. Decisões fundamentadas em pesquisa.
> **Foco GEOGRÁFICO:** **BRASIL 100%** — resolver o lado financeiro brasileiro com profundidade.
> **Mira:** Sistema financeiro mais especializado do Brasil para PMEs em 5 subsetores.
> **Pesquisa de base:** 30+ buscas web profundas, fontes oficiais BR, benchmark de 15 sistemas.
> **Status:** Norte estratégico do produto pelos próximos 12 meses.

---

## 📑 ÍNDICE GERAL

### PARTE I — VISÃO ESTRATÉGICA
1. [Resumo Executivo](#1-resumo-executivo)
2. [Posicionamento Honesto](#2-posicionamento-honesto)
3. [Diferenciais Competitivos](#3-diferenciais-competitivos)
4. [Benchmark de 15 Sistemas](#4-benchmark-de-sistemas)
5. [Anti-Padrões dos Líderes](#5-anti-padrões)

### PARTE II — CONTEXTO BRASILEIRO
6. [Catálogo de Relatórios Brasileiros](#6-relatórios-brasileiros)
7. [Análise dos 3 Regimes Tributários](#7-regimes-tributários)
8. [Folha de Pagamento e eSocial](#8-folha-pagamento)
9. [Reforma Tributária 2026-2033](#9-reforma-tributária)

### PARTE III — ARQUITETURA E UX
10. [Princípios de UX 2026](#10-princípios-ux)
11. [Arquitetura Fundacional](#11-arquitetura-fundacional)
12. [Tela "Plano de Contas"](#12-tela-plano-contas)
13. [DRE Gerencial Profissional](#13-dre-gerencial)
14. [Relatórios Derivados](#14-relatórios-derivados)
15. [Centro de Custo](#15-centro-de-custo)
16. [Insight IA — Especificação Técnica](#16-insight-ia)

### PARTE IV — EXECUÇÃO
17. [Decisões Aprovadas](#17-decisões-aprovadas)
18. [Roadmap de 12 Meses](#18-roadmap)
19. [Estado Atual e Próximos Passos](#19-estado-atual)

---

# PARTE I — VISÃO ESTRATÉGICA

---

## 1. RESUMO EXECUTIVO

### 5 insights mais valiosos descobertos

#### 1. Reforma Tributária criou janela de ouro (2026-2027)

**2026 é fase de TESTES** (CBS 0,9% + IBS 0,1% só informativo). **Em 2027** o PIS/COFINS são extintos e CBS entra em vigor pleno (~8,8%).

Empresas estão aterrorizadas e procurando software que entenda. **Quem chegar primeiro com solução completa pega mercado gigante.**

Conta Azul, Omie, Nibo ainda estão **"atualizando"**. Janela aberta.

#### 2. Mercado brasileiro tem dívida técnica documentada

**Conta Azul (líder BR PMEs) opera com 2 sistemas paralelos:**
- "Plano de Categorias" (gerencial)
- "Plano de Contas" (contábil — em ferramenta separada)

Citação literal da documentação Conta Azul:
> "As configurações desta tela [categorias] se aplicam ao DRE Gerencial padrão. Para que sejam refletidas nos novos relatórios de DRE, você precisará configurá-las em outra tela."

**Diferencial Conta IA:** UMA fonte de verdade. Categoria configurada uma vez, vinculada a TODOS os relatórios.

#### 3. Mercado contábil exige regime de competência (descoberta crítica)

**Fonte oficial Conselho Federal de Contabilidade (CFC), NBC TG:**
> "Não é permitida a utilização do regime de caixa para registro dos atos e fatos contábeis."

**Implicação:** cada Transaction precisa de 2 datas:
- `competenceDate` — quando o serviço foi prestado (DRE Contábil)
- `cashDate` — quando o dinheiro entrou/saiu (DFC)

**Hoje no Conta IA:** só temos uma data (provavelmente caixa).
**Necessário:** migration adicionando `competenceDate` + backfill.

**Sem isso, contabilidade do sistema NÃO É VÁLIDA pra Lucro Real ou Presumido.**

#### 4. IA financeira alucina muito mais do que parece

**Pesquisa MIT 2025 + Vectara HHEM revelou:**
- Modelos comuns alucinam **até 13.8%** em finanças
- Modelos "reasoning" recentes (o3, o4) alucinam **33-48%** em alguns testes
- **Quando alucinam, soam MAIS confiantes** — usam 34% mais palavras como "definitivamente"
- **Caso real documentado:** robô-advisor com alucinação custou US$ 3.2 milhões em remediação

**Implicação:** não dá pra "soltar Claude analisando DRE livremente". Precisa estratégia anti-alucinação técnica (RAG + Negative Prompting + Validação).

#### 5. Recomendação automática de regime tributário é território INEXPLORADO

Nenhum software brasileiro principal calcula automaticamente "Simples vs Presumido vs Real" comparando os 3 com dados reais.

Contadores cobram **R$ 2-5 mil** pra essa análise manual. **Conta IA pode automatizar isso e virar IMBATÍVEL nesse aspecto.**

### Os 3 erros que líderes cometem (e vamos evitar)

| Erro | Quem comete | Como vamos evitar |
|---|---|---|
| Plano de contas genérico, sem profundidade por setor | Conta Azul, Omie, QuickBooks | Templates POR SUBSETOR (academia ≠ clínica ≠ salão) |
| IA como features pontuais, não cérebro central | Todos brasileiros | IA como espinha dorsal desde dia 1 |
| Folha de pagamento como módulo extra caro | Conta Azul, Omie cobram à parte | Folha SIMPLES integrada nativamente |
| DRE Gerencial e DRE Contábil tratados igual | Conta Azul, Omie | Múltiplas visões pro mesmo dado |
| 2 telas pra mesma coisa | Conta Azul | UMA fonte de verdade |
| Reportar SEM commentary IA | Todos brasileiros | DRE com "AI Insights" embutido |

### As 3 oportunidades CLARAS de diferenciação

#### Diferencial #1: "O contador que nunca dorme"
IA agentica que reconcilia, classifica, calcula impostos e ALERTA proativamente sobre oportunidades fiscais. Concorrentes só categorizam.

#### Diferencial #2: "Pronto pra Reforma Tributária 2026"
Já calcula CBS/IBS desde dia 1 com simulação de impacto. Cliente vê o futuro fiscal antes do governo cobrar.

#### Diferencial #3: "Recomendação tributária inteligente"
A cada 3 meses, sistema simula os 3 regimes com dados reais e diz: *"Você economizaria R$ X mudando pra Lucro Presumido em janeiro."*

**Isso é OURO pra dono de PME.**

---

## 2. POSICIONAMENTO HONESTO

### 2.1 Por que evitar promessas exageradas

**Realidade:**
- Conta Azul tem 600k+ usuários estimados. Conta IA tem 0.
- Promessas tipo "melhor do mundo" sem prova social = amador.
- Risco legal (Procon) com superlativos sem comprovação.

**Decisão:** posicionamento sustentável, comprovável, focado.

### 2.2 Tagline principal

> **"O contador IA que entende seu negócio."**

### 2.3 Posicionamento de mercado

> Sistema financeiro especializado em PMEs brasileiras de **5 subsetores específicos**:
> Academias · Clínicas · Salões · Restaurantes · Lojas
>
> Usa **IA pra automatizar classificação** e **calcular impostos automaticamente**.
>
> **Pronto pra Reforma Tributária 2026.**

### 2.4 Posicionamento por persona

#### Persona 1: Dono de PME (Yussef)
> "Sistema que entende sua academia/clínica/salão de verdade. Plano de contas pronto, IA classifica suas transações, mostra DRE com explicação."

#### Persona 2: Contador da PME
> "Sistema que respeita o regime de competência (NBC TG), gera DRE compatível com SPED, e automatiza classificação que sua equipe faria manualmente."

#### Persona 3: Sócio investidor
> "Veja qual filial gera caixa de verdade. Compare margens entre unidades. Decida onde investir baseado em dados, não em sensação."

### 2.5 Comparação respeitosa com concorrentes

> **Conta Azul é referência consolidada de gestão financeira para PMEs brasileiras, atendendo todos os setores.**
> **Conta IA é especializado em 5 subsetores específicos com profundidade extrema, IA generativa e preparação para Reforma Tributária 2026.**

**Por que funciona:**
- ✅ Reconhece valor do concorrente
- ✅ Define nicho específico (especialização)
- ✅ Honesto sobre escopo
- ✅ Não soa arrogante

### 2.6 Pricing proposto

| Plano | Preço/mês | Inclui |
|---|---|---|
| **Starter** | R$149 | 1 empresa, 2 contas, 500 transações, OFX manual |
| **Pro** | R$399 | 3 empresas, 10 contas, 5000 tx, IA Coach, folha simples |
| **Business** | R$999 | Empresas ilimitadas, Pluggy, Coach IA, folha completa |
| **Enterprise** | Custom | Multi-empresa, white label, integrações custom |

---

## 3. DIFERENCIAIS COMPETITIVOS

### Os 6 diferenciais sustentáveis

#### 1. Especialização por subsetor com profundidade

5 templates implementados na Etapa 2.3:
| Template | Total categorias | Específicas |
|---|---|---|
| **Academia** | 195 | 75 |
| **Restaurante** | 182 | 62 |
| **Clínica** | 173 | 53 |
| **Salão** | 166 | 46 |
| **Loja** | 172 | 52 |

Cada um cobre **particularidades reais**:
- **Academia:** royalties (franqueada), comissão personal autônomo, anuidade CREF, bolsa estagiários
- **Restaurante:** taxa iFood/Rappi, gás cozinha, SAT, embalagens delivery, dedetização
- **Clínica:** glosas convênios, anuidade CRM/CRO, materiais médicos descartáveis, coparticipação
- **Salão:** Lei 12.592 (parceiro), booth rental, comissão profissionais autônomos
- **Loja:** ICMS-ST (CFOP 1403), comissões marketplaces, frete vendas/compras

**Concorrentes BR:** templates rasos (15-30 categorias).

#### 2. Multi-regime tributário NATIVO

Categorias adaptam visibilidade conforme regime:
```
Simples Nacional Anexo III:
  ✅ ISS, DAS Simples
  ❌ PIS Cumulativo, COFINS Cumulativo, IRPJ, CSLL

Lucro Presumido:
  ✅ ISS, PIS Cumulativo (0,65%), COFINS Cumulativo (3%), IRPJ, CSLL
  ❌ DAS Simples

Lucro Real:
  ✅ ISS, PIS Não-Cumulativo (1,65%), COFINS Não-Cumulativo (7,6%), IRPJ, CSLL

TODOS regimes:
  ✅ CBS (0,9%) + IBS (0,1%) — Reforma 2026
```

**Concorrentes:** parcial ou inexistente.

#### 3. Reforma Tributária 2026 desde dia 1

CBS + IBS já no plano de contas. Calculadora pronta. Concorrentes ainda atualizando.

#### 4. UX moderna pós-2022

Padrões já consolidados em SaaS premium (Notion, Linear, Stripe) que **NENHUM líder BR oferece**:
- Drag-and-drop pra reordenar
- Edição inline (click no nome → editar)
- Atalhos teclado (Cmd+K, J/K)
- Dark mode nativo
- Command palette

#### 5. IA Coach com anti-alucinação

Estratégia técnica em 3 camadas:
- **RAG estruturado** — calcula variações ANTES, IA só EXPLICA
- **Negative prompting** — "NUNCA invente. Diga 'dados insuficientes'"
- **Validação programática** — checa se IA mencionou números fora do contexto

**Custo:** ~R$ 0,04 por insight (com cache 24h: R$ 0,50-2,00/user/mês).

#### 6. Recomendação tributária ATIVA

Sistema monitora 24/7 se regime atual é o melhor.

**Alerta proativo:**
> "Em janeiro, migrar para Presumido vai economizar R$ 18.000/ano. Quer simular?"

Detecta oportunidades de Fator R (Simples Nacional). **Nenhum SaaS brasileiro tem isso bem feito.**

---

## 4. BENCHMARK DE SISTEMAS

### 4.1 Tabela comparativa completa

| Feature | QuickBooks | Xero | Conta Azul | Omie | **Conta IA (alvo)** |
|---|---|---|---|---|---|
| **Hierarquia** | 5 níveis | Flat | 2 níveis | 2-3 níveis | **3 default, até 5 avançado** |
| **Drag-and-drop** | ❌ | Widgets só | ❌ | ❌ | **v1 reordenar mesmo nível** |
| **Edição inline** | ❌ painel | Campos | ❌ modal | ❌ modal | **Sim** |
| **Atalhos teclado** | Básicos | Básicos | ❌ | ❌ | **Cmd+K, J/K, etc** |
| **AI Insights** | Intuit AI | JAX (forte) | ❌ | Básico | **RAG + anti-alucinação** |
| **Templates BR** | ❌ | ❌ | 5 rasos | ~10 médios | **5 PROFUNDOS (166-195 cat)** |
| **Limite contas** | 250 (Plus) / ∞ (Adv $235) | Sem limite | Sem info | Sem info | **Sem limite todos planos** |
| **Multi-regime BR** | ❌ | ❌ | Parcial | Parcial | **Nativo (8 regimes)** |
| **Reforma Trib. 2026** | N/A | N/A | Atualizando | Atualizando | **Pronto** |
| **DRE com variance** | Básico | Básico | Separado | Básico | **IBCS standard** |
| **RBAC custom** | Só Advanced ($235) | Básico | 6 perfis | Sim | **Custom em todos planos** |
| **Mobile** | App limitado | Bom | Web mobile | App limitado | **PWA real** |
| **Dark mode** | ❌ | Sim | ❌ | ❌ | **Sim** |
| **Idioma BR** | EN/ES | EN | pt-BR | pt-BR | **pt-BR nativo** |

### 4.2 Análise dos líderes brasileiros

#### Conta Azul (líder PMEs Brasil — 600k+ usuários)
**Pontos fortes:**
- Liderança consolidada
- Integração contábil robusta (Domínio)
- pt-BR nativo de qualidade
- Templates por setor (5)
- RBAC com 6 perfis (Admin, Comprador, Vendedor Jr/Sr, Financeiro Jr/Sr)

**Pontos fracos:**
- Sistemas paralelos (Plano de Categorias vs Plano de Contas)
- Configuração duplicada (DRE legado vs novo)
- Hierarquia rasa (2 níveis)
- Modal pequeno pra editar
- UX padrão 2018-2020 (sem drag-drop, sem command palette)
- Sem dark mode

**Pricing:** R$ 89,90 (Básico) a R$ 249,90 (Avançado)

#### Omie (concorrente direto)
**Pontos fortes:**
- ERP completo (financeiro + estoque + vendas + produção)
- IA pra emissão de NF
- App móvel forte
- Conta digital integrada (Omie Cash)

**Pontos fracos:**
- Curva de aprendizado alta
- Pricing varia muito (R$49 a R$1499)
- DRE Gerencial menos refinado que Conta Azul
- Foco genérico, não especializado

#### Nibo (foco contadores)
**Pontos fortes:**
- Excelente pra escritórios contábeis
- Integração com vários ERPs

**Pontos fracos:**
- UI menos amigável pra dono
- Menos features pra empreendedor

#### Bling (foco e-commerce)
**Pontos fortes:**
- Imbatível em e-commerce
- Integração marketplaces
- Frente de caixa (PDV)

**Pontos fracos:**
- Financeiro mais básico
- DRE limitado

### 4.3 Análise dos líderes globais

#### QuickBooks Online (líder mundial — 7M usuários)
**Pontos fortes:**
- Templates por indústria (31 disponíveis no mercado US)
- "Detail Type" para sub-classificação fiscal
- Marketplace de 14.000+ apps
- Hierarquia de 5 níveis
- 62% market share US

**Pontos fracos:**
- "Hierarchical View" reseta sozinho ao buscar (reclamação documentada)
- Sem drag-and-drop
- Pricing predatório (250 contas no plano $99, ilimitado só $235)
- Não atende compliance BR
- Curva de aprendizado maior

**Limites confirmados (Out/2019):**
| Plano | Preço (US) | Usuários | Plano de contas |
|---|---|---|---|
| Simple Start | $35/mês | 1 | 250 max |
| Essentials | $65/mês | 3 | 250 max |
| Plus | $99/mês | 5 | 250 max |
| Advanced | $235/mês | 25 | **Ilimitado** |

#### Xero (4.4M usuários, AI-first 2026)
**Pontos fortes:**
- Dashboard com drag-and-drop de widgets (homepage 2026)
- AI integrado no fluxo (JAX assistant — 61% adoção)
- UX limpa
- Multi-currency
- Usuários ilimitados em todos os planos

**Pontos fracos:**
- Plano de contas SEM hierarquia profunda (flat com códigos)
- Folha sempre é addon
- Não atende BR

### 4.4 Inspirações de UX premium (não-financeiras)

- ✅ **Notion** — hierarquia, edição inline, command palette
- ✅ **Linear** — atalhos teclado, performance, command-K
- ✅ **Superhuman** — atalhos teclado obsessivos
- ✅ **Cron Calendar** (Notion Calendar) — tipografia, espaçamento

### 4.5 Inspirações de DRE/relatórios profissionais

- ✅ **Power BI + Zebra BI** — referência ouro (IBCS standard)
- ✅ **Bold BI** — KPI scorecards, trend lines
- ✅ **Qlik Sense** — dashboards corporativos
- ✅ **Tableau Accelerators** — templates por uso

### 4.6 IBCS Standard (descoberta importante)

**International Business Communication Standards** — padrão alemão pra apresentação visual de demonstrações financeiras.

**Princípios chave:**
1. **Notação semântica:**
   - Linhas sólidas = dados reais
   - Linhas tracejadas = orçado/forecast
   - Linhas pontilhadas = ano anterior
2. **Cores semânticas:**
   - Verde = positivo
   - Vermelho = negativo
   - Cinza = neutro/anterior
3. **Símbolos:**
   - △ positivo (acima do plano)
   - ▽ negativo (abaixo do plano)
4. **Legibilidade extrema** (sem ruído visual)

**Aplicação Conta IA:** Adotar IBCS no DRE Gerencial. Diferencial: "primeiro SaaS BR com IBCS".

### 4.7 Tendências 2026

1. **AI-first.** QuickBooks e Xero estão fazendo IA o core do produto, não feature.
2. **AI agents autônomos.** Sistemas que executam tarefas multi-passo sem supervisão.
3. **Real-time forecasting.** Previsão de fluxo de caixa, anomalias.
4. **Commentary writers.** IA gera análise textual dos relatórios.
5. **OCR + IA.** Lê nota fiscal foto, classifica, gera lançamento.
6. **Conversational accounting.** Chat: "quanto gastei com aluguel em outubro?"

### 4.8 Mercado de IA contábil

**Mercado global IA contábil:** US$ 10,87 bi em 2026, CAGR 44,6% (SMB).

**Onde IA já é commodity:**
- ✅ Categorização automática
- ✅ Reconciliação bancária
- ✅ OCR de notas fiscais
- ✅ Detecção de anomalias

**Fronteira atual (poucos têm bem):**
- 🟡 IA agentica (multi-passo autônoma)
- 🟡 Forecasting com explicação
- 🟡 Análise textual automatizada de relatórios
- 🟡 Recomendação tributária

**Não-explorado (oportunidade!):**
- ❌ Coach financeiro conversacional pra dono
- ❌ Simulação de cenários "what if"
- ❌ Análise comparativa setorial automática
- ❌ Detecção de padrões de inadimplência por cliente

---

## 5. ANTI-PADRÕES

### 🚫 Erros documentados de líderes (NÃO fazer)

#### 1. Toggle "Hierarchical/Flat" que reseta sozinho (QuickBooks)
**Solução nossa:** hierarquia sempre, filtros não quebram árvore.

#### 2. Duas telas pra "mesma coisa" (Conta Azul)
**Solução:** UMA fonte de verdade.

#### 3. Modal pequeno pra editar (Conta Azul, Omie)
**Solução:** painel lateral 60% ou edição inline.

#### 4. Categoria órfã (sem cor/ícone/descrição)
**Solução:** cor sugerida pelo DRE Group + ícone auto-detectado pelo nome.

#### 5. Pesquisa que quebra hierarquia (QuickBooks)
**Solução:** search mostra path completo + permite filtro por nível.

#### 6. Não poder DELETAR (só inativar) (QuickBooks, Conta Azul)
**Solução:** pode deletar SE não tem uso. Senão soft-delete.

#### 7. Dropdown gigante de "Categoria pai" (Conta Azul)
**Solução:** drag-and-drop OU "criar como sub" 1 click.

#### 8. Ordenação manual via input numérico (Conta Azul, Omie)
**Solução:** drag-and-drop visual + ordem alfabética automática como fallback.

#### 9. Sem indicação visual de "categoria não usada" (Conta Azul)
**Solução:** badge cinza "0 transações" + opção "ocultar não usadas".

#### 10. Categorias de imposto sempre visíveis (genéricos)
**Solução:** visibilidade por regime tributário.

### Reclamações reais documentadas (G2/Capterra)

**Conta Azul:**
- "Tudo é add-on caro"
- "Suporte demora"
- "DRE poderia ser mais customizável"

**Omie:**
- "Curva de aprendizado alta"
- "Implantação cara"
- "Funcionalidades demais pra quem precisa do básico"

**Universal:**
- "Não me ajuda a tomar decisão, só registra dados"
- "Não explica o que tá acontecendo"
- "Quero alguém que me diga o que fazer"

---

# PARTE II — CONTEXTO BRASILEIRO

---

## 6. RELATÓRIOS BRASILEIROS

### 6.1 Relatórios LEGAIS OBRIGATÓRIOS

**Fonte:** Lei 6.404/76, Resolução CFC nº 1.185/2009, Deliberação CVM 676/2011

**Para empresas de médio/grande porte e S/A:**

| Relatório | Sigla | Obrigatório pra | O que mostra |
|---|---|---|---|
| Balanço Patrimonial | BP | TODAS | Foto do patrimônio numa data |
| DRE | DRE | TODAS | Lucro/Prejuízo do período (regime competência) |
| DMPL | DMPL | S/A e LTDAs grandes | Movimentações no PL |
| DLPA | DLPA | Pode ser substituído pela DMPL | Destinação do lucro |
| DFC | DFC | PL ≥ R$ 2 milhões | Entradas/saídas reais (caixa) |
| DVA | DVA | Companhias abertas | Riqueza gerada e distribuída |
| DRA | DRA | Junto com DRE | Outros resultados não realizados |
| Notas Explicativas | NE | TODAS | Detalhamento das demonstrações |

**Para empresas Simples Nacional / pequenas:**
- Não há obrigatoriedade de publicação
- Mas o **contador** entrega obrigatoriamente:
  - **ECD** (Escrituração Contábil Digital) — anual
  - **ECF** (Escrituração Contábil Fiscal) — anual
  - **DEFIS** (Declaração de Informações Socioeconômicas e Fiscais) — anual

### 6.2 Relatórios GERENCIAIS (que dono PME REALMENTE usa)

#### 6.2.1 DRE Gerencial

**Diferente da DRE Contábil:**
- DRE Contábil = competência, segue Lei 6.404
- **DRE Gerencial** = customizada por categoria, foca em decisão

**Estrutura padrão BR:**
```
Receita Bruta
(–) Deduções (impostos sobre venda + devoluções + descontos)
= Receita Líquida
(–) CMV/CSV (custo de produto/serviço vendido)
= Lucro Bruto
(–) Despesas Operacionais
    Despesas Comerciais (vendas, marketing)
    Despesas Administrativas (estrutura)
    Despesas com Pessoal (folha)
= EBITDA
(–) Depreciação e Amortização
= EBIT (Resultado Operacional)
(+/–) Resultado Financeiro
    Receitas Financeiras (rendimentos, juros recebidos)
    (–) Despesas Financeiras (juros pagos, IOF, tarifas)
= Resultado Antes do IR
(–) IRPJ + CSLL
= Lucro Líquido
```

**Filtros e visões necessários:**
- Por período (mês, trimestre, ano, customizado)
- Por centro de custo (filial)
- Análise vertical (% sobre receita)
- Análise horizontal (variação mês a mês)
- Comparativo orçado vs realizado
- Drill-down (clicar em "Aluguel" abre todas as transações)

#### 6.2.2 Fluxo de Caixa Realizado e Projetado

**Realizado (regime caixa):**
- Por categoria, mês a mês
- Saldo inicial → entradas → saídas → saldo final
- Detalhamento por banco

**Projetado:**
- Próximos 30/60/90 dias
- Baseado em recorrências detectadas + contas a pagar/receber
- Saldo diário projetado
- Alerta vermelho se saldo vai ficar negativo

#### 6.2.3 Conciliação Bancária

- Tela split: extrato do banco vs lançamentos do sistema
- Auto-match por data + valor (sugerido em verde)
- Pendentes em amarelo
- Conflitos em vermelho

#### 6.2.4 Centro de Custo (CRÍTICO PRO YUSSEF)

Pra grupo com múltiplas filiais (13 academias):
- DRE por unidade/filial
- Comparativo entre unidades (ranking de rentabilidade)
- Margem operacional por filial
- Identificação de unidade deficitária

#### 6.2.5 Aging de Contas a Pagar e Receber

**5 faixas padrão BR:**
| Faixa | Significado | Recuperação esperada |
|---|---|---|
| **A vencer** | Ainda dentro do prazo | — |
| **Vencido 1-30 dias** | Atraso recente | >80% |
| **Vencido 31-60 dias** | Atraso preocupante | 50-70% |
| **Vencido 61-90 dias** | Atraso crítico | 25-50% |
| **Vencido +90 dias** | Inadimplência consolidada | <25% |

**Aging saudável:** concentra >85% na faixa "a vencer". Se >5% acima de 90 dias = sinal de problema.

#### 6.2.6 Análise de Inadimplência

- Por cliente
- Tempo médio de atraso
- % de inadimplência sobre faturamento

### 6.3 KPIs Financeiros essenciais

| KPI | Fórmula | O que diz |
|---|---|---|
| Margem Bruta | (Receita Líquida – CMV) / Receita Líquida | Quanto sobra após custos diretos |
| Margem Operacional | EBIT / Receita Líquida | Eficiência operacional |
| Margem Líquida | Lucro Líquido / Receita Líquida | Lucratividade total |
| EBITDA | Receita – Custos – Despesas Op (sem depreciação) | Geração de caixa operacional |
| ROI | Lucro Líquido / Investimento | Retorno sobre investimento |
| Ponto de Equilíbrio | Custos Fixos / Margem de Contribuição | Quanto vender pra empatar |
| Liquidez Corrente | Ativo Circulante / Passivo Circulante | Capacidade de pagar curto prazo |
| Endividamento | Passivo / Ativo Total | % do que devo |
| **Burn Rate** | Despesas Fixas Mensais | Quanto gasto por mês fixo |
| **Runway** | Caixa Atual / Burn Rate | Quantos meses de sobrevivência |
| **DSO** | (Recebíveis / Receita) × 30 | Prazo médio de recebimento |
| **PMR** | Recebimentos médios | Prazo médio em dias |
| **PMP** | Pagamentos médios | Prazo médio em dias |
| **Ciclo Financeiro** | PMR - PMP | Dias que financia o cliente |

### 6.4 Relatórios diferenciais do Conta IA

- **Apuração de impostos automática** (DAS, DARF, ISS) com cálculo no momento
- **Simulação de regimes tributários** (Simples vs Presumido vs Real)
- **Apuração da Reforma Tributária** (CBS + IBS) automática
- **Análise de saúde financeira** com IA explicando variações em linguagem natural
- **Alertas proativos** ("você gastou 3x mais com energia esse mês — investigar")

---

## 7. REGIMES TRIBUTÁRIOS

> **Fontes oficiais:** Receita Federal, LC 123/2006, LC 224/2025, gov.br/fazenda

### 7.1 SIMPLES NACIONAL

**Quem pode:**
- Faturamento até **R$ 4,8 milhões/ano** (ME e EPP)
- MEI: até R$ 169.440/ano
- CNAEs permitidos (lista no art. 17 da LC 123/2006)

**Como funciona:**
- Unifica até **8 tributos numa única guia (DAS)**: IRPJ, CSLL, PIS, COFINS, IPI, ICMS, ISS, CPP
- 5 anexos por tipo de atividade
- Alíquota efetiva = `(RBT12 × Alíq Nominal – Parcela Deduzir) / RBT12`

#### Anexo III — Serviços (incluindo ACADEMIAS — caso do Yussef)

| Faixa | Receita 12m | Alíq Nominal | Parcela Deduzir |
|---|---|---|---|
| 1ª | até R$ 180.000 | **6,00%** | 0 |
| 2ª | até 360.000 | 11,20% | R$ 9.360 |
| 3ª | até 720.000 | 13,50% | R$ 17.640 |
| 4ª | até 1.800.000 | 16,00% | R$ 35.640 |
| 5ª | até 3.600.000 | 21,00% | R$ 125.640 |
| 6ª | até 4.800.000 | 33,00% | R$ 648.000 |

#### Fator R (CRÍTICO)

- Calcular: `Folha 12m / Receita 12m`
- Se ≥ 28% → empresa migra do **Anexo V para Anexo III** (alíquota MUITO menor)
- Se < 28% → fica no Anexo V
- **Academias quase sempre operam com Fator R favorável** (folha alta de instrutores)

**Exemplo prático (academia do Yussef):**
- Faturamento 12m: R$ 1.500.000
- Anexo III, 4ª faixa
- Alíquota efetiva: `(1.500.000 × 16% – 35.640) / 1.500.000` = **13,62%**
- Em receita mensal de R$ 125.000 → DAS = **R$ 17.025/mês**

### 7.2 LUCRO PRESUMIDO

**Quem pode:**
- Faturamento anual até **R$ 78 milhões**

**Tributos federais:**
| Tributo | Alíquota | Base |
|---|---|---|
| IRPJ | 15% | Lucro presumido (% sobre faturamento) |
| Adicional IRPJ | 10% | Sobre parcela > R$ 60k/trimestre |
| CSLL | 9% | Lucro presumido |
| PIS (cumulativo) | 0,65% | Faturamento bruto |
| COFINS (cumulativo) | 3% | Faturamento bruto |

**Bases de cálculo do IRPJ/CSLL:**
| Atividade | IRPJ | CSLL |
|---|---|---|
| Comércio | 8% | 12% |
| Serviços em geral | 32% | 32% |
| Serviços hospitalares | 8% | 12% |

**ALERTA REFORMA 2026 (LC 224/2025):**
- Faturamento > R$ 1.250.000/trimestre → presunção sobe 10%
- Ex.: serviços que era 32% → vira 35,2% na parcela excedente

### 7.3 LUCRO REAL

**Quem é OBRIGADO:**
- Faturamento > R$ 78 milhões/ano
- Bancos, seguradoras
- Empresas com lucros do exterior

**Como funciona:**
- Tributa o **lucro líquido contábil EFETIVO**
- IRPJ: 15% + adicional 10% sobre excedente R$60k/trimestre
- CSLL: 9% (com exceções pra setores)
- PIS: 1,65% **não-cumulativo** (créditos sobre insumos)
- COFINS: 7,6% **não-cumulativo**

**Apuração:**
- Trimestral ou Anual com estimativa mensal
- Possibilidade de **compensar prejuízos** futuros

**Quando vale a pena:**
- Margem real < margem presumida
- Muitas despesas dedutíveis
- Volume alto de insumos (créditos PIS/COFINS)
- Indústria, varejo de baixa margem

### 7.4 RECOMENDAÇÃO AUTOMÁTICA — DIFERENCIAL DO CONTA IA

**Algoritmo proposto:**
```
Input do sistema (já tem):
- Faturamento dos últimos 12 meses (Conta IA já sabe)
- Categorização de despesas (IA classifica)
- Folha de pagamento (do módulo folha)
- Atividade principal (CNAE da empresa)

Output:
- DAS (Simples) calculado: R$ X
- IRPJ+CSLL+PIS+COFINS (Presumido): R$ Y
- IRPJ+CSLL+PIS+COFINS (Real): R$ Z
- Recomendação: "Migre para Presumido em janeiro próximo. Economia: R$ 18.000/ano"
- Justificativa em linguagem leiga
- Alerta de compliance (Reforma Tributária)
```

**Isso é OURO.** Nenhum SaaS brasileiro grande oferece isso bem. Contadores cobram R$ 2-5k pra essa análise manual.

### 7.5 Regime Competência vs Caixa (decisão arquitetural crítica)

**Fonte oficial CFC, NBC TG:**
> "Não é permitida a utilização do regime de caixa para registro dos atos e fatos contábeis."

#### Regime de Competência
- Receita registrada **quando o serviço é prestado**
- Despesa registrada **quando o evento acontece**
- **Base do DRE Contábil**
- **Obrigatório** pra Lucro Real e Lucro Presumido

#### Regime de Caixa
- Receita registrada **quando o dinheiro entra**
- Despesa registrada **quando o dinheiro sai**
- **Base do DFC (Fluxo de Caixa)**
- **Permitido** pra cálculo de impostos no Simples e Presumido

#### Implicação prática

**Cada Transaction precisa ter 2 datas:**
```typescript
{
  competenceDate: DateTime    // Quando o serviço foi prestado
  cashDate: DateTime?          // Quando dinheiro entrou/saiu
  paymentStatus: "PENDING" | "PAID" | "OVERDUE" | ...
}
```

**Exemplo:**
- Mensalidade vendida em Janeiro, recebida em Março
- **Competência:** receita aparece em Janeiro
- **Caixa:** receita aparece em Março

**Sem isso, contabilidade do sistema NÃO É VÁLIDA pra Lucro Real ou Presumido.**

---

## 8. FOLHA DE PAGAMENTO

### 8.1 Encargos sobre folha (2026)

**Sobre o trabalhador (descontos):**
| Tributo | Alíquota | Base |
|---|---|---|
| INSS | 7,5% / 9% / 12% / 14% (progressivo) | Salário bruto |
| IRRF | 0% até R$ 5.000 (NOVA isenção 2026!) | Salário base IRRF |

**Sobre o empregador (custo):**
| Encargo | Alíquota | Sobre |
|---|---|---|
| INSS Patronal | 20% | Folha total (NÃO Simples I-III) |
| FGTS | 8% | Salário bruto + 13º + férias |
| RAT (Risco Acidente) | 1%, 2% ou 3% | Folha (varia por atividade) |
| Terceiros (Sistema S) | ~5,8% | Folha (SENAI, SESC, etc) |
| Multa rescisória FGTS | 40% | FGTS depositado |

**Total típico de encargos (não-Simples):** ~70-80% do salário bruto.

**Para Simples Nacional (Anexos I, II, III):**
- INSS Patronal substituído pelo CPP dentro do DAS
- Encargo efetivo cai pra ~30-40% do salário

### 8.2 Provisões obrigatórias

**13º salário:** 1/12 do salário (~8,33%) + encargos sobre 13º

**Férias:** 1/12 + 1/3 (~11,11%) + encargos sobre férias

**Total provisões:** ~20% adicional sobre o salário.

### 8.3 Tabela INSS 2026

| Salário | Alíquota |
|---|---|
| até R$ 1.518 | 7,5% |
| R$ 1.518,01 – 2.793,88 | 9% |
| R$ 2.793,89 – 4.190,83 | 12% |
| R$ 4.190,84 – 8.157,41 | 14% |

**Salário mínimo 2026:** R$ 1.621,00

### 8.4 Tipos de vínculo

| Tipo | Quem | Encargos |
|---|---|---|
| **CLT** | Empregado registrado | Pesados (INSS+FGTS+13º+férias+rescisão) |
| **Pró-labore** | Sócio | Só INSS (descontado do sócio) |
| **Autônomo (RPA)** | Prestador eventual | INSS + ISS retido |
| **MEI** | Prestador formalizado | Apenas DAS-MEI mensal (R$ 75ish) |
| **PJ (terceirizado)** | Empresa contratada | Apenas valor da NF |
| **Estagiário** | Lei 11.788/2008 | Sem encargos trabalhistas, só bolsa-auxílio |

### 8.5 eSocial 2026

**Empresas com 2+ funcionários:** OBRIGATÓRIO certificado digital + envio de eventos.

**Eventos principais (40+ no total):**
- S-1000: Cadastro empregador
- S-2200: Admissão
- S-2299: Desligamento
- S-1200: Remunerações mensais
- S-1210: Pagamentos

**Multa por não registrar funcionário:** R$ 3.000/empregado.

**Mudanças importantes 2026:**
- Fim da DIRF — substituída por eventos do eSocial
- NR-1 com riscos psicossociais (saúde mental no trabalho)
- FGTS Digital reformulado

### 8.6 Módulo de Folha no Conta IA — Proposta

**Versão simples (NÃO substitui sistema de folha completo):**
- Cadastro de funcionário (nome, CPF, salário, data admissão, vínculo)
- Cálculo automático INSS + IRRF + FGTS por mês
- Provisão automática 13º e férias
- Geração da DARF de contribuições previdenciárias
- Integração com transações (lançamento automático em "Salários")

**NÃO faz:** holerite, eSocial completo, rescisões — pra isso, integração com Pontomais/Convenia/Tangerino.

**Diferencial:** Cliente vê impacto da folha no DRE em tempo real, sem mexer em outro sistema.

---

## 9. REFORMA TRIBUTÁRIA

> **Fonte:** Receita Federal, LC 214/2025, EC 132/2023, gov.br/fazenda

### 9.1 Cronograma oficial

| Ano | Status | O que acontece |
|---|---|---|
| **2026** | **TESTE** | CBS 0,9% + IBS 0,1% destaque informativo. SEM cobrança real. |
| **2027** | CBS pleno | PIS/COFINS extintos. CBS entra em vigor (~8,8%). IPI zerado (exceto Zona Franca). |
| 2028 | IBS começa | Em algumas operações pilotos |
| 2029-2032 | Transição IBS | ICMS/ISS reduzem progressivamente, IBS aumenta |
| **2033** | **Sistema definitivo** | Apenas CBS + IBS + Imposto Seletivo |

### 9.2 Obrigações em 2026 (já valendo)

**Desde Jan/2026:**
- ✅ Emitir NF-e com **destaque** de CBS (0,9%) e IBS (0,1%)
- ✅ Sem recolhimento (só informativo)
- ✅ Documentos novos: NF-e, NFS-e, NFC-e, CT-e, MDF-e, BP-e

**Desde Ago/2026:**
- ✅ Obrigatoriedade de preencher campos CBS pros não-Simples

**Empresas Simples:**
- Em 2026: SEM mudanças (continua só DAS)
- Em 2027: passa a destacar CBS+IBS no DAS

### 9.3 Split Payment

A partir de 2027, o **imposto será recolhido no momento da liquidação da venda** (não mais na guia mensal).

**Impacto:**
- Empresas perdem capital de giro do imposto
- Precisam de software que calcula imposto na hora da venda
- Sistemas que NÃO se adaptarem vão perder clientes em massa

### 9.4 Como Conta IA pode ser DIFERENCIAL

1. **Calculadora CBS/IBS desde dia 1** com simulação de impacto
2. **Alerta automático** quando NF-e tá com destaque incorreto
3. **Comparativo "carga atual vs carga 2027"** pra mostrar pro dono
4. **Preparação automática** pra Split Payment quando começar
5. **Treinamento integrado** (vídeos curtos explicando mudanças)

**Mercado tá perdido com a Reforma. Quem entregar clareza vence.**

---

# PARTE III — ARQUITETURA E UX

---

## 10. PRINCÍPIOS UX

### 10.1 Princípios não-negociáveis

#### A. Densidade balanceada
- Mostrar info útil sem poluir
- Progressive disclosure (info avançada sob demanda)
- Espaçamentos consistentes (Tailwind 8/12/16/24px)

#### B. Performance percebida
- Skeleton loaders em vez de spinners
- Optimistic updates
- Animações sutis (200-300ms, ease-out)

#### C. Acessibilidade real
- Navegação 100% por teclado
- ARIA labels em tudo
- Contraste mínimo AA (preferencial AAA)
- Focus visible claro

#### D. Feedback constante
- Cada ação tem confirmação visual
- Toast verde (sucesso), vermelho (erro), azul (info)
- Loading states quando demora >500ms

#### E. Erros amigáveis
- Mensagens em português, claras
- Sugestão de ação ("Tente novamente")
- Não usar termos técnicos (404, 500)

#### F. Mobile-first sério
- Funciona perfeito em 360px
- Toques 44x44px mínimo
- Drag-and-drop com long-press no mobile

#### G. Dark mode nativo (não filtro)
- Cores ajustadas, não invertidas
- Sombras viram glow sutis

### 10.2 Design System

#### Cores DRE Group (sistema único)
```
RECEITA_BRUTA       → emerald-500 (#10b981)
RECEITAS_FINANCEIRAS → emerald-300 (#86efac)
OUTRAS_RECEITAS     → emerald-200 (#bbf7d0)

DEDUCOES            → red-500 (#ef4444)
CUSTO_PRODUTO_VEND  → orange-500 (#f97316)

DESPESAS_PESSOAL    → blue-500 (#3b82f6)
DESPESAS_OPER/ADM   → orange-300 (#fdba74)
DESPESAS_COMERCIAIS → orange-400 (#fb923c)
DESPESAS_FINANC     → red-600 (#dc2626)

IMPOSTOS_LUCRO      → purple-700 (#7c3aed)
DISTRIBUICAO_LUCROS → amber-500 (#f59e0b)
INVESTIMENTOS       → purple-400 (#c084fc)
TRANSFERENCIA       → slate-400 (#94a3b8)
```

#### Tipografia
```
Fonte: Inter (já no shadcn/ui)

text-xs    12px — labels, badges
text-sm    14px — secondary
text-base  16px — body
text-lg    18px — subtítulos
text-xl    20px — títulos seção
text-2xl   24px — títulos página
text-3xl   30px — números KPI
text-4xl   36px — hero numbers

Pesos: 400 / 500 / 600 / 700
```

#### Espaçamentos (sistema 4px)
```
gap-1   4px
gap-2   8px
gap-3   12px
gap-4   16px (padrão)
gap-6   24px
gap-8   32px (entre seções)
gap-12  48px (entre blocos grandes)
```

#### Raios de borda
```
rounded-sm  2px  — chips
rounded     4px  — inputs
rounded-md  6px  — botões
rounded-lg  8px  — cards (padrão)
rounded-xl  12px — cards principais
rounded-2xl 16px — modais
```

### 10.3 Componentes (shadcn/ui base)

**Já temos:** Card, Button, Input, Select, Dialog, Sheet, Table, Tabs, Toast, Avatar, Badge, DropdownMenu, Skeleton, Tooltip, Label

**Vamos precisar adicionar:**
- Tree View (custom)
- Drag-and-Drop (`@dnd-kit/react` + `dnd-kit-sortable-tree`)
- Command Palette (cmdk)
- Combobox (autocomplete)
- ContextMenu
- Resizable panels
- Hover Card

---

## 11. ARQUITETURA FUNDACIONAL

### 11.1 Schema atual (já implementado)

**Etapas concluídas:**
- ✅ Etapa 2.1 (Schema IA: Suppliers, AiLearningRule)
- ✅ Etapa 2.3 (5 templates por subsetor)
- ✅ Etapa 2.4 (backfill empresas existentes)

**Schema Category atual:**
```prisma
model Category {
  id              String   @id @default(cuid())
  companyId       String
  parentId        String?  // hierarquia
  name            String
  type            String   // INCOME | EXPENSE | TRANSFER
  dreGroup        String   // RECEITA_BRUTA, DEDUCOES, etc
  spedCode        String?
  description     String?
  color           String   @default("#10b981")
  icon            String   @default("circle")
  displayOrder    Int      @default(0)
  visibleInRegimes String?  // JSON array
  isActive        Boolean  @default(true)
  isSystemDefault Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 11.2 Schemas necessários (novas migrations)

#### A. RBAC (Role + UserCompanyRole)

```prisma
model Role {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  description String?
  isSystemDefault Boolean @default(false)
  permissions String   // JSON array
  // ...
}

model UserCompanyRole {
  id            String   @id
  userId        String
  companyId     String
  roleId        String
  scope         String?  // "centro_custo:CC001"
  validUntil    DateTime?  // acesso temporário
  // ...
}
```

**6 Roles padrão:**
| Role | Pode ler | Pode editar | Cria usuário | Vê estratégico |
|---|---|---|---|---|
| Owner | Tudo | Tudo | Sim | Sim |
| Admin | Tudo | Tudo (exceto Owner) | Sim | Sim |
| Contador | Tudo | Plano contas, transações | Não | Sim |
| Financeiro Pleno | Operacional + relatórios | Transações, cobranças | Não | Sim |
| Financeiro Operacional | Operacional | Classifica transações | Não | Não |
| Visualizador | Leitura | Nada | Não | Não |

**Diferencial Conta IA:** Custom Roles em **TODOS os planos** (vs QuickBooks que só permite no plano $235).

**Acesso temporário:** `validUntil` permite contador externo, auditor por X dias.

#### B. Audit Log Universal

```prisma
model AuditLog {
  id          String   @id
  userId      String?
  userEmail   String   // snapshot
  timestamp   DateTime @default(now())
  action      String   // create | update | delete | login | export
  entity      String   // Category | Transaction | Company | etc
  entityId    String
  companyId   String?
  ipAddress   String?
  userAgent   String?
  changes     String?  // JSON: { campo: { before, after } }
  metadata    String?
}
```

**O que vai gerar audit log:**
- Login/logout
- Criar/editar/deletar categoria
- Importar OFX
- Aplicar template
- Mudança de role
- Export de relatório
- Visualização de DRE consolidado

**Retenção:**
- Logs auditoria: 5 anos (Receita Federal)
- Logs acesso: 6 meses
- Logs view: 2 anos

**LGPD:** se user pede exclusão, logs são **anonimizados** (não deletados). userId → null, userEmail → "user_excluido_2026-05-03".

#### C. Regime Competência (campo competenceDate)

```prisma
model Transaction {
  // ... campos existentes ...
  competenceDate DateTime  // NOVO — data do fato gerador
  cashDate       DateTime? // (atual `date` renomeado)
  paymentStatus  String    // PENDING | PAID | OVERDUE | etc
}
```

**Migration necessária + backfill:**
- `competenceDate` default = `date` atual (data extrato)
- User pode editar manualmente
- IA pode sugerir baseado em descrição ("PARC 2/3" → competência diferente)

#### D. Centro de Custo

```prisma
model CostCenter {
  id          String   @id
  companyId   String
  parentId    String?
  name        String   // "Academia Centro", "Academia Sul"
  code        String?  // "C01", "S02"
  type        String   // PRODUCTIVE | ADMINISTRATIVE
  description String?
  isActive    Boolean  @default(true)
}

model Transaction {
  // ...
  costCenterId String?  // FK opcional
}
```

#### E. Orçamento (Budget + BudgetItem)

```prisma
model Budget {
  id          String   @id
  companyId   String
  year        Int
  name        String   // "Orçamento 2026"
  type        String   // ANNUAL | QUARTERLY | MONTHLY
  status      String   // DRAFT | APPROVED | ARCHIVED
  approvedBy  String?
  approvedAt  DateTime?
}

model BudgetItem {
  id          String   @id
  budgetId    String
  categoryId  String
  year        Int
  month       Int      // 1-12
  budgetAmount Decimal @db.Decimal(15, 2)
  notes       String?
}
```

#### F. AR/AP (Accounts Receivable/Payable)

```prisma
model AccountReceivable {
  id           String   @id
  companyId    String
  customerName String
  description  String
  amount       Decimal  @db.Decimal(15, 2)
  issueDate    DateTime
  dueDate      DateTime
  paidDate     DateTime?
  status       String   // PENDING | PAID | OVERDUE | etc
  transactionId String?
  categoryId    String?
  invoiceNumber String?
}

model AccountPayable {
  // schema espelhado
}
```

### 11.3 Total: 7 migrations propostas

1. ✅ `add_competence_date` — competenceDate em Transaction
2. ✅ `add_rbac` — Roles + UserCompanyRole
3. ✅ `add_audit_log` — AuditLog
4. ✅ `add_budgets` — Budget + BudgetItem
5. ✅ `add_ar_ap` — AccountReceivable + AccountPayable
6. ✅ `add_cost_centers` — expandir o existente
7. ✅ `add_category_visibility` — visibleInRegimes (já existe parcial, validar)

### 11.4 Princípio chave de segurança

```
Actor (user + tenant context) → Action → Resource (tenant-scoped)
```

**Toda autorização é tenant-aware.** Não checa só `user.id`. Sempre `user.id + companyId + permission`.

```typescript
// Middleware em CADA endpoint protegido
async function authorize(
  user: AuthenticatedUser,
  permission: string,
  resource: { companyId: string }
): Promise<boolean> {
  const userCompany = await prisma.userCompanyRole.findFirst({
    where: { userId: user.id, companyId: resource.companyId }
  })
  if (!userCompany) return false  // tenant isolation

  const role = await prisma.role.findUnique({ where: { id: userCompany.roleId }})
  const permissions = JSON.parse(role.permissions)
  if (!permissions.includes(permission)) return false

  if (userCompany.validUntil && userCompany.validUntil < new Date()) return false

  return true
}
```

---

## 12. TELA PLANO DE CONTAS

### 12.1 Layout geral

**Header:**
- Título: "Plano de Contas — {Nome empresa}"
- Subtítulo: "{X} categorias · {Setor} · {Regime tributário}"
- Botão direito: ⚙ Configurar

**Toolbar:**
- 🔵 [+ Nova Categoria] (primário, atalho `N`)
- ⚪ [📥 Importar] [📤 Exportar] [↺ Restaurar Padrão]

**Filtros:**
- Busca: `[🔍 Buscar... ]` debounce 200ms, Cmd+K abre command palette
- `[Tipo ▼] [DRE Group ▼] [Status ▼] [Uso ▼]`

**Layout split horizontal (40/60):**

#### Coluna esquerda (40%) — ÁRVORE
- Hierarquia com ícones chevron (▶/▼)
- Indentação 16px por nível
- Cor da bolinha = DRE Group
- Contador de transações `(12)` em cinza
- Drag handle no hover (4 pontos)

**Estados visuais:**
- Hover: `bg-slate-100/50`
- Selected: `bg-indigo-50` + borda esquerda 3px indigo
- Inativa: opacity 50% + ícone "olho fechado"
- Sem uso: contador cinza + tooltip "Nunca usada"

**Drag-and-drop (v1 pragmático):**
- ✅ Reordenar dentro do mesmo nível
- ❌ Mover entre níveis (usar botão "Mover para...")
- v1.5 adiciona drag entre níveis com validação de ciclo

**Biblioteca:** `@dnd-kit/react` + `dnd-kit-sortable-tree`

#### Coluna direita (60%) — DETALHES

**Estados:**
1. Vazio: ilustração + "Selecione uma categoria"
2. Edição: campos pré-preenchidos
3. Criação: campos vazios

**Form fields:**
- Nome (text, max 80)
- Código contábil (input + 🪄 "Gerar automático" baseado em DRE Group)
- Tipo (radio: Receita | Despesa | Transferência)
- Hierarquia (combobox "É subcategoria de...")
- DRE Group (select com chips coloridos + tooltip ⓘ "Onde aparece?")
- Cor (paleta 12 cores curadas + custom)
- Ícone (lucide-react picker com search)
- Descrição (textarea max 200)
- Status (toggle Ativa/Inativa)

**Box "Visibilidade por regime":**
- Multiselect com 8 regimes
- Default: todos selecionados

**Box "Estatísticas" (read-only):**
- X transações vinculadas
- R$ Y movimentados (12 meses)
- Última usada: data
- Mini sparkline

**Footer:**
- 🔵 [💾 Salvar] (Cmd+Enter)
- ⚪ [🗑 Desativar]
- ⚪ [Cancelar]

### 12.2 Atalhos de teclado (POWER MODE)

```
N           → Nova categoria
Esc         → Fechar painel
Cmd+K       → Command palette
Cmd+Enter   → Salvar
J / ↓       → Próxima categoria
K / ↑       → Anterior
Enter       → Editar selecionada
Space       → Expand/collapse
Cmd+D       → Duplicar
Delete      → Desativar
Cmd+/       → Ver todos atalhos
```

### 12.3 Hierarquia flexível

- **Schema permite até 5 níveis**
- **UI default: 3 níveis** (atende 90% PMEs)
- **Configuração avançada** pode subir pra 4-5 níveis (Lucro Real)
- **Templates** vêm com max 3 níveis

### 12.4 "Restaurar Padrão" — Workflow detalhado

**Step 1:** User clica `↺ Restaurar Padrão`

**Step 2:** Sistema analisa diff (10-30 segundos)

**Step 3:** Tela de Diff completa
```
Pré-visualização das mudanças
──────────────────────────────

✅ MANTIDAS (175 categorias) — sem alteração

⚠️ CUSTOMIZADAS — você editou (decida o que fazer):
   📝 "Aluguel da Loja" (era "Aluguel")
      • 12 transações vinculadas
      • [⚪ Manter custom] [⚫ Voltar pro padrão]

⚠️ EXTRA (NÃO estão no template):
   📝 "Pagamento Festival Junino" (criada por você)
      • Será mantida (custom não removida)

✨ ADICIONAR (faltam no atual):
   ✓ Nenhuma
```

**Step 4:** Confirmação final + checksum

**Step 5:** Aplicação atômica + audit log completo

### 12.5 Microinterações

1. Hover categoria: fundo fade 150ms
2. Click selecionar: borda esquerda slide-in 200ms
3. Expand/collapse: rotação chevron 200ms
4. Drag start: shadow + scale 1.02
5. Drop válido: linha guia pulsa verde
6. Drop inválido: shake horizontal 300ms
7. Save success: card flash verde 600ms + toast
8. Delete: fade-out 250ms
9. Search: highlight no termo

### 12.6 Mobile (< 768px)

- Stack vertical (árvore acima, detalhes abaixo)
- Drag por long-press 300ms
- Detalhes vira bottom sheet
- Atalhos teclado escondidos
- Toolbar vira menu hamburger

---

## 13. DRE GERENCIAL

### 13.1 Filosofia

> **"DRE é a foto da saúde da empresa. Tem que ser clara, comparável e acionável."**

**Não copiamos Conta Azul (tabela densa).** Adotamos **IBCS standard** (Power BI / Zebra BI).

### 13.2 Layout

**Header:**
- Título: "DRE Gerencial — {Nome empresa}"
- Subtítulo: "{Setor} · {Regime tributário} · CNPJ {número}"

**Toolbar:**
- `[Período: Abril 2026 ▼]`
- `[Comparar com: Março 2026 ▼]`
- `[Centro de Custo: Todas ▼]`
- `[Visualizar em: Competência ▼]` (Caixa | Competência)
- `[📤 PDF] [📊 Excel] [🔄 Atualizar]`

### 13.3 Cards de KPI (4 cards)

| Card | Conteúdo |
|---|---|
| **Receita** | R$ 245.000 · ↑ 12% vs Março · Margem 100% |
| **Lucro Bruto** | R$ 162.000 · ↑ 8% · Margem 66% |
| **EBITDA** | R$ 75.000 · ↑ 15% · Margem 31% |
| **Lucro Líquido** | R$ 48.500 · ↑ 18% · Margem 19.8% |

### 13.4 Banner Insight IA

```
┌──────────────────────────────────────────────────────────┐
│ 💡 Insight IA                          [👍 útil] [👎 não]│
│                                                            │
│ "Sua margem EBITDA cresceu 15% comparado ao mês anterior, │
│  principalmente por redução de 22% em Despesas Op."       │
│                                                            │
│ Baseado em variações reais > 5%. Atualizado: 03/05 16:42  │
└──────────────────────────────────────────────────────────┘
```

### 13.5 Tabela DRE detalhada

**5 colunas:**
1. Categoria (com indentação)
2. Realizado (R$)
3. Vertical % (sobre receita líquida)
4. Horizontal % (vs período comparado)
5. Orçado + Variação

**Linhas de subtotal:** background `bg-slate-100`, bold, bordas duplas em "Receita Líquida", "Lucro Bruto", "EBITDA", "Lucro Líquido"

**Variance Analysis (IBCS standard):**
```
                  Mar/26   Mar/25    YoY %    YTD/26    YTD/25    YTD %
Receita           245.000  198.000   +24% △   720.000   615.000   +17%△
Lucro Bruto       162.000  130.000   +25% △   485.000   410.000   +18%△
EBITDA             75.000   58.000   +29% △   220.000   175.000   +26%△
Lucro Líquido      48.500   38.000   +28% △   142.000   115.000   +23%△
```

### 13.6 Drill-down (modal lateral)

**Click numa linha abre:**
- Total + variação
- Lista de transações (data, descrição, valor, fornecedor)
- Lista de fornecedores (top 5 por valor)

### 13.7 Configurações avançadas (gear icon)

- Reordenar grupos do DRE (drag-drop)
- Esconder grupos não usados
- Customizar fórmulas
- Salvar como template pra outras empresas

### 13.8 Export PDF profissional

**Layout:**
- Header com logo da empresa
- Capa: nome + período + assinatura digital
- Sumário executivo (KPIs + insight)
- DRE detalhado em tabela limpa
- Análise gráfica (waterfall do resultado)
- Notas explicativas
- Rodapé com info do sistema

---

## 14. RELATÓRIOS DERIVADOS

### 14.1 DFC (Demonstrativo de Fluxo de Caixa)

**Diferença chave:**
- DRE = regime competência (data do fato)
- DFC = regime caixa (data do dinheiro)

**Particularidades DFC:**
- Categorias TRANSFER aparecem (entre contas próprias)
- Sem depreciação (não é caixa)
- Inclui aplicações/resgates

### 14.2 Análise Vertical e Horizontal

**No Conta IA:** ambas em colunas separadas (não 2 telas).

| Categoria | Valor | Vertical % | Horizontal % |
|---|---|---|---|
| Receita | R$ 245.000 | 100% | +12% vs mês ant |
| COGS | -R$ 65.000 | -26.5% | +15% |
| Lucro Bruto | R$ 180.000 | 73.5% | +10% |

### 14.3 KPIs financeiros (Dashboard)

```
LUCRATIVIDADE
  Margem Bruta:        66,1% (↑ 2,5pp vs mês ant)
  Margem Operacional:  27,3% (↑ 4,8pp)
  Margem EBITDA:       30,6% (↑ 3,2pp)
  Margem Líquida:      19,8% (↑ 2,1pp)

EFICIÊNCIA
  ROI:                 18,5% (anualizado)
  Ponto Equilíbrio:    R$ 165k/mês
  Margem de Segurança: 32,7%

LIQUIDEZ
  Liquidez Corrente:   2,3
  Liquidez Imediata:   0,8

OPERACIONAIS
  Burn Rate:           R$ 87k/mês
  Runway:              4,2 meses
  Ticket Médio:        R$ 45,80

CONTAS A RECEBER (Aging)
  DSO:                 45 dias
  Inadimplência:       4,2%
  PMR:                 32 dias
```

### 14.4 Aging — Contas a Pagar/Receber

**Página `/empresas/[id]/financeiro/aging`**

**Toggle: [📥 Receber] [📤 Pagar]**

**Insight de saúde:**
> "Saúde BOA: 78% a vencer (saudável >70%); 0,8% acima de 90 dias (saudável <5%)"

**Tabela detalhe por cliente/fornecedor:**
- Linhas ordenadas por total devido (desc)
- 7 colunas: Nome, A vencer, 1-30, 31-60, 61-90, +90, Total

**Ações Sugeridas:**
- ⚠️ "5 clientes com atraso 31-60 dias — Enviar lembretes?"
- 🔴 "2 clientes +90 dias — Considerar provisão de perda"

**Provisão para Devedores Duvidosos (PDD):**
- 90+ dias: provisionar 50%
- 180+ dias: provisionar 75%
- 360+ dias: write-off (100%)

### 14.5 Orçamento (Budget)

**Página `/empresas/[id]/orcamento`**

**Layout: matriz Categoria × Mês**
```
Categoria          Jan    Fev    Mar    ...    Total    Realizado
─────────────────  ─────  ─────  ─────  ───    ──────   ──────────
▼ RECEITAS
  Mensalidades     80k    80k    85k    ...    1.05M    1.12M ↑6%
  Personal         15k    15k    16k    ...    195k     187k ↓4%
▼ DESPESAS
  Aluguel          -8k    -8k    -8k    ...    -96k     -96k ✓
─────────────────
TOTAL Líquido      67k    67k    70k    ...    850k     879k ↑3%
```

**Funcionalidades:**
- Edição em massa (clique célula → input)
- Distribuição inteligente (digita anual → distribui)
- Cenários múltiplos (Otimista / Realista / Pessimista)
- Workflow aprovação (DRAFT → APPROVED)
- Forecast contínuo (IA sugere ajustes)

**Integração com DRE:** coluna "Orçado" + variação automática.

---

## 15. CENTRO DE CUSTO

### 15.1 Por que é diferencial chave

**Pesquisa BR (Planning, Treasy):**
> "Se você ainda discute resultado apenas no consolidado, você não tem gestão. Você tem fechamento."

**Cenário Yussef (13 academias):**
- Sem CC: DRE consolidado = ferramenta de fechamento
- Com CC: painel de comando estratégico

### 15.2 UI principal

**Página `/empresas/[id]/centros-de-custo`**

Layout split idêntico ao Categorias:
- Esquerda: árvore (matriz → filiais)
- Direita: detalhes + mini-DRE

**Mini-DRE no detalhe:**
```
Academia Sul (Filial)
─────────────────────
Receitas:    R$ 98.000
Despesas:    R$ 86.000
─────────────────────
Resultado:   R$ 12.000 (12.2% margem)

Top 5 categorias:
  Mensalidades:   R$ 87k (89% receita)
  Salários CLT:   R$ 32k (37% despesa)
  Aluguel:        R$ 15k (17% despesa)
```

### 15.3 DRE consolidado vs por filial

#### Modo "Comparar" (diferencial)

**Matriz cruzada:**
| Categoria | Centro | Sul | Norte | Leste | Total |
|---|---|---|---|---|---|
| Receitas | R$ 145k | R$ 98k | R$ 124k | R$ 132k | R$ 499k |
| Despesas | -R$ 119k | -R$ 86k | -R$ 99k | -R$ 108k | -R$ 412k |
| **Margem** | **18%** | **12%** ⚠️ | **20%** | **18%** | **17%** |
| Resultado | R$ 26k | R$ 12k | R$ 25k | R$ 24k | R$ 87k |

**Insights automáticos:**
- 🚨 "Sul: margem 12% (5pp abaixo média 17%) — investigar"
- ✅ "Norte: melhor performance (20% margem)"
- 💡 "Sugestão: aplicar boas práticas Norte → Sul"

### 15.4 Dashboard por Centro de Custo

```
Academia Sul — Dashboard

┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│Receita  │  │Margem   │  │Funcion. │  │Tickets  │
│R$ 98k   │  │12%      │  │8 CLT    │  │R$ 245   │
│↓ 4%     │  │↓ 2pp    │  │+1       │  │↑ 5%     │
└─────────┘  └─────────┘  └─────────┘  └─────────┘

💡 Insight: "Margem caiu por aumento de 8% em folha
   sem aumento equivalente de receita."

Ranking entre filiais:
  #4 de 4 em margem (mais baixa)
  #2 em receita absoluta
```

### 15.5 Diferencial vs concorrentes

- **Conta Azul:** CC simples (lista, sem hierarquia, sem comparação visual)
- **Omie:** hierarquia mas sem dashboard por filial
- **Conta IA:** **comparação automática + ranking + insights por filial**

---

## 16. IA INTELIGENTE — Coach Financeiro Proativo

### 16.1 Filosofia da IA do Conta IA

> **A IA não é um relatório. É um CONSULTOR FINANCEIRO 24/7.**

A IA do Conta IA não calcula só o imposto do mês. Ela:
- 📊 **LÊ os relatórios** das empresas continuamente
- 🔔 **NOTIFICA proativamente** sobre como a empresa está indo
- 🎯 **SIMULA cenários** em tempo real (regimes tributários, projeções)
- 💰 **AVISA com VALOR CONCRETO em R$** (não vago)
- 🚨 **ALERTA mudanças importantes** (faixa de imposto, inadimplência, etc)

### 16.2 Postura: INTELIGENTE-PROATIVA

A IA é:
- ✅ **ANALÍTICA** — calcula correlações reais, não inventa
- ✅ **PROATIVA** — não espera user perguntar, avisa antes
- ✅ **CONCRETA** — fala em R$ e %, não vaguidades
- ✅ **CONTEXTUAL** — considera setor, regime, porte da empresa
- ✅ **HONESTA** — admite quando dados são insuficientes
- ✅ **ÚTIL** — sugere AÇÕES com cálculo de impacto

A IA NÃO é:
- ❌ Apenas calculadora de impostos
- ❌ Relatório passivo que só mostra o que aconteceu
- ❌ Conservadora demais (vira ruído sem valor)
- ❌ Inventa números que não existem

### 16.3 Exemplos REAIS de notificações inteligentes

#### Exemplo 1: Migração de regime tributário (caso real do Yussef)

```
🔔 ATENÇÃO: Sua alíquota efetiva subiu para 12,4%

Análise da Cacula Mix (Restaurante):
• Faturamento últimos 12m: R$ 1.430.000
• Você está no Simples Nacional Anexo I
• Alíquota efetiva atual: 12,4% (era 10,1% há 6 meses)

💡 SIMULAÇÃO COMPARATIVA:

Cenário 1 — Continuar no Simples Nacional:
   Imposto anual estimado: R$ 177.320

Cenário 2 — Migrar pro Lucro Presumido em janeiro/2027:
   IRPJ + CSLL + PIS + COFINS + ISS: R$ 162.180
   ECONOMIA ESTIMADA: R$ 15.140/ano

📋 Pra confirmar essa decisão, considere:
- Suas margens reais (se forem altas, Presumido vence)
- Volume de despesas dedutíveis
- Capacidade do contador trabalhar com regime de competência

[Ver simulação detalhada]  [Conversar com IA]  [Lembrar em dezembro]
```

#### Exemplo 2: Alerta de saúde financeira

```
🚨 ATENÇÃO: Inadimplência cresceu 240% este mês

Cacula Mix — Detecção em tempo real:
• Inadimplência (>30 dias): 8,2% (era 2,4% no mês anterior)
• Total a receber em atraso: R$ 21.500

📊 Análise por categoria:
• Mensalidades: 4 clientes vencidos (R$ 1.200)
• Personal Trainer: 3 clientes vencidos (R$ 4.500)
• Eventos corporativos: 2 contratos (R$ 15.800) ⚠️ MAIOR IMPACTO

💡 Padrão detectado:
A empresa "Empresa XYZ" tem R$ 15.800 vencidos há 35 dias.
É 73% do seu problema atual.

[Ver detalhes desse cliente]  [Enviar lembrete automático]  [Provisionar perda]
```

#### Exemplo 3: Oportunidade tributária — Fator R

```
💎 OPORTUNIDADE FISCAL DETECTADA

Sua empresa está no Anexo V do Simples Nacional.
Mas seu Fator R atual é de 35,8% (acima de 28% exigido).

Você pode migrar para o Anexo III!

Comparação para os próximos 12 meses (faturamento estimado R$ 1,5M):
• Anexo V atual:    Imposto: R$ 244.500
• Anexo III novo:   Imposto: R$ 180.300
• ECONOMIA: R$ 64.200/ano (R$ 5.350/mês)

📋 Como migrar:
1. Confirmar Fator R com seu contador
2. Solicitar reenquadramento no Simples
3. Ajuste vale a partir do mês seguinte

[Iniciar processo]  [Falar com contador]  [Calcular novamente]
```

#### Exemplo 4: Análise de DRE com diagnóstico

```
📊 INSIGHT — DRE de Outubro/2026

Sua margem EBITDA: 18,5% (queda de 4,2pp vs setembro)

🔍 Diagnóstico (baseado em variações reais):

Categorias com aumento desproporcional:
• Aluguel (+12%): contrato reajustado em outubro
• Energia (+18%): bandeira tarifária vermelha + uso intenso ar-cond
• Folha CLT (+8%): contratação de 2 funcionários

Categorias com queda esperada:
• Mensalidades (-3%): sazonalidade típica de outubro

💡 Áreas pra investigar (não decisão automática):
1. Energia: solar pode pagar em ~36 meses (estimado R$ 800/mês)
2. Aluguel: reajuste foi acima da inflação? Renegociar?
3. Folha: contratações foram estratégicas? ROI em 3 meses?

⚠️ NOTA: Esta é uma análise. Decisões finais cabem ao gestor.

[Ver detalhes]  [Simular cenários]  [Marcar pra revisar]
```

### 16.4 Categorias de Notificações Inteligentes

#### A. Notificações TRIBUTÁRIAS (proativas)
- 🔔 Alíquota efetiva mudou de faixa
- 🔔 Fator R cruzou o limite (28%) — mudança de anexo possível
- 🔔 Migração de regime gera economia > R$ 5.000/ano
- 🔔 Reforma Tributária — novo cenário CBS+IBS impacta empresa
- 🔔 Vencimento de DAS/DARF próximo

#### B. Notificações de SAÚDE FINANCEIRA
- 🚨 Inadimplência cresceu acima de X%
- 🚨 Margem caiu 5pp+ vs período anterior
- 🚨 Saldo de caixa vai ficar negativo em N dias
- 🚨 Categoria de despesa cresceu desproporcional
- 🚨 Cliente importante com pagamento em atraso

#### C. Notificações de OPORTUNIDADES
- 💎 Fator R favorável detectado (migração possível)
- 💎 Categoria sub-utilizada vs setor
- 💎 Tendência positiva consistente (3+ meses)
- 💎 Comparação vs orçado: você está superando metas

#### D. Notificações de COMPLIANCE
- ⚠️ Categoria sem dreGroup (impede DRE correto)
- ⚠️ Transação sem competenceDate
- ⚠️ Aging crescendo (risco fiscal)
- ⚠️ Documento fiscal pendente

### 16.5 Como a IA "lê" os relatórios

**Pipeline em tempo real:**

```
1. EVENT TRIGGER:
   - User abriu DRE
   - Nova transação foi adicionada
   - Mudança de regime
   - Mudança de mês (job recorrente diário)

2. COLETA DE DADOS (determinística):
   - Calcula variações reais (não estimadas)
   - Compara períodos (M-1, Y-1, orçado)
   - Detecta outliers estatísticos
   - Identifica padrões (3+ meses consistentes)

3. CONTEXTO (informações da empresa):
   - Setor (academia, restaurante, etc)
   - Regime tributário atual
   - Tamanho/faturamento
   - Histórico (12 meses)

4. PROMPT ESTRUTURADO PRA CLAUDE:
   - "Aqui estão os números calculados"
   - "Aqui está o contexto"
   - "EXPLIQUE em 2-3 frases"
   - "NUNCA invente números"

5. VALIDAÇÃO PROGRAMÁTICA:
   - Checa se números mencionados batem
   - Checa se claims são razoáveis
   - Se algo errado, mostra fallback

6. NOTIFICAÇÃO:
   - Aparece no sininho do header
   - Email pra notificações críticas
   - Push se PWA instalado
```

### 16.6 Estratégia anti-alucinação (3 camadas)

#### Camada 1: RAG estruturado
Calcular variações ANTES (deterministicamente), pedir IA pra apenas EXPLICAR.

```typescript
const variations = calculateRealVariations(dre)  // 100% certo

const prompt = `
Você está analisando o DRE de uma empresa de ${empresa.setor}.
Regime: ${empresa.regime}.

NÚMEROS REAIS (não invente outros):
- Receita: R$ ${dre.revenue} (variação real: ${variations.revenue}%)
- Despesas Op: R$ ${dre.opex} (variação real: ${variations.opex}%)
- EBITDA: R$ ${dre.ebitda} (variação real: ${variations.ebitda}%)

CATEGORIAS QUE MAIS VARIARAM (somente essas):
${topVariations.map(c => `- ${c.name}: ${c.variation}%`).join('
')}

Em 2-3 frases, EXPLIQUE qual variação foi mais relevante e POSSÍVEL causa.
Se não houver variação significativa (>5%), diga "performance estável".
NUNCA invente causas. Apenas correlacione com as categorias listadas.
`
```

#### Camada 2: Negative Prompting
Frase chave: "Se você não tiver certeza, diga 'dados insuficientes'. NÃO INVENTE."

#### Camada 3: Validação programática
Verifica se números mencionados pela IA estão na lista permitida. Se não, fallback.

### 16.7 Custos estimados

**Modelo:** Claude Sonnet 4.

**Por insight gerado:**
- Input: ~2k tokens
- Output: ~150 tokens
- Custo: ~US$ 0,008 (R$ 0,04)

**Cache 24h:** mesmo insight visualizado 100x = 1 chamada Claude.

**Estimativa por user/mês:** R$ 2-5 (notificações ativas).

**Disponibilidade por plano:**
- Plano Starter (R$ 149): notificações simples baseadas em regras
- Plano Pro (R$ 399): IA Coach completa com simulações
- Plano Business (R$ 999): tudo + análises preditivas avançadas

### 16.8 Limites éticos da IA Coach

A IA NUNCA vai:
- ❌ Sugerir demissão de funcionários específicos
- ❌ Fazer recomendação tributária definitiva sem disclaimer ("confirme com contador")
- ❌ Aconselhar sobre questões trabalhistas individuais
- ❌ Fazer projeções >12 meses com confiança alta
- ❌ Comparar empresa do user com concorrentes específicos (sem dados públicos)

A IA SEMPRE vai:
- ✅ Mostrar variações reais com clareza
- ✅ Explicar correlações observadas
- ✅ Sugerir áreas pra investigação ou simular cenários concretos
- ✅ Citar fonte dos números (DRE, DFC, Aging)
- ✅ Admitir incerteza quando relevante
- ✅ Quantificar oportunidades em R$
- ✅ Dar opções, deixar decisão final pro gestor

### 16.9 UX das Notificações

#### Centro de Notificações (sininho no header)

```
🔔 Notificações (3 não lidas)

🚨 CRÍTICO — Cliente Empresa XYZ vencido há 35 dias (R$ 15.800)
   há 2 horas | [Ver detalhes]

💎 OPORTUNIDADE — Você pode economizar R$ 64.200/ano migrando pra Anexo III
   há 1 dia | [Ver simulação]

📊 ANÁLISE — Sua margem caiu 4,2pp em outubro
   há 3 dias | [Ver DRE]
```

#### Insight inline em relatórios

```
┌──────────────────────────────────────────────────────────┐
│ 💡 Insight IA                          [👍 útil] [👎 não]│
│                                                            │
│ "Sua margem EBITDA cresceu 15% comparado ao mês anterior, │
│  principalmente por redução de 22% em Despesas Op."       │
│                                                            │
│ Baseado em variações reais > 5%. Atualizado: 03/05 16:42  │
│                                                            │
│ [Ver simulação] [Comparar regimes] [Ver categorias]       │
└──────────────────────────────────────────────────────────┘
```

### 16.10 Configurações pelo usuário

**Em `/empresas/[id]/configuracoes/notificacoes`:**

```
Quais notificações IA quer receber?

☑ Tributárias (alertas de regime, faixa de imposto)
☑ Saúde financeira (margem, inadimplência, caixa)
☑ Oportunidades (Fator R, simulações)
☑ Compliance (categorias sem grupo, etc)

Frequência:
⚪ Em tempo real (push + email)
⚫ Diária (resumo da manhã)
⚪ Semanal (resumo de segunda)
⚪ Apenas no app (sem email)

Insights nos relatórios:
☑ Mostrar análise IA em DRE
☑ Mostrar análise IA em DFC
☑ Mostrar análise IA em Aging
```

---

---

# PARTE IV — EXECUÇÃO

---

## 17. DECISÕES APROVADAS

### 17.1 Estratégicas (já aprovadas pelo Yussef)

✅ **Filosofia:** Qualidade extrema > velocidade. Sem prazo. Há padrão.

✅ **Foco inicial:** SERVICE/Academia (Yussef expert), depois Restaurante (cacula mix), Clínica, Salão, Loja.

✅ **Apenas BR:** sem multi-país inicialmente.

✅ **Sem integração contador inicial:** depois de 6 meses.

✅ **NF-e via integração:** eNotas/Bling, não emissão própria.

✅ **eSocial:** apenas calculadora informativa, sem envio direto.

✅ **Pluggy:** congelado por tempo indeterminado (não funciona pra PJ).

✅ **OFX-first:** estratégia até FASE 7+ (cobrança SaaS).

### 17.2 Decisões aprovadas para execução

✅ **Hierarquia:** schema permite até 5 níveis. UI default: 3 níveis. Configuração avançada habilita 4-5.

✅ **Drag-and-drop:** v1 reordenar dentro do mesmo nível. v1.5 adiciona drag entre níveis.

✅ **Importação CSV:** stretch v2 (botão "em breve").

✅ **Insight IA:** Cache 24h (economia). Toggle ON por padrão.

✅ **Drill-down DRE:** modal lateral (mantém contexto).

✅ **Cards de KPI:** 4 fixos (Receita/Bruto/EBITDA/Líquido).

✅ **Posicionamento:** especialização honesta, sem promessa "#1 BR".

✅ **Custom Roles:** disponível em TODOS os planos (diferencial vs QuickBooks).

✅ **Audit Log:** retenção 5 anos. LGPD: anonimizar ao invés de deletar.

✅ **Implementação:** Categorias primeiro (5.1), depois DRE (5.4).

✅ **Migrations:** faseadas (uma por vez, validação entre).

✅ **Atalhos teclado:** em fases (básicos primeiro: Esc, Enter, Cmd+Enter; avançados depois).

✅ **Densidade árvore:** compacta no desktop, espaçada no mobile.

✅ **Paleta cores:** 12 curadas + opção custom.

---

## 18. ROADMAP DE 12 MESES

### Q2 2026 (atual) — FUNDAÇÃO PERFEITA

**Status:**
- ✅ Schema de IA (Suppliers, Rules) — Etapa 2.1 feita
- ✅ Etapa 4.5b UI Pendentes — feito
- ✅ Etapa 2.3 Templates por subsetor — feito
- ✅ Etapa 2.4 Backfill empresas existentes — feito (commit dfeb20c)
- 🔄 **Etapa 5.1** — Tela Categorias Base (PRÓXIMA)

**A entregar:**
- Etapa 5.1 — Tela Categorias estrutura básica (lista hierárquica + CRUD modal)
- Etapa 5.2 — Drag-and-drop + edição inline
- Etapa 5.3 — Migrations fundacionais (RBAC, Audit, competence date)
- Beta com Yussef + 5 amigos

### Q3 2026 — RELATÓRIOS & DRE PROFISSIONAL

- Etapa 5.4 — DRE Gerencial Base
- Etapa 5.5 — DRE Avançado + Centro de Custo
- Etapa 5.6 — Orçamento (Budget)
- Etapa 5.7 — AR/AP + Aging
- DFC Realizado e Projetado
- Conciliação Bancária split-view

### Q4 2026 — IMPOSTOS & REFORMA TRIBUTÁRIA

- Cálculo automático DAS (Simples Nacional) com Fator R
- Cálculo IRPJ + CSLL (Presumido)
- Cálculo PIS + COFINS (cumulativo e não-cumulativo)
- Calculadora CBS + IBS (Reforma 2026)
- Simulador de regime tributário (3 regimes)
- Recomendação automática

### Q1 2027 — FOLHA DE PAGAMENTO INTEGRADA

- Cadastro de funcionário (CLT, Pró-labore, Autônomo, MEI, Estagiário)
- Cálculo automático INSS + IRRF + FGTS
- Provisão 13º e férias automática
- Tabelas atualizadas 2027
- Geração de DARF previdenciária

### Q2 2027 — IA AGENTICA & COACH FINANCEIRO

- Chat conversacional com Claude Sonnet
- "Coach Financeiro" — análise textual automática
- Forecasting com explicação
- Detecção de anomalias proativa
- Otimização tributária ativa

### Q3 2027 — OPEN FINANCE PRODUÇÃO

**Disparador:** 50+ clientes pagando, MRR ≥ R$ 15k

- Pluggy KYC produção
- UI cliente: "Conectar Banco" widget Pluggy
- Sincronização automática 4x/dia
- Manter OFX como fallback

### Q4 2027 — COBRANÇA SAAS, ONBOARDING & ESCALA

- Painel Super Admin
- Integração Asaas
- Trial 14 dias
- Onboarding wizard
- PWA mobile-friendly
- Etapa 5.8 — Polimentos finais (dark mode, acessibilidade, atalhos completos)

---

## 19. ESTADO ATUAL

### 19.1 Onde estamos no código

**Branch main:** 13 commits à frente do origin/main (sem push)

**Últimos commits:**
- `dfeb20c` — Etapa 2.4 backfill empresas existentes
- `3688f0d` — Etapa 2.3 templates por subsetor
- `82b0980` — PRODUTO-NORTE.md
- `2732555` — Schema profissional (Categories Pro)
- `e4141ee` — Refatoração lib/bancos.ts
- `54921d4` — Fix dedup hash FITID
- `3ebba31` — Etapa 3.1 detecção banco
- `0d54c80` — Auditoria FASE 2.1

**Estado real:**
- ✅ Cacula mix com 182 categorias profissionais
- ✅ Demo Conta IA com 195 + 15 categorias
- ✅ Tela /pendentes funcionando
- ✅ Yussef testou e classificou transação real
- ✅ 267 testes passando
- ✅ Documentos commitados: CLAUDE.md, docs/PRODUTO-NORTE.md

### 19.2 Próxima Etapa (5.1)

**Tela `/empresas/[id]/categorias` — Gerenciar Plano de Contas**

**Escopo:**
- Página com layout split (40/60)
- Listagem hierárquica (sem drag-drop ainda)
- Modal de criar/editar
- Campos completos (nome, código, tipo, DRE Group, cor, ícone, descrição)
- Soft delete
- Filtros básicos (busca, tipo, status)
- Empty state, loading, error states

**NÃO entra na 5.1:**
- Drag-and-drop (vai pra 5.2)
- Edição inline (5.2)
- Atalhos teclado avançados (5.2)
- Importação CSV (v2)

### 19.3 Sequência sugerida das próximas etapas

| Etapa | Escopo | Tempo estimado |
|---|---|---|
| **5.1** | Tela Categorias Base | 1-2 dias |
| 5.2 | Drag-and-drop + edição inline | 1 dia |
| 5.3 | Migrations (RBAC, Audit, competence) | 2-3 dias |
| 5.4 | DRE Gerencial Base | 2-3 dias |
| 5.5 | DRE Avançado + Centro de Custo | 3-4 dias |
| 5.6 | Orçamento (Budget) | 2 dias |
| 5.7 | AR/AP + Aging | 2 dias |
| 5.8 | Polimentos finais | 2-3 dias |

**Total: ~15-20 dias** focados, dividido em quantas sessões precisar.

### 19.4 Ordem dos commits

```
feat(rbac): roles, user_company_roles e middleware authorize
feat(audit): audit_log universal com retenção 5 anos
feat(transaction): add competence_date + backfill
feat(categorias): página listagem hierárquica + CRUD
feat(categorias): drag-and-drop e edição inline
feat(dre): tabela DRE Gerencial com filtros e drill-down
feat(dre): comparativos, insight IA e export PDF
feat(centro-custo): dashboard e comparação entre filiais
feat(budget): orçamento com matriz e workflow
feat(ar-ap): contas a pagar/receber e aging
feat(ui): polimentos finais (dark mode, mobile, atalhos)
```

---

## 🎯 CONCLUSÃO

### Resumo do que o sistema vai entregar

✅ **Plano de Contas profissional** com hierarquia até 5 níveis, drag-and-drop pragmático, edição inline, atalhos teclado modernos
✅ **Multi-regime tributário** nativo com 8 regimes
✅ **Reforma Tributária 2026** desde dia 1 (CBS + IBS)
✅ **Templates por subsetor** profundos (166-195 categorias por template)
✅ **DRE Gerencial profissional** com IBCS standard, variance analysis, insight IA confiável
✅ **DFC** com regime caixa (separado de competência)
✅ **Centro de Custo** com comparação entre filiais e ranking
✅ **Orçamento** com matriz Categoria × Mês e workflow
✅ **AR/AP + Aging** com 5 faixas padrão BR e PDD automático
✅ **RBAC** com 6 roles padrão + custom roles + acesso temporário
✅ **Audit log** universal com retenção 5 anos (LGPD-compliant)
✅ **Insight IA** com anti-alucinação (RAG + negative prompting + validação)
✅ **Dark mode** + mobile real (PWA) + acessibilidade A11Y
✅ **Recomendação tributária ATIVA** (diferencial único no mercado BR)

### Posicionamento honesto e sustentável

> "Sistema financeiro especializado em PMEs brasileiras de 5 subsetores específicos: academias, clínicas, salões, restaurantes e lojas. Usa IA pra automatizar classificação e calcular impostos automaticamente. Pronto pra Reforma Tributária 2026."

### Filosofia mantida

> **Qualidade extrema > velocidade.**
> Cada decisão fundamentada em pesquisa.
> Sem dívida técnica.
> Refatoração permitida e encorajada.

### Próximos passos imediatos

1. Yussef revisa este documento
2. Aprova com Claude Code commitar `docs/CONTA-IA-NORTE.md`
3. Damos sequência à Etapa 5.1 (Tela Categorias Base)
4. Cada etapa testada e validada antes da próxima

---

## 📚 FONTES E REFERÊNCIAS

### Pesquisas web feitas (30+)

**Cenário regulatório BR:**
- Reforma Tributária 2026 IBS CBS implementação cronograma
- DRE balanço patrimonial DFC Lei 6.404 estrutura
- Simples Nacional 2026 anexos alíquotas DAS
- eSocial 2026 folha pagamento INSS FGTS
- Lucro Presumido cálculo IRPJ CSLL PIS COFINS
- Regime competência caixa contabilidade brasil

**Sistemas e benchmarking:**
- QuickBooks Online chart of accounts UI hierarchy
- Xero chart of accounts tree view drag-drop 2026
- Conta Azul plano de categorias hierarquia subcategoria
- Conta Azul Omie funcionalidades comparação SaaS
- QuickBooks Online account limit Simple Start Plus Advanced
- Conta Azul permissões usuário perfil acesso financeiro

**UX e tecnologia:**
- Best financial dashboard UI design 2026 P&L
- @dnd-kit tree hierarchy drag drop nested React
- AI hallucinations finance prompt engineering 2026
- AI financial software accounting automation 2026

**Arquitetura SaaS:**
- RBAC role based access control SaaS multi-tenant 2026
- Audit log accounting software changes SOX
- Orçamento empresarial planejamento DRE projetado realizado
- Aging contas a pagar receber inadimplência sistema
- Centro de custo gestão financeira filial DRE consolidado

### Fontes oficiais BR

- **Receita Federal:** gov.br/receitafederal
- **Ministério da Fazenda:** gov.br/fazenda
- **Conselho Federal de Contabilidade (CFC):** NBC TG Estrutura Conceitual
- **Lei Complementar 123/2006:** Simples Nacional
- **Lei Complementar 214/2025:** Reforma Tributária regulamentação
- **Lei 6.404/76:** Lei das S/A
- **CPC 26 (R5):** Apresentação de Demonstrações Contábeis
- **EC 132/2023:** Reforma Tributária constitucional

### Sistemas analisados

**Brasileiros:**
- Conta Azul, Omie, Nibo, Bling, Sage Brasil, TOTVS Protheus, Vhsys, Tiny ERP

**Globais:**
- QuickBooks Online (Intuit), Xero, NetSuite (Oracle), SAP Business One, FreshBooks, Wave, Zoho Books, Power BI + Zebra BI, Bold BI, Qlik

**Inspirações UX:**
- Notion, Linear, Stripe Dashboard, Superhuman, Tableau

### Padrões e standards

- **IBCS** (International Business Communication Standards) — Rolf Hichert
- **NIST RBAC** Role hierarchy model
- **LGPD** compliance — anonimização vs exclusão
- **SPED** Plano de Contas Referencial Receita Federal

---

*Documento mestre CONTA-IA-NORTE.md — versão definitiva.*
*Substitui PRODUTO-NORTE.md + UI-CATEGORIAS-DRE-V3-FINAL.md.*
*Pronto para commit em `docs/CONTA-IA-NORTE.md`.*

**Yussef + Claude — 03/05/2026**
