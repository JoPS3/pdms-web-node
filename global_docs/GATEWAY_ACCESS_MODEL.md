# Gateway — Modelo de Acesso às Aplicações

## Visão Geral

O **gateway** é o ponto de entrada único do sistema PDMS. É responsável por:

1. **Autenticar utilizadores** — login, gestão de password, sessões.
2. **Expor o launcher de aplicações** — página com acesso às apps do ecossistema.
3. **Disponibilizar um endpoint de validação de sessão** — usado pelas sub-aplicações para verificar se um token ainda é válido.

As sub-aplicações (ex.: `mapas`, `vendas`, `compras`, `rh`) não gerem autenticação própria. Delegam essa responsabilidade ao gateway, consultando o endpoint `GET /validate-session`.

---

## Arquitetura

```
Browser
  │
  ▼
┌──────────────────────────────────────┐
│              GATEWAY                 │
│  porta :6000  │  basePath /pdms      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  express-session (MySQL)     │    │
│  │  cookie: session_token        │    │
│  └──────────────────────────────┘    │
│                                      │
│  Rotas de auth:                      │
│    /login  /set-password             │
│    /ask-password  /logout            │
│    /validate-session                 │
│                                      │
│  Rota protegida:                     │
│    /apps  (requireAuth)              │
└──────────────────────────────────────┘
         │                  ▲
         │ redirect/link    │ GET /validate-session
         ▼                  │
┌────────────────┐   ┌─────────────────┐
│    mapas       │   │   vendas / rh   │
│  porta :6002   │   │   porta :600x   │
└────────────────┘   └─────────────────┘
```

---

## Base de Dados

Base de dados partilhada: **`pedaco-000`** (MySQL/MariaDB).

### Tabelas relevantes

| Tabela           | Descrição                                                      |
|------------------|----------------------------------------------------------------|
| `users_role`     | Papéis disponíveis (`admin`, `user`, etc.)                     |
| `users`          | Utilizadores do sistema, com `password` (bcrypt), `role_id`, `is_authorized`, `is_deleted` |
| `sessions`       | Sessões ativas: `session_token`, `expires_at`, `is_valid`, `ip_address`, `user_agent` |
| `express_sessions` | Tabela gerida pelo `express-mysql-session` para sessões HTTP |

> Os IDs usam **UUID v7** (ordenável cronologicamente) gerado pelo próprio MySQL (`UUID_v7()`).

---

## Configuração de Runtime

Ficheiro: `src/config/runtime.js`

| Variável de ambiente | Descrição                                  | Exemplo             |
|---------------------|--------------------------------------------|---------------------|
| `PORT`              | Porta em que o gateway escuta              | `6000`              |
| `BASE_PATH_DEV`     | Prefixo de rota em desenvolvimento         | `/pdms-new`         |
| `BASE_PATH_PROD`    | Prefixo de rota em produção (via PM2/Nginx)| `/pdms`             |
| `SESSION_SECRET`    | Segredo para assinar sessões Express       | (valor secreto)     |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | Ligação à base de dados    | —                   |

O `basePath` activo é determinado por `BASE_PATH_DEV` (dev) ou vazio se não definido. Em produção o path é configurado via variável de ambiente injectada pelo PM2.

---

## Fluxo de Autenticação

### 1. Login — 1.º passo (username)

```
POST /login  { username }
     │
     ├─► username não existe / não autorizado → render login com erro
     │
     ├─► username existe, SEM password → redirect /set-password
     │
     └─► username existe, COM password → redirect /ask-password
```

`req.session.tempUser` é preenchido com `{ id, userName }` para persistir o contexto entre os passos.

---

### 2a. Utilizador sem password — set-password

```
GET  /set-password   → renderiza formulário
POST /set-password   { userId, password, passwordConfirm }
     │
     ├─► validações: ambos preenchidos, coincidência, mínimo 8 chars
     │
     └─► AuthService.setPassword()
           │
           ├─► hash bcrypt (10 rounds) + UPDATE users SET password = ...
           ├─► SessionDAO.create()  → session_token (32 bytes hex, 24h)
           ├─► req.session.user = { id, userName, email, roleId, role }
           ├─► cookie session_token (httpOnly, sameSite: strict)
           └─► redirect /apps
```

---

### 2b. Utilizador com password — ask-password

```
GET  /ask-password   → renderiza formulário
POST /verify-password  { userId, password }
     │
     └─► AuthService.loginWithPassword()
           │
           ├─► UserDAO.findByUserName()
           ├─► bcrypt.compare(password, user.password)
           ├─► SessionDAO.create()  → session_token (32 bytes hex, 24h)
           ├─► req.session.user = { id, userName, email, roleId, role }
           ├─► cookie session_token (httpOnly, sameSite: strict)
           └─► redirect /apps
```

---

### 3. Acesso à rota protegida `/apps`

Middleware `requireAuth` aplicado em todas as rotas de `/apps`:

