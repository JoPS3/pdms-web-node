# Mapas (PDMS)

Aplicacao Node.js + Express para o modulo `mapas`, integrada com autenticacao centralizada no `pdms-gateway`.

## Objetivo

- Fornecer as funcionalidades do modulo Mapas.
- Reutilizar autenticacao do gateway (sem login proprio).
- Respeitar `basePath` em dev e prod.

## Stack

- Node.js
- Express
- EJS
- Axios
- Cookie Parser
- Morgan

## Estrutura

- `src/server.js`: bootstrap da app e leitura de `.env`
- `src/app.js`: bootstrap HTTP local do modulo
- `src/middlewares/auth.middleware.js`: middleware local do modulo
- `src/views/`: templates EJS
- `src/public/`: estilos e assets estaticos

## Variaveis de ambiente

Arquivo local: `.env`

- `NODE_ENV=development`
- `PORT=6002`
- `BASE_PATH_DEV=/pdms-new/mapas`
- `BASE_PATH_PROD=/pdms/mapas`
- `GATEWAY_BASE_PATH_DEV=/pdms-new`
- `GATEWAY_BASE_PATH_PROD=/pdms`
- `GATEWAY_VALIDATE_DEV=http://localhost:6000/pdms-new/validate-session`
- `GATEWAY_VALIDATE_PROD=http://localhost:6000/pdms/validate-session`

## Fluxo de autenticacao

1. Utilizador autentica no gateway.
2. Gateway grava cookies HttpOnly `pdms_access_token` e `pdms_refresh_token`.
3. Utilizador entra em `/pdms-new/mapas` (ou `/pdms/mapas`).
4. O proxy do gateway injeta `Authorization: Bearer <accessToken>` e `X-Gateway-User-*`.
5. `requireGatewayAuth` usa fast path por `X-Gateway-User-*`.
6. Sem headers do proxy (acesso direto/inter-servico), faz fallback para `GET /validate-session` com `Authorization: Bearer <accessToken>`.
7. Se existir `X-Refresh-Token`, o fallback envia esse header para permitir refresh remoto no gateway.
8. Se valido, popula `req.user` e segue para a rota.
9. Se invalido, redireciona para `<gatewayBasePath>/login`.

### APIs internas (integracao entre apps)

As rotas internas usam o mesmo servico de autenticacao do gateway.

- Nao usam mais `X-Internal-Token`.
- Aceitam `Authorization: Bearer <accessToken>`.
- Opcionalmente aceitam `X-Refresh-Token` para refresh remoto durante `GET /validate-session`.
- O middleware valida sempre no gateway antes de executar a operacao.
- Em sucesso, `req.user` fica disponivel para auditoria (`userName`, `id`, etc.).

## Rotas atuais

- `GET <basePath>/health` (publica)
- `GET <basePath>/` (protegida)
- `GET <basePath>/diario-caixa` (protegida)
- `GET <basePath>/auditoria-logs` (protegida)
- `POST <basePath>/internal/diario-caixa/upsert` (sessao gateway obrigatoria)
- `POST <basePath>/internal/diario-caixa/existence` (sessao gateway obrigatoria)
- `POST <basePath>/internal/auditoria/log` (sessao gateway obrigatoria)
- `POST <basePath>/internal/auditoria/query` (sessao gateway obrigatoria)

## UX Desktop (launcher do modulo)

Na pagina inicial desktop do modulo (`GET <basePath>/`):

- O atalho de Diario de Caixa abre em janela flutuante (overlay), sem sair do launcher.
- A janela pode ser movida por drag no titlebar.
- A janela pode ser redimensionada por drag no canto inferior direito.
- O fecho da janela e feito apenas no botao `x` da propria janela.
- Existe botao de logout no canto superior direito, ao lado do botao de voltar.
- Se uma chamada inline (`fetch`) receber `401` por sessao expirada, a app redireciona automaticamente para `<gatewayBasePath>/login`.

## Modelo de filtros de tabela (local)

As listagens `diario-caixa` e `auditoria-logs` seguem o mesmo contrato de filtros por coluna.

- Parametros de filtro por coluna: `tf*` (ex.: `tfData`, `tfTableName`)
- Token de selecao vazia explicita: `__EMPTY__`
- Ordenacao persistida: `sortBy` e `sortDir`
- Paginacao persistida: `page` e `pageSize`

### Diario de Caixa

- Filtro base por ano: `ano` (default = ano corrente)
- Query principal ja inicia filtrada por `YEAR(data) = ano`
- Resumo mostra intervalo da pagina e total do conjunto filtrado

### Auditoria Logs

- Filtro base por periodo: `periodo` no formato `YYYY-MM` (default = mes corrente)
- Query principal ja inicia filtrada por intervalo de `created_at` do periodo
- Resumo mostra: `Total de logs em ANO-MES: x de y`
	- `x`: total apos filtros de coluna
	- `y`: total do periodo base (sem filtros de coluna)
- Coluna UUID removida da grelha
- Payload colapsavel por linha (acordeao, uma linha aberta de cada vez)

## Modelo global (cross-modulo)

Referencia no repositorio:

- `docs/TABLE_FILTER_GLOBAL_MODEL.md`

Este documento descreve o padrao transversal para reaplicacao em outros modulos.

### Logout

- O logout do modulo usa o endpoint central do gateway.
- Acao: `POST <gatewayBasePath>/logout`.
- Resultado esperado: sessao invalidada no gateway e redirecionamento para login quando necessario.

## Scripts

- `npm start`
- `npm run dev`
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

- `pdms-mapas`

Exemplo:

```bash
npm run pm2:start
npm run pm2:logs
```
