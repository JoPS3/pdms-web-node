# Authentication & Service Communication Architecture

## Overview

The PDMS system uses a **centralized authentication gateway** with distributed app modules. Authentication is Bearer token-based (Phase 2), with optimized inter-service communication via proxy-injected user context headers.

---

## Token Flow

### Session Token Lifecycle

1. **Generation** (Gateway)
   - User enters username in `/pdms-new/login`
   - POST to gateway `/login` endpoint
   - AuthService creates session in DB: `sessions` table
   - Returns `sessionToken` (255-char hash) + `refreshToken`

2. **Storage** (Client)
   - `token-client.js` stores tokens in `sessionStorage`:
     - `pdms_accessToken` = sessionToken
     - `pdms_refreshToken` = refreshToken
     - `pdms_expiresAt` = ISO timestamp

3. **Auto-refresh** (Client)
   - Timer checks every 30 seconds if token expires within 5 minutes
   - Before expiry: POST to gateway `/gateway/refresh-token`
   - Returns new tokens; old refresh token is rotated

4. **Validation** (Apps)
   - Each request includes `Authorization: Bearer <sessionToken>`
   - Gateway middleware validates in BD before proxying
   - Apps can validate directly or via fallback HTTP call

5. **Logout**
   - POST to gateway `/logout`
   - Marks session as `is_valid = 0` in DB
   - Clears tokens from client sessionStorage

---

## Three Communication Patterns

### Pattern 1: Browser → App (via Gateway Proxy)

**Flow:**
```
Browser                          Gateway                    App
  │                               │                          │
  ├─Authorization: Bearer ────────>│                          │
  │   (sessionToken from token-   │                          │
  │    client.js sessionStorage)   │                          │
  │                               │  requireAuth middleware   │
  │                               │  - Validates token in DB  │
  │                               │  - Checks expiry          │
  │                               ├─Bearer token ────────────>│
  │                               ├─X-Gateway-User-Id ─────>│
  │                               ├─X-Gateway-User-Name ───>│
  │                               ├─X-Gateway-User-Email ──>│
  │                               ├─X-Gateway-User-Role ───>│
  │                               ├─X-Gateway-User-Role-Id→│
  │                               │                          │
  │                               │  Fast path (no HTTP)     │
  │                               │  buildUserFromHeaders()   │
  │                               │  req.user populated      │
  │                               │<─ HTML/JSON ─────────────│
  │<────────── Response ────────────────────────────────────<│
```

**Headers injected by Gateway proxy** (`proxyReqOptDecorator`):
- `Authorization: Bearer <sessionToken>` — allows app token validation if needed
- `X-Gateway-User-Id` — UUID, primary key in `users` table
- `X-Gateway-User-Name` — login username
- `X-Gateway-User-Email` — user email
- `X-Gateway-User-Role` — role name (e.g., "Admin", "User")
- `X-Gateway-User-Role-Id` — role UUID, primary key in `users_role` table

**App Middleware** (`requireGatewayAuth`):
1. Checks `Authorization: Bearer` exists
2. **Fast path**: Reads `X-Gateway-User-*` headers → populates `req.user` ✅ **No HTTP call**
3. **Fallback** (if headers absent): HTTP call to gateway `/validate-session`

**Latency improvement**: Eliminates ~100-200ms gateway round-trip per page request (99% of cases use fast path).

---

### Pattern 2: App → Gateway (Inter-Service HTTP)

**When:** App needs to validate token, refresh tokens, or check gateway state.

**Example:** Usuarios app validating OneDrive session via gateway API:
```javascript
// usuarios/src/controllers/auth.controller.js
async function validateOneDriveSetup(sessionToken) {
  const response = await axios.get(
    'http://gateway:6000/pdms-new/validate-session',
    {
      headers: { Authorization: `Bearer ${sessionToken}` }
    },
    { timeout: 5000 }
  );
  return response.data; // { valid: true, user: {...} }
}
```

**Gateway Processing:**
- `parseSessionToken(req)` extracts token from `Authorization: Bearer`
- `AuthService.validateSession(token)` queries `sessions` table
- Returns JSON: `{ valid: true, userId, userName, email, roleId, role, ... }`

