# Sprint PF Fatia 3.5 — PDF Vision: COMO LIGAR EM PRODUÇÃO

> Estado atual: **DESLIGADO em produção** (gate fechado por env vars).
> Código está deployado e testado, mas bloqueia chamadas reais até
> o Yussef confirmar ZDR (Zero Data Retention) com a Anthropic.

---

## Por que está gated?

PDFs de fatura contêm dados sensíveis: nome do titular, número do
cartão (mesmo mascarado), CPF parcial, endereço, lista de compras.
Mesmo que a Anthropic prometa não treinar nos dados de API por padrão,
**ZDR é o nível adicional** que garante zero retenção (zero log, zero
cache server-side, processamento ephemeral).

A decisão arquitetural foi: **liberar OFX (já em produção) imediatamente
e PDF só após ZDR assinado**, porque OFX vem direto do banco em formato
estruturado (menos PII além do necessário) e PDF é a fatura completa.

---

## Checklist pra ligar (3 passos)

### 1. Solicitar ZDR à Anthropic

**Caminho A — você já tem account rep / TAM:**
- Manda mensagem direta pedindo "Zero Data Retention agreement"
- Confirma elegibilidade pra **PDF Vision** (é coberto)

**Caminho B — sem account rep:**
- Formulário sales: <https://claude.com/contact-sales>
- Texto sugerido:
  > Hi, I'd like to request a Zero Data Retention agreement for our
  > organization, with PDF Vision input eligibility confirmed. We're
  > processing Brazilian credit card invoices for SMB financial
  > management and need to ensure zero server-side retention of
  > customer-provided PDF content.

**SLA típico:** 1-2 semanas pra assinatura.

### 2. Assinar contrato + atualizar env Anthropic Console

- Receberá addendum de DPA específico de ZDR pra assinar
- **NÃO há header HTTP** que retorne "ZDR=true" — verificação é via contrato
- Em algumas integrações a Anthropic ativa ZDR no nível de **organização inteira**,
  em outras pode ser opt-in por endpoint. Confirma com eles qual aplica
  ao nosso uso de PDF Vision

### 3. Trocar as 2 flags em produção

SSH em `198.211.103.10` (CAIXAOS):

```bash
cd /opt/conta-ia
# Editar .env
sed -i 's/^PDF_IMPORT_ENABLED=false/PDF_IMPORT_ENABLED=true/' .env
sed -i 's/^PDF_IMPORT_ZDR_CONFIRMED=false/PDF_IMPORT_ZDR_CONFIRMED=true/' .env

# Confirmar
grep -E '^PDF_IMPORT' .env
# DEVE mostrar:
#   PDF_IMPORT_ENABLED=true
#   PDF_IMPORT_ZDR_CONFIRMED=true

# Reload pra picking up env vars
pm2 reload conta-ia --update-env

# Smoke test (precisa estar logado, cookie via curl ou DevTools)
curl -s -b "auth_token=<seu-cookie>" \
  http://localhost:3001/api/perfis/<seu-profile-id>/pdf-import/status
# DEVE retornar: {"allowed":true,"reason":null}
```

A partir desse momento, a UI mostra o botão "Importar PDF" no `/perfis/[id]/importar`
e os endpoints `/preview` e `/confirm` aceitam PDFs reais.

---

## Como DESLIGAR de volta (kill switch)

Se precisar desligar emergencialmente (ex: cobrança Anthropic
inesperada, bug de extração, problema de PII):

```bash
cd /opt/conta-ia
sed -i 's/^PDF_IMPORT_ENABLED=true/PDF_IMPORT_ENABLED=false/' .env
pm2 reload conta-ia --update-env
```

Endpoints voltam a retornar 403. Caches existentes ficam no banco mas
não são consultáveis via UI (também voltam a 403).

---

## O que está em produção AGORA

| Componente | Estado |
|---|---|
| Schema (4 cols em `personal_ofx_imports` + tabela `personal_pdf_extract_cache`) | ✅ Migrada |
| Lib `lib/pdf-import/*` (extract/cache/queries/validate/feature-flag) | ✅ Deployada |
| 5 templates de banco + genérico | ✅ Deployados |
| 5 endpoints REST | ✅ Deployados (403 enquanto fechado) |
| UI `/perfis/[id]/importar` aceita `.pdf` | ✅ (escondido até `status` retornar `allowed:true`) |
| Testes 77/77 passando | ✅ |
| **Gate de produção** | 🔒 **FECHADO** (PDF_IMPORT_ENABLED=false) |

---

## Custo esperado quando ligar

- **Modelo:** Claude Sonnet 4.6 Vision
- **Cache TTL:** 7 dias (mesmo PDF não re-extrai)
- **Estimativa por fatura nova (Nubank ~6 páginas):**
  - Input: ~3.500 tokens (instrução + PDF)
  - Output: ~1.500 tokens (JSON com 20-40 transações)
  - Custo: ~$0.035 USD = **~R$ 0,18 por fatura nova**
  - Re-import (mesmo SHA256): R$ 0,00 (cache hit por 7d)

- **Pra 10 academias × 4 cartões × 1 import/mês:** 40 extrações = ~R$ 7,20/mês

Comparativo OFX: R$ 0,002/categorização Haiku (50x mais barato). Por isso
recomendamos OFX como default e PDF só pra bancos que não exportam OFX.

---

## Onde investigar se algo falhar quando ligar

| Sintoma | Diagnóstico | Comando |
|---|---|---|
| Status retorna `allowed:false` após mudar env | pm2 não pegou novo env | `pm2 reload conta-ia --update-env && pm2 env 0 \| grep PDF_IMPORT` |
| Preview retorna 500 | Claude API key inválida ou ANTHROPIC_API_KEY ausente | `grep ANTHROPIC .env` |
| Preview retorna 502 CLAUDE_API_ERROR | Quota esgotada ou modelo indisponível | Anthropic console → usage |
| Preview retorna 413 PDF_TOO_LARGE | PDF maior que 5MB | Diminuir resolução do scan |
| Preview retorna IS_PHOTO_REJECTED | Quality detectada como MOBILE_PHOTO | Pedir PDF original do banco, não foto |
| Cache não tá sendo aproveitado | SHA256 calculado errado ou cache expirado (>7d) | `SELECT * FROM personal_pdf_extract_cache WHERE "ownerUserId"='<user-id>' ORDER BY "createdAt" DESC LIMIT 5` |

---

**Data do deploy gated:** 03/06/2026 (commit `0fa18ba`, branch main).
