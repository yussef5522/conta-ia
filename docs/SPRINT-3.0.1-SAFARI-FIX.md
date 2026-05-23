# Sprint 3.0.1 — Safari ITP Cookie Bug Fix

**Status:** PLANEJADO (não iniciado)
**Prioridade:** MÉDIA
**Criado em:** 2026-05-22 (sessão D21)
**Estimativa:** ~1h código + 30min teste

---

## Problema observado

Tela `/empresas/[id]/pendentes` tem bug intermitente: ao clicar **X (Ignorar)** numa transação, o request `PUT /api/transacoes/[id] { status: 'IGNORED' }` falha silenciosamente em alguns casos. O front faz `setTransacoes(prev => prev.filter(...))` otimista — tx some da tela LOCAL. Após reload, ela **reaparece pendente** porque o UPDATE NÃO chegou ao DB.

Reproduzido em sessão real: das ~30 tentativas de Yussef de ignorar tx "DEP DINHEIRO ATM" via UI Safari, 25 chegaram ao DB e 5 falharam silenciosamente (zero audit log).

## Diagnóstico

Causa raiz mais provável: **Safari ITP (Intelligent Tracking Prevention) bloqueia cookie `auth_token` em sessões longas**, especialmente após inatividade ou navegação cross-tab. Quando isso ocorre:

1. Browser dispara `PUT /api/transacoes/[id]` SEM cookie
2. `proxy.ts` middleware detecta falta de token → redirect `307 Location: /login`
3. fetch JS (`redirect: 'follow'` default) tenta seguir como PUT — recebe `405 Method Not Allowed`
4. `res.ok === false` → mostra toast (Yussef pode não notar)
5. Filter local NÃO roda porque `res.ok` é false (ok aqui)
6. **Mas**: dá pra Yussef ter perdido o toast OU em alguns navegadores o redirect se comporta diferente

Investigação completa em comentários do D21.

## Solução proposta (~1h)

### 1. `credentials: 'include'` explícito no fetch

```typescript
// app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx
const res = await fetch(`/api/transacoes/${transacaoId}`, {
  method: 'PUT',
  credentials: 'include', // ← força envio de cookies cross-context Safari
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'IGNORED' }),
})
```

### 2. Confirmar status no DB antes de remover do array local

```typescript
if (res.ok) {
  // Anti-otimismo: confirma no servidor
  const check = await fetch(`/api/transacoes/${transacaoId}`, {
    credentials: 'include',
  })
  const data = await check.json()
  if (data?.transacao?.status === 'IGNORED') {
    setTransacoes(prev => prev.filter(t => t.id !== transacaoId))
    toast({ title: 'Transação ignorada' })
  } else {
    toast({
      variant: 'destructive',
      title: 'Falha ao ignorar',
      description: 'Sessão pode ter expirado. Recarregue a página.'
    })
  }
}
```

### 3. Banner persistente quando há falhas (não só toast)

Componente novo: `<FailedActionsBanner />` no topo da `/pendentes` que mostra contador de falhas e botão "Tentar novamente todas". Toasts somem rápido, banners ficam.

### 4. Detecção de 307 → forçar re-login

```typescript
// proxy.ts ou middleware
if (pathname.startsWith('/api/') && !token) {
  // Em vez de 307 pra /login, retornar 401 JSON
  return NextResponse.json({ erro: 'Sessão expirada' }, { status: 401 })
}
```

Front detecta 401 → mostra modal "Sessão expirada, fazer login de novo" → recarrega session.

### 5. Aplicar mesmo padrão em todos os botões de mutation da UI

`/empresas/[id]/transferencias` (deletar par), `/empresas/[id]/fornecedores` (deletar), `/empresas/[id]/regras` (pause/resume), etc. Provavelmente mesmo problema em todos.

## Workaround atual (D20.1)

Pra resolver caso imediato Cacula Mix, executei via script direto no DB:
`scripts/d21-acao1-ignore-atm.ts` ignora as 5 DEP DINHEIRO ATM pendentes com audit `metadata.batch = 'D20.1 — Safari workaround'`.

Esse workaround NÃO é solução — é correção pontual. Bug volta na próxima sessão Safari.

## Impacto

- **Dado:** ✅ íntegro (zero corrupção, zero duplicata)
- **UX:** 🟡 frustrante (user tenta várias vezes pra mesma ação)
- **Confiança:** 🔴 erode confiança no produto ("não consigo nem deletar")

## Quando executar

Idealmente: **antes** de divulgar pro beta. Bug intermitente piora com mais usuários (mais Safari/Chrome em sessões longas).

Realisticamente: **Sprint 3.1** (junto com `lib/auth.ts` consolidation + Anthropic SDK + cache rehydration).

## Referências
- Investigação completa: sessão Claude Code 22/05/2026
- Audit log filtros: `metadata.batch = 'D20.1 — Safari workaround'`
- Discussão técnica: D21 em `docs/DECISOES.md`