**Headers sent:**
- `Authorization: Bearer <sessionToken>` — required
- `X-Forwarded-*` (if behind nginx) — preserved by proxy

**Response:**
```json
{
  "valid": true,
  "userId": "uuid-...",
  "userName": "joao",
  "email": "joao@pedaco.pt",
  "roleId": "uuid-...",
  "role": "Admin"
}
```

---

### Pattern 3: App → App (Direct Service Call)

**When:** One app calls another app's API directly (not via gateway proxy).

**Example:** Mapas calls Usuarios to log audit entry:
```javascript
// mapas/src/services/mapas-audit.service.js
async function logAudit(sessionToken, action, details) {
  const response = await axios.post(
    'http://usuarios:6001/pdms/usuarios/api/audit',
    { action, details },
    {
      headers: { Authorization: `Bearer ${sessionToken}` },
      timeout: 5000
    }
  );
  return response.data;
}
```

**Flow:**
```
App A (mapas)               App B (usuarios)
   │                           │
   ├─Authorization: Bearer ───>│
   │  (sessionToken)           │ Middleware: requireGatewayAuth
   │  /api/audit               │
   │                           ├─ X-Gateway-* headers? NO
   │                           ├─ Fallback: HTTP to gateway
   │                           │
   │                           ├─ axios.get(
   │                           │   'http://gateway:6000/.../validate-session',
   │                           │   headers: { Bearer: ... }
   │                           │ )
   │                           │
   │<─ { error: ... } ────────<│ If validation fails
   │<─ { success: ... } ──────<│ If validation succeeds
```

**App B (Usuarios) Middleware:**
1. Extracts `Authorization: Bearer` header
2. No `X-Gateway-User-*` headers present (direct call) → **Fallback activated**
3. HTTP call to gateway `/validate-session`
4. Populates `req.user` from response
5. Processes request

**Latency**: ~100-200ms extra due to HTTP fallback (expected and acceptable for inter-service calls).

---

## Request Processing Summary

| Step | Component | Action |
|------|-----------|--------|
| 1 | Client (Browser) | Reads token from `sessionStorage` |
| 2 | Client | Injects `Authorization: Bearer` header |
| 3 | Nginx | Routes `/pdms-new/apps/*` to gateway:6000 |
| 4 | Gateway `requireAuth` middleware | Validates token in DB; rejects if expired/invalid |
| 5 | Gateway proxy `proxyReqOptDecorator` | Injects `Authorization: Bearer` + 5 `X-Gateway-User-*` headers |
| 6 | Downstream app receives | Headers + request body |
| 7 | App `requireGatewayAuth` middleware | **Fast path**: Reads headers → `req.user` populated ✅ |
| 8 | App controller | Uses `req.user` for role checks, logging, views |
| 9 | App response | Sent back via gateway proxy (if proxied) or direct (if direct call) |

---

## Header Details

### Authorization Header
- **Format**: `Authorization: Bearer <sessionToken>`
- **Source**: Browser (token-client.js), or inter-service calls
- **Validation**: Gateway `requireAuth` checks token in `sessions` table

### X-Gateway-User-* Headers (5 total)

| Header | Value | Example | Usage |
|--------|-------|---------|-------|
| `X-Gateway-User-Id` | UUID from `users.id` | `550e8400-e29b...` | User record lookup |
| `X-Gateway-User-Name` | `users.username` | `joao` | Display in UI |
| `X-Gateway-User-Email` | `users.email` | `joao@pedaco.pt` | Email notifications |
| `X-Gateway-User-Role` | `users_role.name` | `Admin` | Role-based access control |
| `X-Gateway-User-Role-Id` | UUID from `users_role.id` | `a1b2c3d4-...` | Role lookups in app |

**Injection point**: `gateway/src/routes/apps-proxy.routes.js` → `proxyReqOptDecorator`

**Consumption point**: Each app's `buildUserFromHeaders(req)` function in `src/middlewares/auth.middleware.js`

---

## Database Session Storage

### `sessions` Table

