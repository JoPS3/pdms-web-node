# PDMS - Integracao Entre Gateway e Sub-apps

Documento global para padronizar a integracao entre o `pdms-gateway` e as apps de dominio (`usuarios`, `mapas`, `vendas`, `compras`, `rh`).

## Principio de arquitetura

- Gateway centraliza autenticacao e sessao.
- A navegacao externa de apps e canonicamente via gateway: `/apps/<app>`.
- Sub-apps recebem contexto autenticado por `Authorization: Bearer <token>` e headers `X-Gateway-User-*`.
- Sub-apps podem validar token via HTTP no gateway em fallback (`GET /validate-session`).

## Convencao de URLs (obrigatoria)

### 1) Comunicacao browser

- URL canonica no gateway:
  - Dev: `/pdms-new/apps/<app>`
  - Prod: `/pdms/apps/<app>`

### 2) Comunicacao interna entre servicos

- Usar URL interna por porta, incluindo base path:
  - `http://localhost:6000/pdms-new/validate-session`
  - `http://localhost:6000/pdms-new/internal/onedrive/status`
  - `http://localhost:6002/pdms-new/mapas/internal/auditoria/log`

### 3) Regra de base path

- `BASE_PATH_DEV` e `BASE_PATH_PROD` devem vir do `.env`.
- Nao fazer override de `BASE_PATH_*` no `ecosystem.config.cjs`.

## Contrato de autenticacao

`Authorization: Bearer <accessToken>` e obrigatorio para comunicacao entre servicos.

`connect.sid` e apenas transporte de compatibilidade para navegacao MPA browser -> gateway.

### Requisicao

`GET <gatewayBasePath>/validate-session`

- Obrigatorio (service-to-service): `Authorization: Bearer <session_token>`
- Compatibilidade browser: sessao Express existente

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

1. Proteger todas as rotas de negocio com middleware de auth.
2. Ler Bearer token primeiro.
3. Consumir headers `X-Gateway-User-*` no fast path.
4. Em fallback, chamar `GET /validate-session` no gateway.
5. Em falha de auth, redirecionar para `<gatewayBasePath>/login`.
6. Rotas `/internal/*` devolvem JSON 401/502 quando aplicavel.
7. Views usam sempre `basePath` e `gatewayBasePath` (sem host hardcoded).

## Regras para launcher no gateway

1. O launcher em `/apps` expoe links canonicos `/apps/<app>`.
2. O proxy do gateway reescreve path e `Location` para manter rota canonica.
3. Nao usar links diretos para `localhost:<porta>` no browser.

## PM2 (convencao de nomes)

- `pdms-gateway`
- `pdms-usuarios`
- `pdms-mapas`
- `pdms-vendas`
- `pdms-compras`
- `pdms-rh`

## Checklist de integracao de nova sub-app

1. Definir `BASE_PATH_DEV` e `BASE_PATH_PROD`.
2. Registar app no proxy do gateway com rota canonica `/apps/<app>`.
3. Implementar middleware auth Bearer-first na sub-app.
4. Expor rotas tecnicas (`health`, `internal/*`) conforme contrato.
5. Validar fluxo fim-a-fim: login -> launcher -> app -> logout.
