# Sprint 5.0.2.g — Knowledge Base Profunda + Tax Expert Agent

**Status:** ✅ CONCLUÍDO em 25/05/2026
**Suite testes:** 2233 → **2295 (+62 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled

## Motivação

Yussef testou em produção e identificou que sistema ainda estava "fraco" — não tinha conhecimento de contador 30 anos. Faltava:
- Combo McDonald's/BK (segregação fiscal real)
- PERSE detalhado com Cadastur
- ICMS-ST por estado mapeado
- Estratégias Smart Fit (holding + royalties 9.5%)
- Renner créditos ~R$ 1bi/ano
- Jurisprudência STF/STJ (Tema 69, 1067, 756, 1093)
- Fator R com matemática completa

## Arquitetura escolhida

Após pesquisa de mercado (Intuit/Avalara/QuickBooks 2026):
- **Knowledge Base PROFUNDA** com truques reais
- **UM Tax Expert Agent** (não múltiplos sub-agents) — mais simples, mesma qualidade
- **RAG + tool_use seletivo** — Claude consulta KB sob demanda via `get_knowledge`

## 10 arquivos KB profunda

`lib/tax/knowledge/deep/`:

| # | Arquivo | Cobertura |
|---|---|---|
| 01 | restaurantes-completo.ts | LC 192/2022, PERSE, combo Mc/BK, ICMS-ST bebidas, PIS/COFINS monofásico, créditos Real, segregação canais, Madero/Outback/Girafas |
| 02 | academias-completo.ts | Fator R (LC 123/06 §5º-J), Smart Fit holding, personal CLT vs PJ, planos anuais, ISS uniprofissional, Reforma 2026 |
| 03 | comercio-roupa-completo.ts | Renner/Riachuelo/C&A, ICMS-ST por UF, DIFAL, NCMs (Cap. 61/62/64), bonificações, sazonalidade |
| 04 | grandes-redes-benchmarks.ts | Mc, BK, Madero, Outback, Smart Fit, Bodytech, Bluefit, Renner, Riachuelo, C&A com estratégias específicas |
| 05 | icms-st-por-estado.ts | Convênio CONFAZ 142/2018, mapa UF |
| 06 | pis-cofins-creditos.ts | Lei 10.637/02 + 10.833/03, RE 1.221.170 STF, exemplos práticos |
| 07 | fator-r-completo.ts | Fórmula + estratégias pró-labore/CLT/segregação + simulação completa |
| 08 | perse-detalhado.ts | Lei 14.148/2021 + 14.859/2024, CNAEs Anexo I/II, Cadastur, exemplo R$ 1.2M economiza R$ 80k/ano |
| 09 | reforma-tributaria.ts | EC 132/2023 + LC 214/2025, cronograma 2026-2033, reduções por setor, decisão setembro/2026 |
| 10 | jurisprudencia-recente.ts | STF Tema 69/1067/1187264/1221170, STJ Tema 756/1093, CARF, Soluções de Consulta COSIT |

**Total: 1.819 linhas de conteúdo concentrado com base legal citada em cada bloco.**

## index.ts expandido

`getKnowledgeFor(topic)` agora aceita 20 tópicos (10 originais + 10 deep):

```typescript
type KnowledgeTopic =
  | 'simples-nacional' | 'lucro-presumido' | 'lucro-real'
  | 'reforma-tributaria' | 'beneficios-fiscais' | 'substituicao-tributaria'
  | 'pis-cofins-monofasico' | 'estados-particularidades' | 'fator-r' | 'jurisprudencia'
  // DEEP (Sprint 5.0.2.g):
  | 'restaurantes-deep' | 'academias-deep' | 'comercio-roupa-deep'
  | 'grandes-redes' | 'icms-st-estados' | 'pis-cofins-creditos'
  | 'fator-r-deep' | 'perse-deep' | 'reforma-tributaria-deep'
  | 'jurisprudencia-deep'
```

## Tool nova: `validate_recommendation`

`lib/tax/ai-analysis/tools.ts`:

```typescript
validate_recommendation({
  regime, receitaBrutaMes, rbaAcumulada12m?, cnaeCode?,
  hasSocioPJ?, hasDebitos?
}) → {
  aplicavel: boolean,
  motivoNaoAplicavel?: string,
  baseLegal?: string,
  rbaProjecada: number
}
```

Claude DEVE chamar antes de recomendar regime — evita sugerir Simples acima de R$ 4.8M.

## get_knowledge expandido

Enum do `topic` agora tem 20 valores. Description ressalta:
> "Tópicos DEEP (Sprint 5.0.2.g) trazem truques reais e benchmark de grandes redes — use restaurantes-deep / academias-deep / comercio-roupa-deep / grandes-redes / icms-st-estados / pis-cofins-creditos / fator-r-deep / perse-deep / reforma-tributaria-deep / jurisprudencia-deep."

## Expert prompt atualizado

Nova seção **"KNOWLEDGE BASE PROFUNDA (Sprint 5.0.2.g)"** lista os 10 tópicos deep com descrição do que cobrem.

**Regra crítica #4** adicionada:
> SEMPRE comparar com grandes redes do mesmo ramo. McDonald's emite NF discriminada (combo segregado). Smart Fit mantém Fator R alto com folha CLT pesada. Renner credita ~R$ 1bi/ano PIS/COFINS sobre estoque.

**Regra crítica #5** adicionada:
> SEMPRE citar jurisprudência relevante. Tema 69 STF (recuperar 5 anos), Tema 1067 (ISS na base PIS/COFINS), Tema 756 STJ (frete venda gera crédito), RE 1.221.170 (insumo essencial ou relevante).

## Testes (62 novos)

- **45 KB deep** (validar estrutura dos 10 arquivos + getKnowledgeFor novos tópicos + KNOWLEDGE_TOPICS lista 20)
- **17 tool validate** (5 tools total, 20 topics enum, Simples > 4.8M bloqueia, CNAEs vedados, hasSocioPJ/hasDebitos, Real sempre aplicável, deep topics retornam conteúdo)
- **3 atualizações** em testes antigos (4→5 tools, 10→20 topics)

## Métricas

| | Antes | Depois |
|---|---|---|
| Tools registradas | 4 | **5** |
| Tópicos getKnowledgeFor | 10 | **20** |
| Linhas KB total | ~2.100 | **~3.900** (1.819 deep + 2.100 original) |
| Tests | 2233 | **2295 (+62)** |

## Smoke test pra Yussef

1. **`/tributario?tab=analise` → Análise IA → "Analisar agora"**
2. **Esperado** (análise profunda):
   - Cita leis específicas: LC 192/2022 (Restaurantes Anexo I), Lei 14.148/2021 (PERSE), Lei 10.637/02 + 10.833/03 (créditos), RE 1.221.170 (insumo essencial)
   - Compara com grande rede do ramo: "McDonald's emite NF discriminada por item — sua empresa pode adotar"
   - Inclui créditos PIS/COFINS no Lucro Real quando aplicável
   - **BLOQUEIA Simples se receita anual > R$ 4,8M** com baseLegal LC 123/2006 art. 3º, II
   - Jurisprudência citada quando faz sentido (recuperar 5 anos via Tema 69)

## Próximo

**Sprint 5.0.3** — IA Agent conversacional (chat usando essa KB).
**Sprint 5.0.4** — Reforma Tributária UI dedicada.
**Sprint 5.0.5** — Folha de pagamento + apuração trimestral.