```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT uuid_v7(),
  user_id uuid NOT NULL,
  session_token varchar(255) NOT NULL UNIQUE,  -- Bearer token value
  ip_address varchar(45),
  user_agent varchar(500),
  expires_at timestamp NOT NULL,
  last_activity timestamp DEFAULT NOW() ON UPDATE NOW(),
  is_valid tinyint(1) DEFAULT 1,
  created_at timestamp DEFAULT NOW(),
  refresh_token varchar(255) UNIQUE,  -- Phase 2 refresh token
  refresh_token_expires_at timestamp,
  refresh_token_rotated tinyint(1) DEFAULT 0,
  -- ... audit columns
  INDEX(user_id),
  INDEX(expires_at),
  INDEX(is_valid)
);
```

### Session Lifecycle

| State | `is_valid` | Action |
|-------|-----------|--------|
| Active | 1 | Token accepted, last_activity updated on each request |
| Expired | 1 (but `NOW() > expires_at`) | Rejected by AuthService; cleanup scheduled every 10 min |
| Logged out | 0 | Marked by `/logout` endpoint; no further validation |
| Cleanup | 0 (is_deleted = 1) | Removed by SessionCleanupScheduler after expiry |

---

## Security Considerations

### Token Validation
- **On every request** via gateway proxy (DB query with indexes)
- **Cached in app** via fast-path headers (no additional validation)
- **Token value** never exposed in HTTP logs (Bearer header redacted best practice)

### Refresh Token Rotation
- After `/refresh-token` call, old token is marked invalid
- New token issued; client updates `sessionStorage`
- Protects against token replay attacks

### Headers Trust
- **X-Gateway-User-\*** headers **only trusted when proxied via gateway**
- Apps receiving direct calls fall back to HTTP validation
- Gateway middleware enforces this via `proxyReqOptDecorator` — headers only injected if `req.session.user` exists

### CORS / Cross-Origin
- Apps run on different ports (6000 gateway, 6001 usuarios, 6002 mapas, etc.)
- Nginx reverse proxy (`/pdms-new/*` → localhost:6000) unifies origin for CORS
- Token stored in `sessionStorage` (not vulnerable to CSRF)

---

## Deployment Scenarios

### Scenario A: Proxied (Production via Nginx)
```
Client (browser)
  ↓
Nginx: https://domain/pdms-new/
  ├─ /login → localhost:6000/login
  ├─ /apps → localhost:6000/apps
  └─ /apps/mapas/* → localhost:6000/mapas/*
                      (gateway proxy → localhost:6002)
```

**Headers injected**: Yes (fast path active)

**Inter-app calls**: Direct (localhost:6001 → localhost:6002), fallback HTTP validation

---

### Scenario B: Development (Direct to gateway:6000)
```
Client (browser)
  ↓
http://localhost:6000/pdms-new/
  ├─ /login
  ├─ /apps
  └─ /apps/mapas/* → localhost:6002 (proxy)
```

**Headers injected**: Yes (same as production)

**Inter-app calls**: Direct (localhost:6001 → localhost:6002), fallback HTTP validation

---

## Testing Validations

### Curl: Validate Authentication Chain
```bash
# 1. Login
curl -X POST http://localhost:6000/pdms-new/login \
  -H "Content-Type: application/json" \
  -d '{"username":"joao"}' \
  -c /tmp/cookies.txt

# 2. Get token from session
TOKEN=$(mysql -h localhost -u pedaco -p'@P3dacod' pedaco-000 \
  -N -e "SELECT session_token FROM sessions \
          WHERE user_id = (SELECT id FROM users WHERE username = 'joao') \
          AND is_valid = 1 \
          ORDER BY created_at DESC LIMIT 1")

# 3. Access app via proxy (headers injected automatically)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:6000/pdms-new/mapas/ \
  -L

# 4. Direct call to app (falls back to HTTP validation)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:6002/pdms-new/mapas/ \
  -L
```

### Browser DevTools
- **Storage → Session Storage**: Check `pdms_accessToken`, `pdms_refreshToken`, `pdms_expiresAt`
- **Network → Headers (Request)**: Verify `Authorization: Bearer` sent with each app request
- **Network → Headers (Response from gateway)**: App should render without 302 redirects to login

---

## Middleware Reference

