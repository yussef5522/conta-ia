# Sprint Pagamento Asaas — FATIA 3A (Fundação + Sandbox)

**Branch:** `feature/asaas-3a-fundacao`
**Data:** 31/05/2026
**Status:** ⏳ aguardando aprovação do Yussef

---

## 1. Decisão técnica: **`fetch` direto (sem SDK)**

### Pesquisa rápida das opções no npm:

| Opção | Última atualização | Maintenance | TS support | Veredito |
|---|---|---|---|---|
| `asaas` (oficial-ish) | ~1 ano atrás (v1.1.0) | ❌ paralisado | parcial | **DESCARTADO** |
| `asaas-kit` | Set/2025 | 1 maintainer | sim | risco médio |
| `asaas-node-sdk` (davevilela) | unofficial | hobby project | sim | risco médio |
| `asaas-js-sdk` (migtibincoski) | unofficial | hobby project | sim | risco médio |

### Recomendação: **`fetch` próprio (lib/asaas/*)**

**Por quê:**

1. **API REST simples** — pra 3A precisamos só `GET /myAccount/status` + `POST /customers` + `GET /customers/:id`. ~50 linhas de código.
2. **Zero risco de supply-chain** — SDKs unofficial são ponto de entrada conhecido pra ataques (credentials stealing, account takeover). Pagamento exige paranóia máxima.
3. **Controle TOTAL sobre logs** — CRÍTICO pra security. Wrapper próprio garante que a chave **NUNCA** aparece em `console.log`, error stacks, ou audit. SDKs externos podem logar tudo em DEBUG mode (ou em uma versão futura).
4. **Padrão do projeto** — `lib/coupons/`, `lib/ai-categorizer/claude-client.ts`, `lib/admin-clientes/` são todos fetch direto. Coerente.
5. **TS strict melhor** — tipagens próprias = zero `any` herdado, sem coalescer com tipos de terceiros estranhos.
6. **Sem deps adicionais** — instala 0 pacotes novos = 0 vetores extras de breaking change.

**Risco assumido:** quando Asaas mudar a API (breaking change), precisamos atualizar nosso wrapper. Mitigação: versão `v3` da API é estável + endpoints que vamos usar são os mais maduros (customers/subscriptions).

---

## 2. Asaas URLs + Auth (confirmado via docs oficial)

### URLs (corrigidas vs sugestão inicial do prompt!)
| Env | URL Base |
|---|---|
| **Sandbox** | `https://api-sandbox.asaas.com/v3` ⚠️ (NÃO `sandbox.asaas.com/api/v3` — prompt original estava errado) |
| **Production** | `https://api.asaas.com/v3` |

### Headers de auth
- Header: **`access_token: <chave>`** (NÃO `Authorization: Bearer ...`)
- Webhooks recebem: `asaas-access-token: <secret>` (3C)

### Exemplo curl
```bash
curl -H "access_token: <YOUR_KEY>" https://api-sandbox.asaas.com/v3/myAccount/status
```

