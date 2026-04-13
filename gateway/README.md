# PDMS Gateway

Gateway em Node.js/Express para autenticação, sessões e acesso a aplicações do ecossistema PDMS.

## O que inclui

- Estrutura base de pastas por camadas (`routes`, `controllers`, `middlewares`, `views`)
- Fluxo de autenticação em 2 passos (`username` -> `password` ou `set-password`)
- Sessões persistentes em MariaDB (`express-mysql-session`)
- Área protegida com página de apps (mobile + desktop-like UI)
- Páginas de erro `401` e `404` com estilo dedicado

## Requisitos

- Node.js 20+

## Como correr

```bash
npm install
npm run dev
```

Abrir: `http://localhost:6000/apps/pdms-new/login` (ou o `PORT`/`BASE_PATH_DEV` configurado)

## Configuração de ambiente

Este projeto lê variáveis de `.env`.

Exemplo:

```env
PORT=6000
BASE_PATH_DEV=/apps/pdms-new
SESSION_SECRET=change-me-in-production
```

Com esta configuração, o login fica disponível em `http://localhost:6000/apps/pdms-new/login`.

## Scripts

- `npm run dev`: desenvolvimento com `nodemon`
- `npm start`: execução normal
- `npm test`: executa testes (`node:test`)
- `npm run test:watch`: executa testes em watch mode
- `npm run pm2:start`: inicia processo PM2 (`pdms-gateway`)
- `npm run pm2:restart`: reinicia processo PM2 e atualiza env
- `npm run pm2:stop`: para processo PM2
- `npm run pm2:delete`: remove processo PM2
- `npm run pm2:logs`: mostra logs do processo PM2

## Testes

Os testes estão em `test/*.test.js` e cobrem:

- Normalização de `basePath` (`src/config/runtime.js`)
- Renderização do `apps.controller`
- Fluxos síncronos do `auth.controller` (`redirectRoot`, `renderLogin`, `render401`)

Executar:

```bash
npm test
```

## Sessões

- Sessão de aplicação via `express-session`
- Store persistente em MariaDB via `express-mysql-session`
- Tabela `express_sessions` criada automaticamente no arranque

Isto evita perda de sessão em reinícios do processo (por exemplo, quando usar PM2 com watch).