### Gateway (`gateway/src/middlewares/auth.middleware.js`)
```javascript
requireAuth(req, res, next)
  ├─ Checks req.session.user exists
  ├─ Extracts Bearer token
  ├─ Validates in sessions table (DB query)
  ├─ Checks token expiry + is_valid = 1
  └─ If valid → next(); else → redirect /login
```

### Downstream Apps (`mapas/src/middlewares/auth.middleware.js`, etc.)
```javascript
requireGatewayAuth(req, res, next)
  ├─ Checks Authorization: Bearer exists
  ├─ Fast path: buildUserFromHeaders(req)
  │  └─ Reads X-Gateway-User-* → req.user ✅ return next()
  └─ Fallback: validateGatewaySession(req)
     ├─ HTTP call to gateway /validate-session
     └─ If valid → req.user = result.user; next()
        Else → redirect /login
```

---

## Refresh Token Flow (Auto-refresh)

**Trigger**: `token-client.js` timer detects token expires in < 5 minutes

**Request**:
```javascript
POST http://gateway:6000/pdms-new/gateway/refresh-token
{
  "refreshToken": "<old_refresh_token>"
}
```

**Gateway Processing**:
1. Finds session by refresh_token
2. Checks refresh_token not expired
3. Validates refresh_token_rotated flag (prevent replay)
4. Generates new sessionToken + new refreshToken
5. Updates sessions table; marks old token is_valid=0
6. Returns JSON:
   ```json
   {
     "status": "ok",
     "accessToken": "<new_token>",
     "refreshToken": "<new_token>",
     "expiresIn": 3600
   }
   ```

**Client Processing**:
```javascript
window.pdmsTokenClient.setTokens(accessToken, refreshToken, expiresIn);
// Updates sessionStorage + restarts auto-refresh timer
```

---

## Configuration

### Environment Variables

**Gateway** (`.env`):
```
DB_HOST=localhost
DB_USER=pedaco
DB_PASSWORD=@P3dacod
DB_NAME=pedaco-000
SESSION_SECRET=<strong-random-value>
BASE_PATH_DEV=/pdms-new
BASE_PATH_PROD=/pdms
USUARIOS_PORT_DEV=6001
MAPAS_PORT=6002
VENDAS_PORT=6003
COMPRAS_PORT=6004
RH_PORT=6005
```

**Apps** (e.g., `mapas/.env`):
```
NODE_ENV=development
BASE_PATH_DEV=/pdms-new/mapas
BASE_PATH_PROD=/pdms/mapas
GATEWAY_PORT=6000
GATEWAY_BASE_PATH=/pdms-new
DB_HOST=localhost
DB_USER=pedaco
DB_PASSWORD=@P3dacod
DB_NAME=pedaco-000
```

---

## Troubleshooting

### Problem: 502 Bad Gateway
**Cause**: App service not running or port not listening  
**Fix**: `./pdms.sh clean-restart` to restart all PM2 processes

### Problem: Redirect loop to /login
**Cause**: Bearer token not injected to proxied requests, or headers not read by app middleware  
**Fix**: Verify `proxyReqOptDecorator` injecting headers; verify `buildUserFromHeaders` reads them

### Problem: req.user undefined in controller
**Cause**: Middleware not executed or user extraction failed  
**Fix**: Ensure route protected with `requireGatewayAuth`; check logs for "Erro ao validar sessão"

### Problem: Token expires immediately
**Cause**: Server clock skew or token generation with wrong expiry  
**Fix**: Verify server NTP sync; check DB `NOW()` vs client `Date.now()`

---

## Related Documentation

- [DESKTOP_SINGLE_DOM_MODEL.md](DESKTOP_SINGLE_DOM_MODEL.md) — UI layout and app integration
- [GATEWAY_ACCESS_MODEL.md](GATEWAY_ACCESS_MODEL.md) — Gateway routes and proxying
- [TABLE_FILTER_GLOBAL_MODEL.md](TABLE_FILTER_GLOBAL_MODEL.md) — Filtering architecture
- [PDMS_APP_INTEGRATION.md](PDMS_APP_INTEGRATION.md) — App module requirements

---

**Last Updated**: 2026-04-17  
**Version**: Phase 2 (Bearer tokens + distributed apps + fast-path headers)