Fonte: [docs.asaas.com/docs/authentication](https://docs.asaas.com/docs/authentication)

---

## 3. Estrutura proposta — `lib/asaas/`

```
lib/asaas/
├── config.ts                 — lê ASAAS_ENV + ASAAS_API_KEY, monta baseUrl
├── client.ts                 — request<T>(path, opts): autenticada + tratamento erro
├── errors.ts                 — AsaasApiError, AsaasConfigError
├── customers.ts              — createCustomer / getCustomer / createOrGetCustomerForUser
├── health.ts                 — checkConnection() pra endpoint de teste
└── types.ts                  — AsaasCustomer, AsaasError, AsaasEnv

app/api/admin/asaas/health/
└── route.ts                  — GET (OWNER only) → { connected, env, accountStatus }
```

### Decisões importantes do wrapper

**3.1 Resolução de env vars (`config.ts`):**
```ts
// Lança AsaasConfigError com mensagem clara se faltar config
function loadAsaasConfig(): { apiKey: string; baseUrl: string; env: AsaasEnv } {
  const key = process.env.ASAAS_API_KEY
  const env = (process.env.ASAAS_ENV ?? 'sandbox') as AsaasEnv
  if (!key) throw new AsaasConfigError('ASAAS_API_KEY não configurada')
  if (env !== 'sandbox' && env !== 'production') {
    throw new AsaasConfigError(`ASAAS_ENV inválido: ${env}`)
  }
  const baseUrl =
    env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3'
  return { apiKey: key, baseUrl, env }
}
```
- Default `sandbox` (defensivo: se esquecer de setar, NÃO toca em produção)
- Em produção, deploy só seta `ASAAS_ENV=production` quando Yussef escolher

**3.2 Sanitização de logs (`client.ts`):**
- `console.error` SEM o `access_token` (nunca passa o header pra log)
- `AsaasApiError` recebe SÓ statusCode + body do Asaas (que já é sanitizado pelo deles)
- Testes específicos garantem que a chave nunca aparece em logs/throws

**3.3 Vinculação `User ↔ Asaas Customer`:**
- `Subscription.gatewayCustomerId` (já existe) guarda o ID retornado pelo Asaas
- `externalReference` no Asaas = `userId` do nosso DB → dedup secundária
- `createOrGetCustomerForUser(userId)`:
  1. Lê `Subscription.gatewayCustomerId`. Se preenchido → retorna ele (idempotente).
  2. Senão, chama `POST /customers` com `{ name, email, cpfCnpj, externalReference: userId }`.
  3. Salva `Subscription.gatewayCustomerId` com o ID retornado.

**3.4 `cpfCnpj` (campo obrigatório do Asaas):**
- O `User` model NÃO tem `cpfCnpj` hoje.
- **Decisão 3A:** wrapper aceita `cpfCnpj` como argumento explícito. Endpoint de health NÃO precisa criar customer (usa `/myAccount/status`).
- **3B vai pedir** `cpfCnpj` no checkout (form com máscara) — quando usuário clicar "Assinar" pela primeira vez.

---

## 4. Endpoint de health check (3A)

```
GET /api/admin/asaas/health
Auth: Gerenciador OWNER only
Resposta sucesso:
  { connected: true, env: 'sandbox', accountStatus: { ... } }
Resposta falha:
  { connected: false, env: 'sandbox', erro: '...' }
```

- Usa `GET /myAccount/status` da Asaas (confirma chave + chave bate com env)
- NUNCA expõe a chave no response
- Testa **sem criar nada** (idempotente, seguro pra spammar)

---

## 5. `.env.example` — placeholder

Adiciono a seção:
```
# ---------------------
# Asaas (Pagamento) — Fatia 3 (sandbox primeiro)
# ---------------------
# 1. Yussef cria conta sandbox em https://sandbox.asaas.com
# 2. Gera chave API em Integrações > API Key
# 3. Cola aqui:
# ASAAS_API_KEY=""
# ASAAS_ENV="sandbox"   # 'sandbox' | 'production' (DEFAULT sandbox — defesa)
#
# IMPORTANTE: a chave NUNCA sobe pro git. Esta linha é só placeholder.
# Em produção, configura via /opt/conta-ia/.env diretamente (não commitar).
```

---

## 6. Testes (alvo +12)

```ts
describe('lib/asaas/config', () => {
  test('ASAAS_ENV=sandbox → URL sandbox')
  test('ASAAS_ENV=production → URL produção')
  test('ASAAS_ENV ausente → default sandbox (defensivo)')
  test('ASAAS_ENV inválido → AsaasConfigError com mensagem clara')
  test('ASAAS_API_KEY ausente → AsaasConfigError')
})

describe('lib/asaas/client', () => {
  test('inclui header access_token na request', () => {
    // mock fetch + assert headers
  })
  test('NUNCA loga API key (snapshot dos logs durante erro)', () => {
    // captura console.error + assert que key não aparece
  })
  test('trata erro estruturado do Asaas (errors[])', () => {})
  test('trata timeout sem expor key', () => {})
})

describe('lib/asaas/customers', () => {
  test('createOrGetCustomerForUser idempotente quando gatewayCustomerId existe', () => {})
  test('cria customer novo + salva gatewayCustomerId', () => {})
  test('passa externalReference=userId pra dedup secundária', () => {})
})

describe('GET /api/admin/asaas/health', () => {
  test('OWNER bate OK → connected=true + accountStatus', () => {})
  test('OPERADOR → 403 (só OWNER acessa endpoint de credencial)', () => {})
  test('chave inválida → connected=false sem expor a chave', () => {})
})
```

**Mocking:** `vi.fn()` substitui `global.fetch` em cada teste. Zero chamadas HTTP reais.

---

## 7. Roadmap 3B/3C/3D (pra Yussef ver o caminho)

### 🟦 **3B — Assinatura + Checkout (em sandbox)**
- Modal de seleção do plano na /assinar (substitui placeholder)
- Form pedindo cpfCnpj se user ainda não tem
- `createOrGetCustomerForUser` (já pronto)
- `POST /subscriptions` no Asaas (mensal/anual + Pix/Cartão)
- Salva `gatewaySubscriptionId` no DB
- Subscription.status: TRIAL → ACTIVE quando primeira cobrança paga
- Testes: simular fluxo completo via sandbox real (cartão de teste do Asaas)
- **Tudo SANDBOX** — zero dinheiro real

### 🟨 **3C — Webhook (em sandbox)**
- Endpoint `POST /api/webhooks/asaas` (público — bypass auth)
- Verifica header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN` do .env
- Trata eventos: `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`, etc.
- Atualiza Subscription.status: ACTIVE/PAST_DUE/CANCELED
- Idempotência: dedup via `eventId` do Asaas
- Audit: registra cada evento processado
- **Critical path** — testes E2E com sandbox

### 🟩 **3D — Promoção pra produção**
- Conta produção no Asaas
- Setup do webhook URL no painel Asaas (production)
- Troca `.env` em prod: `ASAAS_API_KEY=<prod>` + `ASAAS_ENV=production`
- pm2 restart
- **Smoke real** com cobrança de R$ 0,01 pra Yussef testar fluxo completo
- Documentação operacional (rollback plan, troubleshooting)

---

## 8. Riscos identificados

| # | Risco | Mitigação |
|---|---|---|
| 1 | **API key vazar em log** | Wrapper centralizado; testes específicos snapshot de logs; nunca logar headers; revisão dupla antes do deploy. |
| 2 | **Chamar produção achando que é sandbox** | Default `ASAAS_ENV=sandbox`; health check retorna o env atual; endpoint admin mostra qual env está vivo. |
| 3 | **Customer duplicado** (Asaas permite) | `gatewayCustomerId` salvo no DB + `externalReference=userId` no Asaas (dedup duplo). |
| 4 | **`cpfCnpj` obrigatório no Asaas** | 3A não cria customer (só health). 3B coleta no checkout. |
| 5 | **Webhook chega antes do retorno do POST** | 3C usa dedup por `eventId` + lookup defensivo de subscription. |
| 6 | **Race no createOrGet** | 1 request por user (Asaas é rate-limited) + uniqueness via `Subscription.userId @unique`. |

---

## 9. Estimativa de esforço (3A apenas)

| Etapa | Esforço |
|---|---|
| `lib/asaas/` (5 arquivos) | 1h |
| Endpoint health + RBAC OWNER | 30min |
| `.env.example` + docs operacionais | 15min |
| Testes ~14 | 1h |
| Build + deploy + smoke (Yussef seta chave + roda health) | 1h |
| **Total** | **~3h45** |

---

## 10. ❓ Checkpoint — confirmar antes da Fase 2

- [ ] **Decisão SDK vs fetch**: ⭐ `fetch` próprio (lib/asaas/)
- [ ] **URLs**: sandbox `https://api-sandbox.asaas.com/v3` + prod `https://api.asaas.com/v3` (corrigido vs sugestão original)
- [ ] **Auth**: header `access_token: <chave>` (não Bearer)
- [ ] **Default `ASAAS_ENV=sandbox`** (defensivo)
- [ ] **Health check**: `GET /myAccount/status` (não cria nada)
- [ ] **Endpoint `/api/admin/asaas/health`** OWNER only
- [ ] **3A não cria customer** (cpfCnpj fica pra 3B no checkout)
- [ ] Roadmap 3B/3C/3D OK

---

## 11. Como Yussef vai colocar a chave (operacional pós-deploy)

⚠️ **A chave NUNCA passa pelo chat / repo / log.** Yussef faz manualmente:

```bash
# 1. Yussef abre sandbox.asaas.com, cria conta (sandbox grátis)
# 2. Vai em Integrações > API Key > Gerar nova
# 3. SSH no servidor de prod
ssh root@198.211.103.10
# 4. Edita o .env (vai pra fim do arquivo)
nano /opt/conta-ia/.env
# Adiciona:
# ASAAS_API_KEY=COLOQUE_A_CHAVE_AQUI
# ASAAS_ENV=sandbox
# Ctrl+O Enter Ctrl+X
# 5. Restart pra app pegar a env
pm2 restart conta-ia
# 6. Verifica (mostra só NOMES das vars, NÃO os valores):
grep -oE '^ASAAS_[A-Z_]+' /opt/conta-ia/.env
# Esperado: ASAAS_API_KEY  +  ASAAS_ENV
# 7. Testa health
curl -H "Cookie: admin_session=<seu-cookie>" https://admin.caixaos.com.br/api/admin/asaas/health
# Esperado: { "connected": true, "env": "sandbox", "accountStatus": {...} }
```

Yussef faz o passo 6/7 sozinho — eu nunca preciso ver a chave.
