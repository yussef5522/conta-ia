# Conta IA

**Seu contador inteligente que nunca dorme.**

Sistema de gestão financeira para empresas brasileiras com IA contadora integrada.

## Tecnologias

- **Frontend:** Next.js 14 + TailwindCSS + shadcn/ui
- **Backend:** Next.js API Routes + TypeScript
- **Banco de dados:** SQLite (dev) / PostgreSQL (prod) via Prisma
- **Autenticação:** JWT (jose) + bcrypt
- **Validação:** Zod
- **Testes:** Vitest

## Como rodar localmente

### Pré-requisitos

- Node.js >= 18
- npm >= 9

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` se necessário. Para desenvolvimento local, os valores padrão já funcionam.

### 3. Criar o banco de dados

```bash
npm run db:push
```

Isso cria o arquivo `prisma/dev.db` com todas as tabelas.

### 4. Popular com dados iniciais (seed)

```bash
npm run db:seed
```

Cria o usuário admin:
- **E-mail:** `admin@contaia.com.br`
- **Senha:** `ContaIA@2025`

### 5. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Gera build de produção |
| `npm run start` | Inicia servidor de produção |
| `npm run lint` | Executa ESLint |
| `npm run test` | Executa testes com Vitest |
| `npm run test:watch` | Testes em modo watch |
| `npm run db:push` | Sincroniza schema com o banco (dev) |
| `npm run db:migrate` | Cria migration de produção |
| `npm run db:studio` | Abre Prisma Studio (interface visual do banco) |
| `npm run db:seed` | Popula banco com dados iniciais |

## Estrutura do projeto

```
conta-ia/
├── app/
│   ├── (auth)/           # Páginas de login e cadastro
│   ├── (dashboard)/      # Páginas protegidas (dashboard, empresas)
│   └── api/              # Rotas de API (auth, empresas)
├── components/
│   ├── ui/               # Componentes shadcn/ui
│   ├── layout/           # Sidebar, Header
│   └── empresas/         # Componentes de empresa
├── lib/
│   ├── auth.ts           # Helpers de JWT
│   ├── db.ts             # Prisma client
│   ├── utils.ts          # Utilitários (cn, formatação)
│   ├── i18n/pt-BR.ts     # Traduções (pt-BR)
│   └── validations/      # Schemas Zod
├── prisma/
│   ├── schema.prisma     # Schema do banco
│   └── seed.ts           # Dados iniciais
├── __tests__/            # Testes Vitest
├── middleware.ts          # Proteção de rotas
├── .env.example          # Template de variáveis de ambiente
└── CLAUDE.md             # Documentação do projeto
```

## Rotas

### Públicas
- `GET /login` — Tela de login
- `GET /cadastro` — Tela de cadastro
- `POST /api/auth/login` — Autenticação
- `POST /api/auth/cadastro` — Criação de conta

### Protegidas (requer autenticação)
- `GET /dashboard` — Dashboard principal
- `GET /empresas` — Listagem de empresas
- `GET /empresas/nova` — Formulário nova empresa
- `GET /empresas/[id]` — Detalhes da empresa
- `GET /empresas/[id]/editar` — Editar empresa
- `GET /api/empresas` — API: listar empresas
- `POST /api/empresas` — API: criar empresa
- `PUT /api/empresas/[id]` — API: atualizar empresa
- `DELETE /api/empresas/[id]` — API: excluir empresa

## Segurança

- Senhas com bcrypt (rounds = 12)
- JWT em cookie httpOnly (não acessível via JavaScript)
- Validação de entrada com Zod em todas as rotas de API
- Isolamento multi-tenant: cada usuário acessa apenas suas próprias empresas
- Rate limiting: a implementar na Fase 2

## Roadmap

- [x] **Fase 1** — Auth + CRUD de Empresas (atual)
- [ ] **Fase 2** — Contas bancárias + Open Finance (Pluggy)
- [ ] **Fase 3** — Transações + Conciliação automática
- [ ] **Fase 4** — Relatórios (DRE, Fluxo de caixa)
- [ ] **Fase 5** — IA Contadora (Claude + RAG)
- [ ] **Fase 6** — Cálculo de impostos + Reforma Tributária 2026
