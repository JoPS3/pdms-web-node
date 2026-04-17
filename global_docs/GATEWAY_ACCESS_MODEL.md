# Gateway - Modelo de Acesso Atual

## Visao Geral

O gateway e o ponto de entrada unico do PDMS e concentra:

1. Autenticacao.
2. Launcher de apps (`/apps`).
3. Proxy canonico para sub-apps (`/apps/<app>`).
4. Validacao e refresh de tokens (`/validate-session`, `/refresh-token`).

## Contrato Atual

O modelo oficial e `accessToken + refreshToken`.

1. O browser recebe ambos no login final.
2. O browser nao guarda tokens em `sessionStorage`.
3. O gateway persiste tokens em cookies HttpOnly no seu dominio.
4. Requests protegidos usam o `accessToken`.
5. Se o `accessToken` falhar e existir `refreshToken`, o gateway tenta refresh automaticamente.
6. Se o refresh falhar, o acesso volta a login.

## Modelo de Navegacao

### Browser (canonico)

- Dev: `/pdms-new/apps/<app>`
- Prod: `/pdms/apps/<app>`

O browser nao deve navegar para `localhost:<porta>` diretamente.

### Service-to-service

- Uso obrigatorio de `Authorization: Bearer <accessToken>`.
- Pode enviar `X-Refresh-Token: <refreshToken>` quando quiser permitir refresh remoto.
- Validacao por `GET /validate-session`.

## Pipeline de Request Protegida

1. O request chega ao gateway.
2. O middleware `requireAuth` resolve o `accessToken` por prioridade:
   - `Authorization: Bearer <accessToken>`
   - cookie HttpOnly `pdms_access_token`
3. Resolve o `refreshToken` por prioridade:
   - header `X-Refresh-Token`
   - cookie HttpOnly `pdms_refresh_token`
4. Valida `accessToken` na tabela `sessions`.
5. Se o `accessToken` falhar mas houver `refreshToken`, tenta refresh automatico.
6. Em sucesso, o gateway injeta no proxy:
   - `Authorization: Bearer <accessToken>`
   - `X-Gateway-User-*`
7. Em falha definitiva, limpa cookies de auth e redireciona para login.

## Login e Logout

### Login

1. `POST /login` valida username e devolve o proximo passo.
2. `POST /verify-password` ou `POST /set-password` conclui autenticacao.
3. O gateway responde com `Set-Cookie` para `pdms_access_token` e `pdms_refresh_token`.
4. O browser segue para `/apps` sem precisar de `sessionStorage`.

### Logout

1. `POST /logout` invalida a sessao em BD.
2. O gateway limpa `pdms_access_token` e `pdms_refresh_token`.

## Contratos Relevantes

### `GET /validate-session`

Entrada:

- `Authorization: Bearer <accessToken>` ou cookie `pdms_access_token`
- opcionalmente `X-Refresh-Token: <refreshToken>` ou cookie `pdms_refresh_token`

Saida valida:

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

Se precisar de refresh e ele for bem-sucedido, a resposta pode incluir tambem:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1200,
  "tokenType": "Bearer",
  "refreshed": true
}
```

### `POST /refresh-token`

Entrada:

- body `refreshToken`, ou
- header `X-Refresh-Token`, ou
- cookie `pdms_refresh_token`

Saida:

```json
{
  "status": "ok",
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1200,
  "tokenType": "Bearer"
}
```

## Sub-apps

As sub-apps devem:

1. Aplicar middleware auth Bearer-first.
2. Usar fast path por headers `X-Gateway-User-*` quando o request veio pelo proxy do gateway.
3. Fazer fallback para `GET /validate-session` quando o request chegar diretamente ao servico.
4. Redirecionar para `/login` em falha de auth.

## Nota Importante

`connect.sid` continua a existir apenas para o passo temporario de bootstrap do login em duas etapas (`tempUser`).
Nao e parte do contrato oficial de autenticacao das apps.
