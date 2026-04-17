# Usuarios (PDMS)

Aplicacao Node.js + Express para o modulo `usuarios`, integrada com autenticacao centralizada no `pdms-gateway`.

## Objetivo

- Disponibilizar uma app base para funcionalidades de autenticacao/autorizacao.
- Reutilizar autenticacao do gateway (sem login proprio).
- Expor endpoints internos validados por sessao de gateway.

## Stack

- Node.js
- Express
- EJS
- Axios
- Cookie Parser
- Morgan

## Estrutura

- `src/server.js`: bootstrap da app e leitura de `.env`
- `src/app.js`: middlewares, rotas, basePath e integracao com gateway
- `src/controllers/auth.controller.js`: paginas e endpoints internos do modulo
- `src/middlewares/auth.middleware.js`: middleware gerado a partir de `shared/gatewayAuth`
- `src/views/`: templates EJS
- `src/public/`: estilos estaticos

## Variaveis de ambiente

Arquivo local: `.env`

- `NODE_ENV=development`
- `PORT=6001`
- `BASE_PATH_DEV=/pdms-new/usuarios`
- `BASE_PATH_PROD=/pdms/usuarios`
- `GATEWAY_BASE_PATH_DEV=/pdms-new`
- `GATEWAY_BASE_PATH_PROD=/pdms`
- `GATEWAY_VALIDATE_DEV=http://localhost:6000/pdms-new/validate-session`
- `GATEWAY_VALIDATE_PROD=http://localhost:6000/pdms/validate-session`

## Fluxo de autenticacao

1. Utilizador autentica no gateway.
2. Gateway grava cookies HttpOnly `pdms_access_token` e `pdms_refresh_token` no dominio do gateway.
3. Utilizador entra em `/pdms-new/usuarios` (ou `/pdms/usuarios`).
4. O proxy do gateway injeta `Authorization: Bearer <accessToken>` e `X-Gateway-User-*`.
5. `requireGatewayAuth` usa fast path por `X-Gateway-User-*`.
6. Sem headers do proxy (acesso direto/inter-servico), faz fallback para `GET /validate-session`.
7. Se existir `X-Refresh-Token`, o fallback envia esse header para permitir refresh remoto no gateway.
8. Se valido, popula `req.user` e segue para a rota.
9. Se invalido, redireciona para `<gatewayBasePath>/login`.

## Contrato entre servicos

- Obrigatorio: `Authorization: Bearer <accessToken>`
- Opcional: `X-Refresh-Token: <refreshToken>`
- `connect.sid` nao faz parte do contrato entre apps.

## Rotas atuais

- `GET <basePath>/health` (publica)
- `GET <basePath>/` (protegida)
- `GET <basePath>/session` (protegida)
- `POST <basePath>/internal/session/status` (sessao gateway obrigatoria)

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

- `pdms-usuarios`
