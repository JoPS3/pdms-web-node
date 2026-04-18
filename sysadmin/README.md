# Sysadmin (PDMS)

Aplicacao Node.js + Express para o modulo de administracao do sistema (`sysadmin`), integrada com autenticacao centralizada no `pdms-gateway`.
Porta: `6001`. Base path: `/pdms-new/sysadmin` (dev) / `/pdms/sysadmin` (prod).

## Objetivo

- Gestao de utilizadores do sistema (listagem, edicao, autorizacao).
- Reutilizar autenticacao do gateway (sem login proprio).
- Expor endpoints internos validados por sessao de gateway.
- Configuracao de integracao OneDrive (proxy para gateway).

## Stack

- Node.js + Express
- EJS (views)
- Axios (chamadas internas)
- MySQL (via pool partilhado com gateway, base `pedaco-000`)

## Estrutura de ficheiros

Segue as convencoes definidas em `global_docs/CODE_CONVENTIONS.md`.

```
src/
	app.js                              bootstrap Express, middlewares, rotas GUI
	server.js                           leitura .env e arranque HTTP
	controllers/
		users.gui.controller.js           home page, edit page, export (renders/download)
		users.api.controller.js           update user (JSON)
		sysadmin.api.controller.js        session status, change-password (JSON)
		onedrive.api.controller.js        proxy OneDrive → gateway (JSON)
	services/
		users.service.js                  CRUD de utilizadores + mappers
		users-filters.service.js          paginacao, filtros de tabela, export query
		user-password.service.js          hash/verify de passwords
		mapas-audit.service.js            registo de auditoria via mapas
		password.service.js               bcrypt helpers
	daos/
		users.dao.js                      queries de utilizadores
		user-password.dao.js              queries de password
	middlewares/
		session.middleware.js             requireGatewayAuth, requireGatewaySessionApi, parseSessionToken
		gateway-auth.local.js             implementacao local de validacao de sessao via gateway
	routes/
		index.js                          rotas API/internal (/api/*, /internal/*)
	utils/
		table-filters.js                  parseTableFiltersFromQuery
		users-export.js                   createCsv, createFlatOdf
	db/                                 pool MySQL
	views/                              templates EJS
	public/                             estilos e scripts estaticos
docs/
	DESKTOP_SINGLE_DOM_MODEL.md         modelo de shell desktop
	CODE_STRUCTURE.md                   estrutura interna detalhada
```

## Variaveis de ambiente

Arquivo local: `.env` (ver `.env.example`)

- `NODE_ENV=development`
- `PORT=6001`
- `BASE_PATH_DEV=/pdms-new/sysadmin`
- `BASE_PATH_PROD=/pdms/sysadmin`
- `GATEWAY_BASE_PATH_DEV=/pdms-new`
- `GATEWAY_BASE_PATH_PROD=/pdms`
- `GATEWAY_VALIDATE_DEV=http://localhost:6000/pdms-new/validate-session`
- `GATEWAY_VALIDATE_PROD=http://localhost:6000/pdms/validate-session`

## Fluxo de autenticacao

1. Utilizador autentica no gateway.
2. Gateway grava cookies HttpOnly `pdms_access_token` e `pdms_refresh_token`.
3. Utilizador navega para `/pdms-new/sysadmin` via proxy do gateway.
4. O proxy injeta `Authorization: Bearer <accessToken>` e `X-Gateway-User-*`.
5. `requireGatewayAuth` usa fast path por `X-Gateway-User-*` (sem chamada HTTP).
6. Sem headers do proxy (acesso direto), faz fallback para `GET /validate-session`.
7. Se existir `X-Refresh-Token`, o fallback permite refresh remoto no gateway.

Referencia: `global_docs/PDMS_APP_INTEGRATION.md`, `global_docs/CODE_CONVENTIONS.md`.

## Contrato entre servicos

- Obrigatorio: `Authorization: Bearer <accessToken>`
- Opcional: `X-Refresh-Token: <refreshToken>`
- `connect.sid` nao faz parte do contrato entre apps.

## Rotas atuais

- `GET <basePath>/health` (publica)
- `GET <basePath>/` (protegida)
- `GET <basePath>/users/export` (protegida)
- `GET <basePath>/users/:userId/edit` (protegida)
- `GET <basePath>/api/session/check` (publica)
- `GET <basePath>/api/session/status` (sessao gateway obrigatoria)
- `POST <basePath>/internal/session/status` (sessao gateway obrigatoria)
- `POST <basePath>/internal/session/change-password` (sessao gateway obrigatoria)
- `POST <basePath>/internal/users/:userId/update` (sessao gateway obrigatoria)

## Comportamento de sessao expirada (frontend)

O desktop shell da app instala um guard global para chamadas `fetch` a rotas internas (`/internal/...`).

- Se uma resposta vier com `401`, a app faz redirecionamento imediato para `<gatewayBasePath>/login`.
- Isto evita estado visual "preso" no desktop quando a sessao no gateway expira durante a navegacao.

## Scripts

- `npm start`
- `npm run dev`
- `npm run test`
- `npm run pm2:start`
- `npm run pm2:start:watch`
- `npm run pm2:restart`
- `npm run pm2:restart:watch`
- `npm run pm2:restart:no-watch`
- `npm run pm2:stop`
- `npm run pm2:delete`
- `npm run pm2:logs`

## PM2

Nome do processo desta app:

- `pdms-sysadmin`
