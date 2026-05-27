# Tests Fixtures

Arquivos de teste end-to-end. **NÃO comitamos planilhas reais** —
elas contêm dados sensíveis (favorecidos PF, valores efetivos da empresa).

## Fixtures esperadas (não no git, copiar local)

| Arquivo | Origem | Linhas | Total | Sprint |
|---|---|---|---|---|
| `cacula-marco-2026.xlsx` | Cacula Mix, março/2026 | 94 + 1 subtotal | R$ 182.396,54 | 5.0.2.3 |

## Como obter pra rodar testes E2E localmente

1. Pedir pro Yussef enviar a planilha (privada)
2. Copiar pra `tests/fixtures/<nome>.xlsx`
3. Rodar `npx playwright test` (quando setup pronto)

## CI

Os testes E2E que dependem desses arquivos **devem ser skipados em CI**
se a fixture não existe. Padrão:

```typescript
import { existsSync } from 'fs'
const FIXTURE = 'tests/fixtures/cacula-marco-2026.xlsx'
test.skip(!existsSync(FIXTURE), 'Fixture privada não disponível em CI')
```
