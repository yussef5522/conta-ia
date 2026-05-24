# Sprint 4.0.5.a — UX Refundação: TopBar + WorkspaceSwitcher + remove sidebar dupla

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1870 → **1879 (+9 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully

## Escopo (sub-sprint A — base estrutural)

Primeira de **3 sub-sprints** planejadas (a/b/c) pra UX nível Linear/Stripe/Notion.
Esta entrega o **mínimo viável visual** sem migrar rotas:

1. **EmpresaContext** (React Context puro, sem Zustand)
2. **TopBar** sticky 56px com **WorkspaceSwitcher** + **UserMenu**
3. **Remove sidebar dupla** (`ContextualSidebar` fora do `dashboard-shell`)
4. **EmpresaSubNav** horizontal (tabs) substituindo sidebar secundária em `/empresas/[id]/*`
5. **Cor brand**: troca azul Conta IA (HSL 221/83/53) → indigo-500 (HSL 239/84/67)
6. **GlobalSidebar reorganizada** em 5 seções (Financeiro / Cadastros / Inteligência / Sistema / Em breve)

### Próximas (4.0.5.b e .c)

- **4.0.5.b** (~12h): migrar rotas `/empresas/[id]/dre → /dre`, etc — refactor pesado com redirects 308 das URLs antigas
- **4.0.5.c** (~5h): polish mobile completo, micro-animations, skeleton screens, Cmd+K

## Decisões arquiteturais

### 1. React Context puro (não Zustand)

`lib/contexts/empresa-context.tsx` — ~120 linhas. Zero deps novas. Persistência
manual via `localStorage.setItem(STORAGE_KEY, id)`. Compat com Server Components
(Provider envolto pelo `DashboardShell`).

### 2. Hierarquia de resolução do `currentEmpresaId`

```
1. /empresas/<id>/* no path     → URL ganha (deep link)
2. ?empresaId= na query         → URL ganha (legado Sprint 4.0.1+)
3. localStorage                  → último selecionado pelo user
4. 1ª empresa do user           → fallback se nada definido
```

Sincroniza automaticamente quando user navega. Se ID na URL não está na lista
de empresas do user, descarta e usa fallback.

### 3. Mantém rotas atuais (sub-sprint A não migra)

Path `/empresas/[id]/dre`, `/empresas/[id]/contas`, etc CONTINUAM funcionando.
Decisão pra reduzir risco de regressão. Layout compartilhado adicionado em
`app/(dashboard)/empresas/[id]/layout.tsx` injeta `<EmpresaSubNav>` em toda
página filha sem mexer em cada `page.tsx`.

### 4. Cor brand: indigo-500

`app/globals.css` `--primary` atualizada:
```css
/* Antes: --primary: 221 83% 53%; (azul Conta IA) */
--primary: 239 84% 67%;  /* indigo-500 */
--ring:    239 84% 67%;
```

### 5. WorkspaceSwitcher (Linear/Vercel)

- Avatar quadrado com iniciais
- Dropdown 300px com search inline, Atual + Outras Empresas
- Criar nova + Gerenciar
- Click → setCurrentEmpresa (sem redirect, só muda contexto)

### 6. EmpresaSubNav substitui ContextualSidebar

Tabs horizontais com border-bottom no active:
```
[Visão Geral] [Contas Bancárias] [DRE] [Categorias] [Regras IA] [Fornecedores]
[Histórico OFX] [Transferências] [Usuários] [Permissões] [Auditoria]
```

## Arquivos criados/modificados

### Novos (7)
- `lib/contexts/empresa-context.tsx`
- `components/layout/top-bar.tsx`
- `components/layout/workspace-switcher.tsx`
- `components/layout/user-menu.tsx`
- `components/layout/empresa-subnav.tsx`
- `app/(dashboard)/empresas/[id]/layout.tsx` (injeta SubNav)
- `__tests__/empresa-context-path-regex.test.ts` (9 tests)

### Modificados (3)
- `app/globals.css` (--primary indigo)
- `components/layout/dashboard-shell.tsx` (TopBar, EmpresaProvider, remove ContextualSidebar)
- `components/sidebar/global-sidebar.tsx` (seções, usa EmpresaContext, remove footer user)

### Mantidos (não removidos ainda)
- `components/sidebar/contextual-sidebar.tsx` (sem import; deletar em 4.0.5.b)

## Testes

9 novos testes da regex `PATH_EMPRESA_RE`:
- Extrai id de `/empresas/<id>`, `/empresas/<id>/dre`, `/empresas/<id>/contas/<contaId>`
- NÃO bate em `/empresas` (lista), `/empresas/nova`, `/dashboard`, `/contas-a-pagar`
- Case-insensitive (CUID upper)
- Rejeita ids curtos (<20 chars)

Suite: 1870 → **1879 (+9, sem regressões)**.

## Métricas

```
Antes (Sprint 4.0.4):  1870 testes
Depois (4.0.5.a):      1879 testes (+9)

Tempo planejado:  ~3h
Tempo real:       ~1h

TS strict: 0 erros
Build:     ✓ Compiled in 2.9s
Dev local: HTTP 200 confirmado
```

## Smoke test pós-deploy

1. `/dashboard` mostra **TopBar nova** com workspace switcher
2. Click no nome da empresa no TopBar → dropdown com search + lista
3. Sidebar única (sem 2ª) em `/empresas/[id]/dre` etc
4. **Tabs horizontais** no header das páginas de empresa
5. Click no avatar (canto sup. direito) → menu com Alertas + Sair
6. Cor primary trocada pra indigo (badges, KPI cards primary)
7. Cmd+Shift+R pra forçar refresh CSS

## Próximo

**4.0.5.b** (próxima sessão):
- Migrar rotas `/empresas/[id]/<seção>` → `/<seção>` global
- Redirects 308 das URLs antigas pras novas (preserva bookmarks)
- Atualizar links internos (~100 ocorrências)
- Deletar `ContextualSidebar` legado

**4.0.5.c**:
- Mobile drawer animations
- Skeleton screens consistentes
- Micro-animations (toast slide-in, dropdown fade-in)
- Cmd+K (search global)
