# RH (PDMS)

Aplicacao Node.js + Express para o modulo `rh`, integrada com autenticacao centralizada no `pdms-gateway`.

## Objetivo

- Disponibilizar o launcher/shell principal do modulo RH.
- Reutilizar autenticacao central do gateway (sem login proprio).
- Respeitar `basePath` em dev e prod.

## Estrutura

- `src/server.js`: bootstrap da app e leitura de `.env`
- `src/app.js`: bootstrap HTTP comum via `shared/createModuleApp`
- `src/middlewares/auth.middleware.js`: middleware gerado a partir de `shared/gatewayAuth`
- `src/controllers/index.controller.js`: render da pagina principal
- `src/views/`: templates EJS
- `src/public/`: estilos e assets estaticos

## Variaveis de ambiente

Arquivo local: `.env`

- `NODE_ENV=development`
- `PORT=6005`
- `BASE_PATH_DEV=/pdms-new/rh`
- `BASE_PATH_PROD=/pdms/rh`
- `GATEWAY_BASE_PATH_DEV=/pdms-new`
- `GATEWAY_BASE_PATH_PROD=/pdms`
- `GATEWAY_VALIDATE_DEV=http://localhost:6000/pdms-new/validate-session`
- `GATEWAY_VALIDATE_PROD=http://localhost:6000/pdms/validate-session`

## Contrato de autenticacao

### Browser via gateway

1. Utilizador autentica no gateway.
2. Gateway grava cookies HttpOnly `pdms_access_token` e `pdms_refresh_token`.
3. Navegacao para `/pdms-new/apps/rh` (ou `/pdms/apps/rh`).
4. Gateway injeta no proxy:
  - `Authorization: Bearer <accessToken>`
  - `X-Gateway-User-*`
5. Middleware do modulo usa fast path por `X-Gateway-User-*`.

### Fallback direto/inter-servico

Quando o request chega sem `X-Gateway-User-*`:

- Obrigatorio: `Authorization: Bearer <accessToken>`
- Opcional: `X-Refresh-Token: <refreshToken>`
- O modulo chama `GET /validate-session` no gateway.

Se a validacao falhar, o modulo redireciona para `<gatewayBasePath>/login`.

## Rotas atuais

- `GET <basePath>/health` (publica)
- `GET <basePath>/` (protegida)

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

- `pdms-rh`

## Referencias

- `global_docs/GATEWAY_ACCESS_MODEL.md`
- `global_docs/PDMS_APP_INTEGRATION.md`
- `global_docs/AUTHENTICATION_ARCHITECTURE.md`
