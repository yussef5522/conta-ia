# Sprint 4.0.5.c — Mobile Polish + PWA Installable

**Status:** ✅ CONCLUÍDO em 24/05/2026
**Suite testes:** 1879 → **1887 (+8 testes)** sem regressões
**TypeScript strict:** 0 erros · **Build:** ✓ Compiled successfully in 3.2s

## Escopo (terceira sub-sprint UX)

Foco em alavancagem máxima pra mobile sem refatorar componentes inteiros.
Refactor de tabelas/forms inteiros adiado pra próximas sprints conforme
demanda real (mede primeiro, otimiza depois).

1. **TopBar mobile completo** (hambúrguer + WorkspaceSwitcher + UserMenu)
2. **PWA installable** (manifest + ícone SVG + meta tags Apple/Android)
3. **Viewport mobile-friendly** + tap-highlight CSS reset
4. **Botões touch-friendly** no header mobile (min 44px)

## Decisões arquiteturais

### TopBar mobile com WorkspaceSwitcher inline

Antes (Sprint 4.0.5.a):
```
[☰] Conta IA
```

Agora:
```
[☰] [Cacula Mix ▼]                          [👤]
```

User mobile pode trocar empresa SEM abrir o drawer. UserMenu sempre acessível.
Hambúrguer com `min h-11 w-11` (Apple HIG touch target).

### PWA installable

`public/manifest.json`:
- `display: standalone` (vira app real, sem chrome do browser)
- `theme_color: #6366F1` (indigo-500, casa com Sprint 4.0.5.a)
- `start_url: /dashboard` (abre direto no dashboard depois de instalar)
- `lang: pt-BR`
- Icon SVG único (`sizes: any` — adapta pra todos os tamanhos)

`app/layout.tsx`:
- `manifest: '/manifest.json'`
- `appleWebApp: { capable: true }` (suporte iOS)
- `applicationName`, `icons.apple`
- `viewport: { themeColor: '#6366F1', maximumScale: 5 }`

### Viewport meta tag explícita

`viewport` export do Next 16 com `width=device-width, initial-scale=1`
+ permite zoom até 5x (acessibilidade — Apple App Store exige).

### CSS resets mobile

`globals.css` `@layer base`:
- `-webkit-tap-highlight-color: transparent` (remove flash azul no tap)
- `-webkit-font-smoothing: antialiased`
- `-webkit-text-size-adjust: 100%` (impede iOS Safari de mudar size em landscape)

### Sheet drawer largura adaptativa

`SheetContent` mobile mudou de `w-72 max-w-full` (320px) pra `w-72 max-w-[85vw]`
(deixa 15% pra backdrop visível em telas pequenas — UX padrão Linear/Stripe).

## Arquivos

### Novos (3)
- `public/manifest.json`
- `public/icon.svg`
- `__tests__/pwa-manifest.test.ts` (8 tests)
- `docs/SPRINT-4.0.5.c-MOBILE-PWA.md`

### Modificados (3)
- `app/layout.tsx` (metadata PWA + viewport export)
- `app/globals.css` (mobile CSS resets)
- `components/layout/dashboard-shell.tsx` (TopBar mobile com Switcher+UserMenu, hambúrguer touch-friendly)

### NÃO modificado (escopo limitado)
- Tabelas (`/contas-a-pagar`, `/regras`, etc) continuam scroll horizontal em mobile.
  Refactor pra cards verticais decisão futura conforme demanda real.
- Forms continuam padrão atual (já são `min-h-10` via shadcn inputs).
- Service Worker NÃO criado (PWA installable já funciona via manifest).

## Smoke test mobile

1. Abrir https://app.caixaos.com.br no Safari iOS / Chrome Android
2. TopBar mostra: `[☰]  [Cacula Mix ▼]                    [👤]`
3. Tap no `[☰]` → drawer slide-in com sidebar (85% width, 15% backdrop)
4. Tap no `[Cacula Mix ▼]` → dropdown nativo Radix
5. Tap no `[👤]` → menu com Alertas + Sair
6. iOS Safari → Share → "Add to Home Screen" → app instala como standalone
7. Android Chrome → Menu → "Install app" → app instala
8. Após instalar: abre direto no /dashboard sem URL bar

## Métricas

```
Antes (Sprint 4.0.5.b): 1879 testes
Depois (4.0.5.c):       1887 testes (+8 PWA validation)

Tempo planejado:  ~3h
Tempo real:       ~30 min

TS strict: 0 erros
Build:     ✓ Compiled in 3.2s
```

## Próximo

UX refundação (4.0.5.a/b/c) está completa. Próximos passos sugeridos:
- Sprint 5.0 — D23: replicar Cacula Mix structure pras 12 academias
- Sprint 5.0 — WhatsApp Bot via Meta Cloud API
- Sprint 4.1 — Tech debt (AiLearningRule amount filters, Anthropic SDK oficial)
- Sprint 4.0.5.d (opcional) — Cmd+K search global + tabelas mobile como cards
