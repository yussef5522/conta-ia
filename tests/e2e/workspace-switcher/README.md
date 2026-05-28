# E2E specs — WorkspaceSwitcher (Sprint 5.0.3.3)

⚠️ **NÃO RODADO no sandbox do Claude Code** (sem `npm run dev` em background +
sem credenciais de teste configuradas). Specs criados como **template** pra
Yussef rodar localmente.

## Pré-requisitos pra rodar

```bash
# 1. Instalar Playwright (uma vez)
npm install -D @playwright/test
npx playwright install chromium webkit

# 2. Subir dev server em background
npm run dev  # porta 3000 default

# 3. Configurar credenciais em .env.test
echo "E2E_BASE_URL=http://localhost:3000" >> .env.test
echo "E2E_USER_EMAIL=admin@contaia.com.br" >> .env.test
echo "E2E_USER_PASSWORD=ContaIA@2025" >> .env.test

# 4. Rodar
npx playwright test tests/e2e/workspace-switcher
```

## Cenários cobertos (esboço)

1. **Dashboard troca empresa atualiza cards INSTANTANEAMENTE**
   - Login → /dashboard → empresa A no header
   - Click switcher topo → empresa B
   - Esperar header mudar pra B + cards do dashboard mudarem
   - NÃO requer refresh manual

2. **Contas a pagar troca empresa atualiza lista INSTANT**
   - Login → /contas-a-pagar → 94 contas (Cacula)
   - Click switcher → Profit
   - URL `?empresaId=` muda + lista atualiza pra contas da Profit
   - NÃO requer sair e voltar

3. **Voltar empresa funciona (multi-tenant bidirecional)**
   - Trocar A → B → A
   - Estado da empresa A volta consistente

4. **Trocar empresa preserva rota atual**
   - Estou em /contas-a-pagar (Cacula)
   - Troca empresa → ainda em /contas-a-pagar (Profit), não vai pra /dashboard

5. **Race condition fix** (NOVO Sprint 5.0.3.3)
   - Cookie atualiza ANTES de navigate (sem flicker)
   - Dashboard SSR lê empresa correta no primeiro render

## Limitação honesta

Specs incluem `test.skip(true)` por default pra evitar falhar em CI sem ambiente.
Yussef pode flipar pra `test()` ao rodar local.
