# Deploy — Conta IA no DigitalOcean

**Servidor:** Ubuntu 24.04 LTS  
**IP:** 167.172.159.101  
**Banco:** PostgreSQL 16  
**Processo:** PM2 (porta 3001)  
**App path:** /opt/conta-ia

---

## Status do deploy

### Concluído (no repositório)
- [x] Migrar schema Prisma para PostgreSQL (produção)
- [x] Manter SQLite em desenvolvimento
- [x] Criar migration inicial PostgreSQL
- [x] Atualizar .env.example
- [x] Criar docs/DEPLOY.md

### Pendente (no servidor 167.172.159.101)
- [ ] Instalar PostgreSQL no servidor
- [ ] Criar banco contaia_production
- [ ] Configurar variáveis de ambiente em produção
- [ ] Clonar projeto em /opt/conta-ia
- [ ] Buildar e subir no PM2 porta 3001
- [ ] Testar acesso público

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

Anote a senha — você vai precisar na ETAPA 4.

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

Preencha com estes valores:

```env
DATABASE_URL="postgresql://contaia_user:SENHA_FORTE_AQUI@localhost:5432/contaia_production"

# Gere com: openssl rand -base64 64
JWT_SECRET="COLE_AQUI_O_RESULTADO_DO_OPENSSL"

NEXT_PUBLIC_APP_URL="http://167.172.159.101:3001"
```

Para gerar o JWT_SECRET:
```bash
openssl rand -base64 64
# copie o resultado e cole no .env
```

---

## ETAPA 5 — Ajustar schema para PostgreSQL e aplicar migration

O schema.prisma em desenvolvimento usa SQLite. No servidor, antes de rodar
a migration, é preciso trocar o provider para postgresql em dois arquivos:

```bash
cd /opt/conta-ia

# Troca provider de sqlite para postgresql no schema e no lock file
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/migrations/migration_lock.toml

# Instalar dependências (sem devDependencies)
npm ci --omit=dev

# Gerar Prisma Client para PostgreSQL
npm run db:generate

# Aplicar migration no banco de produção
npm run db:migrate:deploy
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

## ETAPA 7 — Iniciar com PM2 na porta 3001

```bash
cd /opt/conta-ia

# Iniciar a aplicação na porta 3001
PORT=3001 pm2 start npm --name "conta-ia" -- start

# Salvar processo para sobreviver a reboot
pm2 save
pm2 startup
# execute o comando que o pm2 startup imprimir

# Verificar status
pm2 status
pm2 logs conta-ia --lines 50
```

Teste no navegador: `http://167.172.159.101:3001`  
Login: `admin@contaia.com.br` / `ContaIA@2025`

---

## ETAPA 8 — Configurar nginx na porta 80 (recomendado)

```bash
apt install -y nginx

cat > /etc/nginx/sites-available/conta-ia << 'EOF'
server {
    listen 80;
    server_name 167.172.159.101;

    location / {
        proxy_pass http://localhost:3001;
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

Com nginx, a aplicação fica acessível em `http://167.172.159.101` (porta 80).

---

## Deploy de atualizações futuras

```bash
cd /opt/conta-ia

# Puxar código novo
git pull origin main

# Se houver novas migrations (verificar se há arquivos novos em prisma/migrations/):
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/migrations/migration_lock.toml
npm run db:migrate:deploy

# Rebuild e restart
npm ci --omit=dev
npm run build
pm2 restart conta-ia

# Verificar logs
pm2 logs conta-ia --lines 30
```

---

## Desenvolvimento local (SQLite — sem alteração)

O schema.prisma usa `provider = "sqlite"` para desenvolvimento. Não é necessário
instalar PostgreSQL localmente. O `.env` local continua com `DATABASE_URL="file:./dev.db"`.

```bash
# Comandos locais (sem mudança em relação ao padrão)
npm run db:push     # aplica schema no SQLite local
npm run db:seed     # cria usuário admin
npm run dev
```

---

## Variáveis de ambiente obrigatórias em produção

| Variável | Descrição | Como gerar |
|----------|-----------|-----------|
| `DATABASE_URL` | String de conexão PostgreSQL | Definida nas etapas acima |
| `JWT_SECRET` | Chave secreta para JWT | `openssl rand -base64 64` |
| `NEXT_PUBLIC_APP_URL` | URL pública da aplicação | `http://167.172.159.101:3001` |

Variáveis opcionais (ativar conforme avanço das fases):

| Variável | Fase | Descrição |
|----------|------|-----------|
| `ANTHROPIC_API_KEY` | FASE 3 | IA Contadora |
| `PLUGGY_CLIENT_ID` + `PLUGGY_CLIENT_SECRET` | FASE 8 | Open Finance |
| `STRIPE_SECRET_KEY` | FASE 7 | Pagamentos SaaS |

---

## Troubleshooting

**`prisma migrate deploy` falha com "provider mismatch":**  
Certifique-se de ter rodado os dois `sed` da ETAPA 5 antes de executar a migration.
```bash
grep provider prisma/schema.prisma
grep provider prisma/migrations/migration_lock.toml
# ambos devem mostrar: provider = "postgresql"
```

**`prisma migrate deploy` falha com "relation already exists":**  
O banco já tem tabelas criadas manualmente. Limpe o banco e refaça:
```bash
sudo -u postgres psql -d contaia_production -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate:deploy
```

**PM2 não inicia / erro de porta:**
```bash
pm2 logs conta-ia
# verificar se porta 3001 está livre
lsof -i :3001
```

**Build falha com erro de TypeScript:**
```bash
npm run build 2>&1 | head -50
# corrija o erro reportado antes de continuar
```
