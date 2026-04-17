# Token Evolution: Multi-Domain Authorization Status

## Estado Atual (Source of Truth)

O PDMS opera em modelo Bearer-first.

- `Authorization: Bearer <accessToken>` e o contrato obrigatorio para comunicacao entre servicos.
- O gateway continua como fonte unica de validacao de sessao.
- `connect.sid` e apenas transporte de compatibilidade para navegacao MPA browser -> gateway.

## Contrato Atual

### Login em duas etapas

1. `POST /login` valida username e direciona o proximo passo.
2. `POST /verify-password` ou `POST /set-password` devolve JSON com tokens.

Resposta de sucesso:

```json
{
   "status": "ok",
   "accessToken": "...",
   "refreshToken": "...",
   "expiresIn": 900,
   "redirect": "/pdms-new/apps"
}
```

### Validacao

- `GET /validate-session`
- Entrada principal: `Authorization: Bearer <accessToken>`
- Resposta: `{ valid, userId, userName, email, roleId, role }`

### Refresh

- `POST /refresh-token`
- Entrada: `refreshToken`
- Saida: novo `accessToken` e `refreshToken`

## Comportamento de Apps

- Sub-apps usam middleware Bearer-first.
- Fast path por headers `X-Gateway-User-*` quando request vem do proxy do gateway.
- Fallback por chamada HTTP a `GET /validate-session`.

## Politica de Compatibilidade

- Suporte a sessao Express no browser permanece para navegacao MPA.
- Novas features nao devem depender de cookie como mecanismo primario de auth.

## Roadmap Futuro (Phase 3)

1. Multi-domain completo com CORS estrito.
2. Access token curto e refresh rotativo (ja suportado no contrato).
3. Hardening adicional de seguranca por dominio e revogacao central.
