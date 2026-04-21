# FASE 1 — Concluída ✅

**Data:** 2026-04-20  
**Versão:** 0.1.0  
**Branch:** main

---

## O que foi construído

### Infraestrutura
- Next.js 16 + TypeScript (strict mode)
- TailwindCSS + shadcn/ui (componentes: Button, Input, Card, Badge, Dialog, Select, Toast, Avatar, DropdownMenu)
- Prisma ORM + SQLite (desenvolvimento local)
- Vitest (22 testes passando)

### Autenticação
- Login e cadastro com validação Zod
- Senha com bcrypt (rounds = 12)
- JWT armazenado em cookie httpOnly via biblioteca `jose`
- Proteção de rotas via `proxy.ts` (Next.js 16)
- Logout que limpa o cookie

### Banco de dados
Schema completo com as tabelas:
| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `companies` | Empresas (multi-tenant) |
| `user_companies` | Relação N:N user ↔ empresa |
| `bank_accounts` | Contas bancárias (estrutura pronta, sem dados) |

Seed cria o usuário admin inicial.

### CRUD de Empresas
- **Listar** — grid com cards, estado vazio com CTA
- **Criar** — formulário em 4 seções (dados básicos, tributário, contato, endereço)
- **Visualizar** — página de detalhes com todas as informações
- **Editar** — mesmo formulário, CNPJ bloqueado para edição
- **Excluir** — dialog de confirmação antes de deletar

Validações implementadas:
- CNPJ com algoritmo de dígito verificador
- Razão social obrigatória
- Tipo de empresa e regime tributário obrigatórios
- E-mail com formato válido (quando preenchido)
- Formatação automática: CNPJ, telefone, CEP

### Interface
- Sidebar com navegação (itens futuros marcados "em breve")
- Dashboard com 4 cards de métricas
- Estado vazio no dashboard → CTA para criar primeira empresa
- Todas as strings em pt-BR via `/lib/i18n/pt-BR.ts`
- Design responsivo (desktop-first)

### Segurança
- `.env` no `.gitignore` (nunca vai pro GitHub)
- JWT em cookie httpOnly (não acessível via JavaScript)
- Isolamento multi-tenant: API valida que o usuário é dono da empresa antes de qualquer operação
- Tokens de tempo constante no login (anti-enumeração de usuários)

---

## Estrutura de arquivos

```
conta-ia/
├── app/
│   ├── (auth)/login/          ← Tela de login
│   ├── (auth)/cadastro/       ← Tela de cadastro
│   ├── (dashboard)/dashboard/ ← Dashboard principal
│   ├── (dashboard)/empresas/  ← CRUD de empresas
│   └── api/auth/ + api/empresas/  ← API Routes
├── components/
│   ├── ui/                    ← shadcn/ui
│   ├── layout/sidebar.tsx     ← Sidebar com navegação
│   └── empresas/              ← Formulário, card, dialog
├── lib/
│   ├── auth.ts                ← JWT helpers
│   ├── db.ts                  ← Prisma singleton
│   ├── utils.ts               ← cn(), formatCNPJ(), formatPhone(), formatCEP()
│   ├── i18n/pt-BR.ts          ← Todas as strings da UI
│   └── validations/           ← Zod schemas
├── prisma/schema.prisma        ← Schema do banco
├── proxy.ts                   ← Proteção de rotas
└── __tests__/                 ← 22 testes Vitest
```

---

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Criar banco de dados
npm run db:push

# 3. Popular com usuário admin
npm run db:seed

# 4. Iniciar servidor
npm run dev
```

Acesse: http://localhost:3000  
Login: `admin@contaia.com.br` / `ContaIA@2025`

---

## Problemas conhecidos

| # | Problema | Impacto | Status |
|---|----------|---------|--------|
| 1 | O `package-lock.json` foi commitado no repositório | Espaço extra no repo, mas necessário para reprodutibilidade | Aceitável por ora |
| 2 | `next-env.d.ts` não está no `.gitignore` (gerado pelo Next.js) | Arquivo gerado commitado | Corrigir na FASE 2 |
| 3 | Sidebar não colapsa em telas pequenas | UX mobile prejudicada | Não prioritário (uso desktop) |
| 4 | Não há rate limiting nas rotas de API | Segurança reduzida em produção | Implementar antes de abrir para clientes |
| 5 | CNPJ exibido sem formatação na tela de detalhes | Visual ruim para CNPJs sem máscara | Fix simples, próximo sprint |

---

## FASE 2 — Próximo

Ver `docs/ROADMAP.md` para o planejamento completo.

Foco previsto da FASE 2: **Contas Bancárias + Integração Open Finance (Pluggy)**
