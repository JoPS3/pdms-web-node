# PDMS Gateway

Gateway em Node.js/Express para autenticacao, tokens e acesso centralizado as apps do ecossistema PDMS.

## Contrato atual

- Browser: cookies HttpOnly (`pdms_access_token`, `pdms_refresh_token`) geridos pelo gateway.
- Service-to-service: `Authorization: Bearer <accessToken>`.
- Refresh remoto opcional: `X-Refresh-Token`.
- Em request para apps, o gateway injeta `Authorization` e `X-Gateway-User-*` no proxy.

Referencia oficial:

- `global_docs/GATEWAY_ACCESS_MODEL.md`
- `global_docs/PDMS_APP_INTEGRATION.md`
- `global_docs/AUTHENTICATION_ARCHITECTURE.md`

## O que inclui

- Estrutura base por camadas (`routes`, `controllers`, `services`, `daos`, `middlewares`, `views`)
- Fluxo de autenticacao em 2 passos (`username` -> `password` ou `set-password`)
- Gestao de access/refresh tokens no backend
- Proxy canonico para sub-apps via `/apps/<app>`
- Pags de erro `401` e `404`

## Requisitos

- Node.js 20+

## Como correr

```bash
npm install
npm run dev
```

Abrir: `http://localhost:6000/pdms-new/login` (ou `PORT` + `BASE_PATH_DEV` configurados)

## Configuracao de ambiente

Este projeto le variaveis de `.env`.

Exemplo:

```env
PORT=6000
BASE_PATH_DEV=/pdms-new
BASE_PATH_PROD=/pdms
SESSION_SECRET=change-me-in-production
SESSION_INACTIVITY_MINUTES=20
SESSION_RENEWAL_THRESHOLD_MINUTES=5
```

Com esta configuracao, o login fica em `http://localhost:6000/pdms-new/login`.

## Scripts

- `npm run dev`: desenvolvimento com `nodemon`
- `npm start`: execução normal
- `npm run get:session-token`: procura `accessToken` ativo no DB por utilizador (`USER_NAME`)
- `npm run validate:onedrive-refresh`: valida refresh ativo OneDrive (forca expiracao de access token)
- `npm run validate:onedrive-refresh:readonly`: valida estado OneDrive sem alterar expiracao no DB
- `npm run validate:onedrive-refresh:readonly:auto`: modo read-only com descoberta automatica de token por `USER_NAME`
- `npm test`: executa testes (`jest`)
- `npm run test:watch`: executa testes em watch mode
- `npm run pm2:start`: inicia processo PM2 (`pdms-gateway`)
- `npm run pm2:restart`: reinicia processo PM2 e atualiza env
- `npm run pm2:stop`: para processo PM2
- `npm run pm2:delete`: remove processo PM2
- `npm run pm2:logs`: mostra logs do processo PM2

## Testes

Os testes estao em `__tests__/` e cobrem:

- Renderizacao do `apps.controller`
- Fluxos de controllers GUI/API de autenticacao
- Fluxos de refresh e runtime

Executar:

```bash
npm test
```

## Sessões

- Sessao de bootstrap via `express-session` (etapa temporaria `tempUser` no login em dois passos)
- Tokens/sessoes de acesso persistidos em MariaDB na tabela de dominio `sessions`
- Contrato de acesso das apps e token-based (nao depende de `connect.sid`)

## OneDrive: validacao operacional

Para diagnosticar renovacao de token OneDrive no backend:

1. Obter token de sessao ativo do utilizador (exemplo: `admin`):

```bash
USER_NAME=admin npm run get:session-token
```

2. Validar estado sem mutacoes de token (read-only):

```bash
USER_NAME=admin npm run validate:onedrive-refresh:readonly:auto
```

3. Validar renovacao real via refresh token (forca expiracao do access token):

```bash
SESSION_TOKEN=... npm run validate:onedrive-refresh
```

Notas:

- O refresh token e opaco e nao expoe `refresh_expires_at` no retorno do token endpoint.
- A validade exata do refresh token nao e observavel localmente; a confianca operacional vem do sucesso do fluxo de refresh.
