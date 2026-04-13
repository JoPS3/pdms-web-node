# PDMS - Integracao Entre Gateway e Sub-apps

Documento global para padronizar a integracao entre o `pdms-gateway` e as apps de dominio (`mapas`, `vendas`, `compras`, `rh`).

## Principio de arquitetura

- Gateway centraliza autenticacao e sessao.
- Cada sub-app e independente e pode correr noutro servidor.
- Sub-app valida sessao no gateway via HTTP (`GET /validate-session`).
- Nao e necessario proxy interno no gateway para abrir sub-apps.

## Contrato de autenticacao

### Requisicao

`GET <gatewayBasePath>/validate-session`

- Cookie enviado: `session_token=<valor>`

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
- Chamar `GET /validate-session` no gateway.
- Em sucesso, popular `req.user`.
- Em falha, redirecionar para `<gatewayBasePath>/login`.
3. Rotas publicas permitidas: `health` e estaticos basicos.
4. Todas as views devem usar `basePath` (sem paths absolutos hardcoded).

## Regras para launcher no gateway

1. O launcher (`/apps`) deve expor URL real de cada app.
2. URLs devem ser configuraveis por ambiente.
3. Em dev, preferir `/pdms-new/<app>`.
4. Em prod, preferir `/pdms/<app>`.

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
- logout -> acesso direto redireciona para login
5. Atualizar launcher do gateway com URL real da app.
