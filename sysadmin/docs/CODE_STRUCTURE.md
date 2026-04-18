# Sysadmin - Estrutura Interna de Codigo

Referencia interna para desenvolvimento e manutencao do modulo `sysadmin`.
Para convencoes globais ver `global_docs/CODE_CONVENTIONS.md`.

---

## Divisao de responsabilidades

### Controllers GUI (`src/controllers/*.gui.controller.js`)

Montados em `src/app.js` sob `requireGatewayAuth`.
Devolvem renders EJS ou downloads (CSV/ODF).

| Ficheiro | Funcoes | Rota |
|---|---|---|
| `users.gui.controller.js` | `getHomePage` | `GET /` |
| `users.gui.controller.js` | `getEditUserPage` | `GET /users/:userId/edit` |
| `users.gui.controller.js` | `exportUsersList` | `GET /users/export` |

### Controllers API (`src/controllers/*.api.controller.js`)

Montados em `src/routes/index.js` sob `requireGatewaySessionApi`.
Devolvem JSON. Nunca chamam `res.render()`.

| Ficheiro | Funcoes | Rota |
|---|---|---|
| `sysadmin.api.controller.js` | `getSessionStatus` | `GET /api/session/status` |
| `sysadmin.api.controller.js` | `getInternalSessionStatus` | `POST /internal/session/status` |
| `sysadmin.api.controller.js` | `changeInternalSessionPassword` | `POST /internal/session/change-password` |
| `users.api.controller.js` | `updateUserFromEdit` | `POST /internal/users/:userId/update` |
| `onedrive.api.controller.js` | `getInternalOneDriveStatus` | `GET /internal/onedrive/status` |
| `onedrive.api.controller.js` | `getInternalOneDriveSetup` | `GET /internal/onedrive/setup` |
| `onedrive.api.controller.js` | `saveInternalOneDriveSetup` | `POST /internal/onedrive/setup` |
| `onedrive.api.controller.js` | `startInternalOneDriveConnect` | `POST /internal/onedrive/connect` |
| `onedrive.api.controller.js` | `disconnectInternalOneDrive` | `POST /internal/onedrive/disconnect` |

---

## Services

| Ficheiro | Responsabilidade |
|---|---|
| `users.service.js` | CRUD de utilizadores: mappers, listagem simples, leitura por ID, update |
| `users-filters.service.js` | Paginacao com filtros de tabela (`tf*`), opcoes de filtro (Excel-like), export query |
| `user-password.service.js` | Leitura e update de password hash por userId |
| `password.service.js` | `hashPassword`, `verifyPassword` (bcrypt) |
| `mapas-audit.service.js` | Registo de auditoria via endpoint interno do modulo `mapas` |

**Regra:** `users-filters.service.js` importa `mapUserRow` de `users.service.js`.
Os controllers importam de ambos — nunca de DAOs diretamente.

---

## DAOs

| Ficheiro | Entidade | Responsabilidade |
|---|---|---|
| `users.dao.js` | `users` / `user_roles` | Listagem, contagem, opcoes de filtro distintas, update |
| `user-password.dao.js` | `users` (campo `password`) | Leitura e update de hash |

---

## Utils

| Ficheiro | Exporta | Usado por |
|---|---|---|
| `table-filters.js` | `parseTableFiltersFromQuery` | `users.gui.controller.js`, `users-filters.service.js` (indirectamente via controller) |
| `users-export.js` | `createCsv`, `createFlatOdf` | `users.gui.controller.js` |

---

## Middleware

`src/middlewares/session.middleware.js` — unico middleware de sessao do modulo.

Exporta:
- `requireGatewayAuth(req, res, next)` — redireciona para login se sessao invalida (para GUI)
- `requireGatewaySessionApi(req, res, next)` — devolve 401 JSON se sessao invalida (para API)
- `validateGatewaySession(req)` — async, devolve `{ valid, user, reason }` sem side effects HTTP
- `parseSessionToken(req)` — extrai token de `Authorization: Bearer` ou cookie

Usa `gateway-auth.local.js` internamente para a logica de validacao via HTTP ao gateway.

---

## Fluxo de uma request GUI tipica

```
Browser → gateway proxy
  → Authorization: Bearer + X-Gateway-User-*
  → app.js: requireGatewayAuth (fast path X-Gateway-User-*)
  → users.gui.controller.js: getHomePage
    → users-filters.service.js: listUsersWithPagination
      → users.dao.js: listUsersByWhereWithPagination
    → users-filters.service.js: getUsersTableFilterOptions
      → users.dao.js: listDistinct*Options
    → users.service.js: listActiveUserRoles
      → users.dao.js: listActiveRoles
  → res.render('index', { ... })
```

## Fluxo de uma request API tipica

```
Gateway (inter-servico) → Authorization: Bearer
  → routes/index.js: requireGatewaySessionApi
    → session.middleware.js: valida token via gateway
  → users.api.controller.js: updateUserFromEdit
    → users.service.js: getUserByIdForEdit, updateUserFromEditById
    → mapas-audit.service.js: createUserUpdateAuditLog
  → res.json({ status: 'ok' })
```