```
GET /apps
  │
  ├─► req.session.user ausente → redirect /login
  ├─► cookie session_token ausente → destroy session + redirect /login
  │
  └─► AuthService.validateSession(token)
        │
        ├─► SessionDAO.validate()
        │     ├─► token não existe → { valid: false }
        │     ├─► expires_at ultrapassado → { valid: false, reason: 'expired' }
        │     ├─► is_valid = 0 (logout) → { valid: false, reason: 'invalidated' }
        │     └─► válido → updateLastActivity() + retorna dados do user
        │
        ├─► inválido → destroy session + clearCookie + redirect /login
        └─► válido → sync req.session.user + next()
```

A cada request autenticado, o `last_activity` da sessão é actualizado na BD.

---

### 4. Logout

```
POST /logout
  │
  ├─► SessionDAO.invalidate(token)  → SET is_valid = 0
  ├─► req.session.destroy()
  ├─► res.clearCookie('session_token')
  └─► redirect /login
```

A sessão não é eliminada da BD — fica marcada com `is_valid = 0` para auditoria.

---

## Endpoint de Validação para Sub-aplicações

```
GET /validate-session
Cookie: session_token=<token>
```

**Resposta de sucesso (200):**
```json
{
  "valid": true,
  "userId": "...",
  "userName": "...",
  "email": "...",
  "roleId": "...",
  "role": "..."
}
```

**Resposta de falha (401):**
```json
{ "valid": false, "reason": "no_token" | "expired" | "invalidated" }
```

As sub-aplicações devem incluir o cookie `session_token` no pedido (usando `credentials: 'include'` em fetch ou configuração equivalente em SSR/proxy). Se a resposta for `valid: false`, a sub-aplicação redireciona o utilizador para `<gateway>/login`.

---

## Sessão Dupla

O gateway mantém **dois mecanismos de sessão em paralelo**:

| Mecanismo              | Armazenamento        | Finalidade                                          |
|------------------------|----------------------|-----------------------------------------------------|
| `express-session`      | Tabela `express_sessions` (MySQL) | Estado HTTP da sessão no processo Express |
| Cookie `session_token` | Tabela `sessions` (MySQL) | Token persistente para validação inter-serviços |

Ambos têm duração de **24 horas**. O `requireAuth` valida sempre o token na BD, garantindo que um logout explícito invalida o acesso mesmo que a sessão Express ainda exista.

---

## Launcher de Aplicações (`/apps`)

Após autenticação bem-sucedida, o utilizador é apresentado com a lista de aplicações disponíveis.

Definidas estaticamente em `src/controllers/apps.controller.js`:

| id       | Nome    | Descrição                                   |
|----------|---------|---------------------------------------------|
| `mapas`  | Mapas   | Gestão de diário de caixa e auditoria        |
| `vendas` | Vendas  | Controlo de vendas e faturação               |
| `compras`| Compras | Gestão de compras e fornecedores             |
| `rh`     | RH      | Gestão de recursos humanos                   |

> Actualmente os URLs das apps estão definidos como `#` (placeholder). Quando cada sub-aplicação for integrada, o campo `url` deve apontar para o endereço real (ex.: `/mapas`, `/vendas`).

A view renderizada é `src/views/apps/index.ejs` e recebe os dados do utilizador autenticado (`userName`, `email`, `role`).

---

## Estrutura de Ficheiros Relevante

```
gateway/
├── src/
│   ├── app.js                    # Bootstrap Express: sessão, middleware, rotas
│   ├── server.js                 # Ponto de entrada: carrega .env, inicia servidor
│   ├── config/
│   │   └── runtime.js            # Normaliza basePath a partir de env vars
│   ├── routes/
│   │   ├── index.routes.js       # Agrega auth + apps routes
│   │   ├── auth.routes.js        # /login, /set-password, /ask-password, /logout, /validate-session
│   │   └── apps.routes.js        # /apps (requer requireAuth)
│   ├── controllers/
│   │   ├── auth.controller.js    # Lógica de todos os fluxos de auth
│   │   └── apps.controller.js    # Lista estática de apps
│   ├── middlewares/
│   │   └── auth.middleware.js    # requireAuth, requireRole
│   ├── services/
│   │   └── AuthService.js        # hash/verify password, login, validateSession, logout, checkUsername, setPassword
│   ├── daos/
│   │   ├── UserDAO.js            # findByUserName, findByEmail, findById
│   │   └── SessionDAO.js         # create, validate, invalidate, updateLastActivity, deleteExpired
│   └── db/
│       └── pool.js               # Pool MySQL2 com namedPlaceholders
├── database/
│   └── schema.sql                # DDL: users_role, users, sessions
└── ecosystem.config.cjs          # Configuração PM2
```

---

## Segurança

- Passwords com **bcrypt** (10 rounds).
- Tokens de sessão com **32 bytes de entropia** (`crypto.randomBytes`).
- Cookie `session_token` com flags `httpOnly` e `sameSite: strict`; `secure: true` em produção.
- Sessões Express com `saveUninitialized: false` e `resave: false`.
- Headers de segurança via **Helmet** (`contentSecurityPolicy` desactivado por compatibilidade de views).
- Utilizadores com `is_authorized = 0` ou `is_deleted = 1` são rejeitados no login.
- Logout não apaga sessão — mantém registo de auditoria com `is_valid = 0`.
