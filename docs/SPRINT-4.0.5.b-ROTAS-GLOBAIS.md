# Sprint 4.0.5.b — UX Refundação: Rotas Globais + Cookie de Empresa Atual

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1879 (sem mudança — sem testes novos nesse sprint estrutural)
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully in 3.2s

## Escopo

Segunda de 3 sub-sprints UX. Migra **9 rotas globais** com cookie httpOnly +
redirects 308 das antigas pras novas.

## Decisões arquiteturais

### Cookie `current_empresa_id` (httpOnly)

`lib/auth/current-empresa-cookie.ts`:
- httpOnly, sameSite=lax, secure conforme COOKIE_SECURE env
- maxAge 90 dias
- POST `/api/empresas/atual` valida acesso via UserCompanyRole antes de setar
- EmpresaContext faz fetch automático ao chamar setCurrentEmpresa(id)

### Helper `resolveEmpresaAccess()` server-side

`lib/auth/resolve-empresa-access.ts` centraliza:
- Auth check (verifyToken)
- Lê cookie current_empresa_id
- Multi-tenant guard via UserCompanyRole
- Permission check opcional

Retorna union: `'ok' | 'no-empresa-selected' | 'no-access' | 'forbidden'`.

### 9 server pages globais reusam Client existente

Cada ~30 linhas. Reusa componente Client em `/empresas/[id]/<seção>/<seção>-client.tsx`.
Fetch de dados copiado/adaptado pra usar `access.empresaId` do cookie.

### Redirects 308 das antigas

Cada `/empresas/[id]/<seção>/page.tsx` virou:
```tsx
const { id } = await params
await setCurrentEmpresaCookie(id)
redirect('/<seção>')
```

Preserva 100% dos bookmarks. URL antiga → cookie atualizado + redirect.

### 2 client shims (transferencias, contas)

`/transferencias/page.tsx` e `/contas-bancarias/page.tsx` já existiam globais
ou ganharam shim client que faz `router.replace('/empresas/<id>/<seção>')`.
Refactor full pra global puro adiado pra 4.0.5.c.

### Componentes deletados

- `components/layout/empresa-subnav.tsx`
- `components/sidebar/contextual-sidebar.tsx`

## Arquivos

### Novos (16)
- `lib/auth/current-empresa-cookie.ts`
- `lib/auth/resolve-empresa-access.ts`
- `app/api/empresas/atual/route.ts`
- `components/empresa/empty-empresa-state.tsx`
- 9 pages globais (`dre`, `fornecedores`, `categorias`, `regras`, `pendentes`, `imports`, `auditoria`, `permissoes`, `usuarios`)
- `app/(dashboard)/transferencias/page.tsx` (shim)
- `docs/SPRINT-4.0.5.b-ROTAS-GLOBAIS.md`

### Modificados
- `lib/contexts/empresa-context.tsx` (sincroniza cookie)
- `components/sidebar/global-sidebar.tsx` (rotas globais)
- `app/(dashboard)/empresas/[id]/layout.tsx` (pass-through)
- 9 `app/(dashboard)/empresas/[id]/<seção>/page.tsx` (redirects 308)
- 3 dashboard components (links globais)

### Removidos
- `components/layout/empresa-subnav.tsx`
- `components/sidebar/contextual-sidebar.tsx`

## Métricas

```
Antes: 1879 testes
Depois: 1879 testes

Tempo planejado: ~4h
Tempo real: ~2h

TS strict: 0 erros
Build: ✓ Compiled in 3.2s
```

## Smoke test

1. Sidebar mostra URLs curtas (`/dre`, `/categorias`, etc)
2. Click em qualquer item → URL limpa no browser
3. Bookmark antigo `/empresas/<id>/dre` → redirect transparente pra `/dre`
4. TopBar troca empresa → cookie atualizado → `/dre` reflete nova empresa
5. Sem empresa no cookie → `NoEmpresaSelectedState`

## Próximo (4.0.5.c)

- Refactor /transferencias e /contas-bancarias pra rotas globais puras
- `/empresas/[id]` redesign sem tabs (cards inline)
- Mobile drawer animations + skeleton + Cmd+K
