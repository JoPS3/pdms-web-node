# PDMS Gateway (Skeleton)

Esqueleto inicial de um gateway em Node.js/Express para autenticação e acesso a outras aplicações.

## O que inclui

- Estrutura base de pastas por camadas (`routes`, `controllers`, `middlewares`, `views`)
- Fluxo mínimo de sessão (`login` / `logout`) sem regras de negócio
- Área protegida com lista de aplicações (placeholder)

## Requisitos

- Node.js 20+

## Como correr

```bash
npm install
npm run dev
```

Abrir: `http://localhost:3000`

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
