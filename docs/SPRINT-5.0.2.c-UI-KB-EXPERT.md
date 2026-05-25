# Sprint 5.0.2.c — Fix UI Atividades + Knowledge Base Profunda + Expert Prompt

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2005 → **2094 (+89 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

## Contexto

Yussef testou Sprint 5.0.2.b e identificou 2 problemas críticos:
1. **UI Atividades** — "nem aparece restaurante ou academia" (autocomplete dropdown invisível, busca pobre)
2. **Conhecimento raso** — "wiki estático genérico, não sabe teto Simples"

Sprint 5.0.2.c entrega: **UI visual com chips + cards + ícones + aliases** e **Knowledge Base substantiva (~2.100 linhas de conteúdo legal)** + **System Prompt expert "contador 30 anos"** pronto para a próxima sprint (Claude analyzing real).

## Parte A — UI Atividades (refatorada)

### Decisão técnica: aliases no catálogo TS (sem migration)

Spec original sugeria `aliases String[]` em CNAEActivity. Optei por mantê-los no catálogo TypeScript (`lib/tax/expertise/*.ts`) em vez do DB porque:
- Search já roda em memória (catálogo pequeno, 19 entries)
- Adicionar coluna `String[]` em prod (Postgres) sem usar em SQLite dev exigiria workaround com JSON serializado
- Decisão revisável: futuro RAG da Sprint 5.0.2.d pode carregar do TS direto (zero round-trip DB)

### CNAEEntry estendido (`lib/tax/expertise/types.ts`)
```typescript
interface CNAEEntry {
  code: string
  name: string
  anexo: string
  aliases?: string[]  // NEW — termos coloquiais (case-insensitive, sem acento)
  icon?: string       // NEW — emoji 1 char
}
```

### 19 CNAEs com aliases populados
Cada CNAE ganhou 5-10 aliases com sinônimos e brand names. Exemplos:
- **5611-2/01** Restaurante → `restaurante, comida, almoco, jantar, churrascaria`
- **1091-1/02** Hamburgueria → `hamburgueria, hamburguer, burger, mcdonalds, burger king, subway`
- **9313-1/00** Academia → `academia, ginastica, musculacao, fitness, smart fit, bodytech`
- **4781-4/00** Vestuário → `loja roupa, roupas, boutique, renner, riachuelo, cea, zara`

### Novo `searchCNAEs(query, limit, ramo?)`
- Match em código (substring), nome (normalizado NFD) E aliases (normalizado)
- Suporta filtro opcional por ramo
- Função pura, sem DB

### API `/api/cnae/search` melhorada
- `?ramo=RESTAURANTE|ACADEMIA|COMERCIO_ROUPA` filtra
- Retorna ícone + aliases por CNAE
- Retorna `countByRamo` pra chips de filtro

### Componente `CNAESearchPicker` (`components/tributario/cnae-search-picker.tsx`)
Resolve o feedback "nem aparece":
- **Search input grande** (h-11, ícone lupa, X pra limpar) — visível
- **Chips por ramo** com ícone, label, contagem (8/5/6) — clicáveis pra filtrar
- **Grid 2×N de cards visuais** com emoji + nome + código + anexo + check selected
- **Empty state amigável** quando query não retorna nada
- Tudo SEMPRE renderizado (não esconde atrás de dropdown)

### Wire em `/tributario/perfil`
- Removidos: input simples + dropdown invisível
- Adicionados: `CNAESearchPicker` + card resumo do CNAE selecionado com link "Ver análise expert"

## Parte B — Knowledge Base Contábil (`lib/tax/knowledge/`)

**10 arquivos · 2.129 linhas · 100% material legal verificável**

| # | Arquivo | Linhas | Conteúdo |
|---|---|---|---|
| 01 | simples-nacional.ts | 318 | LC 123/2006 + 5 anexos completos com 6 faixas cada, Fator R, exclusões base, decisão Reforma 2026 |
| 02 | lucro-presumido.ts | 153 | Lei 9.249/95, margens IRPJ/CSLL por atividade, PIS/COFINS cumulativo, quando vale a pena |
| 03 | lucro-real.ts | 174 | RIR/2018, PIS/COFINS não-cumulativo, créditos permitidos/vedados, compensação prejuízo 30% |
| 04 | reforma-tributaria.ts | 207 | EC 132/2023 + LC 214/2025, CBS/IBS/IS, cronograma 2026-2033, regimes 60% redução, split payment, cashback, decisão Simples |
| 05 | beneficios-fiscais.ts | 173 | PERSE, ZFM, Lei do Bem, REPETRO, REIDI, SUDAM/SUDENE, drawback, desoneração folha |
| 06 | substituicao-tributaria.ts | 161 | Convênio CONFAZ 142/2018, modalidades, produtos típicos, cálculo MVA, como excluir do Simples |
| 07 | pis-cofins-monofasico.ts | 153 | Leis 10.147/00, 10.485/02, 10.336/01, produtos por setor, diferença vs ST |
| 08 | estados-particularidades.ts | 159 | Alíquotas internas 27 UFs, sublimites Simples, DIFAL, FECP, particularidades por estado |
| 09 | fator-r.ts | 173 | Threshold 28%, o que compta/não compta na folha, estratégias, casos de uso (academia, restaurante, TI) |
| 10 | jurisprudencia.ts | 102 | STF Tema 69 (ICMS na base PIS/COFINS), STJ Tema 1182 (crédito presumido), CARF posições |
| - | index.ts | 95 | `ALL_KNOWLEDGE`, `KNOWLEDGE_TOPICS`, `getKnowledgeFor(topic)` |

### Por que ~2.100 e não 5.000 linhas?
Spec original sugeria 5.000 linhas. Priorizei **profundidade real e verificável** (cada afirmação tem lei + artigo) em vez de inflar com placeholders. Knowledge Base atual cobre:
- ✅ Todos os 10 tópicos do spec
- ✅ Todas as tabelas/alíquotas/limites reais 2026
- ✅ Base legal específica (lei + artigo)
- ✅ Cobertura cross-section (estados, jurisprudência, reforma)

Sprint 5.0.2.d (Claude analyzing) consome via `getKnowledgeFor(topic)` — passa só o tópico relevante no system prompt (evita estourar contexto).

## Parte C — Expert System Prompt (`lib/tax/expert-prompt.ts`)

**Persona:** Contador Sênior 30 anos, especializado em PMEs brasileiras.

**Estrutura do prompt** (~250 linhas):
- IDENTIDADE + EXPERTISE TÉCNICA (todas as leis dominadas + 3 ramos verticais)
- COMPORTAMENTO (princípios de análise, estrutura de resposta, formato números BR)
- LIMITES E DISCLAIMERS (NUNCA/SEMPRE — anti-alucinação, exige citação de leis)
- EXEMPLO DE RESPOSTA (Cacula Mix completa com cenários A/B/C + recomendação)
- REGRAS DE USO (RAG futuro)

**Garantias do prompt** (testadas):
- Cita LC 123/2006, Lei 14.148/2021, EC 132/2023, LC 214/2025
- Cita STF Tema 69, jurisprudência relevante
- Cobre 3 ramos (restaurante/academia/comércio)
- Menciona Fator R 28%
- Proíbe inventar leis
- Proíbe sonegação
- Exige disclaimer "valide com contador"

## Métricas

| | Antes (5.0.2.b) | Depois (5.0.2.c) | Δ |
|---|---|---|---|
| Testes | 2005 | **2094** | +89 |
| Arquivos novos | — | **15** | +15 |
| Linhas KB | 0 | 2.129 | — |
| CNAEs com aliases | 0 | 19 | +19 |
| CNAEs com ícones | 0 | 19 | +19 |

## Arquivos novos

```
lib/tax/knowledge/
  ├── index.ts
  ├── 01-simples-nacional.ts
  ├── 02-lucro-presumido.ts
  ├── 03-lucro-real.ts
  ├── 04-reforma-tributaria.ts
  ├── 05-beneficios-fiscais.ts
  ├── 06-substituicao-tributaria.ts
  ├── 07-pis-cofins-monofasico.ts
  ├── 08-estados-particularidades.ts
  ├── 09-fator-r.ts
  └── 10-jurisprudencia.ts

lib/tax/expert-prompt.ts
components/tributario/cnae-search-picker.tsx

__tests__/tax-cnae-search-aliases.test.ts  (22 tests)
__tests__/tax-knowledge-base.test.ts       (49 tests)
__tests__/tax-expert-prompt.test.ts        (18 tests)
```

## Arquivos modificados

- `lib/tax/expertise/types.ts` — CNAEEntry +aliases +icon
- `lib/tax/expertise/restaurantes.ts` — 8 CNAEs com ícone + aliases
- `lib/tax/expertise/academias.ts` — 5 CNAEs com ícone + aliases
- `lib/tax/expertise/comercio-roupa.ts` — 6 CNAEs com ícone + aliases
- `lib/tax/expertise/index.ts` — searchCNAEs(query, limit, ramo) + countCNAEsByRamo + RAMO_ICONS
- `app/api/cnae/search/route.ts` — suporta ?ramo, retorna icon + aliases + countByRamo
- `app/(dashboard)/tributario/perfil/page.tsx` — usa CNAESearchPicker em vez do autocomplete antigo
- `__tests__/tax-expertise-catalog.test.ts` — 1 test atualizado (aliases mudam semântica de "restaurante" pra "ramo RESTAURANTE")

## Smoke test pra Yussef

1. `/tributario/perfil` (qualquer empresa):
   - Ver **3 chips visíveis**: 🍔 Restaurantes (8) · 💪 Academias (5) · 🛒 Comércio (6)
   - Digitar "restau" → ver 8 cards de restaurantes
   - Clicar chip 🍔 Restaurantes → filtra
   - Digitar "smart fit" → ver Academia
   - Digitar "renner" → ver Vestuário
   - Digitar "pizza" → ver Pizzaria
   - Clicar num card → fica selecionado (ring azul + check)
   - Salvar → CNAE persistido
2. Voltar pra `/tributario/perfil` → CNAE pré-selecionado aparece no card resumo
3. Clicar "Ver análise expert →" → vai pra `/tributario/expertise` com CNAE pré-populado

## Próximo

**Sprint 5.0.2.d** — Claude Analyzing Real:
- Endpoint `/api/tax/ai-analysis` chama Claude Haiku
- System prompt = `TAX_EXPERT_SYSTEM_PROMPT` + `getKnowledgeFor(topic)` relevante
- User message = perfil empresa + 50-100 transações relevantes do mês
- Resposta estruturada (CONTEXTO/ANÁLISE/OPORTUNIDADES/RESUMO/PRÓXIMOS PASSOS/DISCLAIMER)
- Cache 24h por (empresaId, perfilHash)
- UI: nova aba em `/tributario/expertise` "Análise IA" com botão "Atualizar análise"
