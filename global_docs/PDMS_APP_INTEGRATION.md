# PDMS - Integracao Entre Gateway e Sub-apps

Documento global para padronizar a integracao entre o `pdms-gateway` e as apps de dominio (`mapas`, `vendas`, `compras`, `rh`).

## Principio de arquitetura

- Gateway centraliza autenticacao e sessao.
- Cada sub-app e independente e pode correr noutro servidor.
- Sub-app valida sessao no gateway via HTTP (`GET /validate-session`).
- Nao e necessario proxy interno no gateway para abrir sub-apps.

## Convencao de URLs (obrigatoria)

### 1) Comunicacao interna entre apps (server-to-server)

Usar sempre URL interna por porta, incluindo base path de desenvolvimento:

`http://localhost:<porta>/<dev_basepath>/<endpoint>`

Exemplos:
- `http://localhost:6000/pdms-new/validate-session`
- `http://localhost:6000/pdms-new/internal/onedrive/status`
- `http://localhost:6002/pdms-new/mapas/internal/auditoria/log`

### 2) Comunicacao externa (browser)

Usar sempre dominio publico com base path de producao:

`https://<dominio>/<prod_basepath>/<endpoint>`

Exemplos:
- `https://exemplo.pt/pdms/login`
- `https://exemplo.pt/pdms/auth`
- `https://exemplo.pt/pdms/mapas`

### 3) Regra de configuracao de base path

- `BASE_PATH_DEV` e `BASE_PATH_PROD` devem ser lidos do `.env` de cada modulo.
- Nao fazer override de `BASE_PATH_*` no `ecosystem.config.cjs`.
- PM2 deve apenas definir `NODE_ENV`, `PORT` e variaveis de integracao necessarias.

## Contrato de autenticacao

### Requisicao

`GET <gatewayBasePath>/validate-session`

- Cookie enviado: `session_token=<valor>`
- Alternativa service-to-service: `Authorization: Bearer <session_token>`

### Resposta valida (200)

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

### Resposta invalida (401)

```json
{
  "valid": false,
  "reason": "no_token|expired|invalidated"
}
```

## Regras para sub-apps

1. Todas as rotas de negocio devem ser protegidas por middleware de auth.
2. O middleware deve:
- Ler cookie `session_token`.
- Opcionalmente ler `Authorization: Bearer <session_token>` para chamadas entre apps.
- Chamar `GET /validate-session` no gateway.
- Em sucesso, popular `req.user`.
- Em falha, redirecionar para `<gatewayBasePath>/login`.
3. Rotas internas de integracao (`/internal/*`) devem usar o mesmo mecanismo de validacao de sessao no gateway.
4. Rotas publicas permitidas: `health` e estaticos basicos.
5. Todas as views devem usar `basePath` (sem paths absolutos hardcoded).
6. Se a sub-app tiver launcher proprio, deve disponibilizar acao de logout para o gateway via `POST <gatewayBasePath>/logout`.

## Regras para launcher no gateway

1. O launcher (`/apps`) deve expor URL real de cada app.
2. URLs devem ser configuraveis por ambiente.
3. Em browser, evitar hardcode de `localhost` em links e redirects.
4. Em dev, preferir `/pdms-new/<app>`.
5. Em prod, preferir `/pdms/<app>`.

## Base paths padrao

- Gateway dev: `/pdms-new`
- Gateway prod: `/pdms`
- Mapas dev: `/pdms-new/mapas`
- Mapas prod: `/pdms/mapas`

## PM2 (convencao de nomes)

- `pdms-gateway`
- `pdms-mapas`
- `pdms-vendas` (quando existir)
- `pdms-compras` (quando existir)
- `pdms-rh` (quando existir)

## Checklist de integracao de nova sub-app

1. Definir `BASE_PATH_DEV` e `BASE_PATH_PROD`.
2. Implementar middleware de validacao no gateway.
3. Proteger rotas privadas.
4. Validar fluxo:
- login gateway -> abrir app
- voltar ao launcher
- logout na sub-app (POST gateway logout)
- logout -> acesso direto redireciona para login
5. Atualizar launcher do gateway com URL real da app.
