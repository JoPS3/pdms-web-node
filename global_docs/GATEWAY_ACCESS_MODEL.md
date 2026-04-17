# Gateway - Modelo de Acesso Atual

## Visao Geral

O gateway e o ponto de entrada unico do PDMS e concentra:

1. Autenticacao e sessao.
2. Launcher de apps (`/apps`).
3. Proxy canonico para sub-apps (`/apps/<app>`).
4. Validacao de sessao (`/validate-session`).

## Modelo de Navegacao

### Browser (canonico)

- Dev: `/pdms-new/apps/<app>`
- Prod: `/pdms/apps/<app>`

O browser nao deve navegar para `localhost:<porta>` diretamente.

### Service-to-service

- Uso obrigatorio de Bearer token.
- Validacao por `GET /validate-session`.

## Modelo de Autenticacao

### Regra principal

`Authorization: Bearer <accessToken>` e o mecanismo obrigatorio entre servicos.

### Compatibilidade

`connect.sid` e mantido apenas para navegacao MPA browser -> gateway.

## Pipeline de Request Protegida

1. Request chega ao gateway.
2. Middleware `requireAuth` resolve token por prioridade:
   - Bearer header
   - `req.session.sessionToken`
3. Gateway valida sessao em base de dados.
4. Em sucesso, popula `req.session.user`.
5. No proxy para sub-app, injeta:
   - `Authorization: Bearer <token>`
   - `X-Gateway-User-*`

## Fluxo de Login Atual

1. `POST /login` valida username e devolve proximo passo.
2. `POST /verify-password` ou `POST /set-password` devolve JSON com tokens e `redirect`.
3. Cliente guarda tokens em `sessionStorage`.
4. Cliente envia Bearer automaticamente (interceptor HTTP).

## Contratos Relevantes

### `GET /validate-session`

- Entrada: `Authorization: Bearer <accessToken>` (ou fallback de sessao interna)
- Saida valida:

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

### `POST /refresh-token`

- Entrada: `refreshToken`
- Saida: novos `accessToken` e `refreshToken`

## Sub-apps

As sub-apps devem:

1. Aplicar middleware auth Bearer-first.
2. Usar fast path por headers `X-Gateway-User-*`.
3. Fazer fallback para `/validate-session` quando necessario.
4. Redirecionar para `/login` em falha de auth.

## Decisoes de Arquitetura

1. Proxy no gateway e padrao oficial de abertura de apps.
2. Bearer e contrato oficial entre servicos.
3. Cookie nao e contrato de autenticacao entre servicos.
