# Deploy — Conta IA no DigitalOcean

**Servidor:** Ubuntu 24.04 LTS  
**IP:** 167.172.159.XXX ← preencha com o IP completo  
**Banco:** PostgreSQL 16  
**Processo:** PM2  
**App path:** /opt/conta-ia

---

## Pré-requisitos já atendidos no servidor

- [ ] Node.js 20+ instalado (`node -v`)
- [ ] npm 10+ instalado (`npm -v`)
- [ ] Git instalado (`git --version`)
- [ ] PM2 instalado globalmente (`pm2 -v`)
- [ ] Acesso SSH como root configurado
- [ ] GitHub Personal Access Token criado (para clonar repositório privado)

---

## ETAPA 1 — Instalar PostgreSQL 16

```bash
# No servidor, como root
apt update
apt install -y postgresql-16 postgresql-client-16

# Verificar se subiu
systemctl status postgresql
systemctl enable postgresql
```

---

## ETAPA 2 — Criar banco e usuário

```bash
# Entrar no psql como postgres
sudo -u postgres psql

# Dentro do psql:
CREATE USER contaia_user WITH PASSWORD 'SENHA_FORTE_AQUI';
CREATE DATABASE contaia_production OWNER contaia_user;
GRANT ALL PRIVILEGES ON DATABASE contaia_production TO contaia_user;
\q
```

Anote a senha — você vai precisar na ETAPA 5.

Teste a conexão:
```bash
psql -U contaia_user -d contaia_production -h localhost
# deve entrar sem erro
\q
```

---

## ETAPA 3 — Clonar o projeto

```bash
mkdir -p /opt/conta-ia
cd /opt

# Clonar via HTTPS com Personal Access Token
git clone https://SEU_TOKEN@github.com/yussef5522/conta-ia.git conta-ia

cd conta-ia
```

---

## ETAPA 4 — Criar .env de produção

```bash
cp .env.example .env
nano .env
```

Preencha com estes valores (substitua os placeholders):

```env
DATABASE_URL="postgresql://contaia_user:SENHA_FORTE_AQUI@localhost:5432/contaia_production"

# Gere com: openssl rand -base64 64
JWT_SECRET="COLE_AQUI_O_RESULTADO_DO_OPENSSL"

NEXT_PUBLIC_APP_URL="http://167.172.159.XXX"
```

Para gerar o JWT_SECRET:
```bash
openssl rand -base64 64
# copie o resultado e cole no .env
```

---

## ETAPA 5 — Instalar dependências e executar migrations

```bash
cd /opt/conta-ia

# Instalar dependências (sem devDependencies)
npm ci --omit=dev

# Gerar Prisma Client para PostgreSQL
npm run db:generate

# Aplicar migration no banco de produção
npm run db:migrate:deploy
# Equivale a: prisma migrate deploy
# Cria todas as tabelas conforme prisma/migrations/20260427000000_init/migration.sql

# Criar usuário admin inicial
npm run db:seed
```

Verifique se as tabelas foram criadas:
```bash
sudo -u postgres psql -d contaia_production -c "\dt"
# deve listar: users, companies, user_companies, bank_accounts, transactions, categories
```

---

## ETAPA 6 — Build de produção

```bash
cd /opt/conta-ia
npm run build
```

O build deve terminar com `✓ Compiled successfully`. Se falhar, verifique o log de erro antes de continuar.

---

## ETAPA 7 — Iniciar com PM2

```bash
cd /opt/conta-ia

# Iniciar a aplicação na porta 3000
pm2 start npm --name "conta-ia" -- start

# Salvar processo para sobreviver a reboot
pm2 save
pm2 startup
# execute o comando que o pm2 startup imprimir

# Verificar status
pm2 status
pm2 logs conta-ia --lines 50
```

Teste no navegador: `http://167.172.159.XXX:3000`  
Login: `admin@contaia.com.br` / `ContaIA@2025`

---

## ETAPA 8 — Configurar porta 80 com nginx (opcional mas recomendado)

```bash
apt install -y nginx

cat > /etc/nginx/sites-available/conta-ia << 'EOF'
server {
    listen 80;
    server_name 167.172.159.XXX;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/conta-ia /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Com nginx, a aplicação fica acessível em `http://167.172.159.XXX` (porta 80).

---

## Deploy de atualizações futuras

```bash
cd /opt/conta-ia

# Puxar código novo
git pull origin main

# Se houver novas migrations:
npm run db:migrate:deploy

# Rebuild e restart
npm ci --omit=dev
npm run build
pm2 restart conta-ia

# Verificar logs
pm2 logs conta-ia --lines 30
```

---

## Atenção: desenvolvimento local após migração para PostgreSQL

O schema Prisma agora usa `provider = "postgresql"`. Para rodar localmente, você precisa de PostgreSQL local. Opções:

**Opção A — PostgreSQL local no Windows:**
- Instale o PostgreSQL 16 para Windows: https://www.postgresql.org/download/windows/
- Crie banco `contaia_dev` e usuário `contaia_user` localmente
- Ajuste `DATABASE_URL` no `.env` local

**Opção B — Docker (recomendado):**
```bash
docker run -d \
  --name conta-ia-postgres \
  -e POSTGRES_USER=contaia_user \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=contaia_dev \
  -p 5432:5432 \
  postgres:16
```
Então no `.env` local:
```
DATABASE_URL="postgresql://contaia_user:postgres@localhost:5432/contaia_dev"
```

Após configurar o banco local:
```bash
npm run db:migrate:deploy   # aplica a migration
npm run db:seed             # cria usuário admin
npm run dev
```

---

## Variáveis de ambiente obrigatórias em produção

| Variável | Descrição | Como gerar |
|----------|-----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL | Definida nas etapas acima |
| `JWT_SECRET` | Chave secreta para JWT | `openssl rand -base64 64` |
| `NEXT_PUBLIC_APP_URL` | URL pública da aplicação | IP ou domínio do servidor |

Variáveis opcionais (ativar conforme avanço das fases):

| Variável | Fase | Descrição |
|----------|------|-----------|
| `ANTHROPIC_API_KEY` | FASE 3 | IA Contadora |
| `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET` | FASE 8 | Open Finance |
| `STRIPE_SECRET_KEY` | FASE 7 | Pagamentos SaaS |

---

## Troubleshooting

**`prisma migrate deploy` falha com "relation already exists":**  
O banco já tem tabelas criadas manualmente. Limpe o banco e refaça:
```bash
sudo -u postgres psql -d contaia_production -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate:deploy
```

**PM2 não inicia / erro de porta:**  
```bash
pm2 logs conta-ia
# verifique se PORT=3000 está livre
lsof -i :3000
```

**Build falha com erro de TypeScript:**  
```bash
npm run build 2>&1 | head -50
# corrija o erro reportado antes de continuar
```
